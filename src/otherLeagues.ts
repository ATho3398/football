// 여러 리그 동시 진행 (부록 C.75m, 45a): 새 게임에서 고른 다른 리그는 빠른 시뮬(simulateScore)로 날짜에 맞춰 치르고,
// 순위·지난 시즌 기록을 리그별로 보관한다. 내 리그(state.league)는 지금 방식 그대로. 안 고른 리그 팀은 리그 밖 클럽처럼 레이팅만 (teamById).
// 시드는 리그 id 를 넣어 내 리그 결과와 따로다 — PL 만 고른 게임은 C.75m 전과 같은 결과

import { BALANCE } from './config/balance';
import { leagueData, PLAYABLE_LEAGUES } from '../data/leagues';
import { CLUB_TO_TEAM, createLeague, nextSeasonLeague, recordResult, simulateScore, sortedTable, teamById, type LeagueState } from './league';
import { addDays, daysBetween, leagueCalendar, type IsoDate, type SeasonCalendar } from './calendar';
import { createRng, hashSeed, type Rng } from './rng';
import { createTeamRoster, naturalOvr, posGroup, type TeamRoster } from './roster';
import type { NpcState } from './npc';

/** 다른 리그 득점왕 한 줄 (지난 시즌 기록, C.75y): [이름, 팀 id, 골] */
export type TopScorer = [string, string, number];

/** 다른 리그 상태 = 리그 시즌 + 지난 시즌 최종 순위 (팀 id 순위 순, 최근 maxPast 시즌) + 이번 시즌 득점·도움 (C.75y) */
export interface OtherLeague extends LeagueState {
  past?: { season: number; top: string[]; scorer?: TopScorer }[];
  /** 이번 시즌 선수 기록 (C.75y, 45b): 선수 id → [골, 도움]. 빠른 시뮬 경기의 득점자를 그 팀 시드 로스터에서 뽑는다 */
  stats?: Record<string, [number, number]>;
  /** 기록이 있는 선수 이름·팀: 선수 id → [이름, 팀 id] */
  names?: Record<string, [string, string]>;
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

// ── 다른 리그 팀 로스터 (C.75y): 득점자 뽑기·컵 상대. 시드로 시즌마다 만들고(세이브에 안 담음) 실제 선수는 소속 팀에 넣는다 ──

const ROSTERS = new Map<string, TeamRoster>();
const ROSTER_CACHE_MAX = 600;

/** 내 리그가 아닌 리그 팀의 시드 로스터 (그 시즌 처음 부를 때의 레이팅, 실제 선수 = 소속 클럽 이름이 그 팀인 NPC) */
export function leagueTeamRoster(worldSeed: string, id: string, rating: number, season: number, npcs?: readonly NpcState[]): TeamRoster {
  const key = `${worldSeed}:${id}:${season}`;
  let hit = ROSTERS.get(key);
  if (!hit) {
    if (ROSTERS.size >= ROSTER_CACHE_MAX) ROSTERS.clear();
    const reals = (npcs ?? []).filter((n) => !n.retired && CLUB_TO_TEAM[n.club] === id);
    hit = createTeamRoster({ id, rating }, worldSeed, season, reals);
    ROSTERS.set(key, hit);
  }
  return hit;
}

function pickWeighted<T>(rng: Rng, items: readonly T[], w: (x: T) => number, skip?: T): T | null {
  const list = items.filter((x) => x !== skip);
  const total = list.reduce((t, x) => t + w(x), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of list) if ((r -= w(x)) <= 0) return x;
  return list.at(-1) ?? null;
}

/** 빠른 시뮬 한 경기의 득점자·도움을 리그 기록에 더한다 (컵 간이 경기와 같은 가중치, 난수는 점수와 따로) */
function addScorers(worldSeed: string, lg: OtherLeague, home: string, away: string, hg: number, ag: number, rng: Rng, npcs?: readonly NpcState[]): void {
  const C = BALANCE.cups;
  const stats = (lg.stats ??= {});
  const names = (lg.names ??= {});
  ([[home, hg], [away, ag]] as const).forEach(([id, n]) => {
    if (!n) return;
    const roster = leagueTeamRoster(worldSeed, id, teamById(lg, id).rating, lg.season, npcs);
    const lu = roster.players.map((p) => ({ p, g: posGroup(p.position), o: naturalOvr(p) })).sort((x, y) => y.o - x.o).slice(0, C.squadTop);
    const bump = (x: (typeof lu)[number], k: 0 | 1) => {
      const t = (stats[x.p.id] ??= [0, 0]);
      t[k]++;
      names[x.p.id] ??= [x.p.nameKo, id];
    };
    for (let k = 0; k < n; k++) {
      const sc = pickWeighted(rng, lu, (x) => C.scorerWeight[x.g]);
      if (!sc) continue;
      bump(sc, 0);
      const as = rng() < C.assistChance ? pickWeighted(rng, lu, (x) => C.assistWeight[x.g], sc) : null;
      if (as) bump(as, 1);
    }
  });
}

/** 그 리그 이번 시즌 득점 순위 (골 → 도움 → 이름): [선수 id, 이름, 팀 id, 골, 도움] */
export function otherScorers(lg: OtherLeague, limit = 10): [string, string, string, number, number][] {
  return Object.entries(lg.stats ?? {})
    .map(([id, [g, a]]): [string, string, string, number, number] => [id, lg.names?.[id]?.[0] ?? id, lg.names?.[id]?.[1] ?? '', g, a])
    .filter((x) => x[3] > 0)
    .sort((x, y) => y[3] - x[3] || y[4] - x[4] || x[1].localeCompare(y[1]))
    .slice(0, limit);
}

/** 한 리그를 upto 날짜(그날 포함)까지 치른다. 끝났고 다음 개막이 rolloverLeadDays 안이면 새 시즌으로 넘긴다. 치른 경기 수 */
function syncOne(worldSeed: string, start: OtherLeague, upto: IsoDate, done: (lg: OtherLeague) => void, npcs?: readonly NpcState[]): number {
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
        // 득점자 (C.75y): 따로 시드라 점수·순위는 C.75m 과 같다
        if (hg + ag) addScorers(worldSeed, lg, f.home, f.away, hg, ag, createRng(hashSeed(`${worldSeed}:olg-g:${lg.id}:${lg.season}:${r}:${i}`)), npcs);
        n++;
      });
      if (left) break;
      lg.round++;
    }
    if (lg.round < lg.schedule.length) break;
    const { next, opening } = nextOf(worldSeed, lg);
    if (daysBetween(addDays(opening, -BALANCE.calendar.rolloverLeadDays), upto) < 0) break;
    const best = otherScorers(lg, 1)[0];
    const past = [...(lg.past ?? []), { season: lg.season, top: sortedTable(lg).map((row) => row.teamId), ...(best ? { scorer: [best[1], best[2], best[3]] as TopScorer } : {}) }].slice(-MAX_PAST);
    const { stats: _s, names: _n, ...rest } = next as OtherLeague;
    lg = { ...rest, past };
    done(lg);
  }
  return n;
}

