// 온더볼 의사결정 (E.7): 후보 행동의 효용 U = P × V + (1 − P) × C 를 softmax 로 고른다
// 후보: 패스(각 동료), 침투 패스, 몰고 가기/드리블 돌파(전진·좌·우), 슛, 크로스, 클리어링, 유지

import { weakFootMul } from '../body';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../attributes';
import { ENGINE } from './config';
import { aerialWin, dribbleProb, duelTail, receiveWin } from './duel';
import { manDiff } from './formation';
import { hasModule } from './roles';
import { claimProb, keeperOf, keeperZone, saveDifficulty } from './keeper';
import { attackDir, clamp, dist, inOppBox, L, oppGoal, positionValue, segDist, toNorm, toPitch, W } from './pitch';
import { Purpose, rand, randn } from './rng';
import { offsideRisk } from './referee';
import { offsideLine } from './offball';
import { TENDENCY, widthCrossMul } from './tactics';
import { chemMul, exploitMul, toMeMul } from './rapport';
import type { Agent, Flight, SimState } from './state';

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
export function passProbability(s: SimState, a: Agent, tx: number, ty: number, kind: 'pass' | 'cross', lane: LaneInfo, receiverPenalty = 0): number {
  const d = dist(a.x, a.y, tx, ty);
  // 시야: 패스 길을 정확히 찾을수록 가로채일 위험이 줄어든다 (시야 60 기준)
  lane = { ...lane, risk: lane.risk * Math.max(0.3, 1 + (PR.laneVision * (60 - a.attrs.vision)) / 100) };
  const wLong = clamp((d - PR.skillBlendFrom) / (PR.skillBlendTo - PR.skillBlendFrom), 0, 1);
  const skill = kind === 'cross' ? a.attrs.crossing : a.attrs.shortPassing * (1 - wLong) + a.attrs.longPassing * wLong;
  // 거리 감쇠: 숏패스 구간(25 m)까지 passPerM, 그 너머는 longPerM (롱패스 정확도)
  // 받는 선수 압박(마크)도 패스 난이도다: 좋은 패서는 마크 반대쪽으로 넣는다 (능력치가 줄이는 실패에 포함, E.20 5번)
  const p = passDistBase(d) - lane.risk - PR.pressurePenalty * pressureAt(s, a) - receiverPenalty + formBonus(a);
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
  return duelTail(1 / (1 + Math.exp(-((atk - dfn) / O.holdupScale + att.duelEdge - def.duelEdge))));
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
  // 기회의 질 (위치, 각도, 압박, 슈팅 종류): 리그 평균 마무리 선수 기준. 능력치는 마무리 배수 한 곳에서만 (E.20 7번)
  let pOn: number;
  let speed: number;
  if (header) {
    pOn = clamp(PR.headerBase - PR.headerPerM * d, PR.shotMin, PR.shotMax);
    speed = PR.headerSpeed;
  } else {
    pOn = clamp(PR.shotBase - PR.shotPerM * d - PR.shotPressure * pressure + formBonus(a), PR.shotMin, PR.shotMax);
    speed = B.shotSpeed;
  }
  pOn *= Math.min(1, goalAngle(px, py, gx) / PR.shotAngleRef);
  pOn = Math.min(PR.shotCap, pOn * finishMult(t, header ? 'header' : d >= PR.longShotFrom ? 'long' : 'shot'));
  let blockers = 0;
  if (!header) {
    for (const o of s.agents) {
      if (!o.onPitch || o.team === a.team || o.line === 0) continue;
      const [cd, ct] = segDist(o.x, o.y, px, py, gx, gy);
      if (cd < PR.coneWidth && ct > 0.02 && ct < 0.95) blockers++;
    }
  }
  const pBlock = Math.min(PR.blockMax, blockers * PR.blockPer);
  const pGoal = 1 - leagueSaveProb(speed, 0.5, d);
  const xg = (1 - pBlock) * pOn * pGoal;
  // 리바운드: 선방 → 쳐내기 → 코너가 아니면 공격 팀이 reboundOwn 확률로 골 앞(8 m)에서 다시 잡는다
  const K = ENGINE.keeper;
  const parry = 1 - clamp(K.catchBase + (K.catchSkill * K.leagueHandling) / 100, 0, 1);
  const rebound = (1 - pBlock) * pOn * (1 - pGoal) * parry * (1 - K.parryCorner) * K.reboundOwn * positionValue(1 - 8 / L, 0.5);
  return { d, pOn, pBlock, pGoal, xg, value: xg + rebound, speed, blockers };
}

