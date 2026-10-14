// 경기 시뮬 루프 (E.2, E.3): 10Hz 물리, 0.3~0.8초 간격 의사결정

import { FIELD_ATTRIBUTES, type FieldAttributes, type GkAttributes } from '../attributes';
import { FORMATION_SLOTS } from '../formations';
import { ENGINE } from './config';
import { lineOf } from './formation';
import { refreshErrors, updateOffball } from './offball';
import { candidates, choose, judgementOf, makePass, type Candidate } from './onball';
import { initPhysics, moveAgent } from './physics';
import { attackDir, clamp, dist, L, outOfPlay, toPitch, W } from './pitch';
import { Purpose, rand } from './rng';
import { defaultRole, roleById } from './roles';
import { emptyPlayerStats, emptyTeamStats, type Agent, type RestartType, type SimState } from './state';
import type { EngineInput, EngineResult, Frame, MatchEvent, PlayerSpec, TeamSetup } from './types';

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

function makeAgent(spec: PlayerSpec, team: 0 | 1, idx: number, setup: TeamSetup, homeBonus: number): Agent {
  const slots = FORMATION_SLOTS[setup.formation];
  const slot = slots[spec.slot] ?? slots[0]!;
  const attrs = { ...spec.attrs };
  if (homeBonus) for (const k of FIELD_ATTRIBUTES) attrs[k] = Math.min(99, attrs[k] + homeBonus);
  const gk = spec.gk ? { type: spec.gk.type, attrs: { ...spec.gk.attrs } } : null;
  if (gk && homeBonus) for (const k of Object.keys(gk.attrs) as (keyof GkAttributes)[]) gk.attrs[k] = Math.min(99, gk.attrs[k] + homeBonus);
  const pos = spec.slot >= 0 ? slot.pos : spec.position;
  const a: Agent = {
    idx, id: spec.id, team, spec, attrs, gk, pos, line: lineOf(pos),
    role: roleById(spec.role) ?? defaultRole(pos, attrs),
    sx: slot.x, sy: slot.y, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, urgent: false,
    maxSpeed: 0, accel: 0, turnKeep: 0, stamina: spec.stamina, judgement: 0, cooldown: 0, nextOffball: 0,
    runUntil: 0, errX: 0, errY: 0, beatenUntil: 0, onPitch: spec.slot >= 0, sprinting: false,
    stats: emptyPlayerStats(spec.id, team, pos), enteredAt: 0, leftAt: null,
  };
  initPhysics(a);
  a.judgement = judgementOf(a);
  return a;
}

export function createState(input: EngineInput): SimState {
  const agents: Agent[] = [];
  const bench: [Agent[], Agent[]] = [[], []];
  const setups = [input.home, input.away] as const;
  const homeBonus = input.neutral ? 0 : ENGINE.match.homeAttrBonus;
  setups.forEach((setup, team) => {
    for (const spec of setup.lineup) agents.push(makeAgent(spec, team as 0 | 1, agents.length, setup, team === 0 ? homeBonus : 0));
  });
  setups.forEach((setup, team) => {
    for (const spec of setup.bench) bench[team]!.push(makeAgent({ ...spec, slot: -1 }, team as 0 | 1, -1, setup, team === 0 ? homeBonus : 0));
  });
  const added1 = 60 * (T.addedFirst[0] + Math.floor(rand(input.seed, 0, 0, Purpose.Added) * (T.addedFirst[1] - T.addedFirst[0] + 1)));
  const s: SimState = {
    input, seed: input.seed >>> 0, t: 0, tick: 0, half: 1, halfEnd: T.halfSeconds + added1,
    agents, bench,
    ball: { x: L / 2, y: W / 2, z: 0, vx: 0, vy: 0, owner: -1, flight: null, lastTouch: -1, lastTeam: 0 },
    bsx: L / 2, bsy: W / 2,
    teams: setups.map((setup) => ({
      setup: { teamId: setup.teamId, tactics: setup.tactics, rating: setup.rating },
      tactics: { ...setup.tactics }, stats: emptyTeamStats(), phase: 0, subsLeft: 3,
    })) as SimState['teams'],
    possTeam: 0, possSince: 0, restart: null, events: [], done: false, offsideX: [0.5, 0.5],
  };
  kickoffPositions(s);
  setRestart(s, 'kickoff', 0, L / 2, W / 2, 0);
  event(s, 'kickoff', 0, []);
  return s;
}

export function event(s: SimState, type: MatchEvent['type'], team: 0 | 1, players: string[], params?: MatchEvent['params']): void {
  s.events.push({ t: Math.round(s.t * 10) / 10, type, team, players, ...(params ? { params } : {}) });
}

/** 킥오프 대형: 슬롯 위치를 자기 진영으로 */
function kickoffPositions(s: SimState): void {
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

/** 리스타트 준비: 키커는 공에 가장 가까운 선수 (킥오프는 가장 앞선 선수) */
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
      if (type === 'goalKick' && a.line !== 0) continue;
      if (type !== 'goalKick' && a.line === 0 && type !== 'freeKick') continue;
      const d = type === 'kickoff' ? -a.sx : dist(a.x, a.y, b.x, b.y);
      if (d < bd) {
        bd = d;
        pick = a.idx;
      }
    }
  }
  s.restart = { type, team, x: b.x, y: b.y, at: s.t + delay, taker: pick };
  s.possTeam = team;
  s.possSince = s.t;
}

