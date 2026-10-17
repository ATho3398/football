// 엔진 측정 작업 (E.18 0번): 경기 1개 또는 시즌 1개를 직렬화 가능한 명세로 받아 요약 지표를 돌려준다.
// 워커(worker_threads)와 메인 스레드가 같은 함수를 쓴다. 결과는 명세만으로 정해진다 (워커 수와 무관).

import { FIELD_ATTRIBUTES, type FieldAttribute, type GkAttributes } from '../../src/attributes';
import { ENGINE } from '../../src/engine/config';
import { TENDENCY } from '../../src/engine/tactics';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { ratingParts, type RatingParts } from '../../src/engine/rating';
import { createMatch } from '../../src/engine/sim';
import type { PlayerStats, Tactics, TeamSetup, TeamStats } from '../../src/engine/types';
import { customSlots, FORMATION_SLOTS, type Formation } from '../../src/formations';
import { attackDir, dist, toNorm } from '../../src/engine/pitch';
import type { MatchSim } from '../../src/engine/sim';
import type { EngineResult } from '../../src/engine/types';
import { newGame, playRound, rebuildRosters } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { createTeamRoster, rosterRating, teamRatings, type Rosters } from '../../src/roster';

export interface TeamSpec {
  /** 팀 id (데이터 전술이 있는 실제 팀 id 를 쓰면 그 팀 데이터를 따른다) */
  id: string;
  rating: number;
  /** 로스터 생성 시드 */
  seed: string;
  formation?: Formation;
  /** 'data' = 팀 데이터/기본 전술, 객체 = 기본 전술 위에 덮어쓰기 */
  tactics?: 'data' | 'balanced' | Partial<Tactics>;
  /** 슬롯 역할 덮어쓰기 (E3.7 역할 반응): 슬롯 → 역할 id */
  roles?: Record<number, string>;
  /** 커스텀 포메이션 칸 (E.5.1, GK -1). formation 대신 쓴다 */
  cells?: number[];
}

/** 추적 선수 요약 (E3.7 역할 반응): 위치는 그 팀 공격 방향 정규화 */
export interface TrackOut {
  samples: number;
  /** 평균 위치 (전체 / 공격 시 / 수비 시) */
  x: number; y: number; ax: number; ay: number; dx: number; dy: number;
  attSamples: number;
  /** 중앙에서 떨어진 정도 |y − 0.5| 평균 */
  wide: number;
  /** 상대 박스 안 비율, 상대 진영 1/3 비율 */
  box: number;
  final3: number;
  touches: number;
  runs: number;
  /** 가장 가까운 상대까지 거리 평균 (공격 시, m) */
  space: number;
  stats: Omit<PlayerStats, 'id'>;
}

export interface AttrMod {
  team: 0 | 1;
  slot: number;
  /** 필드 능력치 이름, GK 능력치는 'gk.shotStopping' 처럼. 'all' 이면 전체 */
  attrs: string[];
  delta: number;
}

export interface MatchJob {
  kind: 'match';
  seed: number;
  home: TeamSpec;
  away: TeamSpec;
  neutral: boolean;
  forceRed?: { team: 0 | 1; minute: number };
  /** 엔진 상수 덮어쓰기: 'onball.utilityScale' → 값 */
  overrides?: Record<string, number>;
  mods?: AttrMod[];
  /** 평점 성분도 돌려준다 (C.26 평점 재보정 측정) */
  parts?: boolean;
  /** 이 슬롯 선수의 위치·터치·침투를 추적한다 (E3.7 역할 반응) */
  track?: { team: 0 | 1; slot: number };
}

export interface SeasonJob {
  kind: 'season';
  playerId: string;
  seed: string;
  engine: 'agent' | 'quick';
  /** 엔진 상수 덮어쓰기 (상수 스윕) */
  overrides?: Record<string, number>;
}

