// 행동 실행과 결과 판정: 패스, 드리블 돌파, 태클, 슛, 크로스, 클리어링, 공중볼, 세이브

import { shotFootMul, shotWeakShare, weakFootMul } from '../body';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import { event, looseBall, reaction, receiveTime, setOwner, setRestart } from './core';
import { fitPts } from './fit';
import * as duel_ from './duel';
const { aerialScore, aerialWin, dribbleProb, duelTail, receiveWin } = duel_;
import { type ShotCtx } from './keeper';
import * as keeper_ from './keeper';
const { catchProb, claimProb, coverOf, farSide, gkCtx, keeperOf, keeperZone, saveChance, saveProb } = keeper_;
import { ballRank, inOwnBox, updateOffball } from './offball';
import { carryReachDist, crossTarget, finishMult, leadTempoMul, makePass, oneTouchMul, preDecide, receivesBack, riskyAction, shotModel, shotOneTouch, shotRush, type Candidate } from './onball';
import { callOffside, foul, foulFactor, giveCard, isOffside } from './referee';
import { airCardEdge, blockCardBonus, crossCardEdge, shotCardMod } from './cards';
import { oppShotMoment } from './moments';
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, inOppBox, inOwnDanger, L, oppGoal, ownGoal, positionValue, segDist, toNorm, W } = pitch_;
import * as physics_ from './physics';
const { duelEdgeOf, landingVelocity, tiredRatio } = physics_;
import * as env_ from './env';
const { LONG_SHOT_FROM } = env_;
import * as rapport_ from './rapport';
const { exploitMul } = rapport_;
import * as probe_ from './probe';
const { probe, probeShot, probeShotEnd } = probe_;
import * as rng_ from './rng';
const { Purpose, rand, randn } = rng_;
import type { Agent, BallReserve, Flight, SimState } from './state';

/** 선방률 지표의 거리 기준 (C.76q): 이보다 먼 유효 슈팅만 farOnTarget·farSaves 로 센다 */
const FAR_SAVE_FROM = 12;
/** 상황 구간 (C.78r): 거리 경계(박스 선 16.5 · 25 m)와 GK 자리 잡음 기준(슛 순간 덮는 정도) — 지표만, 판정에 안 쓴다 */
const FAR_BIN_D = [16.5, 25];
const FAR_BIN_SET = 0.9;

const PR = ENGINE.prob;
const B = ENGINE.ball;
const K = ENGINE.keeper;
const RC = ENGINE.receive;
const G = ENGINE.pitch.goalWidth;

function r(s: SimState, a: number, p: number, k = 0): number {
  return rand(s.seed, s.tick, a, p, k);
}

function launch(s: SimState, a: Agent, fl: Flight): void {
  const b = s.ball;
  b.owner = -1;
  b.flight = fl;
  b.reserve = null;
  b.kick = { kind: fl.kind, team: a.team, receiver: fl.receiver };
  b.lastTouch = a.idx;
  b.lastTeam = a.team;
  const who = fl.outcome === 'receive' ? fl.receiver : fl.outcome === 'intercept' ? fl.interceptor : -1;
  if (who >= 0) updateOffball(s, s.agents[who]!);
  a.cooldown = reaction(a);
}

export function execute(s: SimState, a: Agent, c: Candidate): void {
  const team = s.teams[a.team];
  // 위험 감수 실패 (C.77s A2): 이 선택 뒤 상대 진영에서 잃으면 감점 완화
  a.rt.risky = riskyAction(s, a, c);
  switch (c.type) {
    case 'pass':
    case 'through':
    case 'cutback':
    case 'layoff': {
      a.stats.passes++;
      team.stats.passes++;
      if (c.type === 'cutback') {
        team.stats.cutbacks++;
        countBox(s, a);
      }
      if (c.type === 'layoff') team.stats.layoffs++;
      if (dist(a.x, a.y, c.x, c.y) >= 30) {
        team.stats.longPasses++;
        team.stats.longPSum += c.p;
      }
      if (c.type === 'through') {
        team.stats.throughPasses++;
        a.stats.throughPasses++;
      }
      const fl = makePass(s, a, c);
      const receiver = s.agents[c.receiver]!;
      const offside = fl.outcome === 'receive' && isOffside(s, a, receiver);
      s.exemptPass = false;
      if (offside) {
        callOffside(s, a, receiver);
        return;
      }
      launch(s, a, fl);
      return;
    }
    case 'dribble':
      dribble(s, a, c);
      return;
    case 'holdup':
      holdup(s, a, c);
      return;
    case 'shoot':
      shoot(s, a, false);
      return;
    case 'cross':
      cross(s, a, c);
      return;
    case 'clear':
      countClearance(s, a, a.x, a.y);
      longBall(s, a, c.x, c.y, 'clear');
      return;
    case 'carry':
      if (pressureLoss(s, a, c)) return;
      a.lastMoveT = s.t;
      a.carryN++;
      a.tx = c.x;
      a.ty = c.y;
      a.urgent = true;
      a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
      return;
    case 'hold':
    default:
      if (pressureLoss(s, a, c)) return;
      a.tx = a.x;
      a.ty = a.y;
      a.urgent = false;
      // 템포 (E.18 A5): 점유형일수록 유지 간격이 길다
      a.cooldown = (reaction(a) + ENGINE.onball.holdTime) * (ENGINE.tactics.possBase + ENGINE.tactics.possSlope * s.teams[a.team].tactics.style) * leadTempoMul(s, a.team);
  }
}

/**
 * 몰고 가기/유지의 실패 판정: 판단에 쓴 성공 확률 P 그대로 (E.18 A1, P 는 실제 판정과 같아야 한다).
 * 실패하면 가장 가까운 압박 수비수가 태클로 빼앗는다
 */
function pressureLoss(s: SimState, a: Agent, c: Candidate): boolean {
  if (c.p >= 1 || a.line === 0) return false;
  if (r(s, a.idx, Purpose.Tackle, 7) < c.p) return false;
  let def: Agent | null = null;
  let bd: number = ENGINE.prob.pressureDist;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || s.t < o.beatenUntil) continue;
    // 판단 P 와 같은 범위 (GK 포함). 몰고 가기는 가는 길에 가장 먼저 닿는 수비수(실효 거리), 유지는 지금 위치에서 가장 가까운 수비수
    const d = c.type === 'carry' ? carryReachDist(s, o, a, c.x, c.y) : dist(o.x, o.y, a.x, a.y);
    if (d < bd) {
      bd = d;
      def = o;
    }
  }
  if (!def) return false;
  tackleWon(s, a, def, false);
  return true;
}

/**
 * 태클에 이긴 수비수: 공을 갖거나 (tackleKeep) 루즈볼.
 * 집계 (E.23): tackle = 실제 태클(수비수의 태클 판단, 드리블·버티기 1대1에서 이긴 경합)이면 태클로, 아니면(몰고 가기·유지 실패) 소유 상실로만 센다
 */
function tackleWon(s: SimState, att: Agent, def: Agent, tackle = true): void {
  if (tackle) {
    def.stats.tackles++;
    def.stats.tacklesWon++;
    s.teams[def.team].stats.tackles++;
    s.teams[def.team].stats.tacklesWon++;
  } else s.teams[att.team].stats.dispossessed++;
  if (r(s, def.idx, Purpose.Tackle, 3) < PR.tackleKeep) {
    // 빼앗은 공 (C.24): 수비수가 멀면 공이 수비수 쪽으로 튄다 (빼앗긴 선수는 다시 잡지 못한다)
    giveBall(s, def, 'gain', undefined, att.idx);
  } else {
    // 태클로 튄 공 (E.18 A4): 무작위 방향, 속도 6~12 m/s
    const ang = r(s, def.idx, Purpose.Tackle, 4) * Math.PI * 2;
    const [lo, hi] = ENGINE.restart.tackleBounce;
    const sp = lo + (hi - lo) * r(s, def.idx, Purpose.Tackle, 5);
    looseBall(s, att.x, att.y, Math.cos(ang) * sp, Math.sin(ang) * sp, def.team, def.idx);
  }
  att.cooldown = 0.6;
}

/** 돌파 후 커버 (E.22 A): 제쳐진 수비수 대신 (x, y)에 가장 가까운 동료 필드 선수(제쳐지지 않은)가 진행 방향을 막으러 간다 */
function callCover(s: SimState, beaten: Agent, x: number, y: number): void {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (o === beaten || !o.onPitch || o.team !== beaten.team || o.line === 0 || s.t < o.beatenUntil) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  if (!best) return;
  const tm = s.teams[beaten.team];
  tm.coverAgent = best.idx;
  tm.coverUntil = s.t + ENGINE.offball.coverTime;
  updateOffball(s, best);
}

/** 드리블 돌파 (E.8): 성공하면 수비수를 제치고 전진, 실패하면 태클 */
function dribble(s: SimState, a: Agent, c: Candidate): void {
  const def = s.agents[c.opponent!]!;
  a.stats.dribbles++;
  s.teams[a.team].stats.dribbles++;
  def.stats.dribblesFaced++;
  // 날씨 (C.74a): 눈·한파 드리블 실행 × dribble (판단의 P 는 그대로)
  // 상대 분석 (C.74c): 리포트 약점이면 × 약점 공략
  if (r(s, a.idx, Purpose.Dribble) < c.p * s.env.dribble * (s.rapport ? exploitMul(s, a, 'dribble') : 1)) {
    a.stats.dribblesWon++;
    def.stats.dribbledPast++;
    s.teams[a.team].stats.dribblesWon++;
    def.beatenUntil = s.t + PR.beatenTime;
    callCover(s, def, c.x, c.y);
    a.lastMoveT = s.t;
    a.dribbleT = s.t;
    a.tx = c.x;
    a.ty = c.y;
    a.urgent = true;
    a.cooldown = Math.max(ENGINE.onball.carryTime, reaction(a));
    // 제쳐진 수비수의 파울 (태클 실패). 1대1 경합에서 진 것도 태클 시도로 센다 (E.23 집계)
    def.stats.tackles++;
    s.teams[def.team].stats.tackles++;
    if (r(s, def.idx, Purpose.Foul, 1) < ENGINE.referee.tackleFoul * foulFactor(s, a, a.x, a.y, def)) foul(s, def, a, a.x, a.y);
    return;
  }
  tackleWon(s, a, def);
}

