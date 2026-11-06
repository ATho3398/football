// 피치 기하 (E.3): 105 × 68 m, x 0 = 홈 골라인. 전반은 홈이 +x 로 공격

import { ENGINE } from './config';

const P = ENGINE.pitch;
export const L = P.length;
export const W = P.width;

// C.81j 계산 속도: clamp·dist 를 바이트코드 27바이트 아래로 줄여 큰 함수 안에서도 늘 인라인되게 한다 (V8 '작은 함수' 문턱 — 같은 식)
const mMin = Math.min;
const mMax = Math.max;
const mSqrt = Math.sqrt;
export const clamp = (v: number, lo: number, hi: number) => mMin(hi, mMax(lo, v));
const hyp2 = (dx: number, dy: number) => mSqrt(dx * dx + dy * dy);
export const dist = (ax: number, ay: number, bx: number, by: number) => hyp2(ax - bx, ay - by);
/**
 * Math.hypot(x, y) 와 비트까지 같은 값 (C.81j 계산 속도): V8 내장(Torque MathHypot)과 같은 순서 — 큰 값으로 나눈 제곱의 Kahan 합, √ × 큰 값.
 * 무한 > NaN > 0 순서의 특수값도 같다. 내장 함수 호출(실수 인자·결과 상자)이 없어 약 4배 빠르다 (2천만 무작위·특수값 비교 동일)
 */
export function hypot(x: number, y: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (x !== x || y !== y) return ax === Infinity || ay === Infinity ? Infinity : NaN;
  const max = ax > ay ? ax : ay;
  if (max === Infinity) return Infinity;
  if (max === 0) return 0;
  const n0 = ax / max;
  const s0 = n0 * n0;
  const c0 = s0 - s0;
  const n1 = ay / max;
  const sm = n1 * n1 - c0;
  return Math.sqrt(s0 + sm) * max;
}
export const L1 = (x: number) => 1 / (1 + Math.exp(-x));

/** 팀의 공격 방향 (+1: +x 쪽 골 공격) */
export function attackDir(team: 0 | 1, half: 1 | 2): 1 | -1 {
  return (team === 0) === (half === 1) ? 1 : -1;
}

/** 피치 좌표 → 팀 기준 정규화 (x 0 자기 골 → 1 상대 골, y 0 왼쪽 → 1 오른쪽) */
export function toNorm(x: number, y: number, dir: 1 | -1): [number, number] {
  return dir > 0 ? [x / L, y / W] : [1 - x / L, 1 - y / W];
}

/** toNorm 의 x·y 만 (C.81e: 배열을 만들지 않는다 — 같은 식) */
export const normX = (x: number, dir: 1 | -1) => (dir > 0 ? x / L : 1 - x / L);
export const normY = (y: number, dir: 1 | -1) => (dir > 0 ? y / W : 1 - y / W);

/** toPitch 의 x·y 만 (C.81e: 같은 식, 배열 없이) */
export const pitchX = (nx: number, dir: 1 | -1) => (dir > 0 ? nx * L : (1 - nx) * L);
export const pitchY = (ny: number, dir: 1 | -1) => (dir > 0 ? ny * W : (1 - ny) * W);

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
  const d = hypot((1 - clamp(nx, 0, 1)) * L, (clamp(ny, 0, 1) - 0.5) * W);
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

/** segDist 와 같은 식, 배열 없이 (C.81e): 거리를 돌려주고 비율 t 는 SEG.t 에 남긴다 (바로 다음에 읽는다) */
export const SEG = { t: 0 };
export function segDistS(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  const ex = px - (ax + t * dx);
  const ey = py - (ay + t * dy);
  SEG.t = t;
  return Math.sqrt(ex * ex + ey * ey);
}

/** 상대 박스 안인가 */
export function inOppBox(x: number, y: number, dir: 1 | -1): boolean {
  const d = dir > 0 ? L - x : x;
  return d >= 0 && d <= P.boxDepth && Math.abs(y - W / 2) <= P.boxWidth / 2;
}

export function outOfPlay(x: number, y: number): boolean {
  return x < 0 || x > L || y < 0 || y > W;
}

/** 자기 진영 위험 지역 (C.30 기록): 자기 골라인에서 dangerDepth m 안, 박스 폭 안 (박스와 박스 앞) */
export function inOwnDanger(x: number, y: number, dir: 1 | -1): boolean {
  const d = dir > 0 ? x : L - x;
  return d <= ENGINE.record.dangerDepth && Math.abs(y - W / 2) <= P.boxWidth / 2;
}
