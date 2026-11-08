// 진단 (C.78p 엔진관리자11 질문 1): 박스 수비 구조 — 상대 박스 안 수비 인원(0~3 / 4~5 / 6+)별로 박스로 가는 패스 성공 · 박스 수신 순간 수비 거리 ·
// 받은 뒤 3초(슛·잃음) · 12 m 안 발 슛의 앞 장면을 센다. "수비 인원이 늘면 박스 수신·첫 터치가 나빠지는가"를 본다. 엔진 코드는 바꾸지 않는다.
// 실행: npx vite-node scripts/diag/c78p-box.ts -- [경기수=60] [레이팅=75:75] 짝1 짝2 ... [경로=값 ...]
//   짝: A:B — A 가 공격 쪽으로 읽히는 팀(표는 A 공격 · B 수비, B 공격 · A 수비 둘 다). 성향 이름 또는 cust:번호(custom-sweep 무작위 대형, 균형 전술)
import type { MatchJob, MatchOut } from '../engine/job';
import type { BoxTeam, B3 } from '../engine/boxProbe';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customProblem, customSlots, GRID_LANES, GRID_ROWS } from '../../src/formations';

function randomCells(i: number): number[] {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) {
    const pool = [...all];
    const cells = [-1];
    for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    if (!customProblem(cells)) return cells;
  }
}

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const pairs: [string, string][] = [];
let n = 60;
let ratings = [75, 75];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else { const i = a.indexOf(':'); pairs.push([a.slice(0, i), a.slice(i + 1)]); }
}
const SEED0 = Number(process.env.SEED0 ?? 31000);
const spec = (side: string, seed: number, r: number, sp: string) => sp.startsWith('cust:')
  ? { ...std(side, seed, r, '4-4-2', 'balanced'), cells: randomCells(Number(sp.slice(5))) }
  : std(side, seed, r, '4-4-2', tacticsOf(sp as Tendency));
