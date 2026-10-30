// 오프더볼 움직임 (E.6): 공격 시 슬롯 + 지원 + 침투(오프사이드 라인 인지), 수비 시 마킹 + 라인 동기화 + 압박

// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import { weakFootMul } from '../body';
import * as config_ from './config';
const { ENGINE } = config_;
import { reaction } from './core';
import * as keeper_ from './keeper';
const { farSide, gkAttrs, keeperOf, keeperZone, reactOf, sweepRange } = keeper_;
import * as duel_ from './duel';
const { finishSkill } = duel_;
import * as physics_ from './physics';
const { arrivalTime, burstReady, effectiveMax, landingVelocity } = physics_;
import * as formation_ from './formation';
const { ballNorm, manDiff, slotTarget, teamPhase } = formation_;
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, L, ownGoal, positionValue, segDist, toNorm, toPitch, W } = pitch_;
import * as rng_ from './rng';
const { Purpose, rand, randn } = rng_;
import * as roles_ from './roles';
const { hasModule } = roles_;
import * as tactics_ from './tactics';
const { TENDENCY, blockRow, compactWOf, fbOverlapOf, stayForwards } = tactics_;
import type { Agent, DefSit, Line, SimState } from './state';

const O = ENGINE.offball;
const F = ENGINE.formation;
const RM = ENGINE.roles;
const BU = ENGINE.physics.burst;

/** 팀 전술 값 (수적 열세/우세 보정 포함, E.10) */
export function effectiveTactics(s: SimState, team: 0 | 1): { lineHeight: number; pressing: number } {
  const base = s.teams[team].tactics;
  const d = manDiff(s, team);
  const R = ENGINE.referee;
  if (d < 0) return { lineHeight: clamp(base.lineHeight - R.shortLine, 0, 1), pressing: clamp(base.pressing - R.shortPress, 0, 1) };
  if (d > 0) return { lineHeight: clamp(base.lineHeight + R.extraLine, 0, 1), pressing: clamp(base.pressing + R.extraPress, 0, 1) };
  return base;
}

/** 전술 압박 단계 0 낮음 / 1 보통 / 2 높음 (실효 pressing, C.75c 수비 계획 인원표) */
export function pressLevel(s: SimState, team: 0 | 1): number {
  const p = effectiveTactics(s, team).pressing;
  const [c0, c1] = O.plan.levelCut;
  return p < c0! ? 0 : p < c1! ? 1 : 2;
}

/** 지금 상황에서 공으로 가는 인원 (C.75c plan.sit) */
function sitPressers(s: SimState, team: 0 | 1): number {
  const k = s.teams[team].sit;
  return k === '-' ? 1 : O.plan.sit[k].pressers[pressLevel(s, team)]!;
}

/**
 * 수비 상황 판정 (C.75c, pending 41 상황표 — scripts/diag/defense-shape.ts ⑥ 과 같은 신호·순서 H → B → C → D → F → E → A, 루즈볼 G).
 * 패스가 떠 있는 동안은 직전 상황을 유지한다
 */
function rawSituation(s: SimState, def: 0 | 1): DefSit | null {
  const b = s.ball;
  const tm = s.teams[def];
  if (b.owner < 0) return b.flight && b.flight.outcome !== 'loose' ? null : 'G';
  const owner = s.agents[b.owner]!;
  if (owner.team === def) return '-';
  if (s.t < tm.counterUntil && tm.counterPressers.length > 0) return 'H';
  const dDir = attackDir(def, s.half);
  const [gx, gy] = ownGoal(dDir);
  const [bnx, bny] = toNorm(b.x, b.y, dDir);
  let ahead = 0;
  let defNear = 0;
  let defNear6 = 0;
  let attNear = 1;
  let mateNear = false;
  for (const o of s.agents) {
    if (!o.onPitch || o.line === 0) continue;
    if (o.team === def) {
      if (toNorm(o.x, o.y, dDir)[0] > bnx + 0.03) ahead++;
      if (dist(o.x, o.y, b.x, b.y) <= 15) defNear++;
      if (dist(o.x, o.y, owner.x, owner.y) <= 6) defNear6++;
    } else if (o !== owner) {
      if (dist(o.x, o.y, b.x, b.y) <= 15) attNear++;
      if (dist(o.x, o.y, owner.x, owner.y) <= 8) mateNear = true;
    }
  }
  const inBox = Math.abs(b.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(b.y - gy) <= ENGINE.pitch.boxWidth / 2;
  if (s.t - s.possSince < 6 && ahead >= 3 && bnx < 0.6) return 'B';
  if (bnx < 0.5 && attNear > defNear) return 'C';
  if ((b.y <= 8 || b.y >= W - 8) && bnx < 0.5 && !mateNear && defNear6 >= 2) return 'D';
  const crossPos = Math.abs(bny - 0.5) >= 0.2 && bnx <= 1 - ENGINE.prob.crossMinX;
  if (crossPos && !inBox) return 'F';
  return inBox ? 'E' : 'A';
}

/** 틱마다 두 팀의 수비 상황을 갱신한다 (sitHold 초 히스테리시스, G·H·E·우리 공은 즉시) */
export function updateSituations(s: SimState): void {
  for (const team of [0, 1] as const) {
    const tm = s.teams[team];
    const raw = rawSituation(s, team);
    if (raw === null || raw === tm.sit) {
      tm.sitCand = tm.sit;
      continue;
    }
    if (raw !== tm.sitCand) {
      tm.sitCand = raw;
      tm.sitCandSince = s.t;
    }
    if (raw === 'G' || raw === 'H' || raw === 'E' || raw === '-' || tm.sit === '-' || s.t - tm.sitCandSince >= O.plan.sitHold) {
      tm.sit = raw;
      tm.sitSince = s.t;
    }
  }
}

/** 커버 자리 (C.75c): (x, y)와 그 팀 골을 잇는 선에서 골 쪽 plan.coverBehind m */
function coverSpot(a: Agent, dir: 1 | -1, x: number, y: number): void {
  const [gx, gy] = ownGoal(dir);
  const d = dist(x, y, gx, gy) || 1;
  const k = Math.min(O.plan.coverBehind, d * 0.5);
  a.tx = x + ((gx - x) / d) * k;
  a.ty = y + ((gy - y) / d) * k;
  a.urgent = true;
}

/**
 * 팀의 오프사이드 라인 (그 팀 기준 정규화 x): 상대 뒤에서 두 번째 선수, 하프라인보다 뒤일 수 없다
 */
export function offsideLine(s: SimState, team: 0 | 1): number {
  const dir = attackDir(team, s.half);
  let first = 0;
  let second = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team) continue;
    const nx = toNorm(o.x, o.y, dir)[0];
    if (nx > first) {
      second = first;
      first = nx;
    } else if (nx > second) second = nx;
  }
  return Math.max(0.5, second);
}

/** 상대 팀 수비 라인 x (자기 팀 기준 정규화). 수비수들이 같은 x 에 선다 */
function defensiveLine(s: SimState, team: 0 | 1): number {
  const t = effectiveTactics(s, team);
  const [bx] = ballNorm(s, team);
  const phase = teamPhase(s, team);
  let nx = F.lineBase + (t.lineHeight - 0.5) * F.lineRange + F.blockX * (bx - 0.5);
  if (phase < 0) nx += F.defendShift[1] * -phase;
  else nx += F.attackShift[1] * phase;
  if (phase < 0) nx = Math.min(nx, bx - F.lineBehindBall / L);
  // 역압박 중 라인 유지 (C.78a ② G1): 잃는 순간의 높이(상한 lineHold)에서 내려오지 않는다. 뚫리면(pressBreak) 역압박이 끝나 지금처럼 내려온다
  const tm = s.teams[team];
  if (O.lineHold > 0 && tm.lineAtLoss >= 0 && s.t < tm.counterUntil && tm.counterPressers.length > 0) nx = Math.max(nx, Math.min(tm.lineAtLoss, O.lineHold));
  return clamp(nx, F.lineMin, 0.7);
}

/**
 * 전환 수비 틱 (C.78a, 상수가 모두 0 이면 아무것도 안 한다): sim stepBody 가 오프더볼 갱신 앞에서 부른다. 난수 없음.
 * ② 잃은 직후 첫 틱에 그 순간 수비 줄의 실제 높이를 잰다(lineHold). ① 역압박이 뚫렸으면(상대 소유자 또는 떠 있는 상대 패스 착지점이 가담자 모두보다 pressBreakGap m 이상 우리 골 쪽)
 * 역압박을 그 자리에서 끝내고(counterUntil = 지금) 가담자는 긴급 복귀로 바로 다시 판단한다 — 복귀에 드는 시간은 이동 규칙 그대로
 */
export function transitionTick(s: SimState): void {
  if (O.lineHold <= 0 && O.pressBreak <= 0) return;
  for (const team of [0, 1] as const) {
    const tm = s.teams[team];
    if (O.lineHold > 0 && tm.lineAtLoss < 0 && s.t - tm.lostAt < 1) {
      // 잃는 순간 수비 줄의 실제 자리 (정규화 x 평균)
      const d = attackDir(team, s.half);
      let sum = 0;
      let n = 0;
      for (const a of s.agents) if (a.onPitch && a.team === team && a.line === 1) { sum += toNorm(a.x, a.y, d)[0]; n++; }
      tm.lineAtLoss = n ? sum / n : 0;
    }
    if (O.pressBreak <= 0 || s.t >= tm.counterUntil || !tm.counterPressers.length) continue;
    const dir = attackDir(team, s.half);
    const b = s.ball;
    let x: number | null = null;
    if (b.owner >= 0) {
      const o = s.agents[b.owner]!;
      if (o.team !== team) x = toNorm(o.x, o.y, dir)[0];
    } else if (b.flight && b.flight.outcome === 'receive' && b.flight.receiver >= 0 && s.agents[b.flight.receiver]!.team !== team) {
      x = toNorm(b.flight.toX, b.flight.toY, dir)[0];
    }
    if (x === null) continue;
    const gap = O.pressBreakGap / L;
    if (!tm.counterPressers.every((i) => toNorm(s.agents[i]!.x, s.agents[i]!.y, dir)[0] > x! + gap)) continue;
    tm.counterUntil = s.t;
    tm.brokeAt = s.t;
    for (const i of tm.counterPressers) {
      const a = s.agents[i]!;
      a.recoverUrgent = true;
      a.nextOffball = s.t;
    }
  }
}

function setTarget(a: Agent, nx: number, ny: number, dir: 1 | -1, urgent: boolean): void {
  const [x, y] = toPitch(clamp(nx, 0.005, 0.995), clamp(ny, 0.01, 0.99), dir);
  a.tx = clamp(x + a.errY * O.jitter, 0.3, L - 0.3);
  a.ty = clamp(y + a.errX * O.jitter, 0.3, W - 0.3);
  a.urgent = urgent;
}

/** 공에 가까운 순위 (같은 팀, GK 제외, 0부터) */
export function ballRank(s: SimState, a: Agent, bx: number, by: number): number {
  const d = dist(a.x, a.y, bx, by);
  let rank = 0;
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.line === 0) continue;
    if (dist(o.x, o.y, bx, by) < d) rank++;
  }
  return rank;
}

/** 팀의 필드 선수 중 (x, y)에 가장 가까운 선수 */
function nearestTo(s: SimState, team: 0 | 1, x: number, y: number): Agent | null {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line === 0) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

/** 루즈볼이면 공이 멈출 지점 근처를 예측 */
function ballChasePoint(s: SimState): [number, number] {
  const b = s.ball;
  if (b.flight) return [b.flight.toX, b.flight.toY];
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp < 0.5) return [b.x, b.y];
  const stop = (sp * sp) / (2 * ENGINE.ball.groundDecel);
  const k = Math.min(stop, 6) / sp;
  return [b.x + b.vx * k, b.y + b.vy * k];
}

/** 루즈볼이 t 초 뒤 있을 곳과 속도 (C.28): 루즈 비행은 비행 끝까지 직선, 그 뒤 등감속 굴림. 공중이면 air */
export function ballPathAt(s: SimState, t: number): { x: number; y: number; sp: number; air: boolean } {
  const b = s.ball;
  const fl = b.flight;
  let [x, y, vx, vy] = [b.x, b.y, b.vx, b.vy];
  if (fl) {
    const left = Math.max(0, fl.t0 + fl.dur - s.t);
    if (t < left) {
      const k = clamp((s.t + t - fl.t0) / fl.dur, 0, 1);
      return { x: fl.fromX + (fl.toX - fl.fromX) * k, y: fl.fromY + (fl.toY - fl.fromY) * k, sp: dist(fl.fromX, fl.fromY, fl.toX, fl.toY) / Math.max(0.05, fl.dur), air: fl.air };
    }
    [x, y] = [fl.toX, fl.toY];
    [vx, vy] = landingVelocity(fl);
    t -= left;
  }
  const sp = Math.sqrt(vx * vx + vy * vy);
  if (sp < 1e-6) return { x, y, sp: 0, air: false };
  const dec = ENGINE.ball.groundDecel;
  const tt = Math.min(t, sp / dec);
  const d = sp * tt - 0.5 * dec * tt * tt;
  return { x: x + (vx / sp) * d, y: y + (vy / sp) * d, sp: sp - dec * tt, air: false };
}

/** 선수가 (x, y)에 닿는 시간: 반응 + 이동 시간(C.77x arrivalTime — 지금 속도·방향 → 감속·뒤돌기 → 가속 → 최고 속도). 이미 공을 보고 있었으면(ready) 반응 없이 */
function arrival(a: Agent, x: number, y: number, ready = false): number {
  return (ready ? 0 : reaction(a)) + (ENGINE.physics.arrivalModel > 0 ? arrivalTime(a, x, y) : dist(a.x, a.y, x, y) / effectiveMax(a));
}

/**
 * GK 루즈볼 추격 (C.28): 공 경로에서 GK 가 닿는 첫 점이 처리 구역 안(자기 박스, 스위퍼는 박스 밖 sweepRange 까지)이고,
 * 그 시각이 가장 빠른 상대보다 chaseMargin 초 이상 빠르고 가장 빠른 동료(필드)보다 늦지 않으면 그 점. 아니면 null
 */
function keeperChase(s: SimState, a: Agent): [number, number] | null {
  const b = s.ball;
  const fl = b.flight;
  if (b.owner >= 0 || b.reserve || (fl && fl.outcome !== 'loose')) return null;
  const K = ENGINE.keeper;
  const range = sweepRange(a);
  const step = 0.1;
  const n = Math.round(K.chaseHorizon / step);
  const path: { x: number; y: number; sp: number; air: boolean; fly?: boolean }[] = [];
  for (let i = 0; i <= n; i++) {
    const p = ballPathAt(s, i * step);
    if (p.x < 0 || p.x > L || p.y < 0 || p.y > W) break;
    // 비행 중인 공은 필드 선수가 잡지 못한다 (착지 뒤부터). 땅볼은 GK 만 박스 안에서 처리한다 (sim keeperHands)
    if (fl && i * step < fl.t0 + fl.dur - s.t) (p as (typeof path)[number]).fly = true;
    path.push(p);
  }
  // 가장 이른 도착 (공보다 먼저 그 점에 닿는 첫 시각). 공중에 떠 있는 동안은 못 닿는다
  const first = (o: Agent): number => {
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      if (!p.air && !p.fly && arrival(o, p.x, p.y) <= i * step) return i * step;
    }
    return Infinity;
  };
  // 우리 팀 패스(백패스·수비 사이 패스)가 빗나간 것이면 GK 는 이미 공을 보고 있었다
  const ready = b.kick?.team === a.team && b.lastTeam === a.team;
  let gi = -1;
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    // 자기 박스 안은 손(백패스는 발로 막기)이라 빠른 공도, 박스 밖은 보통 컨트롤 속도까지
    const box = keeperZone(s, a, p.x, p.y, 0);
    if (p.air || (p.fly && !box) || (box ? p.sp > K.handMaxSpeed : p.sp >= ENGINE.ball.controlMaxSpeed) || !keeperZone(s, a, p.x, p.y, range)) continue;
    if (arrival(a, p.x, p.y, ready) <= i * step) {
      gi = i;
      break;
    }
  }
  if (gi < 0) return null;
  const tg = gi * step;
  const margin = s.teams[a.team].gkChase ? K.chaseKeep : K.chaseMargin;
  for (const o of s.agents) {
    if (!o.onPitch || o === a) continue;
    const to = first(o);
    if (o.team !== a.team ? to < tg + margin : to < tg) return null;
  }
  return [path[gi]!.x, path[gi]!.y];
}

