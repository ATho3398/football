// 진단 (C.78a, 공통 규칙 로드맵 5단계 0번 분해): 공을 잃은 순간 양 팀 배치와 그 뒤 8초 결과를 전술별·몰빵 대형별로, 2선 추적 배정 시점(닿을 수 있었나)을 잰다.
// 실행: npx vite-node scripts/diag/transition.ts -- [경기수=40] 대상... [vs=balanced] [form=4-4-2] [경로=값 ...]
//   대상: 성향 이름(gegenpress, balanced, counter, bus, block, tikitaka, direct) + 선택 @라인,압박,빌드업,폭 · 또는 cust:번호(C.33 custom-sweep 의 무작위 커스텀 대형, 균형 전술)
//   상대는 vs 성향 4-4-2. 홈/원정 반씩, 같은 시드. 표의 "잃은 팀" = 대상 팀이 잃었을 때 / "상대가 잃음" = 상대 팀이 잃었을 때(대상의 전환 공격)
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import type { TransAssign, TransTeam } from '../engine/transProbe';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customProblem, customSlots, GRID_LANES, GRID_ROWS, type Formation } from '../../src/formations';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let vs = 'balanced';
let form: Formation = '4-4-2';
const specs: string[] = [];
let n = 40;
for (const a of all) {
  if (a.startsWith('vs=')) vs = a.slice(3);
  else if (a.startsWith('form=')) form = a.slice(5) as Formation;
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
if (!specs.length) specs.push('gegenpress', 'balanced', 'counter', 'bus', 'block');
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
// custom-sweep.ts 와 같은 무작위 대형
function randomCells(i: number): number[] {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const cells0 = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) {
    const pool = [...cells0];
    const cells = [-1];
    for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    if (!customProblem(cells)) return cells;
  }
}
const label = (sp: string) => sp.startsWith('cust:') ? `${sp} ${customSlots(randomCells(Number(sp.slice(5)))).slice(1).map((x) => x.pos).join('-')}` : sp;

const jobs: MatchJob[] = [];
for (const sp of specs) for (let k = 0; k < n; k++) {
  const seed = 41000 + k;
  const me = sp.startsWith('cust:') ? { ...std('a', seed, 75, '4-4-2', 'balanced'), cells: randomCells(Number(sp.slice(5))) } : std('a', seed, 75, form, tac(sp));
  const op = std('b', seed, 75, '4-4-2', tac(vs));
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides, trans: true } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides, trans: true });
}
const outs = await runJobs<MatchOut>(jobs, { label: `전환 ${jobs.length}경기` });

const addT = (a: TransTeam, b: TransTeam) => {
  for (const k of Object.keys(a) as (keyof TransTeam)[]) {
    const x = a[k];
    const y = b[k];
    if (Array.isArray(x)) (y as number[]).forEach((v, i) => { x[i]! += v; });
    else (a as unknown as Record<string, number>)[k] = (x as number) + (y as number);
  }
};
const addA = (a: TransAssign, b: TransAssign) => { for (const k of Object.keys(a) as (keyof TransAssign)[]) a[k] += b[k]; };
const zT = (): TransTeam => ({ n: 0, pressers: 0, byP: [0, 0, 0, 0], ahead: 0, behind: 0, line: [0, 0, 0], space: [0, 0, 0], spaceByP: [0, 0, 0, 0], beaten: 0, beatT: 0, recov: 0, thr4: 0, shot8: 0, xg8: 0, goal8: 0, shotByP: [0, 0, 0, 0], thrRecv: 0, off8: 0, thrRecvD: 0, thrShot: 0, thrRecvNear: 0 });
const zA = (): TransAssign => ({ n: 0, runnerRunning: 0, standOnRunning: 0, delay: 0, d0: 0, unreachable: 0, d2: 0, n2: 0 });

console.log(`\n전환 분해 · ${n}경기씩 · 상대 ${vs} 4-4-2 · 대상 대형 ${form} · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 대상 | 누가 잃음 | 상실/경기 | 가담 평균 · 0/1/2/3명 % | 공 앞 · 뒤 | 수비 줄 0/2/4 s | 뒤 공간 0/2/4 s | 뒤 공간 2 s 가담 0/1/2/3 | 뚫림 % · 시각 · 복귀 s | 4 s 침투 % · 받음 % · 8 s 오프사이드 % · 받은 곳 골 m · 그때 수비 m · 받고 슛 % | 8 s 슈팅 % · 가담 0/1/2/3 | 8 s xG/100 · 골/100 | 득실/경기 |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const assignRows: string[] = [];
specs.forEach((sp, i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const me = zT(), op = zT(), am = zA(), ao = zA();
  let gd = 0;
  xs.forEach((m, k) => {
    const mi = k % 2 ? 0 : 1;
    addT(me, m.trans!.team[mi]!); addT(op, m.trans!.team[1 - mi]!);
    addA(am, m.trans!.assign[mi]!); addA(ao, m.trans!.assign[1 - mi]!);
    gd += mi === 0 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals;
  });
  const f = (v: number, d = 1) => v.toFixed(d);
  const pct = (a: number, b: number) => (b ? (100 * a) / b : 0).toFixed(1);
  const row = (who: string, T: TransTeam) => `| ${label(sp)} | ${who} | ${f(T.n / n)} | ${f(T.pressers / T.n, 2)} · ${T.byP.map((v) => pct(v, T.n)).join('/')} | ${f(T.ahead / T.n)} · ${f(T.behind / T.n)} | ${T.line.map((v) => f(v / T.n)).join(' / ')} | ${T.space.map((v) => f(v / T.n)).join(' / ')} | ${T.spaceByP.map((v, j) => T.byP[j] ? f(v / T.byP[j]!) : '–').join('/')} | ${pct(T.beaten, T.n - T.byP[0]!)} · ${f(T.beatT / Math.max(1, T.beaten))} · ${f(T.recov / Math.max(1, T.beaten))} | ${pct(T.thr4, T.n)} · ${pct(T.thrRecv, T.thr4)} · ${pct(T.off8, T.n)} · ${f(T.thrRecvD / Math.max(1, T.thrRecv))} · ${f(T.thrRecvNear / Math.max(1, T.thrRecv))} · ${pct(T.thrShot, T.thrRecv)} | ${pct(T.shot8, T.n)} · ${T.shotByP.map((v, j) => pct(v, T.byP[j]!)).join('/')} | ${f((100 * T.xg8) / T.n, 2)} · ${f((100 * T.goal8) / T.n, 2)} | ${who === '대상' ? f(gd / n, 2) : ''} |`;
  console.log(row('대상', me));
  console.log(row('상대', op));
  const ar = (who: string, A: TransAssign) => `| ${label(sp)} | ${who} | ${f(A.n / n)} | ${pct(A.runnerRunning, A.n)} | ${pct(A.standOnRunning, A.runnerRunning)} | ${f(A.delay / Math.max(1, A.runnerRunning), 2)} | ${f(A.d0 / Math.max(1, A.n))} | ${pct(A.unreachable, A.n)} | ${f(A.d2 / Math.max(1, A.n2))} |`;
  assignRows.push(ar('대상 수비', am), ar('상대 수비', ao));
});
console.log('\n⒝ 2선 추적 배정 시점 (trackIdx 새 배정)');
console.log('| 대상 | 배정한 팀 | 배정/경기 | 침투자 이미 달림 % | 그중 추적자 서 있음 % | 달리기 시작 → 배정 s | 배정 순간 거리 m | 닿을 수 없음 % (도착 > 침투자 + 0.5 s) | 2 s 뒤 거리 m |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of assignRows) console.log(r);
process.exit(0);
