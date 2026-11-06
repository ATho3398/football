// @ts-nocheck C.81i: c78o CB important 라운드 탐색
import { newGame, playRound, roundMatch, selectableRealPlayers } from '../../src/game';
import { MyMatchRun } from '../../src/engine/adapter';
import { posGroup } from '../../src/roster';
function rm(group, seed, rounds) {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === group);
  const g = newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' });
  for (let r = 0; r < rounds; r++) playRound(g);
  for (let k = 0; k < 6; k++) { const m = roundMatch(g); if (m.plan.started) return m; playRound(g); }
  throw new Error('선발 경기 없음');
}
for (const [group, stop, rs] of [['CB', 'important', [0, 1, 2, 3, 4, 5, 6]], ['CB', 'all', [1]]]) for (const rounds of rs) {
  const m = rm(group, 'same', rounds);
  const auto = new MyMatchRun(m.input); auto.sim.runToEnd(); const a = auto.finish().engine;
  const run = new MyMatchRun({ ...m.input, control: { mode: 'direct', stop } });
  let stops = 0, duels = 0;
  while (run.advance()) { stops++; if (run.pending.type === 'duel') duels++; if (run.pending.type === 'halftime') run.halftime(null); else run.resolve('delegate'); }
  const d = run.finish().engine;
  const same = d.homeGoals === a.homeGoals && d.awayGoals === a.awayGoals && JSON.stringify(d.events) === JSON.stringify(a.events) && JSON.stringify(d.players) === JSON.stringify(a.players);
  console.log(`${group} ${stop} +${rounds}: 정지 ${stops} 1대1 ${duels} 같음 ${same}`);
}
process.exit(0);