export function keeperTarget(s: SimState, a: Agent): void {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = ownGoal(dir);
  const [bx] = ballNorm(s, a.team);
  const sweeper = a.gk?.type === 'sweeper';
  const K = ENGINE.keeper;
  // 공이 멀수록 전진
  const far = clamp((bx - 0.2) / 0.6, 0, 1);
  const depth = sweeper ? K.sweeperMin + (K.sweeperMax - K.sweeperMin) * far : K.classicMin + (K.classicMax - K.classicMin) * far;
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  // 기본 자리 (C.78m arcSet): 기준점(상대 소유자, 없으면 공) → 골 가운데 선 위 깊이 depth 인 점. 0 이면 옛 사각 격자(깊이 x · 옆 y × lateral)
  const ref = owner && owner.team !== a.team ? owner : s.ball;
  const arc = (d: number): void => {
    const rx = Math.max(0, (ref.x - gx) * dir);
    const ry = ref.y - gy;
    const rd = Math.hypot(rx, ry);
    a.tx = gx + dir * (rd > 0.1 ? (rx / rd) * d : d);
    a.ty = clamp(gy + (rd > 0.1 ? (ry / rd) * d : 0), gy - ENGINE.pitch.goalWidth / 2 - 1, gy + ENGINE.pitch.goalWidth / 2 + 1);
  };
  if (K.arcSet) arc(depth);
  else {
    a.tx = gx + dir * depth;
    a.ty = clamp(gy + (s.ball.y - gy) * K.lateral, gy - ENGINE.pitch.goalWidth / 2 - 1, gy + ENGINE.pitch.goalWidth / 2 + 1);
  }
  a.urgent = false;
  // 패스 비행 중 자리 (C.77z flightSet): 상대가 받을 패스·크로스의 도착점이 슛 거리(setDist) 안이면 그 점 기준 슛 각도 자리로 서둘러 옮긴다
  const fl = s.ball.flight;
  if (K.flightSet && fl && !s.restart && (fl.outcome === 'receive' || fl.outcome === 'aerial') && s.agents[fl.passer]?.team !== a.team) {
    const fd = dist(fl.toX, fl.toY, gx, gy);
    if (fd < K.setDist && fd > 0.1) {
      const dep = Math.min(K.classicMin, fd / 2);
      a.tx = gx + ((fl.toX - gx) / fd) * dep;
      a.ty = clamp(gy + ((fl.toY - gy) / fd) * dep, gy - ENGINE.pitch.goalWidth / 2 - 1, gy + ENGINE.pitch.goalWidth / 2 + 1);
      a.urgent = true;
      return;
    }
  }
  // 각 좁히기: 상대 소유자가 박스 안 골 가까이 들어오면 공과 골 사이로 나간다
  if (owner && owner.team !== a.team && !s.restart) {
    const gd = dist(owner.x, owner.y, gx, gy);
    const inBox = Math.abs(owner.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(owner.y - gy) <= ENGINE.pitch.boxWidth / 2;
    if (inBox && gd < K.rushDist && gd > 0.1) {
      a.tx = owner.x + ((gx - owner.x) / gd) * K.rushGap;
      a.ty = owner.y + ((gy - owner.y) / gd) * K.rushGap;
      a.urgent = true;
    } else if (gd < K.setDist) {
      // 자세 잡기 (C.77t): 상대가 슛 거리 안에서 공을 가지면 자리를 걸어서가 아니라 서둘러 옮긴다 (GK 위치가 선방에 들어간 뒤)
      a.urgent = true;
      // 슛 거리 깊이 (C.78j): 상대가 골 앞 슛 각도(골 쪽 거리 대비 옆 거리 ≤ setCentral)에서 공을 가지면 스위퍼도 setDepth m 보다 앞에 서 있지 않는다.
      // 측면·바이라인 쪽 공은 옛 자리 그대로 (컷백은 GK 가 가로질러야 하는 상황으로 남는다). 옆 자리는 그대로
      // 단독 돌파(골 쪽에 우리 필드 수비가 없음)면 스위퍼는 그대로 맞으러 나온다
      if (K.setLine && gd >= K.setFrom && Math.abs(owner.y - gy) <= K.setCentral * Math.abs(owner.x - gx)
        && s.agents.some((o) => o.onPitch && o.team === a.team && o.line !== 0 && dist(o.x, o.y, gx, gy) < gd - K.setBehind)) {
        if (K.arcSet) arc(Math.min(depth, K.setDepth));
        else a.tx = gx + dir * Math.min(depth, K.setDepth);
      }
    }
  }
}

/** 패스 비행 중 GK 다시 보기 (C.77z flightSet): 패스·크로스를 찬 뒤 GK 반응 시간(reactOf)이 지나는 틱에 자리를 다시 잡는다 */
export function keeperFlightDue(s: SimState, a: Agent): boolean {
  const fl = s.ball.flight;
  if (!ENGINE.keeper.flightSet || a.line !== 0 || !fl || (fl.outcome !== 'receive' && fl.outcome !== 'aerial')) return false;
  const tr = fl.t0 + reactOf(gkAttrs(a).shotStopping);
  return s.t >= tr && s.t - ENGINE.time.dt < tr;
}

/** (x, y)가 그 팀 자기 박스 안인가 */
export function inOwnBox(team: 0 | 1, half: 1 | 2, x: number, y: number): boolean {
  const [gx, gy] = ownGoal(attackDir(team, half));
  return Math.abs(x - gx) <= ENGINE.pitch.boxDepth && Math.abs(y - gy) <= ENGINE.pitch.boxWidth / 2;
}

/** 골 뒤 복귀 속도 (C.24): 킥오프 returnMargin 초 전에 목표에 닿는 속도, 느린 걸음(strollMin) ~ 러닝 */
function returnPace(s: SimState, a: Agent): number {
  const R = ENGINE.restart;
  const left = Math.max(0.5, s.restart!.at - R.returnMargin - s.t);
  return clamp(dist(a.x, a.y, a.tx, a.ty) / left, R.strollMin, ENGINE.physics.run);
}

/** 골 세리머니 (C.24): 득점자는 세리머니 지점, 함께하는 동료는 그 주변에 모여 조깅. 그 밖이면 false */
function celebrate(s: SimState, a: Agent, g: NonNullable<NonNullable<SimState['restart']>['goal']>): boolean {
  const k = g.joiners.indexOf(a.idx);
  if (a.idx !== g.scorer && k < 0) return false;
  const R = ENGINE.restart;
  // 모여서 조금씩 움직인다: 오프더볼 갱신마다 자리 주변 0.6 m 안 새 점
  const j = rand(s.seed, s.tick, a.idx, Purpose.Restart, 30) * Math.PI * 2;
  const jr = 0.6 * rand(s.seed, s.tick, a.idx, Purpose.Restart, 31);
  const ang = k < 0 ? 0 : (2 * Math.PI * k) / g.joiners.length;
  const rad = k < 0 ? 0 : R.celebrateSpread;
  a.tx = clamp(g.cx + Math.cos(ang) * rad + Math.cos(j) * jr, 0.3, L - 0.3);
  a.ty = clamp(g.cy + Math.sin(ang) * rad + Math.sin(j) * jr, 0.3, W - 0.3);
  a.urgent = false;
  a.paceCap = ENGINE.physics.jog;
  return true;
}

/** 오프더볼 목표 갱신 */
export function updateOffball(s: SimState, a: Agent): void {
  a.minRun = false;
  // 목표 속도 (C.77x): 사람을 따라가는 목표를 정하는 곳만 채운다
  a.tvx = 0;
  a.tvy = 0;
  a.tvIdx = -1;
  a.paceCap = 0;
  const dir = attackDir(a.team, s.half);
  const b = s.ball;
  const fl = b.flight;

  // 굴러오는 공을 받기로 한 선수 (C.24): 공으로
  if (b.reserve && b.reserve.idx === a.idx && b.owner < 0 && !fl) {
    a.tx = b.x;
    a.ty = b.y;
    a.urgent = true;
    return;
  }
  // 유효 슈팅 (C.24): 막는 GK 는 1단계 도착점으로 몸을 날린다
  if (fl && (fl.outcome === 'shot' || fl.outcome === 'goal') && a.line === 0 && s.agents[fl.passer]?.team !== a.team && !fl.shot?.penalty) {
    a.tx = fl.outcome === 'shot' ? fl.toX : fl.fromX;
    a.ty = fl.outcome === 'shot' ? fl.toY : fl.fromY;
    a.urgent = true;
    return;
  }
  // 공중볼 GK 처리 (C.24): 우리 박스 안 착지점이 처리 범위 안이면 GK 가 착지점으로 미리 나간다
  if (fl && fl.outcome === 'aerial' && a.line === 0 && s.agents[fl.passer]?.team !== a.team && !s.restart
    && inOwnBox(a.team, s.half, fl.toX, fl.toY) && dist(a.x, a.y, fl.toX, fl.toY) < ENGINE.keeper.claimRange) {
    a.tx = clamp(fl.toX, 0.3, L - 0.3);
    a.ty = clamp(fl.toY, 0.3, W - 0.3);
    a.urgent = true;
    return;
  }

  // 패스를 받을/가로챌 선수는 도착점으로
  if (fl && (fl.outcome === 'receive' && fl.receiver === a.idx || fl.outcome === 'intercept' && fl.interceptor === a.idx)) {
    a.tx = fl.toX;
    a.ty = fl.toY;
    // 침투 패스는 달리며 받는다 (C.78b receive.runOn): 도착점에서 멈추지 않게 패스 방향으로 runOn m 더 (받는 판정은 도착점 4 m 안 그대로)
    if (ENGINE.receive.runOn > 0 && fl.outcome === 'receive' && fl.through) {
      const d = Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY) || 1;
      a.tx = clamp(fl.toX + ((fl.toX - fl.fromX) / d) * ENGINE.receive.runOn, 1, L - 1);
      a.ty = clamp(fl.toY + ((fl.toY - fl.fromY) / d) * ENGINE.receive.runOn, 1, W - 1);
    }
    a.urgent = true;
    return;
  }
  // 크로스 공중볼 (E.22 B 헤더 경합): 대상 선수와 착지점에 가장 가까운 상대 필드 선수가 착지점으로 뛰어든다
  if (fl && fl.outcome === 'aerial' && fl.fromCross && a.line !== 0) {
    const passer = s.agents[fl.passer];
    if (fl.receiver === a.idx || (passer && a.team !== passer.team && nearestTo(s, a.team, fl.toX, fl.toY) === a)) {
      a.tx = clamp(fl.toX, 0.3, L - 0.3);
      a.ty = clamp(fl.toY, 0.3, W - 0.3);
      a.urgent = true;
      return;
    }
  }
  if (a.line === 0 && !s.restart) {
    // 루즈볼 추격 (C.28): 처리 구역 안에서 상대보다 먼저 닿는 공이면 나간다
    const chase = keeperChase(s, a);
    s.teams[a.team].gkChase = !!chase;
    if (chase) {
      a.tx = clamp(chase[0], 0.3, L - 0.3);
      a.ty = clamp(chase[1], 0.3, W - 0.3);
      a.urgent = true;
      return;
    }
    keeperTarget(s, a);
    return;
  }

  // 리스타트 대기: 키커는 공으로, 나머지는 대형
  if (s.restart) {
    const goal = s.restart.type === 'kickoff' ? s.restart.goal : undefined;
    if (s.restart.taker === a.idx) {
      a.tx = s.restart.x;
      a.ty = s.restart.y;
      a.urgent = !goal;
      // 골 뒤 킥오프 키커는 걸어서 (C.24). 늦으면 재개 처리(restartDue)가 긴급으로 바꾼다
      if (goal) a.paceCap = returnPace(s, a);
      return;
    }
    if (a.line === 0) {
      keeperTarget(s, a);
      return;
    }
    if (goal && s.t < goal.until && celebrate(s, a, goal)) return;
    if (setPieceTarget(s, a)) return;
    const [nx, ny] = slotTarget(s, a);
    // 프리킥/코너 등에서 공 근처 9 m 밖
    let [x, y] = toPitch(nx, ny, dir);
    if (s.restart.team !== a.team && dist(x, y, s.restart.x, s.restart.y) < 9.15) {
      const d = dist(x, y, s.restart.x, s.restart.y) || 1;
      x = s.restart.x + ((x - s.restart.x) / d) * 9.2;
      y = s.restart.y + ((y - s.restart.y) / d) * 9.2;
    }
    if (s.restart.type === 'kickoff') {
      // 킥오프: 자기 진영
      const own = toNorm(x, y, dir)[0];
      if (own > 0.48) [x, y] = toPitch(0.48, toNorm(x, y, dir)[1], dir);
    }
    a.tx = clamp(x, 0.5, L - 0.5);
    a.ty = clamp(y, 0.5, W - 0.5);
    a.urgent = false;
    if (goal) a.paceCap = returnPace(s, a);
    return;
  }

  // 루즈볼: 팀별 가장 가까운 chasers 명이 쫓는다
  const loose = b.owner < 0 && (!fl || fl.outcome === 'loose');
  // 동료에게 굴러가는 공 (C.24)은 쫓지 않는다
  if (loose && !(b.reserve && s.agents[b.reserve.idx]?.team === a.team)) {
    const [cx, cy] = ballChasePoint(s);
    // GK 가 쫓으면 GK 를 추격자 1명으로 센다 (C.28)
    // C.75c: 착지점으로는 1명, 둘째는 착지점과 우리 골 사이 커버 자리 (양 팀 같은 규칙)
    const rank = ballRank(s, a, cx, cy);
    if (rank < ENGINE.ball.chasers - (s.teams[a.team].gkChase ? 1 : 0)) {
      if (rank === 0) {
        a.tx = cx;
        a.ty = cy;
        a.urgent = true;
      } else coverSpot(a, dir, cx, cy);
      return;
    }
  }

  // 직선(롱볼) 세컨드볼 (E.19): 우리 팀 롱볼이 떠 있으면 착지점에 가까운 2선 2명은 착지점 10~15 m 뒤로
  if (fl && (fl.kind === 'long' || fl.kind === 'clear') && s.agents[fl.passer]?.team === a.team && a.line === 2
    && s.teams[a.team].tactics.tendency === 'direct') {
    const mids = s.agents.filter((o) => o.onPitch && o.team === a.team && o.line === 2)
      .sort((x, y) => dist(x.x, x.y, fl.toX, fl.toY) - dist(y.x, y.y, fl.toX, fl.toY));
    const k = mids.indexOf(a);
    if (k >= 0 && k < 2) {
      const back = TENDENCY.directSecond[k]!;
      a.tx = clamp(fl.toX - dir * back, 1, L - 1);
      a.ty = clamp(fl.toY + (k === 0 ? -3 : 3), 1, W - 1);
      a.urgent = true;
      return;
    }
  }

  const attacking = s.possTeam === a.team;
  const [bnx, bny] = ballNorm(s, a.team);
  // 2선 추적 (C.77b): 우리 공이 되면 배정은 바로 풀린다 (trackPlan 은 수비 때만 돌아 그대로 두면 다음 수비 첫 0.5초를 옛 대상에게 쓴다)
  if (attacking && a.trackIdx >= 0) { a.trackIdx = -1; a.trackOut = -1; }
  if (attacking) attackTarget(s, a, dir, bnx, bny);
  else defendTarget(s, a, dir, bnx, bny);
}

function attackTarget(s: SimState, a: Agent, dir: 1 | -1, bnx: number, bny: number): void {
  ensureErrors(s, a);
  const shortHanded = manDiff(s, a.team) < 0;
  let [nx, ny] = slotTarget(s, a, shortHanded ? ENGINE.referee.shortAttackShift : 1);
  const line = offsideLine(s, a.team);
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  let urgent = false;

  if (s.t >= a.runUntil) {
    a.giveGo = false;
    a.exitRun = false;
    a.supportRun = false;
    a.gapY = -1;
    a.overlap = false;
  }
  // 풀백 오버래핑 (C.78i ②): 그 측면 상대 윙어가 높이 남았고 앞 측면 길이 비었으면 공 앞으로 전진 (한 팀에 한 쪽)
  const ready = O.fbOverlap > 0 && s.t >= a.runUntil && owner && owner.team === a.team && owner !== a ? overlapReady(s, a, dir, bnx) : 0;
  if (ready > 0) {
    const tm = fbOverlapOf(s.teams[a.team].tactics);
    const tired = Math.min(1, a.stamina / O.fbOverlapTired) * (BU.runFloor + (1 - BU.runFloor) * burstReady(a));
    if (rand(s.seed, s.tick, a.idx, Purpose.Overlap) < O.fbOverlapChance * ready * (a.role.run / 0.5) * tm * tired) {
      a.runUntil = s.t + O.fbOverlapSeconds;
      a.overlap = true;
    }
  }
  // ⒝ 주고 달리기 (C.77y, 2:1): 상대 진영으로 성공할 패스를 막 찼거나(날아가는 중) 방금 받게 했으면 받는 선수 마커의 뒤 공간으로.
  // 굴림은 패스당 1번 (giveGoT = 마지막 굴린 시각: 날아가는 중 굴렸으면 받은 뒤에는 안 굴린다)
  const fl = s.ball.flight;
  const flying = fl && fl.passer === a.idx && fl.kind === 'pass' && fl.outcome === 'receive' && !fl.through ? fl : null;
  const lp = s.lastPass;
  const gRef = flying ? [flying.toX, flying.toY] as const : owner ? [owner.x, owner.y] as const : null;
  const gNew = flying ? a.giveGoT < flying.t0
    : !!lp && lp.passer === a.idx && !!owner && owner.idx === lp.receiver && owner.team === a.team && s.t - lp.t <= O.giveGoT && a.giveGoT < lp.t - 2;
  if (O.giveGoChance > 0 && gNew && gRef && s.t >= a.runUntil && a.line >= 2 && a.role.run >= O.giveGoRun && toNorm(gRef[0], gRef[1], dir)[0] >= 0.5) {
    a.giveGoT = s.t;
    if (rand(s.seed, s.tick, a.idx, Purpose.GiveGo) < ((O.giveGoChance * a.attrs.offTheBall) / 100) * (BU.runFloor + (1 - BU.runFloor) * burstReady(a))) {
      a.runUntil = s.t + O.runSeconds;
      a.giveGo = true;
    }
  }
  // CB 빈자리 침투 (C.78e ②): 상대 CB 가 내려온 우리 공격수를 따라 나가 수비 줄에 빈자리가 생기면 그 자리에 가장 먼저 닿는 2선·측면 1명이 뒤로 달린다
  if (O.gapRun > 0 && s.t >= a.runUntil && a.line >= 2 && owner && owner.team === a.team && owner !== a) {
    const g = gapPlan(s, a.team, dir);
    if (g && g.runner === a.idx) {
      a.runUntil = s.t + O.runSeconds;
      a.gapY = g.ny;
    }
  }
  // 침투: 공격 위치선정 × run 비례 확률로 수비 라인 근처로 달린다
  if (s.t >= a.runUntil && a.line >= 2 && owner && owner.team === a.team) {
    let chance = a.role.run * (a.attrs.offTheBall / 100) * O.runChance * Math.max(0.3, 1 + (O.runPace * (a.attrs.pace - 70)) / 100);
    // ② 줄 사이: 펄스 나인이 내려와 비운 중앙으로 2선(침투 성향 run ≥ lateRunRun)이 더 자주 뛰어든다 (E3.7 역할 반응)
    if (a.role.run >= O.lateRunRun && !hasModule(a.role, 'between') && s.agents.some((o) => o.onPitch && o.team === a.team && o.role.id === 'falseNine')) chance *= 1 + RM.nineVacate;
    // 2단 체력 (C.78w): 순간 체력이 낮으면 침투 질주를 덜 고른다
    chance *= BU.runFloor + (1 - BU.runFloor) * burstReady(a);
    if (rand(s.seed, s.tick, a.idx, Purpose.Run) < chance) a.runUntil = s.t + O.runSeconds;
  }
  let running = s.t < a.runUntil;
  // 라인을 타는 정확도: 능력치가 낮을수록 라인보다 앞에 설 확률이 높다
  const sigma = ((100 - a.attrs.offTheBall) * O.offsideSigma) / L;
  const n0x = nx;
  const n0y = ny;
  if (running) {
    nx = line + a.errX * sigma * O.runLineError;
    if (a.giveGo && gRef && (flying || owner?.team === a.team)) {
      // 2:1: 받는 선수(날아가는 중이면 받을 자리)에서 공격 방향 giveGoDepth m, 패서 쪽 레인 (라인 안쪽까지)
      const [onx, ony] = toNorm(gRef[0], gRef[1], dir);
      const [, any] = toNorm(a.x, a.y, dir);
      nx = Math.min(nx, onx + O.giveGoDepth / L);
      ny = clamp(ony + (any >= ony ? 1 : -1) * (O.giveGoLane / W), 0.03, 0.97);
    }
    // 탈취 뒤 출구 침투 (C.78a ⑤): 골 쪽 안쪽 길(중앙에서 exitLane 배)로 대각선 침투
    if (a.exitRun) ny = 0.5 + (ny - 0.5) * O.exitLane;
    // 역습 지원 (C.78d ②): 자기 쪽 측면 길(중앙 ± supportLane)로 앞으로
    if (a.supportRun) ny = 0.5 + (toNorm(a.x, a.y, dir)[1] >= 0.5 ? 1 : -1) * O.supportLane;
    // CB 빈자리 침투 (C.78e ②): 빈자리 채널로
    if (a.gapY >= 0) ny = a.gapY;
    // 풀백 오버래핑 (C.78i ②): 공(또는 자기) 앞 fbOverlapAhead m 측면 길, 오프사이드 라인 안쪽
    if (a.overlap) {
      const [anx] = toNorm(a.x, a.y, dir);
      nx = Math.min(line - 0.5 / L, Math.max(anx, bnx) + O.fbOverlapAhead / L);
      ny = 0.5 + (a.sy < 0.5 ? -1 : 1) * O.wideTouch;
    }
    const [px, py] = toPitch(nx, ny, dir);
    urgent = dist(px, py, a.x, a.y) > 3;
    // ⒟ 침투 취소 (C.77y): 소유자에게서 달리는 목표까지 패스 길이 닫혔거나 이미 오프사이드 라인보다 abortOffside m+ 앞이면 멈추고 라인 안쪽으로 되돌아 나온다
    // 역습 지원·출구 달리기 (C.78d ②)·CB 빈자리 침투 (C.78e ②)는 취소하지 않는다 — 정해진 길로 끝까지 (자기 ⅓ 에서 시작하면 패스 길이 늘 막혀 보여 바로 취소됐다)
    if (O.abortLane > 0 && owner && owner.team === a.team && owner !== a && !s.ball.flight && !(O.supportRun > 0 && (a.supportRun || a.exitRun)) && a.gapY < 0 && !a.overlap) {
      const [anx] = toNorm(a.x, a.y, dir);
      if ((anx - line) * L >= O.abortOffside || laneRisk(s, owner, px, py).risk >= O.abortLane) {
        a.runUntil = s.t;
        a.giveGo = false;
        running = false;
        nx = Math.min(n0x, line - O.abortBack / L);
        ny = n0y;
        urgent = true;
      }
    }
  } else if (a.line >= 2) {
    nx = Math.min(nx, line - 1 / L + a.errX * sigma);
  }
  // 공이 상대 최종 3분의 1 측면 (E.18 A2): 2선 늦은 침투(컷백 존), 세컨드 볼 담당, ST 니어/파 포스트
  const third = owner && owner.team === a.team && owner !== a && bnx >= O.lateRunFromX;
  const wide = third && Math.abs(bny - 0.5) >= O.lateRunWide;
  let job: ReturnType<typeof finalThirdJob> = null;
  // 측면 공이면 침투 중인 선수도 박스 안 역할 자리로 (E.22 B: 침투 중인 반대편 윙어가 자기 측면 라인에 머물러 박스 인원이 모자랐다)
  if (third && (!running || wide)) {
    const side = bny < 0.5 ? -1 : 1;
    job = finalThirdJob(s, a, owner);
    // 중앙이면 ST 는 그대로, 침투 미드는 공 반대편 박스 채널로 늦게 들어간다 (2선 박스 도착, E.15.1)
    if (!wide && (job === 'near' || job === 'far')) job = null;
    if (wide && job === 'halfSpace') job = null;
    if (job === 'nine') {
      // 펄스 나인 인계 (C.77d 가설 1): 내려온 9번이 비운 자리 — 라인 바로 앞 중앙 (공 쪽으로 조금)
      nx = line - 0.5 / L;
      ny = 0.5 + side * 0.04;
    } else if (job === 'cutback' && !wide) {
      nx = 1 - O.boxRunDepth / L;
      ny = 0.5 - side * O.boxRunSpread;
    } else if (job === 'cutback') {
      // 2선 늦은 침투 (E.22 B): 측면 공이면 페널티 지점 부근 박스 안으로 (컷백·크로스 모두 받는 자리)
      nx = 1 - O.lateRunDepth / L;
      ny = 0.5 + side * 0.04;
    } else if (job === 'edge') {
      nx = 1 - O.edgeZone / L;
      ny = 0.5 - side * 0.05;
    } else if (job === 'near' || job === 'far') {
      nx = 1 - O.postDepth / L;
      ny = 0.5 + (job === 'near' ? side : -side) * (O.postSpread / W);
    } else if (job === 'backPost') {
      nx = 1 - O.backPostDepth / L;
      ny = 0.5 - side * O.backPostSpread;
    } else if (job === 'halfSpace') {
      nx = 1 - O.halfSpaceDepth / L;
      ny = 0.5 + Math.sign(a.sy - 0.5) * O.halfSpaceSpread;
    }
    if (job) {
      nx = Math.min(nx, line - 0.5 / L);
      const [px, py] = toPitch(nx, ny, dir);
      urgent = dist(px, py, a.x, a.y) > 6;
    }
  }
  // 측면 미드 도착 (C.78e ①): 중원 줄 LM/RM 은 공이 상대 진영 wideFromX 를 넘는 순간(최종 ⅓ 진입 전)부터 역할 자리로 출발한다 —
  // 반대쪽 측면 공 = 먼 포스트(크로스 대상), 같은 쪽 측면 = 오버랩(바깥·앞) 또는 언더랩(하프스페이스) — 같은 쪽 풀백·소유자가 터치라인을 쓰면 언더랩,
  // 중앙 공 = 넓게 머무는 역할(정통 윙어·와이드 미드)은 깊이 잡은 측면, 안으로 들어오는 역할은 하프스페이스. 도착이 wideLate 초보다 늦으면 전력으로
  // 우리 패스가 날아가는 중이면 받는 선수를 소유자로 본다 (패스마다 자리를 놓고 멈추지 않게)
  let wideJob = false;
  const wOwner = owner ?? (fl && fl.receiver >= 0 && fl.outcome === 'receive' && s.agents[fl.passer]?.team === a.team ? s.agents[fl.receiver]! : null);
  if (O.wideArrive > 0 && a.line === 2 && (a.pos === 'LM' || a.pos === 'RM') && wOwner && wOwner.team === a.team && wOwner !== a && bnx >= O.wideFromX && (!running || Math.abs(bny - 0.5) >= O.lateRunWide)) {
    const t = wideMidSpot(s, a, wOwner, dir, bny, line);
    if (t) {
      [nx, ny] = t;
      const [px, py] = toPitch(nx, ny, dir);
      urgent = arrival(a, px, py, true) > O.wideLate;
      job = null;
      wideJob = true;
    }
  }
  // 역할 움직임 모듈 (E.6 D.13): ② 줄 사이 이동, ① 빈 공간 찾기 (침투·최종 3분의 1 역할 중이 아닐 때)
  const mate = !!owner && owner.team === a.team && owner !== a;
  if (!running && !job && !wideJob && hasModule(a.role, 'between')) [nx, ny] = betweenLines(s, a, dir, nx, ny, bnx);
  if (!running && !job && !wideJob && mate && hasModule(a.role, 'space')) [nx, ny] = findSpace(s, a, dir, nx, ny, line);
  // 내려와서 받기 / 지원 간격 (티키타카는 지원 삼각형 간격이 좁다, E.19)
  const tiki = s.teams[a.team].tactics.tendency === 'tikitaka';
  // 빌드업 전술: 짧게일수록 지원 간격이 좁다 (E.19 ③)
  const sk = 1 + F.styleSupport * (0.5 - s.teams[a.team].tactics.style);
  // 진단 스위치 (엔진관리자23 c79y, 0 = 끔): 티키 지원 간격 ×tikiSupportMul · 게겐 지원 간격 ×gegenCompact (엔진관리자21 가설 1)
  const supMul = tiki && TENDENCY.tikiSupportMul > 0 ? TENDENCY.tikiSupportMul
    : s.teams[a.team].tactics.tendency === 'gegenpress' && TENDENCY.gegenCompact > 0 ? TENDENCY.gegenCompact : 1;
  let supMin = (tiki ? TENDENCY.tikiSupport[0] : O.supportMin) * sk * supMul;
  const supMax = (tiki ? TENDENCY.tikiSupport[1] : O.supportMax) * sk * supMul;
  if (owner && owner.team === a.team && owner !== a && !job && !wideJob) {
    // 압박받는 소유자 (C.78g): 가장 가까운 상대가 supportPressDist m 안이면 가까울수록 최소 간격을 supportPress 몫까지 줄인다 — 짧은 탈출 패스 각도
    if (O.supportPress > 0) supMin *= 1 - O.supportPress * Math.max(0, 1 - nearestFieldOpp(s, owner)[1] / O.supportPressDist);
    const [ox, oy] = toNorm(owner.x, owner.y, dir);
    if (!running && a.role.drop > 0 && nx > ox) nx -= (a.role.drop * O.dropDist) / L * 0.5;
    const [px, py] = toPitch(nx, ny, dir);
    const d = dist(px, py, owner.x, owner.y);
    if (d < supMin && d > 0.1 && !(running && a.giveGo)) {
      const k = supMin / d;
      const [qx, qy] = [owner.x + (px - owner.x) * k, owner.y + (py - owner.y) * k];
      [nx, ny] = toNorm(qx, qy, dir);
    } else if (d > supMax && a.line === 2 && !running) {
      // 지원 간격 (E.6): 중원 줄은 소유자에게서 supportMax 안에서 받을 자리를 잡는다
      const k = supMax / d;
      const [qx, qy] = [owner.x + (px - owner.x) * k, owner.y + (py - owner.y) * k];
      [nx, ny] = toNorm(qx, qy, dir);
    } else if (d > supMax + 15 && a.line >= 2) {
      // 너무 멀면 공 쪽으로 약간
      nx += (ox - nx) * 0.15;
      ny += (oy - ny) * 0.15;
    }
  }
  // ③ 공 요구 (E.6 D.13): 소유자 쪽으로 다가가 받을 자리를 내민다 (지원 간격 최소까지)
  if (!running && !job && !wideJob && mate && hasModule(a.role, 'demand')) {
    const [px, py] = toPitch(nx, ny, dir);
    const d = dist(px, py, owner!.x, owner!.y);
    if (d > supMin + 1) {
      const k = Math.min(RM.demandApproach, (d - supMin) / d);
      [nx, ny] = toNorm(px + (owner!.x - px) * k, py + (owner!.y - py) * k, dir);
    }
  }
  // 수적 우세 프리맨 (E.18 A6): 마크가 없는 선수 중 공에 가장 가까운 1명은 공 쪽 빈 공간으로 (효용 가산 없음)
  if (!running && owner && owner.team === a.team && owner !== a && a.line >= 1 && manDiff(s, a.team) > 0 && isFreeman(s, a, owner)) {
    const spot = freeSpot(s, a, owner);
    if (spot) [nx, ny] = toNorm(spot[0], spot[1], dir);
  }
  // ⒞ 자리 교환 (C.77y): 같은 줄 동료가 자기 자리에서 내려와 비운 자리를 가장 가까운 같은 줄 동료 1명이 맡는다
  if (!running && !job && !wideJob && mate && O.swapShare > 0) {
    const sw = swapPlan(s, a.team, dir);
    if (sw && sw.b === a.idx) {
      nx += (sw.nx - nx) * O.swapShare;
      ny += (sw.ny - ny) * O.swapShare;
    }
  }
  // ⒜ 받으러 나오기 (C.77y): 마커가 checkMark m 안이면 마커 반대쪽 옆으로 짧게 (공 쪽으로 조금) 움직여 패스 각도를 만든다
  if (!running && !job && !wideJob && mate && O.checkDist > 0 && a.line >= 2 && dist(a.x, a.y, owner!.x, owner!.y) <= O.checkPassMax) {
    const [m, md] = nearestFieldOpp(s, a);
    if (m && md <= O.checkMark) {
      const bx = owner!.x - a.x;
      const by = owner!.y - a.y;
      const bl = Math.hypot(bx, by) || 1;
      // 공 방향에 수직인 두 방향 중 마커에서 멀어지는 쪽
      let px = -by / bl;
      let py = bx / bl;
      if (px * (a.x - m.x) + py * (a.y - m.y) < 0) [px, py] = [-px, -py];
      const k = O.checkDist;
      const x = clamp(a.x + px * k + (bx / bl) * k * O.checkToBall, 1, L - 1);
      const y = clamp(a.y + py * k + (by / bl) * k * O.checkToBall, 1, W - 1);
      const [cnx, cny] = toNorm(x, y, dir);
      nx = Math.min(cnx, line - 0.5 / L);
      ny = cny;
      urgent = true;
    }
  }
  void bny;
  setTarget(a, nx, ny, dir, urgent);
}

