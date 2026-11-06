// 챔스/컵 (18.7, 5-6, pending 108, 부록 C.67). a = 대회 틀 · 일정 편입 · 내 팀 없는 경기 레이팅 간이 계산 · 국내 컵(FA컵),
// b = 챔스(조별 8조 + 홈·원정 녹아웃 + 단판 결승) · 업적 보상.
// 내 팀 경기는 game.ts 가 전 엔진으로 치르고(playMyCup) 결과만 여기 기록한다. 대진·날짜·간이 결과는 시드로 정해진다.
// 세이브에는 대진과 결과만 담는다 (FA컵 31경기 + 챔스 125경기)

import { BALANCE } from './config/balance';
import { addDays, daysBetween, isoDate, leagueCalendar, nearestSaturday, weekday, type IsoDate } from './calendar';
import { FA_CUP_EXTRA, UCL_EXTRA } from '../data/outsideClubs';
import { allLeagueData, DOMESTIC_CUP_KO, leagueData, UEFA_COUNTRIES } from '../data/leagues';
import { canonicalClub, OUTSIDE_TO_LEAGUE } from '../data/clubAlias';
import { leagueOfTeam, leagueTeamById, simulateScore, teamById } from './league';
import { calendarKind, leagueTeamRoster } from './otherLeagues';
import { createTeamRoster, posGroup, type TeamRoster } from './roster';
import { createRng, hashSeed, type Rng } from './rng';
import type { GoalRec } from './engine/npcMatch';
import type { GameState } from './game';
import { dayNum, type NpcLine } from './npcFit';
import { lineupLines, npcQuickMatch, quickLines } from './npcQuick';

export type CompId = 'fa' | 'ucl';

/** 한 경기. hg·ag 가 있으면 끝난 경기. p = 승부차기 [홈, 원정], w = 이긴 팀 (단판·2차전), d = 경기 날 (챔스, 없으면 단계 날짜) */
export interface CupTie {
  d?: IsoDate;
  h: string;
  a: string;
  hg?: number;
  ag?: number;
  p?: [number, number];
  w?: string;
  /** 득점 기록 [분, 팀 0 홈·1 원정, 득점자, 도움] (내 경기는 엔진, 다른 경기는 간이 계산) */
  g?: GoalRec[];
}

export interface CupComp {
  id: CompId;
  /** 단계별 날짜 (32강·16강·8강·4강·결승) */
  dates: IsoDate[];
  /** 단계별 대진. 다음 단계는 앞 단계가 끝난 날 추첨한다 */
  rounds: CupTie[][];
  winner?: string;
}

/** 챔스 녹아웃 한 단계: 1차전 l1[i] 와 2차전 l2[i] 가 한 짝 (2차전 홈 = 1차전 원정). 결승은 l1 한 경기, l2 없음 */
export interface UclStage {
  l1: CupTie[];
  l2: CupTie[];
}

/** 챔스 (C.67b) */
export interface UclComp {
  id: 'ucl';
  /** 8조 × 4팀 (A~H) */
  groups: string[][];
  /** 조별 6차전: gs[차전] = 16경기 (조 순서대로 2경기씩) */
  gs: CupTie[][];
  /** 녹아웃: 16강 · 8강 · 4강 · 결승 (앞 단계가 끝난 날 추첨) */
  ko: UclStage[];
  winner?: string;
}

export interface CupsState {
  season: number;
  /** FA컵. null = 이번 시즌 없음 (옛 세이브가 32강 날짜를 지난 뒤 불러왔을 때) */
  fa: CupComp | null;
  /** 챔스 (C.67b). null·없음 = 이번 시즌 없음 (C.67a 세이브는 다음 시즌부터) */
  ucl?: UclComp | null;
}

export const COMP_NAMES_KO: Record<CompId, string> = { fa: 'FA컵', ucl: '챔스' };

/** 국내 컵 이름 (C.76c): 내 리그 국가의 컵 (PL·챔피언십 = FA컵) */
export function cupNameKo(leagueId: string | undefined): string {
  return DOMESTIC_CUP_KO[leagueData(leagueId ?? 'pl')?.country ?? 'England'] ?? '국내 컵';
}

/** 대회 짧은 이름 (국내 컵은 내 리그 국가 컵 이름) */
export function compNameKo(comp: CompId, leagueId?: string): string {
  return comp === 'fa' ? cupNameKo(leagueId) : COMP_NAMES_KO[comp];
}
export const KO_NAMES = ['16강', '8강', '4강', '결승'] as const;
export const GROUP_LETTERS = 'ABCDEFGH';

/** 출전 팀 (첫 단계 대진) */
export const compTeams = (comp: CupComp): string[] => comp.rounds[0]!.flatMap((t) => [t.h, t.a]);

/** 단계 이름 (남은 팀 수로) */
export function stageName(comp: CupComp, stage: number): string {
  const n = (comp.rounds[0]!.length * 2) >> stage;
  return n <= 2 ? '결승' : `${n}강`;
}

const rngFor = (seed: string, ...parts: (string | number)[]): Rng => createRng(hashSeed([seed, ...parts].join(':')));

// ── 일정 ──

/** 이번 시즌 리그 경기 날짜 (teams 가 있으면 그 팀들 경기만) */
function myCal(state: GameState) {
  return leagueCalendar(state.worldSeed, state.league, calendarKind(state.league));
}

function leagueDates(state: GameState, teams?: readonly string[]): Set<IsoDate> {
  const cal = myCal(state);
  const only = teams ? new Set(teams) : null;
  const out = new Set<IsoDate>();
  state.league.schedule.forEach((round, r) => round.forEach((f, i) => {
    if (!only || only.has(f.home) || only.has(f.away)) out.add(cal.fixtureDates[r]![i]!);
  }));
  return out;
}

