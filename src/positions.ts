// 포지션별 OVR (docs/game-design.md 4.2)

import {
  ATTRIBUTE_GROUPS, GROUP_NAMES, type AttributeGroup, type FieldAttribute, type FieldAttributes,
} from './attributes';
import type { Position } from './types';

export type FieldPosition = Exclude<Position, 'GK'>;

/** 새 게임에서 고를 수 있는 12개 포지션 */
export const PLAYABLE_POSITIONS = [
  'ST', 'CF', 'LW', 'RW', 'LM', 'RM', 'CAM', 'CM', 'CDM', 'LB', 'RB', 'CB',
] as const satisfies readonly FieldPosition[];
export type PlayablePosition = (typeof PLAYABLE_POSITIONS)[number];

export const POSITION_NAMES_KO: Record<FieldPosition, string> = {
  ST: '스트라이커', CF: '센터 포워드', LW: '왼쪽 윙어', RW: '오른쪽 윙어',
  LM: '왼쪽 미드필더', RM: '오른쪽 미드필더', CAM: '공격형 미드필더', CM: '중앙 미드필더',
  CDM: '수비형 미드필더', LB: '왼쪽 풀백', RB: '오른쪽 풀백', LWB: '왼쪽 윙백', RWB: '오른쪽 윙백',
  CB: '센터백',
};

export const DEFENDER_POSITIONS: readonly FieldPosition[] = ['CB', 'LB', 'RB', 'LWB', 'RWB'];

interface PositionProfile {
  /** 묶음 가중치, 합 100 */
  weights: Record<AttributeGroup, number>;
  /** 핵심 능력치: 묶음 평균을 낼 때 2배 */
  keys: readonly FieldAttribute[];
}

const w = (
  ballHandling: number, finishing: number, passing: number, defending: number,
  pace: number, physical: number, mental: number,
): Record<AttributeGroup, number> => ({ ballHandling, finishing, passing, defending, pace, physical, mental });

const PROFILES: Record<PlayablePosition, PositionProfile> = {
  ST: { weights: w(15, 40, 5, 0, 20, 10, 10), keys: ['shooting', 'offTheBall', 'acceleration'] },
  CF: { weights: w(20, 30, 15, 0, 15, 10, 10), keys: ['ballControl', 'shooting', 'vision'] },
  LW: { weights: w(25, 20, 15, 0, 30, 5, 5), keys: ['dribbling', 'pace', 'crossing'] },
  RW: { weights: w(25, 20, 15, 0, 30, 5, 5), keys: ['dribbling', 'pace', 'crossing'] },
  LM: { weights: w(20, 10, 20, 5, 25, 10, 10), keys: ['crossing', 'stamina', 'acceleration'] },
  RM: { weights: w(20, 10, 20, 5, 25, 10, 10), keys: ['crossing', 'stamina', 'acceleration'] },
  CAM: { weights: w(25, 15, 30, 0, 10, 5, 15), keys: ['vision', 'shortPassing', 'ballControl'] },
  CM: { weights: w(15, 10, 30, 10, 10, 15, 10), keys: ['shortPassing', 'stamina', 'vision'] },
  CDM: { weights: w(5, 0, 20, 35, 5, 20, 15), keys: ['interception', 'tackling', 'stamina'] },
  LB: { weights: w(10, 0, 15, 25, 25, 15, 10), keys: ['pace', 'crossing', 'tackling'] },
  RB: { weights: w(10, 0, 15, 25, 25, 15, 10), keys: ['pace', 'crossing', 'tackling'] },
  CB: {
    weights: w(0, 5, 5, 40, 5, 30, 15),
    keys: ['marking', 'defensivePositioning', 'heading', 'strength'],
  },
};

/** LWB/RWB는 LB/RB 가중치를 쓴다 (B.9) */
export function profileOf(pos: FieldPosition): PositionProfile {
  if (pos === 'LWB') return PROFILES.LB;
  if (pos === 'RWB') return PROFILES.RB;
  return PROFILES[pos];
}

/**
 * 능력치 하나가 1 오를 때 포지션 OVR(반올림 전)이 오르는 양.
 * 묶음 가중치 × (핵심이면 2) / 묶음 내 가중치 합 / 100
 */
export function attributeOvrWeight(pos: FieldPosition, attr: FieldAttribute): number {
  const { weights, keys } = profileOf(pos);
  for (const g of GROUP_NAMES) {
    const attrs = ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[];
    if (!attrs.includes(attr)) continue;
    const total = attrs.reduce((t, a) => t + (keys.includes(a) ? 2 : 1), 0);
    return (weights[g] * (keys.includes(attr) ? 2 : 1)) / total / 100;
  }
  return 0;
}

/** 포지션별 OVR 계산 구조 캐시 (묶음마다 능력치와 배수). 계산 순서는 그대로라 결과가 같다 */
type OvrPlan = { weight: number; attrs: FieldAttribute[]; ks: number[] }[];
const OVR_PLANS = new Map<FieldPosition, OvrPlan>();
function ovrPlan(pos: FieldPosition): OvrPlan {
  let plan = OVR_PLANS.get(pos);
  if (!plan) {
    const { weights, keys } = profileOf(pos);
    plan = GROUP_NAMES.filter((g) => weights[g] !== 0).map((g) => {
      const attrs = [...(ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[])];
      return { weight: weights[g], attrs, ks: attrs.map((a) => (keys.includes(a) ? 2 : 1)) };
    });
    OVR_PLANS.set(pos, plan);
  }
  return plan;
}

/** 포지션 OVR (소수). 화면 표시는 positionOvr 사용 */
export function positionOvrExact(attrs: FieldAttributes, pos: FieldPosition): number {
  let ovr = 0;
  for (const { weight, attrs: as, ks } of ovrPlan(pos)) {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < as.length; i++) {
      const k = ks[i]!;
      sum += attrs[as[i]!] * k;
      n += k;
    }
    ovr += ((sum / n) * weight) / 100;
  }
  return ovr;
}

export function positionOvr(attrs: FieldAttributes, pos: FieldPosition): number {
  return Math.round(positionOvrExact(attrs, pos));
}

export function allPositionOvrs(attrs: FieldAttributes): Record<PlayablePosition, number> {
  const out = {} as Record<PlayablePosition, number>;
  for (const p of PLAYABLE_POSITIONS) out[p] = positionOvr(attrs, p);
  return out;
}
