// 경기 시뮬 루프 (E.2, E.3): 10Hz 물리, 0.3~0.8초 간격 의사결정

import { fieldOf, onOf } from './lists';
import { bodyMods } from '../body';
import { FIELD_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../attributes';
import { FORMATION_SLOTS } from '../formations';
import { stackDrainMul, stackOver } from './stack';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as env_ from './env';
const { resolveEnv } = env_;
import * as rapport_ from './rapport';
const { resolveRapport } = rapport_;
import * as formation_ from './formation';
const { lineOf } = formation_;
import { caught, deepCut, defendDuels, execute, keeperHands, resolveFlight, shoot, takeCorner, takeFreeKick, takePenalty } from './actions';
import * as rating_ from './rating';
const { computeRatings } = rating_;
import { checkAdvantage, contactFouls, giveCard, issuePendingCards } from './referee';
import { aiSubs, myMinutes } from './subs';
import { event, kickoffPositions, kickoffTaker, nearestTaker, penaltyTaker, setOwner, setRestart } from './core';
import { keeperFlightDue, refreshErrors, transitionTick, updateOffball, updateSituations } from './offball';
import { candidates, choose, judgementOf, notePassive } from './onball';
import { aerialMoment, autoCardDecide, duelMoment, halftimeMoment, initMoments, intentShot, onballMoment, setPieceMoment, settleMoment, slipPick, takeMoment, type Moment, type MomentChoice } from './moments';
import { AUTO_REACT, cardReport, cardsFinish, cardsTick, checkWatch, consumeCombos, initCards, prepCands, startWatch, tagsOf, type ActionMod, type CardUse } from './cards';
import type { Candidate } from './onball';
import * as physics_ from './physics';
const { burstCap, clearFeed, initPhysics, moveAgentMV, perceiveFeed, setMove } = physics_;
import * as tactics_ from './tactics';
const { aiAdjust, TENDENCY } = tactics_;
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, inOppBox, L, outOfPlay, W } = pitch_;
import * as rng_ from './rng';
const { Purpose, rand } = rng_;
import * as roles_ from './roles';
const { defaultRole, roleById } = roles_;
import { type Agent, type SimState } from './state';
import { fitGaps } from './fit';
import * as state_ from './state';
const { emptyPlayerStats, emptyTeamStats } = state_;
import type { EngineInput, EngineResult, Frame, PlayerSpec, Tactics, TeamSetup } from './types';

const T = ENGINE.time;
const B = ENGINE.ball;

/** 능력치 곡선 (E.24): 70 을 중심으로 차이를 curveK 배로 줄인다. 90 넘게는 그 절반 기울기, 50 아래는 같은 기울기 */
export function curveAttr(x: number): number {
  const C = ENGINE.prob;
  const at = (v: number): number => C.curveCenter + C.curveK * (v - C.curveCenter);
  if (x > C.curveHigh) return at(C.curveHigh) + C.curveTopRatio * C.curveK * (x - C.curveHigh);
  if (x < C.curveLow) return at(C.curveLow) + C.curveK * (x - C.curveLow);
  return at(x);
}

function curveAttrs<T extends object>(a: T): T {
  const out = {} as Record<string, number>;
  for (let i_1 = 0, a_1 = Object.entries(a); i_1 < a_1.length; i_1++) { const [k, v] = a_1[i_1]!; out[k] = curveAttr(v as number); }
  // C.81e 계산 속도: 키를 하나씩 붙인 객체는 V8 이 사전(느린) 모드로 둔다 — 같은 키 순서·같은 값으로 펼쳐 빠른 모드 객체로 (능력치는 경기 내내 수백 번 읽힌다)
  return { ...out } as T;
}

/** GK 의 필드 능력치 (이동, 패스에 쓴다): 킥은 패스, 나머지는 보통 수준 */
export function gkFieldAttributes(gk: GkAttributes): FieldAttributes {
  const out = {} as FieldAttributes;
  for (let i_2 = 0, a_2 = FIELD_ATTRIBUTES; i_2 < a_2.length; i_2++) { const a = a_2[i_2]!; out[a] = 45; }
  out.shortPassing = gk.distribution;
  out.longPassing = gk.distribution;
  out.vision = Math.round((gk.distribution + 50) / 2);
  out.composure = Math.round((gk.handling + 50) / 2);
  out.ballControl = Math.round((gk.handling + 40) / 2);
  out.pace = 50;
  out.acceleration = 55;
  out.agility = Math.round((gk.shotStopping + 50) / 2);
  out.jumping = Math.round((gk.commandOfArea + 50) / 2);
  out.strength = 60;
  out.stamina = 50;
  return out;
}

export type Decision = { kind: 'decision'; id: string; moment: Moment };
export type Done = { kind: 'done'; result: EngineResult };

export interface MatchSim {
  readonly state: SimState;
  /** 직접 모드: 다음 결정 순간까지 (없으면 끝까지) */
  runUntilDecision(): Decision | Done;
  /** 결정 순간 확정: 선택지 인덱스, 맡기기, 또는 카드와 함께 (E.11, C.36) */
  resolve(choice: MomentChoice): void;
  runToEnd(): EngineResult;
  /** 렌더용 위치 샘플 (현재 상태) */
  frame(): Frame;
  /** 한 틱 진행 */
  step(): void;
}

/**
 * 실수 필드 표현 고정 (C.81e 계산 속도, 값 불변): 0 같은 정수로 시작해 나중에 실수가 들어가는 필드는 V8 이 첫 경기 중에 객체 모양을 바꾸고
 * 그 사이 여러 모양을 본 읽기 자리가 느린 경로(megamorphic)로 굳는다. 만들자마자 실수를 한 번 넣었다가 원래 값으로 되돌려 처음부터 실수 표현으로 둔다
 */
