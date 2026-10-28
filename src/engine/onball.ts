// 온더볼 의사결정 (E.7): 후보 행동의 효용 U = P × V + (1 − P) × C 를 softmax 로 고른다
// 후보: 패스(각 동료), 침투 패스, 몰고 가기/드리블 돌파(전진·좌·우), 슛, 크로스, 클리어링, 유지

import { weakFootMul } from '../body';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../attributes';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as physics_ from './physics';
const { arrivalTime, duelEdgeOf, tiredRatio } = physics_;
import * as duel_ from './duel';
const { aerialWin, dribbleProb, duelTail, finishSkill, receiveWin } = duel_;
import * as formation_ from './formation';
const { manDiff } = formation_;
import * as roles_ from './roles';
const { hasModule } = roles_;
import { type ShotCtx } from './keeper';
import * as keeper_ from './keeper';
const { claimProb, coverOf, expectedSave, farSide, gkCtx, keeperOf, keeperZone, saveChance } = keeper_;
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, inOppBox, L, oppGoal, positionValue, segDist, toNorm, toPitch, W } = pitch_;
import * as rng_ from './rng';
const { Purpose, rand, randn } = rng_;
import { offsideRisk } from './referee';
import { offsideLine } from './offball';
import * as tactics_ from './tactics';
const { TENDENCY, widthCrossMul } = tactics_;
import * as rapport_ from './rapport';
const { chemMul, exploitMul, toMeMul } = rapport_;
import * as probe_ from './probe';
const { probe } = probe_;
import type { Agent, Flight, SimState } from './state';
import type { Tendency } from './types';

const O = ENGINE.onball;
const PR = ENGINE.prob;
const TA = ENGINE.tactics;
const B = ENGINE.ball;
const G = ENGINE.pitch.goalWidth;

export type ActionType = 'pass' | 'through' | 'cutback' | 'layoff' | 'holdup' | 'carry' | 'hold' | 'shoot' | 'cross' | 'clear' | 'dribble';

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
  /** 롱패스: 착지 경합 전 성공 확률 (판정은 이것으로 하고 경합은 도착 때 실제로 한다) */
  pFlight?: number;
  /** 침투 패스: 달리기 경쟁에서 상대 GK 가 수비 쪽 가장 빠르다 (실패하면 GK 가 끊는다, C.28) */
  keeper?: number;
  /** 카드로 더한 성공 확률 %p (C.36, 한 행동 상한 계산용). 카드가 없으면 없다 */
  cardD?: number;
  /** 백패스 가치 항 (C.77y): 효용에 더한 성분 (압박 탈출·보존·전환·기회 비용·인지 오차, 골 단위). 측정·장면이 이유를 분류한다 */
  back?: { escape: number; keep: number; sw: number; cost: number; noise: number };
  /** 원터치 (C.78b): 받는 순간 미리 정한 원터치 행동 (성공 확률에 원터치 배수가 들어 있다) */
  ot?: boolean;
}

const RC = ENGINE.receive;

/** 원터치 판단 중인 선수(본인·평균 선수)와 공 속도·압박 (C.78b). 판단 밖에서는 null */
let otNow: { a: Agent; av: Agent; speed: number; pr: number } | null = null;

/** 원터치 실행 배수 (C.78b): 공이 빠를수록·압박이 클수록 낮고 첫 터치(볼 컨트롤)가 좋을수록 높다 */
export function oneTouchMul(who: Agent, speed: number, pr: number): number {
  return clamp(1 - RC.otBase - (RC.otSpeed * Math.max(0, speed - 12)) / 10 - RC.otPress * pr + (RC.otSkill * (who.attrs.ballControl - 70)) / 100, RC.otMin, 1);
}

/** 지금 판정에 걸리는 원터치 배수: 원터치 판단 중인 본인·평균 선수, 또는 원터치 실행 중(otUntil 전)인 선수. 그 밖 1 */
function otOf(s: SimState, who: Agent): number {
  if (otNow && (who === otNow.a || who === otNow.av)) return oneTouchMul(who, otNow.speed, otNow.pr);
  return s.t < who.otUntil ? who.otMul : 1;
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

/** (fx, fy) 에서 오는 공을 (tx, ty) 에서 받으면 골을 등지는가: 몸 방향(공이 온 쪽)과 공격 방향 각도 ≥ backAngle */
export function receivesBack(fx: number, fy: number, tx: number, ty: number, dir: 1 | -1): boolean {
  const vx = fx - tx;
  const vy = fy - ty;
  const n = Math.hypot(vx, vy) || 1;
  return (Math.acos(clamp((vx * dir) / n, -1, 1)) * 180) / Math.PI >= O.backAngle;
}

/** 가장 가까운 상대 필드 선수 (GK 제외) */
function nearestOutfield(s: SimState, a: Agent, x: number, y: number): [Agent | null, number] {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
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
  return laneRiskAt(s, a.team, a.x, a.y, tx, ty);
}

/** (fx, fy) → (tx, ty) 패스 길 위험 (team 편이 차는 공) */
export function laneRiskAt(s: SimState, team: 0 | 1, fx: number, fy: number, tx: number, ty: number): LaneInfo {
  let risk = 0;
  const cutters: LaneInfo['cutters'] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team) continue;
    const [d, t] = segDist(o.x, o.y, fx, fy, tx, ty);
    if (d >= PR.laneWidth || t <= 0.05) continue;
    const prox = 1 - d / PR.laneWidth;
    const w = (PR.laneBase + (PR.laneIntercept * o.attrs.interception) / 100) * prox;
    risk += w;
    cutters.push({ idx: o.idx, w, t });
  }
  return { risk, cutters };
}

/** 패스 성공 확률 (E.8) */
export function passProbability(s: SimState, a: Agent, tx: number, ty: number, kind: 'pass' | 'cross', lane: LaneInfo, receiverPenalty = 0): number {
  const d = dist(a.x, a.y, tx, ty);
  // 시야: 패스 길을 정확히 찾을수록 가로채일 위험이 줄어든다 (시야 60 기준)
  lane = { ...lane, risk: lane.risk * Math.max(0.3, 1 + (PR.laneVision * (60 - a.attrs.vision)) / 100) };
  const wLong = clamp((d - PR.skillBlendFrom) / (PR.skillBlendTo - PR.skillBlendFrom), 0, 1);
  const skill = kind === 'cross' ? a.attrs.crossing : a.attrs.shortPassing * (1 - wLong) + a.attrs.longPassing * wLong;
  // 거리 감쇠: 숏패스 구간(25 m)까지 passPerM, 그 너머는 longPerM (롱패스 정확도)
  // 받는 선수 압박(마크)도 패스 난이도다: 좋은 패서는 마크 반대쪽으로 넣는다 (능력치가 줄이는 실패에 포함, E.20 5번)
  // 지친 선수는 패스도 흐트러진다 (C.76s 가설 2)
  const p = passDistBase(d) - lane.risk - PR.pressurePenalty * pressureAt(s, a) - receiverPenalty + formBonus(a) - PR.tiredPass * tiredRatio(a);
  // 원터치 (C.78b): 받는 순간 바로 차면 × 원터치 배수 (판단 중일 때만, 끄면 1)
  return passSkillApply(p, skill);
}

/** 거리만으로 정한 패스 성공 기본값 (C.31): 숏 구간 passPerM, 25 m 너머 longPerM, longFarFrom 너머 longFarPerM */
export function passDistBase(d: number): number {
  const long = Math.max(0, Math.min(d, PR.longFarFrom) - PR.shortPassMax);
  return PR.passBase - PR.passPerM * Math.min(d, PR.shortPassMax) - PR.longPerM * long - PR.longFarPerM * Math.max(0, d - PR.longFarFrom);
}

/** 패스 능력치 반영: 실패 확률을 능력치로 줄이거나 늘린다 (평균 선수 skillCenter 는 그대로) */
export function passSkillApply(p: number, skill: number): number {
  const fail = 1 - clamp(p, PR.passMin, PR.passMax);
  return clamp(1 - fail * Math.exp((-PR.passSkill * (skill - PR.skillCenter)) / 10), PR.passMin, PR.passCap);
}

/** 폼 보정 (E.16): 내 선수의 성공 확률에 ±3%p (폼 보정 ±0.3 × 0.1) */
export function formBonus(a: Agent): number {
  return a.spec.form * ENGINE.match.formToProb;
}

/**
 * 소유 상실 비용 C (E.18 A1): 상대가 그 위치(상대 기준 좌표)에서 공을 가졌을 때의 가치.
 * 자기 진영에서 잃으면 × (1 + lossOwnHalf × 하프라인에서 자기 골 쪽으로 들어간 비율) (C.16 결정 3: 상대는 정리되지 않은 수비를 상대로 바로 공격한다)
 */
export function lossCost(nx: number, ny: number): number {
  return -positionValue(1 - nx, 1 - ny) * (1 + O.lossOwnHalf * clamp((0.5 - nx) / 0.5, 0, 1));
}

/** 유지하는 동안 빼앗길 확률: 3 m 안 상대마다 holdLose × (1 − 거리/3) 를 독립으로 합성 (압박 수비수 수와 거리) */
export function loseProb(s: SimState, a: Agent, x = a.x, y = a.y): number {
  let keep = 1;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < PR.pressureDist) keep *= 1 - O.holdLose * (1 - d / PR.pressureDist);
  }
  return 1 - keep;
}

/**
 * 몰고 가기 동안 빼앗길 확률 (E.20, C.17 결정 3): 지금 위치에서 도착 지점까지 가는 길에서, 상대마다
 * 몰고 가는 동안 좁힐 수 있는 거리(carryClose × 최대 속도)를 뺀 실효 거리가 3 m 안이면 holdLose × (1 − 실효 거리/3) 를 독립 합성.
 * 공을 지키는 능력(드리블 0.5 + 볼 컨트롤 0.5)이 실패를 exp(−carrySkill × (능력치 − 70)/10) 배로 줄이거나 늘린다 (평균 선수는 그대로)
 */
export function carryLoseProb(s: SimState, a: Agent, cx: number, cy: number, who: Agent = a): number {
  let keep = 1;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team) continue;
    const d = carryReachDist(s, o, a, cx, cy);
    if (d < PR.pressureDist) keep *= 1 - O.holdLose * (1 - d / PR.pressureDist);
  }
  const skill = who.attrs.dribbling * 0.5 + who.attrs.ballControl * 0.5;
  return clamp((1 - keep) * Math.exp((-O.carrySkill * (skill - PR.skillCenter)) / 10), 0, 0.95);
}

