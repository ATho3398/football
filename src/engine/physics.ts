// 선수 이동 (E.4): 목표 지점까지 거리와 긴급도로 이동 강도를 정하고 가속도/방향 전환/스태미나를 반영

// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as pitch_ from './pitch';
const { clamp, L, W } = pitch_;
import type { Agent, Flight } from './state';

const P = ENGINE.physics;

export function initPhysics(a: Agent): void {
  const t = a.attrs;
  a.maxSpeed = P.maxSpeedBase + (P.maxSpeedSlope * t.pace) / 100;
  // 몸무게 (C.45): 가속·민첩 소폭 − (BMI 보정, 신체가 없으면 0)
  const q = a.body?.quickness ?? 0;
  a.accel = P.accelBase + (P.accelSlope * (t.acceleration - q)) / 100;
  a.turnKeep = P.turnKeepBase + (P.turnKeepSlope * (t.agility - q)) / 100;
}

/** 지친 비율 (C.76s): 스태미나 staminaLowFrom 아래에서 0 → 1 (스태미나 0). 최고 속도·경합·판단 온도·패스·역압박 가담이 같이 쓴다 */
export function tiredRatio(a: Agent): number {
  if (a.stamina >= P.staminaLowFrom) return 0;
  return 1 - Math.max(0, a.stamina) / P.staminaLowFrom;
}

/** 경합 보정 (C.76s 가설 2): 홈 보정(duelEdge) − tiredDuel × 지친 비율. 드리블·태클·버티기·수신·공중볼 공통 */
export function duelEdgeOf(a: Agent): number {
  return a.duelEdge - P.tiredDuel * tiredRatio(a);
}

const B = P.burst;

/** 순간 체력 상한 (C.78w): 경기 체력 비례 capFloor ~ 100 */
export function burstCap(a: Agent): number {
  return 100 * (B.capFloor + ((1 - B.capFloor) * Math.max(0, Math.min(100, a.stamina))) / 100);
}

/** 판단에 보이는 순간 체력 여유 (C.78w): judgeLo 아래 0 ~ judgeHi 위 1. 2단 체력을 끄면 1 */
export function burstReady(a: Agent): number {
  if (B.on <= 0) return 1;
  return clamp((a.burst - B.judgeLo) / (B.judgeHi - B.judgeLo), 0, 1);
}

/** 순간 체력으로 연속 스프린트할 수 있는 초 (가속·체력 능력치) */
function burstSecs(a: Agent): number {
  return clamp(B.secBase + (B.secSlope * ((a.attrs.acceleration + a.attrs.stamina) / 2 - 70)) / 100, B.secMin, B.secMax);
}

/** 유효 가속 (C.78w): 경기 체력 staminaLowFrom 아래에서 accelFloor 까지 */
export function effectiveAccel(a: Agent): number {
  if (B.on <= 0 || a.stamina >= P.staminaLowFrom) return a.accel;
  return a.accel * (B.accelFloor + ((1 - B.accelFloor) * Math.max(0, a.stamina)) / P.staminaLowFrom);
}

/** 스태미나에 따른 유효 최대 속도. 순간 체력이 lowFrom 아래면 러닝 상한(maxSpeed × runCap) 쪽으로 (C.78w) */
export function effectiveMax(a: Agent): number {
  let v = a.stamina >= P.staminaLowFrom ? a.maxSpeed : a.maxSpeed * (P.tiredMaxFloor + ((1 - P.tiredMaxFloor) * a.stamina) / P.staminaLowFrom);
  if (B.on > 0 && (a.burstOut || a.burst < B.lowFrom)) {
    const lim = a.maxSpeed * B.runCap;
    if (v > lim) v = a.burstOut ? lim : lim + ((v - lim) * Math.max(0, a.burst)) / B.lowFrom;
  }
  return v;
}

/** 목표 속도: 거리별 걷기/조깅/러닝, 긴급하면 최대 속도. 목표 근처에서는 감속 */
function desiredSpeed(a: Agent, d: number, cap: number): number {
  if (d < P.arriveDist) return 0;
  let v: number;
  if (a.urgent) v = d < P.walkDist ? P.jog : cap;
  else if (d < P.walkDist) v = P.walk;
  else if (d < P.jogDist) v = P.jog;
  else if (d < P.runDist) v = P.run;
  else v = Math.max(P.run, cap * P.farPace);
  // 골 뒤 세리머니·걸어서 복귀 (C.24): 긴급하지 않으면 속도 상한
  if (!a.urgent && a.paceCap > 0) v = Math.min(v, a.paceCap);
  // 복귀 (E.18 A3): 러닝 이상
  if (a.minRun && d >= P.walkDist) v = Math.max(v, P.run);
  // 지치면 조깅·러닝 강도가 떨어진다 (스태미나 staminaLowFrom 아래에서, 0 이면 1 − fatigueIntensity)
  if (v > P.walk && a.stamina < P.staminaLowFrom) v *= 1 - (P.fatigueIntensity * (P.staminaLowFrom - a.stamina)) / P.staminaLowFrom;
  // 멈출 수 있는 속도
  v = Math.min(v, Math.sqrt(2 * effectiveAccel(a) * d), cap);
  return v;
}

