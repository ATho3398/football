// 여러 리그 동시 진행 (부록 C.75m, 45a): 새 게임에서 고른 다른 리그는 빠른 시뮬(simulateScore)로 날짜에 맞춰 치르고,
// 순위·지난 시즌 기록을 리그별로 보관한다. 내 리그(state.league)는 지금 방식 그대로. 안 고른 리그 팀은 리그 밖 클럽처럼 레이팅만 (teamById).
// 시드는 리그 id 를 넣어 내 리그 결과와 따로다 — PL 만 고른 게임은 C.75m 전과 같은 결과

import { BALANCE } from './config/balance';
import { leagueData, PLAYABLE_LEAGUES } from '../data/leagues';
import { CLUB_TO_TEAM, createLeague, nextSeasonLeague, recordResult, scorePair, simulateScore, sortedTable, teamById, type LeagueState } from './league';
import { addDays, daysBetween, leagueCalendar, type IsoDate, type SeasonCalendar } from './calendar';
import { createRng, hashSeed, type Rng } from './rng';
import { createTeamRoster, naturalOvr, pickLineup, posGroup, type TeamRoster } from './roster';
import type { NpcState } from './npc';
import type { NpcMatchInput, NpcMatchResult } from './engine/npcMatch';
import { engineCards, npcBanAfterMatch, type NpcBanMap } from './npcBan';
import { seasonFrac } from './discipline';
import { dayNum, npcAfterMatch, npcConditions, npcLines, type NpcFitMap } from './npcFit';
import { coachStylesField } from './club';
import { envField, matchConditions } from './matchEnv';
import { derbyOf } from './derby';
import { leagueWeight, matchClutch } from './clutch';

/** 다른 리그 선수 기록: [골, 도움, 출전, 평점×10 합, 분, 결정적 순간×10 (C.76n)] (빠른 계산 경기는 출전·평점·분·결정적 순간 없음) */
export type OtherStat = [number, number, number?, number?, number?, number?];

/** 다른 리그 득점왕 한 줄 (지난 시즌 기록, C.76c): [이름, 팀 id, 골] */
export type TopScorer = [string, string, number];

/** 다른 리그 상태 = 리그 시즌 + 지난 시즌 최종 순위 (팀 id 순위 순, 최근 maxPast 시즌) + 이번 시즌 득점·도움 (C.76c) */
export interface OtherLeague extends LeagueState {
  past?: { season: number; top: string[]; scorer?: TopScorer }[];
  /**
   * 이번 시즌 선수 기록 (C.76c, 45b): 선수 id → [골, 도움, 출전, 평점×10 합, 분]. 빠른 계산 경기는 득점자만 그 팀 시드 로스터에서 뽑아 [골, 도움],
   * 풀 엔진 경기(45b b)는 엔진 선수 기록 전부
   */
  stats?: Record<string, OtherStat>;
  /** 기록이 있는 선수 이름·팀: 선수 id → [이름, 팀 id] */
  names?: Record<string, [string, string]>;
}

const MAX_PAST = 30;

/**
 * 리그 달력 (C.76m): 모든 리그가 PL 과 같은 8~5월(추춘제)·같은 시즌 번호. 3~12월은 통일 전 세이브에서 진행 중이던 시즌(legacyCal)만
 */
export function calendarKind(lg: Pick<LeagueState, 'legacyCal'>): 'autumn-spring' | 'spring-autumn' {
  return lg.legacyCal ?? 'autumn-spring';
}

export function otherLeagueCalendar(worldSeed: string, lg: LeagueState): SeasonCalendar {
  return leagueCalendar(worldSeed, lg, calendarKind(lg));
}

/** 고른 리그 정리: 내 리그 맨 앞(없으면 PL), 등록된 리그만, 중복 없이 */
export function normalizeLeagues(ids: readonly string[] | undefined, mine?: string): string[] {
  const my = mine ?? ids?.find((id) => PLAYABLE_LEAGUES.includes(id)) ?? 'pl';
  const out = [my];
  for (const id of ids ?? []) if (!out.includes(id) && leagueData(id)) out.push(id);
  return out;
}

/** 새 게임: 내 리그를 뺀 고른 리그의 첫 시즌 (C.76m: 모든 리그 같은 8~5월 달력 — 데이터의 2018 시즌 팀·선수 그대로 2018-19 시즌) */
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

// ── 다른 리그 팀 로스터 (C.76c): 득점자 뽑기·컵 상대. 시드로 시즌마다 만들고(세이브에 안 담음) 실제 선수는 소속 팀에 넣는다 ──

