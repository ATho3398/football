// 기준 장면 하네스 (C.77w, 공통 규칙 로드맵 1단계): 실제 경기 상태(createMatch)를 만들고 선수를 직접 배치해 몇 초만 돌린다.
// 이동은 엔진의 moveAgent(physics.ts)·판단 주기(time.offballInterval)·GK 자리(keeperTarget)·선방 식(saveProb·shotCover)·후보/선택(candidates·choose)을 그대로 쓴다.
// 장면은 지금 동작을 수치로 돌려준다. 목표 판정은 targets.ts 의 enabled (로드맵 2~4단계 패치가 켠다).

import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { initPhysics, moveAgent } from '../../src/engine/physics';
import { L, W } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
import { createTeamRoster, rosterRating } from '../../src/roster';

export const DT = ENGINE.time.dt;
/** 수비 목표 갱신 주기 (엔진 오프더볼 판단 평균 간격) */
export const REFRESH = ENGINE.time.offballInterval;

/** 장면용 경기 상태: 75 대 75 고정 로스터, 킥오프 재개를 지운 열린 플레이 (시각 10분) */
export function sceneState(seed = 1): SimState {
  const h = createTeamRoster({ id: 'sc-h', rating: 75 }, `scene-h${seed}`, 2018, []);
  const a = createTeamRoster({ id: 'sc-a', rating: 75 }, `scene-a${seed}`, 2018, []);
  const m = createMatch({
    home: teamSetupFromRoster(h, rosterRating(h), 75, `sch${seed}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `sca${seed}`),
    mode: 'auto', difficulty: 'normal', seed: 7700 + seed, bigMatch: false, neutral: true,
  });
  const s = m.state;
  s.restart = null;
  s.t = 600;
  s.tick = 6000;
  for (const ag of s.agents) {
    ag.vx = 0;
    ag.vy = 0;
    ag.cooldown = 0;
    ag.urgent = false;
  }
  return s;
}

/** 팀의 줄(0 GK, 1 수비, 2 중원, 3 공격)에서 k번째 선수 */
export function pick(s: SimState, team: 0 | 1, line: 0 | 1 | 2 | 3, k = 0): Agent {
  const xs = s.agents.filter((a) => a.team === team && a.line === line);
  const a = xs[Math.min(k, xs.length - 1)];
  if (!a) throw new Error(`no agent team ${team} line ${line}`);
  return a;
}

/** 신체 능력치를 정하고 물리 상수를 다시 계산한다 (속도·가속·민첩) */
export function setBody(a: Agent, pace: number, acceleration = pace, agility = pace): void {
  a.attrs = { ...a.attrs, pace, acceleration, agility };
  a.stamina = 100;
  initPhysics(a);
}

export function place(a: Agent, x: number, y: number, vx = 0, vy = 0): void {
  a.x = x;
  a.y = y;
  a.vx = vx;
  a.vy = vy;
  a.tx = x;
  a.ty = y;
}

/** 엔진 이동 한 틱 (오프더볼 이동과 같은 moveAgent, 피로 배율 1) */
export function move(a: Agent): void {
  moveAgent(a, DT);
}

export const speedOf = (a: Agent): number => Math.hypot(a.vx, a.vy);
export const gap = (a: Agent, b: Agent): number => Math.hypot(a.x - b.x, a.y - b.y);

/** 기본 불변식: 좌표·속도에 NaN 없음, 경기장 안 (moveAgent 경계 ±2 m 포함) */
export function sane(...as: Agent[]): boolean {
  return as.every((a) => [a.x, a.y, a.vx, a.vy].every(Number.isFinite) && a.x >= -2 && a.x <= L + 2 && a.y >= -2 && a.y <= W + 2);
}
