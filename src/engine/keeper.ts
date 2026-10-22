// 골키퍼 (E.9): 세이브, 캐치/쳐내기, 크로스 처리

import type { GkAttributes } from '../attributes';
import { BALANCE } from '../config/balance';
import { ENGINE } from './config';
import { attackDir, clamp, dist, L1, ownGoal, segDist } from './pitch';
import type { Agent, SimState } from './state';

const K = ENGINE.keeper;

/** 팀의 현재 GK (없으면 GK 를 맡은 필드 선수, 그것도 없으면 null) */
export function keeperOf(s: SimState, team: 0 | 1): Agent | null {
  return s.agents.find((a) => a.onPitch && a.team === team && a.line === 0) ?? null;
}

/** GK 능력치. 필드 선수가 GK 를 보면 낮은 고정값 (E.10) */
export function gkAttrs(a: Agent | null): GkAttributes {
  return a?.gk?.attrs ?? BALANCE.goalkeeper.fieldPlayerAsGk;
}

/** 세이브 난이도 δ (E.9). C.76a: 헤더가 아니면 근거리 항 closeW × max(0, 1 − d/closeRef) 를 더한다 (closeRef m 안 1대1 만 막기 어렵게) */
export function saveDifficulty(speed: number, corner: number, d: number, header = false): number {
  const close = header ? 0 : K.closeW * Math.max(0, 1 - d / K.closeRef);
  return K.speedW * (speed / 30) + K.cornerW * corner + K.distW * (1 - clamp(d / K.distRef, 0, 1)) + close;
}

export function saveProb(gk: Agent | null, speed: number, corner: number, d: number, header = false, base: number = K.saveBase): number {
  const g = gkAttrs(gk);
  // GK 리치 (C.45): 키 보정
  return clamp(base - K.saveDelta * saveDifficulty(speed, corner, d, header) + (K.saveSkill * (g.shotStopping - K.saveCenter)) / 100 + (gk?.body.gkSave ?? 0), 0.05, 0.95);
}

/** GK 반대편 구석 (C.77t): GK 가 골 가운데 gy 에서 farSideMin m 넘게 비켜 있으면 반대쪽(±1), 아니면 null (무작위) */
export function farSide(gk: Agent | null, gy: number): -1 | 1 | null {
  if (!gk || Math.abs(gk.y - gy) <= K.farSideMin) return null;
  return gk.y < gy ? 1 : -1;
}

/** GK 도달 항 cover 0~1 (C.77t): (kx, ky) GK, (fx, fy) → (tx, ty) 슛 선, 선방 능력치 stop. 선방 확률에 곱한다 */
export function keeperCover(kx: number, ky: number, fx: number, fy: number, tx: number, ty: number, speed: number, stop: number, lead = 0): number {
  const [e] = segDist(kx, ky, fx, fy, tx, ty);
  const tb = Math.max(0, dist(kx, ky, fx, fy) / Math.max(1, speed) - K.reactTime);
  // lead: 슛까지 남은 시간(초, 판단용 — 패스가 가는 동안 GK 가 자리를 옮긴다)
  const reach = K.reachBase + K.diveSpeed * tb * (stop / 80) + K.setSpeed * lead;
  return clamp(1 - (e - reach) / K.reachSpan, 0, 1);
}

/** GK 가 이 슛 선을 덮는 정도 (실제 판정용): GK 가 없으면 1 */
export function shotCover(gk: Agent | null, fx: number, fy: number, tx: number, ty: number, speed: number, header = false): number {
  const c = gk ? keeperCover(gk.x, gk.y, fx, fy, tx, ty, speed, gkAttrs(gk).shotStopping) : 1;
  return header ? Math.max(K.headerCoverMin, c) : c;
}

export function catchProb(gk: Agent | null): number {
  return clamp(K.catchBase + (K.catchSkill * gkAttrs(gk).handling) / 100, 0, 1);
}

/** 크로스/롱볼을 GK 가 처리할 확률 */
export function claimProb(gk: Agent | null): number {
  return clamp(L1((gkAttrs(gk).commandOfArea - 60) / 12 + K.claimBias) + (gk?.body.gkClaim ?? 0), 0, 1);
}

/** 스위퍼의 박스 밖 처리 범위 (m, C.28): 출전 범위·가속에 비례. 클래식은 0 */
export function sweepRange(gk: Agent): number {
  if (gk.gk?.type !== 'sweeper') return 0;
  const k = clamp((0.7 * (gkAttrs(gk).commandOfArea - 50) + 0.3 * (gk.attrs.acceleration - 50)) / 40, 0, 1);
  return K.sweepRange[0] + (K.sweepRange[1] - K.sweepRange[0]) * k;
}

/** (x, y)가 GK 의 처리 구역인가 (C.28): 자기 박스 안, 스위퍼는 박스 밖 sweepRange m 까지 */
export function keeperZone(s: SimState, gk: Agent, x: number, y: number, range = sweepRange(gk)): boolean {
  const [gx, gy] = ownGoal(attackDir(gk.team, s.half));
  const P = ENGINE.pitch;
  const dx = Math.max(0, Math.abs(x - gx) - P.boxDepth);
  const dy = Math.max(0, Math.abs(y - gy) - P.boxWidth / 2);
  return dx * dx + dy * dy <= range * range;
}
