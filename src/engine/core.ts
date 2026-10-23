// 시뮬 공용 동작: 이벤트 기록, 소유 변경, 리스타트 준비

// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as physics_ from './physics';
const { tiredRatio } = physics_;
import { effectiveTactics, pressLevel } from './offball';
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, L, toPitch, W } = pitch_;
import * as rng_ from './rng';
const { Purpose, rand } = rng_;
import * as tactics_ from './tactics';
const { TENDENCY } = tactics_;
import type { Agent, RestartType, SimState } from './state';
import type { MatchEvent } from './types';

const T = ENGINE.time;

export function event(s: SimState, type: MatchEvent['type'], team: 0 | 1, players: string[], params?: MatchEvent['params']): void {
  s.events.push({ t: Math.round(s.t * 10) / 10, type, team, players, ...(params ? { params } : {}) });
}

export function reaction(a: Agent): number {
  return T.reactionBase - T.reactionSlope * a.judgement;
}

/** 소유 팀이 바뀔 때 마지막 소유자의 소유 상실 기록 (슈팅으로 끝난 경우 제외, E.12) */
function recordLoss(s: SimState, newTeam: 0 | 1): void {
  if (s.possTeam === newTeam || s.lastOwner < 0 || s.lastWasShot) return;
  const lo = s.agents[s.lastOwner];
  if (!lo || lo.team === newTeam) return;
  lo.rt.lost++;
  const nx = attackDir(lo.team, s.half) > 0 ? lo.x / L : 1 - lo.x / L;
  // 위험 감수 실패 (C.77s A2): 전진·침투·크로스·돌파 뒤 상대 진영이면 절반 (마지막 1/3 은 attackLost 로 이미 절반, 겹치지 않음)
  const risk = !!lo.rt.risky && nx > 0.5 && nx <= 2 / 3;
  if (nx < 1 / 3) lo.rt.dangerLost++;
  else if (nx > 2 / 3) lo.rt.attackLost++;
  else if (risk) lo.rt.riskLost = (lo.rt.riskLost ?? 0) + 1;
  // 직접 모드 도박 실패 완화 (C.75a): 고른 선택지 바로 뒤 내 공 상실이면 감점 일부를 되돌린다
  const rl = s.moments.relief;
  if (rl && lo.spec.isMe && s.t - rl.t <= ENGINE.moments.reliefWindow) {
    const R = ENGINE.rating;
    const cost = nx < 1 / 3 ? R.dangerLost : nx > 2 / 3 ? R.lost * R.attackLostFactor : risk ? R.lost * R.riskLostFactor : R.lost;
    lo.rt.relief = (lo.rt.relief ?? 0) - rl.k * cost;
  }
}

/**
 * 수신 정지 시간 (C.78b receive.timeModel 1): 첫 터치(볼 컨트롤)·공 속도·압박(pressDist m 안 가장 가까운 상대 필드 선수)·몸 방향·달리는 중으로 min~max 초.
 * 패스 수신은 actions firstTouch 가, 그 밖의 소유(가로채기·루즈볼·태클)는 setOwner 가 부른다
 */
export function receiveTime(s: SimState, a: Agent, speed: number, back: boolean): number {
  const R = ENGINE.receive;
  let dNear = Infinity;
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) dNear = Math.min(dNear, Math.hypot(o.x - a.x, o.y - a.y));
  const pr = Math.max(0, 1 - dNear / R.pressDist);
  const run = clamp(Math.hypot(a.vx, a.vy) / 5, 0, 1);
  return clamp(R.base - (R.touchSkill * (a.attrs.ballControl - 70)) / 100 + (R.ballSpeed * Math.max(0, speed - 12)) / 10 + R.press * pr
    + (back ? R.back : 0) - R.run * run + reaction(a) * R.reactMul, R.min, R.max);
}