/** 단계 날짜 하나 (목표일 근처, 리그 경기와 minGap → 안 되면 minGapLoose) */
function stageDate(target: IsoDate, busy: Set<IsoDate>, prev: IsoDate | null): IsoDate {
  const C = BALANCE.cups;
  return freeDateNear(target, busy, prev, C.minGap) ?? freeDateNear(target, busy, prev, C.minGapLoose) ?? freeDateNear(target, busy, prev, 1) ?? nearestSaturday(target);
}

/** 목표 날짜에서 리그 경기와 gap 일 이상 떨어진 첫 날: 토 → 일 → 그 주 화·수 → 앞 주 화·수 → 다음 주 토 … */
function freeDateNear(target: IsoDate, busy: Set<IsoDate>, after: IsoDate | null, gap: number): IsoDate | null {
  const sat = nearestSaturday(target);
  const offs = [0, 1, 3, 4, -4, -3, 7, 8, -7, 10, 11];
  for (const o of offs) {
    const d = addDays(sat, o);
    if (after && daysBetween(after, d) < gap) continue;
    let ok = true;
    for (let k = -(gap - 1); k <= gap - 1 && ok; k++) if (busy.has(addDays(d, k))) ok = false;
    if (ok) return d;
  }
  return null;
}

/**
 * FA컵(국내 컵) 단계 날짜: 32강 1월 초, 16강 1월 말, 8강 3월, 4강 4월 (리그 없는 컵 주말 우선), 결승 = 최종 라운드 다음 주 토요일.
 * 팀이 적은 컵(16·8팀, C.76c)은 앞 단계를 건너뛴다 (16팀 = 16강부터). 춘추제 리그는 6개월 당긴다 (7월·9월·10월)
 */
export function faDates(state: GameState, rounds = cupRounds(state)): IsoDate[] {
  const C = BALANCE.cups;
  const cal = myCal(state);
  const busy = leagueDates(state);
  const out: IsoDate[] = [];
  const skip = C.fa.stages.length + 1 - rounds;
  for (let s = skip; s < C.fa.stages.length; s++) out.push(stageDate(faTarget(state, s), busy, out.at(-1) ?? null));
  out.push(addDays(cal.final, C.fa.finalAfter));
  return out;
}

function faTarget(state: GameState, stage: number): IsoDate {
  const [y, m, d] = BALANCE.cups.fa.stages[stage]!;
  // 춘추제 (C.76c): 3~12월 시즌이라 같은 해 6개월 앞 (1월 → 7월). C.76m 부터는 통일 전 세이브의 진행 중 시즌만
  if (calendarKind(state.league) === 'spring-autumn') return isoDate(state.league.season, m + 6, d);
  return isoDate(y ? state.league.season + 1 : state.league.season, m, d);
}

/** 국내 컵 단계 수 (32팀 5, 16팀 4, 8팀 3) */
function cupRounds(state: GameState): number {
  return Math.round(Math.log2(domesticCupTeams(state).length));
}

/**
 * 국내 컵 참가 팀: PL = 리그 20 + 하부 가상 12 (FA_CUP_EXTRA, 그대로). 다른 리그 (C.76c) = 내 리그 + 같은 나라 다른 리그(데이터) 팀을
 * 레이팅 순으로 32·16·8팀 중 들어가는 가장 큰 수만큼 (내 팀은 늘 넣는다 — 상위 팀이 앞 라운드를 건너뛴 것으로 본다)
 */
export function domesticCupTeams(state: GameState): string[] {
  const lg = state.league;
  if (lg.id === 'pl') return [...lg.teams.map((t) => t.id), ...FA_CUP_EXTRA];
  const country = leagueData(lg.id)?.country;
  const pool = [...lg.teams.map((t) => ({ id: t.id, r: t.rating })), ...allLeagueData()
    .filter((d) => d.id !== lg.id && d.country === country)
    .flatMap((d) => d.teams.map((t) => ({ id: t.id, r: t.rating })))];
  const size = pool.length >= 32 ? 32 : pool.length >= 16 ? 16 : 8;
  const sorted = pool.sort((a, b) => b.r - a.r || a.id.localeCompare(b.id)).map((x) => x.id);
  const out = sorted.slice(0, size);
  const me = state.player?.teamId;
  if (me && lg.teams.some((t) => t.id === me) && !out.includes(me)) out[size - 1] = me;
  return out;
}

// ── 생성·추첨 ──

/** 시즌 시작 (또는 옛 세이브 첫 불러오기): 이번 시즌 컵. 첫 단계 날짜가 이미 지났으면 null */
export function createCups(state: GameState): CupsState {
  const season = state.league.season;
  const dates = faDates(state);
  const fa: CupComp | null = daysBetween(state.calendar.date, dates[0]!) >= 0
    ? { id: 'fa', dates, rounds: [] }
    : null;
  if (fa) fa.rounds.push(draw(state.worldSeed, season, fa, domesticCupTeams(state)));
  const cups: CupsState = { season, fa, ucl: null };
  createUcl(state, cups);
  return cups;
}

/** 컵 상태 (없거나 지난 시즌 것이면 새로) */
export function ensureCups(state: GameState): CupsState {
  if (!state.cups || state.cups.season !== state.league.season) state.cups = createCups(state);
  return state.cups;
}

/** 대진 추첨 (시드): 섞어서 둘씩, 앞 팀이 홈 */
function draw(seed: string, season: number, comp: CupComp, teams: readonly string[]): CupTie[] {
  const rng = rngFor(seed, 'cup', comp.id, season, 'draw', comp.rounds.length);
  const t = [...teams];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  const out: CupTie[] = [];
  for (let i = 0; i + 1 < t.length; i += 2) out.push({ h: t[i]!, a: t[i + 1]! });
  return out;
}

/** 지금 단계 (추첨된 마지막 단계) */
export const currentStage = (comp: CupComp): number => comp.rounds.length - 1;