/** 실제 선수 리그 경기 (E.20 5번 실제 시즌 목표): 실제 로스터 두 팀을 엔진으로 (홈 이점 포함, 양 팀 데이터 전술) */
export interface LeagueMatchJob {
  kind: 'league';
  worldSeed: string;
  home: string;
  away: string;
  seed: number;
  overrides?: Record<string, number>;
}

export type Job = MatchJob | SeasonJob | LeagueMatchJob;

export type CompactPlayer = Omit<PlayerStats, 'id'> & { starter: boolean; parts?: RatingParts };

export interface MatchOut {
  kind: 'match';
  homeGoals: number;
  awayGoals: number;
  team: [TeamStats, TeamStats];
  players: CompactPlayer[];
  goals: { t: number; team: 0 | 1 }[];
  liveSeconds: number;
  duration: number;
  elapsed75: number;
  ms: number;
  track?: TrackOut;
}

export interface SeasonOut {
  kind: 'season';
  rating: number;
  xp: number;
  apps: number;
  goals: number;
  assists: number;
  ratings: number[];
}

export interface LeagueMatchOut {
  kind: 'league';
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
  /** 득점한 선수 id → 골 */
  scorers: Record<string, number>;
  /** 득점한 선수 id → 포지션 (E.22 0번 득점 상위 10명 포지션) */
  pos: Record<string, string>;
  /** 슈팅한 선수 id → 슈팅 수 */
  shots: Record<string, number>;
  /** 팀 슈팅·골 경로 합 (양 팀) */
  shotPaths: number[];
  goalPaths: number[];
}

export type JobOut = MatchOut | SeasonOut | LeagueMatchOut;

/** 균형 전술 (E.19 균형: 라인 보통 / 압박 보통 / 빌드업 혼합 / 폭 보통) */
export const BALANCED: Partial<Tactics> = { tendency: 'balanced', lineHeight: 0.5, pressing: 0.55, style: 0.5, width: 1 };

function applyOverrides(o: Record<string, number> | undefined): () => void {
  if (!o) return () => {};
  const undo: (() => void)[] = [];
  for (const [path, v] of Object.entries(o)) {
    // 'tendency.' 로 시작하면 성향 고유 행동 상수 (E.19 ①, 측정용 C.32)
    const tend = path.startsWith('tendency.');
    const keys = (tend ? path.slice('tendency.'.length) : path).split('.');
    let obj = (tend ? TENDENCY : ENGINE) as unknown as Record<string, unknown>;
    for (const k of keys.slice(0, -1)) {
      obj = obj[k] as Record<string, unknown>;
      if (!obj) throw new Error(`상수 경로 없음: ${path}`);
    }
    const last = keys[keys.length - 1]!;
    if (typeof obj[last] !== 'number') throw new Error(`숫자 상수가 아님: ${path}`);
    const prev = obj[last];
    obj[last] = v;
    undo.push(() => (obj[last] = prev));
  }
  return () => undo.reverse().forEach((f) => f());
}