export function setOwner(s: SimState, a: Agent): void {
  const b = s.ball;
  // 수신 정지 시간 (C.78b): 공을 잡는 순간 공 속도 (비행 중이면 비행 속도, 굴러가면 지금 속도)
  const inSpeed = ENGINE.receive.timeModel > 0 ? (b.flight ? Math.hypot(b.flight.toX - b.flight.fromX, b.flight.toY - b.flight.fromY) / Math.max(0.05, b.flight.dur) : Math.hypot(b.vx, b.vy)) : 0;
  recordLoss(s, a.team);
  a.rt.risky = false;
  // 결정 결과는 첫 소유 변경에서 끝난다 (C.75a 실패 완화는 그때까지만)
  s.moments.relief = null;
  s.lastOwner = a.idx;
  s.lastWasShot = false;
  b.owner = a.idx;
  b.flight = null;
  b.reserve = null;
  b.kick = null;
  b.vx = b.vy = 0;
  b.z = 0;
  b.lastTouch = a.idx;
  b.lastTeam = a.team;
  if (s.possTeam !== a.team) {
    s.possTeam = a.team;
    s.possSince = s.t;
    s.possOrigin = 'open';
    s.possStartT = s.t;
    turnover(s, (1 - a.team) as 0 | 1, true);
    const nx = attackDir(a.team, s.half) > 0 ? b.x / L : 1 - b.x / L;
    if (nx > 0.5) s.teams[a.team].stats.oppHalfWins++;
  }
  a.cooldown = ENGINE.receive.timeModel > 0 ? receiveTime(s, a, inSpeed, false) : ENGINE.ball.receiveTime + reaction(a) * 0.5;
  if (a.pre) a.pre = null;
  a.gotBy = 'gain';
  a.lastMoveT = -100;
  a.carryN = 0;
  a.dribbleT = -100;
  a.backToGoal = false;
  a.tx = a.x;
  a.ty = a.y;
}

/**
 * 소유를 잃은 팀 (E.18 A3): 오픈 플레이면 공 근처 최대 3명이 역압박, 모든 선수는 긴급 복귀 판단을 새로 한다
 */
export function turnover(s: SimState, team: 0 | 1, open: boolean): void {
  const O = ENGINE.offball;
  const tm = s.teams[team];
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team) continue;
    a.recoverUrgent = rand(s.seed, s.tick, a.idx, Purpose.Offball, 5) < (O.recoverJudge + (O.recoverWork * a.attrs.workRate) / 100) * tiredness(a);
  }
  tm.counterPressers = [];
  tm.counterUntil = 0;
  if (!open) return;
  s.teams[team === 0 ? 1 : 0].wonAt = s.t;
  // 전환 수비 (C.78a): 상실 시각·라인 기록 초기화, 탈취 팀 출구·제한 침투 (G2)
  tm.lostAt = s.t;
  tm.lineAtLoss = -1;
  tm.brokeAt = -100;
  if (O.exitRun > 0) exitRuns(s, team === 0 ? 1 : 0);
  // 성향 (E.19, E.20 4번): 게겐프레싱 +1초·최대 3명, 역습·수비 블록·버스 세우기는 역압박 없이 즉시 복귀
  const tendency = tm.tactics.tendency;
  if (tendency === 'counter' || tendency === 'block' || tendency === 'bus') return;
  const b = s.ball;
  const near = s.agents
    .filter((a) => a.onPitch && a.team === team && a.line !== 0 && dist(a.x, a.y, b.x, b.y) <= O.counterRadius)
    .sort((x, y) => dist(x.x, x.y, b.x, b.y) - dist(y.x, y.y, b.x, b.y));
  const max = manDiffCount(s, team) < 0 ? ENGINE.referee.shortCounterMax : tendency === 'gegenpress' ? TENDENCY.gegenMax : O.plan.sit.H.pressers[pressLevel(s, team)]!;
  for (const a of near) {
    if (tm.counterPressers.length >= max) break;
    const p = (O.counterJoin + O.counterJoinPress * a.role.press + (O.counterJoinWork * a.attrs.workRate) / 100) * tiredness(a);
    if (rand(s.seed, s.tick, a.idx, Purpose.Offball, 6) < p) tm.counterPressers.push(a.idx);
  }
  if (tm.counterPressers.length) tm.counterUntil = s.t + O.counterBase + O.counterPerPress * effectiveTactics(s, team).pressing + (tendency === 'gegenpress' ? TENDENCY.gegenExtra : 0);
}

/**
 * 탈취 팀 출구 (C.78a ⑤, G2): 최전방(슬롯 x 가장 앞 공격 줄 = 전진 패스 받을 출구)은 그대로 두고, 공보다 앞의 공격 줄·측면(LM/RM/WB) 선수 중
 * 빈 곳(가장 가까운 상대 거리 × (0.5 + 침투 성향)) 순 exitRunners 명만 1회 침투한다. 난수 없음 (모두에게 침투를 늘리지 않는다 — C.77f 교훈)
 */
