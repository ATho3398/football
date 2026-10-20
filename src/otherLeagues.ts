// 여러 리그 동시 진행 (부록 C.75m, 45a): 새 게임에서 고른 다른 리그는 빠른 시뮬(simulateScore)로 날짜에 맞춰 치르고,
// 순위·지난 시즌 기록을 리그별로 보관한다. 내 리그(state.league)는 지금 방식 그대로. 안 고른 리그 팀은 리그 밖 클럽처럼 레이팅만 (teamById).
// 시드는 리그 id 를 넣어 내 리그 결과와 따로다 — PL 만 고른 게임은 C.75m 전과 같은 결과

import { BALANCE } from './config/balance';
import { leagueData, PLAYABLE_LEAGUES } from '../data/leagues';
import { createLeague, nextSeasonLeague, recordResult, simulateScore, sortedTable, teamById, type LeagueState } from './league';
import { addDays, daysBetween, leagueCalendar, type IsoDate, type SeasonCalendar } from './calendar';
import { createRng, hashSeed } from './rng';

/** 다른 리그 상태 = 리그 시즌 + 지난 시즌 최종 순위 (팀 id 순위 순, 최근 maxPast 시즌) */
export interface OtherLeague extends LeagueState {
  past?: { season: number; top: string[] }[];
}

const MAX_PAST = 30;

export function calendarKind(id: string): 'autumn-spring' | 'spring-autumn' {
  return leagueData(id)?.calendar ?? 'autumn-spring';
}

export function otherLeagueCalendar(worldSeed: string, lg: LeagueState): SeasonCalendar {
  return leagueCalendar(worldSeed, lg, calendarKind(lg.id));
}

/** 고른 리그 정리: 내 리그 맨 앞(없으면 PL), 등록된 리그만, 중복 없이 */
export function normalizeLeagues(ids: readonly string[] | undefined, mine?: string): string[] {
  const my = mine ?? ids?.find((id) => PLAYABLE_LEAGUES.includes(id)) ?? 'pl';
  const out = [my];
  for (const id of ids ?? []) if (!out.includes(id) && leagueData(id)) out.push(id);
  return out;
}

/** 새 게임: 내 리그를 뺀 고른 리그의 첫 시즌 (춘추제가 아닌 리그도 같은 시작 연도 = 2018 시즌 3~12월) */
export function createOtherLeagues(worldSeed: string, leagueIds: readonly string[], season: number): OtherLeague[] {
  return leagueIds.slice(1).map((id) => createLeague(worldSeed, season, id));
}

const nextOpening = new Map<string, IsoDate>();

/** 끝난 리그의 다음 시즌 (개막 날짜는 캐시) */
function nextOf(worldSeed: string, lg: OtherLeague): { next: LeagueState; opening: IsoDate } {
  const next = nextSeasonLeague(lg, worldSeed);
  const key = `${worldSeed}:${lg.id}:${next.season}`;
  let opening = nextOpening.get(key);
  if (!opening) {
    opening = otherLeagueCalendar(worldSeed, next).opening;
    if (nextOpening.size > 256) nextOpening.clear();
    nextOpening.set(key, opening);
  }
  return { next, opening };
}

/** 한 리그를 upto 날짜(그날 포함)까지 치른다. 끝났고 다음 개막이 rolloverLeadDays 안이면 새 시즌으로 넘긴다. 치른 경기 수 */
function syncOne(worldSeed: string, start: OtherLeague, upto: IsoDate, done: (lg: OtherLeague) => void): number {
  let lg = start;
  let n = 0;
  for (;;) {
    const cal = otherLeagueCalendar(worldSeed, lg);
    while (lg.round < lg.schedule.length) {
      const r = lg.round;
      const dates = cal.fixtureDates[r]!;
      let left = 0;
      lg.schedule[r]!.forEach((f, i) => {
        if (f.homeGoals !== undefined) return;
        if (daysBetween(dates[i]!, upto) < 0) { left++; return; }
        const [hg, ag] = simulateScore(
          createRng(hashSeed(`${worldSeed}:olg:${lg.id}:${lg.season}:${r}:${i}`)), teamById(lg, f.home).rating, teamById(lg, f.away).rating,
        );
        recordResult(lg, f, hg, ag);
        n++;
      });
      if (left) break;
      lg.round++;
    }
    if (lg.round < lg.schedule.length) break;
    const { next, opening } = nextOf(worldSeed, lg);
    if (daysBetween(addDays(opening, -BALANCE.calendar.rolloverLeadDays), upto) < 0) break;
    const past = [...(lg.past ?? []), { season: lg.season, top: sortedTable(lg).map((row) => row.teamId) }].slice(-MAX_PAST);
    lg = { ...next, past };
    done(lg);
  }
  return n;
}

/** 고른 다른 리그를 upto 날짜(그날 포함)까지 진행한다. 치른 경기 수 */
export function syncOtherLeagues(state: { worldSeed: string; otherLeagues?: OtherLeague[] }, upto: IsoDate): number {
  const list = state.otherLeagues;
  if (!list?.length) return 0;
  let n = 0;
  list.forEach((lg, k) => {
    n += syncOne(state.worldSeed, lg, upto, (nx) => { list[k] = nx; });
  });
  return n;
}

/** 그 리그의 지난 시즌 우승 팀 id (기록 없으면 undefined) */
export function lastChampion(lg: OtherLeague): string | undefined {
  return lg.past?.at(-1)?.top[0];
}
