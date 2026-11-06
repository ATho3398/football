// C.78o: 같은 시드에서 자동 경기 vs 직접 모드(전부 맡기기, 화면 경로 = 정책 없음) 첫 갈림 틱 찾기
// 실행: npx vite-node scripts/diag/c78o-direct.ts -- [경기 수(기본 12)]
import { MyMatchRun } from '../../src/engine/adapter';
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
import type { SimState } from '../../src/engine/state';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const groups = ['ST', 'WING', 'CM', 'CB', 'FB', 'CAM', 'DM'];
const key = (s: SimState) => JSON.stringify([s.tick, s.ball.x, s.ball.y, s.ball.owner, s.agents.map((a) => [a.x, a.y, a.cooldown, a.duelNext]), s.teams.map((t) => t.stats.goals)]);
let same = 0;
for (let i = 0; i < N; i++) {
  const g = groups[i % groups.length]!;
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === g);
  if (!p) continue;
  const gs = newGame({ mode: 'real', playerId: p.id, seed: `${process.env.SEED ?? 'c78o'}-${i}`, difficulty: 'normal' });
  let rm = roundMatch(gs, { cards: i % 2 === 0 });
  for (let k = 0; k < 6 && !rm.plan.started; k++) { playRound(gs); rm = roundMatch(gs, { cards: i % 2 === 0 }); }
  const A = new MyMatchRun(rm.input);
  const D = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: (process.env.STOP ?? 'all') as 'all' } });
  const sa = A.sim.state, sd = D.sim.state;
  let lastMoment = '-';
  let found = '';
  let stops = 0;
  while (!sa.done && !sd.done) {
    A.sim.step();
    D.sim.step();
    while (sd.moments.pending) {
      const m = sd.moments.pending;
      lastMoment = `${m.type}/${m.scene}@${sd.tick}`;
      stops++;
      if (m.type === 'halftime') D.sim.resolve('delegate'); else D.sim.resolve('delegate');
    }
    if (key(sa) !== key(sd)) {
      found = `첫 갈림 틱 ${sa.tick}/${sd.tick} (직전 순간 ${lastMoment})`;
      break;
    }
  }
  if (!found) {
    while (!sa.done) A.sim.step();
    while (!sd.done) { if (sd.moments.pending) D.sim.resolve('delegate'); else D.sim.step(); }
  }
  const ra = A.finish().engine, rd = D.finish().engine;
  const eq = JSON.stringify(ra.events) === JSON.stringify(rd.events);
  if (eq && !found) same++;
  console.log(`경기 ${i} ${g} 카드${i % 2 === 0 ? 'O' : 'X'}: 정지 ${stops} · 자동 ${ra.homeGoals}-${ra.awayGoals} 직접 ${rd.homeGoals}-${rd.awayGoals} 이벤트 ${eq ? '같음' : '다름'} ${found}`);
}
console.log(`같음 ${same}/${N}`);