/** 마무리 능력치 (E.20 7번): 슈팅(중거리는 중거리 슛, 헤더는 헤더, 프리킥은 프리킥) × 0.6 + 침착성 × 0.25 + 결정력 × 0.15 */
export function finishSkill(t: FieldAttributes, kind: 'shot' | 'long' | 'header' | 'freeKick'): number {
  const main = kind === 'long' ? t.longShots : kind === 'header' ? t.heading : kind === 'freeKick' ? t.freeKick : t.shooting;
  return main * 0.6 + t.composure * 0.25 + t.bigMatch * 0.15;
}

/** 마무리 배수 = clamp(1 + finishPerPoint × (마무리 능력치 − 70), finishMin, finishMax). 유효 슈팅(= 골 확률)에 곱한다 */
export function finishMult(t: FieldAttributes, kind: 'shot' | 'long' | 'header' | 'freeKick'): number {
  return clamp(1 + PR.finishPerPoint * (finishSkill(t, kind) - PR.skillCenter), PR.finishMin, PR.finishMax);
}

/** 리그 평균 GK 의 세이브 확률 (판단용. 실제 판정은 상대 GK 능력치) */
function leagueSaveProb(speed: number, corner: number, d: number): number {
  const K = ENGINE.keeper;
  return clamp(K.saveBase - K.saveDelta * saveDifficulty(speed, corner, d) + (K.saveSkill * (K.leagueShotStopping - K.saveCenter)) / 100, 0.05, 0.95);
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
  av.onPitch = a.onPitch;
  return av;
}

/** 판단용 성공 확률: 본인과 리그 평균 선수의 혼합 (E.20 1번) */
export function judgedP(self: number, avg: number): number {
  return O.judgeSelf * self + (1 - O.judgeSelf) * avg;
}

