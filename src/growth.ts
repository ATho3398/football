// 성장, 레벨업, 포인트 비용, 자동 성장, 노화, 노련함 (5.1, 6.1, 6.1.1, 6.2, B.5)

import { proficientOvr } from './proficiency';
import { ATTRIBUTE_GROUPS, attrDisplay, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import { attributeOvrWeight, type FieldPosition } from './positions';
import type { Rng } from './rng';
import type { Honors, PlayerState, Tier } from './types';

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
export const NO_HONORS: Honors = { ballonDor: 0, trebles: 0, worldCups: 0 };

/** 최고 개인상 수 (레전더리 조건 4a): 시즌마다 최대 topPerSeason 개까지 */
export function topAwardCount(h: Honors | undefined): number {
  const L = BALANCE.reputation.legendary;
  return Object.values(h?.top ?? {}).reduce((t, n) => t + Math.min(L.topPerSeason, n), 0);
}

/** 레전더리 조건 하나하나 (8.1, 부록 C.23 → C.76n 4a 개정): 화면의 조건 목록과 판정에 같이 쓴다 */
export function legendaryConditions(rep: number, h: Honors = NO_HONORS): { label: string; met: boolean }[] {
  const L = BALANCE.reputation.legendary;
  const cut = BALANCE.reputation.tierCuts.worldClass;
  const top = topAwardCount(h);
  return [
    { label: `위상 ${cut} 이상 (월드클래스)`, met: rep >= cut },
    { label: `발롱도르 ${L.ballonDorMin}회 이상 또는 최고 개인상 ${L.topMin}회 이상 (지금 ${top}회)`, met: h.ballonDor >= L.ballonDorMin || top >= L.topMin },
    { label: '트레블', met: h.trebles > 0 },
    { label: '월드컵 우승', met: h.worldCups > 0 },
    { label: `발롱도르 ${L.ballonDorAlt}회 이상`, met: h.ballonDor >= L.ballonDorAlt },
    { label: `최고 개인상 ${L.topAlt}회 이상`, met: top >= L.topAlt },
  ];
}

/**
 * 업적 조건 (C.76n 4a): [발롱도르 1회 이상 또는 최고 개인상 3회 이상] 그리고 (트레블 또는 월드컵 우승 또는 발롱도르 3회 이상 또는 최고 개인상 6회 이상).
 * 최고 개인상 = 더 베스트 · 리그 올해의 선수(47b) · 야신 · 올해의 수비수 · 월드컵 골든볼 (시즌당 최대 2). 기록이 없으면 false
 */
export function legendaryHonorsMet(h: Honors | undefined): boolean {
  if (!h) return false;
  const L = BALANCE.reputation.legendary;
  const top = topAwardCount(h);
  return (h.ballonDor >= L.ballonDorMin || top >= L.topMin) && (h.trebles > 0 || h.worldCups > 0 || h.ballonDor >= L.ballonDorAlt || top >= L.topAlt);
}

/** 위상 점수(+업적) → 위상 티어. 레전더리는 월드클래스 점수 + 업적 조건 (8.1, 부록 C.23) */
export function reputationTier(rep: number, honors?: Honors): Tier {
  const t = tierFromCuts(rep, BALANCE.reputation.tierCuts);
  if (t === 'legendary' && !legendaryHonorsMet(honors)) return 'worldClass';
  return t;
}

/** 티어 하한 (부록 C.27): 이 점수의 위상이 내려갈 수 있는 바닥 = 지금 도달한 하한 티어의 컷. 스페셜 미만이면 0 */
export function reputationFloor(rep: number): number {
  const C = BALANCE.reputation.tierCuts;
  let floor = 0;
  for (const t of BALANCE.reputation.floorTiers) if (rep >= C[t]) floor = Math.max(floor, C[t]);
  return floor;
}

/** 하한 티어 (부록 C.27): 바닥이 된 티어. 스페셜 미만이면 null */
export function reputationFloorTier(rep: number): Tier | null {
  const C = BALANCE.reputation.tierCuts;
  let out: Tier | null = null;
  for (const t of BALANCE.reputation.floorTiers) if (rep >= C[t]) out = t;
  return out;
}

export const randInt = (rng: Rng, min: number, max: number): number => min + Math.floor(rng() * (max - min + 1));

/** 다음 위상 티어와 그 컷. 최고 티어거나 다음이 업적 조건으로만 열리는 레전더리면 null */
export function nextReputationTier(rep: number, honors?: Honors): { tier: Tier; cut: number } | null {
  const next = TIERS_ASC[TIERS_ASC.indexOf(reputationTier(rep, honors)) + 1];
  return next && next !== 'legendary' ? { tier: next, cut: BALANCE.reputation.tierCuts[next] } : null;
}

/** 내 선수의 포인트 비용 구간 티어: 현재 실력 티어 (6.2 성장 해금, 부록 C.23: 위상과 분리) */
export const costTier = (p: Pick<PlayerState, 'attributes' | 'position'>): Tier => skillTier(playerOvr(p));

/** 내부 값 1 올리는 비용 배수 (6.2, 훈련 게이지 전용 C.49): max(구간 비용, 고값 비용) */
export function internalCost(value: number, tier: Tier): number {
  const band = G.costBands[tier];
  const bandCost = value <= band.cost1Max ? 1 : value <= band.cost2Max ? 2 : 3;
  return Math.max(bandCost, agingRate(BALANCE.training.gauge.highValueCost, value));
}

/** 화면 한 칸(+1, 내부 +pointStep) 올리는 포인트 비용 (6.2, C.49): 지금 화면 값이 구간 화면 값 이하면 1, 2, 그 위 3 */
export function pointCost(value: number, tier: Tier): number {
  const band = G.costBands[tier];
  const d = attrDisplay(value);
  return d <= attrDisplay(band.cost1Max) ? 1 : d <= attrDisplay(band.cost2Max) ? 2 : 3;
}

/** 실제 선수 정점 목표 = 시작 OVR + 시작 나이별 성장 여지 (부록 D.7 #1) */
export function realPeakTarget(startOvr: number, startAge: number): number {
  return Math.round((startOvr + agingRate(G.realPeak.roomByStartAge, startAge)) * 10) / 10;
}

/** 다음 레벨업에 필요한 XP (5.1): OVR 이 높을수록, 실제 선수는 정점 목표에 가까울수록 늘어난다 */
export function xpToLevel(p: Pick<PlayerState, 'attributes' | 'position'> & { peakTarget?: number }): number {
  const { fromOvr, perOvr } = G.xpByOvr;
  const ovr = playerOvr(p);
  let m = 1 + Math.max(0, ovr - fromOvr) * perOvr;
  if (p.peakTarget !== undefined) {
    const R = G.realPeak;
    m *= 1 + Math.max(0, ovr - (p.peakTarget - R.softBelow)) * R.perOvr;
  }
  return Math.round(G.xpPerLevel * m);
}

/** XP 추가. 레벨업 횟수를 돌려준다 */
export function addXp(p: PlayerState, amount: number): number {
  const xp = Math.max(0, Math.round(amount));
  p.xp += xp;
  p.totalXp += xp;
  let levels = 0;
  for (let need = xpToLevel(p); p.xp >= need; need = xpToLevel(p)) {
    p.xp -= need;
    p.level += 1;
    p.unspentPoints += G.pointsPerLevel;
    levels++;
  }
  return levels;
}

export type RaiseBlock = 'max' | 'points';

/** 화면 20(또는 내부 99)이면 더 못 올린다 */
export const isMaxed = (v: number): boolean => v >= G.maxAttribute || attrDisplay(v) >= 20;

/** 올릴 수 없으면 이유, 올릴 수 있으면 null */
export function raiseBlock(p: PlayerState, attr: FieldAttribute): RaiseBlock | null {
  const v = p.attributes[attr];
  if (isMaxed(v)) return 'max';
  if (pointCost(v, costTier(p)) > p.unspentPoints) return 'points';
  return null;
}

/**
 * 찍기 한 번 (C.49): 화면 +1칸 = 내부 +pointStep (칸 안 진행은 그대로, 99 상한). 성공하면 true.
 * 비용 2 구간에 처음 들어서면 coachWarned 가 켜진다 (화면에서 코치 코멘트 표시).
 */
export function raiseAttribute(p: PlayerState, attr: FieldAttribute): boolean {
  if (raiseBlock(p, attr)) return false;
  const v = p.attributes[attr];
  const tier = costTier(p);
  p.unspentPoints -= pointCost(v, tier);
  p.attributes[attr] = Math.min(G.maxAttribute, v + G.pointStep);
  if (pointCost(p.attributes[attr], tier) >= 2) p.coachWarned = true;
  return true;
}

/** 남은 포인트를 포지션 OVR 효율 순으로 자동 배분 (밸런스 스크립트, 자동 배분 버튼). 찍은 순서를 돌려준다 */
export function autoAllocate(p: PlayerState): FieldAttribute[] {
  const out: FieldAttribute[] = [];
  for (;;) {
    let best: FieldAttribute | null = null;
    let bestScore = 0;
    for (const a of FIELD_ATTRIBUTES) {
      if (raiseBlock(p, a)) continue;
      const v = p.attributes[a];
      const score = (attributeOvrWeight(p.position, a) * (Math.min(G.maxAttribute, v + G.pointStep) - v)) / pointCost(v, costTier(p));
      if (score > bestScore) {
        bestScore = score;
        best = a;
      }
    }
    if (!best) break;
    raiseAttribute(p, best);
    out.push(best);
  }
  return out;
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

/** 나이 + shift(시즌, 소수 가능) 의 곡선 값: 두 정수 나이 사이 선형 보간 (C.77n 마모). shift 0 이면 agingRate 그대로 */
export function agingRateShifted(curve: readonly (readonly [number, number])[], age: number, shift: number): number {
  if (shift <= 0) return agingRate(curve, age);
  const a = age + shift;
  const lo = Math.floor(a);
  const f = a - lo;
  return (1 - f) * agingRate(curve, lo) + f * agingRate(curve, lo + 1);
}

/** 포지션별 노화 배율: OVR 비중이 큰 능력치일수록 크고, 25개 평균은 1 (aging.positionFocus) */
const FOCUS_CACHE = new Map<string, Record<FieldAttribute, number>>();
export function agingFocus(pos: FieldPosition, s: number = BALANCE.aging.positionFocus): Record<FieldAttribute, number> {
  const key = `${pos}:${s}`;
  const cached = FOCUS_CACHE.get(key);
  if (cached) return cached;
  const out = computeAgingFocus(pos, s);
  FOCUS_CACHE.set(key, out);
  return out;
}

function computeAgingFocus(pos: FieldPosition, s: number): Record<FieldAttribute, number> {
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
export function applyAging(attrs: FieldAttributes, age: number, rng: Rng, pos?: FieldPosition, mul = 1, skip: { phys?: boolean; other?: boolean } = {}, shift = 0): AttributeDelta {
  const A = BALANCE.aging;
  const V = BALANCE.veteran;
  // 시즌 누적 마모 (C.77n): 곡선을 shift 시즌 앞당겨 읽는다 (소수는 두 나이 사이 보간)
  const at = (curve: readonly (readonly [number, number])[]): number => agingRateShifted(curve, age, shift);
  const late = age >= A.lateFrom;
  // 38세부터 (C.45): 골고루(lateFocus) + 체력·속도·가속 추가 배율. mul = 노익장 ×0.6
  const focus = pos ? agingFocus(pos, late ? A.lateFocus : A.positionFocus) : null;
  const delta: AttributeDelta = {};
  for (const a of FIELD_ATTRIBUTES) {
    let rate: number;
    if (isVeteranAttribute(a)) rate = age + shift < V.agingFromAge ? 0 : at(A.other) * V.agingFactor;
    else rate = at(PHYSICAL.includes(a) ? A.physical : A.other);
    if (focus) rate *= focus[a];
    if (late) rate *= A.lateExtra[a] ?? 1;
    rate *= mul;
    // 늦게 핀 꽃 (C.47 B안): 그 묶음 노화 1회 면제 (난수는 그대로 쓴다)
    if ((PHYSICAL.includes(a) ? skip.phys : skip.other) && rate > 0) {
      rng();
      continue;
    }
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

/** 내 선수 OVR = 주 포지션 OVR − 숙련도 페널티 (부록 D.3). 숙련도 기록이 없으면 페널티 없음 */
export function playerOvr(p: Pick<PlayerState, 'attributes' | 'position'> & { proficiency?: PlayerState['proficiency'] }): number {
  return proficientOvr(p, p.position as FieldPosition);
}
