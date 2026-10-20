import type { FieldPlayerData, GoalkeeperData } from '../../src/types';
import { messi } from './messi';
import { stars } from './stars';
import { REAL_RETIRED_2018_2020 } from './legends';
import { PLAYERS as LALIGA } from './laliga';
import { PLAYERS as SERIEA } from './seriea';
import { bundesligaPlayers as BUNDESLIGA } from './bundesliga';
import { ligue1Players as LIGUE1 } from './ligue1';
import { PLAYERS as CHAMPIONSHIP } from './championship';
import { PLAYERS as BUNDESLIGA2 } from './bundesliga2';
import { PLAYERS as EREDIVISIE } from './eredivisie';
import { PLAYERS as PRIMEIRA, GOALKEEPERS as PRIMEIRA_GK } from './primeira';
import { PLAYERS as BRASILEIRAO, GOALKEEPERS as BRASILEIRAO_GK } from './brasileirao';
import { PLAYERS as KLEAGUE1 } from './kleague1';
import { PLAYERS as JLEAGUE1 } from './jleague1';
import { PLAYERS as MLS } from './mls';
import { PLAYERS as SAUDI } from './saudi';

/** 1단계 A등급 선수 전체. 2018-07 ~ 2020-12 은퇴자는 레전드 팩으로만 나온다 (C.47, pending 63) */
export const A_GRADE_PLAYERS: FieldPlayerData[] = [messi, ...stars].filter((p) => !(p.id in REAL_RETIRED_2018_2020));

/**
 * 리그 데이터 세션(C.75n~s)의 실제 선수 (C.75y, 45b): 리그 id → 필드 선수. 그 리그를 고른 게임에서만 NPC 가 된다
 * (A_GRADE_PLAYERS 는 늘 NPC — PL 만 고른 게임은 C.75y 전과 같다)
 */
export const LEAGUE_PLAYERS: Readonly<Record<string, readonly FieldPlayerData[]>> = {
  laliga: LALIGA, seriea: SERIEA, bundesliga: BUNDESLIGA, ligue1: LIGUE1, championship: CHAMPIONSHIP, bundesliga2: BUNDESLIGA2,
  eredivisie: EREDIVISIE, primeira: PRIMEIRA, brasileirao: BRASILEIRAO, kleague1: KLEAGUE1, jleague1: JLEAGUE1, mls: MLS, saudi: SAUDI,
};

/** 리그 데이터의 실제 GK (도감·조회용. 실제 선수 NPC 는 필드 선수만이라 경기에는 안 나온다) */
export const LEAGUE_GOALKEEPERS: Readonly<Record<string, readonly GoalkeeperData[]>> = { primeira: PRIMEIRA_GK, brasileirao: BRASILEIRAO_GK };

/** 실제 현역 필드 선수 전부 (A등급 + 리그 데이터). id 조회용 */
export const ALL_REAL_PLAYERS: readonly FieldPlayerData[] = [...A_GRADE_PLAYERS, ...Object.values(LEAGUE_PLAYERS).flat()];

export const REAL_PLAYER_BY_ID: ReadonlyMap<string, FieldPlayerData> = new Map(ALL_REAL_PLAYERS.map((p) => [p.id, p]));

/** 그 게임의 실제 선수 NPC 원본: A등급 전부 + 고른 리그의 리그 데이터 선수 (리그 순서대로) */
export function realPlayersFor(leagueIds: readonly string[]): FieldPlayerData[] {
  return [...A_GRADE_PLAYERS, ...leagueIds.flatMap((id) => LEAGUE_PLAYERS[id] ?? [])];
}
