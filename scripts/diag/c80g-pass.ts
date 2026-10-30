// @ts-nocheck — 진단 스크립트 (엔진관리자24, c80g): 성향별 20 m+ 패스 분해 + 먼 수신 후보 커버 표본
// 실행: npx vite-node scripts/diag/c80g-pass.ts -- [경기수=160(×2방향)] [seed=41000] [only=tikitaka/balanced,gegenpress/balanced,…] [out=파일.json] [경로=값 …]
import { writeFileSync } from 'node:fs';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { c80gAdd, CV_DB, cvIdx, DIR_NAMES, LANE_NAMES, OUT_NAMES, PF, ZONE_NAMES, type C80gOut } from '../engine/c80gProbe';
import { tacticsOf, type Level } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 160, seed0 = 41000, out = '';
let pairs: [string, string][] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('only=')) pairs = a.slice(5).split(',').map((p) => p.split('/') as [string, string]);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
if (!pairs.length) pairs = [['tikitaka', 'balanced'], ['gegenpress', 'balanced'], ['direct', 'balanced'], ['counter', 'balanced'], ['block', 'balanced'], ['balanced', 'balanced'], ['tikitaka', 'gegenpress']];
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
  jobs.push((aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, c80g: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, c80g: true }) as MatchJob);
}
const outs = await runJobs<MatchOut>(jobs, { label: `c80g 탐침 ${jobs.length}경기` });
console.log(`\n${n}경기씩(방향 2, 시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
const f1 = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '-');
const pc = (v: number, d: number, k = 0) => (d ? ((100 * v) / d).toFixed(k) : '-');
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const save: Record<string, unknown> = { n, seed0, overrides, cells: {} };

type Row = { name: string; opp: string; T: C80gOut; gd: number; gf: number; ga: number };
const rows: Row[] = [];
pairs.forEach(([a, b], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  for (const side of [0, 1]) {
    let T: C80gOut | null = null;
    let gf = 0, ga = 0;
    xs.forEach((m, k) => {
      const me = (aHome(k) ? 0 : 1) ^ side;
      gf += me === 0 ? m.homeGoals : m.awayGoals; ga += me === 0 ? m.awayGoals : m.homeGoals;
      const w = m.c80g![me]!;
      if (!T) T = JSON.parse(JSON.stringify(w)); else c80gAdd(T, w);
    });
    rows.push({ name: side === 0 ? a : b, opp: side === 0 ? b : a, T: T!, gd: (gf - ga) / n, gf, ga });
  }
});

const recv = (r: number[]) => r[PF.outcome]! <= 1;
const band = (d: number) => (d < 25 ? 0 : d < 30 ? 1 : d < 35 ? 2 : 3);
const BAND = ['20~25', '25~30', '30~35', '35+'];

console.log('\n## 1. 20 m+ 패스 — 거리대별 시도/경기 (받음 %) · 땅볼/공중 · 실패 구성');
console.log('| 팀 (상대) | 득실 | 20 m+ 합 | 20~25 | 25~30 | 30~35 | 35+ | 공중(30+) 몫 % | 실패 구성: 가로채임 / 빗나감 / 착지 경합 패 / 정지(아웃·오프사이드·파울)+미확정+교체 (% of 20 m+) | 판단 p 평균 · 실제 받음 % | 원터치 % |');
for (const r of rows) {
  const P = r.T.passes;
  const cells = [0, 1, 2, 3].map((bi) => { const q = P.filter((p) => band(p[PF.d]!) === bi); return `${f1(q.length / n, 1)} (${pc(q.filter(recv).length, q.length)})`; });
  const air = P.filter((p) => p[PF.air]);
  const oc = (o: number) => pc(P.filter((p) => p[PF.outcome] === o).length, P.length, 1);
  const pj = P.filter((p) => p[PF.p]! >= 0);
  console.log(`| ${r.name} (${r.opp}) | ${f1(r.gd)} | ${f1(P.length / n, 1)} (${pc(P.filter(recv).length, P.length)}) | ${cells.join(' | ')} | ${pc(air.length, P.length)} | ${oc(2)} / ${pc(P.filter((p) => p[PF.outcome] === 3 || p[PF.outcome] === 4).length, P.length, 1)} / ${oc(5)} / ${oc(6)}+${oc(7)}+${oc(8)} | ${f1(mean(pj.map((p) => p[PF.p]!)), 3)} · ${pc(pj.filter(recv).length, pj.length)} | ${pc(P.filter((p) => p[PF.oneTouch]).length, P.length)} |`);
}

console.log('\n## 1b. 전체 패스 거리 히스토그램 — 시도/경기 (받음 %)');
console.log('| 팀 (상대) | 0~5 | 5~10 | 10~15 | 15~20 | 20~25 | 25~30 | 30~35 | 35+ | 20 m+ 비율 % |');
for (const r of rows) {
  const H = r.T.hist;
  let tot = 0, far = 0;
  const cells = [] as string[];
  for (let i = 0; i < 8; i++) { cells.push(`${f1(H[i * 2]! / n, 1)} (${pc(H[i * 2 + 1]!, H[i * 2]!)})`); tot += H[i * 2]!; if (i >= 4) far += H[i * 2]!; }
  console.log(`| ${r.name} (${r.opp}) | ${cells.join(' | ')} | ${pc(far, tot, 1)} |`);
}

console.log('\n## 2. 20 m+ 패스 받는 선수 능력치 (평균) 대 팀 필드 선수 평균 — 땅볼(20~30) / 공중(30+)');
console.log('| 팀 (상대) | 구분 | 수 | 볼 컨트롤 | 근력(+체격) | 점프 | 헤더 | 키 cm | 속도 | 민첩 | 공격 위치선정 | 받는 줄 수비/중원/공격 % |');
for (const r of rows) {
  const TA = r.T.teamAttr, g = TA[8]!;
  console.log(`| ${r.name} (${r.opp}) | 팀 평균 | - | ${f1(TA[0]! / g, 1)} | ${f1(TA[1]! / g, 1)} | ${f1(TA[2]! / g, 1)} | ${f1(TA[3]! / g, 1)} | ${f1(TA[4]! / g, 1)} | ${f1(TA[5]! / g, 1)} | ${f1(TA[6]! / g, 1)} | ${f1(TA[7]! / g, 1)} | - |`);
  for (const [lab, q] of [['땅볼 20~30', r.T.passes.filter((p) => !p[PF.air])], ['공중 30+', r.T.passes.filter((p) => p[PF.air])]] as [string, number[][]][]) {
    if (!q.length) continue;
    const m = (k: number) => f1(mean(q.map((p) => p[k]!)), 1);
    const ln = (l: number) => pc(q.filter((p) => p[PF.rcLine] === l).length, q.length);
    console.log(`| ${r.name} (${r.opp}) | ${lab} | ${q.length} | ${m(PF.rcBall)} | ${m(PF.rcStr)} | ${m(PF.rcJump)} | ${m(PF.rcHead)} | ${m(PF.rcHeight)} | ${m(PF.rcPace)} | ${m(PF.rcAgility)} | ${m(PF.rcOtb)} | ${ln(1)}/${ln(2)}/${ln(3)} |`);
  }
}

console.log('\n## 3. 20 m+ 패스 — 받는 순간 수비 거리 (가장 가까운 상대 필드 선수, m) · 받음 %');
console.log('| 팀 (상대) | 구분 | 수/경기 | 찰 때 목표점 수비 거리 평균 | 받는 순간 수비 거리 평균 | 받는 순간 <2.8 m % | <5 m % | ≥ 8 m % | 받음 % (수비 <2.8 / 2.8~5 / 5~8 / 8+) |');
for (const r of rows) {
  for (const [lab, q] of [['땅볼 20~30', r.T.passes.filter((p) => !p[PF.air] && p[PF.defRcArr]! >= 0)], ['공중 30+', r.T.passes.filter((p) => p[PF.air] && p[PF.defRcArr]! >= 0)]] as [string, number[][]][]) {
    if (!q.length) continue;
    const bins = [[0, 2.8], [2.8, 5], [5, 8], [8, 999]].map(([lo, hi]) => { const z = q.filter((p) => p[PF.defRcArr]! >= lo && p[PF.defRcArr]! < hi); return `${pc(z.filter(recv).length, z.length)} (${f1(z.length / n, 1)})`; });
    console.log(`| ${r.name} (${r.opp}) | ${lab} | ${f1(q.length / n, 1)} | ${f1(mean(q.map((p) => p[PF.defTgtKick]!)), 1)} | ${f1(mean(q.map((p) => p[PF.defRcArr]!)), 1)} | ${pc(q.filter((p) => p[PF.defRcArr]! < 2.8).length, q.length)} | ${pc(q.filter((p) => p[PF.defRcArr]! < 5).length, q.length)} | ${pc(q.filter((p) => p[PF.defRcArr]! >= 8).length, q.length)} | ${bins.join(' / ')} |`);
  }
}

console.log('\n## 4. 20 m+ 패스 — 어디로 (받는 자리 분류 × 방향) · 시도/경기 (받음 %) · 받는 순간 수비 거리 평균');
console.log('| 팀 (상대) | 중원 줄 앞 | 줄 사이(중앙) | 측면 | 수비 줄 뒤 | 방향 뒤 / 옆 / 앞 | 구역 자기진영 / 중원 / 최종⅓ 밖 / 박스 부근 | 침투 % |');
for (const r of rows) {
  const P = r.T.passes;
  const lane = (l: number) => { const q = P.filter((p) => p[PF.lane] === l); const z = q.filter((p) => p[PF.defRcArr]! >= 0); return `${f1(q.length / n, 1)} (${pc(q.filter(recv).length, q.length)}) ${f1(mean(z.map((p) => p[PF.defRcArr]!)), 1)} m`; };
  const dr = (d: number) => { const q = P.filter((p) => p[PF.dir] === d); return `${f1(q.length / n, 1)} (${pc(q.filter(recv).length, q.length)})`; };
  const zn = (z: number) => { const q = P.filter((p) => p[PF.zone] === z); return `${f1(q.length / n, 1)} (${pc(q.filter(recv).length, q.length)})`; };
  console.log(`| ${r.name} (${r.opp}) | ${lane(0)} | ${lane(1)} | ${lane(2)} | ${lane(3)} | ${dr(0)} / ${dr(1)} / ${dr(2)} | ${zn(0)} / ${zn(1)} / ${zn(2)} / ${zn(3)} | ${pc(P.filter((p) => p[PF.through]).length, P.length)} |`);
}

console.log('\n## 5. 먼 수신 후보 커버 (소유 1초 표본, 소유자에서 20~35 m 동료) — 가장 가까운 상대 수비 거리 분포 % · 평균 m');
console.log('| 팀 (상대) | 표본 | 후보/표본 10~20 · 20~35 · 35+ | 20~35: <3 | 3~5 | 5~8 | 8~12 | 12~18 | 18+ | 평균 m: 중원 줄 앞 / 줄 사이 / 측면 / 수비 줄 뒤 | 자리 비율 % | 비커버(≥ 8 m) 후보 가장 가까운 수비: 줄 1/2/3 % · 그 수비 목표점–후보 m · 수비–자기 목표 m · 공에 더 가까움 % · 후보–수비 슬롯 m |');
for (const r of rows) {
  const T = r.T;
  const tot = (b: number) => { let t = 0; for (let l = 0; l < 4; l++) for (let d = 0; d < 6; d++) t += T.cover[cvIdx(b, l, d)]!; return t; };
  const t1 = tot(1);
  const dcol = (d: number) => { let t = 0; for (let l = 0; l < 4; l++) t += T.cover[cvIdx(1, l, d)]!; return pc(t, t1); };
  const lm = (l: number) => f1(T.cvNear[l * 2]! / Math.max(1, T.cvNear[l * 2 + 1]!), 1);
  const lp = (l: number) => pc(T.cvNear[l * 2 + 1]!, t1);
  const U = T.uncov;
  console.log(`| ${r.name} (${r.opp}) | ${T.cvSamples} | ${f1(T.cvCand[0]! / T.cvSamples, 2)} · ${f1(T.cvCand[1]! / T.cvSamples, 2)} · ${f1(T.cvCand[2]! / T.cvSamples, 2)} | ${[0, 1, 2, 3, 4, 5].map(dcol).join(' | ')} | ${lm(0)} / ${lm(1)} / ${lm(2)} / ${lm(3)} | ${lp(0)} / ${lp(1)} / ${lp(2)} / ${lp(3)} | ${pc(U[0]!, U[5]!)}/${pc(U[1]!, U[5]!)}/${pc(U[2]!, U[5]!)} · ${f1(U[3]! / Math.max(1, U[5]!), 1)} · ${f1(U[4]! / Math.max(1, U[5]!), 1)} · ${pc(U[6]!, U[5]!)} · ${f1(U[7]! / Math.max(1, U[5]!), 1)} |`);
}
console.log('\n## 5b. 먼 후보(20~35 m) 자리별 수비 거리 분포 % (<3 / 3~5 / 5~8 / 8~12 / 12~18 / 18+) — 10~20 m 후보 대조');
console.log('| 팀 (상대) | 20~35 중원 줄 앞 | 20~35 줄 사이 | 20~35 측면 | 20~35 수비 줄 뒤 | 10~20 전체 |');
for (const r of rows) {
  const T = r.T;
  const row = (b: number, l: number) => { const xs = [0, 1, 2, 3, 4, 5].map((d) => T.cover[cvIdx(b, l, d)]!); const t = xs.reduce((x, y) => x + y, 0); return xs.map((x) => pc(x, t)).join('/'); };
  const all10 = [0, 1, 2, 3, 4, 5].map((d) => [0, 1, 2, 3].reduce((t, l) => t + T.cover[cvIdx(0, l, d)]!, 0));
  const t10 = all10.reduce((x, y) => x + y, 0);
  console.log(`| ${r.name} (${r.opp}) | ${row(1, 0)} | ${row(1, 1)} | ${row(1, 2)} | ${row(1, 3)} | ${all10.map((x) => pc(x, t10)).join('/')} |`);
}

console.log('\n## 6. 받음 % — 받는 선수 능력치 분위 (20 m+ 땅볼 / 공중): 볼 컨트롤 · 공중 점수(헤더 .5+점프 .3+근력 .2) 하위 ⅓ / 중위 / 상위 ⅓');
console.log('| 팀 (상대) | 구분 | 볼 컨트롤 하/중/상 받음 % | 공중 점수 하/중/상 받음 % | 키 하/중/상 받음 % | 속도 하/중/상 받음 % |');
for (const r of rows) {
  for (const [lab, q] of [['땅볼 20~30', r.T.passes.filter((p) => !p[PF.air])], ['공중 30+', r.T.passes.filter((p) => p[PF.air])]] as [string, number[][]][]) {
    if (q.length < 30) continue;
    const terc = (f: (p: number[]) => number) => {
      const vs = q.map(f).sort((a, b) => a - b);
      const lo = vs[Math.floor(vs.length / 3)]!, hi = vs[Math.floor((2 * vs.length) / 3)]!;
      const g = [q.filter((p) => f(p) < lo), q.filter((p) => f(p) >= lo && f(p) < hi), q.filter((p) => f(p) >= hi)];
      return g.map((z) => pc(z.filter(recv).length, z.length)).join('/') + ` (${f1(lo, 0)}·${f1(hi, 0)})`;
    };
    console.log(`| ${r.name} (${r.opp}) | ${lab} | ${terc((p) => p[PF.rcBall]!)} | ${terc((p) => p[PF.rcHead]! * 0.5 + p[PF.rcJump]! * 0.3 + p[PF.rcStr]! * 0.2)} | ${terc((p) => p[PF.rcHeight]!)} | ${terc((p) => p[PF.rcPace]!)} |`);
  }
}

(save.cells as Record<string, unknown>).rows = rows.map((r) => ({ name: r.name, opp: r.opp, gd: r.gd, hist: r.T.hist, cover: r.T.cover, cvSamples: r.T.cvSamples, cvCand: r.T.cvCand, uncov: r.T.uncov, cvNear: r.T.cvNear, teamAttr: r.T.teamAttr, nPass: r.T.passes.length, passes: r.T.passes.map((p) => p.map((v) => Math.round(v * 10) / 10)) }));
if (out) writeFileSync(out, JSON.stringify(save));
void CV_DB; void DIR_NAMES; void LANE_NAMES; void OUT_NAMES; void ZONE_NAMES;
process.exit(0);
