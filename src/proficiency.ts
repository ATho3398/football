// 포지션 전환 (4.3, 부록 D.3): 포지션별 숙련도(0~100), 거리 기반 초기값·상승, OVR 페널티, 비시즌 주 포지션 변경 요청

import { consumeGainMult } from './aptitude';
import { BALANCE } from './config/balance';
import { PLAYABLE_POSITIONS, positionOvr, type FieldPosition, type PlayablePosition } from './positions';
import type { PlayerState, Position } from './types';

const P = BALANCE.proficiency;

/** 숙련도를 따지는 포지션 (LWB/RWB 는 LB/RB 로 본다) */
export function profKey(pos: Position): PlayablePosition | null {
  if (pos === 'GK') return null;
  if (pos === 'LWB') return 'LB';
  if (pos === 'RWB') return 'RB';
  return pos as PlayablePosition;
}

/** 두 포지션 사이 거리 (인접 관계 그래프의 최단 걸음 수) */
export function positionDistance(a: Position, b: Position): number {
  const from = profKey(a);
  const to = profKey(b);
  if (!from || !to) return Infinity;
  if (from === to) return 0;
  const adj = new Map<string, string[]>();
  for (const [x, y] of P.edges) {
    adj.set(x, [...(adj.get(x) ?? []), y]);
    adj.set(y, [...(adj.get(y) ?? []), x]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from as string];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(cur)! + 1);
      if (n === to) return dist.get(n)!;
      queue.push(n);
    }
  }
  return Infinity;
}

export type Proficiency = Record<PlayablePosition, number>;

/** 초기 숙련도: 주 포지션 100, 서브 포지션 70, 그 외는 거리 기준 */
export function initialProficiency(main: FieldPosition, subs: readonly Position[] = []): Proficiency {
  const out = {} as Proficiency;
  const subKeys = subs.map(profKey).filter((x): x is PlayablePosition => x !== null);
  for (const pos of PLAYABLE_POSITIONS) {
    const d = positionDistance(main, pos);
    let v: number = P.initialByDistance[Math.min(d, P.initialByDistance.length - 1)]!;
    if (subKeys.includes(pos)) v = Math.max(v, P.subPosition);
    out[pos] = v;
  }
  return out;
}

/** 숙련도 (기록이 없으면 100: NPC, 이전 세이브 변환 전) */
export function proficiencyOf(p: { proficiency?: Proficiency }, pos: Position): number {
  const k = profKey(pos);
  if (!k || !p.proficiency) return 100;
  return p.proficiency[k] ?? 100;
}

/** 포지션 OVR 페널티 = (100 − 숙련도) × 0.25 */
export function proficiencyPenalty(prof: number): number {
  return (100 - Math.min(100, Math.max(0, prof))) * P.penaltyPerPoint;
}

/** 숙련도를 반영한 포지션 OVR (D.3: 변경 후에는 새 포지션의 OVR 로 선발 판정과 평점을 계산) */
export function proficientOvr(p: Pick<PlayerState, 'attributes'> & { proficiency?: Proficiency }, pos: FieldPosition): number {
  return Math.round(positionOvr(p.attributes, pos) - proficiencyPenalty(proficiencyOf(p, pos)));
}

/**
 * 출전 후 숙련도 상승: (이전 주 포지션에서의 거리 1 → 4, 2 → 2, 3 이상 → 1) × 출전 비율. 최대 100.
 * 전술에서 주 포지션 밖 슬롯(played)으로 뛰면 그 포지션이 주 포지션에서의 거리만큼 오른다 (E.19 ②, 포지션 전환 진행).
 * 상승량에 숨은 포지션군 적성 배수(0.7~1.6)와 조언 뒤 포변 보너스(×2)를 곱한다 (부록 C.37)
 */
export function gainProficiency(p: PlayerState, minutes: number, played: Position = p.position): void {
  const k = profKey(played);
  if (!k || !p.proficiency || minutes <= 0) return;
  // 숨은 적성 배수와 조언 뒤 포변 보너스 (부록 C.37). 보너스 경기 수는 숙련도가 100이어도 줄어든다
  const mult = consumeGainMult(p, played);
  const cur = p.proficiency[k];
  if (cur >= 100) return;
  const from = profKey(played) === profKey(p.position) ? p.formerPosition : p.position;
  const d = from ? positionDistance(from, played) : 1;
  const per = P.gainByDistance[Math.min(Math.max(d, 1), P.gainByDistance.length) - 1]! * mult;
  p.proficiency[k] = Math.min(100, Math.round((cur + per * Math.min(1, minutes / 90)) * 100) / 100);
}

/** 시즌 종료: 이전 주 포지션 숙련도는 시즌마다 2씩 감소, 최소 30 */
export function decayFormerPosition(p: PlayerState): void {
  if (!p.proficiency) return;
  const main = profKey(p.position);
  const keys = new Set((p.formerPositions ?? (p.formerPosition ? [p.formerPosition] : [])).map(profKey));
  for (const k of keys) {
    if (!k || k === main) continue;
    const cur = p.proficiency[k];
    if (cur > P.formerMin) p.proficiency[k] = Math.max(P.formerMin, cur - P.formerDecay);
  }
}

/**
 * "주 포지션 변경 요청" (D.3): 항상 허용, 비용은 숙련도 페널티뿐. 비시즌에만 되고,
 * 포변 조언이 살아 있는 동안은 시즌 중에도 된다 (allowed = 비시즌 또는 조언 기간, 부록 C.37)
 */
export function requestPositionChange(p: PlayerState, to: PlayablePosition, allowed: boolean): boolean {
  if (!allowed || to === p.position) return false;
  p.formerPosition = p.position;
  p.formerPositions = [...(p.formerPositions ?? []).filter((f) => f !== p.position && f !== to), p.position];
  p.position = to;
  return true;
}
