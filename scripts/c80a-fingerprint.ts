// C.80a 지문: c74a 지문에서 NPC 선수 줄 카드 칸(C.80a 새 출력)만 뺀다 — main 과 같아야 엔진 판단·실행 불변
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
  const nr = playNpcMatch(job.input); h.update(JSON.stringify({ ...nr, players: nr.players.map((l) => l.slice(0, 6)) }));
}
console.log('fingerprint', h.digest('hex').slice(0, 16));
