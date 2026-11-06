// C.78f 같은 시드 30경기 지문 + 경기당 시간: 결과가 같은 최적화만 넣는다(지문이 전후 같아야 함)
// npx vite-node scripts/c78f-speed.ts -- [fp|time] [n]
import { newGame, otherJob, roundMatch, selectableRealPlayers } from '../src/game';
import { playMyMatch } from '../src/engine/adapter';
import { playNpcMatch } from '../src/engine/npcMatch';
import { createHash } from 'node:crypto';
import { setEnvironmentFixed } from '../src/weather';

setEnvironmentFixed(true);
const args = process.argv.slice(2).filter((a) => a !== '--');
const mode = args[0] ?? 'fp';
const n = Number(args[1] ?? (mode === 'fp' ? 30 : 6));

const jobs: (() => unknown)[] = [];
for (let k = 0; jobs.length < n; k++) {
  const pool = selectableRealPlayers();
  const real = pool[(k * 3) % pool.length]!;
  const g = newGame({ seed: `c78f-${k}`, mode: 'real', playerId: real.id, difficulty: 'normal' });
  const rm = roundMatch(g);
  jobs.push(() => { const o = playMyMatch(rm.input); return [o.engine.homeGoals, o.engine.awayGoals, o.engine.teamStats, o.engine.events, o.my]; });
  if (jobs.length < n) { const job = otherJob(g, 0, 1); jobs.push(() => playNpcMatch(job.input)); }
}
if (mode === 'fp') {
  const h = createHash('sha256');
  for (const f of jobs) h.update(JSON.stringify(f()));
  console.log('fingerprint', n, h.digest('hex').slice(0, 16));
} else {
  jobs[0]!(); jobs[1]!(); // 데우기
  const t = performance.now();
  for (const f of jobs) f();
  console.log('msPerMatch', n, Math.round((performance.now() - t) / n));
}