/** 180° 몸 돌리기 시간 (C.77x): pivotBase − pivotSlope × 민첩(몸무게 보정 뒤, turnKeep 과 같은 값)/100 */
export function pivotTime(a: Agent): number {
  const agi = (a.turnKeep - P.turnKeepBase) / P.turnKeepSlope;
  return Math.max(0.1, P.pivotBase - P.pivotSlope * agi);
}

/** 목표 속도 비우기 (C.77x): 사람을 따라가지 않는 목표를 정하는 곳 */
export function clearFeed(a: Agent): void {
  a.tvx = 0;
  a.tvy = 0;
  a.tvIdx = -1;
}

/** 인지된 목표 속도 (C.77x): 따라가는 사람 o 의 속도(× 섞는 비율)를 feedLag 초 늦게 따라간다. moveAgent 바로 앞에서 */
export function perceiveFeed(a: Agent, o: Agent, dt: number): void {
  if (!o.onPitch) {
    clearFeed(a);
    return;
  }
  const k = P.feedLag > 0 ? Math.min(1, dt / P.feedLag) : 1;
  a.tvx += (o.vx * a.tvwx - a.tvx) * k;
  a.tvy += (o.vy * a.tvwy - a.tvy) * k;
}

/** 몸 방향을 (ux, uy) 쪽으로 180°/pivotTime 각속도만큼 돌린다 */
function turnHead(a: Agent, ux: number, uy: number, dt: number): void {
  const step = (Math.PI / pivotTime(a)) * dt;
  // 같은 몸 방향이면 지난번 atan2 그대로 (같은 입력 같은 값)
  if (a.hx !== a.hMx || a.hy !== a.hMy) {
    a.hMx = a.hx;
    a.hMy = a.hy;
    a.hA = Math.atan2(a.hy, a.hx);
  }
  const cur = a.hA;
  let diff = Math.atan2(uy, ux) - cur;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  const ang = cur + Math.sign(diff || 1) * Math.min(Math.abs(diff), step);
  a.hx = Math.cos(ang);
  a.hy = Math.sin(ang);
}

