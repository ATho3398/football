// 경기 시뮬 루프 (E.2, E.3): 10Hz 물리, 0.3~0.8초 간격 의사결정

import { bodyMods } from '../body';
import { FIELD_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../attributes';
import { FORMATION_SLOTS } from '../formations';
import { ENGINE } from './config';
import { lineOf } from './formation';
import { caught, defendDuels, execute, keeperHands, resolveFlight, shoot, takeCorner, takeFreeKick, takePenalty } from './actions';
import { computeRatings } from './rating';
import { checkAdvantage, contactFouls, giveCard, issuePendingCards } from './referee';
import { aiSubs, myMinutes } from './subs';
import { event, kickoffPositions, nearestTaker, setOwner, setRestart } from './core';
import { refreshErrors, updateOffball } from './offball';
import { candidates, choose, judgementOf } from './onball';
import { aerialMoment, autoCardDecide, duelMoment, initMoments, onballMoment, setPieceMoment, settleMoment, takeMoment, type Moment, type MomentChoice } from './moments';
import { AUTO_REACT, cardReport, cardsFinish, cardsTick, checkWatch, consumeCombos, initCards, prepCands, startWatch, tagsOf, type ActionMod, type CardUse } from './cards';
import type { Candidate } from './onball';
import { initPhysics, moveAgent } from './physics';
import { aiAdjust } from './tactics';
import { attackDir, clamp, dist, L, outOfPlay, toPitch, W } from './pitch';
import { Purpose, rand } from './rng';
import { defaultRole, roleById } from './roles';
import { emptyPlayerStats, emptyTeamStats, type Agent, type SimState } from './state';
import type { EngineInput, EngineResult, Frame, PlayerSpec, TeamSetup } from './types';

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
  for (const [k, v] of Object.entries(a)) out[k] = curveAttr(v as number);
  return out as T;
}

/** GK 의 필드 능력치 (이동, 패스에 쓴다): 킥은 패스, 나머지는 보통 수준 */
export function gkFieldAttributes(gk: GkAttributes): FieldAttributes {
  const out = {} as FieldAttributes;
  for (const a of FIELD_ATTRIBUTES) out[a] = 45;
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
    sx: slot.x, sy: slot.y, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, urgent: false,
    maxSpeed: 0, accel: 0, turnKeep: 0, stamina: spec.stamina, judgement: 0, cooldown: 0, nextOffball: 0,
    runUntil: 0, errX: 0, errY: 0, beatenUntil: 0, onPitch: spec.slot >= 0, sprinting: false, backToGoal: false, recoverUrgent: false, minRun: false, drainMul: 1, duelEdge: 0, body: bodyMods(spec.body),
    stats: { ...emptyPlayerStats(spec.id, team, pos), slot: spec.slot }, enteredAt: 0, leftAt: null,
    rt: { forward: 0, lost: 0, dangerLost: 0, attackLost: 0, conceded: 0 }, gotBy: 'gain', lastMoveT: -100, carryN: 0, dribbleT: -100, shotPath: 6, duelNext: 0, laneUntil: 0, paceCap: 0,
  };
  initPhysics(a);
  // 홈 이점 (E.18 A7): 판단 품질 + homeJudgement, 듀얼 로짓 + homeDuel (능력치 가산 없음)
  a.judgement = judgementOf(a) + (home ? ENGINE.match.homeJudgement : 0);
  a.duelEdge = home ? ENGINE.match.homeDuel : 0;
  return a;
}

export function createState(input: EngineInput): SimState {
  const agents: Agent[] = [];
  const bench: [Agent[], Agent[]] = [[], []];
  const setups = [input.home, input.away] as const;
  const home = (team: number) => !input.neutral && team === 0;
  setups.forEach((setup, team) => {
    for (const spec of setup.lineup) agents.push(makeAgent(spec, team as 0 | 1, agents.length, setup, home(team)));
  });
  setups.forEach((setup, team) => {
    for (const spec of setup.bench) bench[team]!.push(makeAgent({ ...spec, slot: -1 }, team as 0 | 1, -1, setup, home(team)));
  });
  const added1 = 60 * (T.addedFirst[0] + Math.floor(rand(input.seed, 0, 0, Purpose.Added) * (T.addedFirst[1] - T.addedFirst[0] + 1)));
  const s: SimState = {
    input, seed: input.seed >>> 0, t: 0, elapsed: 0, tick: 0, half: 1, halfEnd: T.halfSeconds + added1,
    agents, bench,
    ball: { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, owner: -1, flight: null, lastTouch: -1, lastTeam: 0, reserve: null, kick: null, handBlock: null },
    bsx: L / 2, bsy: W / 2,
    teams: setups.map((setup) => ({
      setup: { teamId: setup.teamId, tactics: setup.tactics, rating: setup.rating },
      tactics: { ...setup.tactics }, stats: emptyTeamStats(), phase: 0, subsLeft: 3, counterUntil: 0, counterPressers: [] as number[], wonAt: -100, coverUntil: 0, coverAgent: -1, gkChase: false,
    })) as SimState['teams'],
    possTeam: 0, possSince: 0, restart: null, lastPass: null, events: [],
    advantage: null, pendingCards: [], exemptPass: false, lastOwner: -1, lastWasShot: false, nextSubCheck: 0, done: false, offsideX: [0.5, 0.5], lastShotT: [-100, -100],
    possOrigin: 'kickoff', possStartT: 0, snap75: false, elapsed75: 0,
    moments: initMoments(input.control), forcedDuel: null, cards: initCards(input.cards, input.seed),
  };
  kickoffPositions(s, 0);
  setRestart(s, 'kickoff', 0, L / 2, W / 2, 0);
  event(s, 'kickoff', 0, []);
  return s;
}