/** 상대 o 가 몰고 가는 길(a → (cx, cy))에 닿는 실효 거리: 길까지 거리 − 몰고 가는 동안 좁히는 거리 (돌파당한 수비수는 좁히지 못한다) */
export function carryReachDist(s: SimState, o: Agent, a: Agent, cx: number, cy: number): number {
  const [d] = segDist(o.x, o.y, a.x, a.y, cx, cy);
  const close = s.t < o.beatenUntil ? 0 : O.carryClose * o.maxSpeed;
  return Math.max(0, d - close);
}

function weight(u: number, m: number): number {
  return u >= 0 ? u * m : u / m;
}

/** 버티기 성공 확률 (E.18 A2): L((근력 0.45 + 볼 컨트롤 0.35 + 민첩성 0.2 − (근력 0.45 + 태클 0.35 + 수비 포지셔닝 0.2)) / 12) */
export function holdupProb(s: SimState, att: Agent, def: Agent): number {
  const a = att.attrs;
  const d = def.attrs;
  const atk = (a.strength + att.body.strength) * 0.45 + a.ballControl * 0.35 + a.agility * 0.2;
  const dfn = (d.strength + def.body.strength) * 0.45 + d.tackling * 0.35 + d.defensivePositioning * 0.2;
  void s;
  return duelTail(1 / (1 + Math.exp(-((atk - dfn) / O.holdupScale + duelEdgeOf(att) - duelEdgeOf(def)))));
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
  /** 유효 슈팅이 골이 될 기대 확률 (구석 0.5, 리그 평균 GK 기준) */
  pGoal: number;
  xg: number;
  /** 판단용 xG = xg + 리바운드 기대값 (E.18 A1) */
  value: number;
  speed: number;
  blockers: number;
  /** 슛 순간 압박 0~1 (pressureAt, C.76k 구석 보정용) */
  pressure: number;
  /** 판단 xG 에 넣은 약발 배율 (C.77z timeModel 1, 아니면 1). pOn 에는 안 들어 있다 — 실행은 pOn × 실제 약발 */
  foot: number;
  /** 슛 1건 자료 (C.77z): 실행은 이것을 실제 값으로 바꿔 같은 saveChance 로 판정한다 */
  ctx: ShotCtx;
  /** 찰 쪽 (C.78h laneSide): ±1 = 두 슛 길이 달라 고른 쪽, 0 = 옛 규칙(GK 반대편, 가운데면 실행이 무작위) */
  side: -1 | 0 | 1;
}

function goalAngle(x: number, y: number, gx: number): number {
  const a1 = Math.atan2(W / 2 - G / 2 - y, Math.abs(gx - x));
  const a2 = Math.atan2(W / 2 + G / 2 - y, Math.abs(gx - x));
  return Math.abs(a2 - a1);
}

/** lead: 슛까지 남은 시간(초) — 동료에게 갈 패스의 가치를 볼 때 패스 비행 시간 (GK 가 그동안 자리를 옮긴다, C.77t) */
/** follow: 수비가 따라온다 (C.78h 각도 만들기) — 압박·3 m·밀집·1대1 조건은 지금 자리(a.x, a.y)에서, 슛 길 콘·각도·거리는 at 에서 */
export function shotModel(s: SimState, a: Agent, header = false, at?: { x: number; y: number }, lead = 0, follow = false): ShotModel {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const px = at?.x ?? a.x;
  const py = at?.y ?? a.y;
  const d = dist(px, py, gx, gy);
  const t = a.attrs;
  const pressure = follow ? pressureAt(s, a) : pressureAt(s, a, px, py);
  const K = ENGINE.keeper;
  // 기회의 질 (위치, 각도, 압박, 슈팅 종류): 리그 평균 마무리 선수 기준. 능력치는 마무리 배수 한 곳에서만 (E.20 7번)
  let blockers = 0;
  // 밀집 (C.78d ①): 슈터 denseR m 안 골 쪽 상대 필드 선수
  let dense = 0;
  // 1대1 조건용: 가장 가까운 상대 필드 선수 거리 (GK 는 뺀다 — 나온 GK 는 세이브 식이 맡고, 압박 항 pressure 는 그대로 GK 포함)
  let nearField = Infinity;
  // 3 m 안 상대 필드 선수 (C.77z 슛 1건 자료)
  let press3 = 0;
  // 슛 레인 (C.78h): 두 구석 쪽 슛 길(기대 구석 = 실행 구석 분포의 평균)마다 콘 안 수비
  const lane = PR.laneSide > 0 && !header;
  const corner = 0.5 * (1 - PR.cornerPressure * pressure);
  const cy = corner * (G / 2 - 0.3);
  let bN = 0;
  let bP = 0;
  let dN = 0;
  let dP = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const od = follow ? dist(o.x, o.y, a.x, a.y) : dist(o.x, o.y, px, py);
    if (od <= 3) press3++;
    if (header) continue;
    if (lane) {
      const [cn, tn] = segDist(o.x, o.y, px, py, gx, gy - cy);
      if (cn < PR.coneWidth && tn > 0.02 && tn < 0.95) bN++;
      const [cp, tp] = segDist(o.x, o.y, px, py, gx, gy + cy);
      if (cp < PR.coneWidth && tp > 0.02 && tp < 0.95) bP++;
      // 밀집 블록도 그 쪽 슛 길 denseLaneW m 안 수비만 (C.78h: 골 쪽이어도 길에서 먼 수비는 몸을 못 던진다)
      if (PR.denseLaneW > 0 && od <= PR.denseR) {
        if (cn < PR.denseLaneW && tn > 0) dN++;
        if (cp < PR.denseLaneW && tp > 0) dP++;
      }
    } else {
      const [cd, ct] = segDist(o.x, o.y, px, py, gx, gy);
      if (cd < PR.coneWidth && ct > 0.02 && ct < 0.95) blockers++;
    }
    if (od <= PR.denseR && dist(o.x, o.y, gx, gy) < d) dense++;
    if (PR.shotFree > 0 && od < nearField) nearField = od;
  }
  let pOn: number;
  let speed: number;
  if (header) {
    pOn = clamp(PR.headerBase - PR.headerPerM * d, PR.shotMin, PR.shotMax);
    speed = PR.headerSpeed;
  } else {
    pOn = clamp(PR.shotBase - PR.shotPerM * d - PR.shotPressure * pressure + formBonus(a), PR.shotMin, PR.shotMax);
    speed = B.shotSpeed;
  }
  const angle = Math.min(1, goalAngle(px, py, gx) / PR.shotAngleRef);
  // 밀집 (C.77z timeModel 1): 3 m 안 상대 필드 선수가 둘 이상이면 한 명마다 유효 슈팅 −shotCrowd (서둘러 찬다 — 가장 가까운 한 명은 압박 항이 맡는다)
  if (ENGINE.keeper.timeModel && press3 > 1) pOn = Math.max(PR.shotMin, pOn - ENGINE.keeper.shotCrowd * (press3 - 1));
  pOn *= angle;
  pOn *= finishMult(t, header ? 'header' : d >= PR.longShotFrom ? 'long' : 'shot');
  // 원터치 슛 (C.78b): 판단(미리 정하기)과 실행(다음 틱 shoot)이 같은 배수
  if (!header && !at) pOn *= otOf(s, a);
  // 1대1 보너스 (C.76a, 미해결 12): 헤더가 아니고 슛 길 콘 안 수비 0·pressureDist 안 상대 필드 선수 0 이면 "수비가 없다"는 정확도 가산 (20 m 안, 가까울수록 크게).
  // 마무리 배수 뒤에 더해 능력과 무관한 상황 보너스로 둔다 (배수 안에 넣으면 엘리트 ST 에 비례해 몰린다 — 미해결 11 축)
  if (!header && blockers === 0 && nearField >= PR.pressureDist) pOn += PR.shotFree * Math.max(0, 1 - d / PR.shotFreeRef) * angle;
  pOn = Math.min(PR.shotCap, pOn);
  const denseB = PR.blockDense * Math.max(0, dense - 1);
  // 구석 (C.76k): 쫓기며 쏘면 구석을 못 노린다 — 판단용 구석 0.5 도 실제와 같은 식 (E.15.1)
  // 슛 1건 자료 (C.77z): 실제 GK 위치·속도 · 리그 GK 선방 · GK 반대편 구석(가운데면 GK 쪽과 같은 거리라 아무 쪽) — 실행(actions shoot)과 같은 식 saveChance
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const far = farSide(gk, gy);
  const ctx: ShotCtx = {
    fx: px, fy: py, svx: a.vx, svy: a.vy, d, header, press3, pressure,
    tx: gx, ty: gy + (far ?? 1) * cy, corner, speed,
    gk: gk ? { x: gk.x, y: gk.y, vx: gk.vx, vy: gk.vy } : null, stop: K.leagueShotStopping, body: 0, lead,
  };
  // 빈 골 (C.77z): 가운데로 차도 GK 가 못 닿으면 구석을 노릴 필요가 없다 — 유효 슈팅 확률이 openOn 쪽으로
  // C.78n: 빈 골 보정은 거리로 줄어든다 (먼 거리 가운데 슛은 빈 골이어도 빗나간다, openSpan 0 = 꺼짐)
  const openD = K.openSpan > 0 ? Math.min(1, Math.max(K.openFloor, 1 - (d - K.openFrom) / K.openSpan)) : 1;
  if (K.timeModel && gk) pOn += Math.max(0, K.openOn * openD * angle - pOn) * (1 - coverOf({ ...ctx, ty: gy, corner: 0 }));
  const cornerMul = 1 - PR.cornerPressure * pressure;
  const saveOf = (sd: number) => (K.timeModel ? expectedSave({ ...ctx, ty: gy + sd * cy }, gy, sd, cornerMul) : saveChance({ ...ctx, ty: gy + sd * cy }));
  let pBlock: number;
  let foot: number;
  let pGoal: number;
  /** 찰 쪽 (C.78h laneSide): ±1, 0 = 옛 규칙(GK 반대편, 가운데면 실행이 무작위) */
  let side: -1 | 0 | 1 = 0;
  if (lane) {
    // 두 쪽 슛 길의 블록·약발 (C.78h): 다르면 기대 골이 큰 쪽, 같으면 옛 규칙
    const dnB = PR.denseLaneW > 0 ? PR.blockDense * Math.max(0, dN - 1) : denseB;
    const dpB = PR.denseLaneW > 0 ? PR.blockDense * Math.max(0, dP - 1) : denseB;
    const pbN = Math.min(PR.blockMax, bN * PR.blockPer + dnB);
    const pbP = Math.min(PR.blockMax, bP * PR.blockPer + dpB);
    const fN = K.timeModel ? weakFootMul(a.body, dir, gx - px, gy - cy - py) : 1;
    const fP = K.timeModel ? weakFootMul(a.body, dir, gx - px, gy + cy - py) : 1;
    if (pbN === pbP && fN === fP) {
      pBlock = pbN;
      foot = fN;
      blockers = bN;
      pGoal = 1 - saveOf(far ?? 1);
    } else {
      const gN = 1 - saveOf(-1);
      const gP = 1 - saveOf(1);
      if ((1 - pbP) * fP * gP >= (1 - pbN) * fN * gN) {
        side = 1; pBlock = pbP; foot = fP; pGoal = gP; blockers = bP;
      } else {
        side = -1; pBlock = pbN; foot = fN; pGoal = gN; blockers = bN;
      }
      ctx.ty = gy + side * cy;
    }
  } else {
    pBlock = Math.min(PR.blockMax, blockers * PR.blockPer + denseB);
    // 약발 (C.45): 판단도 실행과 같은 배율 (C.77z, timeModel 1 일 때만 — 0 이면 판단은 약발을 모른다, 옛 동작)
    foot = K.timeModel && !header ? weakFootMul(a.body, dir, gx - px, gy - py) : 1;
    // 판단 = 실행의 기대값 (C.77z timeModel 1): 구석 분포 평균. 0 이면 기대 구석 한 점 (옛 동작)
    pGoal = 1 - (K.timeModel ? expectedSave(ctx, gy, far ?? 1, cornerMul) : saveChance(ctx));
  }
  const xg = (1 - pBlock) * pOn * foot * pGoal;
  // 리바운드: 선방 → 쳐내기 → 코너가 아니면 공격 팀이 reboundOwn 확률로 골 앞(8 m)에서 다시 잡는다
  const parry = 1 - clamp(K.catchBase + (K.catchSkill * K.leagueHandling) / 100, 0, 1);
  const rebound = (1 - pBlock) * pOn * foot * (1 - pGoal) * parry * (1 - K.parryCorner) * K.reboundOwn * positionValue(1 - 8 / L, 0.5);
  return { d, pOn, pBlock, pGoal, xg, value: xg + rebound, speed, blockers, pressure, foot, ctx, side };
}