/** dt 동안 이동. speedScale 은 공 몰고 갈 때 등 */
export function moveAgent(a: Agent, dt: number, speedScale = 1, drainScale = 1, recoverScale = 1, lookX = NaN, lookY = NaN): void {
  const cap = effectiveMax(a) * speedScale;
  const accel = effectiveAccel(a);
  // 앞먹임 (C.77x): 움직이는 목표는 그 속도로 같이 움직이고, 원하는 속도에 목표 속도를 더한다
  const fx = P.feed > 0 ? a.tvx * P.feed : 0;
  const fy = P.feed > 0 ? a.tvy * P.feed : 0;
  const feeding = fx !== 0 || fy !== 0;
  const dx = a.tx - a.x;
  const dy = a.ty - a.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  // 사람을 따라갈 때 거리 보정은 거리 비례(feedGain × 거리)까지 올린다 — 걷기·조깅 단계로만 좁히면 움직이는 목표와의 간격이 닫히지 않는다
  let corr = desiredSpeed(a, d, cap);
  if (feeding && P.feedGain > 0 && d >= P.arriveDist) corr = Math.max(corr, Math.min(P.feedGain * d, Math.sqrt(2 * accel * d), cap));
  let wx = 0;
  let wy = 0;
  if (corr > 0 && d > 1e-6) {
    wx = (dx / d) * corr;
    wy = (dy / d) * corr;
  }
  let want = corr;
  if (feeding) {
    wx += fx;
    wy += fy;
    want = Math.sqrt(wx * wx + wy * wy);
    if (want > cap) {
      wx *= cap / want;
      wy *= cap / want;
      want = cap;
    }
  }
  const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
  let reversing = false;
  if (P.turnModel > 0) {
    // 뒤돌기 (C.77x): 빠르면 몸 방향 = 속도 방향. 반대로 가려면 감속(reverseBrake × 가속 × turnKeep)하며 몸을 돌리고, 서 있다가 뒤로 뛰려면 몸부터 돌린다
    // (180° = pivotTime, 90° 안으로 들 때까지 가속 없음). 걷기 이하 조정(뒷걸음)과 GK 는 몸을 돌리지 않는다
    let ux = 0;
    let uy = 0;
    if (want > 0) {
      ux = wx / want;
      uy = wy / want;
      reversing = sp > P.faceSpeed && a.vx * ux + a.vy * uy < 0;
    }
    if (reversing) turnHead(a, ux, uy, dt);
    else if (sp > P.faceSpeed) {
      a.hx = a.vx / sp;
      a.hy = a.vy / sp;
    } else if (want > P.walk + 1e-9 && a.hx * ux + a.hy * uy < 0 && a.line !== 0) {
      turnHead(a, ux, uy, dt);
      // 도는 동안은 서서 돈다
      wx = 0;
      wy = 0;
      want = 0;
    } else if (want > P.walk + 1e-9) turnHead(a, ux, uy, dt);
    else if (Number.isFinite(lookX)) {
      // 서 있거나 걷는 동안은 공 쪽(lookX, lookY)으로 몸을 돌린다 — 뒤로 뛰려면 다시 돌아야 한다
      const lx = lookX - a.x;
      const ly = lookY - a.y;
      const ld = Math.sqrt(lx * lx + ly * ly);
      if (ld > 1) turnHead(a, lx / ld, ly / ld, dt);
    }
    // (느리게 뛰기 시작할 때도 몸은 갈 쪽으로 돌아간다 — 뒷걸음(걷기 이하)은 몸 방향 그대로)
  } else if (sp > 1 && want > 0) {
    // 큰 방향 전환은 속도 유지율만큼만 이어 간다 (옛 동작)
    const cos = (a.vx * wx + a.vy * wy) / (sp * want);
    if (cos < 0) {
      a.vx *= a.turnKeep;
      a.vy *= a.turnKeep;
    }
  }
  let ax = wx - a.vx;
  let ay = wy - a.vy;
  const am = Math.sqrt(ax * ax + ay * ay);
  // 감속: 옛 동작 가속 × 1.5, 뒤돌기 모델이면 멈추든 돌든 가속 × reverseBrake × turnKeep (민첩할수록 세게 선다)
  const brake = P.turnModel > 0 ? P.reverseBrake * a.turnKeep : 1.5;
  const maxDv = (reversing || want < sp ? accel * brake : accel) * dt;
  if (am > maxDv) {
    ax = (ax / am) * maxDv;
    ay = (ay / am) * maxDv;
  }
  a.vx += ax;
  a.vy += ay;
  a.x = clamp(a.x + a.vx * dt, -2, L + 2);
  a.y = clamp(a.y + a.vy * dt, -2, W + 2);
  // 목표 점도 같은 틱에 목표 속도로 움직인다
  if (feeding) {
    a.tx = clamp(a.tx + fx * dt, 0.3, L - 0.3);
    a.ty = clamp(a.ty + fy * dt, 0.3, W - 0.3);
  }

  const v = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
  a.stats.distance += v * dt;
  const sprinting = v > a.maxSpeed * P.sprintRatio;
  if (sprinting && !a.sprinting) a.stats.sprints++;
  a.sprinting = sprinting;
  // 순간 체력 (C.78w): 스프린트 중 소모, 러닝 상한 아래면 걷기·조깅·러닝 순으로 빠르게 다시 찬다 (상한·재충전은 경기 체력 비례)
  if (B.on > 0) {
    // 러닝 상한(runCap)과 스프린트 판정 사이는 그 비율만큼 소모 (바닥 직전 판정 속도 바로 아래에서 버티지 않게)
    const lim = a.maxSpeed * B.runCap;
    const hi = a.maxSpeed * P.sprintRatio;
    if (v > lim + 1e-9) {
      a.burst = Math.max(0, a.burst - (100 / burstSecs(a)) * (sprinting ? 1 : (v - lim) / (hi - lim)) * dt);
      if (a.burst <= 0) a.burstOut = true;
    } else {
      const top = burstCap(a);
      if (a.burst < top) {
        const mul = v < P.walk * 1.1 ? B.walkMul : v < P.jog * 1.1 ? B.jogMul : B.runMul;
        const st = B.refillFloor + ((1 - B.refillFloor) * Math.max(0, Math.min(100, a.stamina))) / 100;
        a.burst = Math.min(top, a.burst + (100 / B.refillSec) * mul * st * recoverScale * dt);
      } else a.burst = top;
      if (a.burstOut && a.burst >= Math.min(B.outUntil, top)) a.burstOut = false;
    }
  }
  // 스태미나 (E.4)
  const ratio = v / a.maxSpeed;
  if (v < P.walk * 1.1) a.stamina = Math.min(100, a.stamina + P.staminaRecover * recoverScale * dt * 10);
  else a.stamina = Math.max(0, a.stamina - ratio * ratio * P.staminaDrain * a.drainMul * drainScale * (P.drainAttrBase - (P.drainAttrSlope * a.attrs.stamina) / 100) * dt * 10);
}

