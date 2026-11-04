// C.81c 내 경기 계산 시간: 캡처(재생 데이터) 있음/없음, 재생 데이터 크기 (결과 불변 확인용)
import { newGame, roundMatch, selectableRealPlayers } from '../../src/game';
import { playMyMatch } from '../../src/engine/adapter';
import { setEnvironmentFixed } from '../../src/weather';
setEnvironmentFixed(true);
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 6);
const real = selectableRealPlayers()[3]!;
const g = newGame({ seed: 'c81c-t', mode: 'real', playerId: real.id, difficulty: 'normal' });
const rm = roundMatch(g);
for (let k = 0; k < N; k++) {
  const t0 = performance.now();
  const a = playMyMatch(rm.input);
  const t1 = performance.now();
  const b = playMyMatch(rm.input, { teams: rm.teams });
  const t2 = performance.now();
  const same = JSON.stringify(a.engine.events) === JSON.stringify(b.engine.events);
  const t3 = performance.now();
  const sz = JSON.stringify(b.replay).length;
  const t4 = performance.now();
  const c = structuredClone(b);
  const t5 = performance.now();
  console.log(`#${k} plain ${(t1 - t0).toFixed(0)}ms capture ${(t2 - t1).toFixed(0)}ms same=${same} replayJSON ${(sz / 1e6).toFixed(2)}MB stringify ${(t4 - t3).toFixed(0)}ms clone ${(t5 - t4).toFixed(0)}ms frames=${b.replay?.frames?.length ?? '?'} ${c ? '' : ''}`);
}
