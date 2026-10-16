// 진단 (C.26 평점 재보정): 평점 표본 경기의 선수별 평점 성분을 JSON 으로 저장한다. 계수를 바꿔 다시 계산할 때 쓴다
// vite-node scripts/diag/rating-parts.ts -- <경기 수> <출력.json> [시작 시드]
import { writeFileSync } from 'node:fs';
import { FORMATIONS } from '../../src/formations';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 120);
const out = args[1] ?? 'rating-parts.json';
const base = Number(args[2] ?? 13000);
const STRENGTHS = [68, 75, 82];
const jobs: MatchJob[] = Array.from({ length: n }, (_, k) => {
  const i = base + k;
  return { kind: 'match', seed: i, neutral: true, parts: true,
    home: std('a', i, STRENGTHS[k % 3]!, FORMATIONS[k % 5]!), away: std('b', i, 75, FORMATIONS[(k + 2) % 5]!) };
});
const t0 = Date.now();
const res = await runJobs<MatchOut>(jobs, { label: 'rating-parts' });
const rows = res.flatMap((m, k) => m.players.map((p) => ({ m: k, str: k % 3, team: p.team, starter: p.starter, min: p.minutes, pos: p.position, rating: p.rating, ...p.parts! })));
writeFileSync(out, JSON.stringify(rows));
console.log(`${n}경기 ${rows.length}명 ${((Date.now() - t0) / 1000).toFixed(0)}초 → ${out}`);
process.exit(0);
