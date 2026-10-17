// 리그 1개, 20팀, 더블 라운드로빈 38라운드 (B.3)

import { BALANCE } from './config/balance';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { GoalRec } from './engine/npcMatch';
import { OUTSIDE_CLUBS } from '../data/outsideClubs';

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
  name: string;
  /** 시즌 시작 연도 */
  season: number;
  /** 다음에 치를 라운드 (0부터). schedule.length 이면 시즌 종료 */
  round: number;
  teams: Team[];
  schedule: Fixture[][];
  table: TableRow[];
}

/** 영문 클럽 이름 → 한글 (리그 팀 → 리그 밖 클럽, 없으면 그대로). 실제 선수 데이터의 club 표시용 (C.52) */
export function clubKo(name: string | undefined): string {
  if (!name) return '';
  return PREMIER_LEAGUE_2018.find((t) => t.name === name)?.nameKo ?? OUTSIDE_CLUBS.find((c) => c.name === name)?.nameKo ?? name;
}

// 2018-19 프리미어리그. 레이팅은 초기 추정치
const PREMIER_LEAGUE_2018: Omit<Team, 'baseRating'>[] = [
  { id: 'mci', name: 'Manchester City', nameKo: '맨체스터 시티', rating: 85 },
  { id: 'liv', name: 'Liverpool', nameKo: '리버풀', rating: 84 },
  { id: 'che', name: 'Chelsea', nameKo: '첼시', rating: 81 },
  { id: 'tot', name: 'Tottenham Hotspur', nameKo: '토트넘 홋스퍼', rating: 81 },
  { id: 'mun', name: 'Manchester United', nameKo: '맨체스터 유나이티드', rating: 80 },
  { id: 'ars', name: 'Arsenal', nameKo: '아스널', rating: 79 },
  { id: 'eve', name: 'Everton', nameKo: '에버턴', rating: 75 },
  { id: 'lei', name: 'Leicester City', nameKo: '레스터 시티', rating: 74 },
  { id: 'whu', name: 'West Ham United', nameKo: '웨스트햄 유나이티드', rating: 73 },
  { id: 'wol', name: 'Wolverhampton', nameKo: '울버햄튼', rating: 73 },
  { id: 'cry', name: 'Crystal Palace', nameKo: '크리스털 팰리스', rating: 72 },
  { id: 'wat', name: 'Watford', nameKo: '왓포드', rating: 71 },
  { id: 'bou', name: 'AFC Bournemouth', nameKo: '본머스', rating: 71 },
  { id: 'new', name: 'Newcastle United', nameKo: '뉴캐슬 유나이티드', rating: 71 },
  { id: 'sou', name: 'Southampton', nameKo: '사우샘프턴', rating: 71 },
  { id: 'bur', name: 'Burnley', nameKo: '번리', rating: 70 },
  { id: 'bha', name: 'Brighton & Hove Albion', nameKo: '브라이턴', rating: 70 },
  { id: 'ful', name: 'Fulham', nameKo: '풀럼', rating: 69 },
  { id: 'car', name: 'Cardiff City', nameKo: '카디프 시티', rating: 67 },
  { id: 'hud', name: 'Huddersfield Town', nameKo: '허더즈필드', rating: 67 },
];

/** 실제 선수 데이터의 club 이름 → 팀 id */
export const CLUB_TO_TEAM: Record<string, string> = Object.fromEntries(
  PREMIER_LEAGUE_2018.map((t) => [t.name, t.id]),
);

/** 2018-19 시작 팀 목록 (레이팅 = 로스터 생성 목표) */
export function initialTeams(): Team[] {
  return PREMIER_LEAGUE_2018.map((t) => ({ ...t, baseRating: t.rating }));
}

export function createLeague(worldSeed: string, season: number): LeagueState {
  const teams = initialTeams();
  return {
    name: 'Premier League',
    season,
    round: 0,
    teams,
    schedule: buildSchedule(teams.map((t) => t.id), createRng(hashSeed(`${worldSeed}:schedule:${season}`))),
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

/** 서클 방식 더블 라운드로빈. 후반기는 전반기의 홈/원정을 뒤집는다 */
export function buildSchedule(teamIds: string[], rng: Rng): Fixture[][] {
  const ids = shuffle(teamIds, rng);
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
  return [...first, ...second];
}

export function teamById(league: LeagueState, id: string): Team {
  const t = league.teams.find((x) => x.id === id);
  if (!t) throw new Error(`unknown team: ${id}`);
  return t;
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
  const rng = createRng(hashSeed(`${worldSeed}:ratings:${season}`));
  const teams = league.teams.map((t) => {
    const r = ratings?.[t.id] ?? t.baseRating + (t.rating - t.baseRating) * L.ratingKeep + gaussian(rng) * L.ratingNoiseSd;
    return { ...t, rating: Math.round(Math.min(L.ratingMax, Math.max(L.ratingMin, r)) * 10) / 10 };
  });
  return {
    ...league,
    season,
    round: 0,
    teams,
    schedule: buildSchedule(teams.map((t) => t.id), createRng(hashSeed(`${worldSeed}:schedule:${season}`))),
    table: emptyTable(teams),
  };
}
