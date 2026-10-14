// 가상 유망주 생성 (B.2)

import { FIELD_ATTRIBUTES, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import { randInt, TIERS_ASC } from './growth';
import { shiftOvr } from './npc';
import { attributeOvrWeight, positionOvr, profileOf, type FieldPosition } from './positions';
import { gaussian, type Rng } from './rng';
import type { Tier } from './types';

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권'];
const GIVEN = ['민준', '서준', '도윤', '예준', '시우', '하준', '지호', '주원', '지후', '준우', '도현', '건우', '우진', '현우', '선우', '태윤', '은호', '승민', '재원', '유찬'];

export function randomName(rng: Rng): string {
  return SURNAMES[Math.floor(rng() * SURNAMES.length)]! + GIVEN[Math.floor(rng() * GIVEN.length)]!;
}

/** 잠재력 티어 추첨 (B.2 확률) */
export function rollPotentialTier(rng: Rng): Tier {
  const odds = BALANCE.newGame.potentialOdds;
  const total = TIERS_ASC.reduce((t, k) => t + odds[k], 0);
  let r = rng() * total;
  for (const t of TIERS_ASC) {
    r -= odds[t];
    if (r < 0) return t;
  }
  return 'normal';
}

/**
 * 포지션 OVR 이 targetOvr 가 되도록 능력치 생성.
 * 포지션 비중이 큰 능력치와 핵심 능력치는 높고, 나머지는 낮다.
 */
export function generateProspectAttributes(pos: FieldPosition, targetOvr: number, rng: Rng): FieldAttributes {
  const keys = profileOf(pos).keys;
  const weights = FIELD_ATTRIBUTES.map((a) => attributeOvrWeight(pos, a));
  const maxW = Math.max(...weights);
  const attrs = {} as FieldAttributes;
  FIELD_ATTRIBUTES.forEach((a, i) => {
    const relevance = weights[i]! / maxW; // 0~1
    const base = targetOvr - 15 + relevance * 15 + (keys.includes(a) ? 4 : 0) + gaussian(rng) * 4;
    attrs[a] = Math.round(Math.min(80, Math.max(25, base)));
  });
  shiftOvr(attrs, pos, targetOvr - positionOvr(attrs, pos), rng);
  return attrs;
}

export function rollStartOvr(rng: Rng): number {
  const { min, max } = BALANCE.newGame.startOvr;
  return randInt(rng, min, max);
}