function fixDoubles(o: object, keys: readonly string[]): void {
  const r = o as Record<string, unknown>;
  for (let i_3 = 0, a_3 = keys; i_3 < a_3.length; i_3++) { const k = a_3[i_3]!;
    const v = r[k];
    r[k] = 0.5;
    r[k] = v;
  }
}
/** 선수 객체에서 정수로만 쓰는 필드 (표현 고정에서 뺀다) */
const AGENT_INT = new Set(['idx', 'team', 'line', 'tvIdx', 'errTick', 'errDone', 'carryN', 'shotPath', 'trackIdx', 'stepOutIdx']);
let agentDoubles: string[] | null = null;
const STATE_DOUBLES = ['t', 'elapsed', 'halfEnd', 'bsx', 'bsy', 'possSince', 'possStartT', 'elapsed75', 'nextSubCheck'] as const;
const BALL_DOUBLES = ['x', 'y', 'z', 'vx', 'vy'] as const;
const TEAM_DOUBLES = ['phase', 'counterUntil', 'wonAt', 'lostAt', 'lineAtLoss', 'brokeAt', 'coverUntil', 'sitSince', 'sitCandSince'] as const;
const STATS_DOUBLES = ['distance', 'distance75', 'rating'] as const;

function makeAgent(spec: PlayerSpec, team: 0 | 1, idx: number, setup: TeamSetup, home: boolean): Agent {
  const slots = setup.customSlots ?? FORMATION_SLOTS[setup.formation];
  const slot = slots[spec.slot] ?? slots[0]!;
  // 능력치 체감 (E.20 11번): 모든 능력치에 같은 S자 곡선을 여기 한 곳에서 적용한다
  const attrs = curveAttrs(spec.attrs);
  const gk = spec.gk ? { type: spec.gk.type, attrs: curveAttrs(spec.gk.attrs) } : null;
  const pos = spec.slot >= 0 ? slot.pos : spec.position;
  const a: Agent = {
    // 줄 소속: 커스텀 칸은 칸의 줄(E.5.1), 아니면 포지션
    idx, id: spec.id, team, spec, attrs, gk, pos, line: spec.slot >= 0 && slot.line !== undefined ? slot.line : lineOf(pos),
    role: roleById(spec.role) ?? defaultRole(pos, attrs),
    sx: slot.x, sy: slot.y, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, tvx: 0, tvy: 0, tvIdx: -1, tvwx: 1, tvwy: 1, hx: team === 0 ? 1 : -1, hy: 0, hMx: NaN, hMy: NaN, hA: 0, thUx: NaN, thUy: NaN, thHx: NaN, thHy: NaN, thStep: NaN, thRx: 0, thRy: 0, urgent: false,
    maxSpeed: 0, accel: 0, turnKeep: 0, pivotT: 0, burstSec: 0, drainAttr: 0, stamina: spec.stamina, burst: 100, burstOut: false, judgement: 0, cooldown: 0, nextOffball: 0,
    runUntil: 0, giveGoT: -1, giveGo: false, exitRun: false, supportRun: false, gapY: -1, vacRun: false, overlap: false, errX: 0, errY: 0, errTick: -1, errDone: -1, errT: -Infinity, beatenUntil: 0, onPitch: spec.slot >= 0, sprinting: false, backToGoal: false, recoverUrgent: false, minRun: false, drainMul: 1, duelEdge: 0, body: bodyMods(spec.body),
    stats: { ...emptyPlayerStats(spec.id, team, pos), slot: spec.slot }, enteredAt: 0, leftAt: null,
    rt: { forward: 0, lost: 0, dangerLost: 0, attackLost: 0, conceded: 0, card: undefined, relief: undefined, risky: undefined, riskLost: undefined, passive: undefined, passiveW: undefined, passiveSeq: undefined, passivePoss: undefined, passiveCtr: undefined }, gotBy: 'gain', ballT: 0, lastMoveT: -100, carryN: 0, dribbleT: -100, shotPath: 6, duelNext: 0, laneUntil: 0, paceCap: 0, trackIdx: -1, trackUntil: 0, trackOut: -1, stepOutIdx: -1, stepOutGo: false, stepOutUntil: 0,
    pre: null, otMul: 1, otUntil: -1,
    // C.81e 계산 속도: 나중에 붙던 속성을 처음부터 (하프타임에 모든 선수 객체 모양이 바뀌어 최적화 코드가 버려지던 것 — 값·판정 같음)
    intent: null, cardBoost: undefined,
  };
  initPhysics(a);
  // 홈 이점 (E.18 A7): 판단 품질 + homeJudgement, 듀얼 로짓 + homeDuel (능력치 가산 없음)
  a.judgement = judgementOf(a) + (home ? ENGINE.match.homeJudgement : 0);
  a.duelEdge = home ? ENGINE.match.homeDuel : 0;
  agentDoubles ??= Object.keys(a).filter((k) => typeof (a as unknown as Record<string, unknown>)[k] === 'number' && !AGENT_INT.has(k));
  fixDoubles(a, agentDoubles);
  fixDoubles(a.stats, STATS_DOUBLES);
  return a;
}