const FB_POS = new Set(['LB', 'RB', 'LWB', 'RWB']);
const WIDE_POS = new Set(['LW', 'RW', 'LM', 'RM']);

/**
 * 풀백 오버래핑 조건 (C.78i ②, 정규화 = 풀백 팀 공격 방향): 풀백(줄 사이 역할 제외)·공 fbOverlapFromX 이상·같은 팀 다른 오버래핑 없음 ·
 * 앞 측면 길(자기 x + fbOverlapAhead m, 터치라인 wideTouch)의 fbOverlapFree m 안 상대 없음 ·
 * 남은 수비(같은 줄 다른 수비 + CDM, 공보다 우리 골 쪽) ≥ 공보다 우리 골 쪽 상대 필드 선수 + fbOverlapRest (높이 남은 공격수가 풀백을 묶는다).
 * 돌려주는 값 = 확률 배수: 0 안 됨 · 그 측면 상대 윙어(LW/RW/LM/RM)가 면제 역할이 아니고 fbTrackDist m 안이면 따라 내려오므로 fbOverlapTracked · 아니면 1 (높이 남은 크랙형·빈 측면)
 */
function overlapReady(s: SimState, a: Agent, dir: 1 | -1, bnx: number): number {
  if (a.line !== 1 || !FB_POS.has(a.pos) || hasModule(a.role, 'between') || bnx < O.fbOverlapFromX) return 0;
  const side = a.sy < 0.5 ? -1 : 1;
  const [anx] = toNorm(a.x, a.y, dir);
  let rest = 0;
  let high = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.line === 0) continue;
    const onx = toNorm(o.x, o.y, dir)[0];
    if (o.team === a.team) {
      if (o !== a && o.overlap && s.t < o.runUntil) return 0;
      if (o !== a && (o.line === 1 || o.pos === 'CDM') && onx < bnx) rest++;
    } else if (onx < bnx) high++;
  }
  if (rest < high + O.fbOverlapRest) return 0;
  const [px, py] = toPitch(Math.min(0.97, anx + O.fbOverlapAhead / L), 0.5 + side * O.wideTouch, dir);
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && dist(o.x, o.y, px, py) < O.fbOverlapFree) return 0;
  const w = sideWinger(s, a);
  return w && !hasModule(w.role, 'exempt') && dist(w.x, w.y, a.x, a.y) <= O.fbTrackDist ? O.fbOverlapTracked : 1;
}

/** 풀백 a 의 측면을 맡는 상대 윙어 (슬롯 기준: 상대 정규화 y 는 반대라 슬롯 y 가 반대쪽이면 같은 측면). 여럿이면 가까운 쪽 */
function sideWinger(s: SimState, a: Agent): Agent | null {
  const side = a.sy < 0.5 ? -1 : 1;
  let w: Agent | null = null;
  let wd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || !WIDE_POS.has(o.pos) || Math.sign(o.sy - 0.5) !== -side) continue;
    const d = dist(o.x, o.y, a.x, a.y);
    if (d < wd) { wd = d; w = o; }
  }
  return w;
}

/** 오버래핑 추적 (C.78i ②): 면제 아닌 측면 선수(LW/RW/LM/RM)가 맡는 측면의 상대 풀백이 오버래핑 중이고 fbTrackDist × 1.5 m 안이면 그 풀백 */
function overlapToTrack(s: SimState, a: Agent): Agent | null {
  if (O.fbOverlap <= 0 || !WIDE_POS.has(a.pos) || hasModule(a.role, 'exempt')) return null;
  const side = a.sy < 0.5 ? -1 : 1;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || !o.overlap || s.t >= o.runUntil || Math.sign(o.sy - 0.5) !== -side) continue;
    if (dist(o.x, o.y, a.x, a.y) <= O.fbTrackDist * 1.5) return o;
  }
  return null;
}

/** 안으로 들어오는 측면 역할 (C.78e ①): 같은 쪽 측면 공이면 언더랩, 중앙 공이면 하프스페이스 */
const INSIDE_WIDE = new Set(['wingForward', 'raumdeuter', 'crackWinger']);

/** 측면 미드 도착 자리 (C.78e ①, 정규화). null = 기존 규칙 */
function wideMidSpot(s: SimState, a: Agent, owner: Agent, dir: 1 | -1, bny: number, line: number): [number, number] | null {
  const side = a.sy < 0.5 ? -1 : 1;
  const cap = line - 0.5 / L;
  if (Math.abs(bny - 0.5) >= O.lateRunWide) {
    const ballSide = bny < 0.5 ? -1 : 1;
    // 반대쪽 측면: 먼 포스트 (크로스 대상)
    if (ballSide !== side) return [Math.min(cap, 1 - O.backPostDepth / L), 0.5 - ballSide * O.backPostSpread];
    const [onx, ony] = toNorm(owner.x, owner.y, dir);
    let fb: Agent | null = null;
    for (const o of s.agents) if (o.onPitch && o.team === a.team && o.line === 1 && (o.pos === 'LB' || o.pos === 'RB' || o.pos === 'LWB' || o.pos === 'RWB') && Math.sign(o.sy - 0.5) === side) fb = o;
    const fbOut = !!fb && fb !== owner && (() => { const [fx, fy] = toNorm(fb.x, fb.y, dir); return fx >= onx - O.wideFbAhead / L && Math.abs(fy - 0.5) >= Math.abs(toNorm(a.x, a.y, dir)[1] - 0.5); })();
    // 같은 쪽: 풀백이 공을 가졌거나 바깥으로 올라와 있거나 소유자가 터치라인을 쓰면 언더랩, 아니면 역할대로 (안쪽 역할 = 언더랩)
    const under = owner === fb || fbOut || Math.abs(ony - 0.5) >= O.wideTouch || INSIDE_WIDE.has(a.role.id);
    if (under) return [Math.min(cap, Math.max(onx + O.underlapAhead / L, 1 - O.halfSpaceDepth / L)), 0.5 + side * O.halfSpaceSpread];
    return [Math.min(cap, Math.max(onx + O.overlapAhead / L, cap - O.wideDepth / L)), 0.5 + side * O.wideTouch];
  }
  // 중앙 공: 넓게 머무는 역할은 깊이 잡은 측면, 안쪽 역할은 하프스페이스
  if (INSIDE_WIDE.has(a.role.id)) return [Math.min(cap, 1 - O.halfSpaceDepth / L), 0.5 + side * O.halfSpaceSpread];
  return [cap - O.wideDepth / L, 0.5 + side * O.wideTouch];
}

/** 가장 가까운 상대 필드 선수 (GK 제외) */
function nearestFieldOpp(s: SimState, a: Agent): [Agent | null, number] {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const d = dist(o.x, o.y, a.x, a.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return [best, bd];
}

/** 소유자 → 점 패스 길 위험 (onball laneRisk 와 같은 식, 순환 import 를 피해 여기 둔다) */
function laneRisk(s: SimState, from: Agent, tx: number, ty: number): { risk: number } {
  const PR = ENGINE.prob;
  let risk = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === from.team) continue;
    const [d, t] = segDist(o.x, o.y, from.x, from.y, tx, ty);
    if (d >= PR.laneWidth || t <= 0.05) continue;
    risk += (PR.laneBase + (PR.laneIntercept * o.attrs.interception) / 100) * (1 - d / PR.laneWidth);
  }
  return { risk };
}

/** 자리 교환 계획 (C.77y): 팀에서 자기 자리보다 swapDrop m+ 가장 많이 내려온 2·3줄 선수의 자리와 그 자리를 맡을 같은 줄 동료 1명. 틱마다 한 번 계산 */
/**
 * CB 빈자리 (C.78e ②): 상대 CB 가 따라 나가기로 했고(stepOutGo) 나머지 수비 줄보다 gapOpen m 이상 앞에 있으면 그 CB 의 y 채널·수비 줄 깊이가 빈자리.
 * 그 자리에 가장 먼저 닿는(도착 시간) 우리 줄 2·3 선수 1명(공 가진 선수·따라 나간 CB 가 붙은 선수 제외, gapReach 초 안)이 침투한다. 판단은 위치만 (E.15.1)
 */
const gapCache = new WeakMap<SimState, { tick: number; plan: ({ runner: number; ny: number } | null | undefined)[] }>();
function gapPlan(s: SimState, team: 0 | 1, dir: 1 | -1): { runner: number; ny: number } | null {
  let c = gapCache.get(s);
  if (!c || c.tick !== s.tick) {
    c = { tick: s.tick, plan: [undefined, undefined] };
    gapCache.set(s, c);
  }
  const cached = c.plan[team];
  if (cached !== undefined) return cached;
  let plan: { runner: number; ny: number } | null = null;
  for (const cb of s.agents) {
    if (!cb.onPitch || cb.team === team || cb.pos !== 'CB' || !cb.stepOutGo || cb.stepOutIdx < 0) continue;
    let lx = 0;
    let n = 0;
    for (const o of s.agents) if (o.onPitch && o.team === cb.team && o.line === 1 && o !== cb) { lx += toNorm(o.x, o.y, dir)[0]; n++; }
    if (!n) continue;
    lx /= n;
    const [cnx, cny] = toNorm(cb.x, cb.y, dir);
    if ((lx - cnx) * L < O.gapOpen) continue;
    const [px, py] = toPitch(lx, cny, dir);
    let best: number = O.gapReach;
    for (const a of s.agents) {
      if (!a.onPitch || a.team !== team || a.line < 2 || a.idx === s.ball.owner || a.idx === cb.stepOutIdx || s.t < a.runUntil) continue;
      const t = arrival(a, px, py);
      if (t < best) {
        best = t;
        plan = { runner: a.idx, ny: cny };
      }
    }
    if (plan) break;
  }
  c.plan[team] = plan;
  return plan;
}

const swapCache = new WeakMap<SimState, { tick: number; plan: (SwapPlan | null | undefined)[] }>();
interface SwapPlan { b: number; nx: number; ny: number }
function swapPlan(s: SimState, team: 0 | 1, dir: 1 | -1): SwapPlan | null {
  let c = swapCache.get(s);
  if (!c || c.tick !== s.tick) {
    c = { tick: s.tick, plan: [undefined, undefined] };
    swapCache.set(s, c);
  }
  const cached = c.plan[team];
  if (cached !== undefined) return cached;
  let best: Agent | null = null;
  let bestDrop: number = O.swapDrop;
  let spot: [number, number] = [0, 0];
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line < 2 || s.t < o.runUntil || s.ball.owner === o.idx) continue;
    const [sx, sy] = slotTarget(s, o);
    const drop = (sx - toNorm(o.x, o.y, dir)[0]) * L;
    if (drop >= bestDrop) {
      bestDrop = drop;
      best = o;
      spot = [sx, sy];
    }
  }
  let plan: SwapPlan | null = null;
  if (best) {
    const [px, py] = toPitch(spot[0], spot[1], dir);
    let bd: number = O.swapRange;
    for (const o of s.agents) {
      if (!o.onPitch || o.team !== team || o === best || o.line !== best.line || s.t < o.runUntil || s.ball.owner === o.idx) continue;
      const d = dist(o.x, o.y, px, py);
      if (d < bd) {
        bd = d;
        plan = { b: o.idx, nx: spot[0], ny: spot[1] };
      }
    }
  }
  c.plan[team] = plan;
  return plan;
}