/** 버티기 (E.18 A2): 성공하면 1초 동안 공을 지킨다 (수비수 도전 실패 → 파울 판정), 실패하면 태클 */
function holdup(s: SimState, a: Agent, c: Candidate): void {
  const def = s.agents[c.opponent!]!;
  s.teams[a.team].stats.holdups++;
  if (r(s, a.idx, Purpose.Dribble, 5) < c.p) {
    s.teams[a.team].stats.holdupsWon++;
    a.tx = a.x;
    a.ty = a.y;
    a.urgent = false;
    a.cooldown = ENGINE.onball.holdupTime;
    a.backToGoal = true;
    def.beatenUntil = s.t + ENGINE.onball.holdupTime * 0.5;
    if (r(s, def.idx, Purpose.Foul, 6) < ENGINE.referee.tackleFoul * foulFactor(s, a, a.x, a.y, def)) foul(s, def, a, a.x, a.y);
    return;
  }
  tackleWon(s, a, def);
}

/** 수비 판단 품질 (E.23): 수비 포지셔닝 0.5 + 침착성 0.3 + 태클 0.2 */
export function defJudgement(d: Agent): number {
  const t = d.attrs;
  return (t.defensivePositioning * 0.5 + t.composure * 0.3 + t.tackling * 0.2) / 100 + (d.duelEdge > 0 ? ENGINE.match.homeJudgement : 0);
}

/** 수비수가 공 소유자 뒤(소유자의 골 반대쪽)에 있는가: 소유자 → 수비수 방향이 소유자의 공격 방향과 반대 */
function behindOwner(s: SimState, o: Agent, d: Agent): boolean {
  return (d.x - o.x) * attackDir(o.team, s.half) < -0.3;
}

/**
 * 수비수의 1대1 판단 (E.23): 공 소유자 duelRange m 안의 수비수는 판단 간격마다 태클 / 따라붙기 / 패스길 막기 중 하나를 고른다.
 * 태클 U = P × 탈취 가치 − (1 − P) × (돌파 허용 + 파울 비용), 따라붙기 U = jockeyFar/jockeyNear (지연: 동료가 돌아올 시간, 공이 우리 골에 가까우면 작다 — C.75c), 패스길 막기 U = laneW × 가장 위험한 패스 대상 가치 상승분 − 돌파 허용 위험.
 * P = 1 − 드리블 성공 (태클·수비 포지셔닝·마킹·속도 대 드리블), 뒤에서 하는 태클은 P × behindTackle, 파울 × behindFoul.
 * 공격 판단과 같은 효용 단위·softmax 온도 구조 (판단 = 수비 포지셔닝·침착성·태클)
 */
export function defendDuels(s: SimState): void {
  const o = s.agents[s.ball.owner];
  if (!o || o.line === 0) return;
  const D = ENGINE.defense;
  // 내 선수 결정 순간에서 고른 1대1 행동 (E.11): 그 선수만 고른 행동으로, 한 번만
  const forced = s.forcedDuel;
  s.forcedDuel = null;
  for (const d of s.agents) {
    if (!duelEligible(s, o, d)) continue;
    const judge = defJudgement(d);
    d.duelNext = s.t + D.duelInterval * (1.5 - judge);
    const odds = duelOdds(s, o, d);
    let pWin = odds.pWin;
    let pFoul = odds.pFoul;
    const us = odds.us;
    const tau = O_TEMP(judge) * (1 + ENGINE.onball.tiredTemp * tiredRatio(d));
    const mx = Math.max(...us);
    const ws = us.map((u) => Math.exp(((u - mx) * ENGINE.onball.utilityScale) / tau));
    let x = r(s, d.idx, Purpose.Tackle) * (ws[0]! + ws[1]! + ws[2]!);
    let pick = 2;
    for (let k = 0; k < 3; k++) {
      x -= ws[k]!;
      if (x <= 0) {
        pick = k;
        break;
      }
    }
    if (forced && forced.idx === d.idx) {
      pick = forced.pick;
      // 카드 (C.36): 태클 성공 %p·파울 배수, 전술적 파울(pick 3)
      if (forced.pDelta) pWin = clamp(pWin + forced.pDelta, 0.02, 0.98);
      if (forced.foulMul !== undefined && forced.foulMul !== 1) pFoul = clamp(pFoul * forced.foulMul, 0, 1);
      if (pick === 3) {
        tacticalFoul(s, d, o);
        return;
      }
    }
    if (pick === 2) {
      d.laneUntil = s.t + D.duelInterval;
      continue;
    }
    if (pick === 1) continue;
    // 태클 시도
    d.stats.tackles++;
    s.teams[d.team].stats.tackles++;
    s.teams[d.team].stats.tackleAttempts++;
    // 날씨 (C.74a): 젖은 잔디 슬라이딩 × tackle (판단의 pWin 은 그대로)
    if (r(s, d.idx, Purpose.Tackle, 1) < Math.min(0.98, pWin * s.env.tackle)) {
      d.stats.tackles--;
      s.teams[d.team].stats.tackles--;
      tackleWon(s, o, d);
      return;
    }
    d.beatenUntil = s.t + PR.beatenTime;
    callCover(s, d, o.x, o.y);
    if (r(s, d.idx, Purpose.Foul) < pFoul) {
      foul(s, d, o, o.x, o.y);
      return;
    }
  }
}

/** 전술적 파울 카드 (F.4): 90% 파울로 끊고 경고 70% (경고 누적이면 퇴장), 10% 놓쳐서 제쳐진다 */
function tacticalFoul(s: SimState, d: Agent, o: Agent): void {
  if (r(s, d.idx, Purpose.Cards, 1) >= 0.9) {
    d.beatenUntil = s.t + PR.beatenTime;
    callCover(s, d, o.x, o.y);
    return;
  }
  const y0 = d.stats.yellows;
  const red = d.stats.red;
  foul(s, d, o, o.x, o.y);
  if (d.onPitch && d.stats.yellows === y0 && !red && !s.pendingCards.some((c) => c.agent === d.idx) && r(s, d.idx, Purpose.Cards, 2) < 0.7) giveCard(s, d, 'yellow');
}

/**
 * 수비수 d 가 지금 소유자 o 와 1대1 판단을 하는가 (defendDuels 와 결정 순간이 같은 조건을 쓴다).
 * C.75c: 2 m 안이어도 압박자(공에 가장 가까운 필드 선수)·돌파 후 커버·역압박 첫째만 판단한다 (둘째는 커버)
 */
export function duelEligible(s: SimState, o: Agent, d: Agent): boolean {
  if (!d.onPitch || d.team === o.team || d.line === 0 || s.t < d.beatenUntil || s.t < d.duelNext) return false;
  if (dist(d.x, d.y, o.x, o.y) > ENGINE.defense.duelRange) return false;
  const tm = s.teams[d.team];
  if (tm.coverAgent === d.idx && s.t < tm.coverUntil) return true;
  if (tm.counterPressers[0] === d.idx && s.t < tm.counterUntil) return true;
  return ballRank(s, d, o.x, o.y) === 0;
}

/** 1대1 판단의 확률과 효용 [태클, 따라붙기, 패스길 막기] (E.23). beaten = 돌파 허용 비용 */
export function duelOdds(s: SimState, o: Agent, d: Agent): { pWin: number; pFoul: number; beaten: number; us: [number, number, number] } {
  const D = ENGINE.defense;
  const dirA = attackDir(o.team, s.half);
  const [ax, ay] = toNorm(o.x, o.y, dirA);
  const here = positionValue(ax, ay);
  const inBox = inOppBox(o.x, o.y, dirA);
  // 돌파 허용 비용: 소유자가 carryDist 앞으로 나간 자리 가치 − 지금 가치 (박스 안이면 슛 기회)
  const [nx2, ny2] = toNorm(clamp(o.x + dirA * ENGINE.onball.carryDist, 1, L - 1), o.y, dirA);
  const beaten = Math.max(0, positionValue(nx2, ny2) - here) + D.beatenBase;
  const behind = behindOwner(s, o, d);
  // 카드 패시브 (C.36, 내 선수만): 태클 성공 %p. 없으면 그대로
  const pWin = clamp((1 - dribbleProb(o, d, 0, fitPts(s, o.team, 'run') - fitPts(s, d.team, 'tackle'))) * (behind ? D.behindTackle : 1) + (d.cardBoost?.tackle ?? 0), 0.02, 0.98);
  const pFoul = clamp(ENGINE.referee.tackleFoul * (behind ? D.behindFoul : 1) * foulFactor(s, o, o.x, o.y, d), 0, 1);
  // 탈취 가치: 상대 공격 가치가 사라지고 우리 공격이 시작된다 (루즈볼이면 절반)
  const [dx, dy] = toNorm(o.x, o.y, attackDir(d.team, s.half));
  const gain = (here + positionValue(dx, dy)) * (PR.tackleKeep + (1 - PR.tackleKeep) * 0.5);
  const foulCost = inBox ? ENGINE.setPiece.penaltyBase - here : D.foulCost;
  const uTackle = pWin * gain - (1 - pWin) * (beaten + pFoul * foulCost);
  const lane = shadowValue(s, o, d) - here;
  const uLane = D.laneW * Math.max(0, lane) - D.laneRisk * beaten;
  const [dgx, dgy] = ownGoal(attackDir(d.team, s.half));
  const jockey = dist(o.x, o.y, dgx, dgy) < D.jockeyNearDist || inOwnBox(d.team, s.half, o.x, o.y) ? D.jockeyNear : D.jockeyFar;
  return { pWin, pFoul, beaten, us: [uTackle, jockey, uLane] };
}

