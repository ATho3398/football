// 위상 하락 규칙 측정 (부록 C.25, C.27: 출전 시간·레드카드 기록 추가): 약팀 배정 가상 유망주 커리어를 돌려 경기 평점·시즌 순위 기록을 모은다.
// 성장은 위상과 무관하므로(부록 C.23) 기록 한 번으로 여러 감점 규칙의 위상 경로를 다시 계산할 수 있다.
// 실행: npx vite-node scripts/balance-reputation.ts -- <out.json>
//   환경 변수 SEEDS(기본 48), ENGINE(quick | agent, 기본 quick), TIERS(쉼표, 기본 전 티어), STRATS(best,random), AGE_FROM/AGE_TO(엔진 표본 나이 구간)

import { FIELD_ATTRIBUTES } from '../src/attributes';
import { autoAllocate, raiseAttribute, raiseBlock, TIERS_ASC } from '../src/growth';
import { newGame, personalReputation, playRound, ratingRank, startNextSeason, type GameState } from '../src/game';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { createRng } from '../src/rng';
import type { Tier } from '../src/types';
import { writeFileSync } from 'node:fs';
import { setEnvironmentFixed } from '../src/weather';

// 측정은 맑음·보통 심판 고정 (부록 C.74a): 기존 기준 그대로 비교
setEnvironmentFixed(true);

const env = process.env;
const SEEDS = Number(env.SEEDS ?? 48);
const SEED_FROM = Number(env.SEED_FROM ?? 0);
const ENGINE = (env.ENGINE ?? 'quick') as 'quick' | 'agent';
const TIERS = (env.TIERS?.split(',') ?? TIERS_ASC) as Tier[];
const STRATS = (env.STRATS?.split(',') ?? ['best', 'random']) as ('best' | 'random')[];
const END_AGE = Number(env.END_AGE ?? 37);
const out = process.argv.at(-1)!;

function spend(state: GameState, strategy: 'best' | 'random', rng: () => number): void {
  if (strategy === 'best') return void autoAllocate(state.player);
  for (let k = 0; k < 300 && state.player.unspentPoints > 0; k++) {
    const a = FIELD_ATTRIBUTES[Math.floor(rng() * FIELD_ATTRIBUTES.length)]!;
    if (!raiseBlock(state.player, a)) raiseAttribute(state.player, a);
  }
}

const runs: unknown[] = [];
const t0 = Date.now();
for (const strategy of STRATS) {
  for (const tier of TIERS) {
    for (let i = SEED_FROM; i < SEED_FROM + SEEDS; i++) {
      const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
      const state = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
      state.player.potentialTier = tier;
      const rng = createRng(i);
      const seasons: unknown[] = [];
      while (state.player.age < END_AGE) {
        const ratings: number[] = [];
        const age = state.player.age;
        while (state.phase === 'season') {
          const r = playRound(state, { engine: ENGINE });
          if (r.result.minutes > 0) ratings.push(Math.round((r.result.rating ?? 0) * 100) / 100);
          spend(state, strategy, rng);
        }
        spend(state, strategy, rng);
        const sum = state.lastSeasonSummary!;
        const rec = state.player.history.at(-1)!;
        seasons.push({
          age, ratings, baseXp: sum.achievements.reduce((t, a) => t + a.xp, 0), personal: personalReputation(rec),
          pos: sum.leaguePosition, expected: ratingRank(state.league, state.player.teamId), badges: sum.badges?.length ?? 0,
          rep: state.player.reputation, minutes: rec.minutes, totalMinutes: state.league.schedule.length * 90, reds: rec.reds,
        });
        if (state.phase !== 'offseason') break;
        startNextSeason(state);
      }
      runs.push({ strategy, tier, i, seasons });
    }
    console.log(`${strategy} ${tier} 끝 (${((Date.now() - t0) / 1000).toFixed(0)}초)`);
  }
}
writeFileSync(out, JSON.stringify({ engine: ENGINE, seeds: SEEDS, runs }));
console.log(`저장 ${out}`);
