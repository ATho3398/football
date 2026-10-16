// 진단 (C.26 평점 재보정): 약팀 배정 가상 유망주의 첫 시즌들을 엔진 / 빠른 경기로 같은 시드에서 돌려 평점·경기 XP 비교
// vite-node scripts/diag/rating-prospect-engine.ts -- <시작 시드> <시드 수> <시즌 수>
import { autoAllocate } from '../../src/growth';
import { newGame, playRound, startNextSeason } from '../../src/game';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import type { Tier } from '../../src/types';

const args = process.argv.slice(2).filter((a) => a !== '--');
const from = Number(args[0] ?? 0);
const n = Number(args[1] ?? 2);
const nSeasons = Number(args[2] ?? 2);
for (let i = from; i < from + n; i++) {
  for (const tier of ['normal', 'legendary'] as Tier[]) {
    for (const engine of ['agent', 'quick'] as const) {
      const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
      const g = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
      g.player.potentialTier = tier;
      for (let k = 0; k < nSeasons; k++) {
        while (g.phase === 'season') {
          playRound(g, { engine });
          autoAllocate(g.player);
        }
        const h = g.player.history.at(-1)!;
        console.log(JSON.stringify({ i, tier, engine, position, age: h.age, apps: h.apps, r: h.apps ? h.ratingSum / h.apps : null, xp: h.matchXp, moms: h.moms, goals: h.goals }));
        if (g.phase !== 'offseason') break;
        startNextSeason(g);
      }
    }
  }
}
process.exit(0);