function executeRestart(s: SimState): void {
  const r = s.restart!;
  const taker = s.agents[r.taker];
  s.restart = null;
  for (const a of s.agents) a.paceCap = 0;
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
  let taker = s.agents[r.taker];
  if (!taker || !taker.onPitch) {
    executeRestart(s);
    return false;
  }
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
  const cands = candidates(s, a);
  if (s.cards && a.spec.isMe) {
    prepCands(s, a, cands);
    const r = autoCardDecide(s, a, cands);
    if (r) return runMine(s, a, r.cand, r.mod, r.use, true);
    return runMine(s, a, choose(s, a, cands), null, null, false);
  }
  const c = choose(s, a, cands);
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
    const nsp = Math.max(0, sp - ENGINE.ball.groundDecel * dt);
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
  for (const a of s.agents) {
    if (!a.onPitch || dist(a.x, a.y, b.x, b.y) > (b.reserve ? B.reserveSteal : B.controlDist)) continue;
    if (b.reserve && (a.team === s.agents[b.reserve.idx]!.team || a.idx === b.reserve.from)) continue;
    const pressure = nearestOpponentDist(s, a) < 2 ? 0.1 : 0;
    const p = B.controlBase + (B.controlSlope * a.attrs.ballControl) / 100 - B.controlSpeedPenalty * (sp / 10) - pressure;
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
  for (const o of s.agents) if (o.onPitch && o.team !== a.team) bd = Math.min(bd, dist(o.x, o.y, a.x, a.y));
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
  s.t = T.halfSeconds;
  const added2 = 60 * (T.addedSecond[0] + Math.floor(rand(s.seed, 1, 0, Purpose.Added) * (T.addedSecond[1] - T.addedSecond[0] + 1)));
  s.halfEnd = 2 * T.halfSeconds + added2;
  for (const a of s.agents) {
    a.runUntil = 0;
    a.stamina = Math.min(100, a.stamina + ENGINE.physics.halftimeRecover);
  }
  kickoffPositions(s, 1);
  setRestart(s, 'kickoff', 1, L / 2, W / 2, 0);
}

function finish(s: SimState): void {
  s.done = true;
  settleMoment(s, true);
  if (s.cards) cardsFinish(s);
  for (const a of s.agents) a.leftAt ??= s.elapsed;
  event(s, 'fulltime', 0, []);
}

export function step(s: SimState): void {
  if (s.done || s.moments.pending) return;
  const dt = T.dt;

  checkAdvantage(s);
  if (s.restart && s.pendingCards.length) issuePendingCards(s);
  const fr = s.input.forceRed;
  if (fr && Math.abs(s.t - fr.minute * 60) < dt / 2) {
    const victim = s.agents.find((a) => a.onPitch && a.team === fr.team && a.line === 2 && !a.spec.isMe);
    if (victim) giveCard(s, victim, 'red');
  }
  aiSubs(s);
  myMinutes(s);
  aiAdjust(s);

  if (s.restart && s.t >= s.restart.at && restartDue(s) && pauseOrDecide(s)) return;
  stepBody(s);
}

/** 오프더볼, 소유자 결정, 수비 태클, 이동·공·시계 (세트피스 결정 순간 뒤에는 여기서 이어 간다) */
function stepBody(s: SimState): void {
  const dt = T.dt;
  // 오프더볼 목표 갱신 (선수마다 엇갈리게)
  // GK 는 루즈볼이면 chaseRefresh 초마다 다시 본다 (C.28 루즈볼 추격)
  const looseNow = s.ball.owner < 0 && !s.restart && (!s.ball.flight || s.ball.flight.outcome === 'loose');
  for (const a of s.agents) {
    if (!a.onPitch || a.idx === s.ball.owner) continue;
    if (s.t >= a.nextOffball || (looseNow && a.line === 0 && a.nextOffball - s.t > ENGINE.keeper.chaseRefresh)) {
      refreshErrors(s, a);
      updateOffball(s, a);
      a.nextOffball = s.t + T.offballInterval * (0.7 + 0.6 * rand(s.seed, s.tick, a.idx, Purpose.Offball, 2));
      if (looseNow && a.line === 0) a.nextOffball = Math.min(a.nextOffball, s.t + ENGINE.keeper.chaseRefresh);
    }
  }

  // 소유자 결정, 수비 태클
  const b = s.ball;
  for (const a of s.agents) if (a.cooldown > 0) a.cooldown -= dt;
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
  for (const a of s.agents) {
    if (!a.onPitch) continue;
    // 압박 전술의 스태미나 소모 × (0.95 + 0.15 × pressing) (E.19 ③)
    moveAgent(a, dt, a.idx === b.owner ? ENGINE.onball.carrySpeed : 1, 0.95 + 0.15 * s.teams[a.team].tactics.pressing);
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
    for (const a of [...s.agents, ...s.bench[0], ...s.bench[1]]) a.stats.distance75 = a.stats.distance;
  }

  if (s.cards) cardsTick(s);

  s.t += dt;
  s.elapsed += dt;
  s.tick++;
  if (s.t >= s.halfEnd) {
    if (s.half === 1) {
      event(s, 'halftime', 0, []);
      startSecondHalf(s);
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
