// C.74a 같은 시드 지문: 맑음·보통 심판(입력 없음)에서 엔진 결과 해시. 수정 전후가 같아야 한다
import { newGame, otherJob, roundMatch, selectableRealPlayers } from '../src/game';
import { playMyMatch } from '../src/engine/adapter';
import { playNpcMatch } from '../src/engine/npcMatch';
import { createHash } from 'node:crypto';
import { setEnvironmentFixed } from '../src/weather';

setEnvironmentFixed(process.env.ENV_FREE !== '1');

const h = createHash('sha256');
for (let k = 0; k < 4; k++) {
  const real = selectableRealPlayers()[k * 3]!;
  const g = newGame({ seed: `fp-${k}`, mode: "real", playerId: real.id, difficulty: "normal" });
  const rm = roundMatch(g);
  const o = playMyMatch(rm.input);
  h.update(JSON.stringify([o.engine.homeGoals, o.engine.awayGoals, o.engine.teamStats, o.engine.events.length, o.my]));
  const job = otherJob(g, 0, 1);
  h.update(JSON.stringify(playNpcMatch(job.input)));
}
console.log('fingerprint', h.digest('hex').slice(0, 16));
