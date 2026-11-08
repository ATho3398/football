// 진단 (C.77y): 2:1 달리기 중인 패서를 두고 받은 선수가 결정할 때 리턴(침투) 패스 후보가 어디서 빠지는가 — 후보 없음 / 안 보임 / 풀 탈락(효용 차) / 풀 안 미선택 / 고름. 엔진 코드는 바꾸지 않는다.
// npx vite-node scripts/diag/c77y-return.ts -- [경기수=10] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { TeamSetup } from '../../src/engine/types';
import { probe } from '../../src/engine/probe';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';
const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const N = Number(allArgs.filter((x) => !x.includes('='))[0] ?? 10);
const mk = (side: string, i: number): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`); s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation]; for (const p of s.lineup) delete p.role; fillRoles(s, (slot) => slots[slot]!.pos); return s;
};
const B: Record<string, number> = {};
const V = { ret: [] as number[], best: [] as number[], retU: [] as number[], bestU: [] as number[], dt: [] as number[] };
const R = { n: 0, none: 0, hidden: 0, out: [] as number[], notPicked: 0, picked: 0, p: [] as number[], chosen: {} as Record<string, number> };
probe.decide = (s, { a, cands, vis, pool, chosen, maxU }) => {
  const lp = s.lastPass;
  if (!lp || lp.receiver !== a.idx) return;
  const r = s.agents[lp.passer]!;
  if (!r.giveGo || s.t >= r.runUntil) return;
  R.n++;
  R.chosen[chosen.type] = (R.chosen[chosen.type] ?? 0) + 1;
  const c = cands.find((x) => x.receiver === r.idx);
  if (!c || c.type !== 'through') { R.none++; return; }
  R.p.push(c.p);
  if (chosen === c) R.picked++;
  else if (!vis.includes(c)) R.hidden++;
  else if (!pool.includes(c)) {
    R.out.push(maxU - c.u);
    const best = vis.reduce((x, y) => (y.u > x.u ? y : x));
    B[best.type] = (B[best.type] ?? 0) + 1;
    V.ret.push(c.value); V.best.push(best.value); V.retU.push(c.u); V.bestU.push(best.u);
  }
  else R.notPicked++;
  V.dt.push(s.t - lp.t);
};
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('H', i), away: mk('A', i), mode: 'auto', difficulty: 'normal', seed: 9300 + i, bigMatch: false, neutral: true });
  while (!m.state.done) m.step();
}
const pc = (x: number) => `${((x / Math.max(1, R.n)) * 100).toFixed(1)}%`;
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const med = (x: number[]) => [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)] ?? NaN;
console.log(`2:1 받은 선수 결정 ${R.n} (${(R.n / N).toFixed(1)}/경기): 고름 ${pc(R.picked)} · 후보 없음 ${pc(R.none)} · 안 보임 ${pc(R.hidden)} · 풀 탈락 ${pc(R.out.length)} (효용 차 중앙값 ${med(R.out).toFixed(3)}) · 풀 안 미선택 ${pc(R.notPicked)} · 리턴 성공 확률 평균 ${avg(R.p).toFixed(2)}`);
console.log(`고른 행동: ${JSON.stringify(R.chosen)}`);
console.log(`풀 탈락 때 1위 행동: ${JSON.stringify(B)} · 리턴 가치 ${avg(V.ret).toFixed(3)} 효용 ${avg(V.retU).toFixed(3)} / 1위 가치 ${avg(V.best).toFixed(3)} 효용 ${avg(V.bestU).toFixed(3)} · 받은 뒤 결정까지 ${avg(V.dt).toFixed(2)}초`);
