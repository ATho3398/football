// 커스텀 생성 (pending 47 2·49 1, 부록 C.45): 모든 능력치 BALANCE.custom.base 에서 시작해 배분 포인트를 나눈다.
// 포인트 = 기본 + 나이 보너스 + 단점 − 장점. 키가 크면 속도·가속·민첩 상한 −, 헤더·점프 상한 + (서로 맞물림)

import { FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import { traitPoints, type TraitId } from './traits';
import { attributeOvrWeight, positionOvrExact, type FieldPosition } from './positions';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const SPEED_ATTRS: readonly FieldAttribute[] = ['pace', 'acceleration', 'agility'];
export const AERIAL_ATTRS: readonly FieldAttribute[] = ['heading', 'jumping'];

export function baseAttributes(): FieldAttributes {
  return Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, BALANCE.custom.base])) as FieldAttributes;
}

/** 능력치 상한 (키에 따라 속도 계열 −, 공중 계열 +) */
export function customCap(a: FieldAttribute, height: number): number {
  const C = BALANCE.custom;
  const B = BALANCE.body.custom;
  const dh = height - 180;
  if (SPEED_ATTRS.includes(a)) return Math.round(clamp(B.speedCapBase - dh * B.speedCapPerCm, B.capMin, B.capMax));
  if (AERIAL_ATTRS.includes(a)) return Math.round(clamp(B.aerialCapBase + dh * B.aerialCapPerCm, B.capMin, B.capMax));
  return C.cap;
}

/** 내부 v → v + step(한 칸) 비용 */
export function stepCost(v: number): number {
  for (const [below, c] of BALANCE.custom.costBands) if (v < below) return c;
  return BALANCE.custom.costBands.at(-1)![1];
}

/** base 에서 v 까지 비용 (칸 단위, 칸 중간 값은 올림) */
export function costTo(v: number): number {
  const S = BALANCE.custom.step;
  let t = 0;
  for (let x = BALANCE.custom.base; x < v; x += S) t += stepCost(x);
  return t;
}

export function spentPoints(attrs: FieldAttributes): number {
  return FIELD_ATTRIBUTES.reduce((t, a) => t + costTo(attrs[a]), 0);
}

/** 나이 보너스 (17세 0, 1살당 ±pointsPerYear) */
export function agePoints(age: number): number {
  const C = BALANCE.custom;
  return (clamp(age, C.minAge, C.maxAge) - C.refAge) * C.pointsPerYear;
}

/** 커스텀에서 고를 수 없는 장단점 (약발은 약발 선택 포인트로 직접 고른다) */
export const CUSTOM_HIDDEN_TRAITS: readonly TraitId[] = ['twoFooted', 'weakFootOne'];

/** 약발 선택 포인트 (3 기준) */
export function weakFootPoints(weakFoot: number): number {
  return BALANCE.custom.weakFootPoints[Math.min(5, Math.max(1, Math.round(weakFoot))) - 1]!;
}

/** 쓸 수 있는 배분 포인트 = 기본 + 나이 + 장단점 + 약발 */
export function customBudget(age: number, traits: readonly TraitId[], weakFoot = 3): number {
  return BALANCE.custom.points + agePoints(age) + traits.reduce((t, id) => t + traitPoints(id), 0) + weakFootPoints(weakFoot);
}

/**
 * 한 능력치를 칸 수 steps 만큼(±) 바꾼다 (한 칸 = 내부 step). 포인트·상한이 모자라면 멈춘다. 상한이 칸 중간이면 상한까지
 */
export function customRaise(attrs: FieldAttributes, a: FieldAttribute, steps: number, budget: number, height: number): FieldAttributes {
  const S = BALANCE.custom.step;
  const out = { ...attrs };
  let left = budget - spentPoints(out);
  const cap = customCap(a, height);
  for (let k = 0; k < Math.abs(steps); k++) {
    if (steps > 0) {
      const c = stepCost(out[a]);
      if (out[a] >= cap || c > left) break;
      out[a] = Math.min(cap, out[a] + S);
      left -= c;
    } else {
      if (out[a] <= BALANCE.custom.base) break;
      const lo = Math.max(BALANCE.custom.base, BALANCE.custom.base + Math.ceil((out[a] - BALANCE.custom.base) / S - 1) * S);
      out[a] = lo;
      left = budget - spentPoints(out);
    }
  }
  return out;
}

/** 키가 바뀌면 상한을 넘은 능력치를 상한으로 (돌려받은 포인트는 남은 포인트로) */
export function clampToCaps(attrs: FieldAttributes, height: number): FieldAttributes {
  const out = { ...attrs };
  for (const a of FIELD_ATTRIBUTES) out[a] = Math.min(out[a], Math.max(BALANCE.custom.base, customCap(a, height)));
  return out;
}

/** 포지션 OVR 우선 자동 배분 (OVR 기여 / 비용 이 가장 큰 칸부터, 측정과 [자동 배분] 버튼) */
export function autoCustom(pos: FieldPosition, budget: number, height: number, from: FieldAttributes = baseAttributes()): FieldAttributes {
  const out = { ...from };
  let left = budget - spentPoints(out);
  const w = Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, attributeOvrWeight(pos, a)])) as Record<FieldAttribute, number>;
  for (let guard = 0; guard < 2000 && left > 0; guard++) {
    let best: FieldAttribute | null = null;
    let bestV = 0;
    for (const a of FIELD_ATTRIBUTES) {
      const c = stepCost(out[a]);
      if (out[a] >= customCap(a, height) || c > left || w[a] <= 0) continue;
      const v = w[a] / c;
      if (v > bestV + 1e-12) {
        bestV = v;
        best = a;
      }
    }
    if (!best) break;
    left -= stepCost(out[best]);
    out[best] = Math.min(customCap(best, height), out[best] + BALANCE.custom.step);
  }
  return out;
}

/** 검증: 상한·포인트 안인지 (화면 밖에서 온 값도 newGame 전에 확인) */
export function validCustom(attrs: FieldAttributes, budget: number, height: number): boolean {
  if (spentPoints(attrs) > budget) return false;
  return FIELD_ATTRIBUTES.every((a) => attrs[a] >= BALANCE.custom.base && attrs[a] <= Math.max(BALANCE.custom.base, customCap(a, height)));
}

export const customOvr = (attrs: FieldAttributes, pos: FieldPosition): number => positionOvrExact(attrs, pos);