/**
 * 실행 쪽 기대값 (C.77z, 장면·테스트용): 판단 자료(shotModel.ctx)에 실제 상대 GK(위치·속도·선방·키)와 실제 약발을 넣은 같은 식(saveChance).
 * 구석·공 속도는 기대값 — 실제 shoot() 은 그것을 뽑는다. 상대 GK 가 리그 GK(선방 leagueShotStopping·키 0)이고 timeModel 1 이면 goal = shotModel().xg
 */
export function shotExec(s: SimState, a: Agent, header = false): { goal: number; pSave: number; cover: number; m: ShotModel } {
  const m = shotModel(s, a, header);
  const ctx = { ...m.ctx, ...gkCtx(keeperOf(s, (1 - a.team) as 0 | 1)) };
  const [gx, gy] = oppGoal(attackDir(a.team, s.half));
  const lane = PR.laneSide > 0 && !header;
  const sd = m.side || (farSide(keeperOf(s, (1 - a.team) as 0 | 1), gy) ?? 1);
  const foot = header ? 1 : lane ? weakFootMul(a.body, attackDir(a.team, s.half), gx - a.x, gy + sd * m.ctx.corner * (G / 2 - 0.3) - a.y) : weakFootMul(a.body, attackDir(a.team, s.half), gx - a.x, gy - a.y);
  const pSave = ENGINE.keeper.timeModel ? expectedSave(ctx, gy, sd, 1 - PR.cornerPressure * m.pressure) : saveChance(ctx);
  return { goal: (1 - m.pBlock) * m.pOn * foot * (1 - pSave), pSave, cover: coverOf(ctx), m };
}

/** 땅볼 패스 d m 가 닿아 받을 때까지 (초, C.77t 판단용 GK 이동 시간) — 패스 속도는 makePass 와 같은 식 */
function passLead(s: SimState, d: number): number {
  return d / (clamp(B.passSpeedBase + B.passSpeedPerM * d, B.passSpeedMin, B.passSpeedMax) * s.env.passSpeed) + ENGINE.keeper.receiveLead;
}

// 마무리 능력치 finishSkill 은 duel.ts (C.76a: offball 위협 가중 수비와 공유)
export { finishSkill };

/** 마무리 배수 = clamp(1 + finishPerPoint × (마무리 능력치 − 70), finishMin, finishMax). 유효 슈팅(= 골 확률)에 곱한다 */
export function finishMult(t: FieldAttributes, kind: 'shot' | 'long' | 'header' | 'freeKick'): number {
  return clamp(1 + PR.finishPerPoint * (finishSkill(t, kind) - PR.skillCenter), PR.finishMin, PR.finishMax);
}

/** 같은 팀 동료 중 상대 박스 안 */
function boxTeammates(s: SimState, a: Agent, dir: 1 | -1): Agent[] {
  return s.agents.filter((o) => o.onPitch && o.team === a.team && o !== a && o.line !== 0 && inOppBox(o.x, o.y, dir));
}

/**
 * 크로스 대상: 박스 안 동료 중 공중볼 승산 × 헤더 기대 가치가 가장 큰 선수.
 * 세트피스(roll 을 주면)는 키커가 한 선수만 노리지 않는다: 승산 × 가치에 비례한 확률로 고른다 (E.22 B, 한 선수가 코너 골을 독차지하지 않게)
 */
export function crossTarget(s: SimState, a: Agent, roll?: number): { r: Agent; pWin: number; value: number } | null {
  const dir = attackDir(a.team, s.half);
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  let best: { r: Agent; pWin: number; value: number } | null = null;
  const all: { r: Agent; pWin: number; value: number }[] = [];
  for (const r of boxTeammates(s, a, dir)) {
    const [def, dd] = nearestOpponent(s, r);
    let pWin = def && dd < PR.aerialRadius + 1 ? aerialWin(r, def) : 0.85;
    if (gk && dist(gk.x, gk.y, r.x, r.y) < ENGINE.keeper.claimRange) pWin *= 1 - claimProb(gk);
    const value = shotModel(s, r, true).value * r.role.pref.header;
    all.push({ r, pWin, value });
    if (!best || pWin * value > best.pWin * best.value) best = { r, pWin, value };
  }
  if (roll === undefined || all.length < 2) return best;
  const tot = all.reduce((t, c) => t + c.pWin * c.value, 0);
  let x = roll * tot;
  for (const c of all) {
    x -= c.pWin * c.value;
    if (x <= 0) return c;
  }
  return all[all.length - 1]!;
}

/** 타깃 ST: 헤더 + 근력이 가장 높은 공격수 (직선 성향, E.19) */
function targetForward(s: SimState, a: Agent): Agent | null {
  let best: Agent | null = null;
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== a.team || o.line !== 3) continue;
    if (!best || o.attrs.heading + o.attrs.strength > best.attrs.heading + best.attrs.strength) best = o;
  }
  return best;
}

/** 리그 평균 선수 능력치 (판단용 P 혼합, E.20 1번) */
const AVG_ATTRS = Object.fromEntries(FIELD_ATTRIBUTES.map((k) => [k, O.judgeAvgAttr])) as unknown as FieldAttributes;

/**
 * 같은 자리·같은 상황의 리그 평균 선수 (위치, 팀, 홈 보정은 그대로, 능력치만 평균, 폼 0).
 * 선수마다 복사본 하나를 두고 결정 때 위치만 맞춘다 (Object.create 를 쓰면 V8 이 선수 객체를 프로토타입으로 바꿔 느려진다)
 */
const shadows = new WeakMap<Agent, Agent>();
export function averageSelf(a: Agent): Agent {
  let av = shadows.get(a);
  if (!av) {
    av = { ...a, attrs: AVG_ATTRS, spec: { ...a.spec, form: 0 } };
    shadows.set(a, av);
  }
  av.x = a.x;
  av.y = a.y;
  av.vx = a.vx;
  av.vy = a.vy;
  av.team = a.team;
  av.duelEdge = a.duelEdge;
  av.stamina = a.stamina;
  av.burst = a.burst;
  av.burstOut = a.burstOut;
  av.onPitch = a.onPitch;
  return av;
}

/**
 * 착지점 몫 (C.78c ②): (x, y)에 tLand 초 뒤 떨어지는 공에 team 이 먼저 닿을 몫. 양 팀 필드 선수(GK·except 제외) 가장 빠른 도착 시간(착지 전 도착은 tLand)의 차를
 * landScale 로 로지스틱. 둘 다 착지 전에 와 있으면 0.5 (공중볼 경합). 판단 전용 — 실행은 실제 이동·경합이 정한다
 */
export function landingShare(s: SimState, team: 0 | 1, x: number, y: number, tLand: number, except?: Agent): number {
  const AM = ENGINE.physics.arrivalModel > 0;
  let tOwn = Infinity;
  let tOpp = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.line === 0 || o === except) continue;
    const best = o.team === team ? tOwn : tOpp;
    // 도착 시간은 직선 거리 / max(최대 속력, 지금 속력)보다 짧을 수 없다 — 그 하한이 이미 지금 최솟값보다 크면 계산하지 않는다 (결과 같음)
    if (AM && Number.isFinite(best) && Math.max(tLand, (dist(o.x, o.y, x, y) - PR.aerialRadius) / Math.max(o.maxSpeed, Math.hypot(o.vx, o.vy))) > best + 1e-6) continue;
    const t = Math.max(tLand, AM ? arrivalTime(o, x, y, PR.aerialRadius) : Math.max(0, dist(o.x, o.y, x, y) - PR.aerialRadius) / o.maxSpeed);
    if (o.team === team) { if (t < tOwn) tOwn = t; } else if (t < tOpp) tOpp = t;
  }
  if (!Number.isFinite(tOwn)) return 0;
  if (!Number.isFinite(tOpp)) return 1;
  return 1 / (1 + Math.exp(-(tOpp - tOwn) / O.landScale));
}