/** 후보 행동 생성. Candidate.p 는 실제 판정용(본인), 효용 u 는 판단용 P(본인·리그 평균 혼합)로 계산한다 */
export function candidates(s: SimState, a: Agent): Candidate[] {
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
  const safeMul = manDiff(s, a.team) < 0 ? ENGINE.referee.shortSafe : 1;
  const isGk = a.line === 0;
  const out: Candidate[] = [];
  const [gx0, gy0] = oppGoal(dir);
  const tac = s.teams[a.team].tactics;
  const style = tac.style;
  const mPoss = TA.possBase + TA.possSlope * style;
  const mDirect = TA.directBase - TA.possSlope * style;
  // 성향 고유 행동 (E.19): 공을 뺏은 뒤 게겐프레싱 4초 전진 패스·슛, 역습 6초 전진·침투 패스 효용 배수
  const sinceWin = s.possTeam === a.team ? s.t - s.teams[a.team].wonAt : Infinity;
  const winMul = tac.tendency === 'gegenpress' && sinceWin <= TENDENCY.gegenWinTime ? TENDENCY.gegenWinMul
    : tac.tendency === 'counter' && sinceWin <= TENDENCY.counterWinTime ? TENDENCY.counterWinMul : 1;
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
    if (running) {
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
      let tDef = def ? dist(def.x, def.y, tx, ty) / def.maxSpeed + PR.raceTurn : Infinity;
      // 목표점이 상대 GK 처리 구역 안이면 GK 도 달리기 경쟁에 들어간다 (C.28). GK 가 더 빠르면 실패한 패스는 GK 가 끊는다
      if (oppGk && keeperZone(s, oppGk, tx, ty)) {
        const tGk = dist(oppGk.x, oppGk.y, tx, ty) / oppGk.maxSpeed + ENGINE.keeper.throughDelay;
        if (tGk < tDef) {
          tDef = tGk;
          gkWins = oppGk.idx;
        }
      }
      if (Number.isFinite(tDef)) race = PR.raceGain * clamp(tDef - dist(r.x, r.y, tx, ty) / r.maxSpeed, -PR.raceCap, PR.raceCap);
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
    const flightP = (who: Agent) => clamp(passProbability(s, who, tx, ty, 'pass', lane, PR.receiverPressure * rp) + race, PR.passMin, PR.passCap);
    const pFlight = flightP(a);
    const p = pFlight * aerial;
    const pj = judgedP(p, flightP(av) * aerial);
    const [rx, ry] = toNorm(tx, ty, dir);
    // 받는 자리의 가치 × 지원도 (E.20 2번). 받는 순간 압박이 있으면 그만큼 다음 결정 전에 빼앗길 수 있다 (유지 효용과 같은 식)
    const pLoseR = O.holdLose * rp;
    let value = positionValue(rx, ry) * support(r, tx, ty);
    // 받는 자리에서 슛을 노릴 수 있으면 그 기대값도 가치로 본다 (같은 골 단위, 슛은 지원과 무관). 골을 등지고 받는 패스는 바로 슛할 수 없다 (E.18 A2)
    if (dist(tx, ty, gx0, gy0) <= PR.shotMaxDist && rx > 0.6 && !receivesBack(a.x, a.y, tx, ty, dir)) {
      // 받는 선수의 슈팅 가치도 판단용이므로 본인·리그 평균 혼합 (E.20 1번과 같은 원칙)
      const at = { x: tx, y: ty };
      value = Math.max(value, judgedP(shotModel(s, r, false, at).value, shotModel(s, averageSelf(r), false, at).value));
    }
    const lossR = loss(rx, ry);
    value = value * (1 - pLoseR) + pLoseR * lossR;
    let u = pj * value + (1 - pj) * lossR;
    // 받을 선수가 오프사이드 위치로 보이면 그 확률만큼 상대 프리킥 (E.7, E.10)
    const pOff = offsideRisk(s, a, r);
    if (pOff > 0) u = (1 - pOff) * u + pOff * lossR;
    const forward = rx > ax + 0.03;
    // 팀 빌드업 성향 (E.18 A5): 롱볼·최전방 직행은 직선형, 나머지 짧은 패스·백패스는 점유형일수록
    const direct = d0 >= TA.longBall || ((r.pos === 'ST' || r.pos === 'CF') && a.line <= 2 && (rx - ax) * L >= TA.directForward);
    // 직선(롱볼): 타깃 ST 에게 가는 롱볼
    const tMul = target === r && d0 >= TA.longBall ? TENDENCY.directTargetMul : 1;
    const wMul = forward ? winMul : 1;
    // 역할 (E.6, E3.7): 롱패스 선호, 받는 선수의 공 요구(③)
    const roleMul = (d0 >= TA.longBall ? a.role.pref.long : 1) * (hasModule(r.role, 'demand') ? ENGINE.roles.demandPass : 1);
    u = weight(u, a.role.pref.pass * (forward ? a.role.pref.forward : a.role.pref.safe * safeMul) * (direct ? mDirect : mPoss) * tMul * wMul * roleMul * (forward ? risk : safeRisk));
    // 컷백: 골에서 9~18 m, 골대 양 끝이 보이는 각도 안의 동료에게 뒤로 내주는 패스 (판정은 숏패스 식 그대로)
    const gd = dist(tx, ty, gx0, gy0);
    const cutback = cutZone && !running && gd >= O.cutbackMin && gd <= O.cutbackMax && goalAngle(tx, ty, gx0) >= PR.shotAngleRef;
    out.push({ type: cutback ? 'cutback' : running ? 'through' : 'pass', p, u, x: tx, y: ty, receiver: r.idx, value, pFlight, ...(gkWins >= 0 ? { keeper: gkWins } : {}) });
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
      const p = layP(a);
      const pj = judgedP(p, layP(av));
      let value = positionValue(rx, ry) * support(r, r.x, r.y);
      if (dist(r.x, r.y, gx0, gy0) <= PR.shotMaxDist) value = Math.max(value, judgedP(shotModel(s, r, false).value, shotModel(s, averageSelf(r), false).value));
      const u = weight(pj * value + (1 - pj) * loss(rx, ry), a.role.pref.pass);
      out.push({ type: 'layoff', p, u, x: r.x, y: r.y, receiver: r.idx, value });
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
      const value = positionValue(nx, ny) * (1 - qEnd) + qEnd * loss(nx, ny);
      if (def) {
        // 수비 자세 (E.23): 수비수는 바깥쪽으로 몬다. 중앙 쪽으로 꺾는 돌파는 어렵고 바깥쪽은 조금 쉽다
        const D = ENGINE.defense;
        const stance = ang === 0 ? 0 : Math.abs(cy - W / 2) < Math.abs(a.y - W / 2) ? -D.stanceInside : D.stanceOutside;
        const dp = (who: Agent) => clamp(dribbleProb(who, def!, (second ? -PR.spaceSecondPenalty : 0) + stance) + formBonus(who), 0.02, 0.98);
        const p = dp(a);
        const pj = judgedP(p, dp(av));
        const u = weight(pj * value + (1 - pj) * lossHere, a.role.pref.dribble * risk);
        out.push({ type: 'dribble', p, u, x: cx, y: cy, receiver: -1, value, opponent: def.idx });
      } else {
        // 몰고 가기: 가는 길로 좁혀 오는 수비수들의 압박으로 빼앗길 확률. 공을 지키는 능력치가 줄인다 (C.17 결정 3)
        const cp = (who: Agent) => clamp(0.98 * (1 - carryLoseProb(s, a, cx, cy, who)), 0.05, 0.98);
        const p = cp(a);
        const pj = judgedP(p, cp(av));
        const u = weight(pj * value + (1 - pj) * lossHere, a.role.pref.dribble * a.role.pref.carry * risk);
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
      const u = weight(vj * O.shotScale + (1 - vj) * shotLoss, a.role.pref.shoot * longShot * tikiMul * gegenMul * risk);
      out.push({ type: 'shoot', p: m.xg, u, x: gx, y: gy, receiver: -1, value: m.value });
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
      const p = 0.45;
      const [nx, ny] = toNorm(tx, ty, dir);
      const u = weight(p * positionValue(nx, ny) + (1 - p) * loss(nx, ny), a.role.pref.clear * mDirect);
      out.push({ type: 'clear', p, u, x: tx, y: ty, receiver: -1, value: positionValue(nx, ny) });
    }
  }

  // 유지: 지금 위치 가치 × (1 − 다음 결정까지 빼앗길 확률). 빼앗기면 상실 비용 (다른 후보와 같은 식)
  const pLose = loseProb(s, a);
  const holdU = weight((1 - pLose) * here + pLose * lossHere, mPoss * safeRisk * a.role.pref.hold);
  out.push({ type: 'hold', p: 1 - pLose, u: holdU, x: a.x, y: a.y, receiver: -1, value: here });
  return out;
}