function exitRuns(s: SimState, win: 0 | 1): void {
  const O = ENGINE.offball;
  const dir = attackDir(win, s.half);
  const bnx = dir > 0 ? s.ball.x / L : 1 - s.ball.x / L;
  let top: Agent | null = null;
  for (const a of s.agents) if (a.onPitch && a.team === win && a.line === 3 && (!top || a.sx > top.sx || (a.sx === top.sx && a.idx < top.idx))) top = a;
  const cands = s.agents.filter((a) => {
    if (!a.onPitch || a.team !== win || a === top || a.idx === s.ball.owner || a.line === 0) return false;
    if (!(a.line === 3 || a.pos === 'LM' || a.pos === 'RM' || a.pos === 'LWB' || a.pos === 'RWB')) return false;
    const nx = dir > 0 ? a.x / L : 1 - a.x / L;
    return nx > bnx;
  });
  // 빈 곳에 있는 선수부터 (가장 가까운 상대 필드 선수까지 거리 × 침투 성향) — 상대 수비가 적은 쪽이 뛴다
  const room = (a: Agent) => {
    let d = 40;
    for (const o of s.agents) if (o.onPitch && o.team !== win && o.line !== 0) d = Math.min(d, dist(o.x, o.y, a.x, a.y));
    return d * (0.5 + a.role.run);
  };
  cands.sort((x, y) => room(y) - room(x) || x.idx - y.idx);
  const exits = cands.slice(0, O.exitRunners);
  for (const a of exits) {
    a.runUntil = s.t + O.runSeconds;
    a.exitRun = true;
  }
  // 역습 지원 (C.78d ②): 버스·블록·역습이 자기 절반에서 뺏으면 공에 가장 가까운 2선(중원·측면, 공 앞뒤 무관) supportRunners 명이 측면 길로 달린다
  const n = O.supportRun > 0 && bnx < 0.5 ? TENDENCY.supportRunners[s.teams[win].tactics.tendency] ?? 0 : 0;
  if (!n) return;
  const b = s.ball;
  const sup = s.agents.filter((a) => a.onPitch && a.team === win && a !== top && a.idx !== b.owner && !exits.includes(a)
    && (a.line === 2 || a.pos === 'LM' || a.pos === 'RM' || a.pos === 'LWB' || a.pos === 'RWB'));
  sup.sort((x, y) => dist(x.x, x.y, b.x, b.y) - dist(y.x, y.y, b.x, b.y) || x.idx - y.idx);
  for (const a of sup.slice(0, n)) {
    a.runUntil = s.t + O.supportSeconds;
    a.supportRun = true;
  }
}

/** 지친 선수는 역압박 가담·긴급 복귀를 덜 한다 (E.20 5번): 스태미나 staminaLowFrom 아래에서 비례, 0 이면 tiredFloor */
function tiredness(a: Agent): number {
  return 1 - (1 - ENGINE.physics.tiredFloor) * tiredRatio(a);
}

function manDiffCount(s: SimState, team: 0 | 1): number {
  let d = 0;
  for (const a of s.agents) if (a.onPitch) d += a.team === team ? 1 : -1;
  return d;
}

/** 공을 놓는다 (루즈볼). 속도 (vx, vy) */
export function looseBall(s: SimState, x: number, y: number, vx: number, vy: number, lastTeam: 0 | 1, lastTouch = -1): void {
  const b = s.ball;
  b.owner = -1;
  b.flight = null;
  b.reserve = null;
  b.kick = null;
  b.x = x;
  b.y = y;
  b.z = 0;
  b.vx = vx;
  b.vy = vy;
  b.lastTeam = lastTeam;
  b.lastTouch = lastTouch;
}

/** 킥오프 키커: 그 팀에서 가장 앞선 필드 선수 (슬롯 기준) */
export function kickoffTaker(s: SimState, team: 0 | 1): Agent | null {
  let best: Agent | null = null;
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team || a.line === 0) continue;
    if (!best || a.sx > best.sx) best = a;
  }
  return best;
}

/** 킥오프 대형: 슬롯 위치를 자기 진영으로. 킥오프 팀의 키커는 중앙 점, 그다음 앞선 선수는 1.5 m 옆 (C.24) */
export function kickoffPositions(s: SimState, team: 0 | 1): void {
  const taker = kickoffTaker(s, team);
  let mate: Agent | null = null;
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team || a.line === 0 || a === taker) continue;
    if (!mate || a.sx > mate.sx) mate = a;
  }
  for (const a of s.agents) {
    if (!a.onPitch) continue;
    const dir = attackDir(a.team, s.half);
    const nx = Math.min(a.sx * 0.9, 0.46);
    [a.x, a.y] = toPitch(nx, a.sy, dir);
    if (a === taker) [a.x, a.y] = [L / 2, W / 2];
    else if (a === mate) [a.x, a.y] = [L / 2 - dir * 0.3, W / 2 + (a.sy < 0.5 ? -1.5 : 1.5)];
    a.vx = a.vy = 0;
    a.tx = a.x;
    a.ty = a.y;
    a.tvx = a.tvy = 0;
    a.tvIdx = -1;
    a.hx = dir;
    a.hy = 0;
    a.paceCap = 0;
  }
}