/** 경기를 끝낸다: 무승부면 승부차기 간이 판정 */
export function settleTie(state: GameState, comp: CupComp, stage: number, i: number, hg: number, ag: number, g?: GoalRec[]): void {
  const tie = comp.rounds[stage]![i]!;
  tie.hg = hg;
  tie.ag = ag;
  if (g?.length) tie.g = g;
  if (hg !== ag) tie.w = hg > ag ? tie.h : tie.a;
  else shootout(state, tie, comp.id, stage, i);
}

/** 승부차기 간이 판정 (홈 = tie.h 기준 승률, 레이팅 차) → tie.p · tie.w */
function shootout(state: GameState, tie: CupTie, comp: CompId, ...key: (string | number)[]): void {
  const P = BALANCE.cups.pens;
  const rng = rngFor(state.worldSeed, 'cup', comp, state.league.season, 'pens', ...key);
  const diff = teamById(state.league, tie.h).rating - teamById(state.league, tie.a).rating;
  const homeWins = rng() < Math.min(P.max, Math.max(P.min, 0.5 + diff * P.ratingK));
  const win = 3 + Math.floor(rng() * 3);
  const lose = Math.max(0, win - 1 - (rng() < 0.35 ? 1 : 0));
  tie.p = homeWins ? [win, lose] : [lose, win];
  tie.w = homeWins ? tie.h : tie.a;
}

/** 단계가 다 끝났으면 다음 단계 추첨 (결승이면 우승 팀) */
function advance(state: GameState, comp: CupComp): void {
  const round = comp.rounds[currentStage(comp)]!;
  if (round.some((t) => !t.w)) return;
  const winners = round.map((t) => t.w!);
  if (winners.length === 1) {
    comp.winner = winners[0];
    return;
  }
  comp.rounds.push(draw(state.worldSeed, state.league.season, comp, winners));
  // 추첨 때 날짜를 남은 팀 기준으로 다시 잡는다 (결승 제외): 남은 팀의 리그 경기와만 간격을 지키면 되므로 자리가 넓어진다
  const s = currentStage(comp);
  // 단계 수가 적은 컵 (C.76c): 앞 단계를 건너뛴 만큼 날짜 표 자리를 민다
  const skip = BALANCE.cups.fa.stages.length + 1 - comp.dates.length;
  if (s + skip < BALANCE.cups.fa.stages.length && daysBetween(state.calendar.date, comp.dates[s]!) > 0) {
    // 챔스 경기도 피한다 (C.67b)
    const busy = leagueDates(state, winners);
    const u = state.cups?.ucl;
    if (u) for (const m of uclMatches(u)) if (m.t.d && (winners.includes(m.t.h) || winners.includes(m.t.a))) busy.add(m.t.d);
    comp.dates[s] = stageDate(faTarget(state, s + skip), busy, comp.dates[s - 1]!);
  }
}

// ── 내 팀 없는 경기: 레이팅 간이 계산 (결과·득점자만, pending 108 계산) ──

const rosterCache = new Map<string, TeamRoster>();

/**
 * 경기용 로스터: 리그 팀은 지금 로스터, 리그 밖 클럽은 시드 고정 생성 로스터(레이팅이 고정이라 시즌과 무관하게 한 번,
 * 기준 시즌 BASE_SEASON 으로 만든다 — 시즌 시뮬 시간 보호). 세이브에 담지 않는다
 */
export function cupRoster(state: GameState, id: string): TeamRoster {
  const r = state.rosters?.[id];
  if (r) return r;
  // 다른 리그 팀 (C.76c): 그 시즌 시드 로스터 (실제 선수 포함, 다른 리그 득점 기록과 같은 로스터)
  if (!id.startsWith('x:') && leagueTeamById(id)) return leagueTeamRoster(state.worldSeed, id, teamById(state.league, id).rating, state.league.season, state.npcs);
  const key = `${state.worldSeed}:${id}`;
  let hit = rosterCache.get(key);
  if (!hit) {
    if (rosterCache.size > 64) rosterCache.clear();
    hit = createTeamRoster({ id, rating: teamById(state.league, id).rating }, state.worldSeed, BASE_SEASON, []);
    rosterCache.set(key, hit);
  }
  return hit;
}

const BASE_SEASON = 2018;

function pickWeighted<T>(rng: Rng, items: readonly T[], w: (x: T) => number, skip?: T): T | null {
  const list = items.filter((x) => x !== skip);
  const total = list.reduce((t, x) => t + w(x), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const x of list) if ((r -= w(x)) <= 0) return x;
  return list.at(-1) ?? null;
}

/**
 * 득점자·도움을 그 경기 출전 명단에서 뽑는다 (C.77w): 가중치 = 포지션군 × 출전 분/90. 명단은 quickLines(내 리그 팀은 그날 부상·피로 반영,
 * 다른 리그 팀은 컨디션 없이 — 시즌·팀마다 캐시). 옛: OVR 상위 squadTop 명 (실제 선발·부상과 무관)
 */
export function cupScorers(state: GameState, rng: Rng, tie: CupTie, hg: number, ag: number, lines: readonly NpcLine[][]): GoalRec[] {
  const C = BALANCE.cups;
  const out: GoalRec[] = [];
  ([[tie.h, hg, 0], [tie.a, ag, 1]] as const).forEach(([id, n, side]) => {
    if (!n) return;
    const g = new Map(cupRoster(state, id).players.map((p) => [p.id, posGroup(p.position)]));
    const lu = lines[side]!.map((l) => ({ id: l.id, g: g.get(l.id)!, m: l.minutes / 90 }));
    for (let k = 0; k < n; k++) {
      const sc = pickWeighted(rng, lu, (x) => C.scorerWeight[x.g] * x.m);
      if (!sc) continue;
      const as = rng() < C.assistChance ? pickWeighted(rng, lu, (x) => C.assistWeight[x.g] * x.m, sc) : null;
      out.push([1 + Math.floor(rng() * 90), side, sc.id, as?.id ?? null]);
    }
  });
  return out.sort((x, y) => x[0] - y[0]);
}

