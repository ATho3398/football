// 온더볼 의사결정 (E.7): 후보 행동의 효용 U = P × V + (1 − P) × C 를 softmax 로 고른다
// 후보: 패스(각 동료), 침투 패스, 몰고 가기/드리블 돌파(전진·좌·우), 슛, 크로스, 클리어링, 유지

import { ENGINE } from './config';
import { aerialWin, dribbleProb } from './duel';
import { manDiff } from './formation';
import { claimProb, keeperOf, saveProb } from './keeper';
import { attackDir, clamp, dist, inOppBox, L, oppGoal, positionValue, segDist, toNorm, toPitch, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import { offsideRisk } from './referee';
import type { Agent, Flight, SimState } from './state';

const O = ENGINE.onball;
const PR = ENGINE.prob;
const B = ENGINE.ball;
const G = ENGINE.pitch.goalWidth;

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
  /** 성공 시 위치 가치 (슛은 xG) */
  value: number;
  /** 드리블 돌파 상대 */
  opponent?: number;
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
  const p = PR.passBase - PR.passPerM * d + (PR.passSkill * (skill - 60)) / 100 - lane.risk - PR.pressurePenalty * pressureAt(s, a) + formBonus(a);
  return clamp(p, PR.passMin, PR.passMax);
}

/** 폼 보정 (E.16): 내 선수의 성공 확률에 ±3%p (폼 보정 ±0.3 × 0.1) */
export function formBonus(a: Agent): number {
  return a.spec.form * ENGINE.match.formToProb;
}

/** 소유 상실 비용: 상대가 그 위치에서 갖는 가치 */
export function lossCost(nx: number, ny: number): number {
  return -(O.lossBase + positionValue(1 - nx, 1 - ny) * O.lossOppScale);
}

function weight(u: number, m: number): number {
  return u >= 0 ? u * m : u / m;
}

export function judgementOf(a: Agent): number {
  const t = a.attrs;
  return (t.vision * 0.5 + t.composure * 0.3 + t.shortPassing * 0.2) / 100;
}

// ── 슈팅 모델 (E.8, E.9) ──

export interface ShotModel {
  d: number;
  pOn: number;
  pBlock: number;
  /** 유효 슈팅이 골이 될 기대 확률 (구석 0.5 기준) */
  pGoal: number;
  xg: number;
  speed: number;
  blockers: number;
}

function goalAngle(x: number, y: number, gx: number): number {
  const a1 = Math.atan2(W / 2 - G / 2 - y, Math.abs(gx - x));
  const a2 = Math.atan2(W / 2 + G / 2 - y, Math.abs(gx - x));
  return Math.abs(a2 - a1);
}

export function shotModel(s: SimState, a: Agent, header = false, at?: { x: number; y: number }): ShotModel {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const px = at?.x ?? a.x;
  const py = at?.y ?? a.y;
  const d = dist(px, py, gx, gy);
  const t = a.attrs;
  const pressure = pressureAt(s, a, px, py);
  let pOn: number;
  let speed: number;
  if (header) {
    pOn = clamp(PR.headerBase + (PR.headerSkill * t.heading) / 100 - PR.headerPerM * d, PR.shotMin, PR.shotMax);
    speed = PR.headerSpeed;
  } else {
    const skill = d >= PR.longShotFrom
      ? t.longShots * 0.6 + t.composure * 0.25 + t.bigMatch * 0.15
      : t.shooting * 0.6 + t.composure * 0.25 + t.bigMatch * 0.15;
    pOn = clamp(PR.shotBase + (PR.shotSkill * skill) / 100 - PR.shotPerM * d - PR.shotPressure * pressure + formBonus(a), PR.shotMin, PR.shotMax);
    speed = B.shotSpeedMin + ((B.shotSpeedMax - B.shotSpeedMin) * t.shooting) / 100;
  }
  pOn *= Math.min(1, goalAngle(px, py, gx) / PR.shotAngleRef);
  let blockers = 0;
  if (!header) {
    for (const o of s.agents) {
      if (!o.onPitch || o.team === a.team || o.line === 0) continue;
      const [cd, ct] = segDist(o.x, o.y, px, py, gx, gy);
      if (cd < PR.coneWidth && ct > 0.02 && ct < 0.95) blockers++;
    }
  }
  const pBlock = Math.min(PR.blockMax, blockers * PR.blockPer);
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const pGoal = 1 - saveProb(gk, speed, 0.5, d, ENGINE.keeper.perceivedSaveBase);
  return { d, pOn, pBlock, pGoal, xg: (1 - pBlock) * pOn * pGoal, speed, blockers };
}