/** 판단용 성공 확률: 본인과 리그 평균 선수의 혼합 (E.20 1번) */
export function judgedP(self: number, avg: number): number {
  return O.judgeSelf * self + (1 - O.judgeSelf) * avg;
}

/** 후보 행동 생성. Candidate.p 는 실제 판정용(본인), 효용 u 는 판단용 P(본인·리그 평균 혼합)로 계산한다 */
/** 원터치 후보 (C.78b preDecide): 같은 계산에서 패스·침투·컷백·레이오프·슛의 원터치 판(성공 확률 × 원터치 배수)을 ot.out 에 따로 담는다 */
export interface OtReq { speed: number; pr: number; out: Candidate[] }

export function candidates(s: SimState, a: Agent, ot?: OtReq): Candidate[] {
  const dir = attackDir(a.team, s.half);
  const [ax, ay] = toNorm(a.x, a.y, dir);
  const here = positionValue(ax, ay);
  const pressure = pressureAt(s, a);
  const av = averageSelf(a);
  // 전환 위험 (E.20 2번): 상실 지점보다 상대 골 쪽에 있는 우리 필드 선수가 많을수록 역습 손해가 크다
  const mates: Agent[] = [];
  const mateNx: number[] = [];
  for (const o of s.agents) {
    if (!o.onPitch || o.team !== a.team || o.line === 0) continue;
    mates.push(o);
    mateNx.push(toNorm(o.x, o.y, dir)[0]);
  }
  const loss = (nx: number, ny: number): number => {
    let ahead = 0;
    for (const x of mateNx) if (x > nx + 1e-6) ahead++;
    return lossCost(nx, ny) - O.transitionRisk * (ahead / 10);
  };
  // 패스 수신 지원도: 받는 선수 15 m 안 동료 수 (패스한 선수 포함)
  const support = (r: Agent, tx: number, ty: number): number => {
    let n = 0;
    for (const o of mates) if (o !== r && dist(o.x, o.y, tx, ty) <= O.supportDist) n++;
    return O.supportBase + (1 - O.supportBase) * Math.min(1, n / O.supportNeed);
  };
  const lossHere = loss(ax, ay);
  // 뒤 공간 (C.78g): 상대 필드 선수의 정규화 x (받는 곳보다 골 쪽 인원)
  const SP = ENGINE.transition;
  const oppNx: number[] = [];
  if (SP.space > 0 || SP.counterBonus > 0) for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) oppNx.push(toNorm(o.x, o.y, dir)[0]);
  // 역습 상황 보너스 (C.78g, 사용자 "역습 상황에 보상 점수를 좀 더"): 오픈 플레이 탈취 뒤 counterTime 초 동안, 공보다 앞(우리 쪽)에 남은 상대 몫 × 상대 라인 뒤 열린 공간 몫.
  // 전진 후보의 효용에 counterBonus × 이 값 × 전진(정규화) × 판단 성공 확률을 더한다(상한 counterCap) — 성공 확률·실행은 그대로, 고를 이유만
  let counterK = 0;
  if (SP.counterBonus > 0 && s.possTeam === a.team && s.possOrigin === 'open' && s.t - s.teams[a.team].wonAt <= SP.counterTime && oppNx.length) {
    let up = 0;
    for (const x of oppNx) if (x < ax) up++;
    counterK = (up / oppNx.length) * clamp(1 - offsideLine(s, a.team), 0, 1);
  }
  const cBonus = (pj: number, fwd: number) => (counterK > 0 && fwd > 0 ? Math.min(SP.counterCap, SP.counterBonus * counterK * fwd * pj) : 0);
  const safeMul = manDiff(s, a.team) < 0 ? ENGINE.referee.shortSafe : 1;
  const isGk = a.line === 0;
  const out: Candidate[] = [];
  const [gx0, gy0] = oppGoal(dir);
  const tac = s.teams[a.team].tactics;
  const style = tac.style;
  const mPoss = TA.possBase + TA.possSlope * style;
  const mDirect = TA.directBase - TA.possSlope * style;
  // 성향 고유 행동 (E.19): 공을 뺏은 뒤 게겐프레싱 4초 전진 패스·슛, 역습 6초 전진·침투 패스 효용 배수 (C.78d ②: 블록도 역습과 같은 첫 패스 전진 출구)
  const sinceWin = s.possTeam === a.team ? s.t - s.teams[a.team].wonAt : Infinity;
  const winMul = tac.tendency === 'gegenpress' && sinceWin <= TENDENCY.gegenWinTime ? TENDENCY.gegenWinMul
    : ENGINE.offball.supportRun > 0 && tac.tendency === 'block' && sinceWin <= TENDENCY.counterWinTime ? TENDENCY.counterWinMul : 1;
  const target = tac.tendency === 'direct' ? targetForward(s, a) : null;
  // 컷백 자리 (E.18 A2): 상대 골라인 근처 측면
  const cutZone = !isGk && ax >= O.cutbackFromX && Math.abs(ay - 0.5) >= O.cutbackWide;
  const line = offsideLine(s, a.team);
  const oppGk = keeperOf(s, (1 - a.team) as 0 | 1);
  // 경기 상황 (E.20 10번, C.29 fix2): 크게 앞선 팀은 전진 패스·슛·드리블을 덜 하고 안전 패스·유지로 기운다 (팀 공용 행동)
  const risk = leadRiskMul(s, a.team);
  const safeRisk = 1 / risk;

  // 패스 / 침투 패스
  for (const r of s.agents) {
    if (r === a || !r.onPitch || r.team !== a.team) continue;
    const d0 = dist(a.x, a.y, r.x, r.y);
    if (d0 > O.passMaxDist || d0 < 3) continue;
    const running = s.t < r.runUntil;
    let tx = clamp(r.x + r.vx * O.leadTime, 1, L - 1);
    let ty = clamp(r.y + r.vy * O.leadTime, 1, W - 1);
    if (running && ((r.giveGo && ENGINE.offball.giveGoChance > 0) || r.overlap)) {
      // 2:1 리턴 패스 (C.77y): 주고 달리는 선수가 노리는 마커 뒤 공간(달리기 목표)으로. 오버래핑 풀백 (C.78i ②)도 달리는 앞 측면 길(달리기 목표)로
      tx = clamp(r.tx, 1, L - 1);
      ty = clamp(r.ty, 1, W - 1);
    } else if (running) {
      // 침투 패스: 오프사이드 라인 뒤 공간으로 (E.20 4번)
      const room = (1 - line) * L;
      const depth = clamp(O.throughShare * (room - O.throughStop), O.throughMin, O.throughMax);
      const [, rny] = toNorm(r.x, r.y, dir);
      [tx, ty] = toPitch(clamp(Math.max(toNorm(r.x, r.y, dir)[0], line) + depth / L, 0, 0.97), rny, dir);
    }
    const lane = laneRisk(s, a, tx, ty);
    const rp = Math.max(0, 1 - nearestOpponent(s, r, tx, ty)[1] / PR.receiverPressureDist);
    // 받는 쪽 조건(수신 압박, 달리기 경쟁)은 본인·평균 선수 모두 같다
    let race = 0;
    let gkWins = -1;
    if (running) {
      // 침투 패스: 받는 선수와 가장 가까운 수비수의 달리기 경쟁 (도착 시간 차, 초). 빠른 선수가 뒷공간을 더 잘 받는다
      const [def] = nearestOutfield(s, r, tx, ty);
      // 도착 시간 (C.77x): 이동과 같은 운동 규칙(arrivalTime). 뒤돌기를 운동 규칙이 셈하면(turnModel) raceTurn 은 더하지 않는다
      const AM = ENGINE.physics.arrivalModel > 0;
      let tDef = def ? (AM ? arrivalTime(def, tx, ty) : dist(def.x, def.y, tx, ty) / def.maxSpeed) + (AM && ENGINE.physics.turnModel > 0 ? 0 : PR.raceTurn) : Infinity;
      // 목표점이 상대 GK 처리 구역 안이면 GK 도 달리기 경쟁에 들어간다 (C.28). GK 가 더 빠르면 실패한 패스는 GK 가 끊는다
      if (oppGk && keeperZone(s, oppGk, tx, ty)) {
        const tGk = (AM ? arrivalTime(oppGk, tx, ty) : dist(oppGk.x, oppGk.y, tx, ty) / oppGk.maxSpeed) + ENGINE.keeper.throughDelay;
        if (tGk < tDef) {
          tDef = tGk;
          gkWins = oppGk.idx;
        }
      }
      if (Number.isFinite(tDef)) race = PR.raceGain * clamp(tDef - (AM ? arrivalTime(r, tx, ty) : dist(r.x, r.y, tx, ty) / r.maxSpeed), -PR.raceCap, PR.raceCap);
    }
    // 롱패스(공중볼)는 착지점에서 가까운 수비수와 공중볼 경합을 한다 (판정과 같은 P, actions resolveFlight)
    let aerial = 1;
    if (d0 > PR.airPass) {
      const [def, dd] = nearestOutfield(s, r, tx, ty);
      if (def && dd < PR.longContest) aerial = aerialWin(r, def);
    } else if (inOppBox(tx, ty, dir)) {
      // 박스 안 땅볼 패스는 착지점 contestDist 안 수비수와 수신 경합 (C.29 fix2 가설 B, 판정은 actions resolveFlight 가 같은 P 로)
      const [def, dd] = nearestOutfield(s, r, tx, ty);
      if (def && dd < PR.contestDist) aerial = receiveWin(r, def);
    }
    const ppA = passProbability(s, a, tx, ty, 'pass', lane, PR.receiverPressure * rp);
    const ppAv = passProbability(s, av, tx, ty, 'pass', lane, PR.receiverPressure * rp);
    const flightP = (pp: number) => clamp(pp + race, PR.passMin, PR.passCap);
    const pFlight = flightP(ppA);
    const p = pFlight * aerial;
    const pj = judgedP(p, flightP(ppAv) * aerial);
    const [rx, ry] = toNorm(tx, ty, dir);
    // 받는 자리의 가치 × 지원도 (E.20 2번). 받는 순간 압박이 있으면 그만큼 다음 결정 전에 빼앗길 수 있다 (유지 효용과 같은 식)
    const pLoseR = O.holdLose * rp;
    const supR = support(r, tx, ty);
    let value = positionValue(rx, ry) * supR;
    // 뒤 공간 가치 (C.78g): 크게 앞으로 가는 패스를 받는 곳보다 골 쪽 상대가 적으면, 받은 뒤 빈 곳으로 몰고 갈 자리의 가치 (성공 확률은 그대로)
    if (SP.space > 0 && rx - ax >= SP.spaceFwd && rx < SP.spaceStop) {
      let behind = 0;
      for (const x of oppNx) if (x > rx) behind++;
      if (behind < SP.spaceBack) value = Math.max(value, positionValue(Math.min(SP.spaceStop, rx + (SP.spaceRun * (1 - behind / SP.spaceBack)) / L), ry) * supR);
    }
    // 받는 자리에서 슛을 노릴 수 있으면 그 기대값도 가치로 본다 (같은 골 단위, 슛은 지원과 무관). 골을 등지고 받는 패스는 바로 슛할 수 없다 (E.18 A2)
    if (dist(tx, ty, gx0, gy0) <= PR.shotMaxDist && rx > 0.6 && !receivesBack(a.x, a.y, tx, ty, dir)) {
      // 받는 선수의 슈팅 가치도 판단용이므로 본인·리그 평균 혼합 (E.20 1번과 같은 원칙)
      const at = { x: tx, y: ty };
      const lead = passLead(s, dist(a.x, a.y, tx, ty));
      value = Math.max(value, judgedP(shotModel(s, r, false, at, lead).value, shotModel(s, averageSelf(r), false, at, lead).value));
    }
    const lossR = loss(rx, ry);
    value = value * (1 - pLoseR) + pLoseR * lossR;
    // 받을 선수가 오프사이드 위치로 보이면 그 확률만큼 상대 프리킥 (E.7, E.10)
    const pOff = offsideRisk(s, a, r);
    const uOf = (pj: number) => {
      const u = pj * value + (1 - pj) * lossR;
      return pOff > 0 ? (1 - pOff) * u + pOff * lossR : u;
    };
    // 롱패스 실패분의 세컨드볼 (C.78c ②): 비행 실패(빗나감·루즈볼)는 착지점 근처에 떨어진다 — 먼저 닿는 팀 몫만큼 그 자리 가치 (실행과 같은 규칙). 원터치 판도 같은 항
    const landGain = O.landShare > 0 && d0 > PR.airPass ? landingShare(s, a.team, tx, ty, d0 / B.airSpeed, a) * O.landKeep * (positionValue(rx, ry) - lossR) : 0;
    let u = uOf(pj) + (1 - judgedP(pFlight, flightP(ppAv))) * landGain;
    const forward = rx > ax + 0.03;
    // 팀 빌드업 성향 (E.18 A5): 롱볼·최전방 직행은 직선형, 나머지 짧은 패스·백패스는 점유형일수록
    const direct = d0 >= TA.longBall || ((r.pos === 'ST' || r.pos === 'CF') && a.line <= 2 && (rx - ax) * L >= TA.directForward);
    // 직선(롱볼): 타깃 ST 에게 가는 롱볼
    const tMul = target === r && d0 >= TA.longBall ? TENDENCY.directTargetMul : 1;
    const wMul = forward ? winMul : 1;
    // 역할 (E.6, E3.7): 롱패스 선호, 받는 선수의 공 요구(③)
    const roleMul = (d0 >= TA.longBall ? a.role.pref.long : 1) * (hasModule(r.role, 'demand') ? ENGINE.roles.demandPass : 1);
    const passW = a.role.pref.pass * (forward ? a.role.pref.forward : a.role.pref.safe * safeMul) * (direct ? mDirect : mPoss) * tMul * wMul * roleMul * (forward ? risk : safeRisk);
    // 직선 전환 롱볼 (C.79d): 직선 성향 · 오픈 플레이 탈취 뒤 counterWinTime 초 안 · 공중(airPass 초과) 전진 패스에만 판단 보정 (실행 불변)
    const dLongB = ENGINE.decide.bias.directLong > 0 && tac.tendency === 'direct' && d0 > PR.airPass && forward
      && sinceWin <= TENDENCY.counterWinTime && s.possOrigin === 'open' ? ENGINE.decide.bias.directLong : 0;
    u = weight(u, passW) + cBonus(pj, rx - ax) + dLongB * pj;
    // 컷백: 골에서 9~18 m, 골대 양 끝이 보이는 각도 안의 동료에게 뒤로 내주는 패스 (판정은 숏패스 식 그대로)
    const gd = dist(tx, ty, gx0, gy0);
    const cutback = cutZone && !running && gd >= O.cutbackMin && gd <= O.cutbackMax && goalAngle(tx, ty, gx0) >= PR.shotAngleRef;
    const type = cutback ? 'cutback' : running ? 'through' : 'pass';
    out.push({ type, p, u, x: tx, y: ty, receiver: r.idx, value, pFlight, ...(gkWins >= 0 ? { keeper: gkWins } : {}) });
    if (ot) {
      // 원터치 판: 같은 길·경쟁·가치, 패스 판정만 × 원터치 배수 (본인·평균 선수 각자)
      const pF = flightP(ppA * oneTouchMul(a, ot.speed, ot.pr));
      const pO = pF * aerial;
      const pjO = judgedP(pO, flightP(ppAv * oneTouchMul(av, ot.speed, ot.pr)) * aerial);
      const uO = uOf(pjO) + (landGain ? (1 - judgedP(pF, flightP(ppAv * oneTouchMul(av, ot.speed, ot.pr)))) * landGain : 0);
      ot.out.push({ type, p: pO, u: weight(uO, passW) + cBonus(pjO, rx - ax), x: tx, y: ty, receiver: r.idx, value, pFlight: pF, ...(gkWins >= 0 ? { keeper: gkWins } : {}), ot: true });
    }
  }

  if (O.backModel > 0) {
    backValue(s, a, out, dir);
    if (ot) backValue(s, a, ot.out, dir, out);
  }

  // 포스트플레이 (E.18 A2): 등지고 받은 ST/CF 의 버티기와 레이오프
  if (a.backToGoal && (a.pos === 'ST' || a.pos === 'CF')) {
    for (const r of s.agents) {
      if (r === a || !r.onPitch || r.team !== a.team || r.line < 2) continue;
      const d = dist(a.x, a.y, r.x, r.y);
      if (d > O.layoffDist || d < 2) continue;
      const [rx, ry] = toNorm(r.x, r.y, dir);
      if (rx >= ax) continue; // 앞을 보고 받을 2선 (공보다 자기 골 쪽)
      const layP = (who: Agent) => passSkillApply(PR.passBase - PR.passPerM * d + formBonus(who), who.attrs.shortPassing);
      const lA = layP(a);
      const lAv = layP(av);
      const p = lA;
      const pj = judgedP(p, lAv);
      let value = positionValue(rx, ry) * support(r, r.x, r.y);
      if (dist(r.x, r.y, gx0, gy0) <= PR.shotMaxDist) value = Math.max(value, judgedP(shotModel(s, r, false, undefined, passLead(s, d)).value, shotModel(s, averageSelf(r), false, undefined, passLead(s, d)).value));
      const lossL = loss(rx, ry);
      const u = weight(pj * value + (1 - pj) * lossL, a.role.pref.pass);
      out.push({ type: 'layoff', p, u, x: r.x, y: r.y, receiver: r.idx, value });
      if (ot) {
        const pO = lA * oneTouchMul(a, ot.speed, ot.pr);
        const pjO = judgedP(pO, lAv * oneTouchMul(av, ot.speed, ot.pr));
        ot.out.push({ type: 'layoff', p: pO, u: weight(pjO * value + (1 - pjO) * lossL, a.role.pref.pass), x: r.x, y: r.y, receiver: r.idx, value, ot: true });
      }
    }
    const [def, dd] = nearestOpponent(s, a);
    if (def && dd <= O.holdupRange) {
      const p = holdupProb(s, a, def);
      const pj = judgedP(p, holdupProb(s, av, def));
      out.push({ type: 'holdup', p, u: weight(pj * here + (1 - pj) * lossHere, a.role.pref.pass * a.role.pref.hold), x: a.x, y: a.y, receiver: -1, value: here, opponent: def.idx });
    }
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
      // 도착 지점의 가치: 그 자리에서 다음 결정 전에 빼앗길 확률만큼 상실 비용 (받는 자리 가치, 유지 효용과 같은 식, E.20)
      const qEnd = loseProb(s, a, cx, cy);
      let pv = positionValue(nx, ny);
      // 뒤 공간 가치 (C.78g): 몰고 간 자리보다 골 쪽 상대가 적으면 그 앞 빈 곳까지 계속 몰고 갈 자리의 가치 (패스와 같은 식, spaceCarry 0 = 끔)
      if (SP.space > 0 && SP.spaceCarry > 0 && dir * ux > 0.5 && nx < SP.spaceStop) {
        let behind = 0;
        for (const x of oppNx) if (x > nx) behind++;
        if (behind < SP.spaceBack) pv = Math.max(pv, positionValue(Math.min(SP.spaceStop, nx + (SP.spaceCarry * SP.spaceRun * (1 - behind / SP.spaceBack)) / L), ny));
      }
      const value = pv * (1 - qEnd) + qEnd * loss(nx, ny);
      if (def) {
        // 수비 자세 (E.23): 수비수는 바깥쪽으로 몬다. 중앙 쪽으로 꺾는 돌파는 어렵고 바깥쪽은 조금 쉽다
        const D = ENGINE.defense;
        const stance = ang === 0 ? 0 : Math.abs(cy - W / 2) < Math.abs(a.y - W / 2) ? -D.stanceInside : D.stanceOutside;
        const dp = (who: Agent) => clamp(dribbleProb(who, def!, (second ? -PR.spaceSecondPenalty : 0) + stance) + formBonus(who), 0.02, 0.98);
        const p = dp(a);
        const pj = judgedP(p, dp(av));
        const u = weight(pj * value + (1 - pj) * lossHere, a.role.pref.dribble * risk) + cBonus(pj, nx - ax);
        out.push({ type: 'dribble', p, u, x: cx, y: cy, receiver: -1, value, opponent: def.idx });
      } else {
        // 몰고 가기: 가는 길로 좁혀 오는 수비수들의 압박으로 빼앗길 확률. 공을 지키는 능력치가 줄인다 (C.17 결정 3)
        const cp = (who: Agent) => clamp(0.98 * (1 - carryLoseProb(s, a, cx, cy, who)), 0.05, 0.98);
        const p = cp(a);
        const pj = judgedP(p, cp(av));
        const u = weight(pj * value + (1 - pj) * lossHere, a.role.pref.dribble * a.role.pref.carry * risk) + cBonus(pj, nx - ax);
        out.push({ type: 'carry', p, u, x: cx, y: cy, receiver: -1, value });
      }
    }

    // 슛 (골을 등지고 받았으면 먼저 돌아서야 한다)
    const [gx, gy] = oppGoal(dir);
    if (dist(a.x, a.y, gx, gy) <= PR.shotMaxDist && ax > 0.6 && !a.backToGoal) {
      const m = shotModel(s, a);
      const vj = judgedP(m.value, shotModel(s, av).value);
      // 티키타카: xG 0.05 미만 슛 × 0.7 (확실한 기회까지 돌린다), 게겐프레싱 탈취 직후
      const tikiMul = tac.tendency === 'tikitaka' && m.xg < TENDENCY.tikiLowXg ? TENDENCY.tikiLowShot : 1;
      const gegenMul = tac.tendency === 'gegenpress' ? winMul : 1;
      // 슛이 골이 아니면(빗나감·선방·블록) 공은 대개 상대 골 앞에서 상대에게 간다: 다른 후보와 같은 식 U = P × V + (1 − P) × C (E.22 C)
      const shotLoss = O.shotLoss ? loss(0.97, 0.5) : 0;
      const longShot = dist(a.x, a.y, gx, gy) > ENGINE.roles.longShotDist ? a.role.pref.longShot : 1;
      // 판단 보정 (C.78p): 열린 찬스 슛 선호 — 효용에만, 실행·xG 는 그대로
      const sBias = shootBias(m, goalAngle(a.x, a.y, gx));
      const u = weight(vj * O.shotScale + (1 - vj) * shotLoss, a.role.pref.shoot * longShot * tikiMul * gegenMul * risk) + sBias;
      out.push({ type: 'shoot', p: m.xg, u, x: gx, y: gy, receiver: -1, value: m.value });
      // 각도 만들기 (C.78h): 슛 길이 막혔으면(블록 > 0) 옆으로 laneCarry m 치는 몰기 — 그 자리 슛 가치(수비는 따라온다 — 압박·밀집은 지금 자리, 슛 길 콘·각도는 도착점, GK 는 laneCarryTime 초 동안 자리를 옮김)가 지금 슛보다 클 때만, 도착점 가치 = 그 슛 가치
      if (O.laneCarry > 0 && m.pBlock > 0) {
        for (const sd of [-1, 1]) {
          const cx = clamp(a.x + dir * O.laneCarryFwd, 1, L - 1);
          const cy = clamp(a.y + sd * O.laneCarry, 1, W - 1);
          const [nx, ny] = toNorm(cx, cy, dir);
          const qEnd = loseProb(s, a, cx, cy);
          const mT = shotModel(s, a, false, { x: cx, y: cy }, O.laneCarryTime, true);
          const sv = mT.value;
          // 판단 보정 (C.78p): 친 뒤 쏠 슛의 선호도 같이 본다 (도착점 슛 보정 대 지금 슛 보정) — 효용에만
          const bT = shootBias(mT, goalAngle(cx, cy, gx));
          if (sv + bT <= m.value + sBias) continue;
          const value = sv * (1 - qEnd) + qEnd * loss(nx, ny);
          const valueU = value + bT * (1 - qEnd);
          const cp = (who: Agent) => clamp(0.98 * (1 - carryLoseProb(s, a, cx, cy, who)), 0.05, 0.98);
          const p = cp(a);
          const pj = judgedP(p, cp(av));
          out.push({ type: 'carry', p, u: weight(pj * valueU + (1 - pj) * lossHere, a.role.pref.dribble * a.role.pref.carry * risk), x: cx, y: cy, receiver: -1, value });
        }
      }
      if (ot) {
        // 원터치 슛: 같은 shotModel 에 원터치 배수 (본인·평균 선수)
        otNow = { a, av, speed: ot.speed, pr: ot.pr };
        let mO: ShotModel;
        let vjO: number;
        try {
          mO = shotModel(s, a);
          vjO = judgedP(mO.value, shotModel(s, av).value);
        } finally {
          otNow = null;
        }
        const tikiO = tac.tendency === 'tikitaka' && mO.xg < TENDENCY.tikiLowXg ? TENDENCY.tikiLowShot : 1;
        const uO = weight(vjO * O.shotScale + (1 - vjO) * shotLoss, a.role.pref.shoot * longShot * tikiO * gegenMul * risk) + shootBias(mO, goalAngle(a.x, a.y, gx));
        ot.out.push({ type: 'shoot', p: mO.xg, u: uO, x: gx, y: gy, receiver: -1, value: mO.value, ot: true });
      }
    }

    // 크로스: 측면 최종 3분의 1, 박스 안 동료 1명 이상
    if (ax >= PR.crossMinX && (ay < PR.crossWide || ay > 1 - PR.crossWide)) {
      const ct = crossTarget(s, a);
      if (ct) {
        const accOf = (who: Agent) => clamp(PR.crossBase + (PR.crossSkill * (who.attrs.crossing - PR.skillCenter)) / 100 - PR.pressurePenalty * pressure, 0.2, 1);
        const p = accOf(a) * ct.pWin;
        const pj = judgedP(p, accOf(av) * ct.pWin);
        // 공격 폭 (좁게 0.9 / 넓게 1.1), 직선 성향 (E.19)
        const cMul = widthCrossMul(tac.width) * (tac.tendency === 'direct' ? TENDENCY.directCrossMul : 1);
        const u = weight(pj * ct.value + (1 - pj) * loss(ax, ay), a.role.pref.cross * cMul * risk);
        out.push({ type: 'cross', p, u, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
      }
    }

    // 클리어링: 수비 3분의 1, 압박이 심할 때
    if (ax < PR.clearMaxX && pressure > PR.clearPressure) {
      const [tx, ty] = toPitch(clamp(ax + 0.42, 0, 0.9), 0.5 + (ay - 0.5) * 0.5, dir);
      const [nx, ny] = toNorm(tx, ty, dir);
      // 걷어내기 (C.78c ②): 착지점에 먼저 닿을 몫 (옛 동작 0.45 고정)
      const p = O.landShare > 0 ? landingShare(s, a.team, tx, ty, dist(a.x, a.y, tx, ty) / B.airSpeed, a) : 0.45;
      const u = weight(p * positionValue(nx, ny) + (1 - p) * loss(nx, ny), a.role.pref.clear * mDirect);
      out.push({ type: 'clear', p, u, x: tx, y: ty, receiver: -1, value: positionValue(nx, ny) });
    }
  }

  // 유지: 지금 위치 가치 × (1 − 다음 결정까지 빼앗길 확률). 빼앗기면 상실 비용 (다른 후보와 같은 식)
  const pLose = loseProb(s, a);
  const holdU = weight((1 - pLose) * here * holdFresh(s, a) + pLose * lossHere, mPoss * safeRisk * a.role.pref.hold);
  out.push({ type: 'hold', p: 1 - pLose, u: holdU, x: a.x, y: a.y, receiver: -1, value: here });
  // 판단 보정 (C.78p): 슛 밖 행동은 상황 함수 1 (기본값 0 = 끔)
  for (const c of out) if (c.type !== 'shoot') c.u += ENGINE.decide.bias[c.type];
  if (ot) for (const c of ot.out) if (c.type !== 'shoot') c.u += ENGINE.decide.bias[c.type];
  return out;
}

