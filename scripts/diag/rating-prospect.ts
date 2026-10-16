// 진단 (C.26 평점 재보정): 약팀 배정 가상 유망주 커리어(빠른 경기, 최적 배분)의 평점·경기 XP·MOM·업적 XP 요약
// R='{...}' X='{...}' A='{...}' vite-node scripts/diag/rating-prospect.ts -- [시드 수]
import { BALANCE } from '../../src/config/balance';
import { autoAllocate } from '../../src/growth';
import { newGame, playRound, startNextSeason } from '../../src/game';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import type { Tier } from '../../src/types';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seeds = Number(args[0] ?? 24);
for (const [k, o] of [['R', BALANCE.rating], ['X', BALANCE.matchXp], ['F', BALANCE.form]] as const) Object.assign(o, JSON.parse(process.env[k] ?? '{}'));
const A = JSON.parse(process.env.A ?? '{}') as { high?: number; steady?: number };
const ach = BALANCE.achievements as unknown as Record<string, { minAvg: number }>;
if (A.high) ach.highAvgRating!.minAvg = A.high;
if (A.steady) ach.steadyRating!.minAvg = A.steady;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
for (const tier of ['normal', 'legendary'] as Tier[]) {
  const rows: { age: number; r: number; xpApp: number; moms: number; ach: number; apps: number; slump: number }[] = [];
  const ovr30: number[] = [];
  for (let i = 0; i < seeds; i++) {
    const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
    const g = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
    g.player.potentialTier = tier;
    while (g.player.age < 34) {
      while (g.phase === 'season') {
        playRound(g, { engine: 'quick' });
        autoAllocate(g.player);
      }
      autoAllocate(g.player);
      const h = g.player.history.at(-1)!;
      if (h.apps) rows.push({ age: h.age, r: h.ratingSum / h.apps, xpApp: h.matchXp / h.apps, moms: h.moms, ach: h.achievementXp, apps: h.apps, slump: h.slumpPenalty ?? 0 });
      if (g.phase !== 'offseason') break;
      startNextSeason(g);
    }
  }
  void ovr30;
  for (const [lo, hi] of [[17, 20], [21, 24], [25, 29], [30, 33]] as const) {
    const xs = rows.filter((x) => x.age >= lo && x.age <= hi);
    console.log(`${tier.padEnd(9)} ${lo}~${hi}세 평점 ${avg(xs.map((x) => x.r)).toFixed(2)} 경기XP/출전 ${avg(xs.map((x) => x.xpApp)).toFixed(1)} MOM/시즌 ${avg(xs.map((x) => x.moms)).toFixed(2)} 업적XP/시즌 ${avg(xs.map((x) => x.ach)).toFixed(0)} 출전 ${avg(xs.map((x) => x.apps)).toFixed(1)} 부진 감점/시즌 ${avg(xs.map((x) => x.slump)).toFixed(1)}`);
  }
}
process.exit(0);
