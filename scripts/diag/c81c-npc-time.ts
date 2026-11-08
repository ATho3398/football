// C.81c 다른 팀 경기 계산 시간 · 결과 지문 (엔진 최적화 전후 같은 값이어야 한다)
import { createHash } from 'node:crypto';
import { newGame, otherJob, selectableRealPlayers } from '../../src/game';
import { playNpcMatch } from '../../src/engine/npcMatch';
import { otherLeagueJobs } from '../../src/otherLeagues';
import { setEnvironmentFixed } from '../../src/weather';
setEnvironmentFixed(process.env.ENV_FREE !== '1');
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 12);
const g = newGame({ seed: 'c81c-npc', mode: 'real', playerId: selectableRealPlayers()[2]!.id, difficulty: 'normal' });
const jobs = Array.from({ length: N }, (_, k) => otherJob(g, Math.floor(k / 9), 1 + (k % 9)).input);
void otherLeagueJobs;
const h = createHash('sha256');
playNpcMatch(jobs[0]!);
const t0 = performance.now();
for (const j of jobs) h.update(JSON.stringify(playNpcMatch(j)));
console.log(`npc ${N}경기 평균 ${((performance.now() - t0) / N).toFixed(0)}ms 지문 ${h.digest('hex').slice(0, 16)}`);