/**
 * 판단 보정 — 슛 선호 (C.78p, ENGINE.decide.bias.shoot): 열린 찬스일수록 큰 효용 보너스.
 * 상황 함수 = 거리(shootNear m 안 1 → shootFar m 0) × 슛 레인(1 − 블록/shootLaneRef) × 각도(goalAngle/shotAngleRef) × (1 − shootPress × 압박).
 * 판단에 보이는 특징만 쓰고 GK 자리·점수·시간은 안 본다 (GK 가 빈 순간으로 슛이 몰리지 않게). 판단 효용에만 더하고 실행·xG 는 그대로
 */
export function shootBias(m: ShotModel, angle: number): number {
  const DB = ENGINE.decide.bias;
  if (!DB.shoot) return 0;
  const fd = clamp((DB.shootFar - m.d) / (DB.shootFar - DB.shootNear), 0, 1);
  const fl = clamp(1 - m.pBlock / DB.shootLaneRef, 0, 1);
  const fa = Math.min(1, angle / PR.shotAngleRef);
  const fp = clamp(1 - DB.shootPress * m.pressure, 0, 1);
  return DB.shoot * fd * fl * fa * fp;
}

/**
 * 백패스 가치 항 (C.77y, 로드맵 3단계 B1): 뒤로 2 m+ 가는 패스 후보의 효용에 압박 탈출·공 보존·반대편 전환을 더하고 전진 기회 비용을 뺀다.
 * 보존·전환은 상황 보존 가중(리드·버스·블록·티키), 비용은 비용 가중(게겐·직선·지는 60분+)을 곱한다. 판단력이 낮을수록 이 항을 잘못 읽는다(인지 오차)
 */