/** 판단 온도 (onball 과 같은 식) */
function O_TEMP(j: number): number {
  const O = ENGINE.onball;
  return O.tempBase * Math.exp(O.tempSlope * (0.7 - j));
}

/** 소유자 팀의 가장 위험한 패스 대상(공보다 수비 골에 가까운 선수 중 위치 가치 최대)의 가치 */
function shadowValue(s: SimState, o: Agent, d: Agent): number {
  const dirA = attackDir(o.team, s.half);
  const [ox] = toNorm(o.x, o.y, dirA);
  let best = 0;
  for (const m of s.agents) {
    if (!m.onPitch || m.team !== o.team || m === o || m.line === 0) continue;
    const [mx, my] = toNorm(m.x, m.y, dirA);
    if (mx <= ox || dist(m.x, m.y, o.x, o.y) > ENGINE.onball.passMaxDist) continue;
    best = Math.max(best, positionValue(mx, my));
  }
  void d;
  return best;
}

// ── 슛 ──

/**
 * 슈팅 경로 (E.22 0번 측정, 판정에는 쓰지 않는다): 세트피스(코너·프리킥 소유 15초 안, PK) → 리바운드(같은 팀 슈팅 5초 안)
 * → 몰고 가기·돌파 후(3초 안. C.29: 드리블 돌파가 있었거나 받은 뒤 몰고 가기 2회 이상. 한 번 몰고 쏜 슛은 받은 경로) → 패스 받고
 * → 그 밖(루즈볼·가로채기로 얻은 공)
 */
function shotPath(s: SimState, a: Agent, penalty = false): number {
  if (penalty) return 4;
  const sp = s.t - s.possStartT < 15;
  if (sp && s.possOrigin === 'corner') return 2;
  if (sp && s.possOrigin === 'freeKick') return 3;
  if (s.t - s.lastShotT[a.team] < 5) return 5;
  if (s.t - a.lastMoveT < 3 && (s.t - a.dribbleT < 3 || a.carryN >= 2)) return 1;
  return a.gotBy === 'receive' ? 0 : 6;
}

function recordShot(s: SimState, a: Agent, penalty = false): void {
  a.shotPath = shotPath(s, a, penalty);
  s.teams[a.team].stats.shotPaths[a.shotPath]!++;
  s.lastShotT[a.team] = s.t;
}

/** inSpeed: 헤더면 들어온 크로스 공 속도 (m/s, C.77z 헤더 공 속도) */
export function shoot(s: SimState, a: Agent, header: boolean, inSpeed?: number): void {
  // 상대 슈팅 카드 장면 (C.40): 직접 모드에서 몸으로 막기 카드가 있으면 슛 전에 멈춘다 (결정 뒤 sim 이 같은 틱에 다시 부른다)
  if (s.cards && !header && oppShotMoment(s, a)) return;
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const m = shotModel(s, a, header);
  // 카드 (C.36): 내 슛 보정(유효 %p·선방·블록 배수), 상대 슛이면 내 몸으로 막기. 카드가 없으면 그대로
  const cm = s.cards ? shotCardMod(s, a) : null;
  if (cm) {
    m.pOn = clamp(m.pOn + cm.on, 0, 1);
    m.pBlock *= cm.blockMul;
  }
  const bb = s.cards ? blockCardBonus(s, a) : null;
  if (bb) m.pBlock = Math.min(1, m.pBlock + bb.value);
  const team = s.teams[a.team];
  recordShot(s, a);
  a.stats.shots++;
  team.stats.shots++;
  const lp = s.lastPass;
  if (lp && lp.receiver === a.idx && lp.t >= s.possSince) {
    s.agents[lp.passer]!.stats.keyPasses++;
    team.stats.keyPasses++;
    if (m.xg >= ENGINE.record.bigChanceXg) s.agents[lp.passer]!.stats.bigChances++;
  }
  if (s.possOrigin === 'open' && s.t - s.possStartT < 10) team.stats.counterShots++;
  if (s.possOrigin === 'goalKick' && s.t - s.possStartT < 15) team.stats.goalKickShots++;
  if (Math.abs(a.y - W / 2) <= G / 2) team.stats.centralShots++;
  a.cooldown = 1;
  s.ball.lastTouch = a.idx;
  s.ball.lastTeam = a.team;
  s.lastWasShot = true;
  s.exemptPass = false;

  // 약발 (C.45): 헤더가 아니면 유효 슈팅 확률 × 약발 배율 (골 방향이 약발 쪽일 때)
  // 약발 (C.78h laneSide): 찰 쪽 구석으로 차는 발 (판단 shotModel 과 같은 쪽·같은 기대 구석). 끄면 골 가운데 방향 (옛 동작)
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const side = m.side || (farSide(gk, gy) ?? (r(s, a.idx, Purpose.Shot, 1) < 0.5 ? -1 : 1));
  // 약발 (C.79q): 몸 방향 기준 발, 시간이 있으면 주발로 옮겨 찬다 (판단 shotModel 과 같은 함수·같은 급함)
  const footY = (PR.laneSide > 0 ? gy + side * m.ctx.corner * (G / 2 - 0.3) : gy) - a.y;
  const rush = shotRush(s, a, m.pressure);
  const ot = shotOneTouch(s, a);
  const foot = header ? 1 : shotFootMul(a.body, a.hx, a.hy, gx - a.x, footY, rush, ot);
  // 진단 기록용 약발 몫 (C.79q, 블록 포함)
  const pm = probe.shot ? { ...m, ...(header ? {} : { weak: shotWeakShare(a.body, a.hx, a.hy, gx - a.x, footY, rush, ot), rush }) } : m;
  // 블록
  if (r(s, a.idx, Purpose.Block) < m.pBlock) {
    if (probe.shot) probeShot(s, a, header ? 'header' : 'foot', 'block', pm, gx, m.side ? m.ctx.ty : gy, m.speed);
    const blocker = bb ? bb.me : s.agents.filter((o) => o.onPitch && o.team !== a.team && o.line !== 0)
      .sort((x, y) => dist(x.x, x.y, a.x, a.y) - dist(y.x, y.y, a.x, a.y))[0];
    event(s, 'block', a.team, [a.id, blocker?.id ?? '']);
    if (blocker) blocker.stats.blocks++;
    const defTeam = (1 - a.team) as 0 | 1;
    if (r(s, a.idx, Purpose.Block, 1) < PR.blockCorner) {
      s.teams[a.team].stats.corners++;
      setRestart(s, 'corner', a.team, gx, a.y < W / 2 ? 0 : W, 'auto');
      return;
    }
    const ang = r(s, a.idx, Purpose.Block, 2) * Math.PI * 2;
    looseBall(s, a.x + dir * 1.5, a.y, Math.cos(ang) * 6, Math.sin(ang) * 6, defTeam, blocker?.idx ?? -1);
    return;
  }

  // 상대 분석 (C.74c): 슈팅이 리포트 약점이면 유효 슈팅 × 약점 공략
  const onTarget = r(s, a.idx, Purpose.Shot) < m.pOn * foot * (s.rapport ? exploitMul(s, a, 'shoot') : 1);
  // GK 반대편 구석 (C.77t): GK 가 골대 가운데에서 비켜 있으면 먼 쪽을 노린다 (판단용 shotModel 과 같은 규칙) — 위에서 정함 (C.78h: 두 슛 길이 다르면 shotModel 이 고른 쪽)
  // 헤더 공 속도 (C.77z, timeModel 1): 크로스가 빠를수록 빠르다 (능력치 무관)
  const base = header && K.timeModel && inSpeed ? m.speed * clamp(1 + K.headerCrossW * (inSpeed / ENGINE.ball.airSpeed - 1), 0.8, 1.2) : m.speed;
  const speed = base * (0.9 + 0.2 * r(s, a.idx, Purpose.Shot, 2));
  if (onTarget) {
    team.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    // 구석일수록 막기 어렵다. 능력치가 높으면 구석으로
    // 구석은 능력치와 무관 (마무리 능력은 마무리 배수 한 곳에서, E.20 7번). 쫓기며 쏘면 구석을 못 노린다 (C.76k, 압박 × cornerPressure)
    const corner = clamp(r(s, a.idx, Purpose.Shot, 3) * PR.cornerRange, 0, 1) * (1 - PR.cornerPressure * m.pressure);
    const ty = gy + side * corner * (G / 2 - 0.3);
    // 슛 1건 자료 (C.77z): 판단 자료(m.ctx)에 실제 값(뽑은 구석·공 속도, 상대 GK 위치·속도·능력·키)을 넣어 같은 식(saveChance)으로 판정한다
    const ctx: ShotCtx = { ...m.ctx, ty, corner, speed, ...gkCtx(gk), lead: 0, screen: m.screens[side < 0 ? 0 : 1] > 0 ? 1 : 0 };
    const shot = { speed, corner, d: m.d, header, ctx, ...(cm?.save ? { cardSave: cm.save } : {}) };
    if (probe.shot) probeShot(s, a, header ? 'header' : 'foot', 'onTarget', pm, gx, ty, speed, shot);
    shotFlight(s, a, {
      kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: ty, t0: s.t, dur: Math.max(0.15, m.d / speed), air: header,
      passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot,
    });
    event(s, 'shot', a.team, [a.id], { onTarget: 1, xg: Math.round(m.xg * 100) / 100, d: Math.round(m.d) });
    return;
  }
  // 빗나감: 골라인 밖으로 → 골킥
  const missY = gy + side * (G / 2 + 0.5 + r(s, a.idx, Purpose.Shot, 4) * 6);
  if (probe.shot) probeShot(s, a, header ? 'header' : 'foot', 'miss', pm, gx + dir * 3, missY, speed);
  s.ball.owner = -1;
  s.ball.reserve = null;
  s.ball.flight = {
    kind: 'shot', fromX: a.x, fromY: a.y, toX: gx + dir * 3, toY: missY, t0: s.t, dur: Math.max(0.15, (m.d + 3) / speed), air: true,
    passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1,
  };
  event(s, 'shot', a.team, [a.id], { onTarget: 0, xg: Math.round(m.xg * 100) / 100, d: Math.round(m.d) });
}

