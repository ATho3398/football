// 기준 장면 하네스 (C.77w, 공통 규칙 로드맵 1단계): 실제 경기 상태(createMatch)를 만들고 선수를 직접 배치해 몇 초만 돌린다.
// 이동은 엔진의 moveAgent(physics.ts)·판단 주기(time.offballInterval)·GK 자리(keeperTarget)·선방 식(C.77z saveChance — 판단·실행 공용)·후보/선택(candidates·choose)을 그대로 쓴다.
// 장면은 지금 동작을 수치로 돌려준다. 목표 판정은 targets.ts 의 enabled (로드맵 2~4단계 패치가 켠다).

import { ENGINE } from '../../src/engine/config';
import { createMatch, type MatchSim } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { initPhysics, moveAgent, perceiveFeed } from '../../src/engine/physics';
import { L, W } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
import { createTeamRoster, rosterRating } from '../../src/roster';

export const DT = ENGINE.time.dt;
/** 수비 목표 갱신 주기 (엔진 오프더볼 판단 평균 간격) */
export const REFRESH = ENGINE.time.offballInterval;

/** 장면용 경기 상태: 75 대 75 고정 로스터, 킥오프 재개를 지운 열린 플레이 (시각 10분) */
let cur: SimState | null = null;

/** 마지막 sceneState 의 경기 (C.78a ⑪: 전체 틱을 엔진 step 으로 돌리는 장면) */
export let sceneSim: MatchSim | null = null;

