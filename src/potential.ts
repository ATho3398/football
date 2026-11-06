// 내 선수 잠재력 범위 표시 (부록 C.81n, B6 결정): 정확한 값 대신 "잠재력 78~84" 처럼 범위로 보여 준다.
// 실제 잠재력 = 실제 선수·레전드는 정점 목표 OVR(peakTarget), 가상 유망주는 잠재력 티어의 NPC 전성기 OVR 구간(BALANCE.npc.peakOvr) 안에서
// 월드 시드로 고정한 값. 둘 다 지금 OVR 보다 낮으면 지금 OVR. 범위 반폭은 나이가 들수록 좁아지고(17세 ±6 → 27세 이후 ±1),
// 범위 안 위치(어긋남)는 월드 시드 + 나이로 고정해 새로고침해도 같다. 표시 계산만 — 세이브·성장에는 안 쓴다.

import { BALANCE } from './config/balance';
import { createRng, hashSeed } from './rng';
import type { Tier } from './types';

export interface PotentialSource {
  age: number;
  peakTarget?: number;
  potentialTier: Tier;
}

/** 실제 잠재력 (표시 기준값, 숨김) */
export function truePotential(p: PotentialSource, ovr: number, worldSeed: string): number {
  let base = p.peakTarget;
  if (base === undefined) {
    const [lo, hi] = BALANCE.npc.peakOvr[p.potentialTier];
    base = lo + Math.floor(createRng(hashSeed(`${worldSeed}:potential`))() * (hi - lo + 1));
  }
  return Math.min(99, Math.max(Math.round(base), ovr));
}

/** 범위 반폭: 나이가 들수록 좁아진다 */
export function potentialHalfWidth(age: number): number {
  const P = BALANCE.display.potential;
  if (age <= P.youngAge) return P.youngHalf;
  if (age >= P.settledAge) return P.settledHalf;
  const f = (age - P.youngAge) / (P.settledAge - P.youngAge);
  return Math.max(P.settledHalf, Math.round(P.youngHalf + (P.settledHalf - P.youngHalf) * f));
}

/** 보여 줄 잠재력 범위 [낮은 끝, 높은 끝] (늘 lo < hi, 실제 잠재력 포함, 지금 OVR 이상) */
export function potentialRange(p: PotentialSource, ovr: number, worldSeed: string): [number, number] {
  const real = truePotential(p, ovr, worldSeed);
  const w = potentialHalfWidth(p.age);
  const shift = Math.floor(createRng(hashSeed(`${worldSeed}:potential-range:${p.age}`))() * (2 * w + 1)) - w;
  let lo = Math.max(ovr, real + shift - w);
  let hi = Math.min(99, real + shift + w);
  if (lo >= hi) {
    if (hi < 99) hi = lo + 1;
    else lo = hi - 1;
  }
  return [lo, hi];
}

export const potentialLabel = (r: [number, number]): string => `${r[0]}~${r[1]}`;