/** 상대 팀 줄 평균 x (우리 공격 방향 정규화). 그 줄에 아무도 없으면 null */
function oppLineX(s: SimState, team: 0 | 1, dir: 1 | -1, line: number): number | null {
  let t = 0;
  let n = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team || o.line !== line) continue;
    t += toNorm(o.x, o.y, dir)[0];
    n++;
  }
  return n ? t / n : null;
}

/** 우리 팀 줄 평균 x (정규화) */
function ownLineX(s: SimState, a: Agent, dir: 1 | -1, line: number): number | null {
  let t = 0;
  let n = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== a.team || o.line !== line || o === a) continue;
    t += toNorm(o.x, o.y, dir)[0];
    n++;
  }
  return n ? t / n : null;
}

/**
 * ② 줄 사이 이동 (E.6 D.13): 펄스 나인은 상대 수비 줄과 미드 줄 사이로 내려온다. 빌드업(공이 우리 진영 쪽) 때
 * 하프백은 CB 사이로 내려가 3백을 만들고, 인버티드 풀백은 미드 줄 하프스페이스로 좁히고, 리베로는 수비 줄과 미드 줄 사이로 올라선다
 */
function betweenLines(s: SimState, a: Agent, dir: 1 | -1, nx: number, ny: number, bnx: number): [number, number] {
  const kind = a.role.id === 'halfBack' ? 'drop' : a.role.id === 'libero' ? 'step' : a.role.id === 'invertedFullback' ? 'invert' : 'gap';
  if (kind === 'gap') {
    const def = oppLineX(s, a.team, dir, 1);
    const mid = oppLineX(s, a.team, dir, 2);
    if (def === null || mid === null) return [nx, ny];
    // 상대 기준 줄 x 는 우리 방향으로 뒤집혀 있다 (상대 수비 줄이 더 깊다 = 우리 기준 x 가 크다)
    const gap = (def + mid) / 2;
    return [nx + (gap - nx) * RM.betweenK, ny];
  }
  if (bnx > RM.buildupX) return [nx, ny];
  const side = a.sy < 0.5 ? -1 : 1;
  if (kind === 'drop') {
    const cb = ownLineX(s, a, dir, 1);
    return cb === null ? [nx, ny] : [cb, 0.5];
  }
  const mid = ownLineX(s, a, dir, 2);
  if (mid === null) return [nx, ny];
  if (kind === 'step') return [Math.max(nx, (nx + mid) / 2), ny];
  return [Math.max(nx, mid - 0.02), 0.5 + side * RM.invertY];
}

/**
 * ① 빈 공간 찾기 (E.6 D.13): 역할 목표 주변 spaceRadius m 안에서 가장 가까운 상대가 가장 먼 곳 (앞쪽 조금 우선).
 * 오프사이드 라인은 넘지 않는다. 위치만 고르고 결과는 바꾸지 않는다 (E.15.1)
 */
function findSpace(s: SimState, a: Agent, dir: 1 | -1, nx: number, ny: number, line: number): [number, number] {
  const [cx, cy] = toPitch(nx, ny, dir);
  let best: [number, number] = [nx, ny];
  let bestScore = -Infinity;
  for (let k = -1; k < 12; k++) {
    const r = k < 0 ? 0 : RM.spaceRadius * (k % 2 ? 1 : 0.55);
    const ang = (k / 12) * Math.PI * 2;
    const x = clamp(cx + Math.cos(ang) * r, 2, L - 2);
    const y = clamp(cy + Math.sin(ang) * r, 2, W - 2);
    const [px, py] = toNorm(x, y, dir);
    if (px > line - 0.5 / L) continue;
    let near: number = RM.spaceCap;
    for (const o of s.agents) if (o.onPitch && o.team !== a.team) near = Math.min(near, dist(o.x, o.y, x, y));
    const score = near + RM.spaceForward * (px - nx) * L;
    if (score > bestScore) {
      bestScore = score;
      best = [px, py];
    }
  }
  return best;
}

/** ④ 커버 재배분 (E.6 D.13): 수비 의무를 면제받은 동료(중원·공격 줄)의 자리 쪽 y 로 가장 가까운 중원 동료 1명이 옮긴다 */
function coverShiftY(s: SimState, a: Agent, ny: number): number {
  if (a.line !== 2 || exemptOf(s, a)) return ny;
  for (const e of s.agents) {
    if (!e.onPitch || e.team !== a.team || e.line < 2 || !exemptOf(s, e)) continue;
    let pick: Agent | null = null;
    let pd = Infinity;
    for (const o of s.agents) {
      if (!o.onPitch || o.team !== a.team || o.line !== 2 || o === e || exemptOf(s, o)) continue;
      const d = Math.abs(o.sy - e.sy) + Math.abs(o.sx - e.sx) * 0.5;
      if (d < pd - 1e-9) {
        pd = d;
        pick = o;
      }
    }
    if (pick === a) ny += (e.sy - ny) * RM.coverShift;
  }
  return ny;
}

function unmarked(s: SimState, a: Agent): boolean {
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && dist(o.x, o.y, a.x, a.y) < ENGINE.referee.freeMark) return false;
  return true;
}

/** 마크가 없는 필드 선수 중 공에 가장 가까운 선수인가 */
function isFreeman(s: SimState, a: Agent, owner: Agent): boolean {
  if (!unmarked(s, a)) return false;
  const d = dist(a.x, a.y, owner.x, owner.y);
  for (const o of s.agents) {
    if (o === a || o === owner || !o.onPitch || o.team !== a.team || o.line === 0) continue;
    if (dist(o.x, o.y, owner.x, owner.y) < d && unmarked(s, o)) return false;
  }
  return true;
}

/** 소유자에게서 12~20 m, 가장 가까운 상대에게서 6 m 이상인 빈 곳 중 가장 여유 있는 곳 (공격 방향 앞쪽 우선) */
function freeSpot(s: SimState, a: Agent, owner: Agent): [number, number] | null {
  const R = ENGINE.referee;
  const dir = attackDir(a.team, s.half);
  let best: [number, number] | null = null;
  let bestScore = -Infinity;
  for (const r of [R.freeMin, (R.freeMin + R.freeMax) / 2, R.freeMax]) {
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const x = owner.x + Math.cos(ang) * r;
      const y = owner.y + Math.sin(ang) * r;
      if (x < 2 || x > L - 2 || y < 2 || y > W - 2) continue;
      let near = Infinity;
      for (const o of s.agents) if (o.onPitch && o.team !== a.team) near = Math.min(near, dist(o.x, o.y, x, y));
      if (near < R.freeSpace) continue;
      const score = near + 0.15 * (x - owner.x) * dir - 0.05 * dist(x, y, a.x, a.y);
      if (score > bestScore) {
        bestScore = score;
        best = [x, y];
      }
    }
  }
  return best;
}

/**
 * 공이 상대 최종 3분의 1 측면일 때의 역할 (E.18 A2): 침투 성향(run ≥ 0.4) CM/CAM 중 공에 가장 가까운 1명은 컷백 존,
 * 다음 미드 1명은 박스 경계 바깥(세컨드 볼, 중거리), ST/CF 2명은 니어/파 포스트 (공에 가까운 쪽이 니어)
 */
export function finalThirdJob(s: SimState, a: Agent, owner: Agent): 'nine' | 'cutback' | 'edge' | 'near' | 'far' | 'backPost' | 'halfSpace' | null {
  const mates = s.agents.filter((o) => o.onPitch && o.team === a.team && o !== owner);
  const bd = (o: Agent) => dist(o.x, o.y, s.ball.x, s.ball.y);
  // 윙어: 공이 반대쪽 측면이면 먼 포스트로, 공이 중앙이면 같은 쪽 하프스페이스로 파고든다
  if (a.pos === 'LW' || a.pos === 'RW' || a.pos === 'LM' || a.pos === 'RM') {
    const by = toNorm(s.ball.x, s.ball.y, attackDir(a.team, s.half))[1];
    if (Math.abs(by - 0.5) >= O.lateRunWide) return Math.sign(by - 0.5) !== Math.sign(a.sy - 0.5) ? 'backPost' : null;
    // 공이 중앙이면 공에서 먼 쪽 윙어는 먼 포스트로 파고들고, 가까운 쪽은 하프스페이스 (E.20, 박스 도착 인원)
    return Math.sign(a.sy - 0.5) !== Math.sign(by - 0.5) ? 'backPost' : 'halfSpace';
  }
  if (a.pos === 'ST' || a.pos === 'CF') {
    const sts = mates.filter((o) => o.pos === 'ST' || o.pos === 'CF');
    // 1톱이면 니어 포스트 (E.22 B: 크로스 순간 박스 안 인원)
    if (sts.length < 2) return 'near';
    return sts.sort((x, y) => bd(x) - bd(y))[0] === a ? 'near' : 'far';
  }
  if (a.pos !== 'CM' && a.pos !== 'CAM' && a.pos !== 'CDM') return null;
  // 침투 성향(run ≥ lateRunRun) CM/CAM 중 공에 가장 가까운 1명. 없으면 run 이 가장 높은 CM/CAM (누군가는 2선에서 도착한다, E.20)
  const mids = mates.filter((o) => o.pos === 'CM' || o.pos === 'CAM');
  const runners = mids.filter((o) => o.role.run >= O.lateRunRun).sort((x, y) => bd(x) - bd(y));
  const runner = runners[0] ?? mids.slice().sort((x, y) => y.role.run - x.role.run || bd(x) - bd(y))[0];
  if (runner === a) return deepNine(s, a.team) ? 'nine' : 'cutback';
  const rest = mates.filter((o) => (o.pos === 'CM' || o.pos === 'CAM' || o.pos === 'CDM') && o !== runner).sort((x, y) => bd(x) - bd(y));
  return rest[0] === a ? 'edge' : null;
}

/**
 * CB 따라나옴 판단 (C.77d 가설 2, §9.13.5): 상대 공격 줄(줄 3, 공 가진 선수 제외)이 실제 라인보다 stepOutMin~stepOutReach m 앞(줄 사이)에 있고
 * 공이 우리 골 stepOutBall[0]~[1] m 일 때, 그 선수에게 가장 가까운 CB 1명이 따라 나갈지 정한다 (역할 이름은 보지 않는다 — 물리 조건).
 * p = clamp(stepOutBase + stepOutDecoy × 미끼 − stepOutJudge × 판단, stepOutP). 미끼 = 다른 상대(줄 2·3)가 이 CB decoyZone m 안에서
 * 우리 골 쪽으로 decoySpeed m/s 이상 달리고 있음(짝이 뒷공간을 노릴 때만 속임이 된다), 판단 = clamp((수비 위치선정 − 50) / 40, 0, 1).
 * 결정은 stepOutHold 초 유지(시드 난수). 따라 나가기로 했으면 그 상대, 아니면 null
 */
function stepOutPick(s: SimState, a: Agent, dir: 1 | -1, ballGoal: number): Agent | null {
  if (a.pos !== 'CB' || ballGoal < O.stepOutBall[0] || ballGoal > O.stepOutBall[1]) {
    a.stepOutIdx = -1;
    return null;
  }
  let pick: Agent | null = null;
  let pd = Infinity;
  // 줄 사이 깊이는 실제 라인(상대에게 오프사이드 라인 = 우리 둘째 수비수) 기준 — 전술 라인 lineX 는 공이 25~45 m 일 때 실제 라인보다 깊다 (C.77d 조정 1)
  const opp = (a.team === 0 ? 1 : 0) as 0 | 1;
  const oline = offsideLine(s, opp);
  const odir = attackDir(opp, s.half);
  for (const o of s.agents) {
    // C.78e ②: 공을 가졌거나 받는 중인 공격수도 판단한다 (줄 사이 수신 — 따라 나가 붙을지)
    if (!o.onPitch || o.team === a.team || o.line !== 3 || (O.stepOutMidLead <= 0 && o.idx === s.ball.owner)) continue;
    const ahead = (oline - toNorm(o.x, o.y, odir)[0]) * L;
    if (ahead < O.stepOutMin || ahead > O.stepOutReach) continue;
    // 그 상대에게 가장 가까운 CB 만 판단한다
    const d = dist(o.x, o.y, a.x, a.y);
    if (s.agents.some((c) => c !== a && c.onPitch && c.team === a.team && c.pos === 'CB' && c.line === 1 && dist(o.x, o.y, c.x, c.y) < d)) continue;
    if (d < pd) {
      pd = d;
      pick = o;
    }
  }
  if (!pick) {
    a.stepOutIdx = -1;
    return null;
  }
  if (pick.idx !== a.stepOutIdx || s.t >= a.stepOutUntil) {
    const decoy = s.agents.some((o) => o.onPitch && o.team !== a.team && o !== pick && (o.line === 2 || o.line === 3)
      && o.vx * dir <= -O.decoySpeed && dist(o.x, o.y, a.x, a.y) <= O.decoyZone) ? 1 : 0;
    const judge = clamp((a.attrs.defensivePositioning - 50) / 40, 0, 1);
    let p = clamp(O.stepOutBase + O.stepOutDecoy * decoy - O.stepOutJudge * judge, O.stepOutP[0], O.stepOutP[1]);
    // 줄 사이 수신 판단 (C.78e ②, C.78d 와 같은 판단): 우리 중원 줄 누가 그 선수에게 CB 보다 stepOutMidLead 초 이상 먼저 닿으면 중원이 압박하고 CB 는 라인을 지킨다.
    // 판단 좋은 CB 일수록 이 구분이 정확하다 (중원이 먼저면 p × (1 − 판단 × stepOutMidCut), 아무도 못 닿으면 + 판단 × stepOutAlone)
    if (O.stepOutMidLead > 0) {
      const tc = arrival(a, pick.x, pick.y);
      const midFirst = s.agents.some((m) => m.onPitch && m.team === a.team && m.line === 2 && arrival(m, pick.x, pick.y) + O.stepOutMidLead <= tc);
      p = clamp(midFirst ? p * (1 - judge * O.stepOutMidCut) : p + judge * O.stepOutAlone, O.stepOutP[0], O.stepOutP[1]);
    }
    a.stepOutIdx = pick.idx;
    a.stepOutGo = rand(s.seed, s.tick, a.idx, Purpose.StepOut) < p;
    a.stepOutUntil = s.t + O.stepOutHold;
  }
  return a.stepOutGo ? pick : null;
}

/**
 * 펄스 나인이 내려와 9번 자리가 비었는가 (C.77d 가설 1): 팀의 ST/CF 가 한 명이고 줄 사이 역할(between)이며
 * 오프사이드 라인보다 roles.nineDeepGap m 이상 뒤에 있다
 */
function deepNine(s: SimState, team: 0 | 1): boolean {
  if (RM.nineDeepGap <= 0) return false;
  let st: Agent | null = null;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || (o.pos !== 'ST' && o.pos !== 'CF')) continue;
    if (st) return false;
    st = o;
  }
  if (!st || !hasModule(st.role, 'between')) return false;
  const [sx] = toNorm(st.x, st.y, attackDir(team, s.half));
  return (offsideLine(s, team) - sx) * L >= RM.nineDeepGap;
}

/**
 * 슛 레인 (C.78h): 수비 a 가 읽은 상대 소유자 o 의 찰 만한 구석 쪽(우리 골 gy 기준 ±1). 그 구석으로 차는 발의 약발 배율 + 몸 방향(hx, hy 와 그 구석 방향의 cos × laneFace)
 * + 우리 GK 반대편 laneGk, 같으면 주발 쪽. 판단력이 낮으면 반대로 읽는다 (판단 주기 errTick 마다 새로 뽑는 해시 난수)
 */
function laneGuess(s: SimState, a: Agent, o: Agent, gx: number, gy: number): -1 | 1 {
  const od = attackDir(o.team, s.half);
  const cy = 0.5 * (ENGINE.pitch.goalWidth / 2 - 0.3);
  const far = farSide(keeperOf(s, a.team), gy);
  let best: -1 | 1 = 1;
  let bestV = -Infinity;
  for (const sd of [-1, 1] as const) {
    const dx = gx - o.x;
    const dy = gy + sd * cy - o.y;
    let v = weakFootMul(o.body, od, dx, dy);
    // 몸 방향 (hx, hy: 단위 벡터, 움직이면 달리는 방향)
    v += O.laneFace * ((o.hx * dx + o.hy * dy) / (Math.hypot(dx, dy) || 1));
    if (far === sd) v += O.laneGk;
    // 같으면 주발 쪽: 오른발은 공격 방향 왼쪽(y × 공격 방향 < 0)으로 감아 찬다 (body weakFootMul 과 같은 약속)
    if (v === bestV ? (o.body.foot === 'right' ? -od : od) === sd : v > bestV) {
      best = sd;
      bestV = v;
    }
  }
  const judge = (a.attrs.defensivePositioning + a.attrs.interception) / 200;
  return rand(s.seed, a.errTick, a.idx, Purpose.Mark, 7) < O.laneMiss * (1 - judge) ? (-best as -1 | 1) : best;
}

/** 슛 레인 자리 (C.78h): 소유자 o 에서 우리 골 sd 쪽 기대 구석으로 가는 길 위 gap m */
function laneSpot(o: Agent, gx: number, gy: number, sd: number, gap: number): [number, number] {
  const ty = gy + sd * 0.5 * (ENGINE.pitch.goalWidth / 2 - 0.3);
  const ld = dist(o.x, o.y, gx, ty) || 1;
  const k = Math.min(gap, ld * 0.8);
  return [clamp(o.x + ((gx - o.x) / ld) * k, 0.3, L - 0.3), clamp(o.y + ((ty - o.y) / ld) * k, 0.3, W - 0.3)];
}