function buildTeam(t: TeamSpec, oppRating: number, worldSeed: string): TeamSetup {
  const roster = createTeamRoster({ id: t.id, rating: t.rating }, t.seed, 2018, []);
  if (t.formation) roster.formation = t.formation;
  if (t.cells) roster.customSlots = customSlots(t.cells);
  const setup = teamSetupFromRoster(roster, rosterRating(roster), oppRating, worldSeed);
  const before = setup.tactics.tendency;
  if (t.tactics === 'balanced') setup.tactics = { ...setup.tactics, ...BALANCED };
  else if (t.tactics && t.tactics !== 'data') setup.tactics = { ...setup.tactics, ...t.tactics };
  if (setup.tactics.tendency !== before) {
    // 성향을 바꿨으면 슬롯 역할도 그 성향 기본값으로 (E.19 ②)
    const slots = roster.customSlots ?? FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  if (t.roles) for (const p of setup.lineup) if (t.roles[p.slot]) p.role = t.roles[p.slot];
  return setup;
}

function applyMod(setup: TeamSetup, m: AttrMod): void {
  const p = setup.lineup.find((x) => x.slot === m.slot);
  if (!p) return;
  const fieldKeys = m.attrs.includes('all') ? FIELD_ATTRIBUTES : m.attrs.filter((a) => !a.startsWith('gk.')) as FieldAttribute[];
  for (const k of fieldKeys) p.attrs[k] = Math.min(99, p.attrs[k] + m.delta);
  if (p.gk) {
    const gkKeys = m.attrs.includes('all')
      ? (Object.keys(p.gk.attrs) as (keyof GkAttributes)[])
      : m.attrs.filter((a) => a.startsWith('gk.')).map((a) => a.slice(3) as keyof GkAttributes);
    for (const k of gkKeys) p.gk.attrs[k] = Math.min(99, p.gk.attrs[k] + m.delta);
  }
}

/** 경기를 끝까지 돌리며 그 슬롯 선수를 1초마다 표본으로 잰다. 돌려주는 함수에 경기 결과를 넣으면 요약 */
function trackRun(sim: MatchSim, team: 0 | 1, slot: number): (r: EngineResult) => TrackOut {
  const s = sim.state;
  const acc = { n: 0, x: 0, y: 0, an: 0, ax: 0, ay: 0, dx: 0, dy: 0, wide: 0, box: 0, f3: 0, touches: 0, runs: 0, space: 0 };
  let lastOwner = -1;
  const runSeen = new Map<number, number>();
  while (!s.done) {
    sim.step();
    const a = s.agents.find((o) => o.onPitch && o.team === team && o.stats.slot === slot);
    if (!a) continue;
    if (s.ball.owner === a.idx && lastOwner !== a.idx) acc.touches++;
    lastOwner = s.ball.owner;
    if (a.runUntil > s.t && runSeen.get(a.idx) !== a.runUntil) {
      runSeen.set(a.idx, a.runUntil);
      acc.runs++;
    }
    if (s.tick % 10 !== 0 || s.restart) continue;
    const [nx, ny] = toNorm(a.x, a.y, attackDir(team, s.half));
    acc.n++;
    acc.x += nx;
    acc.y += ny;
    acc.wide += Math.abs(ny - 0.5);
    if (nx > 1 - 16.5 / 105 && Math.abs(ny - 0.5) < 20.15 / 68) acc.box++;
    if (nx > 2 / 3) acc.f3++;
    if (s.possTeam === team) {
      acc.an++;
      acc.ax += nx;
      acc.ay += ny;
      let near = 30;
      for (const o of s.agents) if (o.onPitch && o.team !== team) near = Math.min(near, dist(o.x, o.y, a.x, a.y));
      acc.space += near;
    } else {
      acc.dx += nx;
      acc.dy += ny;
    }
  }
  return (r) => {
    const n = Math.max(1, acc.n);
    const an = Math.max(1, acc.an);
    const dn = Math.max(1, acc.n - acc.an);
    const p = r.players.find((x) => x.team === team && x.slot === slot);
    const { id: _id, ...stats } = p ?? r.players[0]!;
    return {
      samples: acc.n, x: acc.x / n, y: acc.y / n, ax: acc.ax / an, ay: acc.ay / an, dx: acc.dx / dn, dy: acc.dy / dn, attSamples: acc.an,
      wide: acc.wide / n, box: acc.box / n, final3: acc.f3 / n, touches: acc.touches, runs: acc.runs, space: acc.space / an, stats,
    };
  };
}

export function runMatchJob(j: MatchJob): MatchOut {
  const restore = applyOverrides(j.overrides);
  try {
    const t0 = performance.now();
    const ws = `w${j.seed}`;
    const home = buildTeam(j.home, j.away.rating, ws);
    const away = buildTeam(j.away, j.home.rating, ws);
    for (const m of j.mods ?? []) applyMod(m.team === 0 ? home : away, m);
    const starters = new Set([...home.lineup, ...away.lineup].map((p) => `${p.id}`));
    const sim = createMatch({
      home, away, mode: 'auto', difficulty: 'normal', seed: j.seed, bigMatch: false, neutral: j.neutral,
      ...(j.forceRed ? { forceRed: j.forceRed } : {}),
    });
    const track = j.track ? trackRun(sim, j.track.team, j.track.slot) : undefined;
    const r = sim.runToEnd();
    const st = sim.state;
    const byId = new Map([...st.agents, ...st.bench[0], ...st.bench[1]].map((a) => [a.id, a]));
    const ms = performance.now() - t0;
    return {
      kind: 'match',
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
      team: r.teamStats,
      players: r.players.map(({ id, ...p }) => ({ ...p, starter: starters.has(id), ...(j.parts ? { parts: ratingParts(st, byId.get(id)!, r.duration) } : {}) })),
      goals: r.events.filter((e) => e.type === 'goal').map((e) => ({ t: e.t, team: e.team })),
      liveSeconds: r.liveSeconds,
      duration: r.duration,
      elapsed75: r.elapsed75,
      ms,
      ...(track ? { track: track(r) } : {}),
    };
  } finally {
    restore();
  }
}

export function runSeasonJob(j: SeasonJob): SeasonOut {
  const restore = applyOverrides(j.overrides);
  try {
    const g = newGame({ mode: 'real', playerId: j.playerId, seed: j.seed, difficulty: 'normal' });
    const ratings: number[] = [];
    while (g.phase === 'season') {
      // 엔진 회귀 측정은 카드 없이 (C.36: 카드가 없는 경기는 C.35 와 같다)
      const rep = playRound(g, { engine: j.engine, cards: false });
      if (rep.result.rating !== null && rep.result.minutes >= 45) ratings.push(rep.result.rating);
      autoAllocate(g.player);
    }
    const h = g.player.history.at(-1)!;
    return { kind: 'season', rating: h.apps ? h.ratingSum / h.apps : 0, xp: h.matchXp, apps: h.apps, goals: h.goals, assists: h.assists, ratings };
  } finally {
    restore();
  }
}

const worlds = new Map<string, { rosters: Rosters; ratings: Record<string, number> }>();

export function runLeagueMatchJob(j: LeagueMatchJob): LeagueMatchOut {
  const restore = applyOverrides(j.overrides);
  try {
    let w = worlds.get(j.worldSeed);
    if (!w) {
      const rosters = rebuildRosters(j.worldSeed, undefined, 0);
      w = { rosters, ratings: teamRatings(rosters) };
      worlds.set(j.worldSeed, w);
    }
    const ids = Object.keys(w.ratings);
    const leagueAvg = ids.reduce((t, id) => t + w!.ratings[id]!, 0) / ids.length;
    const rh = w.ratings[j.home]!;
    const ra = w.ratings[j.away]!;
    const home = teamSetupFromRoster(w.rosters[j.home]!, rh, ra, j.worldSeed, undefined, leagueAvg);
    const away = teamSetupFromRoster(w.rosters[j.away]!, ra, rh, j.worldSeed, undefined, leagueAvg);
    const r = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: j.seed, bigMatch: false }).runToEnd();
    const scorers: Record<string, number> = {};
    const pos: Record<string, string> = {};
    const shots: Record<string, number> = {};
    for (const p of r.players) {
      if (p.goals) {
        scorers[p.id] = (scorers[p.id] ?? 0) + p.goals;
        pos[p.id] = p.position;
      }
      if (p.shots) shots[p.id] = (shots[p.id] ?? 0) + p.shots;
    }
    const add = (k: 'shotPaths' | 'goalPaths') => r.teamStats[0][k].map((v, i) => v + r.teamStats[1][k][i]!);
    return { kind: 'league', home: j.home, away: j.away, homeGoals: r.homeGoals, awayGoals: r.awayGoals, scorers, pos, shots, shotPaths: add('shotPaths'), goalPaths: add('goalPaths') };
  } finally {
    restore();
  }
}

export function runJob(j: Job): JobOut {
  return j.kind === 'match' ? runMatchJob(j) : j.kind === 'season' ? runSeasonJob(j) : runLeagueMatchJob(j);
}