/**
 * 유효 슈팅 비행 (C.24): 1단계는 슈팅 길에서 GK 에 가장 가까운 점까지 (거기서 세이브 판정), 세이브 실패면 2단계로 골라인까지.
 * 슈팅 순간 GK 는 1단계 도착점으로 몸을 날린다 (긴급 이동). 그 점이 골라인 가까이거나 슈터 뒤면 한 단계
 */
function shotFlight(s: SimState, a: Agent, fl: Flight): void {
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const sh = fl.shot!;
  const ux = fl.toX - fl.fromX;
  const uy = fl.toY - fl.fromY;
  const len2 = ux * ux + uy * uy;
  const k = gk && len2 > 1 ? ((gk.x - fl.fromX) * ux + (gk.y - fl.fromY) * uy) / len2 : 1;
  // GK 도달 항 (C.77t): 몸을 날리기 전, 슛 순간 GK 위치로 잰다 (C.77z: 슛 1건 자료 그대로)
  if (!sh.penalty && sh.ctx) sh.cover = coverOf(sh.ctx);
  if (gk && !sh.penalty && k > 0.05 && k < 1 - 0.3 / Math.sqrt(len2)) {
    sh.goalX = fl.toX;
    sh.goalY = fl.toY;
    sh.rest = fl.dur * (1 - k);
    fl.toX = fl.fromX + (fl.toX - fl.fromX) * k;
    fl.toY = fl.fromY + (fl.toY - fl.fromY) * k;
    fl.dur *= k;
  }
  const b = s.ball;
  b.owner = -1;
  b.reserve = null;
  b.flight = fl;
  if (gk && !sh.penalty) {
    gk.tx = fl.toX;
    gk.ty = fl.toY;
    gk.urgent = true;
  }
}

/** 유효 슈팅 도착: GK 세이브 판정 (E.9) */
function shotArrives(s: SimState, fl: Flight): void {
  const shooter = s.agents[fl.passer]!;
  const defTeam = (1 - shooter.team) as 0 | 1;
  const gk = keeperOf(s, defTeam);
  const sh = fl.shot!;
  const dir = attackDir(shooter.team, s.half);
  // 날씨 (C.74a): 빗속 중거리 슛은 위력↑ (선방 × longShotSave)
  // GK 도달 항 (C.77t): 슛 순간 GK 가 슛 선에서 멀면 선방 × cover
  // C.77z: 판단과 같은 식 saveChance(슛 순간 자료 — 막기 어려움 × 덮는 정도)
  const pSave = (sh.ctx ? saveChance(sh.ctx) : saveProb(gk, sh.speed, sh.corner, sh.d, sh.header) * (sh.cover ?? 1)) * (!sh.header && !sh.penalty && sh.d >= LONG_SHOT_FROM ? s.env.longShotSave : 1);
  // 선방률 지표 (C.76q, 미해결 6): 12 m 밖 유효 슈팅만 따로 센다 (1대1·PK 제외)
  const far = !sh.penalty && sh.d >= FAR_SAVE_FROM;
  const bin = far ? (sh.d >= FAR_BIN_D[1]! ? 2 : sh.d >= FAR_BIN_D[0]! ? 1 : 0) * 2 + ((sh.cover ?? 1) >= FAR_BIN_SET ? 0 : 1) : -1;
  if (far) {
    s.teams[shooter.team].stats.farOnTarget++;
    s.teams[shooter.team].stats.farBinOn[bin]!++;
  }
  if (!sh.penalty && r(s, shooter.idx, Purpose.Save) < (sh.cardSave ? clamp(pSave + sh.cardSave, 0.02, 0.98) : pSave)) {
    s.teams[defTeam].stats.saves++;
    if (probe.shot) probeShotEnd(sh, 'save');
    if (far) {
      s.teams[shooter.team].stats.farSaves++;
      s.teams[shooter.team].stats.farBinSaves[bin]!++;
    }
    if (gk) gk.stats.saves++;
    event(s, 'save', defTeam, [gk?.id ?? '', shooter.id]);
    // 날씨 (C.74a): 젖은 공 캐치 × gkCatch (놓치면 쳐내기·리바운드)
    if (gk && r(s, shooter.idx, Purpose.Save, 1) < catchProb(gk) * s.env.gkCatch) {
      // 캐치 (C.24): GK 는 몸을 날린 자리 그대로, 공이 GK 에게 (멀면 굴러서) 간다
      giveBall(s, gk, 'claim', undefined, shooter.idx);
      return;
    }
    // 쳐내기: 코너 또는 리바운드
    if (r(s, shooter.idx, Purpose.Save, 2) < K.parryCorner) {
      s.teams[shooter.team].stats.corners++;
      setRestart(s, 'corner', shooter.team, dir > 0 ? L : 0, s.ball.y < W / 2 ? 0 : W, 'auto');
      return;
    }
    const ang = (r(s, shooter.idx, Purpose.Save, 3) - 0.5) * 2.4;
    looseBall(s, s.ball.x - dir * 1, s.ball.y, -dir * Math.cos(ang) * 7, Math.sin(ang) * 7, defTeam, gk?.idx ?? -1);
    // 쳐낸 공은 잠깐 다시 손으로 못 잡는다 (C.28): 그 뒤에는 루즈볼 추격으로 다시 잡으러 간다
    if (gk) s.ball.handBlock = { idx: gk.idx, until: s.t + K.handBlock };
    return;
  }
  // 세이브 실패: 2단계 비행으로 골라인까지 (C.24)
  if (sh.goalX !== undefined && sh.goalY !== undefined) {
    s.ball.flight = { ...fl, fromX: s.ball.x, fromY: s.ball.y, toX: sh.goalX, toY: sh.goalY, t0: s.t, dur: Math.max(0.05, sh.rest ?? 0.1), outcome: 'goal' };
    return;
  }
  if (probe.shot) probeShotEnd(sh, 'goal');
  goal(s, shooter);
}

function goal(s: SimState, scorer: Agent): void {
  const team = s.teams[scorer.team];
  team.stats.goals++;
  team.stats.goalPaths[scorer.shotPath]!++;
  scorer.stats.goals++;
  const lp = s.lastPass;
  let assist: Agent | null = null;
  if (lp && lp.receiver === scorer.idx && lp.t >= s.possSince && s.t - lp.t < 15) {
    assist = s.agents[lp.passer]!;
    assist.stats.assists++;
  }
  event(s, 'goal', scorer.team, assist ? [scorer.id, assist.id] : [scorer.id], {
    home: s.teams[0].stats.goals, away: s.teams[1].stats.goals,
  });
  s.lastPass = null;
  for (const o of s.agents) if (o.onPitch && o.team !== scorer.team) o.rt.conceded++;
  setRestart(s, 'kickoff', (1 - scorer.team) as 0 | 1, L / 2, W / 2, 'auto');
  celebration(s, scorer);
}

/**
 * 골 세리머니 (C.24): 득점자는 가까운 코너 쪽으로 8~12 m, 가까운 동료 3~5명이 함께한다. 세리머니 길이 15~20초.
 * 이동은 offball 의 재개 분기가 맡는다 (긴급하지 않은 조깅·걷기)
 */
function celebration(s: SimState, scorer: Agent): void {
  const R = ENGINE.restart;
  const u = (k: number): number => rand(s.seed, s.tick, scorer.idx, Purpose.Restart, 20 + k);
  const dir = attackDir(scorer.team, s.half);
  const [gx] = oppGoal(dir);
  const cy = scorer.y < W / 2 ? 0 : W;
  const d = dist(scorer.x, scorer.y, gx, cy) || 1;
  const run = Math.min(R.celebrateRun[0] + (R.celebrateRun[1] - R.celebrateRun[0]) * u(0), Math.max(0, d - 3));
  const nJoin = R.celebrateJoin[0] + Math.floor(u(1) * (R.celebrateJoin[1] - R.celebrateJoin[0] + 1));
  const joiners = s.agents
    .filter((o) => o.onPitch && o.team === scorer.team && o !== scorer && o.line !== 0)
    .sort((x, y) => dist(x.x, x.y, scorer.x, scorer.y) - dist(y.x, y.y, scorer.x, scorer.y))
    .slice(0, nJoin)
    .map((o) => o.idx);
  s.restart!.goal = {
    scorer: scorer.idx, t: s.t, until: s.t + R.celebrate[0] + (R.celebrate[1] - R.celebrate[0]) * u(2),
    cx: clamp(scorer.x + ((gx - scorer.x) / d) * run, 2, L - 2), cy: clamp(scorer.y + ((cy - scorer.y) / d) * run, 2, W - 2), joiners,
  };
  for (const o of s.agents) if (o.onPitch) updateOffball(s, o);
}

// ── 크로스, 롱볼, 공중볼 ──

