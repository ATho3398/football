// 밸런스 점검 (B.10): 잠재력 티어별 가상 유망주를 시드 고정으로 17~30세까지 자동 시뮬
// 실행: npm run balance
// 기대 범위(참고): 일반 → 30세 OVR 65~72, 레전더리 → 85 이상

import { autoAllocate, playerOvr, TIERS_ASC, TIER_NAMES_KO } from '../src/growth';
import { newGame, playRound, startNextSeason, type GameState } from '../src/game';
import { PLAYABLE_POSITIONS } from '../src/positions';
import type { Tier } from '../src/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS_PER_TIER = Number(env.SEEDS ?? 24);
const END_AGE = 30;

function simulateCareer(tier: Tier, seed: string, position: (typeof PLAYABLE_POSITIONS)[number]) {
  const state: GameState = newGame({ mode: 'prospect', position, seed, difficulty: 'normal' });
  state.player.potentialTier = tier;
  const ovrByAge: Record<number, number> = { [state.player.age]: playerOvr(state.player) };
  let apps = 0;
  let starts = 0;
  let seasons = 0;
  while (state.player.age < END_AGE) {
    while (state.phase === 'season') {
      playRound(state);
      autoAllocate(state.player);
    }
    autoAllocate(state.player);
    const h = state.player.history.at(-1)!;
    apps += h.apps;
    starts += h.starts;
    seasons++;
    ovrByAge[state.player.age] = playerOvr(state.player);
    if (state.phase !== 'offseason') break;
    startNextSeason(state);
  }
  return { ovrByAge, apps: apps / seasons, starts: starts / seasons, level: state.player.level };
}

const ages = Array.from({ length: END_AGE - 17 + 1 }, (_, i) => 17 + i);
console.log(`잠재력 티어별 평균 OVR (시드 ${SEEDS_PER_TIER}개, 포지션 순환, 난이도 보통)\n`);
console.log(['티어'.padEnd(6), ...ages.map((a) => String(a).padStart(4)), '  경기/시즌', '선발/시즌', ' 30세 범위'].join(''));
for (const tier of TIERS_ASC) {
  const runs = Array.from({ length: SEEDS_PER_TIER }, (_, i) =>
    simulateCareer(tier, `balance-${tier}-${i}`, PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!),
  );
  const avgAt = (age: number) => runs.reduce((t, r) => t + (r.ovrByAge[age] ?? 0), 0) / runs.length;
  const final = runs.map((r) => r.ovrByAge[END_AGE] ?? 0);
  const apps = runs.reduce((t, r) => t + r.apps, 0) / runs.length;
  const starts = runs.reduce((t, r) => t + r.starts, 0) / runs.length;
  console.log(
    [
      TIER_NAMES_KO[tier].padEnd(6),
      ...ages.map((a) => avgAt(a).toFixed(0).padStart(4)),
      apps.toFixed(1).padStart(10),
      starts.toFixed(1).padStart(10),
      `   ${Math.min(...final)}~${Math.max(...final)}`,
    ].join(''),
  );
}