const ROSTERS = new Map<string, TeamRoster>();
const ROSTER_CACHE_MAX = 600;

/**
 * 내 리그가 아닌 리그 팀의 시드 로스터 (레이팅, 실제 선수 = 소속 클럽 이름이 그 팀인 NPC).
 * 캐시 키에 레이팅·실제 선수 id 를 넣는다 (C.76m): 언제 처음 불렀는지(미리 계산·불러오기)와 무관하게 지금 상태로 정해진다
 */
export function leagueTeamRoster(worldSeed: string, id: string, rating: number, season: number, npcs?: readonly NpcState[]): TeamRoster {
  const reals = (npcs ?? []).filter((n) => !n.retired && CLUB_TO_TEAM[n.club] === id);
  const key = `${worldSeed}:${id}:${season}:${rating}:${reals.map((n) => n.id).join(',')}`;
  let hit = ROSTERS.get(key);
  if (!hit) {
    if (ROSTERS.size >= ROSTER_CACHE_MAX) ROSTERS.clear();
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

/** 다른 리그 빠른 진행 한 경기 점수 (C.81q): 레이팅 간이 계산 × 리그 득점 배율(otherScorers.goalScale — 엔진 리그별 경기당 골에 맞춤, 없으면 1 = simulateScore 그대로) */
function otherScore(rng: Rng, lg: LeagueState, home: string, away: string): [number, number] {
  const hr = teamById(lg, home).rating;
  const ar = teamById(lg, away).rating;
  const C = BALANCE.otherScorers;
  const k = C.goalScale[lg.id] ?? 1;
  const d = C.diffScale ?? 1;
  if (k === 1 && d === 1) return simulateScore(rng, hr, ar);
  // C.81w: 레이팅 차 효과 × diffScale — 빠른 진행은 상위 팀 독주가 엔진보다 커서(1위 팀 경기당 득점 2.7~2.9 대 2.2~2.5) 리그 득점왕이 엔진보다 4~6골 많았다
  const M = BALANCE.match;
  const xg = (own: number, opp: number, home: boolean) => M.baseGoals * Math.exp(((own - opp) * d + (home ? M.homeRating : 0)) * M.goalsK);
  return scorePair(rng, xg(hr, ar, true) * k, xg(ar, hr, false) * k);
}

/** 다른 리그 득점자 후보 (C.81q): 로스터마다 한 번 — 선발·벤치·그 밖(pickLineup, 시상 추정 출전과 같은 구분) 출전 몫 × 포지션군 × OVR(선발 평균 대비) 가중 */
const BIG5 = ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1'];
type ScorerPick = { p: TeamRoster['players'][number]; g: number; a: number };
let SCORER_POOL = new WeakMap<TeamRoster, ScorerPick[]>();
/** 진단(맞춤 스크립트): BALANCE.otherScorers 를 바꾼 뒤 후보 캐시를 비운다 */
export function resetScorerPool(): void { SCORER_POOL = new WeakMap(); }
function scorerPool(roster: TeamRoster, lgId: string): ScorerPick[] {
  let hit = SCORER_POOL.get(roster);
  if (hit) return hit;
  const C = BALANCE.otherScorers;
  // C.81w: 리그 × 포지션군 [골, 도움] 배수 (빅5 는 리그 id, 그 밖은 'rest')
  const LM = C.leagueMul?.[lgId] ?? C.leagueMul?.[BIG5.includes(lgId) ? '' : 'rest'];
  const lu = pickLineup(roster);
  const st = new Set(lu.slots.map((x) => x.playerId));
  const bn = new Set(lu.bench);
  const ovr = new Map(roster.players.map((p) => [p.id, naturalOvr(p)]));
  const starters = roster.players.filter((p) => st.has(p.id));
  const ref = starters.reduce((t, p) => t + ovr.get(p.id)!, 0) / Math.max(1, starters.length);
  hit = roster.players.map((p) => {
    const g = posGroup(p.position);
    const cls = st.has(p.id) ? 0 : bn.has(p.id) ? 1 : 2;
    // C.81w: 출전 몫 = 시상 추정과 같은 포지션군 × 구분 분포의 평균(awards.estimate.shareQ) × shareK[구분] — 없으면 옛 share
    const q = C.shareK ? BALANCE.awards.estimate.shareQ[g]?.[cls] : undefined;
    const share = q ? C.shareK![cls]! * (q[0]! + 2 * (q[1]! + q[2]! + q[3]!) + q[4]!) / 8 : C.share[cls]!;
    const rel = ovr.get(p.id)! - ref;
    // C.81w: 골 OVR 가중의 (OVR − 선발 평균)은 relCap 에서 멈춘다 — 엔진에선 팀 평균보다 훨씬 높은 스타(음바페·호날두)도 20~30골인데 빠른 진행은 36~48골을 몰아갔다
    const lm = LM?.[g];
    return { p, g: (C.scorerWeight[g] ?? 0) * (lm?.[0] ?? 1) * share * Math.exp(Math.min(rel, C.relCap ?? Infinity) * C.ovrK), a: (C.assistWeight[g] ?? 0) * (lm?.[1] ?? 1) * share * Math.exp(rel * C.ovrKAssist) };
  }).filter((x) => x.g > 0 || x.a > 0);
  SCORER_POOL.set(roster, hit);
  return hit;
}

/** 빠른 시뮬 한 경기의 득점자·도움을 리그 기록에 더한다 (난수는 점수와 따로). C.81q: 가중 = scorerPool (엔진 실측 포지션군·상위 득점 분포에 맞춤) */
function addScorers(worldSeed: string, lg: OtherLeague, home: string, away: string, hg: number, ag: number, rng: Rng, npcs?: readonly NpcState[]): void {
  const C = BALANCE.otherScorers;
  const stats = (lg.stats ??= {});
  const names = (lg.names ??= {});
  ([[home, hg], [away, ag]] as const).forEach(([id, n]) => {
    if (!n) return;
    const lu = scorerPool(leagueTeamRoster(worldSeed, id, teamById(lg, id).rating, lg.season, npcs), lg.id);
    const bump = (x: ScorerPick, k: 0 | 1) => {
      const t = (stats[x.p.id] ??= [0, 0]);
      t[k] = t[k]! + 1;
      names[x.p.id] ??= [x.p.nameKo, id];
    };
    for (let k = 0; k < n; k++) {
      const sc = pickWeighted(rng, lu, (x) => x.g);
      if (!sc) continue;
      bump(sc, 0);
      const as = rng() < C.assistChance ? pickWeighted(rng, lu, (x) => x.a, sc) : null;
      if (as) bump(as, 1);
    }
  });
}

// ── 풀 엔진 (45b b): 다른 리그 경기를 내 리그 다른 경기와 같은 엔진으로. 경기별 시드 고정이라 워커 수와 무관하게 같은 결과 ──

/** 다른 리그 경기 하나의 엔진 작업 (직렬화 가능, Web Worker 로 보낸다) */
export interface OtherLeagueJob { lg: string; season: number; r: number; i: number; input: NpcMatchInput }

/** 그날(date) 열리는 다른 리그 경기 중 아직 결과가 없는 것의 엔진 입력 (리그 순서 · 라운드 · 경기 순) */
export function otherLeagueJobs(state: { worldSeed: string; otherLeagues?: OtherLeague[]; npcs?: readonly NpcState[]; npcFit?: NpcFitMap; npcBan?: NpcBanMap }, date: IsoDate): OtherLeagueJob[] {
  const out: OtherLeagueJob[] = [];
  for (const lg of state.otherLeagues ?? []) {
    if (lg.round >= lg.schedule.length) continue;
    const cal = otherLeagueCalendar(state.worldSeed, lg);
    const avg = lg.teams.reduce((t, x) => t + x.rating, 0) / lg.teams.length;
    for (let r = lg.round; r < lg.schedule.length; r++) {
      const dates = cal.fixtureDates[r]!;
      if (daysBetween(date, dates[0]!) > 7) break;
      lg.schedule[r]!.forEach((f, i) => {
        if (f.homeGoals !== undefined || dates[i] !== date) return;
        const hr = teamById(lg, f.home).rating;
        const ar = teamById(lg, f.away).rating;
        const home = leagueTeamRoster(state.worldSeed, f.home, hr, lg.season, state.npcs);
        const away = leagueTeamRoster(state.worldSeed, f.away, ar, lg.season, state.npcs);
        // NPC 피로·부상 (C.77m): 경기 날 아침 컨디션 · 출장 정지 결장 (C.80a)
        const cond = npcConditions(state.npcFit, [home, away], dayNum(date), state.npcBan);
        out.push({
          lg: lg.id, season: lg.season, r, i,
          input: {
            home, away,
            homeRating: hr, awayRating: ar, seed: hashSeed(`${state.worldSeed}:olg-e:${lg.id}:${lg.season}:${r}:${i}`), worldSeed: state.worldSeed,
            leagueAvg: avg, ...envField(matchConditions(state.worldSeed, date, f.home)), ...(cond ? { cond } : {}),
            // 감독 기용 성향 (C.79i): 리그 데이터 감독
            ...coachStylesField({}, f.home, f.away),
          },
        });
      });
    }
  }
  return out;
}

/** 엔진 결과를 그 리그에 기록한다: 순위표 · 선수 기록 (골·도움·출전·평점·분). 이미 결과가 있으면 그대로 */
export function applyOtherLeagueJob(state: { worldSeed?: string; otherLeagues?: OtherLeague[]; npcFit?: NpcFitMap; npcBan?: NpcBanMap }, job: Pick<OtherLeagueJob, 'lg' | 'season' | 'r' | 'i' | 'input'>, res: NpcMatchResult): void {
  const lg = state.otherLeagues?.find((o) => o.id === job.lg && o.season === job.season);
  const f = lg?.schedule[job.r]?.[job.i];
  if (!lg || !f || f.homeGoals !== undefined) return;
  recordResult(lg, f, res.hg, res.ag);
  // NPC 피로·부상 (C.77m): 경기 뒤 거리 비례 피로·부상 판정
  if (state.worldSeed !== undefined) {
    const date = otherLeagueCalendar(state.worldSeed, lg).fixtureDates[job.r]![job.i]!;
    npcAfterMatch((state.npcFit ??= {}), [job.input.home, job.input.away], npcLines(res), dayNum(date), state.worldSeed, job.input.seed);
  }
  // NPC 출장 정지 (C.80a): 엔진 카드 (빠른 계산 syncOtherLeagues 경로는 카드 없음)
  npcBanAfterMatch((state.npcBan ??= {}), [job.input.home, job.input.away], engineCards(res), seasonFrac(job.r, lg.schedule.length));
  const stats = (lg.stats ??= {});
  const names = (lg.names ??= {});
  const who = new Map<string, [string, string]>([
    ...job.input.home.players.map((p) => [p.id, [p.nameKo, f.home]] as [string, [string, string]]),
    ...job.input.away.players.map((p) => [p.id, [p.nameKo, f.away]] as [string, [string, string]]),
  ]);
  // 결정적 순간 (C.76n 개인 시상): 결승골 · 늦은 동점/역전골 · 해트트릭, 더비 · 상위 팀 상대 무게
  const top = new Set([...lg.teams].sort((x, y) => y.rating - x.rating).slice(0, BALANCE.awards.resume.clutch.topRank).map((t) => t.id));
  const derby = !!derbyOf(f.home, f.away);
  const clutch = new Map<string, number>();
  matchClutch(res.goals, res.hg, res.ag, [leagueWeight(derby, top.has(f.away)), leagueWeight(derby, top.has(f.home))], (id, p) => clutch.set(id, (clutch.get(id) ?? 0) + p));
  for (const [id, min, g, a, r10] of res.players) {
    const t = (stats[id] ??= [0, 0]);
    const c = clutch.get(id);
    if (c) t[5] = (t[5] ?? 0) + Math.round(c * 10);
    t[0] += g;
    t[1] += a;
    t[2] = (t[2] ?? 0) + 1;
    t[3] = (t[3] ?? 0) + r10;
    t[4] = (t[4] ?? 0) + min;
    const w = who.get(id);
    if (w) names[id] ??= w;
  }
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
        const [hg, ag] = otherScore(createRng(hashSeed(`${worldSeed}:olg:${lg.id}:${lg.season}:${r}:${i}`)), lg, f.home, f.away);
        recordResult(lg, f, hg, ag);
        // 득점자 (C.76c): 따로 시드라 점수·순위는 C.75m 과 같다
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

/** 그 리그 이번 시즌 남은 경기를 모두 치른다 (날짜와 무관, 같은 시드 — 내 리그로 옮길 때, C.76c). 치른 경기 수 */
export function finishOtherSeason(worldSeed: string, lg: OtherLeague, npcs?: readonly NpcState[]): number {
  let n = 0;
  while (lg.round < lg.schedule.length) {
    const r = lg.round;
    lg.schedule[r]!.forEach((f, i) => {
      if (f.homeGoals !== undefined) return;
      const [hg, ag] = otherScore(createRng(hashSeed(`${worldSeed}:olg:${lg.id}:${lg.season}:${r}:${i}`)), lg, f.home, f.away);
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