/** 측정용 (E.22 B): 크로스·컷백 순간 상대 박스 안 우리 선수 수 */
function countBox(s: SimState, a: Agent): void {
  const dir = attackDir(a.team, s.half);
  let n = 0;
  for (const o of s.agents) if (o.onPitch && o.team === a.team && o !== a && inOppBox(o.x, o.y, dir)) n++;
  s.teams[a.team].stats.boxAtCross += n;
  s.teams[a.team].stats.boxCrossN++;
}

function cross(s: SimState, a: Agent, c: Candidate): void {
  const t = s.teams[a.team];
  a.stats.passes++;
  t.stats.passes++;
  t.stats.crosses++;
  a.stats.crosses++;
  if (s.t > s.possStartT) countBox(s, a);
  const target = s.agents[c.receiver];
  const exempt = s.exemptPass;
  s.exemptPass = false;
  if (target && !exempt && isOffside(s, a, target)) {
    callOffside(s, a, target);
    return;
  }
  const [, nd] = nearestOppOf(s, a);
  if (nd < 2.5 && r(s, a.idx, Purpose.Cross, 2) < PR.crossBlockCorner) {
    t.stats.corners++;
    const dir = attackDir(a.team, s.half);
    setRestart(s, 'corner', a.team, dir > 0 ? L : 0, a.y < W / 2 ? 0 : W, 'auto');
    return;
  }
  // 약발 (C.45): 크로스 오차 ÷ 약발 배율
  // 날씨 (C.74a): 강풍 크로스 오차 × longError
  const err = (((100 - a.attrs.crossing) * PR.crossError) / weakFootMul(a.body, attackDir(a.team, s.half), c.x - a.x, c.y - a.y)) * s.env.longError;
  const tx = clamp(c.x + randn(s.seed, s.tick, a.idx, Purpose.Cross, 0) * err, 0.5, L - 0.5);
  const ty = clamp(c.y + randn(s.seed, s.tick, a.idx, Purpose.Cross, 1) * err, 0.5, W - 0.5);
  const d = dist(a.x, a.y, tx, ty);
  launch(s, a, {
    kind: 'cross', fromX: a.x, fromY: a.y, toX: tx, toY: ty, t0: s.t, dur: Math.max(0.4, d / ENGINE.ball.airSpeed), air: true,
    passer: a.idx, receiver: c.receiver, outcome: 'aerial', interceptor: -1, fromCross: true,
    ...(s.cards && a.spec.isMe && crossCardEdge(s, a) ? { cardEdge: crossCardEdge(s, a) } : {}),
  });
  // 헤더 경합 (E.22 B): 대상과 착지점에 가장 가까운 수비 필드 선수가 바로 뛰어든다
  if (target?.onPitch) updateOffball(s, target);
  let def: Agent | null = null;
  let dd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const od = dist(o.x, o.y, tx, ty);
    if (od < dd) {
      dd = od;
      def = o;
    }
  }
  if (def) updateOffball(s, def);
}

/** 걷어내기 집계 (C.30 기록): 위험 지역(자기 박스·박스 앞)이면 따로 센다 */
function countClearance(s: SimState, a: Agent, x: number, y: number): void {
  a.stats.clearances++;
  if (inOwnDanger(x, y, attackDir(a.team, s.half))) a.stats.dangerClearances++;
}

export function longBall(s: SimState, a: Agent, x0: number, y0: number, kind: 'clear' | 'long'): void {
  s.exemptPass = false;
  let x = x0;
  let y = y0;
  if (kind === 'clear') {
    // 클리어링 방향 산포 σ (E.18 A4)
    const ang = randn(s.seed, s.tick, a.idx, Purpose.Clear, 2) * ((ENGINE.restart.clearSpreadDeg * Math.PI) / 180);
    const dx = x0 - a.x;
    const dy = y0 - a.y;
    x = a.x + dx * Math.cos(ang) - dy * Math.sin(ang);
    y = a.y + dx * Math.sin(ang) + dy * Math.cos(ang);
  }
  // 약발 (C.45): 롱볼 오차 ÷ 약발 배율 (걷어내기는 그대로)
  // 날씨 (C.74a): 강풍 롱볼·걷어내기 오차 × longError
  const err = (((100 - a.attrs.longPassing) * 0.08 + 2) / (kind === 'long' ? weakFootMul(a.body, attackDir(a.team, s.half), x - a.x, y - a.y) : 1)) * s.env.longError;
  const tx = clamp(x + randn(s.seed, s.tick, a.idx, Purpose.Clear, 0) * err, -1, L + 1);
  const ty = clamp(y + randn(s.seed, s.tick, a.idx, Purpose.Clear, 1) * err, -1, W + 1);
  const d = dist(a.x, a.y, tx, ty);
  launch(s, a, {
    kind, fromX: a.x, fromY: a.y, toX: tx, toY: ty, t0: s.t, dur: Math.max(0.5, d / ENGINE.ball.airSpeed), air: true,
    passer: a.idx, receiver: -1, outcome: 'aerial', interceptor: -1,
  });
}

/** 착지점 공중볼 (E.8): GK 처리 → 양 팀 최고 점수 선수 경합 → 이긴 쪽 헤더/컨트롤/걷어내기 */
function resolveAerial(s: SimState, fl: Flight): void {
  const b = s.ball;
  const passer = s.agents[fl.passer]!;
  const att = passer.team;
  const def = (1 - att) as 0 | 1;
  const dirAtt = attackDir(att, s.half);
  const R = PR.aerialRadius;

  if (b.x < 0 || b.x > L || b.y < 0 || b.y > W) return; // 라인 밖: ballOut 이 처리

  const gk = keeperOf(s, def);
  if (gk && inOppBox(b.x, b.y, dirAtt) && dist(gk.x, gk.y, b.x, b.y) < K.claimRange) {
    if (r(s, gk.idx, Purpose.Keeper) < claimProb(gk)) {
      giveBall(s, gk, 'claim');
      return;
    }
  }
  let bestA: Agent | null = null;
  let bestD: Agent | null = null;
  let nA = 0;
  let nD = 0;
  for (const a of s.agents) {
    if (!a.onPitch || a.line === 0) continue;
    const d = dist(a.x, a.y, b.x, b.y);
    if (d <= PR.aerialCrowdR) {
      if (a.team === att) nA++;
      else nD++;
    }
    if (d > R) continue;
    if (a.team === att) {
      if (!bestA || aerialScore(a) > aerialScore(bestA)) bestA = a;
    } else if (!bestD || aerialScore(a) > aerialScore(bestD)) bestD = a;
  }
  if (!bestA && !bestD) {
    // 측면에서 튄 공은 바깥쪽으로 (E.18 A4)
    const out = Math.abs(b.y - W / 2) > W / 4 ? Math.sign(b.y - W / 2) * ENGINE.restart.wideBias : 0;
    looseBall(s, b.x, b.y, (fl.toX - fl.fromX) * 0.05, (fl.toY - fl.fromY) * 0.05 + out, att, passer.idx);
    return;
  }
  let winner: Agent;
  if (bestA && bestD) {
    s.teams[0].stats.aerials++;
    s.teams[1].stats.aerials++;
    bestA.stats.aerialDuels++;
    bestD.stats.aerialDuels++;
    if (r(s, bestA.idx, Purpose.Foul, 2) < ENGINE.referee.aerialFoul * foulFactor(s, bestA, b.x, b.y)) {
      // 공중볼 몸싸움 파울: 대부분 수비 쪽 파울
      const defFoul = r(s, bestA.idx, Purpose.Foul, 3) < 0.7;
      foul(s, defFoul ? bestD : bestA, defFoul ? bestA : bestD, b.x, b.y);
      return;
    }
    // 밀집 (C.78d ①): 크로스 착지점 aerialCrowdR m 안 수비가 공격보다 많으면 한 명마다 로짓 −aerialCrowd (둘째 수비가 헤더를 방해·먼저 닿음)
    const crowd = fl.fromCross ? PR.aerialCrowd * Math.max(0, nD - nA) : 0;
    // 전술 적합도 (C.80e): 크로스가 아닌 공중볼(롱볼·걷어낸 공) 경합에 직선 air 보너스
    const fitAir = fl.fromCross ? 0 : fitPts(s, bestA.team, 'air') - fitPts(s, bestD.team, 'air');
    const pA0 = duelTail(1 / (1 + Math.exp(-((aerialScore(bestA) - aerialScore(bestD) + fitAir) / PR.aerialScale + (fl.fromCross ? PR.aerialAttackBonus : 0) - crowd + duelEdgeOf(bestA) - duelEdgeOf(bestD)))));
    // 카드 (C.36): 크로스 보정(라보나·얼리 크로스) + 내 선수 공중볼(공중 장악·헤더 카드). 카드가 없으면 그대로
    const edge = s.cards ? (fl.cardEdge ?? 0) + airCardEdge(s, bestA, true, !!fl.fromCross) - airCardEdge(s, bestD, false, !!fl.fromCross) : 0;
    // 날씨 (C.74a): 강풍 크로스는 공격 쪽 경합 × crossWin
    // 상대 분석 (C.74c): 내 크로스(cross) · 내가 공격 쪽인 공중볼(header)이 리포트 약점이면 × 약점 공략
    const pass = s.rapport ? s.agents[fl.passer] : undefined;
    const ex = s.rapport ? Math.max(fl.fromCross && pass ? exploitMul(s, pass, 'cross') : 1, exploitMul(s, bestA, 'header')) : 1;
    const pA1 = (edge ? clamp(pA0 + edge, 0.02, 0.98) : pA0) * (fl.fromCross ? s.env.crossWin : 1);
    const pA = ex !== 1 ? Math.min(0.98, pA1 * ex) : pA1;
    winner = r(s, bestA.idx, Purpose.Aerial) < pA ? bestA : bestD;
    winner.stats.aerialsWon++;
  } else winner = (bestA ?? bestD)!;

  if (winner.team === att) {
    winner.gotBy = 'receive';
    winner.lastMoveT = -100;
    winner.carryN = 0;
    winner.dribbleT = -100;
    if (fl.fromCross) {
      s.teams[att].stats.crossesCompleted++;
      passer.stats.crossesCompleted++;
      winner.stats.received++;
      passer.stats.passesCompleted++;
      s.teams[att].stats.passesCompleted++;
      s.lastPass = { passer: passer.idx, receiver: winner.idx, t: s.t };
    }
    const [gx, gy] = oppGoal(dirAtt);
    if (inOppBox(b.x, b.y, dirAtt) && dist(b.x, b.y, gx, gy) < PR.headerMaxDist) {
      // 헤더는 공이 있는 자리에서 (판정은 착지점 기준, 선수는 옮기지 않는다, C.24)
      const [wx, wy] = [winner.x, winner.y];
      winner.x = b.x;
      winner.y = b.y;
      shoot(s, winner, true, Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY) / Math.max(0.05, fl.dur));
      winner.x = wx;
      winner.y = wy;
      return;
    }
    giveBall(s, winner, 'win');
    return;
  }
  // 수비가 이김: 헤더 걷어내기 (가끔 코너)
  const dirDef = attackDir(def, s.half);
  if (fl.fromCross && r(s, winner.idx, Purpose.Header) < PR.clearCorner) {
    countClearance(s, winner, b.x, b.y);
    s.teams[att].stats.corners++;
    setRestart(s, 'corner', att, dirAtt > 0 ? L : 0, b.y < W / 2 ? 0 : W, 'auto');
    return;
  }
  if (!fl.fromCross && r(s, winner.idx, Purpose.Header, 2) < 0.4) {
    giveBall(s, winner, 'gain');
    return;
  }
  countClearance(s, winner, b.x, b.y);
  const [lo, hi] = PR.clearDist;
  const len = lo + (hi - lo) * r(s, winner.idx, Purpose.Header, 1);
  // 걷어내기 방향 산포 σ (E.18 A4). 측면 경합이면 바깥쪽 편향
  const wideOut = Math.abs(b.y - W / 2) > W / 4 ? Math.sign(b.y - W / 2) * dirDef * 0.3 : 0;
  const ang = randn(s.seed, s.tick, winner.idx, Purpose.Header, 3) * ((ENGINE.restart.clearSpreadDeg * Math.PI) / 180) + wideOut;
  looseBall(s, b.x, b.y, 0, 0, def, winner.idx);
  s.ball.flight = {
    kind: 'clear', fromX: b.x, fromY: b.y, toX: b.x + dirDef * Math.cos(ang) * len, toY: clamp(b.y + Math.sin(ang) * len, -2, W + 2),
    t0: s.t, dur: len / 16, air: true, passer: winner.idx, receiver: -1, outcome: 'loose', interceptor: -1,
  };
}

