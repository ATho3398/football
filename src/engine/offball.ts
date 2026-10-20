// 오프더볼 움직임 (E.6): 공격 시 슬롯 + 지원 + 침투(오프사이드 라인 인지), 수비 시 마킹 + 라인 동기화 + 압박

import { ENGINE } from './config';
import { reaction } from './core';
import { keeperZone, sweepRange } from './keeper';
import { finishSkill } from './duel';
import { effectiveMax, landingVelocity } from './physics';
import { ballNorm, manDiff, slotTarget, teamPhase } from './formation';
import { attackDir, clamp, dist, L, ownGoal, positionValue, segDist, toNorm, toPitch, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import { hasModule } from './roles';
import { TENDENCY } from './tactics';
import type { Agent, DefSit, SimState } from './state';

const O = ENGINE.offball;
const F = ENGINE.formation;
const RM = ENGINE.roles;

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
  return clamp(nx, F.lineMin, 0.7);
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

/** 선수가 (x, y)에 닿는 시간: 반응 + 거리 / 유효 최대 속도. 이미 공을 보고 있었으면(ready) 반응 없이 */
function arrival(a: Agent, x: number, y: number, ready = false): number {
  return (ready ? 0 : reaction(a)) + dist(a.x, a.y, x, y) / effectiveMax(a);
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
  a.tx = gx + dir * depth;
  a.ty = clamp(gy + (s.ball.y - gy) * K.lateral, gy - ENGINE.pitch.goalWidth / 2 - 1, gy + ENGINE.pitch.goalWidth / 2 + 1);
  a.urgent = false;
  // 각 좁히기: 상대 소유자가 박스 안 골 가까이 들어오면 공과 골 사이로 나간다
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  if (owner && owner.team !== a.team && !s.restart) {
    const gd = dist(owner.x, owner.y, gx, gy);
    const inBox = Math.abs(owner.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(owner.y - gy) <= ENGINE.pitch.boxWidth / 2;
    if (inBox && gd < K.rushDist && gd > 0.1) {
      a.tx = owner.x + ((gx - owner.x) / gd) * K.rushGap;
      a.ty = owner.y + ((gy - owner.y) / gd) * K.rushGap;
      a.urgent = true;
    }
  }
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

  // 침투: 공격 위치선정 × run 비례 확률로 수비 라인 근처로 달린다
  if (s.t >= a.runUntil && a.line >= 2 && owner && owner.team === a.team) {
    let chance = a.role.run * (a.attrs.offTheBall / 100) * O.runChance * Math.max(0.3, 1 + (O.runPace * (a.attrs.pace - 70)) / 100);
    // ② 줄 사이: 펄스 나인이 내려와 비운 중앙으로 2선(침투 성향 run ≥ lateRunRun)이 더 자주 뛰어든다 (E3.7 역할 반응)
    if (a.role.run >= O.lateRunRun && !hasModule(a.role, 'between') && s.agents.some((o) => o.onPitch && o.team === a.team && o.role.id === 'falseNine')) chance *= 1 + RM.nineVacate;
    if (rand(s.seed, s.tick, a.idx, Purpose.Run) < chance) a.runUntil = s.t + O.runSeconds;
  }
  const running = s.t < a.runUntil;
  // 라인을 타는 정확도: 능력치가 낮을수록 라인보다 앞에 설 확률이 높다
  const sigma = ((100 - a.attrs.offTheBall) * O.offsideSigma) / L;
  if (running) {
    nx = line + a.errX * sigma * O.runLineError;
    const [px, py] = toPitch(nx, ny, dir);
    urgent = dist(px, py, a.x, a.y) > 3;
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
    if (job === 'cutback' && !wide) {
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
  // 역할 움직임 모듈 (E.6 D.13): ② 줄 사이 이동, ① 빈 공간 찾기 (침투·최종 3분의 1 역할 중이 아닐 때)
  const mate = !!owner && owner.team === a.team && owner !== a;
  if (!running && !job && hasModule(a.role, 'between')) [nx, ny] = betweenLines(s, a, dir, nx, ny, bnx);
  if (!running && !job && mate && hasModule(a.role, 'space')) [nx, ny] = findSpace(s, a, dir, nx, ny, line);
  // 내려와서 받기 / 지원 간격 (티키타카는 지원 삼각형 간격이 좁다, E.19)
  const tiki = s.teams[a.team].tactics.tendency === 'tikitaka';
  // 빌드업 전술: 짧게일수록 지원 간격이 좁다 (E.19 ③)
  const sk = 1 + F.styleSupport * (0.5 - s.teams[a.team].tactics.style);
  const supMin = (tiki ? TENDENCY.tikiSupport[0] : O.supportMin) * sk;
  const supMax = (tiki ? TENDENCY.tikiSupport[1] : O.supportMax) * sk;
  if (owner && owner.team === a.team && owner !== a && !job) {
    const [ox, oy] = toNorm(owner.x, owner.y, dir);
    if (!running && a.role.drop > 0 && nx > ox) nx -= (a.role.drop * O.dropDist) / L * 0.5;
    const [px, py] = toPitch(nx, ny, dir);
    const d = dist(px, py, owner.x, owner.y);
    if (d < supMin && d > 0.1) {
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
  if (!running && !job && mate && hasModule(a.role, 'demand')) {
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
  void bny;
  setTarget(a, nx, ny, dir, urgent);
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
  if (a.line !== 2 || hasModule(a.role, 'exempt')) return ny;
  for (const e of s.agents) {
    if (!e.onPitch || e.team !== a.team || e.line < 2 || !hasModule(e.role, 'exempt')) continue;
    let pick: Agent | null = null;
    let pd = Infinity;
    for (const o of s.agents) {
      if (!o.onPitch || o.team !== a.team || o.line !== 2 || o === e || hasModule(o.role, 'exempt')) continue;
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
function finalThirdJob(s: SimState, a: Agent, owner: Agent): 'cutback' | 'edge' | 'near' | 'far' | 'backPost' | 'halfSpace' | null {
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
  if (runner === a) return 'cutback';
  const rest = mates.filter((o) => (o.pos === 'CM' || o.pos === 'CAM' || o.pos === 'CDM') && o !== runner).sort((x, y) => bd(x) - bd(y));
  return rest[0] === a ? 'edge' : null;
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
    const second = rank === 1 && sitPressers(s, a.team) >= 2 && (pressLevel(s, a.team) >= 2 || t.pressing * (0.5 + a.role.press) > 0.6);
    let wants = rank === 0 || second;
    // ④ 수비 의무 면제: 공에 가장 가깝고 아주 가까울 때만 압박한다
    const exempt = hasModule(a.role, 'exempt');
    if (exempt && !(rank === 0 && d < pressDist * RM.exemptPress)) wants = false;
    // 박스 안 압박 (E.23, C.75c): 공이 우리 박스 안이면 가장 가까운 1명이 성향과 무관하게 바로 붙고, 둘째는 공 뒤 커버
    const ownBox = Math.abs(b.x - gx0) <= ENGINE.pitch.boxDepth && Math.abs(b.y - gy0) <= ENGINE.pitch.boxWidth / 2;
    if (ownBox && rank === 1) {
      coverSpot(a, dir, b.x, b.y);
      return;
    }
    if (ownBox && rank === 0) {
      const bd0 = dist(b.x, b.y, gx0, gy0) || 1;
      a.tx = b.x + ((gx0 - b.x) / bd0) * ENGINE.defense.boxPressGap;
      a.ty = b.y + ((gy0 - b.y) / bd0) * ENGINE.defense.boxPressGap;
      a.urgent = true;
      return;
    }
    // 수비 블록: 공격 줄은 1명만 압박 / 역습: 남는 최전방은 압박하지 않는다 (E.19)
    const tendency = s.teams[a.team].tactics.tendency;
    const deep = tendency === 'block' || tendency === 'bus';
    if (a.line === 3 && deep && closerForward(s, a, b.x, b.y)) wants = false;
    if (a.line === 3 && (tendency === 'counter' || (tendency === 'bus' && TENDENCY.busStay > 0)) && isTopForward(s, a)) wants = false;
    if (wants && (danger && rank === 0 || d < pressDist * (rank === 0 ? 1 : O.secondPressDist))) {
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
      a.urgent = true;
      return;
    }
    // 위험지역 둘째 (C.75c): 공에 붙지 않고 공과 골 사이 커버 자리 (dangerPress 안 2명 압박 대신)
    if (rank === 1 && danger && !exempt) {
      coverSpot(a, dir, b.x, b.y);
      return;
    }
  }

  ensureErrors(s, a);
  // 박스 앞 수비 블록 (E.20 3번): 수비수는 ST 마크 1명과 박스 안 공간 덮기
  // 상대 ST/CF 가 박스 안에 있으면 stMarkZoneBox 부터 (C.29 fix2 가설 B)
  const ballGoal = dist(b.x, b.y, gx0, gy0);
  const markZone = ballGoal < Math.max(O.boxZone, O.stMarkZone) || (ballGoal < O.stMarkZoneBox && oppStrikerInBox(s, a.team, dir));
  if (a.line === 1 && markZone && boxDefense(s, a, dir, boxZone)) return;

  let [nx, ny] = slotTarget(s, a);
  const tendency = s.teams[a.team].tactics.tendency;
  let lineX = defensiveLine(s, a.team);
  // 수비 블록 (E.19): 수비 라인은 박스 경계 앞으로 나가지 않고, 수비-중원 간격 12 m 이하
  // 버스 세우기 (C.76k): 라인 상한 14 m(박스 앞), 수비-중원 간격 8 m (두 줄 버스)
  if (tendency === 'block') lineX = Math.min(lineX, TENDENCY.blockLineMax / L);
  else if (tendency === 'bus') lineX = Math.min(lineX, TENDENCY.busLineMax / L);
  const midGap = tendency === 'block' ? Math.min(F.midGap, TENDENCY.blockGap / L) : tendency === 'bus' ? Math.min(F.midGap, TENDENCY.busGap / L) : F.midGap;
  if (a.line === 2) nx = Math.min(nx, lineX + midGap);
  else if (a.line === 3) nx = Math.min(nx, lineX + F.attGap);
  // 역습 (E.19)·버스 세우기 (C.76k, 역습 출구): 최전방 1명은 하프라인 부근에 남는다
  if ((tendency === 'counter' || (tendency === 'bus' && TENDENCY.busStay > 0)) && a.line === 3 && isTopForward(s, a)) nx = Math.max(nx, TENDENCY.counterStayX);
  // ④ 수비 의무 면제 (E.6 D.13): 깊이 복귀하지 않고 마크도 하지 않는다 (다음 공격 기점). 빈자리는 커버 재배분이 메운다
  if (hasModule(a.role, 'exempt') && a.line >= 2) {
    nx = Math.max(nx, a.line === 3 ? RM.exemptAttX : RM.exemptMidX);
    setTarget(a, nx, ny, dir, false);
    return;
  }
  ny = coverShiftY(s, a, ny);
  // CDM 스크린 (E.22 A): 공과 상대 최전방 사이 중앙 길목. 홀딩 CM 도 같이 (E3.7 역할 반응: 수비 역할의 수비 효과)
  if ((a.pos === 'CDM' || a.role.id === 'holdingCM') && owner && owner.team !== a.team) {
    const spot = screenSpot(s, a, owner, dir, lineX);
    if (spot) {
      setTarget(a, spot[0], spot[1], dir, false);
      return;
    }
  }
  if (a.line === 1) {
    // 수비 라인 동기화. 오차는 수비 포지셔닝과 마킹
    const sigma = ((100 - (a.attrs.defensivePositioning + a.attrs.marking) / 2) * O.markSigma) / L;
    nx = lineX + a.errX * sigma;
  }

  // 마킹: 존 근처의 위협적인 상대. 수비 주의 집중 대상(E.20 8번)이 존 근처에 있으면 그 선수를 먼저, 더 가깝게
  const [zx, zy] = toPitch(nx, ny, dir);
  const focus = focusThreat(s, a.team);
  // 줄 2 존 마크의 ST 쏠림 해소 (C.76w, 미해결 8·11): focus 가 이미 boxDefense 마커를 가진 상태(markZone + 위협 1위 마커)면
  // 존 마크는 focus 를 빼고 존 근처 다른 상대(2선 침투자가 대개 여기 걸린다)를 맡는다
  const focusHeld = markZone && threatMarker(s, a.team) !== null;
  let mark: Agent | null = null;
  let best = 14;
  for (const o of s.agents) {
    // 공 가진 선수는 압박자·커버가 맡는다 (C.75c: 존 마크가 소유자를 따라 들어와 셋째 사람이 되던 것)
    if (!o.onPitch || o.team === a.team || o.line === 0 || o.idx === s.ball.owner) continue;
    if (focusHeld && o === focus) continue;
    const d = dist(o.x, o.y, zx, zy);
    if (d < best) {
      best = d;
      mark = o;
    }
  }
  if (focus && !focusHeld && dist(focus.x, focus.y, zx, zy) < 14) mark = focus;
  const goalSide = O.markGoalSide * (mark && mark === focus ? O.focusMark : 1);
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
    if (a.line === 1) {
      ny = ny * 0.5 + mny * 0.5;
      nx = Math.min(nx, mnx);
    } else {
      const w = a.line === 3 ? 0.3 : 0.65;
      nx = nx * (1 - w) + mnx * w;
      ny = ny * (1 - w) + mny * w;
    }
  }
  // 복귀 (E.18 A3): 목표가 자기 골 쪽으로 10 m 이상이면 러닝 이상, 20 m 이상이면 (긴급 복귀 판단 시) 최대 속도
  const [ax] = toNorm(a.x, a.y, dir);
  const back = (ax - nx) * L;
  void bnx;
  void bny;
  setTarget(a, nx, ny, dir, back >= O.recoverSprint && a.recoverUrgent);
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
  const defs = s.agents.filter((o) => o.onPitch && o.team === a.team && o.line === 1 && ballRank(s, o, b.x, b.y) >= 2);
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
    const second = (abil >= O.focusDoubleMin || !others.length || !O.boxManMax) && inBox && !ballNear ? defs.filter((o) => o !== marker).sort(near)[0] : undefined;
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
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
      a.minRun = false;
      return true;
    }
    if (second === a) {
      const bd = dist(t.x, t.y, b.x, b.y) || 1;
      a.tx = clamp(t.x + ((b.x - t.x) / bd) * O.stMark + a.errX * O.markSigma, 0.3, L - 0.3);
      a.ty = clamp(t.y + ((b.y - t.y) / bd) * O.stMark + a.errY * O.markSigma, 0.3, W - 0.3);
      a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
      a.minRun = false;
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
          const gd2 = dist(u.x, u.y, gx, gy) || 1;
          a.tx = clamp(u.x + ((gx - u.x) / gd2) * O.stMark + a.errX * O.markSigma, 0.3, L - 0.3);
          a.ty = clamp(u.y + ((gy - u.y) / gd2) * O.stMark + a.errY * O.markSigma, 0.3, W - 0.3);
          a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
          a.minRun = false;
          return true;
        }
        rest = rest.filter((o) => o !== m2);
        deepT2 = u;
      }
    }
    // 덮는 자리 앞에 사람 (C.76w (b)): 박스 안 미마크 상대(위협 순)에게 남은 수비수 중 가장 가까운 1명씩, boxManMax 명까지 골 쪽 stMark
    let marks = 0;
    for (const u of others) {
      if (marks >= O.boxManMax || !rest.length) break;
      if (u === deepT2) continue;
      const m = rest.slice().sort((x, y) => dist(x.x, x.y, u.x, u.y) - dist(y.x, y.y, u.x, u.y) || x.idx - y.idx)[0]!;
      marks++;
      if (m === a) {
        const gd2 = dist(u.x, u.y, gx, gy) || 1;
        a.tx = clamp(u.x + ((gx - u.x) / gd2) * O.stMark + a.errX * O.markSigma, 0.3, L - 0.3);
        a.ty = clamp(u.y + ((gy - u.y) / gd2) * O.stMark + a.errY * O.markSigma, 0.3, W - 0.3);
        a.urgent = dist(a.tx, a.ty, a.x, a.y) > 3;
        a.minRun = false;
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
export function threatAbility(o: Agent): number {
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
function closeDownAgent(s: SimState, team: 0 | 1, gx: number, gy: number): Agent | null {
  return closeDownPlan(s, team, gx, gy).pick;
}
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
    if (!o.onPitch || o.team !== team || o.line === 0 || o === marker || hasModule(o.role, 'exempt')) continue;
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
  if (!deep || !(rcv.pos === 'ST' || rcv.pos === 'CF')) second = null;
  return { pick, second };
}

/** 깊은 블록 성향(수비 블록·버스 세우기)인가 */
function isDeepBlock(s: SimState, team: 0 | 1): boolean {
  const t = s.teams[team].tactics.tendency;
  return t === 'block' || t === 'bus';
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
    if (!o.onPitch || o.team !== team || o.line === 0 || o === cd.pick || o === cd.second || o === marker || hasModule(o.role, 'exempt')) continue;
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
  a.errTick = s.tick;
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
