// 커스텀 생성 측정 (부록 C.45, pending 47 2·49 1): 시작 OVR(자동 배분, 랜덤 생성 평균과 비교)과 시작 나이별 30세 OVR.
// 나이 보너스(BALANCE.custom.pointsPerYear)는 "30세 OVR 이 시작 나이와 상관없이 비슷"하게 맞춘다. 실행: npm run balance:custom
// 커리어는 빠른 경기·최적 자동 배분·이적 거절(잔류)로 돌린다 (npm run balance 와 같은 방식)

import { autoAllocate, playerOvr } from '../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../src/game';
import { autoCustom, baseAttributes, customBudget, customOvr } from '../src/custom';
import { rollProspect } from '../src/aptitude';
import { PLAYABLE_POSITIONS } from '../src/positions';
import type { Tier } from '../src/types';
import { BALANCE } from '../src/config/balance';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const SEEDS = Number(env.SEEDS ?? 24);
const AGES = (env.AGES ?? '15,17,19,21,23').split(',').map(Number);
const TIERS: Tier[] = (env.TIERS ?? 'normal,legendary').split(',') as Tier[];

if (env.PPY) (BALANCE.custom as { pointsPerYear: number }).pointsPerYear = Number(env.PPY);
if (env.PPYY) (BALANCE.custom as { pointsPerYearYounger: number }).pointsPerYearYounger = Number(env.PPYY);
const avg = (xs: number[]) => xs.reduce((t, x) => t + x, 0) / Math.max(1, xs.length);

// 1. 시작 OVR: 랜덤 생성(시작 후보 1위 자리) vs 커스텀 17세 자동 배분
{
  const rnd: number[] = [];
  for (let i = 0; i < 200; i++) {
    const r = rollProspect(`cu-start-${i}`);
    rnd.push(r.candidates[0]!.ovr);
  }
  const cu = PLAYABLE_POSITIONS.map((p) => customOvr(autoCustom(p, customBudget(17, []), 180), p));
  console.log(`[시작 OVR] 랜덤 생성 후보 1위 평균 ${avg(rnd).toFixed(1)} · 커스텀 17세 자동 배분 평균 ${avg(cu).toFixed(1)} (최저 ${Math.min(...cu).toFixed(1)} 최고 ${Math.max(...cu).toFixed(1)})`);
  for (const age of AGES) {
    const v = PLAYABLE_POSITIONS.map((p) => customOvr(autoCustom(p, customBudget(age, []), 180), p));
    console.log(`  ${age}세 포인트 ${customBudget(age, [])} → 시작 OVR 평균 ${avg(v).toFixed(1)}`);
  }
}

// 2. 시작 나이별 30세 OVR
for (const tier of TIERS) {
  const line: string[] = [];
  for (const age of AGES) {
    const at30: number[] = [];
    for (let i = 0; i < SEEDS; i++) {
      const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
      const attrs = autoCustom(position, customBudget(age, []), 180, baseAttributes());
      const state = newGame({
        mode: 'custom', seed: `cu-${tier}-${age}-${i}`, difficulty: 'normal',
        custom: { position, age, attributes: attrs, body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [], nationality: 'Korea Republic', appearance: 'eastAsian' },
      });
      state.player.potentialTier = tier;
      while (state.player.age < 30) {
        while (state.phase === 'season') {
          playRound(state, { engine: 'quick' });
          autoAllocate(state.player);
        }
        autoAllocate(state.player);
        if (state.phase !== 'offseason') break;
        autoMarket(state, 'stay');
        startNextSeason(state);
      }
      at30.push(playerOvr(state.player));
    }
    line.push(`${age}세 ${avg(at30).toFixed(1)}`);
  }
  console.log(`[30세 OVR · ${tier}] ${line.join(' · ')}`);
}