/** 앞선 골 수에 따른 전진 선택(전진 패스·슛·드리블·크로스) 효용 배수 (2골 이상 leadRisk2, 3골 이상 leadRisk3). 안전 패스·유지는 역수 */
export function leadRiskMul(s: SimState, team: 0 | 1): number {
  const lead = s.teams[team].stats.goals - s.teams[team === 0 ? 1 : 0].stats.goals;
  return lead >= 3 ? TA.leadRisk3 : lead >= 2 ? TA.leadRisk2 : 1;
}

/** 앞선 골 수에 따른 유지 템포 배수 (느려진다) */
export function leadTempoMul(s: SimState, team: 0 | 1): number {
  const lead = s.teams[team].stats.goals - s.teams[team === 0 ? 1 : 0].stats.goals;
  return lead >= 3 ? TA.leadTempo3 : lead >= 2 ? TA.leadTempo2 : 1;
}

/** 판단 온도 (E.22 C): τ = tempBase × exp(tempSlope × (0.7 − 판단 품질)) */
export function decisionTemp(a: Agent): number {
  return O.tempBase * Math.exp(O.tempSlope * (0.7 - a.judgement));
}

/**
 * 시야 제한 (E.22 C): 이 후보가 보이는가. 패스·크로스만 가려질 수 있다 (유지, 몰고 가기, 돌파, 슛, 클리어링은 항상 보인다).
 * 몸 방향 밖이거나 반대편 전환이면 scan 확률, 침투 패스는 throughSee 확률 (시야 능력치)
 */
export function visible(s: SimState, a: Agent, c: Candidate, k: number): boolean {
  if (c.receiver < 0 || c.type === 'layoff') return true;
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

/** 실제로 나오는 실수 (E.22 C): 유지로 공 끌기, 안전한 백패스, 무리한 슛. 효용이 낮아도 고를 수 있다 */
function isMistake(s: SimState, a: Agent, c: Candidate, maxU: number): boolean {
  if (c.type === 'hold') return true;
  if (c.type === 'shoot') return c.u >= maxU - O.mistakeShotGap * O.plausibleGap;
  return c.type === 'pass' && (c.x - a.x) * attackDir(a.team, s.half) < -2;
}

/**
 * softmax 선택 (E.22 C): 보이는 후보 중 효용 1위에서 plausibleGap 안의 후보와 실수 유형만, 온도 τ (판단 품질)로 고른다.
 * 보이는 후보가 없으면 (유지는 항상 보인다) 전체에서
 */
export function choose(s: SimState, a: Agent, cands: Candidate[]): Candidate {
  const vis = cands.filter((c, k) => visible(s, a, c, k));
  const pool0 = vis.length ? vis : cands;
  let maxU = -Infinity;
  for (const c of pool0) maxU = Math.max(maxU, c.u);
  const pool = pool0.filter((c) => c.u >= maxU - O.plausibleGap || isMistake(s, a, c, maxU));
  const tau = decisionTemp(a);
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
  recordDecision(s, a, pool0, pool[pick]!);
  return pool[pick]!;
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
  if (c.type === 'through' && rc) dur = Math.max(dur, dist(rc.x, rc.y, c.x, c.y) / (rc.maxSpeed * 0.9));
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
