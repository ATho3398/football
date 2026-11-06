// C.78o: tests/moments.test.ts 의 CB 'same' 경기(C.45 기록 장면) 재현
import { MyMatchRun } from '../../src/engine/adapter';
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { posGroup } from '../../src/roster';
for (const g of ['CB', 'FB', 'DM', 'CM']) {
  const p = selectableRealPlayers().find((x) => posGroup(x.position) === g);
  if (!p) { console.log(g, '없음'); continue; }
  for (const seed of ['same', 'mom', 'x1', 'x2']) {
    const gs = newGame({ mode: 'real', playerId: p.id, seed: `${seed}-${p.id}`, difficulty: 'normal' });
    const rm = roundMatch(gs);
    const A = new MyMatchRun(rm.input); A.sim.runToEnd();
    const D = new MyMatchRun({ ...rm.input, control: { mode: 'direct', stop: 'important' } });
    const scenes: string[] = [];
    while (D.advance()) { scenes.push(`${D.pending!.scene}@${D.sim.state.tick}`); if (D.pending?.type === 'halftime') D.halftime(null); else D.resolve('delegate'); }
    const ra = A.finish().engine, rd = D.finish().engine;
    let k = 0; while (k < ra.events.length && JSON.stringify(ra.events[k]) === JSON.stringify(rd.events[k])) k++;
    console.log(g, seed, `자동 ${ra.homeGoals}-${ra.awayGoals} 직접 ${rd.homeGoals}-${rd.awayGoals}`, k === ra.events.length && k === rd.events.length ? '같음' : `이벤트 ${k} 에서 갈림 ${JSON.stringify(ra.events[k])} / ${JSON.stringify(rd.events[k])}`, scenes.slice(0, 20).join(' '));
  }
}