/**
 * 깊은 블록 비행 중 가로채기 판정 (C.76p 44h-c 가설 1): 오프볼이 패스 선에 보낸 선수(tm.cutIdx) 옆 offball.deepCutRadius m 안을
 * 공이 이 틱에 지났으면(이전 위치 (px, py) → 지금 위치 선분) 한 비행에 1회 deepCutP × 능력 배율로 가로챈다. 성공하면 true
 */
export function deepCut(s: SimState, px: number, py: number): boolean {
  const b = s.ball;
  const fl = b.flight;
  if (!fl || fl.outcome !== 'receive') return false;
  const O = ENGINE.offball;
  for (const tm of s.teams) {
    if (tm.cutFlight !== fl || tm.cutIdx < 0) continue;
    const a = s.agents[tm.cutIdx];
    if (!a || !a.onPitch) {
      tm.cutIdx = -1;
      continue;
    }
    if (segDist(a.x, a.y, px, py, b.x, b.y)[0] > O.deepCutRadius) continue;
    // 판정은 한 비행에 1회: cutFlight 는 남기고 cutIdx 만 −1 (오프볼이 같은 비행에 다시 보내지 않게)
    tm.cutIdx = -1;
    const p = O.deepCutP * (1 + (O.deepCutSkill * (a.attrs.interception - 60)) / 100);
    if (r(s, a.idx, Purpose.Intercept, 2) < p) {
      giveBall(s, a, 'intercept');
      return true;
    }
  }
  return false;
}

/** 비행 중인 공 갱신과 도착 처리 */
export function resolveFlight(s: SimState): void {
  const b = s.ball;
  const fl = b.flight!;
  const k = clamp((s.t - fl.t0) / fl.dur, 0, 1);
  b.x = fl.fromX + (fl.toX - fl.fromX) * k;
  b.y = fl.fromY + (fl.toY - fl.fromY) * k;
  b.z = fl.air ? Math.sin(Math.PI * k) * (fl.kind === 'shot' ? 1.2 : 4) : 0;
  if (k < 1) return;
  b.flight = null;
  b.z = 0;
  const passer = s.agents[fl.passer]!;
  switch (fl.outcome) {
    case 'shot':
      shotArrives(s, fl);
      return;
    case 'goal':
      if (probe.shot) probeShotEnd(fl.shot, 'goal');
      goal(s, passer);
      return;
    case 'aerial':
      resolveAerial(s, fl);
      return;
    case 'receive': {
      const rc = s.agents[fl.receiver]!;
      if (rc.onPitch && dist(rc.x, rc.y, b.x, b.y) < 4) {
        // 롱볼은 착지점에서 수비수와 경합
        if (fl.air) {
          const [def, dd] = nearestOppOf(s, rc);
          // 먼 경합 (C.80g ②-2): longContest 밖 airContestFar 안 수비수는 늦게 닿아 받는 쪽 보정 airContestBias
          if (def && dd < PR.longContest + PR.airContestFar) {
            s.teams[0].stats.aerials++;
            s.teams[1].stats.aerials++;
            rc.stats.aerialDuels++;
            def.stats.aerialDuels++;
            if (r(s, rc.idx, Purpose.Aerial, 1) >= aerialWin(rc, def, fitPts(s, rc.team, 'air') - fitPts(s, def.team, 'air'), dd < PR.longContest ? 0 : PR.airContestBias)) {
              def.stats.aerialsWon++;
              giveBall(s, def, 'gain');
              return;
            }
            rc.stats.aerialsWon++;
          }
        } else {
          // 박스 안 땅볼 패스 수신 경합 (C.29 fix2 가설 B): contestDist 안 수비수가 있으면 받는 선수와 듀얼. 지면 수비 소유(tackleKeep) 또는 루즈볼
          // 박스 밖 땅볼 롱패스 (C.80g ②-1): contestOutFrom m 이상이면 contestOutDist 안 수비수와 같은 경합. 전환 창 패스(fl.transition)는 면제
          const inBox = inOppBox(b.x, b.y, attackDir(rc.team, s.half));
          const cd = inBox ? PR.contestDist : PR.contestOut > 0 && !fl.transition && dist(fl.fromX, fl.fromY, fl.toX, fl.toY) >= PR.contestOutFrom ? PR.contestOutDist : 0;
          const [def, dd] = cd > 0 ? nearestOppOf(s, rc) : [null, Infinity];
          if (def && dd < cd && r(s, rc.idx, Purpose.Control, 3) >= receiveWin(rc, def)) {
            def.stats.tackles++;
            def.stats.tacklesWon++;
            s.teams[def.team].stats.tackles++;
            s.teams[def.team].stats.tacklesWon++;
            if (r(s, rc.idx, Purpose.Control, 4) < PR.tackleKeep) {
              giveBall(s, def, 'gain');
              return;
            }
            const ang = r(s, rc.idx, Purpose.Control, 5) * Math.PI * 2;
            looseBall(s, b.x, b.y, Math.cos(ang) * 4, Math.sin(ang) * 4, def.team, def.idx);
            return;
          }
        }
        giveBall(s, rc, 'receive', fl);
        return;
      }
      break;
    }
    case 'intercept': {
      const rc = s.agents[fl.interceptor]!;
      if (rc.onPitch) {
        giveBall(s, rc, 'intercept');
        return;
      }
      break;
    }
  }
  // 벽·GK 에 맞고 튄 공 (C.24)
  if (fl.after) {
    b.vx = fl.after.vx;
    b.vy = fl.after.vy;
    b.lastTeam = fl.after.team;
    b.lastTouch = fl.after.touch;
    return;
  }
  // 루즈볼: 진행 방향으로 굴러간다. 땅볼은 남은 속도 그대로, 공중볼은 튀면서 일부만 (E.18 A4 빗나간 패스)
  [b.vx, b.vy] = landingVelocity(fl);
}

/**
 * 공을 선수에게 (C.24): snapReceive m 안이면 바로 소유, 그 밖이면 선수를 옮기지 않고 공을 그 선수 쪽으로 굴린다
 * (reserveRoll m/s, 그 선수는 컨트롤 판정 없이 잡는다. 받기 집계는 실제로 잡는 순간, ballReserved)
 */
function giveBall(s: SimState, a: Agent, kind: BallReserve['kind'], fl?: Flight, from = -1): void {
  const b = s.ball;
  const res: BallReserve = { idx: a.idx, until: s.t + B.reserveTime, kind, from, ...(fl ? { fl } : {}) };
  const d = dist(a.x, a.y, b.x, b.y);
  // 침투 패스를 달리며 받기 (C.78b receive.runOn): 공과 나란히 달려 runSnap m 안이면 굴려 보내지 않고 바로 받는다 (멈춰 공을 기다리지 않게)
  if (d <= B.snapReceive || (fl?.through && ENGINE.receive.runOn > 0 && d <= ENGINE.receive.runSnap && Math.hypot(a.vx, a.vy) >= 3)) {
    caught(s, a, res);
    return;
  }
  const [lo, hi] = B.reserveRoll;
  const sp = lo + (hi - lo) * clamp((d - B.snapReceive) / 3, 0, 1);
  b.owner = -1;
  b.flight = null;
  b.z = 0;
  b.vx = ((a.x - b.x) / d) * sp;
  b.vy = ((a.y - b.y) / d) * sp;
  b.reserve = res;
  a.tx = b.x;
  a.ty = b.y;
  a.tvx = a.tvy = 0;
  a.tvIdx = -1;
  a.urgent = true;
}

