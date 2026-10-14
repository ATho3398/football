// 온더볼 의사결정 (E.7): 후보 행동의 효용 U = P × V + (1 − P) × C 를 softmax 로 고른다

import { ENGINE } from './config';
import { manDiff } from './formation';
import { attackDir, clamp, dist, L, positionValue, segDist, toNorm, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import type { Agent, Flight, SimState } from './state';

const O = ENGINE.onball;
const PR = ENGINE.prob;
const B = ENGINE.ball;

export type ActionType = 'pass' | 'through' | 'carry' | 'hold' | 'shoot' | 'cross' | 'clear' | 'dribble';

export interface Candidate {
  type: ActionType;
  /** 성공 확률 */
  p: number;
  /** 효용 */
  u: number;
  /** 목표 지점 */
  x: number;
  y: number;
  receiver: number;
  /** 성공 시 위치 가치 (또는 xG) */
  value: number;
}

/** 가장 가까운 상대와 거리 */
export function nearestOpponent(s: SimState, a: Agent, x = a.x, y = a.y): [Agent | null, number] {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return [best, bd];
}

/** 압박 0~1 (가장 가까운 수비수 거리 기준, E.8) */
export function pressureAt(s: SimState, a: Agent, x = a.x, y = a.y): number {
  const [, d] = nearestOpponent(s, a, x, y);
  return Math.max(0, 1 - d / PR.pressureDist);
}

export interface LaneInfo {
  risk: number;
  /** 레인 근처 수비수와 가중치, 레인 위 위치 */
  cutters: { idx: number; w: number; t: number }[];
}

export function laneRisk(s: SimState, a: Agent, tx: number, ty: number): LaneInfo {
  let risk = 0;
  const cutters: LaneInfo['cutters'] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team) continue;
    const [d, t] = segDist(o.x, o.y, a.x, a.y, tx, ty);
    if (d >= PR.laneWidth || t <= 0.05) continue;
    const prox = 1 - d / PR.laneWidth;
    const w = (PR.laneBase + (PR.laneIntercept * o.attrs.interception) / 100) * prox;
    risk += w;
    cutters.push({ idx: o.idx, w, t });
  }
  return { risk, cutters };
}

/** 패스 성공 확률 (E.8) */
export function passProbability(s: SimState, a: Agent, tx: number, ty: number, kind: 'pass' | 'cross', lane: LaneInfo): number {
  const d = dist(a.x, a.y, tx, ty);
  const skill = kind === 'cross' ? a.attrs.crossing : d <= PR.shortPassMax ? a.attrs.shortPassing : a.attrs.longPassing;
  const p = PR.passBase - PR.passPerM * d + (PR.passSkill * (skill - 60)) / 100 - lane.risk - PR.pressurePenalty * pressureAt(s, a);
  return clamp(p, PR.passMin, PR.passMax);
}

/** 소유 상실 비용: 상대가 그 위치에서 갖는 가치 */
export function lossCost(nx: number, ny: number): number {
  return -(O.lossBase + positionValue(1 - nx, 1 - ny) * O.lossOppScale);
}

/** 효용 배수 (양수는 곱하고 음수는 나눈다) */
function weight(u: number, m: number): number {
  return u >= 0 ? u * m : u / m;
}

export function judgementOf(a: Agent): number {
  const t = a.attrs;
  return (t.vision * 0.5 + t.composure * 0.3 + t.shortPassing * 0.2) / 100;
}

