// 경기 시뮬 루프 (E.2, E.3): 10Hz 물리, 0.3~0.8초 간격 의사결정

import { FIELD_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../attributes';
import { FORMATION_SLOTS } from '../formations';
import { ENGINE } from './config';
import { lineOf } from './formation';
import { execute, resolveFlight, takeCorner, takeFreeKick, takePenalty, tryTackles } from './actions';
import { computeRatings } from './rating';
import { checkAdvantage, contactFouls, giveCard, issuePendingCards } from './referee';
import { aiSubs, myMinutes } from './subs';
import { event, kickoffPositions, setOwner, setRestart } from './core';
import { refreshErrors, updateOffball } from './offball';
import { candidates, choose, judgementOf } from './onball';
import { initPhysics, moveAgent } from './physics';
import { aiAdjust } from './tactics';
import { attackDir, clamp, dist, L, outOfPlay, toPitch, W } from './pitch';
import { Purpose, rand } from './rng';
import { defaultRole, roleById } from './roles';
import { emptyPlayerStats, emptyTeamStats, type Agent, type SimState } from './state';
import type { EngineInput, EngineResult, Frame, PlayerSpec, TeamSetup } from './types';

const T = ENGINE.time;
const B = ENGINE.ball;

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

export type Decision = { kind: 'decision'; id: string };
export type Done = { kind: 'done'; result: EngineResult };

export interface MatchSim {
  readonly state: SimState;
  runUntilDecision(): Decision | Done;
  resolve(choice: string): void;
  runToEnd(): EngineResult;
  /** 렌더용 위치 샘플 (현재 상태) */
  frame(): Frame;
  /** 한 틱 진행 */
  step(): void;
}

function makeAgent(spec: PlayerSpec, team: 0 | 1, idx: number, setup: TeamSetup, home: boolean): Agent {
  const slots = FORMATION_SLOTS[setup.formation];
  const slot = slots[spec.slot] ?? slots[0]!;
  const attrs = { ...spec.attrs };
  const gk = spec.gk ? { type: spec.gk.type, attrs: { ...spec.gk.attrs } } : null;
  const pos = spec.slot >= 0 ? slot.pos : spec.position;
  const a: Agent = {
    idx, id: spec.id, team, spec, attrs, gk, pos, line: lineOf(pos),
    role: roleById(spec.role) ?? defaultRole(pos, attrs),
    sx: slot.x, sy: slot.y, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, urgent: false,
    maxSpeed: 0, accel: 0, turnKeep: 0, stamina: spec.stamina, judgement: 0, cooldown: 0, nextOffball: 0,
    runUntil: 0, errX: 0, errY: 0, beatenUntil: 0, onPitch: spec.slot >= 0, sprinting: false, backToGoal: false, recoverUrgent: false, minRun: false, drainMul: 1, duelEdge: 0,
    stats: { ...emptyPlayerStats(spec.id, team, pos), slot: spec.slot }, enteredAt: 0, leftAt: null,
    rt: { forward: 0, lost: 0, dangerLost: 0, conceded: 0 },
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
    ball: { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, owner: -1, flight: null, lastTouch: -1, lastTeam: 0 },
    bsx: L / 2, bsy: W / 2,
    teams: setups.map((setup) => ({
      setup: { teamId: setup.teamId, tactics: setup.tactics, rating: setup.rating },
      tactics: { ...setup.tactics }, stats: emptyTeamStats(), phase: 0, subsLeft: 3, counterUntil: 0, counterPressers: [] as number[], wonAt: -100,
    })) as SimState['teams'],
    possTeam: 0, possSince: 0, restart: null, lastPass: null, events: [],
    advantage: null, pendingCards: [], exemptPass: false, lastOwner: -1, lastWasShot: false, nextSubCheck: 0, done: false, offsideX: [0.5, 0.5],
    possOrigin: 'kickoff', possStartT: 0, snap75: false, elapsed75: 0,
  };
  kickoffPositions(s);
  setRestart(s, 'kickoff', 0, L / 2, W / 2, 0);
  event(s, 'kickoff', 0, []);
  return s;
}

function executeRestart(s: SimState): void {
  const r = s.restart!;
  const taker = s.agents[r.taker];
  s.restart = null;
  if (!taker || !taker.onPitch) return;
  taker.x = r.x;
  taker.y = r.y;
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

/** 소유자 결정 */
function decide(s: SimState, a: Agent): void {
  const c = choose(s, a, candidates(s, a));
  if (c.type !== 'holdup') a.backToGoal = false;
  execute(s, a, c);
}

function updateLooseBall(s: SimState): void {
  const b = s.ball;
  const dt = T.dt;
  const sp = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
  if (sp > 0) {
    const nsp = Math.max(0, sp - ENGINE.ball.groundDecel * dt);
    b.vx *= nsp / sp;
    b.vy *= nsp / sp;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  if (sp >= B.controlMaxSpeed) return;
  // 공 컨트롤 시도 (E.4)
  let winner: Agent | null = null;
  let bestRoll = Infinity;
  for (const a of s.agents) {
    if (!a.onPitch || dist(a.x, a.y, b.x, b.y) > B.controlDist) continue;
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
  kickoffPositions(s);
  setRestart(s, 'kickoff', 1, L / 2, W / 2, 0);
}

function finish(s: SimState): void {
  s.done = true;
  for (const a of s.agents) a.leftAt ??= s.elapsed;
  event(s, 'fulltime', 0, []);
}

export function step(s: SimState): void {
  if (s.done) return;
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

  if (s.restart && s.t >= s.restart.at) {
    const taker = s.agents[s.restart.taker];
    if (!taker || dist(taker.x, taker.y, s.restart.x, s.restart.y) < 1.5 || s.t >= s.restart.at + 4) executeRestart(s);
  }

  // 오프더볼 목표 갱신 (선수마다 엇갈리게)
  for (const a of s.agents) {
    if (!a.onPitch || a.idx === s.ball.owner) continue;
    if (s.t >= a.nextOffball) {
      refreshErrors(s, a);
      updateOffball(s, a);
      a.nextOffball = s.t + T.offballInterval * (0.7 + 0.6 * rand(s.seed, s.tick, a.idx, Purpose.Offball, 2));
    }
  }

  // 소유자 결정, 수비 태클
  const b = s.ball;
  for (const a of s.agents) if (a.cooldown > 0) a.cooldown -= dt;
  if (b.owner >= 0 && !s.restart) {
    const o = s.agents[b.owner]!;
    if (o.cooldown <= 0) decide(s, o);
    else if (!contactFouls(s)) tryTackles(s);
  }

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
      // 공을 가진 채 라인 밖으로 나가지 않게 안쪽으로
      o.x = clamp(o.x, 0.5, L - 0.5);
      o.y = clamp(o.y, 0.5, W - 0.5);
      b.x = clamp(b.x, 0.3, L - 0.3);
      b.y = clamp(b.y, 0.3, W - 0.3);
    }
  } else if (b.flight) {
    resolveFlight(s);
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
    decisions: [],
    duration,
    elapsed75: s.elapsed75,
    liveSeconds: (s.teams[0].stats.possessionTicks + s.teams[1].stats.possessionTicks) * T.dt,
  };
}

export function createMatch(input: EngineInput): MatchSim {
  const state = createState(input);
  return {
    state,
    step: () => step(state),
    runUntilDecision() {
      while (!state.done) step(state);
      return { kind: 'done', result: buildResult(state) };
    },
    resolve() {
      // 결정 순간(E4)에서 구현
    },
    runToEnd() {
      while (!state.done) step(state);
      return buildResult(state);
    },
    frame: () => frameOf(state),
  };
}
