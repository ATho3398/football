// 시뮬 공용 동작: 이벤트 기록, 소유 변경, 리스타트 준비

import { ENGINE } from './config';
import { effectiveTactics } from './offball';
import { attackDir, clamp, dist, L, toPitch, W } from './pitch';
import { Purpose, rand } from './rng';
import { TENDENCY } from './tactics';
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
  if (nx < 1 / 3) lo.rt.dangerLost++;
}

export function setOwner(s: SimState, a: Agent): void {
  const b = s.ball;
  recordLoss(s, a.team);
  s.lastOwner = a.idx;
  s.lastWasShot = false;
  b.owner = a.idx;
  b.flight = null;
  b.reserve = null;
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
  a.cooldown = ENGINE.ball.receiveTime + reaction(a) * 0.5;
  a.gotBy = 'gain';
  a.lastMoveT = -100;
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
  // 성향 (E.19, E.20 4번): 게겐프레싱 +1초·최대 3명, 역습·수비 블록은 역압박 없이 즉시 복귀
  const tendency = tm.tactics.tendency;
  if (tendency === 'counter' || tendency === 'block') return;
  const b = s.ball;
  const near = s.agents
    .filter((a) => a.onPitch && a.team === team && a.line !== 0 && dist(a.x, a.y, b.x, b.y) <= O.counterRadius)
    .sort((x, y) => dist(x.x, x.y, b.x, b.y) - dist(y.x, y.y, b.x, b.y));
  const max = manDiffCount(s, team) < 0 ? ENGINE.referee.shortCounterMax : tendency === 'gegenpress' ? TENDENCY.gegenMax : O.counterMax;
  for (const a of near) {
    if (tm.counterPressers.length >= max) break;
    const p = (O.counterJoin + O.counterJoinPress * a.role.press + (O.counterJoinWork * a.attrs.workRate) / 100) * tiredness(a);
    if (rand(s.seed, s.tick, a.idx, Purpose.Offball, 6) < p) tm.counterPressers.push(a.idx);
  }
  if (tm.counterPressers.length) tm.counterUntil = s.t + O.counterBase + O.counterPerPress * effectiveTactics(s, team).pressing + (tendency === 'gegenpress' ? TENDENCY.gegenExtra : 0);
}

/** 지친 선수는 역압박 가담·긴급 복귀를 덜 한다 (E.20 5번): 스태미나 staminaLowFrom 아래에서 비례, 0 이면 tiredFloor */
function tiredness(a: Agent): number {
  const P = ENGINE.physics;
  if (a.stamina >= P.staminaLowFrom) return 1;
  return P.tiredFloor + (1 - P.tiredFloor) * (a.stamina / P.staminaLowFrom);
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

/** 리스타트 준비: 키커는 공에 가장 가까운 선수 (킥오프는 가장 앞선 선수, 골킥은 GK). delay 'auto' = 종류별 대기 시간 */
export function setRestart(s: SimState, type: RestartType, team: 0 | 1, x: number, y: number, delayArg: number | 'auto' | 'offside', taker?: number): void {
  const delay = typeof delayArg === 'number' ? delayArg : autoDelay(s, type, x, y, delayArg === 'offside');
  const b = s.ball;
  b.owner = -1;
  b.flight = null;
  b.reserve = null;
  b.vx = b.vy = 0;
  b.z = 0;
  b.x = clamp(x, 0, L);
  b.y = clamp(y, 0, W);
  let pick = taker ?? -1;
  if (pick < 0) pick = type === 'kickoff' ? (kickoffTaker(s, team)?.idx ?? -1) : nearestTaker(s, type, team, b.x, b.y);
  if (type !== 'kickoff') recordLoss(s, team);
  if (s.possTeam !== team) turnover(s, s.possTeam, false);
  s.lastWasShot = false;
  s.restart = { type, team, x: b.x, y: b.y, at: s.t + delay, taker: pick };
  if (s.possTeam !== team) s.possSince = s.t;
  s.possTeam = team;
}
