// 리그 등록부 (부록 C.75m, 45a). 데이터 파일(data/leagues/<id>.ts)이 생기면 import 한 줄 + LEAGUE_DATA 에 한 칸이면 된다.
// 카탈로그(LEAGUE_CATALOG)는 리그 고르기 화면의 순서·이름이고, 데이터가 아직 없는 리그는 '준비 중'으로 보인다

import type { LeagueData } from './types';
import { PL } from './pl';
import { LEAGUE as LALIGA } from './laliga';
import { LEAGUE as SERIEA } from './seriea';
import { LEAGUE as PRIMEIRA } from './primeira';
import { LEAGUE as KLEAGUE1 } from './kleague1';
import { LEAGUE as JLEAGUE1 } from './jleague1';
import { LEAGUE as BRASILEIRAO } from './brasileirao';
import { LEAGUE as BUNDESLIGA } from './bundesliga';
import { LEAGUE as BUNDESLIGA2 } from './bundesliga2';
import { LEAGUE as CHAMPIONSHIP } from './championship';
import { LEAGUE as EREDIVISIE } from './eredivisie';
import { LEAGUE as LIGUE1 } from './ligue1';
import { LEAGUE as MLS } from './mls';
import { LEAGUE as SAUDI } from './saudi';

export type { LeagueData, LeagueTeamData } from './types';

/** 등록된 리그 데이터 */
const LEAGUE_DATA: LeagueData[] = [
  PL,
  LALIGA,
  SERIEA,
  PRIMEIRA,
  KLEAGUE1,
  JLEAGUE1,
  BRASILEIRAO,
  BUNDESLIGA,
  BUNDESLIGA2,
  CHAMPIONSHIP,
  EREDIVISIE,
  LIGUE1,
  MLS,
  SAUDI,
];

export interface LeagueEntry {
  id: string;
  nameKo: string;
  country: string;
  countryKo: string;
  tier: 1 | 2;
  calendar: LeagueData['calendar'];
  /** 데이터가 없을 때 보여 줄 예정 팀 수 */
  teams: number;
}

/** 계획된 리그 (pending 132): 화면 순서. id 는 데이터 파일 이름과 같다 */
export const LEAGUE_CATALOG: readonly LeagueEntry[] = [
  { id: 'pl', nameKo: '프리미어리그', country: 'England', countryKo: '잉글랜드', tier: 1, calendar: 'autumn-spring', teams: 20 },
  { id: 'laliga', nameKo: '라리가', country: 'Spain', countryKo: '스페인', tier: 1, calendar: 'autumn-spring', teams: 20 },
  { id: 'seriea', nameKo: '세리에 A', country: 'Italy', countryKo: '이탈리아', tier: 1, calendar: 'autumn-spring', teams: 20 },
  { id: 'bundesliga', nameKo: '분데스리가', country: 'Germany', countryKo: '독일', tier: 1, calendar: 'autumn-spring', teams: 18 },
  { id: 'ligue1', nameKo: '리그 1', country: 'France', countryKo: '프랑스', tier: 1, calendar: 'autumn-spring', teams: 20 },
  { id: 'championship', nameKo: 'EFL 챔피언십', country: 'England', countryKo: '잉글랜드', tier: 2, calendar: 'autumn-spring', teams: 24 },
  { id: 'bundesliga2', nameKo: '2. 분데스리가', country: 'Germany', countryKo: '독일', tier: 2, calendar: 'autumn-spring', teams: 18 },
  { id: 'eredivisie', nameKo: '에레디비시', country: 'Netherlands', countryKo: '네덜란드', tier: 1, calendar: 'autumn-spring', teams: 18 },
  { id: 'primeira', nameKo: '프리메이라 리가', country: 'Portugal', countryKo: '포르투갈', tier: 1, calendar: 'autumn-spring', teams: 18 },
  { id: 'saudi', nameKo: '사우디 프로리그', country: 'Saudi Arabia', countryKo: '사우디아라비아', tier: 1, calendar: 'autumn-spring', teams: 16 },
  { id: 'kleague1', nameKo: 'K리그1', country: 'Korea Republic', countryKo: '한국', tier: 1, calendar: 'spring-autumn', teams: 12 },
  { id: 'jleague1', nameKo: 'J1리그', country: 'Japan', countryKo: '일본', tier: 1, calendar: 'spring-autumn', teams: 18 },
  { id: 'brasileirao', nameKo: '브라질 세리에 A', country: 'Brazil', countryKo: '브라질', tier: 1, calendar: 'spring-autumn', teams: 20 },
  { id: 'mls', nameKo: 'MLS', country: 'United States', countryKo: '미국', tier: 1, calendar: 'spring-autumn', teams: 23 },
];

/** 새 게임 기본 묶음: PL + 5대 리그 + 챔피언십 (pending 132) */
export const DEFAULT_LEAGUES: readonly string[] = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship'];

/**
 * 내 리그로 시작할 수 있는 리그: 로스터·실제 선수·컵·이적이 연결된 리그. C.76c(45b)부터 등록된 14개 리그 전부.
 * 고른 다른 리그는 "함께 진행"(빠른 시뮬 순위표·득점 기록)
 */
export const PLAYABLE_LEAGUES: readonly string[] = LEAGUE_DATA.map((d) => d.id);

/** 국내 컵 이름 (C.76c, 45b): 리그 국가 → 한글 이름. 표에 없으면 '국내 컵' */
export const DOMESTIC_CUP_KO: Readonly<Record<string, string>> = {
  England: 'FA컵', Spain: '코파 델 레이', Italy: '코파 이탈리아', Germany: 'DFB 포칼', France: '쿠프 드 프랑스', Netherlands: 'KNVB 베이커르',
  Portugal: '타사 드 포르투갈', 'Saudi Arabia': '킹스컵', 'Korea Republic': 'FA컵', Japan: '일왕배', Brazil: '코파 두 브라질', 'United States': 'US 오픈컵',
};

/** 챔피언스리그(UEFA)에 나가는 리그 국가 (C.76c). 나머지 리그(사우디·K·J·브라질·MLS)는 챔스 없음 */
export const UEFA_COUNTRIES: ReadonlySet<string> = new Set(['England', 'Spain', 'Italy', 'Germany', 'France', 'Netherlands', 'Portugal']);

const byId = new Map<string, LeagueData>();
for (const d of LEAGUE_DATA) byId.set(d.id, d);

/** 등록된 리그 데이터 (없으면 undefined = 준비 중) */
export function leagueData(id: string): LeagueData | undefined {
  return byId.get(id);
}

/** 등록된 리그 전부 (등록 순) */
export function allLeagueData(): readonly LeagueData[] {
  return [...byId.values()];
}

/** 테스트·측정 스크립트용: 데이터 파일 없이 리그를 등록한다 (같은 id 면 바꾼다) */
export function registerLeague(d: LeagueData): void {
  byId.set(d.id, d);
}

/** 카탈로그 + 카탈로그에 없는 등록 리그 (데이터 세션이 다른 id 를 쓴 경우도 화면에 나온다) */
export function leagueCatalog(): LeagueEntry[] {
  const out = LEAGUE_CATALOG.map((e) => {
    const d = byId.get(e.id);
    return d ? { ...e, nameKo: d.nameKo, country: d.country, tier: d.tier, calendar: d.calendar, teams: d.teams.length } : e;
  });
  for (const d of byId.values()) {
    if (!out.some((e) => e.id === d.id)) out.push({ id: d.id, nameKo: d.nameKo, country: d.country, countryKo: d.country, tier: d.tier, calendar: d.calendar, teams: d.teams.length });
  }
  return out;
}
