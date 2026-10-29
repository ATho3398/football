// 포메이션 8종과 슬롯 기본 위치 (부록 E.5), 커스텀 포메이션의 보이지 않는 5 × 6 격자 (E.5.1, E3.7).
// 정규화 좌표: x 0 자기 골 → 1 상대 골, y 0 왼쪽 → 1 오른쪽 (공격 방향 기준)

import type { Position } from './types';

export const FORMATIONS = ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-3-1-2', '4-1-4-1', '3-4-3'] as const;
export type Formation = (typeof FORMATIONS)[number];

/** 줄 (0 GK, 1 수비, 2 중원, 3 공격). 엔진 Line 과 같은 값 */
export type SlotLine = 0 | 1 | 2 | 3;

export interface FormationSlot {
  pos: Position;
  x: number;
  y: number;
  /** 줄 소속 (커스텀 칸만, 없으면 포지션으로 정한다, E.5.1) */
  line?: SlotLine;
}

const s = (pos: Position, x: number, y: number): FormationSlot => ({ pos, x, y });
const GK = s('GK', 0.04, 0.5);
const BACK4 = [s('LB', 0.22, 0.12), s('CB', 0.2, 0.36), s('CB', 0.2, 0.64), s('RB', 0.22, 0.88)];
const BACK3 = [s('CB', 0.2, 0.25), s('CB', 0.18, 0.5), s('CB', 0.2, 0.75)];
const TWO_ST = [s('ST', 0.68, 0.38), s('ST', 0.68, 0.62)];

export const FORMATION_SLOTS: Record<Formation, readonly FormationSlot[]> = {
  '4-4-2': [GK, ...BACK4, s('LM', 0.45, 0.1), s('CM', 0.42, 0.38), s('CM', 0.42, 0.62), s('RM', 0.45, 0.9), ...TWO_ST],
  '4-3-3': [GK, ...BACK4, s('CDM', 0.36, 0.5), s('CM', 0.46, 0.3), s('CM', 0.46, 0.7), s('LW', 0.7, 0.15), s('ST', 0.74, 0.5), s('RW', 0.7, 0.85)],
  '4-2-3-1': [GK, ...BACK4, s('CDM', 0.36, 0.38), s('CDM', 0.36, 0.62), s('LW', 0.58, 0.15), s('CAM', 0.58, 0.5), s('RW', 0.58, 0.85), s('ST', 0.76, 0.5)],
  '3-5-2': [
    GK, ...BACK3,
    s('LWB', 0.44, 0.08), s('CM', 0.42, 0.32), s('CDM', 0.36, 0.5), s('CM', 0.42, 0.68), s('RWB', 0.44, 0.92), ...TWO_ST,
  ],
  '5-3-2': [
    GK, s('LWB', 0.3, 0.08), s('CB', 0.2, 0.28), s('CB', 0.18, 0.5), s('CB', 0.2, 0.72), s('RWB', 0.3, 0.92),
    s('CM', 0.44, 0.3), s('CDM', 0.4, 0.5), s('CM', 0.44, 0.7), ...TWO_ST,
  ],
  // E3.7 추가 3종 (E.5 D.13)
  '4-3-1-2': [GK, ...BACK4, s('CDM', 0.36, 0.5), s('CM', 0.44, 0.28), s('CM', 0.44, 0.72), s('CAM', 0.58, 0.5), s('ST', 0.7, 0.38), s('ST', 0.7, 0.62)],
  '4-1-4-1': [GK, ...BACK4, s('CDM', 0.34, 0.5), s('LM', 0.48, 0.12), s('CM', 0.48, 0.36), s('CM', 0.48, 0.64), s('RM', 0.48, 0.88), s('ST', 0.72, 0.5)],
  '3-4-3': [
    GK, ...BACK3,
    s('LWB', 0.42, 0.08), s('CM', 0.42, 0.38), s('CM', 0.42, 0.62), s('RWB', 0.42, 0.92), s('LW', 0.68, 0.18), s('ST', 0.74, 0.5), s('RW', 0.68, 0.82),
  ],
};

// ── 커스텀 포메이션 (E.5.1): 보이지 않는 5 × 6 격자. 칸 = 줄 × 5 + 레인 ──

/** 줄 이름: 수비, 수비형 미드, 중앙 미드, 공격형 미드, 2선 공격, 최전방 */
export const GRID_ROWS = 6;
export const GRID_LANES = 5;
export const ROW_X = [0.2, 0.34, 0.44, 0.56, 0.64, 0.72] as const;
export const LANE_Y = [0.1, 0.3, 0.5, 0.7, 0.9] as const;
/** 수비 줄 측면 칸 x */
const DEF_WIDE_X = 0.22;
/** 커스텀 포메이션: 슬롯 11개의 칸 (GK 슬롯은 -1) */
export type CustomCells = number[];

const rowOf = (cell: number) => Math.floor(cell / GRID_LANES);
const laneOf = (cell: number) => cell % GRID_LANES;
const wideLane = (lane: number) => lane === 0 || lane === GRID_LANES - 1;

/** 칸이 있는가 (최전방 측면 칸은 없다) */
export function cellExists(cell: number): boolean {
  if (!Number.isInteger(cell) || cell < 0 || cell >= GRID_ROWS * GRID_LANES) return false;
  return !(rowOf(cell) === GRID_ROWS - 1 && wideLane(laneOf(cell)));
}