function defendTarget(s: SimState, a: Agent, dir: 1 | -1, bnx: number, bny: number): void {
  const t = effectiveTactics(s, a.team);
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;

  // 역압박 (E.18 A3): 가담 선수 중 가장 가까운 1명은 소유자, 나머지는 소유자와 가까운 동료 사이 패스 길을 최대 속도로
  const tm = s.teams[a.team];
  if (owner && owner.team !== a.team && s.t < tm.counterUntil) {
    const k = tm.counterPressers.indexOf(a.idx);
    if (k === 0) {
      a.tx = owner.x;
      a.ty = owner.y;
      feedFrom(a, owner);
      a.urgent = true;
      return;
    }
    if (k > 0) {
      const mates = s.agents
        .filter((o) => o.onPitch && o.team === owner.team && o !== owner && o.line !== 0)
        .sort((x, y) => dist(x.x, x.y, owner.x, owner.y) - dist(y.x, y.y, owner.x, owner.y));
      const m = mates[k - 1];
      if (m) {
        a.tx = owner.x + (m.x - owner.x) * O.counterLane;
        a.ty = owner.y + (m.y - owner.y) * O.counterLane;
        a.urgent = true;
        return;
      }
    }
  }

  // 돌파 후 커버 (E.22 A): 동료가 제쳐졌으면 돌파한 선수의 골 쪽 진행 방향을 막는다
  if (owner && owner.team !== a.team && tm.coverAgent === a.idx && s.t < tm.coverUntil) {
    coverSpot(a, dir, owner.x, owner.y);
    return;
  }

  const [gx0, gy0] = ownGoal(dir);
  const boxZone = dist(b.x, b.y, gx0, gy0) < O.boxZone;
  // 줄 인원 맞춤 (C.79e 실험): 내려온 줄 2 선수는 아래에서 줄 1 처럼 행동한다
  const dropped = lineMatchPlan(s, a.team).drop.has(a.idx);
  const asDef = a.line === 1 || dropped;
  // 비행 중 수신자 압박 (C.76k 단계 B): 상대 패스가 우리 골 closeDownZone 안으로 떠 있으면 착지점에 가장 빨리 닿는 1명이 미리 나간다
  // 깊은 블록 (C.76p 가설 2): 간격 deepCloseDownGap, 수신자가 ST/CF 면 둘째도 착지점 골 쪽 deepCloseDownSecond m
  if (!owner && a.line !== 0) {
    const cd = closeDownPlan(s, a.team, gx0, gy0);
    if (cd.pick === a || cd.second === a) {
      const fl = b.flight!;
      const ld = dist(fl.toX, fl.toY, gx0, gy0) || 1;
      const gap = cd.pick === a ? (isDeepBlock(s, a.team) ? O.deepCloseDownGap : O.closeDownGap) : O.deepCloseDownSecond;
      a.tx = clamp(fl.toX + ((gx0 - fl.toX) / ld) * gap, 0.3, L - 0.3);
      a.ty = clamp(fl.toY + ((gy0 - fl.toY) / ld) * gap, 0.3, W - 0.3);
      a.urgent = true;
      return;
    }
  }
  // 깊은 블록 비행 중 가로채기 (C.76p 가설 1): 패스 선 위 가장 가까운 점에 공보다 먼저 닿는 1명이 선으로 들어간다
  if (!owner && a.line !== 0) {
    const cut = deepCutAgent(s, a.team, gx0, gy0);
    if (cut && cut.a === a) {
      a.tx = clamp(cut.x, 0.3, L - 0.3);
      a.ty = clamp(cut.y, 0.3, W - 0.3);
      a.urgent = true;
      return;
    }
  }
  // 압박: 공에 가까운 1~2명 (2번째는 상황표 인원이 2 이상이고 압박 성향이 높을 때, C.75c)
  if (owner && owner.team !== a.team) {
    const rank = ballRank(s, a, b.x, b.y);
    const pressDist = (O.pressDistBase + t.pressing * O.pressDistRange) * (a.line === 3 ? Math.max(0.1, O.attackerPress + O.attackerPressPer * (t.pressing - 0.55)) : 1);
    const d = dist(a.x, a.y, b.x, b.y);
    const danger = dist(b.x, b.y, gx0, gy0) < O.dangerPress;
    // 둘째 압박자 (C.76s 가설 1): 압박 높음이면 상황표 인원(2)대로 역할과 무관하게, 아니면 압박 성향 × 역할
    // 2단 체력 (C.78w): 순간 체력이 pressMin 아래인 선수는 둘째 압박에 가담하지 않는다(자기 체력만 보는 판단)
    const second = rank === 1 && sitPressers(s, a.team) >= 2 && (pressLevel(s, a.team) >= 2 || t.pressing * (0.5 + a.role.press) > 0.6)
      && (BU.on <= 0 || a.burst >= BU.pressMin);
    let wants = rank === 0 || second;
    // ④ 수비 의무 면제: 공에 가장 가깝고 아주 가까울 때만 압박한다
    const exempt = exemptOf(s, a);
    if (exempt && !(rank === 0 && d < pressDist * RM.exemptPress)) wants = false;
    // 박스 안 압박 (E.23, C.75c): 공이 우리 박스 안이면 가장 가까운 1명이 성향과 무관하게 바로 붙고, 둘째는 공 뒤 커버
    const ownBox = Math.abs(b.x - gx0) <= ENGINE.pitch.boxDepth && Math.abs(b.y - gy0) <= ENGINE.pitch.boxWidth / 2;
    // 슛 레인 막기 (C.78h): 슈팅 거리 소유자에게 압박자는 찰 만한 구석 쪽 슛 길 위, 둘째는 남는 쪽 길 위 (닿을 수 있을 때만)
    if (O.laneBlock > 0 && rank <= 1 && !exempt) {
      const og = dist(owner.x, owner.y, gx0, gy0);
      // 골 쪽에 있는 수비만 (뒤에서 쫓아오는 수비는 옛 압박 — 앞에서 레인을 닫으며 다가갈 수 없다)
      if (og <= O.laneRange && (a.x - owner.x) * (gx0 - owner.x) + (a.y - owner.y) * (gy0 - owner.y) > 0) {
        const gap = ownBox ? ENGINE.defense.boxPressGap : clamp(og * O.laneGapPer, O.laneGapMin, O.laneGapMax);
        if (rank === 0) {
          const [lx, ly] = laneSpot(owner, gx0, gy0, laneGuess(s, a, owner, gx0, gy0), gap);
          a.tx = lx;
          a.ty = ly;
          feedFrom(a, owner);
          a.urgent = true;
          return;
        }
        const p = nearestTo(s, a.team, b.x, b.y);
        if (p && p !== a) {
          // 남는 쪽 슛 길 위: 박스 밖은 압박자 + laneCoverGap m, 박스 안은 옛 커버 자리(공 뒤 coverBehind m)와 같은 거리
          const [lx, ly] = laneSpot(owner, gx0, gy0, -laneGuess(s, p, owner, gx0, gy0), ownBox ? Math.min(O.plan.coverBehind, og * 0.5) : gap + O.laneCoverGap);
          if (dist(a.x, a.y, lx, ly) <= O.laneCoverReach) {
            a.tx = lx;
            a.ty = ly;
            a.urgent = true;
            return;
          }
        }
      }
    }
    if (ownBox && rank === 1) {
      coverSpot(a, dir, b.x, b.y);
      return;
    }
    if (ownBox && rank === 0) {
      const bd0 = dist(b.x, b.y, gx0, gy0) || 1;
      a.tx = b.x + ((gx0 - b.x) / bd0) * ENGINE.defense.boxPressGap;
      a.ty = b.y + ((gy0 - b.y) / bd0) * ENGINE.defense.boxPressGap;
      feedFrom(a, owner);
      a.urgent = true;
      return;
    }
    // 수비 블록: 공격 줄은 1명만 압박 / 역습: 남는 최전방은 압박하지 않는다 (E.19)
    const tac0 = s.teams[a.team].tactics;
    if (a.line === 3 && tac0.tendency === 'block' && closerForward(s, a, b.x, b.y)) wants = false;
    if (a.line === 3 && stayForwards(tac0) > 0 && isTopForward(s, a)) wants = false;
    // 역습 (C.78s H2): 공이 하프라인 부근(우리 기준 counterPressX)까지 오기 전에는 압박하지 않고 줄 자리를 지킨다 — 게겐처럼 앞에서 쫓지 않는다
    if (tac0.tendency === 'counter' && bnx > TENDENCY.counterPressX) wants = false;
    // 진단 스위치 (엔진관리자23 c79y, 0 = 끔): 게겐 둘째 압박자 가담 거리 배수
    const secondDist = tac0.tendency === 'gegenpress' && TENDENCY.gegenSecondDist > 0 ? TENDENCY.gegenSecondDist : O.secondPressDist;
    if (wants && (danger && rank === 0 || d < pressDist * (rank === 0 ? 1 : secondDist))) {
      // 공과 자기 골 사이에서 압박. 첫 압박 선수는 가장 위험한 전진 패스 대상을 등 뒤로 가리는 각도 (커버 섀도, E.22 A)
      const [gx, gy] = ownGoal(dir);
      const gd = dist(b.x, b.y, gx, gy) || 1;
      let ux = (gx - b.x) / gd;
      let uy = (gy - b.y) / gd;
      let gap = 1.0;
      // 패스길 막기를 고른 수비수 (E.23)도 커버 섀도 각도로
      const lane = rank === 0 || s.t < a.laneUntil ? shadowTarget(s, owner, dir) : null;
      if (lane) {
        const ld = dist(lane.x, lane.y, b.x, b.y) || 1;
        ux = ux * (1 - O.shadowW) + ((lane.x - b.x) / ld) * O.shadowW;
        uy = uy * (1 - O.shadowW) + ((lane.y - b.y) / ld) * O.shadowW;
        const un = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= un;
        uy /= un;
        gap = O.shadowGap;
      }
      a.tx = b.x + ux * gap;
      a.ty = b.y + uy * gap;
      feedFrom(a, owner);
      a.urgent = true;
      return;
    }
    // 위험지역 둘째 (C.75c): 공에 붙지 않고 공과 골 사이 커버 자리 (dangerPress 안 2명 압박 대신)
    if (rank === 1 && danger && !exempt) {
      coverSpot(a, dir, b.x, b.y);
      return;
    }
  }

  // 게겐 수신 후보 선제 마크 (엔진관리자23 c79y 진단 스위치 gegenMarkN, 0 = 끔): 압박에 안 간 선수가 소유자 주변 패스 후보를 공 쪽에서 미리 마크
  if (TENDENCY.gegenMarkN > 0 && owner && owner.team !== a.team) {
    const job = gegenMarkPlan(s, a.team).get(a.idx);
    if (job) {
      const u = s.agents[job.o]!;
      a.tx = clamp(job.x, 0.3, L - 0.3);
      a.ty = clamp(job.y, 0.3, W - 0.3);
      feedFrom(a, u);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 2;
      a.minRun = false;
      return;
    }
  }

  // 줄 사이 수신 (C.78d ①): 밀집 중 상대 소유자가 우리 수비 줄과 중원 줄 사이(+holdSlack m)면 압박 1명·커버 1명만 반응하고 나머지 중원은 밀집 자리(공 쪽으로 좁힌 줄)를 지킨다 — 한 번에 1명, 옆이 메움
  if (O.compact > 0 && a.line === 2 && !dropped && owner && owner.team !== a.team && !exemptOf(s, a)) {
    const tac2 = s.teams[a.team].tactics;
    const cw2 = compactWOf(tac2);
    if (cw2 !== undefined && bnx * L < O.compactFrom) {
      const br2 = blockRow(tac2);
      const lx = defensiveLine(s, a.team);
      const lineX2 = br2 ? Math.min(lx, br2.lineMax / L) : lx;
      const gap2 = br2 ? Math.min(F.midGap, br2.gap / L) : F.midGap;
      const [onx] = toNorm(owner.x, owner.y, dir);
      if (onx >= lineX2 && onx <= lineX2 + gap2 + O.holdSlack / L && ballRank(s, a, b.x, b.y) >= 2) {
        setTarget(a, lineX2 + gap2, clamp(0.5 + (a.sy - 0.5) * cw2 + (bny - 0.5) * O.compactFollow, 0.05, 0.95), dir, false);
        return;
      }
    }
  }

  // 남은 수비 분담 (C.78a ③): 잃은 뒤 restWindow 초, 공이 우리 박스 존 밖이면 압박에 안 간 선수가 위협 상대를 한 명에 한 명(닿을 수 있는 수비만) 또는 커버 자리
  if (O.restMark > 0 && owner && owner.team !== a.team && !boxZone && s.t - tm.lostAt <= O.restWindow) {
    const job = restPlan(s, a.team).get(a.idx);
    if (job) {
      ensureErrors(s, a);
      const sigma = (100 - (a.attrs.marking + a.attrs.defensivePositioning) / 2) * O.markSigma;
      a.tx = clamp(job.x + (job.mark ? a.errX * sigma : 0), 0.3, L - 0.3);
      a.ty = clamp(job.y + (job.mark ? a.errY * sigma : 0), 0.3, W - 0.3);
      if (job.mark) feedFrom(a, s.agents[job.o]!);
      a.urgent = true;
      a.minRun = false;
      return;
    }
  }

  // 2선 침투자 추적 (C.77b 44h-i, §9.15 가설 1): 압박 다음, 면제·스크린·줄 2 존 마크 앞. 줄 2 추적자만, 수비 줄(boxDefense)은 그대로
  if (a.line === 2 && !dropped && O.trackMax > 0) {
    trackPlan(s, a.team, gx0, gy0);
    if (a.trackIdx >= 0 && trackTarget(s, a, dir, gx0, gy0)) return;
  }

  // 박스 수 맞춤 마크 (C.79e 실험): 추적 다음, 줄 2 존 마크 앞 — 마커 없는 박스 안 상대에게 골 쪽 밀착
  if (a.line === 2 && !dropped && O.boxMatch > 0) {
    const u0 = boxMatchPlan(s, a.team, gx0, gy0).get(a.idx);
    if (u0 !== undefined) {
      const u = s.agents[u0]!;
      ensureErrors(s, a);
      markTight(a, u, gx0, gy0);
      return;
    }
  }

  ensureErrors(s, a);
  // 박스 앞 수비 블록 (E.20 3번): 수비수는 ST 마크 1명과 박스 안 공간 덮기
  // 상대 ST/CF 가 박스 안에 있으면 stMarkZoneBox 부터 (C.29 fix2 가설 B)
  const ballGoal = dist(b.x, b.y, gx0, gy0);
  const markZone = ballGoal < Math.max(O.boxZone, O.stMarkZone) || (ballGoal < O.stMarkZoneBox && oppStrikerInBox(s, a.team, dir));
  if (asDef && markZone && boxDefense(s, a, dir, boxZone)) return;

  let [nx, ny] = slotTarget(s, a);
  const tac = s.teams[a.team].tactics;
  const tendency = tac.tendency;
  let lineX = defensiveLine(s, a.team);
  // 수비 블록 (E.19, C.78s H1 라인 단계표): 수비 라인 상한·수비-중원 간격 상한 — 라인 매우 낮음 = 박스 앞 14 m · 8 m 두 줄(옛 버스 세우기), 낮음 = 박스 경계 16.5 m · 12 m
  const br = blockRow(tac);
  if (br) lineX = Math.min(lineX, br.lineMax / L);
  // 역습 (C.78s H2): 수비-중원 counterGap m — 2선이 올린 라인 바로 앞, 하프라인 부근에 모인다
  const ctr = tendency === 'counter';
  const midGap = br ? Math.min(F.midGap, br.gap / L) : ctr ? Math.min(F.midGap, TENDENCY.counterGap / L) : F.midGap;
  if (dropped) nx = Math.min(nx, lineX);
  else if (a.line === 2) nx = Math.min(nx, lineX + midGap);
  else if (a.line === 3) nx = Math.min(nx, lineX + F.attGap);
  // 블록 라인 매우 낮음 (C.76k 버스, 역습 출구): 최전방 1명은 하프라인 부근에 남는다
  if (stayForwards(tac) > 0 && a.line === 3 && isTopForward(s, a)) nx = Math.max(nx, TENDENCY.busStayX);
  // 오버래핑 추적 (C.78i ②): 면제 아닌 측면 선수는 자기 측면으로 오버래핑하는 상대 풀백을 골 쪽 fbTrackGoal m 에서 따라 내려온다
  const ov = owner && owner.team !== a.team ? overlapToTrack(s, a) : null;
  if (ov) {
    const [gx, gy] = ownGoal(dir);
    const d = dist(ov.x, ov.y, gx, gy) || 1;
    a.tx = clamp(ov.x + ov.vx * 0.5 + ((gx - ov.x) / d) * O.fbTrackGoal, 0.5, L - 0.5);
    a.ty = clamp(ov.y + ov.vy * 0.5 + ((gy - ov.y) / d) * O.fbTrackGoal, 0.5, W - 0.5);
    a.urgent = true;
    return;
  }
  // ④ 수비 의무 면제 (E.6 D.13): 깊이 복귀하지 않고 마크도 하지 않는다 (다음 공격 기점). 빈자리는 커버 재배분이 메운다
  // 역습 잔류 (C.78s H2): 최전방 + 공 먼 쪽 윙어는 counterStayX 이상에 남아 탈취 뒤 첫 패스를 받는다 (면제와 같은 규칙, 빈자리는 커버 재배분)
  if (ctr && counterStayer(s, a)) {
    setTarget(a, Math.max(nx, TENDENCY.counterStayX), ny, dir, false);
    return;
  }
  if (hasModule(a.role, 'exempt') && a.line >= 2) {
    nx = Math.max(nx, a.line === 3 ? RM.exemptAttX : RM.exemptMidX);
    setTarget(a, nx, ny, dir, false);
    return;
  }
  ny = coverShiftY(s, a, ny);
  // 깊은 블록 밀집 (C.78d ①): 공이 우리 골 compactFrom m 안이면 수비·중원 줄은 공 쪽으로 좁게, 버스·블록 중원 줄은 수비 라인 + 간격에 고정
  const cw = O.compact > 0 && owner && owner.team !== a.team && (a.line === 1 || a.line === 2) ? compactWOf(tac) : undefined;
  const compacted = cw !== undefined && bnx * L < O.compactFrom;
  if (compacted) {
    ny = clamp(0.5 + (a.sy - 0.5) * cw + (bny - 0.5) * O.compactFollow, 0.05, 0.95);
    if (a.line === 2 && !dropped && tendency !== 'counter') nx = lineX + midGap;
  }
  // CDM 스크린 (E.22 A): 공과 상대 최전방 사이 중앙 길목. 홀딩 CM 도 같이 (E3.7 역할 반응: 수비 역할의 수비 효과)
  if ((a.pos === 'CDM' || a.role.id === 'holdingCM') && !dropped && owner && owner.team !== a.team) {
    const spot = screenSpot(s, a, owner, dir, lineX);
    if (spot) {
      setTarget(a, spot[0], spot[1], dir, false);
      return;
    }
  }
  if (asDef) {
    // 수비 라인 동기화. 오차는 수비 포지셔닝과 마킹
    const sigma = ((100 - (a.attrs.defensivePositioning + a.attrs.marking) / 2) * O.markSigma) / L;
    nx = lineX + a.errX * sigma;
  }

  // 마킹: 존 근처의 위협적인 상대. 수비 주의 집중 대상(E.20 8번)이 존 근처에 있으면 그 선수를 먼저, 더 가깝게
  const [zx, zy] = toPitch(nx, ny, dir);
  const focus = focusThreat(s, a.team);
  // 줄 2 존 마크의 ST 쏠림 해소 (C.76w (c), 미해결 8·11 — boxManMax > 0 일 때만, 지금은 0 = 끔): focus 가 이미 boxDefense 마커를 가진 상태(markZone + 위협 1위 마커)면
  // 존 마크는 focus 를 빼고 존 근처 다른 상대(2선 침투자가 대개 여기 걸린다)를 맡는다
  const focusHeld = O.boxManMax > 0 && markZone && threatMarker(s, a.team) !== null;
  // 줄 대응 (C.77b (a0), 사용자 원칙 "상대 1선은 우리 최후방이, 상대 2·3선은 우리 3선(수미·중미)이 막는다"): 존 마크 후보를 줄로 짝짓는다 —
  // 우리 줄 1 → [상대 줄 3, 그다음 줄 2] · 우리 줄 2 → [상대 줄 2, 그다음 줄 3] · 우리 줄 3 → [상대 줄 1·2, 그다음 줄 3]. 첫 단계에 14 m 안 상대가 있으면 그 안에서만,
  // 없을 때만 다음 단계(대형이 달라 짝이 남을 때의 인계). focus(대개 ST) 쏠림은 우리 줄 1 에만 — 줄 2 는 focus 가 자기 첫 단계(줄 2)일 때만 (지금까지는 줄과 무관하게 가장 가까운 상대·focus 라 줄 2 가 ST 로 쏠리고 상대 2선은 비었다, 미해결 8)
  // **지금은 끔(lineTiers 0, 부록 C.77b)**: 켜면(1) CAM 골은 그대로(gap 120 0.33/0.35 → 0.33/0.32)인데 줄 2 가 ST 에서 빠져 ST 골 0.34/0.31 → 0.38/0.36·quick ST 31 → 34 로 같은 시드 scoring 30골+ 1.80 → 2.40 ✗ (C.76w 와 같은 "ST 풀림" 통로)
  const tiers: Line[][] = O.lineTiers <= 0 ? [[1, 2, 3]] : asDef ? [[3], [2]] : a.line === 2 ? [[2], [3]] : [[1, 2], [3]];
  let mark: Agent | null = null;
  let best = 14;
  for (const tier of tiers) {
    for (const o of s.agents) {
      // 공 가진 선수는 압박자·커버가 맡는다 (C.75c: 존 마크가 소유자를 따라 들어와 셋째 사람이 되던 것)
      if (!o.onPitch || o.team === a.team || o.line === 0 || o.idx === s.ball.owner || !tier.includes(o.line)) continue;
      if (focusHeld && o === focus) continue;
      const d = dist(o.x, o.y, zx, zy);
      if (d < best) {
        best = d;
        mark = o;
      }
    }
    if (mark) break;
  }
  if (focus && !focusHeld && dist(focus.x, focus.y, zx, zy) < 14 && (O.lineTiers <= 0 || asDef || tiers[0]!.includes(focus.line))) mark = focus;
  // CB 따라나옴 (C.77d 가설 2): 줄 사이로 내려온 상대 공격수를 따라 나갈지 가장 가까운 CB 가 판단한다 (나가기로 하면 그 선수를 라인 앞까지 마크)
  const stepOut = a.line === 1 && O.stepOutMax > 0 ? stepOutPick(s, a, dir, ballGoal) : null;
  if (stepOut) mark = stepOut;
  const goalSide = O.markGoalSide * (mark && mark === focus ? O.focusMark : 1);
  let markFeed: [number, number, number, number, number] | null = null;
  if (mark) {
    const [gx, gy] = ownGoal(dir);
    const gd = dist(mark.x, mark.y, gx, gy) || 1;
    const bd = dist(mark.x, mark.y, b.x, b.y) || 1;
    // 골 쪽과 공 쪽 사이 (패스 경로를 막는 위치)
    let ux = ((gx - mark.x) / gd) * (1 - O.markBallSide) + ((b.x - mark.x) / bd) * O.markBallSide;
    let uy = ((gy - mark.y) / gd) * (1 - O.markBallSide) + ((b.y - mark.y) / bd) * O.markBallSide;
    const un = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= un;
    uy /= un;
    const sigma = (100 - (a.attrs.marking + a.attrs.defensivePositioning) / 2) * O.markSigma;
    const mx = mark.x + ux * goalSide + a.errX * sigma;
    const my = mark.y + uy * goalSide + a.errY * sigma;
    const [mnx, mny] = toNorm(mx, my, dir);
    // 목표 속도 (C.77x): 목표 중 마크 자리를 따르는 몫(줄 1: y 반, x 는 마크 자리를 고른 때만 · 줄 2·3: 섞는 비율)만큼 마크 상대의 속도
    let fwx: number;
    let fwy: number;
    if (asDef) {
      ny = ny * 0.5 + mny * 0.5;
      // 라인 뒤로만 (마크 쪽으로 내려섬). 따라 나가기로 했으면 마크 자리까지 라인 앞으로, 최대 stepOutMax m
      const nx0 = nx;
      // C.78e ②: 나가는 한계는 전술 라인과 실제 라인(상대에게 오프사이드 라인) 중 앞쪽 기준 — 전술 라인은 공이 25~45 m 일 때 실제보다 깊어 따라 나가기로 해도 물러섰다
      const outX = O.stepOutMidLead > 0 ? Math.max(lineX, 1 - offsideLine(s, (a.team === 0 ? 1 : 0) as 0 | 1)) : lineX;
      nx = stepOut ? Math.max(nx, Math.min(mnx, outX + O.stepOutMax / L)) : Math.min(nx, mnx);
      fwx = nx === mnx && nx !== nx0 ? 1 : 0;
      fwy = 0.5;
    } else {
      // 깊은 블록 밀집 (C.78d ①): 중원 줄은 존(밀집 자리) 위주 — 마크 비중 compactMark
      const w = a.line === 3 ? 0.3 : compacted ? O.compactMark : 0.65;
      nx = nx * (1 - w) + mnx * w;
      ny = ny * (1 - w) + mny * w;
      fwx = w;
      fwy = w;
    }
    markFeed = [mark.vx * fwx, mark.vy * fwy, mark.idx, fwx, fwy];
  }
  // 복귀 (E.18 A3): 목표가 자기 골 쪽으로 10 m 이상이면 러닝 이상, 20 m 이상이면 (긴급 복귀 판단 시) 최대 속도
  const [ax] = toNorm(a.x, a.y, dir);
  const back = (ax - nx) * L;
  void bnx;
  void bny;
  // 뚫린 역압박 가담자 (C.78a ①): 뚫린 뒤 restWindow 초 동안 자리가 골 쪽이면 전력 복귀
  const beaten = O.pressBreak > 0 && s.t - tm.brokeAt <= O.restWindow && tm.counterPressers.includes(a.idx) && back > 3;
  setTarget(a, nx, ny, dir, (back >= O.recoverSprint && a.recoverUrgent) || beaten);
  if (markFeed) [a.tvx, a.tvy, a.tvIdx, a.tvwx, a.tvwy] = markFeed;
  a.minRun = back >= O.recoverRun;
}

