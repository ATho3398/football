// 골키퍼 (E.9): 세이브, 캐치/쳐내기, 크로스 처리

import type { GkAttributes } from '../attributes';
import { BALANCE } from '../config/balance';
import { ENGINE } from './config';
import { attackDir, clamp, L1, ownGoal } from './pitch';
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

/** 세이브 난이도 δ (E.9) */
export function saveDifficulty(speed: number, corner: number, d: number): number {
  return K.speedW * (speed / 30) + K.cornerW * corner + K.distW * (1 - clamp(d / K.distRef, 0, 1));
}

export function saveProb(gk: Agent | null, speed: number, corner: number, d: number, base: number = K.saveBase): number {
  const g = gkAttrs(gk);
  return clamp(base - K.saveDelta * saveDifficulty(speed, corner, d) + (K.saveSkill * (g.shotStopping - K.saveCenter)) / 100, 0.05, 0.95);
}

export function catchProb(gk: Agent | null): number {
  return clamp(K.catchBase + (K.catchSkill * gkAttrs(gk).handling) / 100, 0, 1);
}

/** 크로스/롱볼을 GK 가 처리할 확률 */
export function claimProb(gk: Agent | null): number {
  return L1((gkAttrs(gk).commandOfArea - 60) / 12 + K.claimBias);
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
