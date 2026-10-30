// 전술 적합도 보너스 (C.80e, 미해결 4 "직선 선수빨"): 성향별 핵심 능력치 묶음이 선수단 평소 수준보다 리그 보통보다 높은 만큼
// 그 성향의 핵심 실행에 소폭 보너스(낮으면 감점). 보너스는 능력치 점수로 그 실행 식의 능력치에 더하므로 판단(평균 선수 혼합 포함)과 실행이 같은 값을 본다.
// 차이 = 선수마다 (그 포지션군 핵심 능력치 평균 − 그 선수 전체 필드 능력치 평균) 의 선발 필드 선수 평균 − 리그 보통 차이(base).
// 팀 수준(OVR)은 이미 능력치로 반영되므로 자기 평균을 빼서 중심화한다 — 보통 선수단이면 0(일반 팀·상성 표 그대로).
import { FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../attributes';
import type { Position } from '../types';
import * as config_ from './config';
import type { SimState } from './state';
import type { Tendency } from './types';

const { ENGINE } = config_;

export type FitTendency = 'direct' | 'tikitaka' | 'counter' | 'gegenpress';
export const FIT_TENDENCIES: FitTendency[] = ['direct', 'tikitaka', 'counter', 'gegenpress'];
export type FitKind = 'long' | 'air' | 'touch' | 'short' | 'keep' | 'run' | 'tackle';
type Group = 'CB' | 'FB' | 'MID' | 'WING' | 'ST';

function groupOf(pos: Position): Group | null {
  switch (pos) {
    case 'GK': return null;
    case 'CB': return 'CB';
    case 'LB': case 'RB': case 'LWB': case 'RWB': return 'FB';
    case 'CDM': case 'CM': return 'MID';
    case 'ST': case 'CF': return 'ST';
    default: return 'WING';
  }
}

/** 성향별 핵심 능력치 (사용자 설계 pending 146, C.80e 지시): 직선 = 뒤·3선 롱패스·시야 / 받는 쪽 퍼스트 터치·근력·점프·헤딩 */
const SEND: FieldAttribute[] = ['longPassing', 'vision'];
const RECV: FieldAttribute[] = ['ballControl', 'strength', 'jumping', 'heading'];
const all = (k: FieldAttribute[]): Record<Group, FieldAttribute[]> => ({ CB: k, FB: k, MID: k, WING: k, ST: k });
export const FIT_CORE: Record<FitTendency, Record<Group, FieldAttribute[]>> = {
  direct: { CB: SEND, FB: SEND, MID: SEND, WING: RECV, ST: RECV },
  tikitaka: all(['shortPassing', 'vision', 'ballControl', 'composure']),
  counter: all(['pace', 'acceleration', 'dribbling', 'shooting']),
  gegenpress: all(['stamina', 'workRate', 'tackling']),
};

/** 한 선수의 (핵심 능력치 평균 − 전체 필드 능력치 평균), 리그 보통 빼기 전 */
export function rawGap(attrs: FieldAttributes, pos: Position, t: FitTendency): number | null {
  const g = groupOf(pos);
  if (!g) return null;
  const core = FIT_CORE[t][g];
  const mean = FIELD_ATTRIBUTES.reduce((s, k) => s + attrs[k], 0) / FIELD_ATTRIBUTES.length;
  return core.reduce((s, k) => s + attrs[k], 0) / core.length - mean;
}

/** 선발 필드 선수(원래 능력치)의 성향별 (핵심 차이 − 그 포지션 리그 보통 차이) 평균 (능력치 점수) */
export function fitGaps(players: { attrs: FieldAttributes; pos: Position }[]): Record<FitTendency, number> {
  const out = {} as Record<FitTendency, number>;
  for (const t of FIT_TENDENCIES) {
    let sum = 0;
    let n = 0;
    for (const p of players) {
      const g = rawGap(p.attrs, p.pos, t);
      if (g === null) continue;
      sum += g - ((ENGINE.tacticFit.base[t] as Partial<Record<Position, number>>)[p.pos] ?? 0);
      n++;
    }
    out[t] = n ? sum / n : 0;
  }
  return out;
}

/** 이 선수 팀의 지금 성향이 그 실행의 주인이면 능력치 보너스(점수, ±cap). 아니면 0 */
export function fitPts(s: SimState, team: 0 | 1, kind: FitKind): number {
  const F = ENGINE.tacticFit;
  if (!F.on) return 0;
  const tm = s.teams[team];
  const tend = tm.tactics.tendency as Tendency;
  const g = (F.gain as Record<string, Partial<Record<FitKind, number>>>)[tend]?.[kind];
  if (!g) return 0;
  const gap = tm.fit[tend as FitTendency] ?? 0;
  return Math.max(-F.cap, Math.min(F.cap, g * gap));
}