export function createState(input: EngineInput): SimState {
  const agents: Agent[] = [];
  const bench: [Agent[], Agent[]] = [[], []];
  const setups = [input.home, input.away] as const;
  const home = (team: number) => !input.neutral && team === 0;
  setups.forEach((setup, team) => {
    for (let i_4 = 0, a_4 = setup.lineup; i_4 < a_4.length; i_4++) { const spec = a_4[i_4]!; agents.push(makeAgent(spec, team as 0 | 1, agents.length, setup, home(team))); }
  });
  setups.forEach((setup, team) => {
    for (let i_5 = 0, a_5 = setup.bench; i_5 < a_5.length; i_5++) { const spec = a_5[i_5]!; bench[team]!.push(makeAgent({ ...spec, slot: -1 }, team as 0 | 1, -1, setup, home(team))); }
  });
  const added1 = 60 * (T.addedFirst[0] + Math.floor(rand(input.seed, 0, 0, Purpose.Added) * (T.addedFirst[1] - T.addedFirst[0] + 1)));
  const s: SimState = {
    input, seed: input.seed >>> 0, t: 0, elapsed: 0, tick: 0, half: 1, halfEnd: T.halfSeconds + added1,
    agents, bench,
    ball: { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, owner: -1, flight: null, lastTouch: -1, lastTeam: 0, reserve: null, kick: null, handBlock: null, defHold: null },
    bsx: L / 2, bsy: W / 2,
    teams: setups.map((setup, team) => ({
      setup: { teamId: setup.teamId, tactics: setup.tactics, rating: setup.rating },
      tactics: { ...setup.tactics }, stats: emptyTeamStats(), phase: 0, subsLeft: 3, counterUntil: 0, counterPressers: [] as number[], wonAt: -100, lostAt: -100, lineAtLoss: -1, brokeAt: -100, coverUntil: 0, coverAgent: -1, gkChase: false, parryT: -100, cutFlight: null, cutIdx: -1, sit: '-' as const, sitSince: 0, sitCand: '-' as const, sitCandSince: 0,
      fit: fitGaps(agents.filter((a) => a.team === team && a.onPitch && !a.gk).map((a) => ({ attrs: a.spec.attrs, pos: a.pos }))),
      stackOver: stackOver(agents.filter((a) => a.team === team && a.onPitch).map((a) => a.pos)),
    })) as SimState['teams'],
    possTeam: 0, possSince: 0, restart: null, lastPass: null, events: [],
    advantage: null, pendingCards: [], exemptPass: false, lastOwner: -1, lastWasShot: false, nextSubCheck: 0, done: false, offsideX: [0.5, 0.5], lastShotT: [-100, -100], boxLand: null,
    possOrigin: 'kickoff', possStartT: 0, snap75: false, elapsed75: 0,
    moments: initMoments(input.control), forcedDuel: null, cards: initCards(input.cards, input.seed),
    env: resolveEnv(input.env),
    rapport: resolveRapport(input.rapport),
    onVer: 0, manVer: -1, manD0: 0,
  };
  fixDoubles(s, STATE_DOUBLES);
  fixDoubles(s.ball, BALL_DOUBLES);
  for (let i_6 = 0, a_6 = s.teams; i_6 < a_6.length; i_6++) { const tm = a_6[i_6]!; fixDoubles(tm, TEAM_DOUBLES); }
  kickoffPositions(s, 0);
  setRestart(s, 'kickoff', 0, L / 2, W / 2, 0);
  event(s, 'kickoff', 0, []);
  return s;
}

/** 재개 키커 다시 고르기 (C.78k): 종류별 원래 선정 규칙 (킥오프 = 가장 앞선 선수, PK = 지정 키커, 그 밖 = 공에 가장 가까운 선수). 없으면 −1 */
function pickTaker(s: SimState, r: NonNullable<SimState['restart']>): number {
  if (r.type === 'kickoff') return kickoffTaker(s, r.team)?.idx ?? -1;
  if (r.type === 'penalty') return penaltyTaker(s, r.team);
  return nearestTaker(s, r.type, r.team, r.x, r.y);
}

/** 키커가 경기장에 있는가 (교체·퇴장으로 빠졌으면 false) */
function takerReady(s: SimState, r: NonNullable<SimState['restart']>): boolean {
  const t = s.agents[r.taker];
  return !!t && t.onPitch && t.team === r.team;
}

function executeRestart(s: SimState): void {
  const r = s.restart!;
  // 키커가 빠졌으면 (C.78k) 같은 팀에서 다시 고른다. 고를 사람이 없을 때만 재개를 버린다
  if (!takerReady(s, r)) r.taker = pickTaker(s, r);
  const taker = s.agents[r.taker];
  s.restart = null;
  for (let i_7 = 0, a_7 = s.agents; i_7 < a_7.length; i_7++) { const a = a_7[i_7]!; a.paceCap = 0; }
  if (!taker || !taker.onPitch) return;
  setOwner(s, taker);
  taker.cooldown = 0;
  s.possSince = s.t - ENGINE.formation.attackPhaseDelay * 0.5;
  s.possOrigin = r.type;
  s.possStartT = s.t;
  if (r.type === 'throwIn') s.teams[r.team].stats.throwIns++;
  else if (r.type === 'goalKick') s.teams[r.team].stats.goalKicks++;
  if (r.type !== 'kickoff' && r.type !== 'penalty' && r.type !== 'freeKick') event(s, r.type, r.team, [taker.id]);
  s.exemptPass = r.type === 'throwIn' || r.type === 'goalKick' || r.type === 'corner';
  if (r.type === 'penalty') takePenalty(s, taker);
  else if (r.type === 'corner') takeCorner(s, taker);
  else if (r.type === 'freeKick') {
    if (!takeFreeKick(s, taker, r.indirect ?? false)) event(s, 'freeKick', r.team, [taker.id]);
  }
}

/** 재개 실행. 내 선수가 PK·직접 프리킥 키커이고 그 장면 카드가 있으면 (C.36) 직접 모드는 멈추고(true), 자동은 카드 보정을 붙여 실행 */
function runRestart(s: SimState): boolean {
  if (s.cards && setPieceMoment(s)) return true;
  executeSetPiece(s);
  return false;
}

/** 재개 실행 + 키커 카드 보정 (s.cards.sp: 그 재개에만) */
function executeSetPiece(s: SimState): void {
  const cs = s.cards;
  if (!cs?.sp) return executeRestart(s);
  cs.mod = cs.sp;
  executeRestart(s);
  cs.mod = null;
  cs.sp = null;
  checkWatch(s);
}

/**
 * 재개 시각이 됐다 (C.24): 키커가 공 takerReach m 안이면 실행. 아니면 repick 초마다 미루며 가장 가까운 선수로 다시 고르고,
 * lateMax 초가 지나도 멀면 (나올 수 없지만 방어적으로) 공을 키커 자리로 옮겨 실행한다 (스로인은 라인 위).
 * 세트피스 결정 순간에 멈췄으면 true
 */
