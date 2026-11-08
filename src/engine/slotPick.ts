// 대표팀 경기 내 자리 고르기 (C.81y): 내 주 포지션과 같은 칸 → 없으면 가장 가까운 칸 (같은 쪽 측면 우선, 중앙은 가까운 줄).
// 엔진 어댑터(buildMyMatch, nearestSlot)와 대표팀 준비 화면 그림(natPreviewLineup)이 같이 쓴다. 클럽 경기는 전술 슬롯 그대로라 안 쓴다

import type { FormationSlot } from '../formations';
import { posGroup } from '../roster';
import type { Position } from '../types';

type Side = -1 | 0 | 1;

/** 포지션 기준 깊이 (x: 0 자기 골 → 1 상대 골, 포메이션 슬롯 좌표와 같은 눈금) */
const DEPTH: Record<Position, number> = {
  GK: 0.04, CB: 0.2, LB: 0.22, RB: 0.22, LWB: 0.38, RWB: 0.38, CDM: 0.36, CM: 0.44, CAM: 0.54,
  LM: 0.46, RM: 0.46, LW: 0.68, RW: 0.68, CF: 0.7, ST: 0.72,
};
const posSide = (p: Position): Side => (p.startsWith('L') ? -1 : p.startsWith('R') ? 1 : 0);
/** 칸의 쪽: 좌표 y 0.25 미만 왼쪽, 0.75 초과 오른쪽, 그 사이 중앙 */
const slotSide = (y: number): Side => (y < 0.25 ? -1 : y > 0.75 ? 1 : 0);

/** 쪽이 다를 때 비용: 측면↔중앙 0.5, 반대쪽 측면 1. 포지션군이 다르면 0.1 */
const SIDE_COST = 0.5;
const GROUP_COST = 0.1;

/** 내 포지션에서 칸까지 거리 (같은 포지션 칸은 0) */
export function slotCost(myPos: Position, slot: FormationSlot): number {
  if (slot.pos === myPos) return 0;
  const sd = Math.abs(posSide(myPos) - slotSide(slot.y)) * SIDE_COST;
  const gp = posGroup(slot.pos) === posGroup(myPos) ? 0 : GROUP_COST;
  return Math.abs(DEPTH[myPos] - slot.x) + sd + gp;
}

/**
 * 선발 명단 중 내가 들어갈 자리: GK 칸을 뺀 칸 중 slotCost 가 가장 작은 칸들, 그중 명단 뒤쪽(OVR 낮은) 선수 칸.
 * 반환 = lineup 인덱스. lineup 은 엔진 선발 순서 (adapter mySlot 과 같은 "뒤가 약한 쪽" 규칙)
 */
export function nearestSlotIndex(lineup: readonly { slot: number; position: Position }[], slots: readonly FormationSlot[], myPos: Position): number {
  let best = Infinity;
  let out = -1;
  for (let i = 0; i < lineup.length; i++) {
    const p = lineup[i]!;
    const s = p.slot >= 0 ? slots[p.slot] : undefined;
    if (!s || s.pos === 'GK' || p.position === 'GK') continue;
    const c = Math.round(slotCost(myPos, s) * 1e6) / 1e6;
    if (c <= best) { best = c; out = i; }
  }
  return out;
}
