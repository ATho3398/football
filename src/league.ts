// 리그 (B.3): 등록된 리그 데이터(data/leagues, C.75m)로 만든다. 팀 수에 맞춰 라운드로빈 (20팀 = 38라운드, 18팀 = 34, 24팀 = 46, 12팀 = 3번 33)

import { BALANCE } from './config/balance';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { GoalRec } from './engine/npcMatch';
import { CLUB_BY_ID, OUTSIDE_CLUBS } from '../data/outsideClubs';
import { allLeagueData, leagueData } from '../data/leagues';
import { nationOf } from '../data/nations';

export interface Team {
  id: string;
  name: string;
  nameKo: string;
  /** 팀 전력 (숫자 하나) */
  rating: number;
  /** 장기 평균 전력. 시즌마다 rating 이 이 값으로 회귀한다 */
  baseRating: number;
}

export interface Fixture {
  home: string;
  away: string;
  homeGoals?: number;
  awayGoals?: number;
  /** 득점자·도움 (엔진 경기만, 부록 C.38): [분, 팀 0 홈·1 원정, 득점자 id, 도움 id] */
  g?: GoalRec[];
}

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
}

export interface LeagueState {
  /** 리그 id (data/leagues, C.75m). 옛 세이브는 마이그레이션으로 'pl' */
  id: string;
  /** 리그 국가 (외국인 판정 기준) */
  country: string;
  /** 1부 · 2부 */
  tier: 1 | 2;
  name: string;
  /** 시즌 시작 연도 */
  season: number;
  /** 다음에 치를 라운드 (0부터). schedule.length 이면 시즌 종료 */
  round: number;
  teams: Team[];
  schedule: Fixture[][];
  table: TableRow[];
  /**
   * 옛 3~12월 달력 (C.76m): 모든 리그가 8~5월로 통일되기 전 세이브에서 진행 중이던 춘추제 시즌만 표시 (마이그레이션).
   * 그 시즌은 옛 달력대로 끝내고, 다음 시즌(nextSeasonLeague)부터 8~5월
   */
  legacyCal?: 'spring-autumn';
}

/** 영문 클럽 이름 → 한글 (리그 팀 → 리그 밖 클럽, 없으면 그대로). 실제 선수 데이터의 club 표시용 (C.52) */
export function clubKo(name: string | undefined): string {
  if (!name) return '';
  for (const d of allLeagueData()) {
    const t = d.teams.find((x) => x.name === name);
    if (t) return t.nameKo;
  }
  return OUTSIDE_CLUBS.find((c) => c.name === name)?.nameKo ?? name;
}

/** 실제 선수 데이터의 club 이름 → 팀 id (등록된 모든 리그 팀, C.76c). 로스터는 내 리그 팀만 만들므로 다른 리그 선수는 NPC 로만 남는다 */
export const CLUB_TO_TEAM: Record<string, string> = Object.fromEntries(
  allLeagueData().flatMap((d) => d.teams.map((t) => [t.name, t.id] as const)),
);

/** 리그 데이터 (등록 안 된 id 면 오류) */
function dataOf(id: string) {
  const d = leagueData(id);
  if (!d) throw new Error(`등록되지 않은 리그: ${id}`);
  return d;
}

/** 2018-19 시작 팀 목록 (레이팅 = 로스터 생성 목표). 기본 PL */
export function initialTeams(id = 'pl'): Team[] {
  return dataOf(id).teams.map((t) => ({ id: t.id, name: t.name, nameKo: t.nameKo, rating: t.rating, baseRating: t.rating }));
}

/** 시드 문자열: PL 은 C.75m 전과 같은 문자열 (같은 시드 같은 일정·레이팅), 다른 리그는 리그 id 를 넣는다 */
function seedKey(id: string, kind: string): string {
  return id === 'pl' ? kind : `${kind}:${id}`;
}

/** 라운드로빈 횟수: 데이터 값, 없으면 12팀 이하 3번 (K리그 33라운드) · 그 밖 2번 */
export function roundRobinsOf(id: string, teams: number): 2 | 3 {
  return leagueData(id)?.roundRobins ?? (teams <= 12 ? 3 : 2);
}