const lineCache = new Map<string, NpcLine[]>();

/** 간이 경기 한 팀 출전 명단: 내 리그 팀(로스터 있음)은 그날 컨디션, 아니면 컨디션 없는 명단 (월드·시즌·팀마다 캐시) */
export function cupLines(state: GameState, id: string, date: IsoDate): NpcLine[] {
  const r = state.rosters?.[id];
  if (r) return quickLines(r, state.npcFit, dayNum(date));
  const key = `${state.worldSeed}:${state.league.season}:${id}`;
  let hit = lineCache.get(key);
  if (!hit) {
    if (lineCache.size > 256) lineCache.clear();
    hit = lineupLines(cupRoster(state, id), undefined);
    lineCache.set(key, hit);
  }
  return hit;
}

/** 레이팅 간이 경기 하나 */
function quickTie(state: GameState, comp: CupComp, stage: number, i: number): void {
  const tie = comp.rounds[stage]![i]!;
  const rng = rngFor(state.worldSeed, 'cup', comp.id, state.league.season, 'tie', stage, i);
  // 결승은 중립 경기장 (C.79o)
  const [hg, ag] = simulateScore(rng, teamById(state.league, tie.h).rating, teamById(state.league, tie.a).rating, comp.rounds[stage]!.length === 1);
  const date = tie.d ?? comp.dates[stage]!;
  const lines = [cupLines(state, tie.h, date), cupLines(state, tie.a, date)];
  settleTie(state, comp, stage, i, hg, ag, cupScorers(state, rng, tie, hg, ag, lines));
  quickFit(state, tie, date, `${comp.id}:${state.league.season}:${stage}:${i}`, lines);
}

/**
 * 간이 경기 피로·부상·부하 (C.77n, pending 142b): 내 리그 팀(로스터가 있는 팀)만 출전 명단(득점자와 같은 명단, C.77w)에 출전 분 피로를 더한다.
 * 다른 리그 팀은 그 리그 경기도 간이 계산이라 피로를 두지 않는다. 스코어·득점자 난수와 따로 (시드 문자열)
 */
function quickFit(state: GameState, t: CupTie, date: IsoDate, key: string, lines: readonly NpcLine[][]): void {
  const mine = [t.h, t.a].map((id, k) => [state.rosters?.[id], lines[k]!] as const).filter((x): x is readonly [TeamRoster, NpcLine[]] => !!x[0]);
  if (!mine.length) return;
  npcQuickMatch((state.npcFit ??= {}), (state.npcLoad ??= {}), mine.map((x) => x[0]), dayNum(date), state.worldSeed, hashSeed(`${state.worldSeed}:cupfit:${key}`), mine.flatMap((x) => x[1]));
}

const isMine = (state: GameState, t: CupTie): boolean => t.h === state.player.teamId || t.a === state.player.teamId;
const played = (t: CupTie): boolean => t.hg !== undefined;

/** 하루 끝 (endDay): 오늘 열리는 내 팀 없는 컵 경기를 간이 계산하고, 단계가 끝났으면 다음 단계를 추첨한다 */
export function cupsDayEnd(state: GameState, date: IsoDate): void {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return;
  const fa = cups.fa;
  if (fa && !fa.winner) {
    const s = currentStage(fa);
    if (fa.dates[s] === date) {
      fa.rounds[s]!.forEach((t, i) => {
        if (!t.w && !isMine(state, t)) quickTie(state, fa, s, i);
      });
      advance(state, fa);
    }
  }
  const u = cups.ucl;
  if (u && !u.winner) {
    for (const m of uclMatches(u)) if (m.t.d === date && !played(m.t) && !isMine(state, m.t)) uclQuick(state, u, m);
    uclAdvance(state, u);
  }
}

/** 시즌 끝: 남은 경기를 모두 간이 계산해 우승 팀까지 정한다 (내 팀이 이미 탈락했거나 시즌이 끝날 때) */
export function cupsFinish(state: GameState): void {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return;
  const fa = cups.fa;
  for (let guard = 0; fa && guard < 8 && !fa.winner; guard++) {
    const s = currentStage(fa);
    fa.rounds[s]!.forEach((t, i) => {
      if (!t.w) quickTie(state, fa, s, i);
    });
    advance(state, fa);
  }
  const u = cups.ucl;
  for (let guard = 0; u && guard < 12 && !u.winner; guard++) {
    // 날짜 순서대로 (1차전 → 2차전)
    for (const m of uclMatches(u).filter((x) => !played(x.t)).sort((a, b) => daysBetween(b.t.d!, a.t.d!))) uclQuick(state, u, m);
    uclAdvance(state, u);
  }
}

// ── 챔스 (C.67b) ──

/**
 * 챔스 출전: 지난 시즌 리그 상위 4팀 (첫 시즌 = 2017-18 실제 순위) + 외부 28팀.
 * C.76c (45b): 외부 클럽이 고른 리그 팀이면 그 리그 팀 id. 내 리그가 PL 이 아니면 내 리그(1부) 상위 4 + PL 상위 4 + 외부 클럽(내 리그 팀 제외)을
 * 32팀까지(모자라면 유럽 리그 팀 레이팅 순으로 채움). 유럽 밖 리그(사우디·K·J·브라질·MLS)는 챔스 없음 (빈 목록)
 */