function backValue(s: SimState, a: Agent, out: Candidate[], dir: 1 | -1, prev?: Candidate[]): void {
  let fwdBest = 0;
  for (const c of out) {
    if ((c.type === 'pass' || c.type === 'through') && (c.x - a.x) * dir >= O.backFwd) fwdBest = Math.max(fwdBest, c.p * c.value);
  }
  let n25 = 0;
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && dist(o.x, o.y, a.x, a.y) < 2.5) n25++;
  const press = Math.min(1, pressureAt(s, a) + O.backEscapeExtra * Math.max(0, n25 - 1));
  const tm = s.teams[a.team];
  const tac = tm.tactics;
  const lead = tm.stats.goals - s.teams[1 - a.team]!.stats.goals;
  const keepW = 1 + (lead > 0 ? O.backLeadKeep : 0) + (tac.tendency === 'block' || tac.tendency === 'tikitaka' ? O.backTendKeep : 0);
  const costW = 1 + (attackTendency(tac.tendency) ? O.backTendCost : 0) + (lead <= 0 && s.t / 60 >= O.backLateMin ? O.backLateCost : 0);
  // 전환 대상 동료(공 반대 측면·자유) 는 후보마다 같다 — 한 번만 (C.78b 계산 줄이기, 결과 같음)
  let mates: Agent[] | null = null;
  for (const c of out) {
    if (c.type !== 'pass' || (c.x - a.x) * dir >= -2) continue;
    // 원터치 판(C.78b): 같은 받는 선수·자리의 다루기 판에서 압박 탈출·보존·전환·인지 오차는 같다 — 기회 비용만 이 목록의 전진 기대값으로
    const same = prev?.find((x) => x.back && x.receiver === c.receiver && x.type === 'pass' && x.x === c.x && x.y === c.y);
    if (same) {
      const { escape, keep, sw, noise } = same.back!;
      const cost = O.backCost * fwdBest * costW;
      c.u += escape + keep + sw - cost + noise;
      c.back = { escape, keep, sw, cost, noise };
      continue;
    }
    if (!mates) {
      mates = [];
      for (const m of s.agents) {
        if (!m.onPitch || m.team !== a.team || m === a || m.line === 0) continue;
        if ((m.y - a.y) * (W / 2 - a.y) <= 0 || Math.abs(m.y - a.y) < O.backSwitchDy) continue;
        if (nearestOpponent(s, m)[1] < O.backSwitchFree) continue;
        mates.push(m);
      }
    }
    const r = s.agents[c.receiver]!;
    const room = nearestOpponent(s, r, c.x, c.y)[1];
    const rp = Math.max(0, 1 - room / PR.receiverPressureDist);
    const escape = O.backEscape * press * (1 - rp);
    const keep = O.backKeep * Math.min(1, room / O.backKeepRoom) * keepW;
    // 반대편 전환: 받는 자리에서 공 반대 측면 동료에게 열린 길
    let swBest = 0;
    for (const m of mates) {
      if (m === r) continue;
      swBest = Math.max(swBest, 1 - Math.min(1, laneRiskAt(s, a.team, c.x, c.y, m.x, m.y).risk));
    }
    const sw = O.backSwitch * swBest * keepW;
    const cost = O.backCost * fwdBest * costW;
    const noise = O.backNoise * (1 - a.judgement) * randn(s.seed, s.tick, a.idx, Purpose.BackRead, c.receiver);
    c.u += escape + keep + sw - cost + noise;
    c.back = { escape, keep, sw, cost, noise };
  }
}

