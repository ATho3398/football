// 내 선수 리그 이동 (부록 C.75y, 45b: 이적 시장 = 고른 리그 전체). 비시즌 여름 창에 고른 다른 리그(내 리그와 달력이 같은 리그) 팀 제안을
// 받아들이면, 그 자리에서 새 리그 로스터를 시드로 만들어 더하고(prepareLeagueMove), 다음 시즌 시작(startNextSeason)에 내 리그를 바꾼다
// (applyLeagueMove: 새 리그가 내 리그, 옛 리그는 다른 리그로 빠른 시뮬). 로스터 재생성은 이동 기록(myLeagues)으로 같은 자리에서 다시 만든다.
// 레전드 팩 선수는 시작 리그 로스터에만 있어 리그를 옮기면 따라오지 않는다 (미래 스타는 새 리그에 이미 데뷔한 선수를 넣는다)

import type { GameState } from './game';
import { initialTeams, leagueOfTeam, nextSeasonLeague, type LeagueState } from './league';
import { createRosters, teamRatings, type Rosters } from './roster';
import type { NpcState } from './npc';
import { FUTURE_STARS, futureDebut, futureEntry, legendClub, legendRosterPlayer, type LegendSpawn } from './legends';
import { finishOtherSeason, type OtherLeague } from './otherLeagues';
import { setSquadLeague } from './squad';
import { ensureFinance } from './finance';

/** 내 리그 이동 기록: at = 그때 로스터 시즌 갱신 횟수(roster.updates), id = 새 리그. 첫 줄 = 시작 리그 (at 0) */
export interface LeagueMove { at: number; id: string }

/** 새 리그에 이미 데뷔한 미래 스타 (그 리그 첫 시즌 ≤ season): 그 팀으로, 그 시즌 나이로 */
function movedFutureSpawns(worldSeed: string, leagueId: string, season: number, teams: readonly { id: string; rating: number }[]): LegendSpawn[] {
  return FUTURE_STARS.filter((l) => (futureDebut(l, [leagueId]) ?? Infinity) <= season).map((l) => {
    const e = futureEntry(l, [leagueId])!;
    const teamId = teams.some((t) => t.id === e.team) ? e.team : legendClub(l, worldSeed, teams);
    return { legend: l, teamId, player: { ...legendRosterPlayer(l, worldSeed, season), youth: teamId } };
  });
}

/** 리그 이동 때 새 리그 로스터 (시드): 목표 레이팅 = 데이터 레이팅, 실제 선수 = 지금 소속이 그 팀인 NPC */
export function moveRosters(worldSeed: string, leagueId: string, season: number, npcs: NpcState[], future: boolean): Rosters {
  const teams = initialTeams(leagueId).map((t) => ({ id: t.id, rating: t.baseRating }));
  return createRosters(worldSeed, season, teams, npcs, future ? movedFutureSpawns(worldSeed, leagueId, season, teams) : []);
}

/** 이동 기록 (옛 세이브 = 지금 리그에서 시작) */
export function leagueMoves(state: Pick<GameState, 'myLeagues' | 'league'>): LeagueMove[] {
  return state.myLeagues ?? [{ at: 0, id: state.league.id }];
}

/**
 * 다른 리그 팀 제안을 받아들일 때 (acceptOffer, joinTeam 전): 새 리그 로스터를 더하고 이동을 기록한다.
 * 이미 그 팀 로스터가 있으면(같은 리그) 아무것도 안 한다
 */
export function prepareLeagueMove(state: GameState, teamId: string): void {
  if (state.rosters[teamId]) return;
  const id = leagueOfTeam(teamId);
  if (!id || id === state.league.id) return;
  const moves = leagueMoves(state);
  state.myLeagues = [...moves.filter((m) => m.at !== state.roster.updates || m.at === 0), { at: state.roster.updates, id }];
  Object.assign(state.rosters, moveRosters(state.worldSeed, id, state.league.season + 1, state.npcs, !!state.futureStars));
}

const stripOther = ({ past: _p, stats: _s, names: _n, ...lg }: OtherLeague): LeagueState => lg;

/**
 * 다음 시즌 시작 (startNextSeason): 내 팀이 다른 리그 팀이면 그 리그가 내 리그. 새 리그 다음 시즌(레이팅 = 새 로스터),
 * 옛 리그는 다른 리그 자리로 (끝난 시즌 그대로, 개막 전에 빠른 시뮬로 넘어간다). 바꿨으면 true
 */
export function applyLeagueMove(state: GameState): boolean {
  const id = leagueOfTeam(state.player.teamId);
  const list = state.otherLeagues ?? [];
  const k = list.findIndex((o) => o.id === id);
  if (!id || id === state.league.id || k < 0) return false;
  const old = state.league;
  const season = old.season + 1;
  const L = list[k]!;
  // 그 리그 지난 시즌이 남았으면 끝까지 (같은 시드라 나중에 날짜대로 치른 결과와 같다)
  if (L.season === old.season) finishOtherSeason(state.worldSeed, L, state.npcs);
  const teamIds = new Set(L.teams.map((t) => t.id));
  for (const tid of Object.keys(state.rosters)) if (!teamIds.has(tid)) delete state.rosters[tid];
  const ratings = teamRatings(state.rosters);
  const next = L.season === season
    ? { ...stripOther(L), teams: L.teams.map((t) => ({ ...t, rating: Math.round((ratings[t.id] ?? t.rating) * 10) / 10 })) }
    : nextSeasonLeague(stripOther(L), state.worldSeed, ratings);
  state.league = next;
  list[k] = { ...old };
  state.leagueIds = [id, ...(state.leagueIds ?? [old.id]).filter((x) => x !== id)];
  setSquadLeague(id);
  delete state.finance;
  ensureFinance(state, season);
  return true;
}

/** 재생성용: 이동 기록에서 그 갱신 뒤(at) 새 리그로 바꾸는 이동 (없으면 undefined) */
export function moveAt(moves: readonly LeagueMove[], at: number): LeagueMove | undefined {
  return moves.find((m) => m.at === at && m.at > 0);
}