/** 칸의 포지션 (E.5.1 표) */
export function cellPos(cell: number): Position {
  const row = rowOf(cell);
  const lane = laneOf(cell);
  const left = lane === 0;
  const wide = wideLane(lane);
  switch (row) {
    case 0: return wide ? (left ? 'LB' : 'RB') : 'CB';
    case 1: return wide ? (left ? 'LWB' : 'RWB') : 'CDM';
    case 2: return wide ? (left ? 'LM' : 'RM') : 'CM';
    case 3: return wide ? (left ? 'LW' : 'RW') : 'CAM';
    case 4: return wide ? (left ? 'LW' : 'RW') : 'CF';
    default: return 'ST';
  }
}

/** 칸의 줄 소속: 수비 줄 = 수비, 수비형·중앙·공격형 미드 = 중원, 2선 공격·최전방 = 공격 */
export function cellLine(cell: number): SlotLine {
  const row = rowOf(cell);
  return row === 0 ? 1 : row <= 3 ? 2 : 3;
}

export function cellSlot(cell: number): FormationSlot {
  const row = rowOf(cell);
  const lane = laneOf(cell);
  return { pos: cellPos(cell), x: row === 0 && wideLane(lane) ? DEF_WIDE_X : ROW_X[row]!, y: LANE_Y[lane]!, line: cellLine(cell) };
}

/** 정규화 위치에서 가장 가까운 칸 (taken 칸은 건너뛴다) */
export function nearestCell(x: number, y: number, taken: ReadonlySet<number> = new Set(), prefer?: Position): number {
  let best = -1;
  let bd = Infinity;
  for (let c = 0; c < GRID_ROWS * GRID_LANES; c++) {
    if (!cellExists(c) || taken.has(c)) continue;
    const sl = cellSlot(c);
    // 세로(줄)는 간격이 좁으므로 가로와 같은 눈금으로 비교한다 (코트 105 × 68)
    // prefer: 거리가 같으면 같은 포지션 칸 (프리셋 ST 가 CF 칸으로 가지 않게)
    const d = ((sl.x - x) * 105) ** 2 + ((sl.y - y) * 68) ** 2 - (prefer && sl.pos === prefer ? 20 : 0);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

/**
 * 배치 규칙 위반 사유 (없으면 null): GK 고정, 한 칸에 1명, 수비 줄 3명 이상(수비형 미드 측면 윙백 포함), 중원·공격 줄 각 1명 이상,
 * 공격 줄(2선 공격·최전방) 최대 ATTACK_MAX 명 (C.34 임시 규칙: 공격 몰빵 대형이 엔진에서 과하게 강한 미해결 5번 대응)
 */
export const ATTACK_MAX = 4;

export function customProblem(cells: readonly number[]): string | null {
  if (cells.length !== 11 || cells[0] !== -1) return '골키퍼는 고정이에요.';
  const field = cells.slice(1);
  if (!field.every(cellExists)) return '놓을 수 없는 칸이 있어요.';
  if (new Set(field).size !== field.length) return '한 칸에는 한 명만 설 수 있어요.';
  const def = field.filter((c) => rowOf(c) === 0 || (rowOf(c) === 1 && wideLane(laneOf(c)))).length;
  const mid = field.filter((c) => cellLine(c) === 2 && !(rowOf(c) === 1 && wideLane(laneOf(c)))).length;
  const att = field.filter((c) => cellLine(c) === 3).length;
  if (def < 3) return '수비 줄에 3명 이상 있어야 해요.';
  if (mid < 1) return '중원 줄에 1명 이상 있어야 해요.';
  if (att < 1) return '공격 줄에 1명 이상 있어야 해요.';
  if (att > ATTACK_MAX) return `공격 줄은 ${ATTACK_MAX}명까지예요 (임시 규칙).`;
  return null;
}

export function customSlots(cells: readonly number[]): FormationSlot[] {
  return cells.map((c, i) => (i === 0 || c < 0 ? GK : cellSlot(c)));
}

/** 프리셋을 격자 칸으로 옮긴다 (편집 시작점). 슬롯 순서를 유지하고, 같은 칸이면 다음으로 가까운 칸 */
export function presetCells(f: Formation): CustomCells {
  const taken = new Set<number>();
  return FORMATION_SLOTS[f].map((sl, i) => {
    if (i === 0) return -1;
    const c = nearestCell(sl.x, sl.y, taken, sl.pos);
    taken.add(c);
    return c;
  });
}

/** 슬롯 목록: 커스텀이면 그 칸들, 아니면 프리셋 */
export function slotsOf(formation: Formation, custom?: readonly number[] | null): readonly FormationSlot[] {
  return custom ? customSlots(custom) : FORMATION_SLOTS[formation];
}

/** 커스텀 대형 이름: 수비-중원-공격 줄 인원 (예 3-4-3). 중원은 수비형·중앙·공격형 미드로 나눠 센다 (예 4-2-3-1) */
export function customLabel(cells: readonly number[]): string {
  const field = cells.slice(1);
  const count = (f: (c: number) => boolean) => field.filter(f).length;
  const parts = [count((c) => rowOf(c) === 0)];
  for (const r of [1, 2, 3]) {
    const n = count((c) => rowOf(c) === r);
    if (n) parts.push(n);
  }
  const att = count((c) => rowOf(c) >= 4);
  if (att) parts.push(att);
  return parts.join('-');
}
