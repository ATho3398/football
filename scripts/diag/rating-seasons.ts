// 진단 (C.26 평점 재보정): 실제 선수 ST 시즌 (엔진 / 빠른 경기) 평균 평점과 골
// vite-node scripts/diag/rating-seasons.ts -- <시드 수> [선수,선수...]
import type { SeasonJob, SeasonOut } from '../engine/job';
import { runJobs } from '../engine/pool';

const args = process.argv.slice(2).filter((a) => a !== '--');
const nSeed = Number(args[0] ?? 3);
const ids = (args[1] ?? 'kane,aguero,aubameyang,vardy').split(',');
const jobs: SeasonJob[] = [];
for (const engine of ['agent', 'quick'] as const) for (const id of ids) for (let k = 0; k < nSeed; k++) jobs.push({ kind: 'season', playerId: id, seed: `rs-${k}`, engine });
const res = await runJobs<SeasonOut>(jobs, { label: 'seasons' });
const t = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
res.forEach((r, i) => {
  const j = jobs[i]!;
  console.log(`${j.engine.padEnd(5)} ${j.playerId.padEnd(11)} ${j.seed} 출전 ${r.apps} ${r.goals}골 ${r.assists}도움 평균 ${r.rating.toFixed(2)} (45분+ ${t(r.ratings).toFixed(2)}) XP ${r.xp}`);
});
process.exit(0);
