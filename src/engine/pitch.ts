// 피치 기하 (E.3): 105 × 68 m, x 0 = 홈 골라인. 전반은 홈이 +x 로 공격

import { ENGINE } from './config';

const P = ENGINE.pitch;
export const L = P.length;
export const W = P.width;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dist = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
};
export const L1 = (x: number) => 1 / (1 + Math.exp(-x));

/** 팀의 공격 방향 (+1: +x 쪽 골 공격) */
export function attackDir(team: 0 | 1, half: 1 | 2): 1 | -1 {
  return (team === 0) === (half === 1) ? 1 : -1;
}

/** 피치 좌표 → 팀 기준 정규화 (x 0 자기 골 → 1 상대 골, y 0 왼쪽 → 1 오른쪽) */
export function toNorm(x: number, y: number, dir: 1 | -1): [number, number] {
  return dir > 0 ? [x / L, y / W] : [1 - x / L, 1 - y / W];
}

export function toPitch(nx: number, ny: number, dir: 1 | -1): [number, number] {
  return dir > 0 ? [nx * L, ny * W] : [(1 - nx) * L, (1 - ny) * W];
}

/** 상대 골 중앙 */
export function oppGoal(dir: 1 | -1): [number, number] {
  return [dir > 0 ? L : 0, W / 2];
}

export function ownGoal(dir: 1 | -1): [number, number] {
  return [dir > 0 ? 0 : L, W / 2];
}

/** 위치 가치 맵 (E.7). nx, ny 는 공격 방향 정규화 */
export function positionValue(nx: number, ny: number): number {
  const O = ENGINE.onball;
  const d = Math.hypot((1 - clamp(nx, 0, 1)) * L, (clamp(ny, 0, 1) - 0.5) * W);
  return O.valueScale * (O.valueFarC * Math.exp(-d / O.valueFarK) + O.valueNearB * Math.exp(-d / O.valueNearK));
}

/** 점 (px, py) 에서 선분 (ax, ay)-(bx, by) 까지 거리와 선분 위 위치 비율 t */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): [number, number] {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  return [Math.sqrt(ex * ex + ey * ey), t];
}

/** 상대 박스 안인가 */
export function inOppBox(x: number, y: number, dir: 1 | -1): boolean {
  const d = dir > 0 ? L - x : x;
  return d >= 0 && d <= P.boxDepth && Math.abs(y - W / 2) <= P.boxWidth / 2;
}

export function outOfPlay(x: number, y: number): boolean {
  return x < 0 || x > L || y < 0 || y > W;
}