export function uclEntrants(state: GameState): string[] {
  const lg = state.league;
  const ids = state.leagueIds ?? [lg.id];
  const prev = state.archive?.at(-1);
  const prevTop = prev && prev.season === lg.season - 1 ? prev.table.slice(0, 4).map((r) => r[0]) : null;
  if (lg.id === 'pl') return [...(prevTop ?? BALANCE.cups.ucl.firstSeason), ...UCL_EXTRA.map((x) => canonicalClub(x, ids))];
  if (!UEFA_COUNTRIES.has(lg.country)) return [];
  const out: string[] = [];
  const push = (id: string) => { if (out.length < 32 && !out.includes(id)) out.push(id); };
  // 내 리그(1부): 지난 시즌 상위 4 (첫 시즌 = 레이팅 상위 4)
  if (lg.tier === 1) (prevTop ?? [...lg.teams].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id)).slice(0, 4).map((t) => t.id)).forEach(push);
  // PL 상위 4: 다른 리그로 고른 PL 의 지난 시즌 순위, 없으면 2017-18 실제
  const pl = state.otherLeagues?.find((o) => o.id === 'pl');
  (pl?.past?.at(-1)?.top.slice(0, 4) ?? BALANCE.cups.ucl.firstSeason).forEach(push);
  for (const x of UCL_EXTRA) {
    const c = canonicalClub(x, ids);
    if (leagueOfTeam(OUTSIDE_TO_LEAGUE[x] ?? x) === lg.id) continue;
    push(c);
  }
  // 모자라면 유럽 리그 1부 팀 레이팅 순 (내 리그·이미 든 팀 제외)
  if (out.length < 32) {
    const extra = allLeagueData().filter((d) => d.id !== lg.id && d.tier === 1 && UEFA_COUNTRIES.has(d.country))
      .flatMap((d) => d.teams).sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
    for (const t of extra) push(t.id);
  }
  return out;
}


const isLeagueTeam = (state: GameState, id: string): boolean => state.league.teams.some((t) => t.id === id);

/** 그 주(목표일이 든 주)의 화요일 */
export function tuesdayOf(y0: number, [y, m, d]: readonly [number, number, number]): IsoDate {
  const t = isoDate(y ? y0 + 1 : y0, m, d);
  return addDays(t, (2 - weekday(t) + 7) % 7);
}

/** 팀이 이미 잡힌 경기 날 (리그 + FA컵 남은 단계 + 챔스) — 챔스·FA 날짜를 고를 때 간격 확인 */
function teamBusy(state: GameState, teamId: string, cups: CupsState | null = state.cups ?? null): Set<IsoDate> {
  const out = isLeagueTeam(state, teamId) ? leagueDates(state, [teamId]) : new Set<IsoDate>();
  const fa = cups?.fa;
  if (fa) {
    const reach = teamReach(fa, teamId);
    // 우승 팀이면 reach = 단계 수 (C.76c: 시즌 끝 한꺼번에 계산할 때 챔스 추첨이 FA 우승 뒤에 올 수 있다)
    const alive = reach >= 0 && !fa.rounds[reach]?.some((t) => t.w && t.w !== teamId && (t.h === teamId || t.a === teamId));
    fa.dates.forEach((d, s) => { if (s <= reach || (alive && s > reach)) out.add(d); });
  }
  const u = cups?.ucl;
  if (u) for (const m of uclMatches(u)) if ((m.t.h === teamId || m.t.a === teamId) && m.t.d) out.add(m.t.d);
  return out;
}

/** 화·수 중 두 팀 모두 gap 일 이상 비는 날 (먼저 first). 둘 다 안 되면 first */
function midweekFor(state: GameState, tue: IsoDate, first: 0 | 1, h: string, a: string, cups: CupsState | null): IsoDate {
  const C = BALANCE.cups;
  const busy = [teamBusy(state, h, cups), teamBusy(state, a, cups)];
  const free = (d: IsoDate, gap: number) => busy.every((b) => {
    for (let k = -(gap - 1); k <= gap - 1; k++) if (b.has(addDays(d, k))) return false;
    return true;
  });
  // 화·수가 모두 막히면 (월요일 경기 다음 주중 등) 같은 날만 피하고, 그래도 안 되면 목요일
  const days = first ? [addDays(tue, 1), tue] : [tue, addDays(tue, 1)];
  for (const gap of [C.minGap, C.minGapLoose, 1]) for (const d of [...days, addDays(tue, 2)]) if (free(d, gap)) return d;
  return days[0]!;
}

/** 조 편성: 레이팅 순 4포트, 포트마다 섞어 조에 하나씩, 같은 리그(리그 팀) 둘은 한 조에 넣지 않는다 */
function drawGroups(state: GameState, teams: string[]): string[][] {
  const rng = rngFor(state.worldSeed, 'cup', 'ucl', state.league.season, 'groups');
  const rating = (id: string) => teamById(state.league, id).rating;
  const sorted = [...teams].sort((a, b) => rating(b) - rating(a) || a.localeCompare(b));
  const groups: string[][] = Array.from({ length: 8 }, () => []);
  for (let p = 0; p < 4; p++) {
    // 리그 팀을 먼저 놓아야 막다른 길이 없다
    const pot = shuffled(rng, sorted.slice(p * 8, p * 8 + 8)).sort((a, b) => +isLeagueTeam(state, b) - +isLeagueTeam(state, a));
    for (const id of pot) {
      const open = groups.map((_, k) => k).filter((k) => groups[k]!.length === p);
      const ok = open.filter((k) => !(isLeagueTeam(state, id) && groups[k]!.some((x) => isLeagueTeam(state, x))));
      const pick = (ok.length ? ok : open)[Math.floor(rng() * (ok.length ? ok : open).length)]!;
      groups[pick]!.push(id);
    }
  }
  return groups;
}

function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const t = [...xs];
  for (let i = t.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [t[i], t[j]] = [t[j]!, t[i]!];
  }
  return t;
}

/** 조 안 6차전 짝 (조 순서 0~3) */
const GROUP_PAIRS: readonly (readonly [number, number])[][] = [
  [[0, 1], [2, 3]], [[3, 0], [1, 2]], [[0, 2], [3, 1]], [[1, 0], [3, 2]], [[0, 3], [2, 1]], [[2, 0], [1, 3]],
];