function restartDue(s: SimState): boolean {
  const r = s.restart!;
  const R = ENGINE.restart;
  // 키커가 교체·퇴장으로 빠졌다 (C.78k): 재개는 그대로 두고 같은 팀 대체 키커가 공으로 간다 (PK 는 지정 키커 규칙)
  if (!takerReady(s, r)) {
    const pick = pickTaker(s, r);
    if (pick < 0) {
      executeRestart(s);
      return false;
    }
    r.taker = pick;
  }
  let taker = s.agents[r.taker]!;
  if (dist(taker.x, taker.y, r.x, r.y) < R.takerReach) return runRestart(s);
  r.at0 ??= r.at;
  if (s.t >= r.at0 + R.lateMax) {
    if (r.type !== 'kickoff' && r.type !== 'penalty') {
      r.x = clamp(taker.x, 0.5, L - 0.5);
      if (r.type !== 'throwIn') r.y = clamp(taker.y, 0.5, W - 0.5);
    }
    s.ball.x = r.x;
    s.ball.y = r.y;
    return runRestart(s);
  }
  r.at = s.t + R.repick;
  if (r.type !== 'kickoff' && r.type !== 'penalty') {
    const pick = nearestTaker(s, r.type, r.team, r.x, r.y);
    if (pick >= 0) r.taker = pick;
    taker = s.agents[r.taker]!;
  }
  taker.tx = r.x;
  taker.ty = r.y;
  taker.urgent = true;
  return false;
}

/** 소유자 결정. 내 선수이고 덱이 있으면 (C.36) 패시브를 얹고, 자동 모드 카드 기회면 F.5 규칙으로 카드를 쓴다 */
function decide(s: SimState, a: Agent): void {
  // 원터치 (C.78b): 받는 순간 미리 정한 행동을 그대로 실행 (판단·기록은 그때 끝났다)
  if (a.pre) {
    const c = a.pre;
    a.pre = null;
    if (c.type !== 'holdup') a.backToGoal = false;
    return execute(s, a, c);
  }
  const cands = candidates(s, a);
  // 몰고 가다 슛 둘째 단 (C.75k, 직접 모드에서 고른 의도만): 슛 후보가 있으면 그 슛
  const forced = a.intent ? intentShot(s, a, cands) : null;
  if (a.intent) a.intent = null;
  if (forced) {
    if (s.cards) return runMine(s, a, forced, null, null, true);
    a.backToGoal = false;
    return execute(s, a, forced);
  }
  if (s.cards && a.spec.isMe) {
    prepCands(s, a, cands);
    const r = autoCardDecide(s, a, cands);
    const c = r ? r.cand : slipPick(s, a, cands, choose(s, a, cands));
    notePassive(s, a, c, cands);
    if (r) return runMine(s, a, r.cand, r.mod, r.use, true);
    return runMine(s, a, c, null, null, false);
  }
  // 판단 미끄러짐 (C.75h B안): 내 선수만
  const c = a.spec.isMe ? slipPick(s, a, cands, choose(s, a, cands)) : choose(s, a, cands);
  // 소극적 백패스 (C.77s A1): 평점 기록만 (선택은 그대로)
  notePassive(s, a, c, cands);
  if (c.type !== 'holdup') a.backToGoal = false;
  execute(s, a, c);
}

/** 내 선수 행동 실행 (카드 보정은 이 실행에만), 결정 순간·카드 기회면 결과 판정 시작 */
function runMine(s: SimState, a: Agent, c: Candidate, mod: ActionMod | null, use: CardUse | null, watch: boolean, down = 0): void {
  const cs = s.cards!;
  // 쓴 콤보는 이 행동에서 지운다 (슛은 실행 훅에서)
  if (cs.combos.length && c.type !== 'shoot') consumeCombos(s, a, tagsOf(s, a, c));
  if (watch) startWatch(s, a, c.type, mod, use, down);
  cs.mod = mod;
  if (c.type !== 'holdup') a.backToGoal = false;
  execute(s, a, c);
  cs.mod = null;
  if (watch) checkWatch(s);
}



