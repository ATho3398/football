// 오프더볼 움직임 (E.6): 공격 시 슬롯 + 지원 + 침투(오프사이드 라인 인지), 수비 시 마킹 + 라인 동기화 + 압박

import { ENGINE } from './config';
import { ballNorm, manDiff, slotTarget, teamPhase } from './formation';
import { attackDir, clamp, dist, L, ownGoal, toNorm, toPitch, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import type { Agent, SimState } from './state';

const O = ENGINE.offball;
const F = ENGINE.formation;

/** 팀 전술 값 (수적 열세/우세 보정 포함, E.10) */
export function effectiveTactics(s: SimState, team: 0 | 1): { lineHeight: number; pressing: number } {
  const base = s.teams[team].tactics;
  const d = manDiff(s, team);
  const R = ENGINE.referee;
  if (d < 0) return { lineHeight: clamp(base.lineHeight - R.shortLine, 0, 1), pressing: clamp(base.pressing - R.shortPress, 0, 1) };
  if (d > 0) return { lineHeight: clamp(base.lineHeight + R.extraLine, 0, 1), pressing: clamp(base.pressing + R.extraPress, 0, 1) };
  return base;
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
function ballRank(s: SimState, a: Agent, bx: number, by: number): number {
  const d = dist(a.x, a.y, bx, by);
  let rank = 0;
  for (const o of s.agents) {
    if (o === a || !o.onPitch || o.team !== a.team || o.line === 0) continue;
    if (dist(o.x, o.y, bx, by) < d) rank++;
  }
  return rank;
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
}

/** 오프더볼 목표 갱신 */
export function updateOffball(s: SimState, a: Agent): void {
  const dir = attackDir(a.team, s.half);
  const b = s.ball;
  const fl = b.flight;

  // 패스를 받을/가로챌 선수는 도착점으로
  if (fl && (fl.outcome === 'receive' && fl.receiver === a.idx || fl.outcome === 'intercept' && fl.interceptor === a.idx)) {
    a.tx = fl.toX;
    a.ty = fl.toY;
    a.urgent = true;
    return;
  }
  if (a.line === 0 && !s.restart) {
    keeperTarget(s, a);
    return;
  }

  // 리스타트 대기: 키커는 공으로, 나머지는 대형
  if (s.restart) {
    if (s.restart.taker === a.idx) {
      a.tx = s.restart.x;
      a.ty = s.restart.y;
      a.urgent = true;
      return;
    }
    if (a.line === 0) {
      keeperTarget(s, a);
      return;
    }
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
    return;
  }

  // 루즈볼: 팀별 가장 가까운 chasers 명이 쫓는다
  const loose = b.owner < 0 && (!fl || fl.outcome === 'loose');
  if (loose) {
    const [cx, cy] = ballChasePoint(s);
    if (ballRank(s, a, cx, cy) < ENGINE.ball.chasers) {
      a.tx = cx;
      a.ty = cy;
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
  const shortHanded = manDiff(s, a.team) < 0;
  let [nx, ny] = slotTarget(s, a, shortHanded ? ENGINE.referee.shortAttackShift : 1);
  const line = offsideLine(s, a.team);
  const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
  let urgent = false;

  // 침투: 공격 위치선정 × run 비례 확률로 수비 라인 근처로 달린다
  if (s.t >= a.runUntil && a.line >= 2 && owner && owner.team === a.team) {
    const chance = a.role.run * (a.attrs.offTheBall / 100) * O.runChance;
    if (rand(s.seed, s.tick, a.idx, Purpose.Run) < chance) a.runUntil = s.t + O.runSeconds;
  }
  const running = s.t < a.runUntil;
  // 라인을 타는 정확도: 능력치가 낮을수록 라인보다 앞에 설 확률이 높다
  const sigma = ((100 - a.attrs.offTheBall) * O.offsideSigma) / L;
  if (running) {
    nx = line + a.errX * sigma * 3;
    const [px, py] = toPitch(nx, ny, dir);
    urgent = dist(px, py, a.x, a.y) > 3;
  } else if (a.line >= 2) {
    nx = Math.min(nx, line - 1 / L + a.errX * sigma);
  }
  // 내려와서 받기 / 지원 간격
  if (owner && owner.team === a.team && owner !== a) {
    const [ox, oy] = toNorm(owner.x, owner.y, dir);
    if (!running && a.role.drop > 0 && nx > ox) nx -= (a.role.drop * O.dropDist) / L * 0.5;
    const [px, py] = toPitch(nx, ny, dir);
    const d = dist(px, py, owner.x, owner.y);
    if (d < O.supportMin && d > 0.1) {
      const k = O.supportMin / d;
      const [qx, qy] = [owner.x + (px - owner.x) * k, owner.y + (py - owner.y) * k];
      [nx, ny] = toNorm(qx, qy, dir);
    } else if (d > O.supportMax + 15 && a.line >= 2) {
      // 너무 멀면 공 쪽으로 약간
      nx += (ox - nx) * 0.15;
      ny += (oy - ny) * 0.15;
    }
  }
  void bnx;
  void bny;
  setTarget(a, nx, ny, dir, urgent);
}

function defendTarget(s: SimState, a: Agent, dir: 1 | -1, bnx: number, bny: number): void {
  const t = effectiveTactics(s, a.team);
  const b = s.ball;
  const owner = b.owner >= 0 ? s.agents[b.owner]! : null;

  // 압박: 공에 가까운 1~2명 (2번째는 압박 성향이 높을 때)
  if (owner && owner.team !== a.team) {
    const rank = ballRank(s, a, b.x, b.y);
    const pressDist = (O.pressDistBase + t.pressing * O.pressDistRange) * (a.line === 3 ? O.attackerPress : 1);
    const d = dist(a.x, a.y, b.x, b.y);
    const [gx0, gy0] = ownGoal(dir);
    const danger = dist(b.x, b.y, gx0, gy0) < O.dangerPress;
    const wants = rank === 0 || (rank === 1 && (danger || t.pressing * (0.5 + a.role.press) > 0.6));
    if (wants && (danger && rank < 2 || d < pressDist * (rank === 0 ? 1 : 0.6))) {
      // 공과 자기 골 사이에서 압박
      const [gx, gy] = ownGoal(dir);
      const gd = dist(b.x, b.y, gx, gy) || 1;
      a.tx = b.x + ((gx - b.x) / gd) * 1.0;
      a.ty = b.y + ((gy - b.y) / gd) * 1.0;
      a.urgent = true;
      return;
    }
  }

  let [nx, ny] = slotTarget(s, a);
  const lineX = defensiveLine(s, a.team);
  if (a.line === 2) nx = Math.min(nx, lineX + F.midGap);
  else if (a.line === 3) nx = Math.min(nx, lineX + F.attGap);
  if (a.line === 1) {
    // 수비 라인 동기화. 오차는 수비 포지셔닝과 마킹
    const sigma = ((100 - (a.attrs.defensivePositioning + a.attrs.marking) / 2) * O.markSigma) / L;
    nx = lineX + a.errX * sigma;
  }

  // 마킹: 존 근처의 위협적인 상대
  const [zx, zy] = toPitch(nx, ny, dir);
  let mark: Agent | null = null;
  let best = 14;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const d = dist(o.x, o.y, zx, zy);
    if (d < best) {
      best = d;
      mark = o;
    }
  }
  if (mark) {
    const [gx, gy] = ownGoal(dir);
    const gd = dist(mark.x, mark.y, gx, gy) || 1;
    const sigma = (100 - (a.attrs.marking + a.attrs.defensivePositioning) / 2) * O.markSigma;
    const mx = mark.x + ((gx - mark.x) / gd) * O.markGoalSide + a.errX * sigma;
    const my = mark.y + ((gy - mark.y) / gd) * O.markGoalSide + a.errY * sigma;
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
  // 복귀: 공보다 앞에 있는 미드/수비는 급히 돌아온다
  const [ax] = toNorm(a.x, a.y, dir);
  const urgent = a.line <= 2 && ax > bnx + O.recoverBehind && rand(s.seed, s.tick, a.idx, Purpose.Offball) < O.recoverBase + (a.attrs.workRate / 100) * O.workRateSpeed;
  void bny;
  setTarget(a, nx, ny, dir, urgent);
}

/** 오프더볼 갱신 때 위치 오차를 새로 뽑는다 */
export function refreshErrors(s: SimState, a: Agent): void {
  a.errX = randn(s.seed, s.tick, a.idx, Purpose.Mark, 0);
  a.errY = randn(s.seed, s.tick, a.idx, Purpose.Mark, 1);
}