/** 앞선 골 수에 따른 전진 선택(전진 패스·슛·드리블·크로스) 효용 배수 (2골 이상 leadRisk2, 3골 이상 leadRisk3). 안전 패스·유지는 역수 */
export function leadRiskMul(s: SimState, team: 0 | 1): number {
  const lead = s.teams[team].stats.goals - s.teams[team === 0 ? 1 : 0].stats.goals;
  return lead >= 3 ? TA.leadRisk3 : lead >= 2 ? TA.leadRisk2 : 1;
}

/** 앞선 골 수에 따른 유지 템포 배수 (느려진다) */
/**
 * 공 쥐고 서 있기의 남은 가치 (C.78k): exp(−공 잡은 뒤 시간 / holdStale). 리드 중 holdWasteMin 분 이후(시간 끌기)는 holdWasteMul 배 천천히.
 * 판단에만 쓰는 가치 항이다 — 빼앗길 확률(실행 판정 P)은 그대로라 판단 = 실행
 */
function holdFresh(s: SimState, a: Agent): number {
  const OB = ENGINE.onball;
  if (OB.holdStale <= 0) return 1;
  const lead = s.teams[a.team].stats.goals - s.teams[a.team === 0 ? 1 : 0].stats.goals;
  const waste = lead > 0 && s.t >= OB.holdWasteMin * 60 ? OB.holdWasteMul : 1;
  return Math.exp(-Math.max(0, s.t - a.ballT) / (OB.holdStale * waste));
}

export function leadTempoMul(s: SimState, team: 0 | 1): number {
  const lead = s.teams[team].stats.goals - s.teams[team === 0 ? 1 : 0].stats.goals;
  return lead >= 3 ? TA.leadTempo3 : lead >= 2 ? TA.leadTempo2 : 1;
}

/** 판단 온도 (E.22 C): τ = tempBase × exp(tempSlope × (0.7 − 판단 품질)) */
export function decisionTemp(a: Agent): number {
  return O.tempBase * Math.exp(O.tempSlope * (0.7 - a.judgement)) * (1 + O.tiredTemp * tiredRatio(a));
}

/**
 * 시야 제한 (E.22 C): 이 후보가 보이는가. 패스·크로스만 가려질 수 있다 (유지, 몰고 가기, 돌파, 슛, 클리어링은 항상 보인다).
 * 몸 방향 밖이거나 반대편 전환이면 scan 확률, 침투 패스는 throughSee 확률 (시야 능력치)
 */
export function visible(s: SimState, a: Agent, c: Candidate, k: number): boolean {
  if (c.receiver < 0 || c.type === 'layoff') return true;
  // 2:1 (C.77y): 방금 나에게 공을 준 동료의 주고 달리기는 받으면서 봤다 (받는 순간 패서 쪽을 보고 있었다)
  const lp = s.lastPass;
  if (c.type === 'through' && lp && lp.receiver === a.idx && lp.passer === c.receiver && s.agents[c.receiver]?.giveGo && ENGINE.offball.giveGoChance > 0) return true;
  const dir = attackDir(a.team, s.half);
  const sp = Math.hypot(a.vx, a.vy);
  const [fx, fy] = a.backToGoal ? [-dir, 0] : sp > 0.5 ? [a.vx / sp, a.vy / sp] : [dir, 0];
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ang = (Math.acos(clamp((dx * fx + dy * fy) / d, -1, 1)) * 180) / Math.PI;
  const v = (a.attrs.vision - 50) / 50;
  let p = 1;
  if (ang > (O.visionCone + O.visionConeSlope * (a.attrs.vision - 50)) / 2 || Math.abs(dy) > O.switchDist) p *= clamp(O.scanBase + O.scanSlope * v, 0.05, 1);
  if (c.type === 'through') p *= clamp(O.throughSeeBase + O.throughSeeSlope * v, 0.05, 1);
  return p >= 1 || rand(s.seed, s.tick, a.idx, Purpose.Vision, k) < p;
}

/**
 * 실제로 나오는 실수 (E.22 C): 유지로 공 끌기, 안전한 백패스, 무리한 슛. 효용이 낮아도 고를 수 있다.
 * 안전한 백패스는 짧은 패스(롱볼 거리 미만)만이다 (C.76z, 미해결 2): 30 m 넘게 뒤로 보내는 롱볼은 "안전한 실수"가 아니라
 * 효용 1위 gap 안에 들어야 고를 수 있다 (엔진 33 에서 고른 롱볼의 37% 가 gap 밖인데 이 분기로 들어왔다)
 */
function isMistake(s: SimState, a: Agent, c: Candidate, maxU: number): boolean {
  if (c.type === 'hold') return true;
  if (c.type === 'shoot') return c.u >= maxU - O.mistakeShotGap * O.plausibleGap;
  // C.77y: 백패스 가치 항(backModel)이 켜지면 백패스도 효용 1위 gap 안에 들어야 고른다 (실수 = 가치 항 인지 오차 + softmax)
  if (O.backModel > 0) return false;
  return c.type === 'pass' && (c.x - a.x) * attackDir(a.team, s.half) < -2 && (dist(a.x, a.y, c.x, c.y) < TA.longBall || pressureAt(s, a) > 0);
}

/**
 * 소극적 백패스 감점 가중 (C.77s, pending 145 A1): 압박 없이(pressureAt 0) 같은 후보 풀에 앞으로 passiveFwd m+ 가는 패스(p ≥ passiveOpenP)가
 * 있는데 passiveBack m+ 뒤로(또는 하프라인을 넘어 자기 진영으로) 주는 패스면 가중(1 이상), 아니거나 상황 예외면 0.
 * commit 이면 순번·역습 허용을 기록한다. 평점에만 쓰고 선택은 바꾸지 않는다 (난수 없음, 지문 불변)
 */
function passiveWeight(s: SimState, a: Agent, c: Candidate, pool: Candidate[], commit: boolean): number {
  const R = ENGINE.rating;
  if (c.type !== 'pass') return 0;
  const dir = attackDir(a.team, s.half);
  const [ax] = toNorm(a.x, a.y, dir);
  const [cx] = toNorm(c.x, c.y, dir);
  if ((a.x - c.x) * dir < R.passiveBack && !(ax >= 0.5 && cx < 0.5 && c.x * dir < a.x * dir)) return 0;
  if (pressureAt(s, a) > 0) return 0;
  if (!pool.some((o) => (o.type === 'pass' || o.type === 'through') && (o.x - a.x) * dir >= R.passiveFwd && o.p >= R.passiveOpenP)) return 0;
  const tm = s.teams[a.team];
  const lead = tm.stats.goals - s.teams[1 - a.team]!.stats.goals;
  const min = s.t / 60;
  if (lead >= 2 || (lead === 1 && min >= R.passiveLeadMin)) return 0;
  if (s.possOrigin !== 'open' && s.t - s.possStartT <= R.passiveRestartT) return 0;
  const tac = tm.tactics;
  if (tac.tendency === 'block') return 0;
  const rt = a.rt;
  if (tac.tendency === 'counter' && ax < 0.5 && rt.passiveCtr !== s.possStartT) {
    if (commit) rt.passiveCtr = s.possStartT;
    return 0;
  }
  const seq = (rt.passivePoss === s.possStartT ? rt.passiveSeq ?? 0 : 0) + 1;
  if (commit) {
    rt.passivePoss = s.possStartT;
    rt.passiveSeq = seq;
  }
  let w = 1;
  if (attackTendency(tac.tendency) || tac.pressing >= R.passiveHighPress) w *= R.passiveAttackMul;
  if (min >= R.passiveLateMin && lead <= 0) w *= R.passiveLateMul;
  if (seq >= R.passiveRepeatFrom) w *= R.passiveRepeatMul;
  return w;
}

function attackTendency(t: Tendency): boolean {
  return t === 'gegenpress' || t === 'direct';
}

/** 소극적 백패스를 센다 (C.77s A1): 허용 횟수를 넘긴 것부터 가중을 passiveW 에 더한다. 고른 후보가 확정된 뒤 (엔진 결정·직접 모드 선택) 한 번 부른다 */
export function notePassive(s: SimState, a: Agent, c: Candidate, pool: Candidate[]): void {
  const w = passiveWeight(s, a, c, pool, true);
  if (w <= 0) return;
  const rt = a.rt;
  rt.passive = (rt.passive ?? 0) + 1;
  if (rt.passive > passiveFree(s, a)) rt.passiveW = (rt.passiveW ?? 0) + w;
}