/** 한 시즌 팀당 경기 수 (20팀 38, 18팀 34, 24팀 46, 12팀 33. 홀수 팀이면 쉬는 라운드 뺀 값) */
export function gamesPerTeam(league: Pick<LeagueState, 'teams' | 'id'>): number {
  const n = league.teams.length;
  return (n - 1) * roundRobinsOf(league.id, n);
}

/** 리그 시즌 (기본 PL). season = 시즌 시작 연도 (춘추제가 아닌 리그는 그해 3~12월) */
export function createLeague(worldSeed: string, season: number, id = 'pl'): LeagueState {
  const d = dataOf(id);
  const teams = initialTeams(id);
  return {
    id,
    country: d.country,
    tier: d.tier,
    name: d.name,
    season,
    round: 0,
    teams,
    schedule: buildSchedule(teams.map((t) => t.id), createRng(hashSeed(`${worldSeed}:${seedKey(id, 'schedule')}:${season}`)), roundRobinsOf(id, teams.length)),
    table: emptyTable(teams),
  };
}

function emptyTable(teams: Team[]): TableRow[] {
  return teams.map((t) => ({ teamId: t.id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }));
}

export function shuffle<T>(arr: T[], rng: Rng): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** 홀수 팀 리그의 쉬는 자리 (그 경기는 일정에서 뺀다) */
const BYE = '';

/**
 * 서클 방식 더블 라운드로빈. 후반기는 전반기의 홈/원정을 뒤집는다.
 * robins = 3 이면 셋째 바퀴를 더한다 (K리그 33라운드, 셋째 바퀴 홈은 팀마다 5~6). 홀수 팀은 쉬는 팀이 생긴다
 */
export function buildSchedule(teamIds: string[], rng: Rng, robins: 2 | 3 = 2): Fixture[][] {
  const ids = shuffle(teamIds, rng);
  if (ids.length % 2) ids.push(BYE);
  const n = ids.length;
  const first: Fixture[][] = [];
  const rot = ids.slice(1);
  for (let r = 0; r < n - 1; r++) {
    const circle = [ids[0]!, ...rot];
    const round: Fixture[] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = circle[i]!;
      const b = circle[n - 1 - i]!;
      // 홈/원정을 번갈아 배정
      round.push((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
    }
    first.push(round);
    rot.unshift(rot.pop()!);
  }
  const second = first.map((round) => round.map((f) => ({ home: f.away, away: f.home })));
  // 셋째 바퀴: 지금까지 셋째 바퀴 홈이 적은 팀이 홈 (같으면 전반기대로)
  const home3 = new Map<string, number>();
  const third = robins === 3 ? first.map((round) => round.map((f) => {
    const [h, a] = (home3.get(f.away) ?? 0) < (home3.get(f.home) ?? 0) ? [f.away, f.home] : [f.home, f.away];
    home3.set(h, (home3.get(h) ?? 0) + 1);
    return { home: h, away: a };
  })) : [];
  const all = [...first, ...second, ...third];
  return teamIds.length % 2 ? all.map((round) => round.filter((f) => f.home !== BYE && f.away !== BYE)) : all;
}

export function teamById(league: LeagueState, id: string): Team {
  const t = league.teams.find((x) => x.id === id);
  if (t) return t;
  // 컵·챔스 상대 (C.67): 리그 밖 클럽은 고정 레이팅
  const c = CLUB_BY_ID[id];
  if (c) return { ...c, baseRating: c.rating };
  // 대표팀 (C.76d): `n:<국가>` → 국가 레이팅 표
  if (id.startsWith('n:')) {
    const n = nationOf(id.slice(2));
    return { id, name: n.name, nameKo: n.nameKo, rating: n.rating, baseRating: n.rating };
  }
  // 안 고른 리그 팀 (C.75m): 리그 밖 클럽처럼 데이터 레이팅만
  const o = leagueTeamById(id);
  if (!o) throw new Error(`unknown team: ${id}`);
  return { id: o.id, name: o.name, nameKo: o.nameKo, rating: o.rating, baseRating: o.rating };
}

type LeagueTeamRef = { id: string; name: string; nameKo: string; rating: number; league: string };
let teamIndex: { size: number; map: Map<string, LeagueTeamRef> } | null = null;

/** 등록된 모든 리그의 팀 (id 로 찾기). 등록부가 바뀌면 (테스트의 registerLeague) 다시 만든다 */
export function leagueTeamById(id: string): LeagueTeamRef | undefined {
  const all = allLeagueData();
  const size = all.reduce((t, d) => t + d.teams.length, all.length * 1000);
  if (!teamIndex || teamIndex.size !== size) {
    const map = new Map<string, LeagueTeamRef>();
    for (const d of all) for (const t of d.teams) map.set(t.id, { id: t.id, name: t.name, nameKo: t.nameKo, rating: t.rating, league: d.id });
    teamIndex = { size, map };
  }
  return teamIndex.map.get(id);
}

/** 팀 id 의 리그 (등록된 리그 팀이 아니면 undefined, C.76c) */
export function leagueOfTeam(id: string | undefined): string | undefined {
  return id ? leagueTeamById(id)?.league : undefined;
}

/** 포아송 난수 (Knuth) */
export function poisson(rng: Rng, lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L && k < 20);
  return k - 1;
}

