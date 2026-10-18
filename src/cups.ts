// 챔스/컵 (18.7, 5-6, pending 108, 부록 C.67). a = 대회 틀 · 일정 편입 · 내 팀 없는 경기 레이팅 간이 계산 · 국내 컵(FA컵).
// 내 팀 경기는 game.ts 가 전 엔진으로 치르고(playMyCup) 결과만 여기 기록한다. 대진·날짜·간이 결과는 시드로 정해진다.
// 세이브에는 단계별 대진과 결과만 담는다 (작다: FA컵 한 시즌 31경기)

import { BALANCE } from './config/balance';
import { addDays, daysBetween, isoDate, nearestSaturday, seasonCalendar, type IsoDate } from './calendar';
import { FA_CUP_EXTRA } from '../data/outsideClubs';
import { simulateScore, teamById } from './league';
import { createTeamRoster, naturalOvr, posGroup, type TeamRoster } from './roster';
import { createRng, hashSeed, type Rng } from './rng';
import type { GoalRec } from './engine/npcMatch';
import type { GameState } from './game';

export type CompId = 'fa';

/** 한 경기 (단판). hg·ag 가 있으면 끝난 경기. p = 승부차기 [홈, 원정], w = 이긴 팀 */
export interface CupTie {
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

export interface CupsState {
  season: number;
  /** FA컵. null = 이번 시즌 없음 (옛 세이브가 32강 날짜를 지난 뒤 불러왔을 때) */
  fa: CupComp | null;
}

export const COMP_NAMES_KO: Record<CompId, string> = { fa: 'FA컵' };

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
function leagueDates(state: GameState, teams?: readonly string[]): Set<IsoDate> {
  const cal = seasonCalendar(state.worldSeed, state.league.season, state.league.schedule);
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
  return freeDateNear(target, busy, prev, C.minGap) ?? freeDateNear(target, busy, prev, C.minGapLoose) ?? nearestSaturday(target);
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

/** FA컵 단계 날짜: 32강 1월 초, 16강 1월 말, 8강 3월, 4강 4월 (리그 없는 컵 주말 우선), 결승 = 최종 라운드 다음 주 토요일 */
export function faDates(state: GameState): IsoDate[] {
  const C = BALANCE.cups;
  const cal = seasonCalendar(state.worldSeed, state.league.season, state.league.schedule);
  const busy = leagueDates(state);
  const out: IsoDate[] = [];
  for (let s = 0; s < C.fa.stages.length; s++) out.push(stageDate(faTarget(state, s), busy, out.at(-1) ?? null));
  out.push(addDays(cal.final, C.fa.finalAfter));
  return out;
}

function faTarget(state: GameState, stage: number): IsoDate {
  const [y, m, d] = BALANCE.cups.fa.stages[stage]!;
  return isoDate(y ? state.league.season + 1 : state.league.season, m, d);
}

// ── 생성·추첨 ──

/** 시즌 시작 (또는 옛 세이브 첫 불러오기): 이번 시즌 컵. 첫 단계 날짜가 이미 지났으면 null */
export function createCups(state: GameState): CupsState {
  const season = state.league.season;
  const dates = faDates(state);
  const fa: CupComp | null = daysBetween(state.calendar.date, dates[0]!) >= 0
    ? { id: 'fa', dates, rounds: [] }
    : null;
  if (fa) fa.rounds.push(draw(state.worldSeed, season, fa, [...state.league.teams.map((t) => t.id), ...FA_CUP_EXTRA]));
  return { season, fa };
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
  else {
    const P = BALANCE.cups.pens;
    const rng = rngFor(state.worldSeed, 'cup', comp.id, state.league.season, 'pens', stage, i);
    const diff = teamById(state.league, tie.h).rating - teamById(state.league, tie.a).rating;
    const homeWins = rng() < Math.min(P.max, Math.max(P.min, 0.5 + diff * P.ratingK));
    const win = 3 + Math.floor(rng() * 3);
    const lose = Math.max(0, win - 1 - (rng() < 0.35 ? 1 : 0));
    tie.p = homeWins ? [win, lose] : [lose, win];
    tie.w = homeWins ? tie.h : tie.a;
  }
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
  if (s < BALANCE.cups.fa.stages.length && daysBetween(state.calendar.date, comp.dates[s]!) > 0) {
    comp.dates[s] = stageDate(faTarget(state, s), leagueDates(state, winners), comp.dates[s - 1]!);
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

/** 득점자·도움을 라인업에서 뽑는다 (포지션군 가중치) */
function scorers(state: GameState, rng: Rng, tie: CupTie, hg: number, ag: number): GoalRec[] {
  const C = BALANCE.cups;
  const out: GoalRec[] = [];
  ([[tie.h, hg, 0], [tie.a, ag, 1]] as const).forEach(([id, n, side]) => {
    if (!n) return;
    // 라인업 계산(pickLineup)은 무거워 OVR 상위 squadTop 명에서 뽑는다 (시즌 시뮬 시간 보호)
    const lu = cupRoster(state, id).players.map((p) => ({ id: p.id, g: posGroup(p.position), o: naturalOvr(p) }))
      .sort((x, y) => y.o - x.o).slice(0, C.squadTop);
    for (let k = 0; k < n; k++) {
      const sc = pickWeighted(rng, lu, (x) => C.scorerWeight[x.g]);
      if (!sc) continue;
      const as = rng() < C.assistChance ? pickWeighted(rng, lu, (x) => C.assistWeight[x.g], sc) : null;
      out.push([1 + Math.floor(rng() * 90), side, sc.id, as?.id ?? null]);
    }
  });
  return out.sort((x, y) => x[0] - y[0]);
}

/** 레이팅 간이 경기 하나 */
function quickTie(state: GameState, comp: CupComp, stage: number, i: number): void {
  const tie = comp.rounds[stage]![i]!;
  const rng = rngFor(state.worldSeed, 'cup', comp.id, state.league.season, 'tie', stage, i);
  const [hg, ag] = simulateScore(rng, teamById(state.league, tie.h).rating, teamById(state.league, tie.a).rating);
  settleTie(state, comp, stage, i, hg, ag, scorers(state, rng, tie, hg, ag));
}

const isMine = (state: GameState, t: CupTie): boolean => t.h === state.player.teamId || t.a === state.player.teamId;

/** 하루 끝 (endDay): 오늘 열리는 내 팀 없는 컵 경기를 간이 계산하고, 단계가 끝났으면 다음 단계를 추첨한다 */
export function cupsDayEnd(state: GameState, date: IsoDate): void {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return;
  for (const comp of comps(cups)) {
    if (comp.winner) continue;
    const s = currentStage(comp);
    if (comp.dates[s] !== date) continue;
    comp.rounds[s]!.forEach((t, i) => {
      if (!t.w && !isMine(state, t)) quickTie(state, comp, s, i);
    });
    advance(state, comp);
  }
}

/** 시즌 끝: 남은 경기를 모두 간이 계산해 우승 팀까지 정한다 (내 팀이 이미 탈락했거나 시즌이 끝날 때) */
export function cupsFinish(state: GameState): void {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return;
  for (const comp of comps(cups)) {
    for (let guard = 0; guard < 8 && !comp.winner; guard++) {
      const s = currentStage(comp);
      comp.rounds[s]!.forEach((t, i) => {
        if (!t.w) quickTie(state, comp, s, i);
      });
      advance(state, comp);
    }
  }
}

export function comps(cups: CupsState): CupComp[] {
  return cups.fa ? [cups.fa] : [];
}

// ── 내 팀 ──

export interface MyCupTie {
  comp: CupComp;
  stage: number;
  i: number;
  tie: CupTie;
  date: IsoDate;
  home: boolean;
  opponentId: string;
}

/** 아직 치르지 않은 내 컵 경기 (추첨된 것 중 가장 이른 것) */
export function myCupTie(state: GameState): MyCupTie | null {
  const cups = state.cups;
  if (state.phase !== 'season' || !cups || cups.season !== state.league.season) return null;
  let best: MyCupTie | null = null;
  for (const comp of comps(cups)) {
    if (comp.winner) continue;
    const s = currentStage(comp);
    const i = comp.rounds[s]!.findIndex((t) => !t.w && isMine(state, t));
    if (i < 0) continue;
    const tie = comp.rounds[s]![i]!;
    const date = comp.dates[s]!;
    if (!best || daysBetween(date, best.date) > 0) {
      const home = tie.h === state.player.teamId;
      best = { comp, stage: s, i, tie, date, home, opponentId: home ? tie.a : tie.h };
    }
  }
  return best;
}

/** 이번 시즌 내 컵 경기 날짜 (치른 것 + 추첨된 것) */
export function myCupDates(state: GameState): IsoDate[] {
  const cups = state.cups;
  if (!cups || cups.season !== state.league.season) return [];
  const out: IsoDate[] = [];
  for (const comp of comps(cups)) {
    const me = state.player.teamId;
    const key = `${me}|${comp.rounds.length}|${comp.dates.join(',')}`;
    let hit = myDatesCache.get(comp);
    if (hit?.key !== key) {
      const dates: IsoDate[] = [];
      comp.rounds.forEach((r, s) => { if (r.some((t) => t.h === me || t.a === me)) dates.push(comp.dates[s]!); });
      myDatesCache.set(comp, (hit = { key, dates }));
    }
    out.push(...hit.dates);
  }
  return out;
}

const myDatesCache = new WeakMap<CupComp, { key: string; dates: IsoDate[] }>();

/** 내 팀이 아직 살아 있는 대회 (시즌 끝을 미룬다: 리그가 끝나도 결승이 남았으면) */
export function myCupAlive(state: GameState): boolean {
  return myCupTie(state) !== null;
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
