// 성장, 레벨업, 포인트 비용, 자동 성장, 노화 (5.1, 6.1, 6.2, B.5)

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
  if (pointCost(v, p.potentialTier) > p.unspentPoints) return 'points';
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
  p.unspentPoints -= pointCost(v, p.potentialTier);
  p.attributes[attr] = v + 1;
  p.allocation.raised[attr] = (p.allocation.raised[attr] ?? 0) + 1;
  if (pointCost(v + 1, p.potentialTier) >= 2) p.coachWarned = true;
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
      const score = attributeOvrWeight(p.position, a) / pointCost(p.attributes[a], p.potentialTier);
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

const PHYSICAL: readonly FieldAttribute[] = [
  ...ATTRIBUTE_GROUPS.pace, ...ATTRIBUTE_GROUPS.physical,
];

/** 하락 폭에 배율을 곱하고 소수점은 확률로 반올림 */
function scaledDrop(rng: Rng, base: number, mult: number): number {
  const v = base * mult;
  const lo = Math.floor(v);
  return lo + (rng() < v - lo ? 1 : 0);
}

/** 노화 (6.1, 내 선수와 NPC 공통). age 는 그 시즌의 나이 */
export function applyAging(attrs: FieldAttributes, age: number, rng: Rng): AttributeDelta {
  const A = BALANCE.aging;
  const delta: AttributeDelta = {};
  const mult = age >= A.lateAge ? A.lateMultiplier : 1;
  for (const a of FIELD_ATTRIBUTES) {
    const physical = PHYSICAL.includes(a);
    if (physical && age >= A.physicalStartAge) {
      bump(attrs, delta, a, -scaledDrop(rng, randInt(rng, A.physicalDrop.min, A.physicalDrop.max), mult));
    } else if (!physical && age >= A.otherStartAge) {
      bump(attrs, delta, a, -scaledDrop(rng, randInt(rng, A.otherDrop.min, A.otherDrop.max), mult));
    }
  }
  return delta;
}

export function playerOvr(p: Pick<PlayerState, 'attributes' | 'position'>): number {
  return positionOvr(p.attributes, p.position as FieldPosition);
}