/**
 * 박스 앞 수비 블록의 수비수 배치 (E.20 3번). 공에 가장 가까운 2명(압박)을 뺀 수비 줄에서
 * ① 가장 위협적인 상대 ST(소유자 제외, 위치 가치가 가장 큰 ST/CF, 없으면 공격 줄)에게 가장 가까운 CB 가 골과 ST 를 잇는 선상 1.5 m 마크
 * ② 나머지는 니어 포스트, 페널티 지점, 파 포스트 순서로 가까운 자리를 덮는다 (자리가 모자라면 평소 라인)
 * 같은 상태에서 팀의 모든 수비수가 같은 배치를 계산한다. 배치가 정해지면 true
 */
/** 상대 ST/CF 가 우리 박스 안에 있는가 (dir = 우리 팀 공격 방향) */
function oppStrikerInBox(s: SimState, team: 0 | 1, dir: 1 | -1): boolean {
  const [gx, gy] = ownGoal(dir);
  return s.agents.some((o) => o.onPitch && o.team !== team && (o.pos === 'ST' || o.pos === 'CF')
    && Math.abs(o.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(o.y - gy) <= ENGINE.pitch.boxWidth / 2);
}

function boxDefense(s: SimState, a: Agent, dir: 1 | -1, cover: boolean): boolean {
  const b = s.ball;
  const [gx, gy] = ownGoal(dir);
  const lm = lineMatchPlan(s, a.team);
  const defs = s.agents.filter((o) => o.onPitch && o.team === a.team && (o.line === 1 || lm.drop.has(o.idx)) && ballRank(s, o, b.x, b.y) >= 2);
  if (!defs.includes(a)) return false;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  const oppDir = (-dir) as 1 | -1;
  // 가장 위협적인 상대 (수비 주의 집중, E.20 8번): 골까지 가까움과 박스 안 여부. 없으면 위치 가치가 가장 큰 ST/공격 줄
  let threat: Agent | null = focusThreat(s, a.team);
  if (!threat) {
    let tv = -Infinity;
    for (const pass of [true, false]) {
      for (const o of s.agents) {
        if (!o.onPitch || o.team === a.team || o === owner || o.line === 0) continue;
        if (pass ? o.pos !== 'ST' && o.pos !== 'CF' : o.line !== 3) continue;
        const v = positionValue(...toNorm(o.x, o.y, oppDir));
        if (v > tv) {
          tv = v;
          threat = o;
        }
      }
      if (threat) break;
    }
  }
  let rest = defs;
  if (threat) {
    const t = threat;
    const near = (x: Agent, y: Agent) => dist(x.x, x.y, t.x, t.y) - dist(y.x, y.y, t.x, t.y) || x.idx - y.idx;
    const cbs = defs.filter((o) => o.pos === 'CB');
    const marker = (cbs.length ? cbs : defs).slice().sort(near)[0]!;
    // 위협 가중 (C.76a): 집중 대상의 마무리 능력 계수 — 높을수록 밀착, 계수 ≥ focusDoubleMin 이면 둘째 수비 조건의 박스를 넓힌다 (더블팀)
    const isFocus = t === focusThreat(s, a.team);
    const abil = isFocus ? threatAbility(t) : 0;
    const extra = abil >= O.focusDoubleMin ? O.focusDoubleExtra : 0;
    // 박스 안이면 가까운 수비 1명이 더 붙는다 (공 쪽)
    const inBox = Math.abs(t.x - gx) <= ENGINE.pitch.boxDepth + extra && Math.abs(t.y - gy) <= ENGINE.pitch.boxWidth / 2 + extra;
    // C.75c: 위협이 공 가까이(커버 거리 + 마크 거리 안)면 압박자·커버가 이미 있으므로 둘째는 붙지 않고 자리를 덮는다
    const nearBall = O.plan.coverBehind + O.stMark;
    const ballNear = dist(t.x, t.y, b.x, b.y) <= nearBall;
    // 박스 안 2선 마크 (C.76w, 미해결 8·11): 박스 + boxManSlack m 안에 마커 없는 다른 상대(줄 ≥ 2 전부 — CAM·CM 침투자 포함, 공 가까이는 압박자·커버 몫)가 있으면
    // 둘째는 위협 1위 더블팀 대신 그중 위협도 1위를 골 쪽 stMark 로 마크하고, boxManMax 명까지 위협 순으로 1명씩 붙는다. 없을 때(또는 boxManMax 0 = 끔)만 지금처럼 더블팀
    const others: Agent[] = [];
    for (const o of s.agents) {
      if (!o.onPitch || o.team === a.team || o === owner || o === t || o.line < 2) continue;
      if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth + O.boxManSlack || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2 + O.boxManSlack) continue;
      if (dist(o.x, o.y, b.x, b.y) <= nearBall) continue;
      others.push(o);
    }
    // 줄 2(CAM·CM 침투자) 먼저, 그다음 위협도 — 니어·파 포스트의 윙어(골에 더 가까워 위협도가 높다)보다 페널티 지점의 2선이 먼저 (위협도 순이면 마크가 윙어에게 가 윙 득점만 줄었다: quick 600 윙 20 → 15)
    others.sort((x, y) => Number(y.line === 2) - Number(x.line === 2) || threatValue(y, gx, gy) - threatValue(x, gx, gy) || x.idx - y.idx);
    // 엘리트 가드 (C.76w 가설 3): 집중 대상의 마무리 계수 ≥ focusDoubleMin 이면 2선 마크보다 더블팀이 먼저다 (2선 마크로 ST 가 풀리자 같은 시드 scoring 30골+ 1.6 → 3.3~4.1)
    // 깊은 블록 밀집 (C.78d ①): 버스·블록·역습(낮은 블록)은 남는 수비가 많으니 박스 안 미마크 상대를 deepBoxMan 명까지 맡는다 (박스 안 사람 앞에 사람)
    const manMax0 = compactWOf(s.teams[a.team].tactics) !== undefined ? Math.max(O.boxManMax, O.deepBoxMan) : O.boxManMax;
    // 줄 인원 맞춤 (C.79e, lineMatchMan 1): 초과 인원만큼 박스 안 미마크 상대 마크 인원을 늘린다
    const manMax = O.lineMatch > 0 && O.lineMatchMan > 0 && lm.surplus > 0 ? Math.max(manMax0, lm.surplus) : manMax0;
    const second = (abil >= O.focusDoubleMin || !others.length || !manMax) && inBox && !ballNear ? defs.filter((o) => o !== marker).sort(near)[0] : undefined;
    const gd = dist(t.x, t.y, gx, gy) || 1;
    const focus = isFocus ? O.focusMark * (1 - O.focusTight * abil) : 1;
    if (marker === a) {
      // 볼 쪽 마크 (E.22 A): 공이 측면이면 골 쪽에서 공 쪽으로 반 발
      let ux = (gx - t.x) / gd;
      let uy = (gy - t.y) / gd;
      const wideB = Math.abs(toNorm(b.x, b.y, dir)[1] - 0.5) >= O.wideBall;
      if (wideB) {
        const bd = dist(t.x, t.y, b.x, b.y) || 1;
        ux = ux * (1 - O.stBallSide) + ((b.x - t.x) / bd) * O.stBallSide;
        uy = uy * (1 - O.stBallSide) + ((b.y - t.y) / bd) * O.stBallSide;
        const un = Math.sqrt(ux * ux + uy * uy) || 1;
        ux /= un;
        uy /= un;
      }
      a.tx = clamp(t.x + ux * O.stMark * focus + a.errX * O.markSigma, 0.3, L - 0.3);
      a.ty = clamp(t.y + uy * O.stMark * focus + a.errY * O.markSigma, 0.3, W - 0.3);
      feedFrom(a, t);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
      a.minRun = false;
      return true;
    }
    if (second === a) {
      markTight(a, t, b.x, b.y);
      return true;
    }
    rest = defs.filter((o) => o !== marker && o !== second);
    let deepT2: Agent | null = null;
    // 깊은 블록 둘째 ST 마크 (C.76p 가설 2): 위협 2위 ST/CF 가 박스 + deepSecondStZone m 안이면 남은 수비수 중 가장 가까운 1명이 골 쪽 stMark
    if (isDeepBlock(s, a.team) && rest.length) {
      let t2: Agent | null = null;
      let tv = -Infinity;
      for (const o of s.agents) {
        if (!o.onPitch || o.team === a.team || o === owner || o === t || (o.pos !== 'ST' && o.pos !== 'CF')) continue;
        if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth + O.deepSecondStZone || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2 + O.deepSecondStZone) continue;
        const v = positionValue(...toNorm(o.x, o.y, oppDir));
        if (v > tv) { tv = v; t2 = o; }
      }
      if (t2) {
        const u = t2;
        const m2 = rest.slice().sort((x, y) => dist(x.x, x.y, u.x, u.y) - dist(y.x, y.y, u.x, u.y) || x.idx - y.idx)[0]!;
        if (m2 === a) {
          markTight(a, u, gx, gy);
          return true;
        }
        rest = rest.filter((o) => o !== m2);
        deepT2 = u;
      }
    }
    // 덮는 자리 앞에 사람 (C.76w (b)): 박스 안 미마크 상대(위협 순)에게 남은 수비수 중 가장 가까운 1명씩, boxManMax 명까지 골 쪽 stMark
    let marks = 0;
    for (const u of others) {
      if (marks >= manMax || !rest.length) break;
      if (u === deepT2) continue;
      const m = rest.slice().sort((x, y) => dist(x.x, x.y, u.x, u.y) - dist(y.x, y.y, u.x, u.y) || x.idx - y.idx)[0]!;
      marks++;
      if (m === a) {
        markTight(a, u, gx, gy);
        return true;
      }
      rest = rest.filter((o) => o !== m);
    }
  }
  if (!cover) return false;
  // 덮는 자리: 니어 포스트(공 쪽), 페널티 지점, 파 포스트
  const side = b.y < gy ? -1 : 1;
  const spots: [number, number][] = [
    [gx + dir * O.coverPostDepth, gy + side * O.coverPostY],
    [gx + dir * O.coverSpot, gy],
    [gx + dir * (O.coverPostDepth + 1), gy - side * O.coverPostY],
  ];
  // 자리 순서대로, 아직 배정되지 않은 수비수 중 가장 가까운 선수
  const free = rest.slice().sort((x, y) => x.idx - y.idx);
  for (const [sx, sy] of spots) {
    if (!free.length) break;
    let k = 0;
    for (let i = 1; i < free.length; i++) if (dist(free[i]!.x, free[i]!.y, sx, sy) < dist(free[k]!.x, free[k]!.y, sx, sy)) k = i;
    if (free[k] === a) {
      a.tx = clamp(sx + a.errX * O.markSigma * 10, 0.3, L - 0.3);
      a.ty = clamp(sy + a.errY * O.markSigma * 10, 0.3, W - 0.3);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 4;
      a.minRun = false;
      return true;
    }
    free.splice(k, 1);
  }
  return false;
}

const focusCache = new WeakMap<SimState, { tick: number; team: number; focus: Agent | null }[]>();

/** 위협도 (E.20 8번 + C.76a 능력 가중, 수비 골 (gx, gy) 기준): focusThreat 과 박스 안 2선 마크(C.76w)가 같은 식을 쓴다 */
function threatValue(o: Agent, gx: number, gy: number): number {
  const inBox = Math.abs(o.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(o.y - gy) <= ENGINE.pitch.boxWidth / 2;
  return Math.max(0, 1 - dist(o.x, o.y, gx, gy) / O.focusRange) + (inBox ? O.focusBox : 0) + O.focusAbilityW * threatAbility(o);
}

/**
 * 위협 가중 (C.76a, 미해결 8·11, 사용자 제안 "위협 가중 수비"): 마무리 능력 계수 clamp((finishSkill(슈팅) − 70)/20, −0.5, 1).
 * 수비 주의 집중(focusThreat)·위협 1위 마크 거리·커버 섀도 대상에만 들어간다 — 마커 수·압박 항은 그대로 (미해결 8 과 다른 종류)
 */
function threatAbility(o: Agent): number {
  return clamp((finishSkill(o.attrs, 'shot') - O.focusAbilityCenter) / O.focusAbilityRange, -0.5, 1);
}

/**
 * 수비 주의 집중 대상 (E.20 8번, C.16 결정 1): 수비 팀 기준, 공을 갖지 않은 상대 필드 선수(미드·공격 줄) 중
 * 위협도 = max(0, 1 − 골까지 거리 / focusRange) + (박스 안이면 focusBox) + focusAbilityW × 마무리 능력 계수(C.76a) 가 가장 높은 1명.
 * C.76a 전에는 위치로만 골랐다(좋은 마무리 선수일수록 집중 마크를 받아 득점 반응이 뒤집히던 문제 — 지금은 마크 거리 0.9~1.3 m 차이라 반응 가드로 지킨다). 틱마다 한 번 계산
 */
export function focusThreat(s: SimState, defTeam: 0 | 1): Agent | null {
  let cache = focusCache.get(s);
  if (!cache) focusCache.set(s, (cache = [{ tick: -1, team: 0, focus: null }, { tick: -1, team: 1, focus: null }]));
  const c = cache[defTeam]!;
  if (c.tick === s.tick) return c.focus;
  const [gx, gy] = ownGoal(attackDir(defTeam, s.half));
  let best: Agent | null = null;
  let bv = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === defTeam || o.line < 2 || o.idx === s.ball.owner) continue;
    const v = threatValue(o, gx, gy);
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  c.tick = s.tick;
  c.focus = best;
  return best;
}

/**
 * 커버 섀도 대상 (E.22 A): 소유자 팀의 필드 선수 중 공보다 우리 골에 가깝고 공에서 passMaxDist 안,
 * 그 팀 기준 위치 가치 × (1 + focusShadowW × 마무리 능력 계수, C.76a) 가 가장 큰 선수 (대개 ST)
 */
function shadowTarget(s: SimState, owner: Agent, defDir: 1 | -1): Agent | null {
  const [gx, gy] = ownGoal(defDir);
  const bd = dist(owner.x, owner.y, gx, gy);
  const oppDir = (-defDir) as 1 | -1;
  let best: Agent | null = null;
  let bv = -Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== owner.team || o === owner || o.line === 0) continue;
    if (dist(o.x, o.y, gx, gy) > bd - 2 || dist(o.x, o.y, owner.x, owner.y) > ENGINE.onball.passMaxDist) continue;
    // 위협 가중 (C.76a): 마무리 좋은 선수로 가는 패스 길을 먼저 막는다
    const v = positionValue(...toNorm(o.x, o.y, oppDir)) * (1 + O.focusShadowW * threatAbility(o));
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  return best;
}

/**
 * CDM 스크린 자리 (E.22 A): 공과 상대 최전방(우리 골에 가장 가까운 상대 ST/CF, 없으면 공격 줄)을 잇는 선에서 공 쪽 screenFrac 지점.
 * 수비 라인 앞 screenGap m 보다 골 쪽으로 내려가지 않는다. 팀에 CDM 이 둘이면 그 자리에 가까운 1명. 정규화 좌표를 돌려준다
 */
function screenSpot(s: SimState, a: Agent, owner: Agent, dir: 1 | -1, lineX: number): [number, number] | null {
  const [gx, gy] = ownGoal(dir);
  let top: Agent | null = null;
  for (const pass of [true, false]) {
    let bd = Infinity;
    for (const o of s.agents) {
      if (!o.onPitch || o.team === a.team || o === owner || o.line === 0) continue;
      if (pass ? o.pos !== 'ST' && o.pos !== 'CF' : o.line !== 3) continue;
      const d = dist(o.x, o.y, gx, gy);
      if (d < bd) {
        bd = d;
        top = o;
      }
    }
    if (top) break;
  }
  if (!top || dist(top.x, top.y, gx, gy) >= dist(owner.x, owner.y, gx, gy) - 3) return null;
  const px = owner.x + (top.x - owner.x) * O.screenFrac;
  const py = owner.y + (top.y - owner.y) * O.screenFrac;
  let [nx, ny] = toNorm(px, py, dir);
  nx = Math.max(nx, lineX + O.screenGap / L);
  const [qx, qy] = toPitch(nx, ny, dir);
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || (o.pos !== 'CDM' && o.role.id !== 'holdingCM')) continue;
    if (dist(o.x, o.y, qx, qy) < dist(a.x, a.y, qx, qy)) return null;
  }
  return [nx, ny];
}

const WIDE_ATT: ReadonlySet<string> = new Set(['LW', 'RW', 'LM', 'RM']);
const stayCache = new WeakMap<SimState, { tick: number; top: [number, number]; far: [number, number] }>();
/** 역습 잔류 선수 (C.78s H2, pending 146 "탈취 뒤 빠른 윙어·ST"): 최전방(슬롯 x 가장 앞 공격 줄) + 공에서 가장 먼 쪽 측면 공격수(LW·RW·LM·RM) 1명. 틱마다 팀당 한 번 */
function counterStayer(s: SimState, a: Agent): boolean {
  if (a.line < 2) return false;
  let c = stayCache.get(s);
  if (!c) stayCache.set(s, (c = { tick: -1, top: [-1, -1], far: [-1, -1] }));
  if (c.tick !== s.tick) {
    c.tick = s.tick;
    for (const team of [0, 1] as const) {
      let top: Agent | null = null;
      let far: Agent | null = null;
      for (const o of s.agents) {
        if (!o.onPitch || o.team !== team) continue;
        if (o.line === 3 && (!top || o.sx > top.sx || (o.sx === top.sx && o.idx < top.idx))) top = o;
      }
      for (const o of s.agents) {
        if (TENDENCY.counterStay < 2 || !o.onPitch || o.team !== team || o === top || !WIDE_ATT.has(o.pos)) continue;
        if (!far || Math.abs(o.y - s.ball.y) > Math.abs(far.y - s.ball.y) + 1e-9) far = o;
      }
      c.top[team] = TENDENCY.counterStay > 0 ? top?.idx ?? -1 : -1;
      c.far[team] = far?.idx ?? -1;
    }
  }
  return c.top[a.team] === a.idx || c.far[a.team] === a.idx;
}
/** 수비 의무 면제 (E.6 D.13 역할 모듈) 또는 역습 잔류 선수 (C.78s H2) */
function exemptOf(s: SimState, a: Agent): boolean {
  return hasModule(a.role, 'exempt') || (s.teams[a.team].tactics.tendency === 'counter' && counterStayer(s, a));
}