/** 범위 [lo, hi] 안 대기 시간 (시드) */
export function restartWait(s: SimState, range: readonly [number, number], k = 0): number {
  return range[0] + (range[1] - range[0]) * rand(s.seed, s.tick, 0, Purpose.Restart, k);
}

/** 재개 종류별 대기 시간 (E.18 A4) */
function autoDelay(s: SimState, type: RestartType, x: number, y: number, offside: boolean): number {
  const R = ENGINE.restart;
  switch (type) {
    case 'throwIn': return restartWait(s, R.throwIn);
    case 'goalKick': return restartWait(s, R.goalKick);
    case 'corner': return restartWait(s, R.corner);
    case 'kickoff': return restartWait(s, R.kickoff);
    case 'penalty': return restartWait(s, R.penalty);
    case 'freeKick': {
      if (offside) return restartWait(s, R.offside);
      const gx = x > L / 2 ? L : 0;
      const direct = dist(x, y, gx, W / 2) <= ENGINE.setPiece.directMax && Math.abs(y - W / 2) < 15;
      return restartWait(s, direct ? R.directFreeKick : R.freeKick);
    }
  }
}

/** 진행 중인 재개를 늦춘다 (카드, 교체) */
export function delayRestart(s: SimState, range: readonly [number, number], k: number): void {
  if (s.restart) s.restart.at += restartWait(s, range, k);
}

/** 재개 키커 후보 중 (x, y)에 가장 가까운 선수 (골킥은 GK, 그 밖은 필드 선수) */
export function nearestTaker(s: SimState, type: RestartType, team: 0 | 1, x: number, y: number): number {
  let pick = -1;
  let bd = Infinity;
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team) continue;
    if (type === 'goalKick' ? a.line !== 0 : a.line === 0) continue;
    const d = dist(a.x, a.y, x, y);
    if (d < bd) {
      bd = d;
      pick = a.idx;
    }
  }
  return pick;
}

/** 지정 PK 키커 (C.76q, 미해결 13): 경기장의 필드 선수 중 (슈팅 + 침착성) 최고 (penaltyProb 와 같은 식), 같으면 앞 번호 */
export function penaltyTaker(s: SimState, team: 0 | 1): number {
  let pick = -1;
  let best = -Infinity;
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== team || a.line === 0) continue;
    const v = a.attrs.shooting + a.attrs.composure;
    if (v > best) {
      best = v;
      pick = a.idx;
    }
  }
  return pick;
}

/** 리스타트 준비: 키커는 공에 가장 가까운 선수 (킥오프는 가장 앞선 선수, 골킥은 GK). delay 'auto' = 종류별 대기 시간 */
export function setRestart(s: SimState, type: RestartType, team: 0 | 1, x: number, y: number, delayArg: number | 'auto' | 'offside', taker?: number): void {
  const delay = typeof delayArg === 'number' ? delayArg : autoDelay(s, type, x, y, delayArg === 'offside');
  const b = s.ball;
  b.owner = -1;
  b.flight = null;
  b.reserve = null;
  b.kick = null;
  b.handBlock = null;
  b.vx = b.vy = 0;
  b.z = 0;
  b.x = clamp(x, 0, L);
  b.y = clamp(y, 0, W);
  let pick = taker ?? -1;
  if (pick < 0) pick = type === 'kickoff' ? (kickoffTaker(s, team)?.idx ?? -1) : type === 'penalty' ? penaltyTaker(s, team) : nearestTaker(s, type, team, b.x, b.y);
  if (type !== 'kickoff') recordLoss(s, team);
  s.moments.relief = null;
  if (s.possTeam !== team) turnover(s, s.possTeam, false);
  s.lastWasShot = false;
  s.restart = { type, team, x: b.x, y: b.y, at: s.t + delay, taker: pick };
  if (s.possTeam !== team) s.possSince = s.t;
  s.possTeam = team;
}
