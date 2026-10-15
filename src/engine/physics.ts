// 선수 이동 (E.4): 목표 지점까지 거리와 긴급도로 이동 강도를 정하고 가속도/방향 전환/스태미나를 반영

import { ENGINE } from './config';
import { clamp, L, W } from './pitch';
import type { Agent } from './state';

const P = ENGINE.physics;

export function initPhysics(a: Agent): void {
  const t = a.attrs;
  a.maxSpeed = P.maxSpeedBase + (P.maxSpeedSlope * t.pace) / 100;
  a.accel = P.accelBase + (P.accelSlope * t.acceleration) / 100;
  a.turnKeep = P.turnKeepBase + (P.turnKeepSlope * t.agility) / 100;
}

/** 스태미나에 따른 유효 최대 속도 */
export function effectiveMax(a: Agent): number {
  if (a.stamina >= P.staminaLowFrom) return a.maxSpeed;
  return a.maxSpeed * (0.85 + (0.15 * a.stamina) / P.staminaLowFrom);
}

/** 목표 속도: 거리별 걷기/조깅/러닝, 긴급하면 최대 속도. 목표 근처에서는 감속 */
function desiredSpeed(a: Agent, d: number, cap: number): number {
  if (d < P.arriveDist) return 0;
  let v: number;
  if (a.urgent) v = d < P.walkDist ? P.jog : cap;
  else if (d < P.walkDist) v = P.walk;
  else if (d < P.jogDist) v = P.jog;
  else if (d < P.runDist) v = P.run;
  else v = Math.max(P.run, cap * 0.9);
  // 복귀 (E.18 A3): 러닝 이상
  if (a.minRun && d >= P.walkDist) v = Math.max(v, P.run);
  // 지치면 조깅·러닝 강도가 떨어진다 (스태미나 staminaLowFrom 아래에서, 0 이면 1 − fatigueIntensity)
  if (v > P.walk && a.stamina < P.staminaLowFrom) v *= 1 - (P.fatigueIntensity * (P.staminaLowFrom - a.stamina)) / P.staminaLowFrom;
  // 멈출 수 있는 속도
  v = Math.min(v, Math.sqrt(2 * a.accel * d), cap);
  return v;
}

/** dt 동안 이동. speedScale 은 공 몰고 갈 때 등 */
export function moveAgent(a: Agent, dt: number, speedScale = 1, drainScale = 1): void {
  const dx = a.tx - a.x;
  const dy = a.ty - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const cap = effectiveMax(a) * speedScale;
  const want = desiredSpeed(a, d, cap);
  let wx = 0;
  let wy = 0;
  if (want > 0 && d > 1e-6) {
    wx = (dx / d) * want;
    wy = (dy / d) * want;
  }
  const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
  // 큰 방향 전환은 속도 유지율만큼만 이어 간다
  if (sp > 1 && want > 0) {
    const cos = (a.vx * wx + a.vy * wy) / (sp * want);
    if (cos < 0) {
      a.vx *= a.turnKeep;
      a.vy *= a.turnKeep;
    }
  }
  let ax = wx - a.vx;
  let ay = wy - a.vy;
  const am = Math.sqrt(ax * ax + ay * ay);
  const maxDv = (want < sp ? a.accel * 1.5 : a.accel) * dt;
  if (am > maxDv) {
    ax = (ax / am) * maxDv;
    ay = (ay / am) * maxDv;
  }
  a.vx += ax;
  a.vy += ay;
  a.x = clamp(a.x + a.vx * dt, -2, L + 2);
  a.y = clamp(a.y + a.vy * dt, -2, W + 2);

  const v = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
  a.stats.distance += v * dt;
  const sprinting = v > a.maxSpeed * P.sprintRatio;
  if (sprinting && !a.sprinting) a.stats.sprints++;
  a.sprinting = sprinting;
  // 스태미나 (E.4)
  const ratio = v / a.maxSpeed;
  if (v < P.walk * 1.1) a.stamina = Math.min(100, a.stamina + P.staminaRecover * dt * 10);
  else a.stamina = Math.max(0, a.stamina - ratio * ratio * P.staminaDrain * a.drainMul * drainScale * (1.6 - (0.8 * a.attrs.stamina) / 100) * dt * 10);
}
