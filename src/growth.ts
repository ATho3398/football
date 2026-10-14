// 성장, 레벨업, 포인트 비용, 자동 성장, 노화, 노련함 (5.1, 6.1, 6.1.1, 6.2, B.5)

import { ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import { attributeOvrWeight, positionOvr, type FieldPosition } from './positions';
import type { Rng } from './rng';
import type { PlayerState, Tier } from './types';

const G = BALANCE.growth;

export const TIERS_ASC: readonly Tier[] = ['normal', 'special', 'topClass', 'worldClass', 'legendary'];

export const TIER_NAMES_KO: Record<Tier, string> = {
  normal: '일반', special: '스페셜', topClass: '탑클래스', worldClass: '월드클래스', legendary: '레전더리',
};

function tierFromCuts(value: number, cuts: Record<Tier, number>): Tier {
  let out: Tier = 'normal';
  for (const t of TIERS_ASC) if (value >= cuts[t]) out = t;
  return out;
}

/** OVR → 실력 티어 */
export const skillTier = (ovr: number): Tier => tierFromCuts(ovr, BALANCE.skillTierCuts);
/** 위상 점수 → 위상 티어 */
export const reputationTier = (rep: number): Tier => tierFromCuts(rep, BALANCE.reputation.tierCuts);

export const randInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

/** 다음 위상 티어와 그 컷. 최고 티어면 null */
export function nextReputationTier(rep: number): { tier: Tier; cut: number } | null {
  const next = TIERS_ASC[TIERS_ASC.indexOf(reputationTier(rep)) + 1];
  return next ? { tier: next, cut: BALANCE.reputation.tierCuts[next] } : null;
}

/** 내 선수의 포인트 비용 구간 티어: 현재 위상 티어 (6.2 성장 해금) */
export const costTier = (p: Pick<PlayerState, 'reputation'>): Tier => reputationTier(p.reputation);

/** 현재 값에서 1 올리는 포인트 비용 (6.2) */
export function pointCost(value: number, tier: Tier): number {
  const band = G.costBands[tier];
  if (value <= band.cost1Max) return 1;
  if (value <= band.cost2Max) return 2;
  return 3;
}

/** XP 추가. 레벨업 횟수를 돌려준다 */
export function addXp(p: PlayerState, amount: number): number {
  const xp = Math.max(0, Math.round(amount));
  p.xp += xp;
  p.totalXp += xp;
  let levels = 0;
  while (p.xp >= G.xpPerLevel) {
    p.xp -= G.xpPerLevel;
    p.level += 1;
    p.unspentPoints += G.pointsPerLevel;
    p.allocation.levels += 1;
    levels++;
  }
  return levels;
}

export type RaiseBlock = 'max' | 'points' | 'cap';

/** 올릴 수 없으면 이유, 올릴 수 있으면 null */
export function raiseBlock(p: PlayerState, attr: FieldAttribute): RaiseBlock | null {
  const v = p.attributes[attr];
  if (v >= G.maxAttribute) return 'max';
  if (pointCost(v, costTier(p)) > p.unspentPoints) return 'points';
  if ((p.allocation.raised[attr] ?? 0) >= p.allocation.levels * G.maxRaisePerLevel) return 'cap';
  return null;
}

/**
 * 능력치 +1. 성공하면 true.
 * 비용 2 구간에 처음 들어서면 coachWarned 가 켜진다 (화면에서 코치 코멘트 표시).
 */
export function raiseAttribute(p: PlayerState, attr: FieldAttribute): boolean {
  if (raiseBlock(p, attr)) return false;
  const v = p.attributes[attr];
  const tier = costTier(p);
  p.unspentPoints -= pointCost(v, tier);
  p.attributes[attr] = v + 1;
  p.allocation.raised[attr] = (p.allocation.raised[attr] ?? 0) + 1;
  if (pointCost(v + 1, tier) >= 2) p.coachWarned = true;
  if (p.unspentPoints === 0) p.allocation = { levels: 0, raised: {} };
  return true;
}

/** 남은 포인트를 포지션 OVR 효율 순으로 자동 배분 (밸런스 스크립트, 자동 배분 버튼) */
export function autoAllocate(p: PlayerState): void {
  for (;;) {
    let best: FieldAttribute | null = null;
    let bestScore = 0;
    for (const a of FIELD_ATTRIBUTES) {
      if (raiseBlock(p, a)) continue;
      const score = attributeOvrWeight(p.position, a) / pointCost(p.attributes[a], costTier(p));
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (!best) break;
    raiseAttribute(p, best);
  }
}

export type AttributeDelta = Partial<Record<FieldAttribute, number>>;

function bump(attrs: FieldAttributes, delta: AttributeDelta, a: FieldAttribute, d: number): void {
  const nv = Math.max(1, Math.min(G.maxAttribute, attrs[a] + d));
  const real = nv - attrs[a];
  if (real === 0) return;
  attrs[a] = nv;
  delta[a] = (delta[a] ?? 0) + real;
}

/** 17~21세 시즌 종료 자동 성장. age 는 그 시즌의 나이 */
export function applyAutoGrowth(attrs: FieldAttributes, age: number, tier: Tier, rng: Rng): AttributeDelta {
  const delta: AttributeDelta = {};
  const { minAge, maxAge, byTier } = G.autoGrowth;
  if (age < minAge || age > maxAge) return delta;
  const [min, max] = byTier[tier];
  for (const a of FIELD_ATTRIBUTES) bump(attrs, delta, a, randInt(rng, min, max));
  return delta;
}

/** 신체 능력치: 속도, 가속, 민첩성, 체력, 근력, 점프 */
export const PHYSICAL: readonly FieldAttribute[] = [
  ...ATTRIBUTE_GROUPS.pace, ...ATTRIBUTE_GROUPS.physical,
];

export const isVeteranAttribute = (a: FieldAttribute): boolean => BALANCE.veteran.attributes.includes(a);

/** 나이별 값 (곡선 표에서 해당 나이의 마지막 구간). 노화 하락, 노련함 확률, 고령 XP 배율 */
export function agingRate(curve: readonly (readonly [number, number])[], age: number): number {
  let rate = 0;
  for (const [from, r] of curve) if (age >= from) rate = r;
  return rate;
}

/** 포지션별 노화 배율: OVR 비중이 큰 능력치일수록 크고, 25개 평균은 1 (aging.positionFocus) */
export function agingFocus(pos: FieldPosition): Record<FieldAttribute, number> {
  const s = BALANCE.aging.positionFocus;
  const weights = FIELD_ATTRIBUTES.map((a) => attributeOvrWeight(pos, a));
  const mean = weights.reduce((t, x) => t + x, 0) / weights.length;
  const out = {} as Record<FieldAttribute, number>;
  FIELD_ATTRIBUTES.forEach((a, i) => (out[a] = 1 - s + (s * weights[i]!) / mean));
  return out;
}

/**
 * 노화 (6.1, 내 선수와 NPC 공통). age 는 그 시즌의 나이. 소수 하락은 능력치마다 확률로.
 * 노련함 능력치는 veteran.agingFromAge 전까지 면제, 그 뒤로는 기술/멘탈 하락 × agingFactor (6.1.1).
 * pos 를 주면 포지션 OVR 에 중요한 능력치가 더 많이 떨어진다 (aging.positionFocus)
 */
export function applyAging(attrs: FieldAttributes, age: number, rng: Rng, pos?: FieldPosition): AttributeDelta {
  const A = BALANCE.aging;
  const V = BALANCE.veteran;
  const focus = pos ? agingFocus(pos) : null;
  const delta: AttributeDelta = {};
  for (const a of FIELD_ATTRIBUTES) {
    let rate: number;
    if (isVeteranAttribute(a)) rate = age < V.agingFromAge ? 0 : agingRate(A.other, age) * V.agingFactor;
    else rate = agingRate(PHYSICAL.includes(a) ? A.physical : A.other, age);
    if (focus) rate *= focus[a];
    if (rate === 0) continue;
    const lo = Math.floor(rate);
    bump(attrs, delta, a, -(lo + (rng() < rate - lo ? 1 : 0)));
  }
  return delta;
}

/** 노련함 능력치 성장 (6.1.1, 내 선수와 NPC 공통). age 는 그 시즌의 나이. 능력치마다 확률로 +1 */
export function applyVeteranGrowth(attrs: FieldAttributes, age: number, rng: Rng): AttributeDelta {
  const delta: AttributeDelta = {};
  const chance = agingRate(BALANCE.veteran.growth, age);
  if (chance === 0) return delta;
  for (const a of BALANCE.veteran.attributes) if (rng() < chance) bump(attrs, delta, a, 1);
  return delta;
}

/** 고령 XP 감쇠 배율 (6.1). 경기 XP와 결장 주 훈련 XP에 곱한다 */
export function veteranXpMultiplier(age: number): number {
  let m = 1;
  for (const [from, x] of BALANCE.matchXp.veteranMultiplier) if (age >= from) m = x;
  return m;
}

export function playerOvr(p: Pick<PlayerState, 'attributes' | 'position'>): number {
  return positionOvr(p.attributes, p.position as FieldPosition);
}