/** 팀의 가장 앞 공격수 (슬롯 x 기준, 같으면 idx) */
function isTopForward(s: SimState, a: Agent): boolean {
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.line !== 3) continue;
    if (o.sx > a.sx || (o.sx === a.sx && o.idx < a.idx)) return false;
  }
  return true;
}

/**
 * 비행 중 수신자 압박 담당 (C.76k 단계 B, §9.10 가설 1): 상대 패스(outcome receive, 수신자 상대 필드 선수)가 떠 있고 착지점이 우리 골 closeDownZone 안이면
 * 우리 필드 선수 중 착지점 도착 시간(반응 포함)이 가장 짧은 1명. 위협 1위 마커(가장 가까운 CB, 마크 유지)·면제 역할은 뺀다. 없으면 null. 난수 없음
 */
interface CloseDown { pick: Agent | null; second: Agent | null }
const NO_CLOSE: CloseDown = { pick: null, second: null };
const closeDownCache = new WeakMap<SimState, { tick: number; cd: CloseDown }[]>();
function closeDownPlan(s: SimState, team: 0 | 1, gx: number, gy: number): CloseDown {
  // 틱마다 팀당 한 번만 계산 (focusThreat 과 같은 캐시 — 결과 불변, 22명이 같은 탐색을 되풀이하지 않게)
  let cache = closeDownCache.get(s);
  if (!cache) closeDownCache.set(s, (cache = [{ tick: -1, cd: NO_CLOSE }, { tick: -1, cd: NO_CLOSE }]));
  const c = cache[team]!;
  if (c.tick === s.tick) return c.cd;
  c.tick = s.tick;
  c.cd = closeDownPick(s, team, gx, gy);
  return c.cd;
}
/**
 * 수신자 압박 담당. 깊은 블록(C.76p 가설 2)이면 위협 1위 마커도 후보(가장 빠르면 마커가 나간다)이고,
 * 수신자가 ST/CF 면 도착 둘째(second)도 정한다 — 착지점 골 쪽 deepCloseDownSecond m
 */
function closeDownPick(s: SimState, team: 0 | 1, gx: number, gy: number): CloseDown {
  const fl = s.ball.flight;
  if (!fl || fl.outcome !== 'receive' || s.ball.owner >= 0) return NO_CLOSE;
  const rcv = s.agents[fl.receiver];
  if (!rcv || rcv.team === team || rcv.line === 0) return NO_CLOSE;
  if (dist(fl.toX, fl.toY, gx, gy) >= O.closeDownZone) return NO_CLOSE;
  const deep = isDeepBlock(s, team);
  const marker = deep ? null : threatMarker(s, team);
  let pick: Agent | null = null;
  let second: Agent | null = null;
  let bt = Infinity;
  let bt2 = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line === 0 || o === marker || exemptOf(s, o)) continue;
    const t = arrival(o, fl.toX, fl.toY);
    if (t < bt || (t === bt && pick && o.idx < pick.idx)) {
      bt2 = bt;
      second = pick;
      bt = t;
      pick = o;
    } else if (t < bt2 || (t === bt2 && second && o.idx < second.idx)) {
      bt2 = t;
      second = o;
    }
  }
  // 비행 중 인계 (C.77b 가설 2 ②): 수신자를 추적 중인 선수가 있으면 도착 시간과 무관하게 그 추적자가 담당 (추적자 + 수신자 압박 2명이 되지 않게)
  if (O.trackHandoff > 0 && O.trackMax > 0) {
    for (const o of s.agents) {
      if (!o.onPitch || o.team !== team || o.trackIdx !== rcv.idx || o === marker || exemptOf(s, o)) continue;
      if (pick !== o) {
        if (second === o) second = pick;
        pick = o;
      }
      break;
    }
  }
  if (!deep || !(rcv.pos === 'ST' || rcv.pos === 'CF')) second = null;
  return { pick, second };
}

/** 깊은 블록 성향(수비 블록, 라인 단계 무관)인가 */
function isDeepBlock(s: SimState, team: 0 | 1): boolean {
  return s.teams[team].tactics.tendency === 'block';
}

/**
 * 깊은 블록 비행 중 가로채기 담당 (C.76p 44h-c, §9.11.1 가설 1): 우리 팀이 block/bus 이고 상대 땅볼 패스 착지점이 우리 골 closeDownZone 안이면
 * 수신자 압박 담당·위협 1위 마커·GK·면제를 뺀 선수 중, 지금 공 위치 → 착지점 선분 위 가장 가까운 점(선에서 deepCutReach m 안)에
 * 공보다 먼저 닿는 선수가 있으면 도착이 가장 빠른 1명과 그 점. 정해지면 팀 상태(cutFlight·cutIdx)에 적어 sim 의 deepCut 판정 대상이 된다. 난수 없음
 */
const deepCutCache = new WeakMap<SimState, { tick: number; pick: { a: Agent; x: number; y: number } | null }[]>();
function deepCutAgent(s: SimState, team: 0 | 1, gx: number, gy: number): { a: Agent; x: number; y: number } | null {
  let cache = deepCutCache.get(s);
  if (!cache) deepCutCache.set(s, (cache = [{ tick: -1, pick: null }, { tick: -1, pick: null }]));
  const c = cache[team]!;
  if (c.tick === s.tick) return c.pick;
  c.tick = s.tick;
  c.pick = deepCutPick(s, team, gx, gy);
  if (c.pick) {
    const tm = s.teams[team];
    tm.cutFlight = s.ball.flight;
    tm.cutIdx = c.pick.a.idx;
  }
  return c.pick;
}
function deepCutPick(s: SimState, team: 0 | 1, gx: number, gy: number): { a: Agent; x: number; y: number } | null {
  if (!isDeepBlock(s, team)) return null;
  const b = s.ball;
  const fl = b.flight;
  if (!fl || fl.outcome !== 'receive' || fl.air || b.owner >= 0) return null;
  const rcv = s.agents[fl.receiver];
  if (!rcv || rcv.team === team || rcv.line === 0) return null;
  if (dist(fl.toX, fl.toY, gx, gy) >= O.closeDownZone) return null;
  const tm = s.teams[team];
  // 이 비행에서 이미 판정을 썼으면(cutFlight 는 그대로, cutIdx 만 −1) 다시 보내지 않는다
  if (tm.cutFlight === fl && tm.cutIdx < 0) return null;
  const remain = fl.t0 + fl.dur - s.t;
  if (remain <= 0.05) return null;
  const cd = closeDownPlan(s, team, gx, gy);
  const marker = threatMarker(s, team);
  let pick: { a: Agent; x: number; y: number } | null = null;
  let bt = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line === 0 || o === cd.pick || o === cd.second || o === marker || exemptOf(s, o)) continue;
    const [d, t] = segDist(o.x, o.y, b.x, b.y, fl.toX, fl.toY);
    if (d > O.deepCutReach || t <= 0.02 || t >= 0.98) continue;
    const px = b.x + (fl.toX - b.x) * t;
    const py = b.y + (fl.toY - b.y) * t;
    const ta = arrival(o, px, py);
    if (ta > remain * t) continue;
    if (ta < bt || (ta === bt && pick && o.idx < pick.a.idx)) {
      bt = ta;
      pick = { a: o, x: px, y: py };
    }
  }
  return pick;
}
/** 위협 1위를 마크하는 CB (가장 가까운 CB). 없으면 null */
/**
 * 2선 침투자 추적 배정 (C.77b 44h-i, 8대 §9.15 가설 1, 미해결 8·11): 틱마다 팀당 1회(closeDownPlan 식 캐시). 결과는 Agent.trackIdx·trackUntil·trackOut 에 남는다(기억).
 * ① 해제: 우리 공·리스타트면 전부. 침투자가 소유자·벤치·대상 조건 밖 trackRelease 초(존 +3 m 히스테리시스, trackHold 안에는 유지)·추적자가 압박/역압박/커버/수신자 압박 담당이면 그 배정.
 * ② 대상: 상대 줄 2 중 소유자 아님 · 우리 골 trackZone 안 또는 이동 목표가 trackTargetZone 안이고 자신은 목표보다 3 m 이상 멀리(들어오는 중). 위협 순(threatValue), 팀당 trackMax 명.
 * ③ 추적자: 우리 줄 2 CDM(홀딩 CM)·CM 중 한가한 선수. 침투자 쪽 CDM 이 trackCdmMax 안이면 그 CDM, 아니면 가장 가까운 후보가 trackPickMax 안일 때만. 난수 없음, 동률은 idx
 */
/**
 * 남은 수비 분담 (C.78a ③): 잃은 뒤 restWindow 초 동안 팀당 틱마다 1회. 위협 = 공보다 우리 골 쪽(또는 나란히)의 상대 필드 선수(소유자 제외), 위협 순 restMax 명.
 * 수비 = 역압박 가담·공에 가장 가까운 1명·커버·면제를 뺀 수비 줄과 공보다 우리 골 쪽의 중원. 위협마다 마크 자리(1초 뒤 그 상대 자리의 골 쪽 1.5 m)에
 * 가장 빨리 닿는 남은 수비가 1초 + restSlack 안이면 마크, 아니면 그 수비가 골 쪽 restCoverGap m 커버 자리. 난수 없음
 */
interface RestJob { x: number; y: number; o: number; mark: boolean }
const restCache = new WeakMap<SimState, { tick: number; plan: Map<number, RestJob> }[]>();

// 게겐 수신 후보 선제 마크 계획 (엔진관리자23 c79y 진단 스위치, TENDENCY.gegenMarkN 0 = 끔 — 켜지 않으면 호출되지 않는다):
// 상대 소유자(필드 선수) 주변 gegenMarkRadius m 안 가까운 순 gegenMarkN 명의 패스 후보에, 압박(공 순위 0·1)·역압박·커버·면제가 아닌 우리 필드 선수 중
// 마크 자리(후보 0.5초 뒤 자리의 공 쪽 gegenMarkGap m)에 가장 빨리 닿는 선수를 한 명에 한 명 — 도착이 gegenMarkSlack 초를 넘으면 그 후보는 비운다(닿을 수 없는 배정 금지).
// 공이 우리 골 gegenMarkFrom m 안이면 없음(박스 수비 그대로). gegenMarkWindow > 0 이면 잃은 뒤 그 초 안에서만
interface MarkJob { x: number; y: number; o: number }
const gegenCache = new WeakMap<SimState, { tick: number; plan: Map<number, MarkJob> }[]>();
function gegenMarkPlan(s: SimState, team: 0 | 1): Map<number, MarkJob> {
  let c = gegenCache.get(s);
  if (!c) gegenCache.set(s, (c = [{ tick: -1, plan: new Map() }, { tick: -1, plan: new Map() }]));
  const e = c[team]!;
  if (e.tick === s.tick) return e.plan;
  e.tick = s.tick;
  const plan = (e.plan = new Map<number, MarkJob>());
  const G = TENDENCY;
  const tm = s.teams[team];
  if (G.gegenMarkN <= 0 || tm.tactics.tendency !== 'gegenpress') return plan;
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  if (!owner || owner.team === team || owner.line === 0) return plan;
  if (G.gegenMarkWindow > 0 && s.t - tm.lostAt > G.gegenMarkWindow) return plan;
  const dir = attackDir(team, s.half);
  const [gx, gy] = ownGoal(dir);
  if (dist(b.x, b.y, gx, gy) < G.gegenMarkFrom) return plan;
  const cands = s.agents
    .filter((o) => o.onPitch && o.team !== team && o.line !== 0 && o !== owner && dist(o.x, o.y, owner.x, owner.y) <= G.gegenMarkRadius)
    .sort((x, y) => dist(x.x, x.y, owner.x, owner.y) - dist(y.x, y.y, owner.x, owner.y) || x.idx - y.idx)
    .slice(0, G.gegenMarkN);
  const pressing = s.t < tm.counterUntil ? tm.counterPressers : [];
  const free = s.agents.filter((a) => a.onPitch && a.team === team && a.line !== 0 && !pressing.includes(a.idx)
    && !(tm.coverAgent === a.idx && s.t < tm.coverUntil) && !exemptOf(s, a) && ballRank(s, a, b.x, b.y) >= 2
    && (G.gegenMarkBurst <= 0 || BU.on <= 0 || a.burst >= BU.pressMin)
    && !(G.gegenMarkBeaten > 0 && s.t - tm.brokeAt <= O.restWindow && tm.counterPressers.includes(a.idx)));
  for (const o of cands) {
    if (!free.length) break;
    const px = clamp(o.x + o.vx * 0.5, 0.3, L - 0.3);
    const py = clamp(o.y + o.vy * 0.5, 0.3, W - 0.3);
    const od = dist(px, py, owner.x, owner.y) || 1;
    const mx = px + ((owner.x - px) / od) * G.gegenMarkGap;
    const my = py + ((owner.y - py) / od) * G.gegenMarkGap;
    let best: Agent | null = null;
    let bt = Infinity;
    for (const d of free) {
      const t = arrivalTime(d, mx, my, 0.5);
      if (t < bt || (t === bt && best && d.idx < best.idx)) { bt = t; best = d; }
    }
    if (!best || bt > G.gegenMarkSlack) continue;
    free.splice(free.indexOf(best), 1);
    plan.set(best.idx, { x: mx, y: my, o: o.idx });
  }
  return plan;
}
function restPlan(s: SimState, team: 0 | 1): Map<number, RestJob> {
  let c = restCache.get(s);
  if (!c) restCache.set(s, (c = [{ tick: -1, plan: new Map() }, { tick: -1, plan: new Map() }]));
  const e = c[team]!;
  if (e.tick === s.tick) return e.plan;
  e.tick = s.tick;
  const plan = (e.plan = new Map<number, RestJob>());
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  if (!owner || owner.team === team) return plan;
  const tm = s.teams[team];
  const dir = attackDir(team, s.half);
  const [gx, gy] = ownGoal(dir);
  const bnx = toNorm(b.x, b.y, dir)[0];
  const threats = s.agents
    .filter((o) => o.onPitch && o.team !== team && o.line !== 0 && o !== owner && toNorm(o.x, o.y, dir)[0] < bnx + 0.03)
    .sort((x, y) => threatValue(y, gx, gy) - threatValue(x, gx, gy) || x.idx - y.idx)
    .slice(0, O.restMax);
  const pressing = s.t < tm.counterUntil ? tm.counterPressers : [];
  const gm = TENDENCY.gegenMarkN > 0 ? gegenMarkPlan(s, team) : null;
  const free = s.agents.filter((a) => a.onPitch && a.team === team && (a.line === 1 || (a.line === 2 && toNorm(a.x, a.y, dir)[0] < bnx))
    && !pressing.includes(a.idx) && !(tm.coverAgent === a.idx && s.t < tm.coverUntil) && !exemptOf(s, a) && ballRank(s, a, b.x, b.y) > 0 && !(gm && gm.has(a.idx)));
  for (const o of threats) {
    if (!free.length) break;
    const px = clamp(o.x + o.vx, 0.3, L - 0.3);
    const py = clamp(o.y + o.vy, 0.3, W - 0.3);
    const gd = dist(px, py, gx, gy) || 1;
    const ux = (gx - px) / gd;
    const uy = (gy - py) / gd;
    const mx = px + ux * 1.5;
    const my = py + uy * 1.5;
    let best: Agent | null = null;
    let bt = Infinity;
    for (const d of free) {
      const t = arrivalTime(d, mx, my, 0.5);
      if (t < bt || (t === bt && best && d.idx < best.idx)) { bt = t; best = d; }
    }
    if (!best) break;
    free.splice(free.indexOf(best), 1);
    if (bt <= 1 + O.restSlack) plan.set(best.idx, { x: mx, y: my, o: o.idx, mark: true });
    else {
      const k = Math.min(O.restCoverGap, gd * 0.5);
      plan.set(best.idx, { x: px + ux * k, y: py + uy * k, o: o.idx, mark: false });
    }
  }
  return plan;
}

/** 추적 배정 도달 판정 (C.78a ④): 침투자 목표점(목표가 1 m 넘게 떨어져 있으면 목표, 아니면 1초 뒤 자리)에 침투자 + trackReachSlack 초 안에 닿는가 */
function canReach(a: Agent, r: Agent): boolean {
  if (O.trackReach <= 0) return true;
  const far = dist(r.tx, r.ty, r.x, r.y) > 1;
  const px = far ? r.tx : r.x + r.vx;
  const py = far ? r.ty : r.y + r.vy;
  return arrivalTime(a, px, py, 1) <= arrivalTime(r, px, py) + O.trackReachSlack;
}

// 줄 인원 맞춤 내려앉기 (C.79e, pending 147 ①, lineMatch 0 = 끔): 상대가 공을 가졌을 때 상대 공격 줄 인원(우리 수비 줄 평균 x + lineMatchBand m 안쪽·골 쪽의 상대, 소유자 제외)이
// 우리 수비 줄 인원(압박 아닌 줄 1)보다 lineMatchMin(2) 명 이상 많으면 그 차만큼 줄 2 선수(바쁘지 않은 선수 중 가장 깊은 순, 이미 내려온 선수 우선)가 수비 줄로 내려와 줄 1 처럼 행동한다
// (boxDefense 마크·덮기, 라인 동기화, 존 마크). 전술 무관 공통 규칙, 판단에 보이는 상대 위치만 쓴다. 차가 문턱 − 1 이면 유지, 그 아래면 올라간다 (히스테리시스)
interface LineMatch { drop: Set<number>; surplus: number }
const NO_MATCH: LineMatch = { drop: new Set<number>(), surplus: 0 };
const lineMatchCache = new WeakMap<SimState, { tick: number; plan: LineMatch }[]>();
/** 진단용 읽기 (엔진관리자18): 이 틱에 이미 계산된 줄 인원 맞춤 계획만 돌려준다 (계산하지 않음 — 지문 불변) */
export function lineMatchPeek(s: SimState, team: 0 | 1, tick = s.tick): LineMatch | null {
  const e = lineMatchCache.get(s)?.[team];
  return e && e.tick === tick ? e.plan : null;
}
function lineMatchPlan(s: SimState, team: 0 | 1): LineMatch {
  if (O.lineMatch <= 0) return NO_MATCH;
  let cache = lineMatchCache.get(s);
  if (!cache) lineMatchCache.set(s, (cache = [{ tick: -1, plan: NO_MATCH }, { tick: -1, plan: NO_MATCH }]));
  const e = cache[team]!;
  if (e.tick === s.tick) return e.plan;
  // 유지 (C.79k 결함 ②): 수비 팀 아무도 오프볼 판단을 안 한 틱이 끼어도 lineMatchKeep 초 안의 마지막 계획을 prev 로 인정한다 (0 = 바로 전 틱만)
  const prev = e.tick === s.tick - 1 || (e.tick >= 0 && (s.tick - e.tick) * ENGINE.time.dt <= O.lineMatchKeep) ? e.plan : NO_MATCH;
  e.tick = s.tick;
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  const att = owner ? owner.team : s.possTeam;
  if (att === team || s.restart) return (e.plan = NO_MATCH);
  const dir = attackDir(team, s.half);
  let lx = 0;
  let ln = 0;
  let defs = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line !== 1) continue;
    lx += toNorm(o.x, o.y, dir)[0];
    ln++;
    if (ballRank(s, o, b.x, b.y) >= 2) defs++;
  }
  if (!ln) return (e.plan = NO_MATCH);
  const band = lx / ln + O.lineMatchBand / L;
  // 비행 중 패서 (C.79k 결함 ①, lineMatchFlight 1): 공이 떠 있으면 공을 보낸 선수를 소유자로 쳐서 공격 줄에서 뺀다 (안 빼면 패스할 때마다 초과가 1 늘어난다)
  const passer = O.lineMatchFlight > 0 && !owner && b.flight && b.flight.passer >= 0 ? s.agents[b.flight.passer] : null;
  let atts = 0;
  for (const o of s.agents) if (o.onPitch && o.team !== team && o.line !== 0 && o !== owner && o !== passer && toNorm(o.x, o.y, dir)[0] < band) atts++;
  const surplus = atts - defs;
  // 문턱 lineMatchMin(기본 2): 초과가 문턱 이상이면 초과 전부, 문턱 − 1 이면 유지, 그 아래면 올라간다
  const need = surplus >= O.lineMatchMin ? surplus : surplus >= O.lineMatchMin - 1 ? prev.drop.size : 0;
  if (need <= 0) return (e.plan = { drop: NO_MATCH.drop, surplus });
  const tm = s.teams[team];
  const [gx, gy] = ownGoal(dir);
  const cd = owner ? NO_CLOSE : closeDownPlan(s, team, gx, gy);
  const cands: Agent[] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line !== 2 || exemptOf(s, o)) continue;
    if (s.t < tm.counterUntil && tm.counterPressers.includes(o.idx)) continue;
    if (tm.coverAgent === o.idx && s.t < tm.coverUntil) continue;
    if (cd.pick === o || cd.second === o) continue;
    if (ballRank(s, o, b.x, b.y) < 2) continue;
    cands.push(o);
  }
  cands.sort((x, y) => Number(prev.drop.has(y.idx)) - Number(prev.drop.has(x.idx)) || toNorm(x.x, x.y, dir)[0] - toNorm(y.x, y.y, dir)[0] || x.idx - y.idx);
  const drop = new Set<number>();
  for (const o of cands.slice(0, need)) drop.add(o.idx);
  return (e.plan = { drop, surplus });
}