export function sceneState(seed = 1): SimState {
  const h = createTeamRoster({ id: 'sc-h', rating: 75 }, `scene-h${seed}`, 2018, []);
  const a = createTeamRoster({ id: 'sc-a', rating: 75 }, `scene-a${seed}`, 2018, []);
  const m = createMatch({
    home: teamSetupFromRoster(h, rosterRating(h), 75, `sch${seed}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `sca${seed}`),
    mode: 'auto', difficulty: 'normal', seed: 7700 + seed, bigMatch: false, neutral: true,
  });
  const s = m.state;
  cur = s;
  sceneSim = m;
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
  // 순간 체력도 가득 (C.78w 2단 체력 — 앞 장면의 질주가 남지 않게)
  a.burst = 100;
  a.burstOut = false;
  initPhysics(a);
}

export function place(a: Agent, x: number, y: number, vx = 0, vy = 0): void {
  a.x = x;
  a.y = y;
  a.vx = vx;
  a.vy = vy;
  // 몸 방향: 움직이면 속도 방향, 서 있으면 팀 공격 방향(엔진 킥오프와 같다)
  const sp = Math.hypot(vx, vy);
  a.hx = sp > 0 ? vx / sp : a.team === 0 ? 1 : -1;
  a.hy = sp > 0 ? vy / sp : 0;
  a.tvx = 0;
  a.tvy = 0;
  a.tvIdx = -1;
  a.tx = x;
  a.ty = y;
}

/** 엔진 이동 한 틱 (오프더볼 이동과 같은 moveAgent, 피로 배율 1) */
export function move(a: Agent): void {
  // 따라가는 사람이 있으면 인지된 목표 속도를 엔진(sim 이동 단계)과 같이 갱신 (C.77x)
  if (a.tvIdx >= 0 && cur) perceiveFeed(a, cur.agents[a.tvIdx]!, DT);
  moveAgent(a, DT);
}

export const speedOf = (a: Agent): number => Math.hypot(a.vx, a.vy);
export const gap = (a: Agent, b: Agent): number => Math.hypot(a.x - b.x, a.y - b.y);

/** 기본 불변식: 좌표·속도에 NaN 없음, 경기장 안 (moveAgent 경계 ±2 m 포함) */
export function sane(...as: Agent[]): boolean {
  return as.every((a) => [a.x, a.y, a.vx, a.vy].every(Number.isFinite) && a.x >= -2 && a.x <= L + 2 && a.y >= -2 && a.y <= W + 2);
}

/** C.77x 새 동작 상수의 "켜진" 값: 밸런스 때문에 설정이 0(꺼짐)이어도 장면 테스트는 이 값으로 돈다 */
export const MOTION_ON: Record<string, number> = {
  'physics.feed': 1,
  'physics.feedLag': 0.25,
  'physics.feedGain': 2,
  'physics.turnModel': 1,
  'physics.pivotBase': 2.2,
  'physics.pivotSlope': 2.2,
  'physics.reverseBrake': 2,
  'offball.errHold': 0.5,
  'physics.arrivalModel': 1,
};

/** C.77y 새 동작 상수의 "켜진" 값 (백패스 가치·수신 움직임): 설정이 0(꺼짐)이어도 장면 테스트는 이 값으로 돈다 */
export const RECEIVE_ON: Record<string, number> = {
  'onball.backModel': 1,
  'offball.checkDist': 4,
  'offball.giveGoChance': 0.6,
  'offball.swapShare': 0.6,
  'offball.abortLane': 0.35,
};

/** C.77z 새 동작 상수의 "켜진" 값 (GK 대응 시간 모델·패스 비행 중 GK 자리): 설정이 0(꺼짐)이어도 장면 테스트는 이 값으로 돈다 */
export const KEEPER_ON: Record<string, number> = {
  'keeper.timeModel': 1,
  'keeper.flightSet': 1,
};

/** C.78a 새 동작 상수의 "켜진" 값 (전환 수비·게겐·출구): 설정이 0(꺼짐)이어도 장면 테스트는 이 값으로 돈다 */
export const TRANSITION_ON: Record<string, number> = {
  'offball.pressBreak': 1,
  'offball.lineHold': 0.55,
  'offball.restMark': 1,
  'offball.trackReach': 1,
  'offball.exitRun': 1,
};

/** C.78b 새 동작 상수의 "켜진" 값 (수신 정지 시간 차등·원터치 미리 정하기·침투 달리며 받기): 설정이 0(꺼짐)이어도 장면 테스트는 이 값으로 돈다 */
export const TOUCH_ON: Record<string, number> = {
  'receive.timeModel': 1,
  'receive.oneTouch': 1,
  'receive.runOn': 3,
};
export const TRANSITION_OFF: Record<string, number> = Object.fromEntries(Object.keys(TRANSITION_ON).map((k) => [k, 0]));
export const TOUCH_OFF: Record<string, number> = Object.fromEntries(Object.keys(TOUCH_ON).map((k) => [k, 0]));

/** C.77y·C.77z 상수의 "꺼진" 값 — C.78a 장면은 x·y·z 켬/끔 둘 다에서 통과해야 한다 */
export const RECEIVE_OFF: Record<string, number> = Object.fromEntries(Object.keys(RECEIVE_ON).map((k) => [k, 0]));
export const KEEPER_OFF: Record<string, number> = Object.fromEntries(Object.keys(KEEPER_ON).map((k) => [k, 0]));

/** C.77x 이동 상수의 "꺼진" 값 (옛 동작) — 3단계 장면이 2단계 없이도 작동하는지 본다 */
export const MOTION_OFF: Record<string, number> = Object.fromEntries(Object.keys(MOTION_ON).map((k) => [k, 0]));

/** ENGINE 상수를 경로=값으로 잠시 덮어쓰고 fn 을 돌린 뒤 되돌린다 */
export function withEngine<T>(over: Record<string, number>, fn: () => T): T {
  const old: [Record<string, unknown>, string, unknown][] = [];
  for (const [path, v] of Object.entries(over)) {
    const keys = path.split('.');
    let o = ENGINE as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
    const last = keys.at(-1)!;
    if (!(last in o)) throw new Error(`unknown ENGINE path ${path}`);
    old.push([o, last, o[last]]);
    o[last] = v;
  }
  try {
    return fn();
  } finally {
    for (const [o, k, v] of old.reverse()) o[k] = v;
  }
}