function setOwner(s: SimState, a: Agent): void {
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
  a.cooldown = B.receiveTime + reaction(a) * 0.5;
  a.tx = a.x;
  a.ty = a.y;
}

function reaction(a: Agent): number {
  return T.reactionBase - T.reactionSlope * a.judgement;
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
  const typeEvent = r.type === 'kickoff' ? null : r.type;
  if (typeEvent) event(s, typeEvent, r.team, [taker.id]);
}

/** 소유자 결정 */
function decide(s: SimState, a: Agent): void {
  const cands = candidates(s, a);
  const c = choose(s, a, cands);
  execute(s, a, c);
}

function execute(s: SimState, a: Agent, c: Candidate): void {
  const team = s.teams[a.team];
  switch (c.type) {
    case 'pass':
    case 'through': {
      const fl = makePass(s, a, c);
      s.ball.owner = -1;
      s.ball.flight = fl;
      s.ball.lastTouch = a.idx;
      s.ball.lastTeam = a.team;
      a.stats.passes++;
      team.stats.passes++;
      // 받을 선수/가로챌 선수는 즉시 도착점으로
      const who = fl.outcome === 'receive' ? fl.receiver : fl.outcome === 'intercept' ? fl.interceptor : -1;
      if (who >= 0) updateOffball(s, s.agents[who]!);
      a.cooldown = reaction(a);
      return;
    }
    case 'carry':
      a.tx = c.x;
      a.ty = c.y;
      a.urgent = true;
      a.cooldown = Math.max(ENGINE.onball.minHold, reaction(a));
      return;
    case 'hold':
    default:
      a.tx = a.x;
      a.ty = a.y;
      a.urgent = false;
      a.cooldown = Math.max(ENGINE.onball.minHold, reaction(a));
  }
}

function resolveFlight(s: SimState): void {
  const b = s.ball;
  const fl = b.flight!;
  const k = clamp((s.t - fl.t0) / fl.dur, 0, 1);
  b.x = fl.fromX + (fl.toX - fl.fromX) * k;
  b.y = fl.fromY + (fl.toY - fl.fromY) * k;
  b.z = fl.air ? Math.sin(Math.PI * k) * 3 : 0;
  if (k < 1) return;
  b.flight = null;
  b.z = 0;
  const passer = s.agents[fl.passer]!;
  if (fl.outcome === 'receive') {
    const r = s.agents[fl.receiver]!;
    if (r.onPitch && dist(r.x, r.y, b.x, b.y) < 4) {
      setOwner(s, r);
      r.x = b.x;
      r.y = b.y;
      passer.stats.passesCompleted++;
      s.teams[passer.team].stats.passesCompleted++;
      return;
    }
  } else if (fl.outcome === 'intercept') {
    const r = s.agents[fl.interceptor]!;
    if (r.onPitch) {
      setOwner(s, r);
      r.x = b.x;
      r.y = b.y;
      r.stats.interceptions++;
      s.teams[r.team].stats.interceptions++;
      return;
    }
  }
  // 루즈볼: 진행 방향으로 굴러간다
  const dx = fl.toX - fl.fromX;
  const dy = fl.toY - fl.fromY;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const sp = fl.air ? 2 : 4;
  b.vx = (dx / d) * sp;
  b.vy = (dy / d) * sp;
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
    setRestart(s, 'throwIn', other, clamp(b.x, 0.5, L - 0.5), b.y < 0 ? 0 : W, ENGINE.restart.throwInDelay);
    return;
  }
  // 골라인: 넘은 쪽 골을 지키는 팀
  const defending: 0 | 1 = attackDir(0, s.half) > 0 ? (b.x > L ? 1 : 0) : (b.x > L ? 0 : 1);
  const attacking = (1 - defending) as 0 | 1;
  if (last === defending) {
    s.teams[attacking].stats.corners++;
    setRestart(s, 'corner', attacking, b.x > L ? L : 0, b.y < W / 2 ? 0 : W, ENGINE.restart.cornerDelay);
  } else {
    const gx = b.x > L ? L - 5.5 : 5.5;
    setRestart(s, 'goalKick', defending, gx, W / 2 + (b.y < W / 2 ? -9 : 9), ENGINE.restart.goalKickDelay);
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
  for (const a of s.agents) a.leftAt ??= s.t;
  event(s, 'fulltime', 0, []);
}

export function step(s: SimState): void {
  if (s.done) return;
  const dt = T.dt;

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

  // 소유자 결정
  const b = s.ball;
  if (b.owner >= 0) {
    const o = s.agents[b.owner]!;
    o.cooldown -= dt;
    if (o.cooldown <= 0) decide(s, o);
  }

  // 이동
  for (const a of s.agents) {
    if (!a.onPitch) continue;
    moveAgent(a, dt, a.idx === b.owner ? ENGINE.onball.carrySpeed : 1);
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

  s.t += dt;
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
  const firstHalf = s.events.find((e) => e.type === 'halftime')?.t ?? T.halfSeconds;
  const duration = firstHalf + Math.max(0, s.t - T.halfSeconds);
  const all = [...s.agents, ...s.bench[0], ...s.bench[1]];
  const players = all
    .filter((a) => a.leftAt !== null || a.onPitch)
    .map((a) => {
      const played = (a.leftAt ?? s.t) - a.enteredAt;
      return { ...a.stats, minutes: Math.round(Math.min(90, (played / duration) * 90)) };
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