/** 굴러간 공을 받기로 한 선수가 잡았다 (C.24): 소유와 받기 종류별 집계 */
export function caught(s: SimState, a: Agent, res: BallReserve): void {
  const b = s.ball;
  setOwner(s, a);
  switch (res.kind) {
    case 'claim':
      a.cooldown = K.holdTime;
      return;
    case 'intercept':
      a.stats.interceptions++;
      s.teams[a.team].stats.interceptions++;
      return;
    case 'win':
      a.gotBy = 'receive';
      a.carryN = 0;
      // C.78e: 받는 틱에 공을 받은 선수 발밑으로 (C.78b runOn 은 2.5 m 안에서 바로 받는다 — 비행 끝점에 남겨 두면 다음 틱에 3 m 넘게 튀었다, 순간이동 가드)
      b.x = a.x;
      b.y = a.y;
      a.dribbleT = -100;
      return;
    case 'gain':
      return;
    case 'receive': {
      const fl = res.fl!;
      const passer = s.agents[fl.passer]!;
      a.gotBy = 'receive';
      a.carryN = 0;
      a.dribbleT = -100;
      // 등지고 받았는가 (몸 방향 = 공이 온 쪽): 공격 방향과 backAngle 이상이면 포스트플레이 후보 (E.18 A2)
      a.backToGoal = receivesBack(fl.fromX, fl.fromY, b.x, b.y, attackDir(a.team, s.half));
      if (fl.quick) a.cooldown = reaction(a);
      passer.stats.passesCompleted++;
      s.teams[passer.team].stats.passesCompleted++;
      a.stats.received++;
      if (Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY) >= 30) s.teams[a.team].stats.longCompleted++;
      if (fl.through) {
        a.stats.throughReceived++;
        s.teams[a.team].stats.throughReceived++;
        passer.stats.throughCompleted++;
      }
      s.lastPass = { passer: passer.idx, receiver: a.idx, t: s.t };
      if ((fl.toX - fl.fromX) * attackDir(passer.team, s.half) > 8) passer.rt.forward++;
      if (RC.timeModel > 0 || RC.oneTouch > 0) firstTouch(s, a, fl);
      // C.78m: 판단(첫 터치·미리 정하기)은 그대로 두고 받는 틱 끝에 공을 받은 선수 발밑으로 (C.78e win 분기와 같은 종류 — runOn 2.5 m 안 바로 받기에서 비행 끝점에 남겨 두면 다음 틱에 3 m 넘게 튀었다, 순간이동 가드)
      b.x = a.x;
      b.y = a.y;
    }
  }
}

/**
 * 첫 터치 (C.78b, 로드맵 5단계 2차): 패스 수신의 정지 시간을 첫 터치·공 속도·압박·몸 방향·달리는 중으로 차등(timeModel),
 * 압박 반대쪽(또는 달리던 쪽)으로 공을 받아 놓고, 땅볼이면 날아오는 동안 미리 정한 원터치 행동을 다음 틱에 실행한다(oneTouch)
 */
function firstTouch(s: SimState, a: Agent, fl: Flight): void {
  const speed = (fl.aimD ?? Math.hypot(fl.toX - fl.fromX, fl.toY - fl.fromY)) / Math.max(0.05, fl.dur);
  const [opp, dNear] = nearestOppOf(s, a);
  const pr = Math.max(0, 1 - dNear / RC.pressDist);
  const sp = Math.hypot(a.vx, a.vy);
  if (RC.timeModel > 0) {
    // 전술 적합도 (C.80e): 공중 롱볼 첫 터치 = 직선 touch 보너스
    const t = receiveTime(s, a, speed, a.backToGoal, fl.air ? fitPts(s, a.team, 'touch') : 0);
    // 컷백·레이오프는 원래 빠르게 (반응 시간)
    a.cooldown = fl.quick ? Math.min(a.cooldown, t) : t;
    // 받아 놓기: 달리며 받으면 진행 방향으로, 압박이 있으면 그 반대쪽(공격 방향으로 기움)으로 turnAway m
    if (sp >= 3) {
      a.tx = clamp(a.x + a.vx * a.cooldown, 1, L - 1);
      a.ty = clamp(a.y + a.vy * a.cooldown, 1, W - 1);
    } else if (opp && pr > 0) {
      const dir = attackDir(a.team, s.half);
      let ux = (a.x - opp.x) / Math.max(0.1, dNear) + 0.5 * dir;
      let uy = (a.y - opp.y) / Math.max(0.1, dNear);
      const n = Math.hypot(ux, uy) || 1;
      ux /= n;
      uy /= n;
      a.tx = clamp(a.x + ux * RC.turnAway, 1, L - 1);
      a.ty = clamp(a.y + uy * RC.turnAway, 1, W - 1);
    }
  }
  // 미리 정하기: 땅볼만. 내 선수는 뺀다(직접 모드 결정 순간 화면·카드와 겹치지 않게, 자동·맡기기·직접 결과가 같아야 한다)
  if (RC.oneTouch > 0 && !fl.air && a.line !== 0 && !a.spec.isMe) {
    const c = preDecide(s, a, speed, a.cooldown);
    if (c) {
      a.pre = c;
      a.cooldown = 0;
      if (c.type === 'shoot') {
        a.otMul = oneTouchMul(a, speed, pr);
        a.otUntil = s.t + 0.25;
      }
      return;
    }
  }
  // 돌아서기 (C.78e ②): 원터치가 아니고 등지고 받았어도 turnFree m 안에 상대가 없으면 정지 시간(등짐 비용 포함) 동안 돌아서 앞을 보고 다음 결정을 한다
  // (줄 사이에서 받은 공격수를 CB 가 따라오지 않으면 돌아서 전진할 시간을 얻는다)
  if (RC.turnFree > 0 && a.backToGoal && dNear >= RC.turnFree) {
    a.backToGoal = false;
    a.hx = attackDir(a.team, s.half);
    a.hy = 0;
  }
}

/**
 * GK 손 처리 (C.28): 자기 박스 안 루즈볼이 handRange m 안에 오면 캐치를 시도한다. 같은 팀이 발로 일부러 준 공(패스·롱패스)은
 * 손을 못 쓴다(발 컨트롤은 updateLooseBall 의 보통 판정). 놓치면 공이 몸에 맞고 튄다. 공을 처리했으면 true
 */
export function keeperHands(s: SimState, sp: number, fromX = s.ball.x, fromY = s.ball.y): boolean {
  const b = s.ball;
  if (sp > K.handMaxSpeed || b.reserve) return false;
  for (const gk of s.agents) {
    if (!gk.onPitch || gk.line !== 0) continue;
    // 이번 틱에 공이 지나간 길 (빠른 공은 틱당 3 m 가까이 움직인다)에서 가장 가까운 거리
    const [gd, gt] = segDist(gk.x, gk.y, fromX, fromY, b.x, b.y);
    if (gd > K.handRange) continue;
    const [cx, cy] = [fromX + (b.x - fromX) * gt, fromY + (b.y - fromY) * gt];
    if (b.handBlock && b.handBlock.idx === gk.idx && s.t < b.handBlock.until) continue;
    if (!keeperZone(s, gk, b.x, b.y, 0)) continue;
    if (b.kick && b.kick.team === gk.team && b.lastTeam === gk.team && (b.kick.kind === 'pass' || b.kick.kind === 'long')) {
      // 백패스: 발로 받는다 (보통 컨트롤 식, 반경 footRange. 빠른 공도 몸으로 막는다)
      if (gd > K.footRange) continue;
      const pf = B.controlBase + (B.controlSlope * gk.attrs.ballControl) / 100 - B.controlSpeedPenalty * (sp / 10);
      if (r(s, gk.idx, Purpose.Control, 1) < pf) {
        [b.x, b.y] = [cx, cy];
        setOwner(s, gk);
        return true;
      }
      continue;
    }
    const p = clamp(catchProb(gk) + K.looseCatchBonus - K.handSpeedPenalty * (sp / 10), 0.05, 0.98);
    if (r(s, gk.idx, Purpose.Keeper, 7) < p) {
      [b.x, b.y] = [cx, cy];
      setOwner(s, gk);
      gk.cooldown = K.holdTime;
      return true;
    }
    // 놓침: 몸에 맞고 아무 쪽으로나 튄다
    const [lo, hi] = K.fumbleSpeed;
    const fs = lo + (hi - lo) * r(s, gk.idx, Purpose.Keeper, 8);
    const ang = r(s, gk.idx, Purpose.Keeper, 9) * Math.PI * 2;
    looseBall(s, cx, cy, Math.cos(ang) * fs, Math.sin(ang) * fs, gk.team, gk.idx);
    b.handBlock = { idx: gk.idx, until: s.t + K.handBlock };
    return true;
  }
  return false;
}