function createUcl(state: GameState, cups: CupsState): UclComp | null {
  const U = BALANCE.cups.ucl;
  const y0 = state.league.season;
  if (daysBetween(state.calendar.date, tuesdayOf(y0, U.groupWeeks[0]!)) < 0) return null;
  // 유럽 밖 리그 (C.76c): 출전 팀이 없으면 챔스 없음
  const entrants = uclEntrants(state);
  if (entrants.length < 32) return null;
  const u: UclComp = { id: 'ucl', groups: drawGroups(state, entrants), gs: [], ko: [] };
  cups.ucl = u;
  U.groupWeeks.forEach((w, md) => {
    const tue = tuesdayOf(y0, w);
    const round: CupTie[] = [];
    u.groups.forEach((g, k) => {
      // A~D 조와 E~H 조가 차전마다 화·수를 번갈아
      const first = ((k < 4) === (md % 2 === 0) ? 0 : 1) as 0 | 1;
      for (const [x, y] of GROUP_PAIRS[md]!) {
        const t: CupTie = { h: g[x]!, a: g[y]! };
        t.d = midweekFor(state, tue, first, t.h, t.a, cups);
        round.push(t);
      }
    });
    u.gs.push(round);
  });
  return u;
}

/** 조 순위: 승점 → 득실 → 다득점 → 레이팅 */
export interface GroupRow { id: string; p: number; w: number; d: number; l: number; gf: number; ga: number; pts: number }
export function groupTable(state: GameState, u: UclComp, k: number): GroupRow[] {
  const rows = new Map(u.groups[k]!.map((id) => [id, { id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]));
  for (const round of u.gs) for (const t of round) {
    const h = rows.get(t.h);
    const a = rows.get(t.a);
    if (!h || !a || !played(t)) continue;
    h.p++; a.p++;
    h.gf += t.hg!; h.ga += t.ag!; a.gf += t.ag!; a.ga += t.hg!;
    if (t.hg! > t.ag!) { h.w++; a.l++; h.pts += 3; } else if (t.hg! < t.ag!) { a.w++; h.l++; a.pts += 3; } else { h.d++; a.d++; h.pts++; a.pts++; }
  }
  const r = (id: string) => teamById(state.league, id).rating;
  return [...rows.values()].sort((x, y) => y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || r(y.id) - r(x.id));
}

interface UclMatch { t: CupTie; kind: 'group' | 'l1' | 'l2' | 'final'; md: number; stage: number; i: number }

/** 챔스 전체 경기 (조별 → 녹아웃) */
export function uclMatches(u: UclComp): UclMatch[] {
  const out: UclMatch[] = [];
  u.gs.forEach((r, md) => r.forEach((t, i) => out.push({ t, kind: 'group', md, stage: -1, i })));
  u.ko.forEach((st, s) => {
    const fin = s === 3;
    st.l1.forEach((t, i) => out.push({ t, kind: fin ? 'final' : 'l1', md: -1, stage: s, i }));
    st.l2.forEach((t, i) => out.push({ t, kind: 'l2', md: -1, stage: s, i }));
  });
  return out;
}

/** 챔스 경기 결과 기록: 2차전이면 합계(동률 = 승부차기), 결승이면 승자 */
function uclSettle(state: GameState, u: UclComp, m: UclMatch, hg: number, ag: number, g?: GoalRec[]): void {
  const t = m.t;
  t.hg = hg;
  t.ag = ag;
  if (g?.length) t.g = g;
  if (m.kind === 'final') {
    if (hg !== ag) t.w = hg > ag ? t.h : t.a;
    else shootout(state, t, 'ucl', 'f');
  } else if (m.kind === 'l2') {
    const l1 = u.ko[m.stage]!.l1[m.i]!;
    // 2차전 홈 = 1차전 원정
    const aggH = hg + l1.ag!;
    const aggA = ag + l1.hg!;
    if (aggH !== aggA) t.w = aggH > aggA ? t.h : t.a;
    else shootout(state, t, 'ucl', m.stage, m.i);
  }
}

function uclQuick(state: GameState, u: UclComp, m: UclMatch): void {
  const rng = rngFor(state.worldSeed, 'cup', 'ucl', state.league.season, 'tie', m.kind, m.md, m.stage, m.i);
  const [hg, ag] = simulateScore(rng, teamById(state.league, m.t.h).rating, teamById(state.league, m.t.a).rating, m.kind === 'final');
  // 득점자는 녹아웃만 (조별 48경기 득점 기록은 세이브만 키운다)
  const lines = [cupLines(state, m.t.h, m.t.d!), cupLines(state, m.t.a, m.t.d!)];
  uclSettle(state, u, m, hg, ag, m.kind === 'group' ? undefined : cupScorers(state, rng, m.t, hg, ag, lines));
  quickFit(state, m.t, m.t.d!, `ucl:${state.league.season}:${m.kind}:${m.md}:${m.stage}:${m.i}`, lines);
}

/** 단계가 끝났으면 다음 추첨: 조별 → 16강(조 1위 vs 다른 조 2위, 같은 리그 피함, 1위가 2차전 홈) → 8강·4강(무작위) → 결승 */
function uclAdvance(state: GameState, u: UclComp): void {
  const U = BALANCE.cups.ucl;
  const y0 = state.league.season;
  const rng = rngFor(state.worldSeed, 'cup', 'ucl', y0, 'draw', u.ko.length);
  let pairs: [string, string][] = [];
  if (!u.ko.length) {
    if (!u.gs.every((r) => r.every(played))) return;
    const tables = u.groups.map((_, k) => groupTable(state, u, k));
    const firsts = tables.map((t) => t[0]!.id);
    const seconds = tables.map((t) => t[1]!.id);
    // 2위 순서를 시드로 섞어 같은 조·같은 리그가 아닌 짝을 찾는다 (없으면 같은 조만 피함)
    const fits = (perm: number[], strict: boolean) => perm.every((j, k) => j !== k && !(strict && isLeagueTeam(state, firsts[k]!) && isLeagueTeam(state, seconds[j]!)));
    let perm: number[] | null = null;
    for (const strict of [true, false]) {
      for (let tries = 0; tries < 400 && !perm; tries++) {
        const p = shuffled(rng, [0, 1, 2, 3, 4, 5, 6, 7]);
        if (fits(p, strict)) perm = p;
      }
      if (perm) break;
    }
    perm ??= [1, 2, 3, 4, 5, 6, 7, 0];
    pairs = firsts.map((f, k) => [seconds[perm![k]!]!, f]);
  } else {
    const last = u.ko.at(-1)!;
    if (u.ko.length === 4) {
      if (last.l1[0]!.w) u.winner = last.l1[0]!.w;
      return;
    }
    if (!last.l2.every((t) => t.w)) return;
    const winners = shuffled(rng, last.l2.map((t) => t.w!));
    if (winners.length === 2) {
      const cal = myCal(state);
      u.ko.push({ l1: [{ h: winners[0]!, a: winners[1]!, d: addDays(cal.final, U.finalAfter) }], l2: [] });
      return;
    }
    for (let k = 0; k + 1 < winners.length; k += 2) pairs.push([winners[k]!, winners[k + 1]!]);
  }
  const s = u.ko.length;
  const [w1, w2] = U.koWeeks[s]!;
  const stage: UclStage = { l1: [], l2: [] };
  u.ko.push(stage);
  const cups = state.cups ?? null;
  pairs.forEach(([h, a], i) => {
    const first = (i % 2) as 0 | 1;
    const d1 = midweekFor(state, tuesdayOf(y0, w1!), first, h, a, cups);
    // 2차전은 1차전과 같은 요일을 먼저 (정확히 1~5주 간격)
    stage.l1.push({ h, a, d: d1 });
    stage.l2.push({ h: a, a: h, d: midweekFor(state, tuesdayOf(y0, w2!), weekday(d1) === 3 ? 1 : 0, a, h, cups) });
  });
}

/** 챔스 단계 이름 (보고·표시용) */
function uclStageLabel(m: UclMatch): string {
  if (m.kind === 'group') return `조별 ${m.md + 1}차전`;
  if (m.kind === 'final') return '결승';
  return `${KO_NAMES[m.stage]} ${m.kind === 'l1' ? 1 : 2}차전`;
}

/** 팀의 챔스 결과 한 줄 */
export function uclReachLabel(state: GameState, u: UclComp, teamId: string): string {
  if (!u.groups.some((g) => g.includes(teamId))) return '출전 안 함';
  if (u.winner === teamId) return '우승';
  for (let s = u.ko.length - 1; s >= 0; s--) {
    const st = u.ko[s]!;
    if (s === 3) {
      if (st.l1[0]!.h === teamId || st.l1[0]!.a === teamId) return st.l1[0]!.w ? '준우승' : '결승 진출';
      continue;
    }
    const t = st.l2.find((x) => x.h === teamId || x.a === teamId);
    if (t) return t.w ? (t.w === teamId ? `${KO_NAMES[s + 1]} 진출` : `${KO_NAMES[s]} 탈락`) : `${KO_NAMES[s]} 진출`;
  }
  if (u.ko.length) return '조별 탈락';
  return '조별리그';
}

/** 업적용 단계: 4 우승 · 3 준우승 · 2 4강 · 1 8강 · 0 그 밖 (−1 출전 안 함) */
export function uclReach(u: UclComp, teamId: string): number {
  if (!u.groups.some((g) => g.includes(teamId))) return -1;
  if (u.winner === teamId) return 4;
  const inStage = (s: number) => !!u.ko[s] && [...u.ko[s]!.l1].some((t) => t.h === teamId || t.a === teamId);
  return inStage(3) ? 3 : inStage(2) ? 2 : inStage(1) ? 1 : 0;
}

// ── 내 팀 ──

export interface MyCupTie {
  comp: CompId;
  /** "FA컵 16강" · "챔스 조별 3차전" · "챔스 16강 2차전" */
  label: string;
  /** 대회 이름 뺀 단계 ("16강", "조별 3차전", "결승") */
  stage: string;
  tie: CupTie;
  date: IsoDate;
  home: boolean;
  opponentId: string;
  /** 시드 키 · 리플레이 보관 번호(100+) */
  key: string;
  seq: number;
  /** 승부가 나는 경기 (단판·2차전·결승): 진출/탈락 */
  decisive: boolean;
  /** 결승 */
  final: boolean;
  /** 큰 경기 (5.2: 결승·챔스 녹아웃) → 경기 XP ×1.5 */
  big: boolean;
  /** 결과 기록 (홈 기준) */
  settle: (hg: number, ag: number, g?: GoalRec[]) => void;
}

/** 이번 시즌 내 컵 경기 전부 (치른 것 + 날짜가 잡힌 것, 날짜 순) */
export function myCupMatches(state: GameState): MyCupTie[] {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return [];
  const me = state.player.teamId;
  const u = cups.ucl ?? null;
  const key = `${me}|${cups.fa ? `${cups.fa.rounds.length}:${cups.fa.dates.join(',')}` : '-'}|${u ? `${u.ko.length}:${u.ko.at(-1)?.l1.length ?? 0}` : '-'}`;
  const hit = mineCache.get(cups);
  if (hit?.key === key) return hit.list;
  const list: MyCupTie[] = [];
  const mk = (comp: CompId, stage: string, tie: CupTie, date: IsoDate, k: string, seq: number, decisive: boolean, final: boolean, big: boolean, settle: MyCupTie['settle']): MyCupTie => {
    const home = tie.h === me;
    return { comp, label: `${compNameKo(comp, state.league.id)} ${stage}`, stage, tie, date, home, opponentId: home ? tie.a : tie.h, key: k, seq, decisive, final, big, settle };
  };
  const fa = cups.fa;
  if (fa) fa.rounds.forEach((r, s) => r.forEach((t, i) => {
    if (t.h !== me && t.a !== me) return;
    const fin = r.length === 1;
    list.push(mk('fa', stageName(fa, s), t, fa.dates[s]!, `cup:fa:${s}`, 100 + s, true, fin, fin, (hg, ag, g) => settleTie(state, fa, s, i, hg, ag, g)));
  }));
  if (u) for (const m of uclMatches(u)) {
    if (m.t.h !== me && m.t.a !== me) continue;
    const seq = m.kind === 'group' ? 110 + m.md : m.kind === 'final' ? 122 : 116 + m.stage * 2 + (m.kind === 'l2' ? 1 : 0);
    list.push(mk('ucl', uclStageLabel(m), m.t, m.t.d!, `cup:ucl:${seq}`, seq, m.kind === 'l2' || m.kind === 'final', m.kind === 'final', m.kind !== 'group', (hg, ag, g) => uclSettle(state, u, m, hg, ag, g)));
  }
  list.sort((a, b) => daysBetween(b.date, a.date));
  mineCache.set(cups, { key, list });
  return list;
}

const mineCache = new WeakMap<CupsState, { key: string; list: MyCupTie[] }>();

/** 아직 치르지 않은 내 컵 경기 중 가장 이른 것 */
export function myCupTie(state: GameState): MyCupTie | null {
  if (state.phase !== 'season') return null;
  return myCupMatches(state).find((m) => !played(m.tie)) ?? null;
}

/** 이번 시즌 내 컵 경기 날짜 (치른 것 + 잡힌 것) */
export function myCupDates(state: GameState): IsoDate[] {
  return myCupMatches(state).map((m) => m.date);
}

/** 내 팀이 아직 남은 컵 경기가 있다 (시즌 끝을 미룬다: 리그가 끝나도 결승이 남았으면) */
export function myCupAlive(state: GameState): boolean {
  if (myCupTie(state)) return true;
  // 이겼는데 다음 단계 추첨 전 (예: 리그가 끝난 뒤 4강 2차전 → 결승 추첨은 그날 하루 끝)
  const cups = state.cups;
  if (state.phase !== 'season' || !cups || cups.season !== state.league.season) return false;
  const me = state.player.teamId;
  const fa = cups.fa;
  if (fa && !fa.winner && fa.rounds[currentStage(fa)]!.length > 1 && fa.rounds[currentStage(fa)]!.some((t) => t.w === me)) return true;
  const u = cups.ucl;
  if (u && !u.winner) {
    if (u.ko.length) return u.ko.at(-1)!.l2.some((t) => t.w === me);
    const k = u.groups.findIndex((g) => g.includes(me));
    if (k >= 0 && u.gs.every((r) => r.every(played))) return groupTable(state, u, k).slice(0, 2).some((r) => r.id === me);
  }
  return false;
}

/** 경기 뒤 결과 (진출·탈락·승부차기·우승): 승부가 나는 경기만 */
export function cupOutcome(state: GameState, mc: MyCupTie): { through: boolean; pens?: [number, number]; won?: boolean } | null {
  if (!mc.decisive) return null;
  const through = mc.tie.w === state.player.teamId;
  return { through, ...(mc.tie.p ? { pens: mc.tie.p } : {}), ...(through && mc.final ? { won: true } : {}) };
}

/** 팀이 이 대회에서 간 단계 (−1 = 출전 안 함). 우승이면 단계 수 */
export function teamReach(comp: CupComp, teamId: string): number {
  let reach = -1;
  comp.rounds.forEach((r, s) => { if (r.some((t) => t.h === teamId || t.a === teamId)) reach = s; });
  return comp.winner === teamId ? comp.rounds.length : reach;
}

/** 결과 한 줄 (예 "16강 탈락", "준우승", "우승", "8강 진출") */
export function reachLabel(comp: CupComp, teamId: string): string {
  const reach = teamReach(comp, teamId);
  if (reach < 0) return '출전 안 함';
  if (reach >= comp.rounds.length) return '우승';
  const tie = comp.rounds[reach]!.find((t) => t.h === teamId || t.a === teamId)!;
  const name = stageName(comp, reach);
  if (!tie.w) return `${name} 진출`;
  return name === '결승' ? '준우승' : `${name} 탈락`;
}

// ── 업적 (5.3, 18.9) ──

/** 시즌 끝 컵 업적: 챔스 우승 400 / 준우승 250 / 4강 150 / 8강 80, FA컵 우승 150, 트레블(리그 1위 + FA컵 + 챔스) +500 */
export function cupAchievements(state: GameState, leaguePos: number): { label: string; xp: number; key: 'ucl' | 'fa' | 'treble' }[] {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return [];
  const X = BALANCE.cups.xp;
  const me = state.player.teamId;
  const out: { label: string; xp: number; key: 'ucl' | 'fa' | 'treble' }[] = [];
  const u = cups.ucl;
  const ur = u ? uclReach(u, me) : -1;
  if (ur === 4) out.push({ label: '챔스 우승', xp: X.uclWin, key: 'ucl' });
  else if (ur === 3) out.push({ label: '챔스 준우승', xp: X.uclFinal, key: 'ucl' });
  else if (ur === 2) out.push({ label: '챔스 4강', xp: X.uclSemi, key: 'ucl' });
  else if (ur === 1) out.push({ label: '챔스 8강', xp: X.uclQuarter, key: 'ucl' });
  const faWin = cups.fa?.winner === me;
  const cup = cupNameKo(state.league.id);
  if (faWin) out.push({ label: `${cup} 우승`, xp: X.faWin, key: 'fa' });
  if (leaguePos === 1 && faWin && ur === 4) out.push({ label: `트레블 (리그 · ${cup} · 챔스)`, xp: X.treble, key: 'treble' });
  return out;
}