/** 후보 행동 생성 (E1: 패스, 침투 패스, 몰고 가기, 유지) */
export function candidates(s: SimState, a: Agent): Candidate[] {
  const dir = attackDir(a.team, s.half);
  const [ax, ay] = toNorm(a.x, a.y, dir);
  const here = positionValue(ax, ay);
  const pressure = pressureAt(s, a);
  const lossHere = lossCost(ax, ay);
  const safeMul = manDiff(s, a.team) < 0 ? ENGINE.referee.shortSafe : 1;
  const out: Candidate[] = [];

  for (const r of s.agents) {
    if (r === a || !r.onPitch || r.team !== a.team) continue;
    const d0 = dist(a.x, a.y, r.x, r.y);
    if (d0 > O.passMaxDist || d0 < 3) continue;
    const running = s.t < r.runUntil;
    const lead = running ? O.leadTime * 2 : O.leadTime;
    const tx = clamp(r.x + r.vx * lead, 1, L - 1);
    const ty = clamp(r.y + r.vy * lead, 1, W - 1);
    const lane = laneRisk(s, a, tx, ty);
    const p = passProbability(s, a, tx, ty, 'pass', lane);
    const [rx, ry] = toNorm(tx, ty, dir);
    const value = positionValue(rx, ry) - pressureAt(s, r, tx, ty) * 0.01;
    let u = p * value + (1 - p) * lossCost(rx, ry);
    const forward = rx > ax + 0.03;
    u = weight(u, a.role.pref.pass * (forward ? a.role.pref.forward : a.role.pref.safe * safeMul));
    out.push({ type: running ? 'through' : 'pass', p, u, x: tx, y: ty, receiver: r.idx, value });
  }

  // 몰고 가기: 전진 / 대각 좌우
  const keep = clamp(1 - pressure * 0.6, 0.05, 0.98);
  for (const ang of [0, 0.6, -0.6]) {
    const cx = clamp(a.x + Math.cos(ang) * dir * O.carryDist, 1, L - 1);
    const cy = clamp(a.y + Math.sin(ang) * O.carryDist, 1, W - 1);
    const [nx, ny] = toNorm(cx, cy, dir);
    const p = clamp(keep - pressureAt(s, a, cx, cy) * 0.3, 0.05, 0.98);
    const value = positionValue(nx, ny);
    const u = weight(p * value + (1 - p) * lossHere, a.role.pref.dribble);
    out.push({ type: 'carry', p, u, x: cx, y: cy, receiver: -1, value });
  }

  // 유지
  const tempo = s.teams[a.team].tactics.tempo;
  const pHold = clamp(1 - pressure * 0.5, 0.05, 1);
  const holdU = pHold * (here + O.holdValue * (1.5 - tempo)) + (1 - pHold) * lossHere - O.holdPressure * pressure;
  out.push({ type: 'hold', p: pHold, u: holdU, x: a.x, y: a.y, receiver: -1, value: here });
  return out;
}

/** softmax 선택. 온도 τ = tempBase + tempSlope × (1 − 판단 품질) */
export function choose(s: SimState, a: Agent, cands: Candidate[]): Candidate {
  const tau = O.tempBase + O.tempSlope * (1 - a.judgement);
  const maxU = Math.max(...cands.map((c) => c.u));
  const ws = cands.map((c) => Math.exp(((c.u - maxU) * O.utilityScale) / tau));
  const total = ws.reduce((t, w) => t + w, 0);
  let r = rand(s.seed, s.tick, a.idx, Purpose.Decide) * total;
  for (let i = 0; i < cands.length; i++) {
    r -= ws[i]!;
    if (r <= 0) return cands[i]!;
  }
  return cands[cands.length - 1]!;
}

/** 패스 실행: 결과(성공/인터셉트/루즈볼)는 차는 순간 정하고 공은 도착점까지 날아간다 */
export function makePass(s: SimState, a: Agent, c: Candidate, kind: 'pass' | 'cross' | 'long' = 'pass'): Flight {
  const d = dist(a.x, a.y, c.x, c.y);
  const air = kind !== 'pass' || d > 30;
  const speed = air ? B.airSpeed : clamp(B.passSpeedBase + B.passSpeedPerM * d, B.passSpeedMin, B.passSpeedMax);
  const dur = Math.max(0.2, d / speed);
  const fl: Flight = {
    kind: kind === 'pass' && d > 30 ? 'long' : kind, fromX: a.x, fromY: a.y, toX: c.x, toY: c.y, t0: s.t, dur, air,
    passer: a.idx, receiver: c.receiver, outcome: 'receive', interceptor: -1,
  };
  if (rand(s.seed, s.tick, a.idx, Purpose.Pass) < c.p) return fl;

  // 실패: 레인 근처 수비수가 가로채거나 루즈볼
  const lane = laneRisk(s, a, c.x, c.y);
  const total = lane.cutters.reduce((t, x) => t + x.w, 0);
  if (total > 0 && rand(s.seed, s.tick, a.idx, Purpose.Intercept) < Math.min(1, PR.interceptShare + total * 0.3)) {
    let r = rand(s.seed, s.tick, a.idx, Purpose.Intercept, 1) * total;
    let pick = lane.cutters[0]!;
    for (const x of lane.cutters) {
      r -= x.w;
      if (r <= 0) { pick = x; break; }
    }
    fl.outcome = 'intercept';
    fl.interceptor = pick.idx;
    fl.toX = a.x + (c.x - a.x) * pick.t;
    fl.toY = a.y + (c.y - a.y) * pick.t;
    fl.dur = Math.max(0.15, dur * pick.t);
    return fl;
  }
  fl.outcome = 'loose';
  fl.toX = c.x + randn(s.seed, s.tick, a.idx, Purpose.Loose, 0) * PR.looseError;
  fl.toY = c.y + randn(s.seed, s.tick, a.idx, Purpose.Loose, 1) * PR.looseError;
  return fl;
}
