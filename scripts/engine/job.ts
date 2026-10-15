// 엔진 측정 작업 (E.18 0번): 경기 1개 또는 시즌 1개를 직렬화 가능한 명세로 받아 요약 지표를 돌려준다.
// 워커(worker_threads)와 메인 스레드가 같은 함수를 쓴다. 결과는 명세만으로 정해진다 (워커 수와 무관).

import { FIELD_ATTRIBUTES, type FieldAttribute, type GkAttributes } from '../../src/attributes';
import { ENGINE } from '../../src/engine/config';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import type { PlayerStats, Tactics, TeamSetup, TeamStats } from '../../src/engine/types';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
import { newGame, playRound } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { createTeamRoster, rosterRating } from '../../src/roster';

export interface TeamSpec {
  /** 팀 id (데이터 전술이 있는 실제 팀 id 를 쓰면 그 팀 데이터를 따른다) */
  id: string;
  rating: number;
  /** 로스터 생성 시드 */
  seed: string;
  formation?: Formation;
  /** 'data' = 팀 데이터/기본 전술, 객체 = 기본 전술 위에 덮어쓰기 */
  tactics?: 'data' | 'balanced' | Partial<Tactics>;
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
}

export interface SeasonJob {
  kind: 'season';
  playerId: string;
  seed: string;
  engine: 'agent' | 'quick';
  /** 엔진 상수 덮어쓰기 (상수 스윕) */
  overrides?: Record<string, number>;
}

export type Job = MatchJob | SeasonJob;

export type CompactPlayer = Omit<PlayerStats, 'id'> & { starter: boolean };

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

export type JobOut = MatchOut | SeasonOut;

/** 균형 전술 (E.19 균형: 라인 보통 / 압박 보통 / 빌드업 혼합 / 폭 보통) */
export const BALANCED: Partial<Tactics> = { tendency: 'balanced', lineHeight: 0.5, pressing: 0.55, style: 0.5, width: 1 };

function applyOverrides(o: Record<string, number> | undefined): () => void {
  if (!o) return () => {};
  const undo: (() => void)[] = [];
  for (const [path, v] of Object.entries(o)) {
    const keys = path.split('.');
    let obj = ENGINE as unknown as Record<string, unknown>;
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
  const setup = teamSetupFromRoster(roster, rosterRating(roster), oppRating, worldSeed);
  const before = setup.tactics.tendency;
  if (t.tactics === 'balanced') setup.tactics = { ...setup.tactics, ...BALANCED };
  else if (t.tactics && t.tactics !== 'data') setup.tactics = { ...setup.tactics, ...t.tactics };
  if (setup.tactics.tendency !== before) {
    // 성향을 바꿨으면 슬롯 역할도 그 성향 기본값으로 (E.19 ②)
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
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

export function runMatchJob(j: MatchJob): MatchOut {
  const restore = applyOverrides(j.overrides);
  try {
    const t0 = performance.now();
    const ws = `w${j.seed}`;
    const home = buildTeam(j.home, j.away.rating, ws);
    const away = buildTeam(j.away, j.home.rating, ws);
    for (const m of j.mods ?? []) applyMod(m.team === 0 ? home : away, m);
    const starters = new Set([...home.lineup, ...away.lineup].map((p) => `${p.id}`));
    const r = createMatch({
      home, away, mode: 'auto', difficulty: 'normal', seed: j.seed, bigMatch: false, neutral: j.neutral,
      ...(j.forceRed ? { forceRed: j.forceRed } : {}),
    }).runToEnd();
    const ms = performance.now() - t0;
    return {
      kind: 'match',
      homeGoals: r.homeGoals,
      awayGoals: r.awayGoals,
      team: r.teamStats,
      players: r.players.map(({ id, ...p }) => ({ ...p, starter: starters.has(id) })),
      goals: r.events.filter((e) => e.type === 'goal').map((e) => ({ t: e.t, team: e.team })),
      liveSeconds: r.liveSeconds,
      duration: r.duration,
      elapsed75: r.elapsed75,
      ms,
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
      const rep = playRound(g, { engine: j.engine });
      if (rep.result.rating !== null && rep.result.minutes >= 45) ratings.push(rep.result.rating);
      autoAllocate(g.player);
    }
    const h = g.player.history.at(-1)!;
    return { kind: 'season', rating: h.apps ? h.ratingSum / h.apps : 0, xp: h.matchXp, apps: h.apps, goals: h.goals, assists: h.assists, ratings };
  } finally {
    restore();
  }
}

export function runJob(j: Job): JobOut {
  return j.kind === 'match' ? runMatchJob(j) : runSeasonJob(j);
}