/**
 * 판단용 도착 시간 (C.77x, 공통 규칙 로드맵 2단계): moveAgent 와 같은 운동 규칙으로 (x, y) 를 지나는 시각(초, 반응 시간 제외).
 * 지금 속도·몸 방향 → (반대쪽이면) 감속 reverseBrake × 가속 × turnKeep · 몸 돌리기 pivotTime → 가속 → 유효 최대 속도. 목표점에서 멈추는 감속은 넣지 않는다(지나가는 시각).
 * reach = 이 거리 안에 들면 닿은 것으로 본다
 */
export function arrivalTime(a: Agent, x: number, y: number, reach = 0): number {
  const dx = x - a.x;
  const dy = y - a.y;
  const d0 = Math.sqrt(dx * dx + dy * dy);
  let d = d0 - reach;
  if (d <= 0) return 0;
  const ux = dx / d0;
  const uy = dy / d0;
  const cap = effectiveMax(a);
  const acc0 = effectiveAccel(a);
  const sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy);
  const vp = sp > 0 ? (a.vx * ux + a.vy * uy) : 0;
  let t = 0;
  let v0: number;
  if (P.turnModel <= 0) {
    // 옛 동작: 반대쪽이면 속도 × turnKeep 즉시, 그 뒤 가속
    v0 = vp;
    if (vp < 0 && sp > 1) v0 = vp * a.turnKeep;
    if (v0 < 0) {
      const tb = -v0 / acc0;
      t += tb;
      d += (v0 * v0) / (2 * acc0);
      v0 = 0;
    }
  } else {
    const pt = pivotTime(a);
    v0 = Math.max(0, vp);
    // 몸 방향과 갈 방향 사이 각
    let ang = Math.acos(Math.max(-1, Math.min(1, sp > P.faceSpeed ? vp / sp : a.hx * ux + a.hy * uy)));
    if (sp > P.faceSpeed && vp < 0) {
      // 반대쪽으로 달리는 중: 감속하며 몸을 돌린다 (그동안 멀어지는 거리를 더한다)
      const brake = acc0 * P.reverseBrake * a.turnKeep;
      const tb = (sp - P.faceSpeed) / brake;
      t += tb;
      d += (-vp * (sp + P.faceSpeed) * 0.5 * tb) / sp;
      ang -= (tb * Math.PI) / pt;
      // faceSpeed 아래에서는 보통 가속으로 남은 반대 속도를 지운다 (아래 가속 식이 음수 v0 를 그대로 다룬다)
      // (감속은 틱 단위라 faceSpeed 아래로 반 틱만큼 더 내려간다)
      v0 = (vp / sp) * Math.max(0, P.faceSpeed - 0.5 * brake * ENGINE.time.dt);
    }
    if (ang > Math.PI / 2 && a.line !== 0) {
      // 남은 몸 돌리기: 90° 안으로 들 때까지 (서서 돈다)
      t += ((ang - Math.PI / 2) / Math.PI) * pt;
      v0 = 0;
    }
  }
  if (v0 >= cap) return t + d / v0;
  // 옆으로 달리던 속도(갈 방향에 수직)를 지우는 데 가속을 나눠 쓴다 (moveAgent 의 가속 한계는 벡터 크기)
  const vq = Math.abs(a.vx * uy - a.vy * ux);
  const acc = vq > 0 && v0 >= 0 ? acc0 * ((cap - v0) / Math.sqrt((cap - v0) * (cap - v0) + vq * vq)) : acc0;
  const ta = (cap - v0) / acc;
  const da = (cap * cap - v0 * v0) / (2 * acc);
  if (d <= da) return t + (-v0 + Math.sqrt(v0 * v0 + 2 * acc * d)) / acc;
  return t + ta + (d - da) / cap;
}

/** 루즈 비행이 끝난 뒤 공의 속도 (E.18 A4, C.24 after): 땅볼은 남은 속도 그대로, 공중볼은 튀면서 일부만 */
export function landingVelocity(fl: Flight): [number, number] {
  if (fl.after) return [fl.after.vx, fl.after.vy];
  const dx = fl.toX - fl.fromX;
  const dy = fl.toY - fl.fromY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const v0 = d / Math.max(0.1, fl.dur);
  const sp = fl.air ? Math.max(2, v0 * ENGINE.ball.airBounce) : Math.max(ENGINE.ball.landFloor, v0 - ENGINE.ball.groundDecel * fl.dur);
  return [(dx / d) * sp, (dy / d) * sp];
}