/** 기대 득점 (B.4) */
export function expectedGoals(own: number, opp: number, home: boolean): number {
  const M = BALANCE.match;
  return M.baseGoals * Math.exp((own - opp) * M.goalsK) + (home ? M.homeBonus : 0);
}

export function simulateScore(rng: Rng, homeRating: number, awayRating: number): [number, number] {
  return [
    poisson(rng, expectedGoals(homeRating, awayRating, true)),
    poisson(rng, expectedGoals(awayRating, homeRating, false)),
  ];
}

export function recordResult(league: LeagueState, f: Fixture, hg: number, ag: number): void {
  f.homeGoals = hg;
  f.awayGoals = ag;
  const row = (id: string) => league.table.find((r) => r.teamId === id)!;
  const h = row(f.home);
  const a = row(f.away);
  h.played++; a.played++;
  h.gf += hg; h.ga += ag;
  a.gf += ag; a.ga += hg;
  if (hg > ag) { h.won++; a.lost++; h.points += 3; }
  else if (hg < ag) { a.won++; h.lost++; a.points += 3; }
  else { h.drawn++; a.drawn++; h.points++; a.points++; }
}

/** 승점 → 득실차 → 다득점 → 이름 순 */
export function sortedTable(league: LeagueState): TableRow[] {
  const name = (id: string) => teamById(league, id).name;
  return [...league.table].sort(
    (x, y) =>
      y.points - x.points ||
      (y.gf - y.ga) - (x.gf - x.ga) ||
      y.gf - x.gf ||
      name(x.teamId).localeCompare(name(y.teamId)),
  );
}

export function leaguePosition(league: LeagueState, teamId: string): number {
  return sortedTable(league).findIndex((r) => r.teamId === teamId) + 1;
}

/**
 * 다음 시즌: 새 일정, 빈 순위표. 팀 레이팅은 로스터에서 계산한 값(ratings, 23번)을 쓰고,
 * 주지 않으면 이전 방식(팀별 장기 평균으로 회귀 + 랜덤)
 */
export function nextSeasonLeague(league: LeagueState, worldSeed: string, ratings?: Record<string, number>): LeagueState {
  const L = BALANCE.league;
  const season = league.season + 1;
  const id = league.id ?? 'pl';
  const rng = createRng(hashSeed(`${worldSeed}:${seedKey(id, 'ratings')}:${season}`));
  const teams = league.teams.map((t) => {
    const r = ratings?.[t.id] ?? t.baseRating + (t.rating - t.baseRating) * L.ratingKeep + gaussian(rng) * L.ratingNoiseSd;
    return { ...t, rating: Math.round(Math.min(L.ratingMax, Math.max(L.ratingMin, r)) * 10) / 10 };
  });
  const { legacyCal: _old, ...rest } = league;
  return {
    ...rest,
    season,
    round: 0,
    teams,
    schedule: buildSchedule(teams.map((t) => t.id), createRng(hashSeed(`${worldSeed}:${seedKey(id, 'schedule')}:${season}`)), roundRobinsOf(id, teams.length)),
    table: emptyTable(teams),
  };
}