function updateLooseBall(s: SimState): void {
  const b = s.ball;
  const dt = T.dt;
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  const [px, py] = [b.x, b.y];
  if (sp > 0) {
    // 날씨 (C.74a): 비 = 더 굴러감, 눈 = 덜 굴러감
    const nsp = Math.max(0, sp - ENGINE.ball.groundDecel * s.env.ballDecel * dt);
    b.vx *= nsp / sp;
    b.vy *= nsp / sp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  // 받기로 한 선수에게 굴러가는 공 (C.24): 그 선수는 컨트롤 판정 없이 잡는다. 패스·공중볼 승자 받기만 상대가 reserveSteal m 안에서
  // 먼저 뺏을 수 있고, 이미 판정이 끝난 공(빼앗기·가로채기·GK 처리)은 아무도 끼어들지 못한다
  const res = b.reserve;
  if (res && s.t > res.until) b.reserve = null;
  else if (res) {
    const rc = s.agents[res.idx]!;
    if (rc.onPitch && dist(rc.x, rc.y, b.x, b.y) <= B.reserveCatch) {
      caught(s, rc, res);
      return;
    }
    if (rc.onPitch && res.kind !== 'receive' && res.kind !== 'win') return;
  }
  if (keeperHands(s, sp, px, py)) return;
  if (sp >= B.controlMaxSpeed) return;
  // 공 컨트롤 시도 (E.4)
  let winner: Agent | null = null;
  let bestRoll = Infinity;
  for (let i_8 = 0, a_8 = s.agents; i_8 < a_8.length; i_8++) { const a = a_8[i_8]!;
    if (!a.onPitch || dist(a.x, a.y, b.x, b.y) > (b.reserve ? B.reserveSteal : B.controlDist)) continue;
    if (b.reserve && (a.team === s.agents[b.reserve.idx]!.team || a.idx === b.reserve.from)) continue;
    const pressure = nearestOpponentDist(s, a) < 2 ? 0.1 : 0;
    // 날씨 (C.74a): 젖은·언 공 컨트롤 × touch
    let p = (B.controlBase + (B.controlSlope * a.attrs.ballControl) / 100 - B.controlSpeedPenalty * (sp / 10) - pressure) * s.env.touch;
    // C.81h 세컨볼: GK 가 쳐낸 직후 수비 팀 필드 선수는 한 박자 늦는다
    if (b.defHold && a.team === b.defHold.team && a.line !== 0 && s.t < b.defHold.until) p *= ENGINE.keeper.parryDefControl;
    const roll = rand(s.seed, s.tick, a.idx, Purpose.Control);
    if (roll < p && roll / p < bestRoll) {
      bestRoll = roll / p;
      winner = a;
    }
  }
  if (winner) setOwner(s, winner);
}

function nearestOpponentDist(s: SimState, a: Agent): number {
  let bd = Infinity;
  for (let i_9 = 0, a_9 = onOf(s, (1 - a.team) as 0 | 1); i_9 < a_9.length; i_9++) { const o = a_9[i_9]!; bd = Math.min(bd, dist(o.x, o.y, a.x, a.y)); }
  return bd;
}

/** 공이 라인을 넘었다: 스로인, 골킥, 코너킥 */
function ballOut(s: SimState): void {
  const b = s.ball;
  const last = b.lastTeam;
  const other = (1 - last) as 0 | 1;
  if (b.y < 0 || b.y > W) {
    setRestart(s, 'throwIn', other, clamp(b.x, 0.5, L - 0.5), b.y < 0 ? 0 : W, 'auto');
    return;
  }
  // 골라인: 넘은 쪽 골을 지키는 팀
  const defending: 0 | 1 = attackDir(0, s.half) > 0 ? (b.x > L ? 1 : 0) : (b.x > L ? 0 : 1);
  const attacking = (1 - defending) as 0 | 1;
  if (last === defending) {
    s.teams[attacking].stats.corners++;
    setRestart(s, 'corner', attacking, b.x > L ? L : 0, b.y < W / 2 ? 0 : W, 'auto');
  } else {
    const gx = b.x > L ? L - 5.5 : 5.5;
    setRestart(s, 'goalKick', defending, gx, W / 2 + (b.y < W / 2 ? -9 : 9), 'auto');
  }
}

function startSecondHalf(s: SimState): void {
  s.half = 2;
  // 시계가 되돌아가는 폭 (전반 추가시간)
  const back = s.t - T.halfSeconds;
  s.t = T.halfSeconds;
  const added2 = 60 * (T.addedSecond[0] + Math.floor(rand(s.seed, 1, 0, Purpose.Added) * (T.addedSecond[1] - T.addedSecond[0] + 1)));
  s.halfEnd = 2 * T.halfSeconds + added2;
  for (let i_10 = 0, a_10 = s.agents; i_10 < a_10.length; i_10++) { const a = a_10[i_10]!;
    a.runUntil = 0;
    a.giveGoT = -1;
    a.giveGo = false;
    a.exitRun = false;
    a.supportRun = false;
    a.gapY = -1;
    a.vacRun = false;
    a.overlap = false;
    // C.45: 시계가 전반 추가시간(예 2840초)에서 2700초로 돌아가므로 전반에 잡아 둔 시각들도 비운다.
    // 그대로 두면 오프더볼 갱신이 전반 끝 시각까지 멈춰 후반 시작 뒤 최대 2분 넘게 제자리에 서 있는 선수가 생긴다
    a.nextOffball = 0;
    a.errT = -Infinity;
    a.beatenUntil = 0;
    a.duelNext = 0;
    a.laneUntil = 0;
    a.trackIdx = -1;
    a.trackUntil = 0;
    a.trackOut = -1;
    a.stepOutIdx = -1;
    a.stepOutUntil = 0;
    // C.78k: 원터치(미리 정한 행동·실행 배수), 몰고 가다 슛 의도, 측정용 몰고 가기·돌파 시각, 소극적 백패스 소유 순번(possStartT 가 후반 시각과 겹칠 수 있다)
    a.pre = null;
    a.otUntil = -1;
    a.intent = null;
    a.lastMoveT = -100;
    a.dribbleT = -100;
    a.carryN = 0;
    a.rt.passivePoss = undefined;
    a.rt.passiveSeq = undefined;
    a.rt.passiveCtr = undefined;
    a.stamina = Math.min(100, a.stamina + ENGINE.physics.halftimeRecover * s.env.recover);
    a.burst = burstCap(a);
    a.burstOut = false;
  }
  resetHalfClocks(s, back);
  kickoffPositions(s, 1);
  setRestart(s, 'kickoff', 1, L / 2, W / 2, 0);
}

/**
 * 하프타임 시각 초기화 (C.78k): 시계(s.t)가 전반 추가시간(예 2840초)에서 2700초로 돌아가므로, s.t 로 잰 "이 시각까지 유효"·"마지막으로 ~한 시각"을
 * 경기 시작 때 값으로 되돌린다. 그대로 두면 후반 초반 최대 약 2분 동안 전반 끝 사건이 방금 일어난 일로 읽힌다
 * (리바운드 슛·결정 순간 분류, 원터치 배수, 돌파 후 커버, 역압박·역습·전환 수비 창, 어시스트 후보 패스 등).
 * 하프타임은 경기 중단이라 진행 중이던 결정 순간·카드 판정도 여기서 닫는다 (경기 끝과 같은 방식). 카드 드로우 일정만 경기 시간으로 이어 간다
 */
function resetHalfClocks(s: SimState, back: number): void {
  s.lastShotT = [-100, -100];
  s.teams[0].parryT = s.teams[1].parryT = -100;
  s.boxLand = null;
  s.lastPass = null;
  s.possSince = s.t;
  s.possStartT = s.t;
  for (let i_11 = 0, a_11 = s.teams; i_11 < a_11.length; i_11++) { const tm = a_11[i_11]!;
    tm.counterUntil = 0;
    tm.counterPressers = [];
    tm.wonAt = -100;
    tm.lostAt = -100;
    tm.lineAtLoss = -1;
    tm.brokeAt = -100;
    tm.coverUntil = 0;
    tm.coverAgent = -1;
    tm.sitSince = s.t;
    tm.sitCandSince = s.t;
  }
  settleMoment(s, true);
  const ms = s.moments;
  ms.lastStopT = -100;
  ms.relief = null;
  const cs = s.cards;
  if (cs) {
    cardsFinish(s);
    cs.lastOccT = -100;
    cs.lastTackleT = -100;
    cs.react = null;
    for (let i_12 = 0, a_12 = cs.combos; i_12 < a_12.length; i_12++) { const c = a_12[i_12]!; c.armedT = s.t; }
    if (cs.started) cs.nextDraw -= back;
  }
}

function finish(s: SimState): void {
  s.done = true;
  settleMoment(s, true);
  if (s.cards) cardsFinish(s);
  for (let i_13 = 0, a_13 = s.agents; i_13 < a_13.length; i_13++) { const a = a_13[i_13]!; a.leftAt ??= s.elapsed; }
  event(s, 'fulltime', 0, []);
}

export function step(s: SimState): void {
  if (s.done || s.moments.pending) return;
  const dt = T.dt;
  boxLandTick(s);

  checkAdvantage(s);
  if (s.restart && s.pendingCards.length) issuePendingCards(s);
  const fr = s.input.forceRed;
  if (fr && Math.abs(s.t - fr.minute * 60) < dt / 2) {
    const victim = onOf(s, fr.team).find((a) => a.line === 2 && !a.spec.isMe);
    if (victim) giveCard(s, victim, 'red');
  }
  aiSubs(s);
  myMinutes(s);
  aiAdjust(s);

  if (s.restart && s.t >= s.restart.at && restartDue(s) && pauseOrDecide(s)) return;
  stepBody(s);
}

/** 측정용 (C.81a): 크로스·컷백 비행이 끝나는 순간 상대 박스 안 그 팀 필드 선수 수 (찬 선수 포함) */
function boxLandTick(s: SimState): void {
  const w = s.boxLand;
  if (!w) return;
  if (w.fl === null) {
    if (s.ball.flight) w.fl = s.ball.flight;
    else s.boxLand = null;
    return;
  }
  if (s.ball.flight === w.fl) return;
  const dir = attackDir(w.team, s.half);
  let n = 0;
  for (let i_14 = 0, a_14 = fieldOf(s, w.team); i_14 < a_14.length; i_14++) { const a = a_14[i_14]!; if (inOppBox(a.x, a.y, dir)) n++; }
  s.teams[w.team].stats.boxAtLand += n;
  s.teams[w.team].stats.boxLandN++;
  s.boxLand = null;
}

/** 오프더볼, 소유자 결정, 수비 태클, 이동·공·시계 (세트피스 결정 순간 뒤에는 여기서 이어 간다) */
function stepBody(s: SimState): void {
  const dt = T.dt;
  // 오프더볼 목표 갱신 (선수마다 엇갈리게)
  // GK 는 루즈볼이면 chaseRefresh 초마다 다시 본다 (C.28 루즈볼 추격)
  const looseNow = s.ball.owner < 0 && !s.restart && (!s.ball.flight || s.ball.flight.outcome === 'loose');
  updateSituations(s);
  transitionTick(s);
  for (let i_15 = 0, a_15 = s.agents; i_15 < a_15.length; i_15++) { const a = a_15[i_15]!;
    if (!a.onPitch || a.idx === s.ball.owner) continue;
    if (s.t >= a.nextOffball || (looseNow && a.line === 0 && a.nextOffball - s.t > ENGINE.keeper.chaseRefresh) || (a.line === 0 && keeperFlightDue(s, a))) {
      refreshErrors(s, a);
      updateOffball(s, a);
      a.nextOffball = s.t + T.offballInterval * (0.7 + 0.6 * rand(s.seed, s.tick, a.idx, Purpose.Offball, 2));
      if (looseNow && a.line === 0) a.nextOffball = Math.min(a.nextOffball, s.t + ENGINE.keeper.chaseRefresh);
    }
  }

  // 소유자 결정, 수비 태클
  const b = s.ball;
  for (let i_16 = 0, a_16 = s.agents; i_16 < a_16.length; i_16++) { const a = a_16[i_16]!; if (a.cooldown > 0) a.cooldown -= dt; }
  if (b.owner >= 0 && !s.restart) {
    const o = s.agents[b.owner]!;
    // 내 선수 결정 순간 (E.11): 멈출 순간이면 여기서 멈추고 resolve 가 나머지 틱을 이어서 한다
    if (o.cooldown <= 0) {
      if (!onballMoment(s, o)) {
        decide(s, o);
        // 상대 슈팅 카드 장면 (C.40): shoot 가 슛을 미루고 멈췄다 (결정 뒤 applyChoice 가 같은 틱에 슛)
        if (s.moments.pending && pauseOrDecide(s)) return;
      } else if (pauseOrDecide(s)) return;
    } else if (!contactFouls(s)) {
      if (!duelMoment(s)) defendDuels(s);
      else if (pauseOrDecide(s)) return;
    }
  }
  // 공중볼 카드 장면 (C.40): 이번 틱에 뜬 공중볼 (공은 이미 떠 있고, 고른 카드는 경합 때 붙는다)
  if (s.cards && aerialMoment(s) && pauseOrDecide(s)) return;
  stepTail(s);
}

/**
 * 하프타임 전술 변경 (C.75k, E.19): 내 팀 전술(성향·세부 전술)을 바꾼다. aiAdjust 가 setup.tactics 에서 다시 만들므로 둘 다 바꾼다.
 * 역할·포메이션은 바꾸지 않는다. 결정 기록에 한 줄 남긴다
 */
export function applyHalftimeTactics(s: SimState, team: 0 | 1, tactics: Tactics, label = '하프타임 전술 변경'): void {
  const T = s.teams[team];
  T.setup.tactics = { ...tactics };
  T.tactics = { ...tactics };
  const ms = s.moments;
  ms.log.push({
    id: ms.nextId++, minute: Math.floor(s.t / 60) + 1, scene: 'halftime', choice: 'balanced', label, p: null, result: 'neutral', delta: 0,
    e: Math.round(s.elapsed * 10) / 10, stake: 0,
  });
}

/** 정책이 있으면(자동 측정·봇) 바로 확정해 실행하고 false, 없으면(직접 모드 화면) 멈추고 true */
function pauseOrDecide(s: SimState): boolean {
  const pol = s.moments.control.policy;
  if (!pol) return true;
  applyChoice(s, pol(s.moments.pending!));
  return false;
}

function applyChoice(s: SimState, choice: MomentChoice): void {
  const m = s.moments.pending!;
  const r = takeMoment(s, choice);
  const me = s.agents.find((x) => x.spec.isMe)!;
  if (m.type === 'setPiece') {
    // 세트피스 (C.36): 고른 카드 보정을 그 재개 실행에 붙인다. 맡기기면 엔진 그대로
    if (s.cards && r.action) {
      startWatch(s, me, r.action, r.mod, r.use);
      s.cards.sp = r.mod;
    }
    executeSetPiece(s);
    return;
  }
  if (m.type === 'react') {
    // 카드 장면 (C.40): 계획만 남긴다. 상대 슈팅이면 미뤄 둔 슛을 지금 (같은 틱) 실행한다
    const sh = (m as Moment & { react: { shooter?: number } }).react.shooter;
    if (sh !== undefined) {
      const shooter = s.agents[sh]!;
      // 맡기기: 다시 멈추지 않게 "자동" 계획을 남긴다 (조건 맞는 첫 장, 지금 규칙)
      s.cards!.react ??= { kind: 'block', id: AUTO_REACT, until: s.t + 0.5, shooter: sh };
      shoot(s, shooter, false);
      if (s.cards!.react?.id === AUTO_REACT) s.cards!.react = null;
    }
    return;
  }
  if (m.type === 'onball') {
    const o = s.agents[s.ball.owner]!;
    if (r.cand) notePassive(s, o, r.cand, (m as Moment & { cands?: Candidate[] }).cands ?? []);
    if (r.cand && s.cards) runMine(s, o, r.cand, r.mod, r.use, true, r.down);
    else if (r.cand) {
      if (r.cand.type !== 'holdup') o.backToGoal = false;
      execute(s, o, r.cand);
    } else decide(s, o);
  } else {
    if (r.duel !== null) s.forcedDuel = { idx: me.idx, ...r.duel };
    if (s.cards && r.action) startWatch(s, me, r.action, r.mod, r.use, r.down);
    defendDuels(s);
    if (s.cards) checkWatch(s);
  }
}

/** 멈춘 틱 이어서: 결정 실행 후 이동·공·시계 (세트피스면 재개 실행 뒤 그 틱의 나머지 전부) */
function resume(s: SimState, choice: MomentChoice): void {
  if (!s.moments.pending) return;
  // 하프타임 (C.75k): 틱은 이미 끝났다. 전술은 확정 전에 applyHalftimeTactics 로 (변경 없음·맡기기 = 그대로 이어감, 난수 안 씀)
  if (s.moments.pending.type === 'halftime') {
    takeMoment(s, choice);
    return;
  }
  const sp = s.moments.pending.type === 'setPiece';
  applyChoice(s, choice);
  if (sp) stepBody(s);
  else stepTail(s);
}

function stepTail(s: SimState): void {
  const dt = T.dt;
  const b = s.ball;
  settleMoment(s);

  // 이동
  // 팀 몫 (C.81e: 팀마다 한 번 — 곱하는 순서 그대로라 같은 값)
  const t0 = s.teams[0];
  const t1 = s.teams[1];
  const PH = ENGINE.physics;
  const td0 = (PH.pressDrainBase + PH.pressDrainPer * t0.tactics.pressing) * (t0.tactics.tendency === 'gegenpress' ? TENDENCY.gegenDrain : 1);
  const td1 = (PH.pressDrainBase + PH.pressDrainPer * t1.tactics.pressing) * (t1.tactics.tendency === 'gegenpress' ? TENDENCY.gegenDrain : 1);
  const envDrain = s.env.drain;
  const envRecover = s.env.recover;
  for (let i_17 = 0, a_17 = s.agents; i_17 < a_17.length; i_17++) { const a = a_17[i_17]!;
    if (!a.onPitch) continue;
    // 압박 전술의 스태미나 소모 × (pressDrainBase + pressDrainPer × pressing) (E.19 ③, C.76s 0.85 + 0.35p)
    // C.77a 가설 1: 게겐프레싱 팀 × gegenDrain, 역압박 가담 중 × counterDrain
    const tm = a.team === 0 ? t0 : t1;
    const drain = (a.team === 0 ? td0 : td1)
      * (s.t < tm.counterUntil && tm.counterPressers.includes(a.idx) ? PH.counterDrain : 1)
      // 공격 몰빵 억제 (C.80q ②): 상대 소유 중 자기 골 쪽으로 복귀하는 공격 포지션 선수 체력 소모 ×
      * (tm.stackOver > 0 ? stackDrainMul(s, a) : 1);
    // 공 가진 선수는 사람을 따라가지 않는다 (C.77x 목표 속도)
    if (a.idx === b.owner) clearFeed(a);
    else if (a.tvIdx >= 0) perceiveFeed(a, s.agents[a.tvIdx]!, dt);
    // C.80l: 게겐프레싱 팀은 지친 강도 감소에 gegenFatigue × 지친 비율^gegenFatigueExp 를 더한다 (0 = 끔)
    const gegen = tm.tactics.tendency === 'gegenpress';
    // C.81e: 인자를 칸에 담아 넘긴다 (moveAgent 와 같은 값 — 실수 인자 상자 만들기 없이)
    setMove(dt, a.idx === b.owner ? ENGINE.onball.carrySpeed : 1, drain * envDrain, envRecover, a.idx === b.owner ? NaN : b.x, b.y,
      gegen ? TENDENCY.gegenFatigue : 0, TENDENCY.gegenFatigueExp);
    moveAgentMV(a);
  }

  // 공
  if (b.owner >= 0) {
    const o = s.agents[b.owner]!;
    const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
    b.x = o.x + (sp > 0.1 ? (o.vx / sp) * 0.5 : 0);
    b.y = o.y + (sp > 0.1 ? (o.vy / sp) * 0.5 : 0);
    if (outOfPlay(b.x, b.y)) {
      // 공을 가진 채 라인 밖으로 나가지 않게 안쪽으로 (C.24: 틱당 0.4 m 까지, 바깥쪽 속도는 없앤다)
      const ix = clamp(o.x, 0.5, L - 0.5) - o.x;
      const iy = clamp(o.y, 0.5, W - 0.5) - o.y;
      o.x += clamp(ix, -0.4, 0.4);
      o.y += clamp(iy, -0.4, 0.4);
      if (ix * o.vx < 0) o.vx = 0;
      if (iy * o.vy < 0) o.vy = 0;
      b.x = clamp(b.x, 0.3, L - 0.3);
      b.y = clamp(b.y, 0.3, W - 0.3);
    }
  } else if (b.flight) {
    const fl = b.flight;
    const [px, py] = [b.x, b.y];
    resolveFlight(s);
    // 깊은 블록 비행 중 가로채기 (C.76p): 패스 선에 들어간 수비수 옆을 공이 지나면 1회 판정
    if (b.flight === fl && fl.outcome === 'receive') deepCut(s, px, py);
    // 빗나간 땅볼 패스가 박스 안 GK 옆을 지나가면 GK 가 처리한다 (C.28)
    if (b.flight === fl && fl.outcome === 'loose' && !fl.air && !s.restart) keeperHands(s, dist(fl.fromX, fl.fromY, fl.toX, fl.toY) / Math.max(0.05, fl.dur), px, py);
  } else if (!s.restart) {
    updateLooseBall(s);
  }
  if (!s.restart && b.owner < 0 && !b.flight && outOfPlay(b.x, b.y)) ballOut(s);

  if (!s.restart) s.teams[s.possTeam].stats.possessionTicks++;
  const k = Math.min(1, dt / ENGINE.formation.ballSmoothing);
  s.bsx += (b.x - s.bsx) * k;
  s.bsy += (b.y - s.bsy) * k;

  if (!s.snap75 && s.t >= 75 * 60) {
    s.snap75 = true;
    s.elapsed75 = s.elapsed;
    for (let i_18 = 0, a_18 = [...s.agents, ...s.bench[0], ...s.bench[1]]; i_18 < a_18.length; i_18++) { const a = a_18[i_18]!; a.stats.distance75 = a.stats.distance; }
  }

  if (s.cards) cardsTick(s);

  s.t += dt;
  s.elapsed += dt;
  s.tick++;
  // 슛이 날아가는 중에는 휘슬을 미룬다 (C.77t: 선방·골 판정 전에 전반이 끝나 유효 슈팅이 사라지던 것)
  const shotInAir = s.ball.flight?.kind === 'shot' && (s.ball.flight.outcome === 'shot' || s.ball.flight.outcome === 'goal');
  if (s.t >= s.halfEnd && !shotInAir) {
    if (s.half === 1) {
      event(s, 'halftime', 0, []);
      startSecondHalf(s);
      // 하프타임 전술 변경 (C.75k, E.19): 직접 모드 화면만 멈춘다 (자동·정책 있는 경기는 그대로)
      halftimeMoment(s);
    } else finish(s);
  }
}

export function frameOf(s: SimState): Frame {
  const b = s.ball;
  return {
    t: Math.round(s.t * 10) / 10,
    ball: { x: b.x, y: b.y, z: b.z, carrier: b.owner >= 0 ? s.agents[b.owner]!.id : null },
    players: s.agents.filter((a) => a.onPitch).map((a) => ({ id: a.id, x: a.x, y: a.y })),
  };
}

export function buildResult(s: SimState): EngineResult {
  const duration = Math.max(1, s.elapsed);
  const all = [...s.agents, ...s.bench[0], ...s.bench[1]];
  const played = all.filter((a) => a.leftAt !== null || a.onPitch);
  computeRatings(s, played, duration);
  const players = played
    .map((a) => {
      const played = (a.leftAt ?? s.elapsed) - a.enteredAt;
      const off = a.leftAt !== null && a.leftAt < s.elapsed - 1 ? Math.round((a.leftAt / duration) * 90) : null;
      return { ...a.stats, minutes: Math.round(Math.min(90, (played / duration) * 90)), offMinute: off, distance75: s.snap75 ? a.stats.distance75 : a.stats.distance };
    });
  const myId = s.input.myPlayerId;
  return {
    homeGoals: s.teams[0].stats.goals,
    awayGoals: s.teams[1].stats.goals,
    teamStats: [s.teams[0].stats, s.teams[1].stats],
    players,
    myStats: players.find((p) => p.id === myId) ?? null,
    events: s.events,
    decisions: s.moments.log,
    ...(s.cards ? { cards: cardReport(s) } : {}),
    ...(myRole(s) ? { myRole: myRole(s) } : {}),
    duration,
    elapsed75: s.elapsed75,
    liveSeconds: (s.teams[0].stats.possessionTicks + s.teams[1].stats.possessionTicks) * T.dt,
  };
}

function myRole(s: SimState): string | undefined {
  return [...s.agents, ...s.bench[0], ...s.bench[1]].find((a) => a.spec.isMe)?.role.id;
}

export function createMatch(input: EngineInput): MatchSim {
  const state = createState(input);
  return {
    state,
    step: () => step(state),
    runUntilDecision() {
      while (!state.done) {
        step(state);
        const m = state.moments.pending;
        if (m) return { kind: 'decision', id: String(m.id), moment: m };
      }
      return { kind: 'done', result: buildResult(state) };
    },
    resolve(choice) {
      resume(state, choice);
    },
    runToEnd() {
      // 멈춘 순간이 있으면 맡기고 끝까지 (직접 모드 경기를 중간에 끝낼 때)
      while (!state.done) {
        if (state.moments.pending) resume(state, 'delegate');
        else step(state);
      }
      return buildResult(state);
    },
    frame: () => frameOf(state),
  };
}
