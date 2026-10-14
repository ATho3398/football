// 포메이션 5종과 슬롯 기본 위치 (부록 E.5).
// 정규화 좌표: x 0 자기 골 → 1 상대 골, y 0 왼쪽 → 1 오른쪽 (공격 방향 기준)

import type { Position } from './types';

export const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2'] as const;
export type Formation = (typeof FORMATIONS)[number];

export interface FormationSlot {
  pos: Position;
  x: number;
  y: number;
}

const s = (pos: Position, x: number, y: number): FormationSlot => ({ pos, x, y });
const GK = s('GK', 0.04, 0.5);
const BACK4 = [s('LB', 0.22, 0.12), s('CB', 0.2, 0.36), s('CB', 0.2, 0.64), s('RB', 0.22, 0.88)];
const TWO_ST = [s('ST', 0.68, 0.38), s('ST', 0.68, 0.62)];

export const FORMATION_SLOTS: Record<Formation, readonly FormationSlot[]> = {
  '4-4-2': [GK, ...BACK4, s('LM', 0.45, 0.1), s('CM', 0.42, 0.38), s('CM', 0.42, 0.62), s('RM', 0.45, 0.9), ...TWO_ST],
  '4-3-3': [GK, ...BACK4, s('CDM', 0.36, 0.5), s('CM', 0.46, 0.3), s('CM', 0.46, 0.7), s('LW', 0.7, 0.15), s('ST', 0.74, 0.5), s('RW', 0.7, 0.85)],
  '4-2-3-1': [GK, ...BACK4, s('CDM', 0.36, 0.38), s('CDM', 0.36, 0.62), s('LW', 0.58, 0.15), s('CAM', 0.58, 0.5), s('RW', 0.58, 0.85), s('ST', 0.76, 0.5)],
  '3-5-2': [
    GK, s('CB', 0.2, 0.25), s('CB', 0.18, 0.5), s('CB', 0.2, 0.75),
    s('LWB', 0.44, 0.08), s('CM', 0.42, 0.32), s('CDM', 0.36, 0.5), s('CM', 0.42, 0.68), s('RWB', 0.44, 0.92), ...TWO_ST,
  ],
  '5-3-2': [
    GK, s('LWB', 0.3, 0.08), s('CB', 0.2, 0.28), s('CB', 0.18, 0.5), s('CB', 0.2, 0.72), s('RWB', 0.3, 0.92),
    s('CM', 0.44, 0.3), s('CDM', 0.4, 0.5), s('CM', 0.44, 0.7), ...TWO_ST,
  ],
};
