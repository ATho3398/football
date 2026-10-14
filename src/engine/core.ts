// 시뮬 공용 동작: 이벤트 기록, 소유 변경, 리스타트 준비

import { ENGINE } from './config';
import { attackDir, clamp, dist, L, toPitch, W } from './pitch';
import type { Agent, RestartType, SimState } from './state';
import type { MatchEvent } from './types';

const T = ENGINE.time;

export function event(s: SimState, type: MatchEvent['type'], team: 0 | 1, players: string[], params?: MatchEvent['params']): void {
  s.events.push({ t: Math.round(s.t * 10) / 10, type, team, players, ...(params ? { params } : {}) });
}

export function reaction(a: Agent): number {
  return T.reactionBase - T.reactionSlope * a.judgement;
}

export function setOwner(s: SimState, a: Agent): void {
  const b = s.ball;
  b.owner = a.idx;
  b.flight = null;
  b.vx = b.vy = 0;
  b.z = 0;
  b.lastTouch = a.idx;
  b.lastTeam = a.team;
  if (s.possTeam !== a.team) {
    s.possTeam = a.team;
    s.possSince = s.t;
  }
  a.cooldown = ENGINE.ball.receiveTime + reaction(a) * 0.5;
  a.tx = a.x;
  a.ty = a.y;
}

/** 공을 놓는다 (루즈볼). 속도 (vx, vy) */
export function looseBall(s: SimState, x: number, y: number, vx: number, vy: number, lastTeam: 0 | 1, lastTouch = -1): void {
  const b = s.ball;
  b.owner = -1;
  b.flight = null;
  b.x = x;
  b.y = y;
  b.z = 0;
  b.vx = vx;
  b.vy = vy;
  b.lastTeam = lastTeam;
  b.lastTouch = lastTouch;
}

/** 킥오프 대형: 슬롯 위치를 자기 진영으로 */
export function kickoffPositions(s: SimState): void {
  for (const a of s.agents) {
    if (!a.onPitch) continue;
    const dir = attackDir(a.team, s.half);
    const nx = Math.min(a.sx * 0.9, 0.46);
    [a.x, a.y] = toPitch(nx, a.sy, dir);
    a.vx = a.vy = 0;
    a.tx = a.x;
    a.ty = a.y;
  }
}

/** 리스타트 준비: 키커는 공에 가장 가까운 선수 (킥오프는 가장 앞선 선수, 골킥은 GK) */
export function setRestart(s: SimState, type: RestartType, team: 0 | 1, x: number, y: number, delay: number, taker?: number): void {
  const b = s.ball;
  b.owner = -1;
  b.flight = null;
  b.vx = b.vy = 0;
  b.z = 0;
  b.x = clamp(x, 0, L);
  b.y = clamp(y, 0, W);
  let pick = taker ?? -1;
  if (pick < 0) {
    let bd = Infinity;
    for (const a of s.agents) {
      if (!a.onPitch || a.team !== team) continue;
      if (type === 'goalKick' ? a.line !== 0 : a.line === 0) continue;
      const d = type === 'kickoff' ? -a.sx : dist(a.x, a.y, b.x, b.y);
      if (d < bd) {
        bd = d;
        pick = a.idx;
      }
    }
  }
  s.restart = { type, team, x: b.x, y: b.y, at: s.t + delay, taker: pick };
  if (s.possTeam !== team) s.possSince = s.t;
  s.possTeam = team;
}