/** 같은 팀 동료 중 상대 박스 안 */
function boxTeammates(s: SimState, a: Agent, dir: 1 | -1): Agent[] {
  return s.agents.filter((o) => o.onPitch && o.team === a.team && o !== a && o.line !== 0 && inOppBox(o.x, o.y, dir));
}

/** 크로스 대상: 박스 안 동료 중 공중볼 승산 × 헤더 기대 가치가 가장 큰 선수 */
export function crossTarget(s: SimState, a: Agent): { r: Agent; pWin: number; value: number } | null {
  const dir = attackDir(a.team, s.half);
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  let best: { r: Agent; pWin: number; value: number } | null = null;
  for (const r of boxTeammates(s, a, dir)) {
    const [def, dd] = nearestOpponent(s, r);
    let pWin = def && dd < PR.aerialRadius + 1 ? aerialWin(r, def) : 0.85;
    if (gk && dist(gk.x, gk.y, r.x, r.y) < ENGINE.keeper.claimRange) pWin *= 1 - claimProb(gk);
    const value = shotModel(s, r, true).xg * PR.shotValue * r.role.pref.header;
    if (!best || pWin * value > best.pWin * best.value) best = { r, pWin, value };
  }
  return best;
}

/** 후보 행동 생성 */
export function candidates(s: SimState, a: Agent): Candidate[] {
  const dir = attackDir(a.team, s.half);
  const [ax, ay] = toNorm(a.x, a.y, dir);
  const here = positionValue(ax, ay);
  const pressure = pressureAt(s, a);
  const lossHere = lossCost(ax, ay);
  const safeMul = manDiff(s, a.team) < 0 ? ENGINE.referee.shortSafe : 1;
  const isGk = a.line === 0;
  const out: Candidate[] = [];
  const [gx0, gy0] = oppGoal(dir);

  // 패스 / 침투 패스
  for (const r of s.agents) {
    if (r === a || !r.onPitch || r.team !== a.team) continue;
    const d0 = dist(a.x, a.y, r.x, r.y);
    if (d0 > O.passMaxDist || d0 < 3) continue;
    const running = s.t < r.runUntil;
    const lead = running ? O.leadTime * 2 : O.leadTime;
    const tx = clamp(r.x + r.vx * lead, 1, L - 1);
    const ty = clamp(r.y + r.vy * lead, 1, W - 1);
    const lane = laneRisk(s, a, tx, ty);
    const rp = Math.max(0, 1 - nearestOpponent(s, r, tx, ty)[1] / PR.receiverPressureDist);
    const p = clamp(passProbability(s, a, tx, ty, 'pass', lane) - PR.receiverPressure * rp, PR.passMin, PR.passMax);
    const [rx, ry] = toNorm(tx, ty, dir);
    let value = positionValue(rx, ry) - rp * PR.receiverValueCost;
    // 받는 자리에서 슛을 노릴 수 있으면 그 기대값도 가치로 본다 (컷백, 레이오프)
    if (dist(tx, ty, gx0, gy0) <= PR.shotMaxDist && rx > 0.6) {
      value = Math.max(value, shotModel(s, r, false, { x: tx, y: ty }).xg * PR.shotValue + PR.shotBias * O.passShotShare);
    }
    let u = p * value + (1 - p) * lossCost(rx, ry);
    // 받을 선수가 오프사이드 위치로 보이면 그 확률만큼 상대 프리킥 (E.7, E.10)
    const pOff = offsideRisk(s, a, r);
    if (pOff > 0) u = (1 - pOff) * u + pOff * lossCost(rx, ry);
    const forward = rx > ax + 0.03;
    u = weight(u, a.role.pref.pass * (forward ? a.role.pref.forward : a.role.pref.safe * safeMul));
    const lp = s.lastPass;
    if (lp && lp.passer === r.idx && lp.receiver === a.idx && s.t - lp.t < O.returnPassWindow) u -= O.returnPassPenalty;
    if (value <= here) u -= O.noGainCost;
    out.push({ type: running ? 'through' : 'pass', p, u, x: tx, y: ty, receiver: r.idx, value });
  }

  if (!isGk) {
    // 몰고 가기 / 드리블 돌파: 앞쪽에 수비수가 가까우면 돌파 (E.8 드리블 1대1)
    for (const ang of [0, 0.6, -0.6]) {
      const ux = Math.cos(ang) * dir;
      const uy = Math.sin(ang);
      const cx = clamp(a.x + ux * O.carryDist, 1, L - 1);
      const cy = clamp(a.y + uy * O.carryDist, 1, W - 1);
      const [nx, ny] = toNorm(cx, cy, dir);
      let def: Agent | null = null;
      let second = false;
      let dd = Infinity;
      for (const o of s.agents) {
        if (!o.onPitch || o.team === a.team || o.line === 0 || s.t < o.beatenUntil) continue;
        const ox = o.x - a.x;
        const oy = o.y - a.y;
        const od = Math.sqrt(ox * ox + oy * oy);
        if (od > PR.dribbleRange || ox * ux + oy * uy < 0) continue;
        if (od < dd) {
          second = def !== null || second;
          def = o;
          dd = od;
        } else second = true;
      }
      const value = positionValue(nx, ny);
      if (def) {
        const p = clamp(dribbleProb(a, def, second ? -PR.spaceSecondPenalty : 0) + formBonus(a), 0.02, 0.98);
        const u = weight(p * (value + 0.01) + (1 - p) * lossHere, a.role.pref.dribble) - O.dribbleCost;
        out.push({ type: 'dribble', p, u, x: cx, y: cy, receiver: -1, value, opponent: def.idx });
      } else {
        const p = clamp(0.98 - pressure * O.carryPressure, 0.05, 0.98);
        const u = weight(p * value + (1 - p) * lossHere, a.role.pref.dribble);
        out.push({ type: 'carry', p, u, x: cx, y: cy, receiver: -1, value });
      }
    }

    // 슛
    const [gx, gy] = oppGoal(dir);
    if (dist(a.x, a.y, gx, gy) <= PR.shotMaxDist && ax > 0.6) {
      const m = shotModel(s, a);
      const u = weight(m.xg * PR.shotValue + (m.d >= PR.longShotFrom && a.line >= 2 && a.pos !== 'ST' && a.pos !== 'CF' ? PR.shotBias : 0) + (1 - m.xg) * -O.lossBase * 0.5, a.role.pref.shoot);
      out.push({ type: 'shoot', p: m.xg, u, x: gx, y: gy, receiver: -1, value: m.xg });
    }

    // 크로스: 측면 최종 3분의 1, 박스 안 동료 1명 이상
    if (ax >= PR.crossMinX && (ay < PR.crossWide || ay > 1 - PR.crossWide)) {
      const ct = crossTarget(s, a);
      if (ct) {
        const acc = clamp(0.5 + (0.5 * a.attrs.crossing) / 100 - PR.pressurePenalty * pressure, 0.2, 1);
        const p = acc * ct.pWin;
        const u = weight(p * ct.value * PR.crossValue + (1 - p) * lossCost(ax, ay) * PR.crossLossScale, a.role.pref.cross);
        out.push({ type: 'cross', p, u, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
      }
    }

    // 클리어링: 수비 3분의 1, 압박이 심할 때
    if (ax < PR.clearMaxX && pressure > PR.clearPressure) {
      const [tx, ty] = toPitch(clamp(ax + 0.42, 0, 0.9), 0.5 + (ay - 0.5) * 0.5, dir);
      const p = 0.45;
      const [nx, ny] = toNorm(tx, ty, dir);
      const u = weight(p * positionValue(nx, ny) + (1 - p) * lossCost(nx, ny), a.role.pref.clear);
      out.push({ type: 'clear', p, u, x: tx, y: ty, receiver: -1, value: positionValue(nx, ny) });
    }
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
  let maxU = -Infinity;
  for (const c of cands) maxU = Math.max(maxU, c.u);
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
export function makePass(s: SimState, a: Agent, c: Candidate): Flight {
  const d = dist(a.x, a.y, c.x, c.y);
  const air = d > 30;
  const speed = air ? B.airSpeed : clamp(B.passSpeedBase + B.passSpeedPerM * d, B.passSpeedMin, B.passSpeedMax);
  const dur = Math.max(0.2, d / speed);
  const fl: Flight = {
    kind: air ? 'long' : 'pass', fromX: a.x, fromY: a.y, toX: c.x, toY: c.y, t0: s.t, dur, air,
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