function passiveFree(s: SimState, a: Agent): number {
  const R = ENGINE.rating;
  return attackTendency(s.teams[a.team].tactics.tendency) ? R.passiveFreeAttack : R.passiveFree;
}

/** 이 후보를 지금 고르면 붙을 소극적 백패스 감점 (C.77s A3, 평점 단위 ≤ 0): 남은 허용·경기 최대를 반영. 결정 순간 표시용 (기록하지 않는다) */
export function passivePreview(s: SimState, a: Agent, c: Candidate, pool: Candidate[]): number {
  const R = ENGINE.rating;
  const w = passiveWeight(s, a, c, pool, false);
  if (w <= 0 || (a.rt.passive ?? 0) + 1 <= passiveFree(s, a)) return 0;
  const used = (a.rt.passiveW ?? 0) * R.passive;
  return Math.max(R.passiveMax - used, w * R.passive) * R.scale;
}

/** 위험 감수 행동 (C.77s A2): 전진(passiveFwd m+)·침투 패스·크로스·돌파. 이 선택 뒤 상대 진영에서 잃으면 감점이 riskLostFactor 배 */
export function riskyAction(s: SimState, a: Agent, c: Candidate): boolean {
  if (c.type === 'through' || c.type === 'cross' || c.type === 'dribble') return true;
  return c.type === 'pass' && (c.x - a.x) * attackDir(a.team, s.half) >= ENGINE.rating.passiveFwd;
}

/**
 * softmax 선택 (E.22 C): 보이는 후보 중 효용 1위에서 plausibleGap 안의 후보와 실수 유형만, 온도 τ (판단 품질)로 고른다.
 * 보이는 후보가 없으면 (유지는 항상 보인다) 전체에서
 */
export function choose(s: SimState, a: Agent, cands: Candidate[], pre = false): Candidate {
  const vis = cands.filter((c, k) => visible(s, a, c, k));
  const pool0 = vis.length ? vis : cands;
  let maxU = -Infinity;
  for (const c of pool0) maxU = Math.max(maxU, c.u);
  // 가치 비례 gap·온도 (C.77i, 44h-f3b): 효용 스케일이 작은 중원에서는 gap·τ 를 그 자리 가치 / 기준점(골 scaleRefDist m 중앙) 가치에 비례해 줄인다.
  // 기준점보다 앞(vScale ≥ 1)은 그대로. 실수 후보(isMistake)는 절대 gap 그대로
  const vScale = positionValue(...toNorm(a.x, a.y, attackDir(a.team, s.half))) / positionValue(1 - O.scaleRefDist / L, 0.5);
  // 바닥은 빌드업 성향 비례 (C.77k, 44h-f3c): 직선(style ≤ styleDirectAt)은 1(넓게), 짧게·혼합(≥ styleMixedAt)은 gapFloor·tempFloor
  const k = clamp((s.teams[a.team].tactics.style - TA.styleDirectAt) / (TA.styleMixedAt - TA.styleDirectAt), 0, 1);
  const gap = O.plausibleGap * clamp(vScale, 1 - (1 - O.gapFloor) * k, 1);
  const pool = pool0.filter((c) => c.u >= maxU - gap || isMistake(s, a, c, maxU));
  const tau = decisionTemp(a) * clamp(vScale, 1 - (1 - O.tempFloor) * k, 1);
  // 패스 받는 빈도 (C.74c): 동료가 나에게 주는 후보의 선택 가중 × 팀 관계·호흡 배율 (효용은 그대로, 없으면 1)
  const ws = pool.map((c) => Math.exp(((c.u - maxU) * O.utilityScale) / tau) * (s.rapport ? toMeMul(s, a, c.receiver) : 1));
  const total = ws.reduce((t, w) => t + w, 0);
  let r = rand(s.seed, s.tick, a.idx, Purpose.Decide) * total;
  let pick = pool.length - 1;
  for (let i = 0; i < pool.length; i++) {
    r -= ws[i]!;
    if (r <= 0) {
      pick = i;
      break;
    }
  }
  // 미리 정하기 (C.78b): 컨트롤을 고르면 결정이 아니다 (정지 시간 뒤 다시 정한다) — 기록·측정 훅은 원터치만
  if (pre && !pool[pick]!.ot) return pool[pick]!;
  recordDecision(s, a, pool0, pool[pick]!);
  if (probe.decide) probe.decide(s, { a, cands, vis: pool0, pool, chosen: pool[pick]!, maxU, gap });
  return pool[pick]!;
}

const OT_TYPES = new Set<ActionType>(['pass', 'through', 'cutback', 'layoff', 'shoot']);

/**
 * 미리 정하기 (C.78b, receive.oneTouch): 땅볼 패스를 받는 순간(공이 오는 동안 본 상황) 원터치 행동과 '멈추고 다루기'를 한 번에 고른다.
 * 원터치 후보 = 원터치 배수를 넣은 같은 후보 식(패스·침투·컷백·레이오프·슛), 다루기 후보 = 모든 후보 그대로에 정지 시간 tCtrl 동안
 * 다가오는 압박(가장 가까운 상대가 ctrlClose m/s 로 좁힘)만큼 ctrlCost 비율을 상실 쪽으로. 선택은 choose 그대로(판단력·시야·온도).
 * 원터치를 고르면 그 후보, 다루기를 고르면 null
 */
export function preDecide(s: SimState, a: Agent, speed: number, tCtrl: number): Candidate | null {
  const [, dNear] = nearestOpponent(s, a);
  const pr = Math.max(0, 1 - dNear / RC.pressDist);
  const ot: OtReq = { speed, pr, out: [] };
  const ctrl = candidates(s, a, ot);
  const k = RC.ctrlCost * clamp(1 - (dNear - RC.ctrlClose * tCtrl) / RC.pressDist, 0, 1);
  const lossHere = lossCost(...toNorm(a.x, a.y, attackDir(a.team, s.half)));
  for (const c of ctrl) c.u = (1 - k) * c.u + k * lossHere;
  const pool = [...ot.out, ...ctrl];
  const c = choose(s, a, pool, true);
  if (!c.ot) return null;
  notePassive(s, a, c, pool);
  return c;
}

/** 측정용 (E.22 0번): 상대 진영 결정에서 고른 후보의 효용 순위 (보이는 후보 중) (판단 품질 55 / 70 / 85 구간별 최선·차선·나머지) */
function recordDecision(s: SimState, a: Agent, cands: Candidate[], chosen: Candidate): void {
  if (a.line === 0 || cands.length < 3) return;
  const [nx] = toNorm(a.x, a.y, attackDir(a.team, s.half));
  if (nx <= 0.5) return;
  const j = a.judgement - (a.duelEdge > 0 ? ENGINE.match.homeJudgement : 0);
  const band = j >= 0.5 && j < 0.6 ? 0 : j >= 0.65 && j < 0.75 ? 1 : j >= 0.8 && j < 0.9 ? 2 : -1;
  if (band < 0) return;
  const u = chosen.u;
  let above = 0;
  for (const c of cands) if (c.u > u) above++;
  s.teams[a.team].stats.decisions[band * 3 + Math.min(2, above)]!++;
}

/** 패스 실행: 결과(성공/인터셉트/루즈볼)는 차는 순간 정하고 공은 도착점까지 날아간다 */
export function makePass(s: SimState, a: Agent, c: Candidate): Flight {
  const d = dist(a.x, a.y, c.x, c.y);
  const air = d > PR.airPass;
  // 날씨 (C.74a): 땅볼 패스 속도 × passSpeed (비 빠름, 눈 느림)
  const speed = air ? B.airSpeed : clamp(B.passSpeedBase + B.passSpeedPerM * d, B.passSpeedMin, B.passSpeedMax) * s.env.passSpeed;
  let dur = Math.max(0.2, d / speed);
  // 침투 패스는 달려 들어가는 선수가 닿는 시간에 맞춰 공간으로 보낸다
  const rc = s.agents[c.receiver];
  if (c.type === 'through' && rc) dur = Math.max(dur, ENGINE.physics.arrivalModel > 0 ? arrivalTime(rc, c.x, c.y) : dist(rc.x, rc.y, c.x, c.y) / (rc.maxSpeed * 0.9));
  const fl: Flight = {
    kind: air ? 'long' : 'pass', fromX: a.x, fromY: a.y, toX: c.x, toY: c.y, t0: s.t, dur, air,
    passer: a.idx, receiver: c.receiver, outcome: 'receive', interceptor: -1, through: c.type === 'through',
    quick: c.type === 'cutback' || c.type === 'layoff', aimD: d,
  };
  // 약발 (C.45): 약발로 차야 하는 방향이면 실행 성공 확률 × 약발 배율 (판단의 P 는 그대로)
  const foot = weakFootMul(a.body, attackDir(a.team, s.half), c.x - a.x, c.y - a.y, true);
  // 날씨 (C.74a): 받기(퍼스트 터치) × touch, 공중 패스는 바람 × airPass (판단의 P 는 그대로)
  const wx = s.env.touch * (air ? s.env.airPass : 1);
  // 동료 호흡·상대 분석 (C.74c): 나와 그 동료의 패스 × 호흡, 내 패스·침투 패스가 리포트 약점이면 × 약점 공략 (판단의 P 는 그대로)
  const rx = s.rapport ? chemMul(s, a, rc) * (c.type === 'pass' || c.type === 'through' ? exploitMul(s, a, c.type) : 1) : 1;
  if (rand(s.seed, s.tick, a.idx, Purpose.Pass) < (c.pFlight ?? c.p) * foot * wx * rx) return fl;

  // 실패한 침투 패스이고 GK 가 가장 빠르면 GK 가 목표점으로 나가 끊는다 (C.28)
  if (c.keeper !== undefined && s.agents[c.keeper]?.onPitch) {
    fl.outcome = 'intercept';
    fl.interceptor = c.keeper;
    return fl;
  }

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
  // 빗나간 공도 찬 속도로 날아간다 (C.28 fix: 착지점만 옮기고 시간을 두면 최대 40 m/s 로 날았다)
  fl.dur = Math.max(0.2, dist(a.x, a.y, fl.toX, fl.toY) / speed);
  return fl;
}
