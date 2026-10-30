// @ts-nocheck — 진단 스크립트 (엔진관리자23, c79y: 성향별 소유 중 팀 간격·패스 거리·게겐 수비 모양 — c79w-gegen 표 + 간격 표)
// 실행: npx vite-node scripts/diag/c79y-gegen.ts -- [경기수=160] [seed=41000] [only=gegenpress/tikitaka,gegenpress/balanced] [out=파일.json] [경로=값 …]
import { writeFileSync } from 'node:fs';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { c79wAdd, C79W_PI, SP_N, DF_N, type C79wOut } from '../engine/c79wProbe';
import { tacticsOf, type Level } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 160, seed0 = 41000, out = '', brief = false;
let pairs: [string, string][] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a === 'brief') brief = true;
  else if (a.startsWith('only=')) pairs = a.slice(5).split(',').map((p) => p.split('/') as [string, string]);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
if (!pairs.length) pairs = [['gegenpress', 'tikitaka']];
const tac = (spec: string) => {
  const [t, lv] = spec.split('@');
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t as never, levels);
};
const dirs = 2;
const aHome = (k: number) => (Math.floor(k / dirs) + (k % dirs)) % 2 === 1;
const jobs: MatchJob[] = [];
for (const [a, b] of pairs) for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / dirs);
  const flip = k % dirs === 1;
  const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tac(a));
  const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tac(b));
  jobs.push((aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, c79w: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, c79w: true }) as MatchJob);
}
const outs = await runJobs<MatchOut>(jobs, { label: `c79y 탐침 ${jobs.length}경기` });
console.log(`\n${n}경기씩(방향 2, 시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
const f1 = (v: number, d = 2) => v.toFixed(d);
const pc = (v: number, d: number, k = 1) => (d ? ((100 * v) / d).toFixed(k) : '-');
const save: Record<string, unknown> = { n, seed0, overrides, cells: {} };
pairs.forEach(([a, b], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const acc: { gf: number; ga: number; poss: number; sh: number; w: C79wOut; dist: number; distN: number; distMax: number; gfSq: number }[] = [];
  for (const side of [0, 1]) {
    let gf = 0, ga = 0, poss = 0, sh = 0, dsum = 0, dn = 0, dmax = 0, gfSq = 0;
    let W: C79wOut | null = null;
    xs.forEach((m, k) => {
      const me = (aHome(k) ? 0 : 1) ^ side;
      const T = m.team[me]!, O = m.team[1 - me]!;
      const g = me === 0 ? m.homeGoals : m.awayGoals, c = me === 0 ? m.awayGoals : m.homeGoals;
      gf += g; ga += c; gfSq += (g - c) * (g - c);
      poss += (100 * T.possessionTicks) / (T.possessionTicks + O.possessionTicks); sh += T.shots;
      for (const p of m.players) if (p.team === me && p.position !== 'GK' && p.minutes >= 90) { dsum += p.distance; dn++; dmax = Math.max(dmax, p.distance); }
      const w = m.c79w![me]!;
      if (!W) W = JSON.parse(JSON.stringify(w)); else c79wAdd(W, w);
    });
    acc.push({ gf, ga, poss, sh, w: W!, dist: dsum, distN: dn, distMax: dmax, gfSq });
  }
  const names = [a, b];
  const gd = (acc[0]!.gf - acc[0]!.ga) / n;
  const se = Math.sqrt(Math.max(0, acc[0]!.gfSq / n - gd * gd) / n);
  console.log(`\n### ${a} 대 ${b} — A 득실차 ${f1(gd, 3)} ± ${f1(se, 3)}`);
  console.log('| 팀 | 득/실 | 점유 % | 슈팅 | 90분 필드 평균 km · 최다 | 소유/경기 · 평균 초 · 10초+ % · 패스/소유 | 소유 끝: 상실 자기⅓/중간/상대⅓ · 슛 · 기타 (%) | 탈취 자기⅓/중간/상대⅓ (/경기) | 탈취 8초 슛 · xG · 골 (/경기) | 잃은 뒤: 역압박 가담 % · 창 안 되찾음 % · 6초 % · 10초 % · 뚫림 % |');
  for (const side of [0, 1]) {
    const A = acc[side]!, w = A.w;
    console.log(`| ${names[side]} | ${f1(A.gf / n)} / ${f1(A.ga / n)} | ${f1(A.poss / n, 1)} | ${f1(A.sh / n, 1)} | ${f1(A.dist / Math.max(1, A.distN) / 1000)} · ${f1(A.distMax / 1000)} | ${f1(w.poss / n, 1)} · ${f1(w.possT / Math.max(1, w.poss), 1)} · ${pc(w.poss10, w.poss)} · ${f1(w.possPass / Math.max(1, w.poss), 2)} | ${pc(w.endLoss[0], w.poss)} / ${pc(w.endLoss[1], w.poss)} / ${pc(w.endLoss[2], w.poss)} · ${pc(w.endShot, w.poss)} · ${pc(w.endOther, w.poss)} | ${f1(w.win[0] / n, 1)} / ${f1(w.win[1] / n, 1)} / ${f1(w.win[2] / n, 1)} | ${f1(w.win8Shots / n)} · ${f1(w.win8Xg / n, 3)} · ${f1(w.win8Goals / n, 3)} | ${pc(w.cpOn, w.loss)} · ${pc(w.cpWin, w.loss)} · ${pc(w.re6, w.loss)} · ${pc(w.re10, w.loss)} · ${pc(w.broke, w.loss)} |`);
  }
  console.log('\n소유 중 팀 간격 (1초 표본, 공 구역별 자기⅓ / 중간 / 상대⅓ · 전체) — m');
  console.log('| 팀 | 표본 | 가장 가까운 동료 평균 | 팀 폭 | 팀 길이 | 줄 1–2 | 줄 2–3 | 소유자 가장 가까운 동료 | 소유자 10 m 안 · 15 m 안 동료 | 후보 4명 중 자유(3 m 안 상대 없음) | 후보의 가장 가까운 상대 거리 |');
  for (const side of [0, 1]) {
    const S = acc[side]!.w.sp;
    const col = (j: number, div = 1) => { const vs: string[] = []; let tv = 0, tn = 0; for (let z = 0; z < 3; z++) { const nn = S[z * SP_N]!; const dd = div === 1 ? nn : S[z * SP_N + 11]!; vs.push(dd ? f1(S[z * SP_N + j]! / dd, 1) : '-'); tv += S[z * SP_N + j]!; tn += dd; } return `${vs.join(' / ')} · ${tn ? f1(tv / tn, 1) : '-'}`; };
    const tot = S[0]! + S[SP_N]! + S[2 * SP_N]!;
    console.log(`| ${names[side]} | ${f1(S[0]! / n, 0)} / ${f1(S[SP_N]! / n, 0)} / ${f1(S[2 * SP_N]! / n, 0)} | ${col(1)} | ${col(2)} | ${col(3)} | ${col(4)} | ${col(5)} | ${col(6)} | ${col(7)} · ${col(8)} | ${col(9)} | ${col(10, 2)} |`);
    void tot;
  }
  console.log('\n수비 중 모양 (상대 소유, 상대 기준 공 구역 자기⅓ / 중간 / 상대⅓ · 전체) — m');
  console.log('| 팀 | 공에서 가장 가까운 우리 · 둘째 | 소유자 5 m 안 우리 수 | 무게중심–공 거리 | 우리 폭 | 우리 길이 | 상대 후보 4명 중 3 m 안에 우리가 있는 수 |');
  for (const side of [0, 1]) {
    const D = acc[side]!.w.df;
    const col = (j: number) => { const vs: string[] = []; let tv = 0, tn = 0; for (let z = 0; z < 3; z++) { const nn = D[z * DF_N]!; vs.push(nn ? f1(D[z * DF_N + j]! / nn, 1) : '-'); tv += D[z * DF_N + j]!; tn += nn; } return `${vs.join(' / ')} · ${tn ? f1(tv / tn, 2) : '-'}`; };
    console.log(`| ${names[side]} | ${col(1)} · ${col(2)} | ${col(3)} | ${col(4)} | ${col(5)} | ${col(6)} | ${col(7)} |`);
  }
  console.log('\n패스 거리 분포 (오픈 플레이, 크로스 제외) — 칸: 시도/경기 (받음 %)');
  console.log('| 팀 | 0~5 | 5~10 | 10~15 | 15~20 | 20~25 | 25~30 | 30+ | 20 m+ 자유: 시도 (받음 %) | 20 m+ 압박: 시도 (받음 %) | 평균 거리 m |');
  for (const side of [0, 1]) {
    const H = acc[side]!.w.passHist, P = acc[side]!.w.pass20;
    const cells: string[] = []; let tot = 0, wsum = 0;
    for (let i = 0; i < 7; i++) { cells.push(`${f1(H[i * 2]! / n, 1)} (${pc(H[i * 2 + 1]!, H[i * 2]!, 0)})`); tot += H[i * 2]!; wsum += H[i * 2]! * (i < 6 ? i * 5 + 2.5 : 34); }
    console.log(`| ${names[side]} | ${cells.join(' | ')} | ${f1(P[0]! / n, 1)} (${pc(P[1]!, P[0]!, 0)}) | ${f1(P[2]! / n, 1)} (${pc(P[3]!, P[2]!, 0)}) | ${f1(wsum / Math.max(1, tot), 1)} |`);
  }
  if (!brief) {
    console.log('\n패스(오픈 플레이, 크로스 제외) — 칸: 거리 × 상대 역압박 창(CP) × 패서 압박(3 m 안 상대) · 값: 시도/경기 · 받음 % · 받은 뒤 수신자 자유 % · 수신자 압박 평균');
    console.log('| 팀 | <10 m 자유 | <10 m 압박 | <10 m CP 자유 | <10 m CP 압박 | 10~25 자유 | 10~25 압박 | 10~25 CP 압박 | 25+ 자유 | 25+ 압박 | 25+ CP 압박 | CP 안 가로채임 /경기 (가담자 %) | 전환 6초 패스/경기 · <10 m % · 받음 % |');
    const cell = (w: C79wOut, dk: number, cp: number, pr: number) => { const i = C79W_PI(dk, cp, pr); const nn = w.pass[i]!, r = w.pass[i + 1]!; return `${f1(nn / n, 1)} · ${pc(r, nn, 0)} · ${pc(w.pass[i + 2]!, r, 0)} · ${r ? (w.pass[i + 3]! / r).toFixed(2) : '-'}`; };
    for (const side of [0, 1]) {
      const w = acc[side]!.w;
      console.log(`| ${names[side]} | ${cell(w, 0, 0, 0)} | ${cell(w, 0, 0, 1)} | ${cell(w, 0, 1, 0)} | ${cell(w, 0, 1, 1)} | ${cell(w, 1, 0, 0)} | ${cell(w, 1, 0, 1)} | ${cell(w, 1, 1, 1)} | ${cell(w, 2, 0, 0)} | ${cell(w, 2, 0, 1)} | ${cell(w, 2, 1, 1)} | ${f1(w.cpInt / n)} (${pc(w.cpIntPresser, w.cpInt, 0)}) | ${f1(w.winPass[0] / n, 1)} · ${pc(w.winPass[1], w.winPass[0])} · ${pc(w.winPass[2], w.winPass[0])} |`);
    }
    console.log('\n판단(오픈 플레이 필드 선수) — 결정/경기 · <10 m 패스 선택 % · 압박 속 결정 % · 압박 속 선택 구성(<10 m 패스 / 유지 / 25 m+ / 몰기 %) · 상대 역압박 창 안 결정/경기 · 창 안 선택 구성 · 창 안 선택 p 평균');
    console.log('| 팀 | 결정 | <10 m % | 압박 % | 압박 속 구성 | CP 결정 | CP 구성 | CP p |');
    for (const side of [0, 1]) {
      const w = acc[side]!.w;
      console.log(`| ${names[side]} | ${f1(w.dec / n, 0)} | ${pc(w.decShort, w.dec)} | ${pc(w.decP, w.dec)} | ${pc(w.decPShort, w.decP)} / ${pc(w.decPHold, w.decP)} / ${pc(w.decPLong, w.decP)} / ${pc(w.decPCarry, w.decP)} | ${f1(w.decCp / n, 1)} | ${pc(w.decCpShort, w.decCp)} / ${pc(w.decCpHold, w.decCp)} / ${pc(w.decCpLong, w.decCp)} / ${pc(w.decCpCarry, w.decCp)} | ${w.decCp ? (w.decCpP / w.decCp).toFixed(3) : '-'} |`);
    }
  }
  (save.cells as Record<string, unknown>)[`${a}/${b}`] = { names, acc };
});
if (out) writeFileSync(out, JSON.stringify(save));
process.exit(0);
