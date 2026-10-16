// 진단 (C.26 평점 재보정): 빠른 경기 평점 분포 (동레이팅 75, 풀타임 선발로 고정, 홈/원정 반반)
// vite-node scripts/diag/rating-quick.ts -- [경기 수] [내 OVR]
import { simulateMatch } from '../../src/match';
import type { FieldPosition } from '../../src/positions';
import { createRng, hashSeed } from '../../src/rng';

const args = process.argv.slice(2).filter((a) => a !== '--');
const n = Number(args[0] ?? 20000);
const ovr = Number(args[1] ?? 75);
const POS: FieldPosition[] = ['CB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'ST'];
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const sd = (xs: number[]) => Math.sqrt(avg(xs.map((x) => (x - avg(xs)) ** 2)));
const rng = createRng(hashSeed(`rq-${ovr}`));
const all: number[] = [];
for (const position of POS) {
  const rs: { r: number; g: number; mom: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const r = simulateMatch({ ovr, position, fatigue: 0, teamRating: 75, oppRating: 75, home: i % 2 === 0, difficulty: 'normal' }, rng);
    if (r.rating === null || r.minutes < 90) continue;
    rs.push({ r: r.rating, g: r.goals, mom: r.mom });
  }
  const xs = rs.map((x) => x.r);
  all.push(...xs);
  const by = (f: (g: number) => boolean) => avg(rs.filter((x) => f(x.g)).map((x) => x.r)).toFixed(2);
  console.log(`${position.padEnd(4)} 평균 ${avg(xs).toFixed(2)} σ ${sd(xs).toFixed(2)} 0골 ${by((g) => g === 0)} 1골 ${by((g) => g === 1)} 2골+ ${by((g) => g >= 2)} MOM ${(avg(rs.map((x) => (x.mom ? 1 : 0))) * 100).toFixed(1)}%`);
}
console.log(`전체 평균 ${avg(all).toFixed(2)} σ ${sd(all).toFixed(2)}`);
process.exit(0);