function nearestOppOf(s: SimState, a: Agent): [Agent | null, number] {
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

// ── 세트피스 (E.10) ──

/** 코너: 박스 안 공중볼 최고 동료에게 크로스 (가끔 짧은 패스) */
export function takeCorner(s: SimState, a: Agent): boolean {
  if (rand(s.seed, s.tick, a.idx, Purpose.Corner) < ENGINE.setPiece.shortCorner) return false;
  const ct = crossTarget(s, a, rand(s.seed, s.tick, a.idx, Purpose.Corner, 1));
  if (!ct) return false;
  s.exemptPass = true;
  cross(s, a, { type: 'cross', p: 0.3, u: 0, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
  return true;
}

/** 직접 프리킥: 30 m 이내, 골문이 보이면 슛 (벽 블록 확률), 측면이면 크로스. 아니면 일반 판단 */
export function takeFreeKick(s: SimState, a: Agent, indirect: boolean): boolean {
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const d = dist(a.x, a.y, gx, gy);
  const central = Math.abs(a.y - gy) < 15;
  // 카드 직접 프리킥 (C.36): 키커 보정에 direct 가 있으면 슛을 고른다 (벽 블록 배수, 유효 %p, 선방 보정)
  const cm = a.spec.isMe ? s.cards?.mod ?? null : null;
  if (!indirect && central && (cm?.direct || (d <= ENGINE.setPiece.directMax && r(s, a.idx, Purpose.FreeKick, 9) < ENGINE.setPiece.directChance))) {
    const t = s.teams[a.team];
    recordShot(s, a);
    a.stats.shots++;
    t.stats.shots++;
    s.lastWasShot = true;
    event(s, 'freeKick', a.team, [a.id], { direct: 1 });
    const wall = ENGINE.setPiece.wallBlock * (cm?.direct ? cm.blockMul : 1);
    if (r(s, a.idx, Purpose.FreeKick) < wall) {
      if (probe.shot) probeShot(s, a, 'fk', 'block', { xg: null, pOn: directFkOn(a, d), pBlock: wall, d }, gx, gy, ENGINE.ball.shotSpeed);
      event(s, 'block', a.team, [a.id]);
      const ang = r(s, a.idx, Purpose.FreeKick, 1) * Math.PI * 2;
      bounceAt(s, a, a.x + dir * 9, a.y, Math.cos(ang) * 6, Math.sin(ang) * 6, (1 - a.team) as 0 | 1, -1);
      return true;
    }
    const pOn = cm?.direct ? clamp(directFkOn(a, d) + cm.on, 0, 1) : directFkOn(a, d);
    const speed = ENGINE.ball.shotSpeed;
    const side = r(s, a.idx, Purpose.FreeKick, 2) < 0.5 ? -1 : 1;
    // 날씨 (C.74a): 강풍 직접 프리킥 × freeKick
    if (r(s, a.idx, Purpose.FreeKick, 3) < pOn * s.env.freeKick) {
      t.stats.shotsOnTarget++;
      a.stats.shotsOnTarget++;
      const corner = clamp(r(s, a.idx, Purpose.FreeKick, 4) * PR.cornerRange, 0, 1);
      const ctx: ShotCtx = {
        fx: a.x, fy: a.y, svx: a.vx, svy: a.vy, d, header: false, press3: 0, pressure: 0, tx: gx, ty: gy + side * corner * (G / 2 - 0.3), corner, speed,
        ...gkCtx(keeperOf(s, (1 - a.team) as 0 | 1)), lead: 0,
      };
      const shot = { speed, corner, d, header: false, ctx, ...(cm?.direct && cm.save ? { cardSave: cm.save } : {}) };
      if (probe.shot) probeShot(s, a, 'fk', 'onTarget', { xg: null, pOn, pBlock: wall, d }, gx, gy + side * corner * (G / 2 - 0.3), speed, shot);
      shotFlight(s, a, {
        kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: gy + side * corner * (G / 2 - 0.3), t0: s.t, dur: d / speed, air: true,
        passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot,
      });
    } else {
      if (probe.shot) probeShot(s, a, 'fk', 'miss', { xg: null, pOn, pBlock: wall, d }, gx + dir * 3, gy, speed);
      s.ball.owner = -1;
      s.ball.reserve = null;
      s.ball.flight = {
        kind: 'shot', fromX: a.x, fromY: a.y, toX: gx + dir * 3, toY: gy + side * (G / 2 + 1 + r(s, a.idx, Purpose.FreeKick, 5) * 4),
        t0: s.t, dur: (d + 3) / speed, air: true, passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1,
      };
    }
    return true;
  }
  // 측면 프리킥: 크로스
  const [nx] = [dir > 0 ? a.x / L : 1 - a.x / L];
  if (nx > 0.65 && d < 40) {
    const ct = crossTarget(s, a, r(s, a.idx, Purpose.FreeKick, 8));
    if (ct) {
      cross(s, a, { type: 'cross', p: 0.3, u: 0, x: ct.r.x, y: ct.r.y, receiver: ct.r.idx, value: ct.value });
      return true;
    }
  }
  return false;
}

/** 직접 프리킥 유효 슈팅 확률 (판단·카드 미리보기와 같은 식) */
export function directFkOn(a: Agent, d: number): number {
  return Math.min(PR.shotCap, clamp(PR.shotBase - PR.shotPerM * d, PR.shotMin, PR.shotMax) * ENGINE.setPiece.directAccuracy * finishMult(a.attrs, 'freeKick'));
}

/** 벽·GK 에 맞고 튀는 공 (C.24): 공이 (x, y)까지 슈팅 속도로 날아간 뒤 (vx, vy)로 튄다 (공을 옮기지 않는다) */
function bounceAt(s: SimState, a: Agent, x: number, y: number, vx: number, vy: number, lastTeam: 0 | 1, lastTouch: number): void {
  const d = dist(a.x, a.y, x, y);
  const b = s.ball;
  b.owner = -1;
  b.reserve = null;
  b.flight = {
    kind: 'shot', fromX: a.x, fromY: a.y, toX: x, toY: y, t0: s.t, dur: Math.max(0.1, d / ENGINE.ball.shotSpeed), air: false,
    passer: a.idx, receiver: -1, outcome: 'loose', interceptor: -1, after: { vx, vy, team: lastTeam, touch: lastTouch },
  };
}

/** 측정용 PK xG (probe 기록, 판정에는 쓰지 않는다) */
const PK_XG = 0.76;

/** PK (E.10): 키커의 슈팅과 침착성, GK 선방 */
/** PK 성공 확률 (E.10). on = 카드 보정 %p (C.36) */
export function penaltyProb(s: SimState, a: Agent, on: number): number {
  const SP = ENGINE.setPiece;
  const gk = keeperOf(s, (1 - a.team) as 0 | 1);
  const kick = (a.attrs.shooting + a.attrs.composure) / 2;
  const p = clamp(SP.penaltyBase + (SP.penaltySkill * (kick - 75)) / 100 - (SP.penaltyKeeper * ((gk?.gk?.attrs.shotStopping ?? 20) - 70)) / 100, 0.4, 0.95);
  return on ? clamp(p + on, 0.05, 0.97) : p;
}

export function takePenalty(s: SimState, a: Agent): void {
  const SP = ENGINE.setPiece;
  const def = (1 - a.team) as 0 | 1;
  const gk = keeperOf(s, def);
  const p = penaltyProb(s, a, a.spec.isMe ? s.cards?.mod?.on ?? 0 : 0);
  const t = s.teams[a.team];
  recordShot(s, a, true);
  a.stats.shots++;
  t.stats.shots++;
  s.lastWasShot = true;
  event(s, 'penalty', a.team, [a.id]);
  const dir = attackDir(a.team, s.half);
  if (r(s, a.idx, Purpose.Penalty) < p) {
    t.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    s.lastPass = null;
    // 공이 골문까지 날아간 뒤 골 (재생에서 공이 골문에 들어가는 장면이 보이게, 판정은 이미 끝났다)
    const [gx, gy] = oppGoal(dir);
    const side = r(s, a.idx, Purpose.Penalty, 3) < 0.5 ? -1 : 1;
    const speed = ENGINE.ball.shotSpeed;
    const d = dist(a.x, a.y, gx, gy);
    const shot = { speed, corner: 1, d, header: false, penalty: true };
    if (probe.shot) probeShot(s, a, 'pk', 'onTarget', { xg: PK_XG, pOn: p, pBlock: 0, d }, gx, gy + side * (G / 2 - 0.6), speed, shot);
    s.ball.owner = -1;
    s.ball.reserve = null;
    s.ball.flight = {
      kind: 'shot', fromX: a.x, fromY: a.y, toX: gx, toY: gy + side * (G / 2 - 0.6), t0: s.t, dur: d / speed, air: false,
      passer: a.idx, receiver: -1, outcome: 'shot', interceptor: -1, shot,
    };
    return;
  }
  const pkProbe = (outcome: 'save' | 'miss'): void => {
    const [gx, gy] = oppGoal(dir);
    probeShot(s, a, 'pk', outcome, { xg: PK_XG, pOn: p, pBlock: 0, d: dist(a.x, a.y, gx, gy) }, gx, gy, ENGINE.ball.shotSpeed);
  };
  if (r(s, a.idx, Purpose.Penalty, 1) < SP.penaltySaveShare) {
    if (probe.shot) pkProbe('save');
    t.stats.shotsOnTarget++;
    a.stats.shotsOnTarget++;
    s.teams[def].stats.saves++;
    if (gk) gk.stats.saves++;
    event(s, 'save', def, [gk?.id ?? '', a.id]);
    const ang = (r(s, a.idx, Purpose.Penalty, 2) - 0.5) * 2;
    bounceAt(s, a, a.x + dir * 9, a.y, -dir * Math.cos(ang) * 6, Math.sin(ang) * 6, def, gk?.idx ?? -1);
    return;
  }
  if (probe.shot) pkProbe('miss');
  setRestart(s, 'goalKick', def, dir > 0 ? L - 5.5 : 5.5, W / 2, 'auto');
}