// 박스 수 맞춤 마크 (C.79e 실험 스위치 boxMatch, pending 147 ①·C.78q 가설 2, 기본 0 = 끔): 우리 박스(+boxManSlack m) 안의 상대 중 마커가 없는 선수(위협 1위·공 근처·추적 중·boxDefense 가 맡을 manMax 명 제외)에게
// 바쁘지 않은 줄 2 선수(boxMatchReach m 안, 가까운 순)를 1명씩 boxMatchMax 명까지 붙인다 — 골 쪽 stMark 밀착. 줄 1 의 배치(집중 대상 마크·더블팀·덮는 자리)는 그대로(ST 풀림 통로를 건드리지 않는다)
const boxMatchCache = new WeakMap<SimState, { tick: number; plan: Map<number, number> }[]>();
const NO_BOX_MATCH = new Map<number, number>();
function boxMatchPlan(s: SimState, team: 0 | 1, gx: number, gy: number): Map<number, number> {
  if (O.boxMatch <= 0) return NO_BOX_MATCH;
  let cache = boxMatchCache.get(s);
  if (!cache) boxMatchCache.set(s, (cache = [{ tick: -1, plan: NO_BOX_MATCH }, { tick: -1, plan: NO_BOX_MATCH }]));
  const e = cache[team]!;
  if (e.tick === s.tick) return e.plan;
  e.tick = s.tick;
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  const att = owner ? owner.team : s.possTeam;
  if (att === team || s.restart) return (e.plan = NO_BOX_MATCH);
  const threat = focusThreat(s, team);
  const nearBall = O.plan.coverBehind + O.stMark;
  const tracked = new Set<number>();
  for (const o of s.agents) if (o.onPitch && o.team === team && o.trackIdx >= 0) tracked.add(o.trackIdx);
  const others: Agent[] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team || o === owner || o === threat || o.line === 0) continue;
    if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth + O.boxManSlack || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2 + O.boxManSlack) continue;
    if (dist(o.x, o.y, b.x, b.y) <= nearBall) continue;
    others.push(o);
  }
  if (!others.length) return (e.plan = NO_BOX_MATCH);
  // boxDefense 의 others 순서·manMax 와 같게: 그 수만큼은 줄 1 이 맡는다 (줄 2 ≥ 2 먼저, 위협 순)
  others.sort((x, y) => Number(y.line === 2) - Number(x.line === 2) || threatValue(y, gx, gy) - threatValue(x, gx, gy) || x.idx - y.idx);
  const manMax = compactWOf(s.teams[team].tactics) !== undefined ? Math.max(O.boxManMax, O.deepBoxMan) : O.boxManMax;
  const targets = others.filter((o) => !tracked.has(o.idx)).slice(manMax);
  if (!targets.length) return (e.plan = NO_BOX_MATCH);
  const tm = s.teams[team];
  const cd = owner ? NO_CLOSE : closeDownPlan(s, team, gx, gy);
  const free: Agent[] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.line !== 2 || exemptOf(s, o) || o.trackIdx >= 0) continue;
    if (s.t < tm.counterUntil && tm.counterPressers.includes(o.idx)) continue;
    if (tm.coverAgent === o.idx && s.t < tm.coverUntil) continue;
    if (cd.pick === o || cd.second === o) continue;
    if (ballRank(s, o, b.x, b.y) < 2) continue;
    free.push(o);
  }
  const plan = new Map<number, number>();
  for (const u of targets) {
    if (plan.size >= O.boxMatchMax || !free.length) break;
    let best: Agent | null = null;
    let bd: number = O.boxMatchReach;
    for (const d of free) {
      const dd = dist(d.x, d.y, u.x, u.y);
      if (dd < bd || (dd === bd && best && d.idx < best.idx)) { bd = dd; best = d; }
    }
    if (!best) continue;
    free.splice(free.indexOf(best), 1);
    plan.set(best.idx, u.idx);
  }
  return (e.plan = plan);
}

const trackCache = new WeakMap<SimState, number[]>();
function trackPlan(s: SimState, team: 0 | 1, gx: number, gy: number): void {
  let cache = trackCache.get(s);
  if (!cache) trackCache.set(s, (cache = [-1, -1]));
  if (cache[team] === s.tick) return;
  cache[team] = s.tick;
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
  const att = owner ? owner.team : s.possTeam;
  const ours: Agent[] = [];
  for (const o of s.agents) if (o.onPitch && o.team === team && o.line === 2) ours.push(o);
  const release = (a: Agent) => { a.trackIdx = -1; a.trackOut = -1; };
  if (att === team || s.restart) {
    for (const a of ours) if (a.trackIdx >= 0) release(a);
    return;
  }
  const zone = O.trackZone;
  // 대상 조건 (slack = 유지 히스테리시스)
  const isRunner = (o: Agent, slack: number): boolean => {
    if (!o.onPitch || o.team !== att || o.line !== 2 || o === owner) return false;
    const dg = dist(o.x, o.y, gx, gy);
    if (dg < zone + slack) return true;
    if (O.trackTargetNoCdm > 0 && o.pos === 'CDM') return false;
    const tg = dist(o.tx, o.ty, gx, gy);
    return tg < O.trackTargetZone + slack && dg > tg + 3;
  };
  // 추적자가 바쁜가 (압박 rank 0·둘째 압박자·역압박·커버·수신자 압박·면제)
  const tm = s.teams[team];
  const t = effectiveTactics(s, team);
  const cd = owner ? NO_CLOSE : closeDownPlan(s, team, gx, gy);
  const second2 = sitPressers(s, team) >= 2;
  const lm = lineMatchPlan(s, team);
  const busy = (a: Agent): boolean => {
    if (hasModule(a.role, 'exempt')) return true;
    if (lm.drop.has(a.idx)) return true;
    if (s.t < tm.counterUntil && tm.counterPressers.includes(a.idx)) return true;
    if (tm.coverAgent === a.idx && s.t < tm.coverUntil) return true;
    if (cd.pick === a || cd.second === a) return true;
    if (owner) {
      const rank = ballRank(s, a, b.x, b.y);
      if (rank === 0) return true;
      if (rank === 1 && second2 && (pressLevel(s, team) >= 2 || t.pressing * (0.5 + a.role.press) > 0.6)) return true;
    }
    return false;
  };
  // ① 기존 배정 점검
  const tracked = new Set<number>();
  let n = 0;
  for (const a of ours) {
    if (a.trackIdx < 0) continue;
    const r = s.agents[a.trackIdx];
    if (!r || r.idx === b.owner || busy(a)) { release(a); continue; }
    if (isRunner(r, 3)) a.trackOut = -1;
    else {
      if (a.trackOut < 0) a.trackOut = s.t;
      if (s.t >= a.trackUntil && s.t - a.trackOut >= O.trackRelease) { release(a); continue; }
    }
    tracked.add(r.idx);
    n++;
  }
  if (n >= O.trackMax) return;
  // ② 새 대상 (위협 순)
  const runners: Agent[] = [];
  for (const o of s.agents) if (!tracked.has(o.idx) && isRunner(o, 0)) runners.push(o);
  if (!runners.length) return;
  runners.sort((x, y) => threatValue(y, gx, gy) - threatValue(x, gx, gy) || x.idx - y.idx);
  // ③ 후보 추적자 (한가한 CDM/CM)
  const cands: Agent[] = [];
  for (const a of ours) {
    if (a.trackIdx >= 0) continue;
    if (!(a.pos === 'CDM' || a.role.id === 'holdingCM' || a.pos === 'CM')) continue;
    if (busy(a)) continue;
    cands.push(a);
  }
  for (const r of runners) {
    if (n >= O.trackMax || !cands.length) break;
    const side = Math.sign(r.y - W / 2) || 1;
    let pick: Agent | null = null;
    let bd = Infinity;
    // 침투자 쪽 CDM 이 trackCdmMax 안이면 그 CDM (CDM 이 하나뿐이면 그 CDM)
    const cdms = cands.filter((a) => a.pos === 'CDM' || a.role.id === 'holdingCM');
    for (const a of cdms) {
      if (cdms.length > 1 && (Math.sign(a.y - W / 2) || 1) !== side) continue;
      const d = dist(a.x, a.y, r.x, r.y);
      if (d <= O.trackCdmMax && (d < bd || (d === bd && pick && a.idx < pick.idx)) && canReach(a, r)) { bd = d; pick = a; }
    }
    if (!pick) {
      for (const a of cands) {
        const d = dist(a.x, a.y, r.x, r.y);
        if (d <= O.trackPickMax && (d < bd || (d === bd && pick && a.idx < pick.idx)) && canReach(a, r)) { bd = d; pick = a; }
      }
    }
    if (!pick) continue;
    pick.trackIdx = r.idx;
    pick.trackUntil = s.t + O.trackHold;
    pick.trackOut = -1;
    cands.splice(cands.indexOf(pick), 1);
    n++;
  }
}

/**
 * 추적 자리 (C.77b, C.75d markTarget 의 박스 안 식만): 침투자(선읽기 trackLead 초 × 수비 포지셔닝/100 × 속도)와 우리 골을 잇는 선에서 골 쪽 trackGap m(박스 밖 trackGapOut),
 * 공이 측면이면 stBallSide 만큼 공 쪽. 오차 markSigma × (100 − (마킹+포지셔닝)/2). 거리 > trackUrgent 면 urgent. 침투자가 없으면 false
 */
function trackTarget(s: SimState, a: Agent, dir: 1 | -1, gx: number, gy: number): boolean {
  const r = s.agents[a.trackIdx];
  if (!r || !r.onPitch) return false;
  ensureErrors(s, a);
  const b = s.ball;
  const lead = O.trackLead * (a.attrs.defensivePositioning / 100);
  const rx = r.x + r.vx * lead;
  const ry = r.y + r.vy * lead;
  const gd = dist(rx, ry, gx, gy) || 1;
  let ux = (gx - rx) / gd;
  let uy = (gy - ry) / gd;
  if (Math.abs(toNorm(b.x, b.y, dir)[1] - 0.5) >= O.wideBall) {
    const bd = dist(rx, ry, b.x, b.y) || 1;
    ux = ux * (1 - O.stBallSide) + ((b.x - rx) / bd) * O.stBallSide;
    uy = uy * (1 - O.stBallSide) + ((b.y - ry) / bd) * O.stBallSide;
    const un = Math.sqrt(ux * ux + uy * uy) || 1;
    ux /= un;
    uy /= un;
  }
  const inBox = Math.abs(rx - gx) <= ENGINE.pitch.boxDepth && Math.abs(ry - gy) <= ENGINE.pitch.boxWidth / 2;
  const gap = inBox ? O.trackGap : O.trackGapOut;
  const sigma = (100 - (a.attrs.marking + a.attrs.defensivePositioning) / 2) * O.markSigma;
  a.tx = clamp(rx + ux * gap + a.errX * sigma, 0.3, L - 0.3);
  a.ty = clamp(ry + uy * gap + a.errY * sigma, 0.3, W - 0.3);
  feedFrom(a, r);
  a.urgent = dist(a.tx, a.ty, a.x, a.y) > O.trackUrgent || (O.trackRunUrgent > 0 && r.urgent);
  a.minRun = false;
  return true;
}

function threatMarker(s: SimState, team: 0 | 1): Agent | null {
  const threat = focusThreat(s, team);
  if (!threat) return null;
  let marker: Agent | null = null;
  let best = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== team || o.pos !== 'CB') continue;
    const d = dist(o.x, o.y, threat.x, threat.y);
    if (d < best) { best = d; marker = o; }
  }
  return marker;
}

/** 공에 더 가까운 같은 팀 공격수가 있는가 */
function closerForward(s: SimState, a: Agent, bx: number, by: number): boolean {
  const d = dist(a.x, a.y, bx, by);
  return s.agents.some((o) => o !== a && o.onPitch && o.team === a.team && o.line === 3 && dist(o.x, o.y, bx, by) < d);
}

/** 오프더볼 갱신 때 위치 오차를 새로 뽑는다 */
export function refreshErrors(s: SimState, a: Agent): void {
  // C.77x: errHold 초 동안은 같은 오차를 유지한다
  if (s.t - a.errT < O.errHold) return;
  a.errTick = s.tick;
  a.errT = s.t;
}

/** u 를 (px, py) 쪽으로 stMark 만큼 밀착 마크 (마크 오차 포함, 3 m 넘게 남으면 서두름) */
function markTight(a: Agent, u: Agent, px: number, py: number): void {
  const d = dist(u.x, u.y, px, py) || 1;
  a.tx = clamp(u.x + ((px - u.x) / d) * O.stMark + a.errX * O.markSigma, 0.3, L - 0.3);
  a.ty = clamp(u.y + ((py - u.y) / d) * O.stMark + a.errY * O.markSigma, 0.3, W - 0.3);
  feedFrom(a, u);
  a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
  a.minRun = false;
}

/** 목표 속도 = 따라가는 사람의 인지된 속도 (C.77x, 판단 순간 값을 다음 판단까지 유지) */
function feedFrom(a: Agent, o: Agent): void {
  a.tvx = o.vx;
  a.tvy = o.vy;
  a.tvIdx = o.idx;
  a.tvwx = 1;
  a.tvwy = 1;
}

/** 오차를 읽기 전에: 갱신 틱의 값을 그때 뽑는다 (해시 난수라 언제 뽑아도 같다, C.75l) */
function ensureErrors(s: SimState, a: Agent): void {
  if (a.errDone === a.errTick) return;
  a.errX = randn(s.seed, a.errTick, a.idx, Purpose.Mark, 0);
  a.errY = randn(s.seed, a.errTick, a.idx, Purpose.Mark, 1);
  a.errDone = a.errTick;
}

/** 세트피스 박스 안 자리 [골라인에서 m, 공 쪽 + / 반대쪽 − y m] (E.22 B) */
const SP_SPOTS: [number, number][] = [[6, 0], [9, 4], [12, 0], [6, -4], [9, -8]];

/** 세트피스 자리 배정 (C.75l 속도, 결과 불변): 재개·키커·출전 명단이 같은 동안 팀당 1번만 정렬한다 */
interface SpPlan {
  r: NonNullable<SimState['restart']>;
  taker: number;
  n: number;
  on: number;
  mates: Agent[];
  box: Agent[];
  rest: Agent[];
  forward: Agent | undefined;
  markers: Agent[];
}
const spCache = new WeakMap<SimState, [SpPlan | null, SpPlan | null]>();

function spPlan(s: SimState, team: 0 | 1): SpPlan {
  const r = s.restart!;
  let on = 0;
  for (const o of s.agents) if (o.onPitch) on++;
  let cache = spCache.get(s);
  if (!cache) spCache.set(s, (cache = [null, null]));
  const c = cache[team];
  if (c && c.r === r && c.taker === r.taker && c.n === s.agents.length && c.on === on) return c;
  const mates = s.agents
    .filter((o) => o.onPitch && o.team === team && o.line !== 0 && o.idx !== r.taker)
    .sort((x, y) => (y.attrs.heading + y.attrs.jumping) - (x.attrs.heading + x.attrs.jumping));
  let box: Agent[] = [];
  let rest: Agent[] = [];
  let forward: Agent | undefined;
  let markers: Agent[] = [];
  if (team === r.team) {
    const cbs = mates.filter((o) => o.pos === 'CB').slice(0, O.setPieceCB);
    box = [...cbs, ...mates.filter((o) => !cbs.includes(o))].slice(0, 5).sort((x, y) => mates.indexOf(x) - mates.indexOf(y));
    rest = mates.filter((o) => !box.includes(o));
  } else {
    forward = mates.slice().sort((x, y) => y.line - x.line || y.sx - x.sx)[0];
    markers = mates.filter((o) => o !== forward).slice(0, O.setPieceMark);
  }
  const plan: SpPlan = { r, taker: r.taker, n: s.agents.length, on, mates, box, rest, forward, markers };
  cache[team] = plan;
  return plan;
}

/**
 * 세트피스 위치 (코너, 상대 골 35 m 안 프리킥): 공격 팀은 CB·공격수·공중볼 좋은 미드가 박스로,
 * 수비 팀은 공격수 1명을 빼고 박스 안으로
 */
function setPieceTarget(s: SimState, a: Agent): boolean {
  const r = s.restart!;
  const attTeam = r.team;
  const dirAtt = attackDir(attTeam, s.half);
  const [gx, gy] = [dirAtt > 0 ? L : 0, W / 2];
  const near = r.type === 'corner' || (r.type === 'freeKick' && dist(r.x, r.y, gx, gy) < 35);
  if (!near) return false;
  const plan = spPlan(s, a.team);
  const mates = plan.mates;
  const k = mates.indexOf(a);
  if (k < 0) return false;
  if (a.team === attTeam) {
    // 박스 가담 (E.22 B): 공중볼 좋은 CB 최대 setPieceCB 명 + 공중볼 상위 선수로 5명 박스 안, 2명 박스 바깥, 나머지 하프라인 쪽.
    // 박스 안 자리: 중앙 7 m, 니어 포스트, 파 포스트, 페널티 지점, 니어 쪽 9 m (공중볼 순서대로)
    const { box, rest } = plan;
    const side = r.y < gy ? -1 : 1;
    const bk = box.indexOf(a);
    if (bk >= 0) {
      const [dx, dy] = SP_SPOTS[bk]!;
      a.tx = gx - dirAtt * dx;
      a.ty = gy + side * dy;
    } else {
      const ek = rest.indexOf(a);
      if (ek >= 2) return false;
      a.tx = gx - dirAtt * 20;
      a.ty = gy + (ek === 0 ? -10 : 10);
    }
    a.urgent = false;
    return true;
  }
  // 수비: 가장 앞선 공격수 1명은 남고 나머지는 박스 안
  const forward = plan.forward;
  if (a === forward) return false;
  // 대인 마크 (E.22 B): 공중볼 상위 수비 setPieceMark 명이 박스 안 상대 공중볼 상위 선수를 골 쪽 1 m 에서 맡는다 (같은 순위끼리)
  const mi = plan.markers.indexOf(a);
  if (mi >= 0) {
    const opp = s.agents
      .filter((o) => o.onPitch && o.team === attTeam && o.line !== 0 && o.idx !== r.taker && Math.abs(o.x - gx) < ENGINE.pitch.boxDepth + 2)
      .sort((x, y) => (y.attrs.heading + y.attrs.jumping) - (x.attrs.heading + x.attrs.jumping));
    const t = opp[mi];
    if (t) {
      const gd = dist(t.x, t.y, gx, gy) || 1;
      a.tx = t.x + ((gx - t.x) / gd) * 1;
      a.ty = t.y + ((gy - t.y) / gd) * 1;
      a.urgent = false;
      return true;
    }
  }
  a.tx = gx - dirAtt * (3 + (k % 4) * 3);
  a.ty = gy - 10 + (k % 7) * 3.3;
  a.urgent = false;
  return true;
}