/** 그 리그 이번 시즌 남은 경기를 모두 치른다 (날짜와 무관, 같은 시드 — 내 리그로 옮길 때, C.75y). 치른 경기 수 */
export function finishOtherSeason(worldSeed: string, lg: OtherLeague, npcs?: readonly NpcState[]): number {
  let n = 0;
  while (lg.round < lg.schedule.length) {
    const r = lg.round;
    lg.schedule[r]!.forEach((f, i) => {
      if (f.homeGoals !== undefined) return;
      const [hg, ag] = simulateScore(createRng(hashSeed(`${worldSeed}:olg:${lg.id}:${lg.season}:${r}:${i}`)), teamById(lg, f.home).rating, teamById(lg, f.away).rating);
      recordResult(lg, f, hg, ag);
      if (hg + ag) addScorers(worldSeed, lg, f.home, f.away, hg, ag, createRng(hashSeed(`${worldSeed}:olg-g:${lg.id}:${lg.season}:${r}:${i}`)), npcs);
      n++;
    });
    lg.round++;
  }
  return n;
}

/** 고른 다른 리그를 upto 날짜(그날 포함)까지 진행한다. 치른 경기 수 */
export function syncOtherLeagues(state: { worldSeed: string; otherLeagues?: OtherLeague[]; npcs?: readonly NpcState[] }, upto: IsoDate): number {
  const list = state.otherLeagues;
  if (!list?.length) return 0;
  let n = 0;
  list.forEach((lg, k) => {
    n += syncOne(state.worldSeed, lg, upto, (nx) => { list[k] = nx; }, state.npcs);
  });
  return n;
}

/** 그 리그의 지난 시즌 우승 팀 id (기록 없으면 undefined) */
export function lastChampion(lg: OtherLeague): string | undefined {
  return lg.past?.at(-1)?.top[0];
}
