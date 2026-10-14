// 밸런스 점검 (B.10): 잠재력 티어별 가상 유망주를 시드 고정으로 17~33세까지 자동 시뮬
// 실행: npm run balance
// 기대 범위(참고): 일반 → 30세 OVR 65~72, 레전더리 → 85 이상
// 포인트 배분은 두 가지로 본다: 최적(포지션 OVR 효율 순 자동 배분) / 무작위(25개 능력치 중 아무 데나)

import { FIELD_ATTRIBUTES } from '../src/attributes';
import { autoAllocate, playerOvr, raiseAttribute, raiseBlock, TIERS_ASC, TIER_NAMES_KO } from '../src/growth';
import { newGame, playRound, startNextSeason, type GameState } from '../src/game';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { createRng } from '../src/rng';
import type { Tier } from '../src/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS_PER_TIER = Number(env.SEEDS ?? 24);
const END_AGE = 37;
type Strategy = 'best' | 'random';

function spend(state: GameState, strategy: Strategy, rng: () => number): void {
  if (strategy === 'best') {
    autoAllocate(state.player);
    return;
  }
  for (let k = 0; k < 300 && state.player.unspentPoints > 0; k++) {
    const a = FIELD_ATTRIBUTES[Math.floor(rng() * FIELD_ATTRIBUTES.length)]!;
    if (!raiseBlock(state.player, a)) raiseAttribute(state.player, a);
  }
}

function simulateCareer(tier: Tier, i: number, strategy: Strategy) {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const state = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
  state.player.potentialTier = tier;
  const rng = createRng(i);
  const ovrByAge: Record<number, number> = { [state.player.age]: playerOvr(state.player) };
  let starts = 0;
  let seasons = 0;
  while (state.player.age < END_AGE) {
    while (state.phase === 'season') {
      playRound(state);
      spend(state, strategy, rng);
    }
    spend(state, strategy, rng);
    starts += state.player.history.at(-1)!.starts;
    seasons++;
    ovrByAge[state.player.age] = playerOvr(state.player);
    if (state.phase !== 'offseason') break;
    startNextSeason(state);
  }
  return { ovrByAge, starts: starts / seasons };
}

const ages = Array.from({ length: END_AGE - 17 + 1 }, (_, i) => 17 + i);
for (const strategy of ['best', 'random'] as Strategy[]) {
  console.log(`\n[${strategy === 'best' ? '최적 배분' : '무작위 배분'}] 티어별 평균 OVR (시드 ${SEEDS_PER_TIER}개, 포지션 순환, 난이도 보통)`);
  console.log(['티어'.padEnd(6), ...ages.map((a) => String(a).padStart(4)), '  선발/시즌', ' 30세 범위'].join(''));
  for (const tier of TIERS_ASC) {
    const runs = Array.from({ length: SEEDS_PER_TIER }, (_, i) => simulateCareer(tier, i, strategy));
    const avgAt = (age: number) => runs.reduce((t, r) => t + (r.ovrByAge[age] ?? 0), 0) / runs.length;
    const at30 = runs.map((r) => r.ovrByAge[30] ?? 0);
    const starts = runs.reduce((t, r) => t + r.starts, 0) / runs.length;
    console.log(
      [
        TIER_NAMES_KO[tier].padEnd(6),
        ...ages.map((a) => avgAt(a).toFixed(0).padStart(4)),
        starts.toFixed(1).padStart(10),
        `   ${Math.min(...at30)}~${Math.max(...at30)}`,
      ].join(''),
    );
  }
}