const label = (sp: string) => sp.startsWith('cust:') ? `${sp}(${customSlots(randomCells(Number(sp.slice(5)))).slice(1).map((x) => x.pos).join('-')})` : sp;
const jobs: MatchJob[] = [];
for (const [x, y] of pairs) for (let k = 0; k < n; k++) {
  const seed = SEED0 + k;
  const a = spec('a', seed, ratings[0]!, x);
  const b = spec('b', seed, ratings[1]!, y);
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: a, away: b, overrides, box: true } : { kind: 'match', seed, neutral: true, home: b, away: a, overrides, box: true });
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `박스 수신 분해 ${jobs.length}경기` });
const sum = (xs: BoxTeam[]): BoxTeam => {
  const acc = JSON.parse(JSON.stringify(xs[0])) as BoxTeam;
  for (const x of xs.slice(1)) for (const k of Object.keys(acc) as (keyof BoxTeam)[]) {
    const v = acc[k] as unknown;
    if (Array.isArray(v)) {
      if (Array.isArray(v[0])) (x[k] as number[][]).forEach((row, i) => row.forEach((y, j) => { (v as number[][])[i]![j]! += y; }));
      else (x[k] as number[]).forEach((y, i) => { (v as number[])[i]! += y; });
    } else (acc[k] as number) += x[k] as number;
  }
  return acc;
};
const bucket3 = (k: number) => (k <= 3 ? 0 : k <= 5 ? 1 : 2);
const tot = (a: B3) => a[0] + a[1] + a[2];
const pc = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(1) : '–');
const pm = (x: number) => (x / n).toFixed(2);
const av = (x: number, d: number, f = 2) => (d ? (x / d).toFixed(f) : '–');
console.log(`\n박스 수신 분해, 레이팅 ${ratings.join(' 대 ')}, ${n}경기씩, 시드 ${SEED0}~, 덮어쓰기 ${JSON.stringify(overrides)}`);
const BN = ['0~3', '4~5', '6+', '전체'];
const col = (a: B3, f: (x: number, i: number) => string) => [...a.map(f), f(tot(a), 3)];
pairs.forEach(([x, y], pi) => {
  const xs = outs.slice(pi * n, (pi + 1) * n);
  let gf = 0, ga = 0;
  const A: BoxTeam[] = [], B: BoxTeam[] = [];
  xs.forEach((m, k) => {
    const ai = k % 2 ? 0 : 1;
    gf += ai === 0 ? m.homeGoals : m.awayGoals; ga += ai === 0 ? m.awayGoals : m.homeGoals;
    A.push(m.box!.team[ai]!); B.push(m.box!.team[1 - ai]!);
  });
  console.log(`\n=== ${label(x)} 대 ${label(y)}: 득실 ${pm(gf)}:${pm(ga)} (차 ${((gf - ga) / n).toFixed(2)})`);
  for (const [att, def, T] of [[x, y, sum(A)], [y, x, sum(B)]] as [string, string, BoxTeam][]) {
    const g = (a: B3, i: number) => (i === 3 ? tot(a) : a[i]!);
    console.log(`  [${att} 공격 → ${def} 박스]`);
    console.log('  | 박스 안 수비 | 표본 비율 · 박스 안 공격수 · 미마크(2.5 m) | 박스행 패스/경기 · 받기 계획 % · 성공 % · 땅볼 경합 패 % | 박스 수신/경기 · 수비 거리 m → 1초 · 3 m 안 · 2 m 안 % · 슛 선 위 수비 | 3초 안 그 선수 슛 % · 원터치 % · 잃음 % · 슛까지 s · 첫 결정 s · 슛 xG · 골/수신 % | 12 m 안 발 슛/경기 · 슛당 골 % · xG/슛 · 3 m 수비 · 앞 장면 박스수신/몰고/탈취·루즈/그밖 % |');
    for (let i = 0; i < 4; i++) {
      const smp = g(T.smp, i);
      console.log(`  | ${BN[i]} | ${pc(smp, tot(T.smp))} · ${av(g(T.smpAtt, i), smp)} · ${av(g(T.smpFree, i), smp)} | ${pm(g(T.pIn, i))} · ${pc(g(T.pRecvPlan, i), g(T.pIn, i))} · ${pc(g(T.pOk, i), g(T.pIn, i))} · ${pc(g(T.pContestLost, i), g(T.pGround, i))} | ${pm(g(T.r, i))} · ${av(g(T.rNear, i), g(T.r, i))} → ${av(g(T.rNear1, i), g(T.rHeld1, i))} · ${av(g(T.r3, i), g(T.r, i))} · ${pc(g(T.r2, i), g(T.r, i))} · ${av(g(T.rLane, i), g(T.r, i))} | ${pc(g(T.rShot, i), g(T.r, i))} · ${pc(g(T.rOneT, i), g(T.r, i))} · ${pc(g(T.rLost, i), g(T.r, i))} · ${av(g(T.rShotT, i), g(T.rShot, i))} · ${av(g(T.rDecT, i), g(T.rDec, i))} · ${av(g(T.rXg, i), g(T.rShot, i), 3)} · ${pc(g(T.rGoal, i), g(T.r, i))} | ${pm(g(T.s12, i))} · ${pc(g(T.s12Goal, i), g(T.s12, i))} · ${av(g(T.s12Xg, i), g(T.s12, i), 3)} · ${av(g(T.s12P3, i), g(T.s12, i))} · ${T.s12Via.map((v) => pc(g(v as B3, i), g(T.s12, i))).join('/')} |`);
    }
  }
});
// 수신 원자료로 거리·주변 밀집을 고정한 비교 (공격 팀 = 짝의 A·B 각각)
pairs.forEach(([x, y], pi) => {
  const xs = outs.slice(pi * n, (pi + 1) * n);
  for (const side of [0, 1] as const) {
    const att = side === 0 ? x : y;
    const rows: number[][] = [];
    let ticks = 0, near2 = 0, tk = 0, tkw = 0, fo = 0;
    xs.forEach((m, k) => {
      const ai = k % 2 ? 0 : 1;
      const tm = side === 0 ? ai : 1 - ai;
      for (const r of m.box!.rows) if (r[11] === tm) rows.push(r);
      ticks += m.box!.boxTicks[tm]!; near2 += m.box!.boxNear2[tm]!; tk += m.box!.boxTk[tm]!; tkw += m.box!.boxTkWon[tm]!; fo += m.box!.boxFoul[tm]!;
    });
    console.log(`\n  [${label(att)} 공격 박스 수신 원자료 ${rows.length}건] 박스 안 소유 ${(ticks / 10 / n).toFixed(1)} s/경기 · 그동안 2 m 안 수비 평균 ${(near2 / Math.max(1, ticks)).toFixed(2)} · 수비 태클 시도 ${(tk / n).toFixed(2)}/경기 (초당 ${(tk / Math.max(1, ticks / 10)).toFixed(3)}) · 이긴 태클·경합 ${(tkw / n).toFixed(2)} · 파울 ${(fo / n).toFixed(2)}`);
    console.log('  | 골 거리 | 4 m 안 수비 | 박스 수비 | 수신/경기 | 가장 가까운 m → 1초 | 슛 % | 잃음 % | xG/슛 | 골/수신 % |');
    const dB = [[0, 11], [11, 16], [16, 99]];
    for (const [d0, d1] of dB) for (const c of [0, 1, 2]) for (const bb of [0, 1, 2]) {
      const g = rows.filter((r) => r[3]! >= d0! && r[3]! < d1! && Math.min(2, r[10]!) === c && bucket3(r[0]!) === bb);
      if (g.length < 15) continue;
      const sh = g.filter((r) => r[4] === 1);
      const h1 = g.filter((r) => r[9]! >= 0);
      console.log(`  | ${d0}~${d1} | ${c === 2 ? '2+' : c} | ${BN[bb]} | ${(g.length / n).toFixed(2)} | ${(g.reduce((a, r) => a + r[1]!, 0) / g.length).toFixed(2)} → ${h1.length ? (h1.reduce((a, r) => a + r[9]!, 0) / h1.length).toFixed(2) : '–'} | ${pc(sh.length, g.length)} | ${pc(g.filter((r) => r[7] === 1).length, g.length)} | ${sh.length ? (sh.reduce((a, r) => a + r[5]!, 0) / sh.length).toFixed(3) : '–'} | ${pc(g.filter((r) => r[6] === 1).length, g.length)} |`);
    }
  }
});
console.log(`\n전체 ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
