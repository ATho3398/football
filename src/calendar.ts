// 캘린더 (25.1~25.2, 부록 C.38): 2018-19 프리미어리그 패턴의 날짜 일정 (다른 리그는 leagueCalendar, C.75m). 시드로 다시 만들므로 세이브에 담지 않는다.
// 8월 둘째 토요일 개막 ~ 5월 둘째 일요일 최종 라운드, 주말 중심, 주중 라운드 4~5회, 박싱데이·새해 연전, A매치 휴식기.
// 컵(5-6) 자리(FA컵 주말·비는 주중)는 비워 둔다.

import { BALANCE } from './config/balance';
import type { Fixture } from './league';
import { createRng, hashSeed, type Rng } from './rng';

/** 'YYYY-MM-DD' (UTC 기준 달력 날짜) */
export type IsoDate = string;

const DAY_MS = 86_400_000;
const toMs = (d: IsoDate): number => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const fromMs = (ms: number): IsoDate => new Date(ms).toISOString().slice(0, 10);

export const isoDate = (y: number, m: number, d: number): IsoDate => fromMs(Date.UTC(y, m - 1, d));
export const addDays = (d: IsoDate, n: number): IsoDate => fromMs(toMs(d) + n * DAY_MS);
/** b − a (일) */
export const daysBetween = (a: IsoDate, b: IsoDate): number => Math.round((toMs(b) - toMs(a)) / DAY_MS);
/** 0 = 일요일 … 6 = 토요일 */
export const weekday = (d: IsoDate): number => new Date(toMs(d)).getUTCDay();

const WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

/** "8월 11일 (토)" */
export function dateLabel(d: IsoDate, withYear = false): string {
  const [y, m, day] = [+d.slice(0, 4), +d.slice(5, 7), +d.slice(8, 10)];
  return `${withYear ? `${y}년 ` : ''}${m}월 ${day}일 (${WEEKDAY_KO[weekday(d)]})`;
}

/** 그 날짜와 가장 가까운 토요일 */
export function nearestSaturday(d: IsoDate): IsoDate {
  const w = weekday(d);
  const back = (w + 1) % 7; // 토요일까지 거꾸로
  return back <= 3 ? addDays(d, -back) : addDays(d, 7 - back);
}

/** 그 날짜와 같거나 뒤의 첫 요일 */
function onOrAfter(d: IsoDate, wd: number): IsoDate {
  return addDays(d, (wd - weekday(d) + 7) % 7);
}

export type BreakKind = 'international' | 'cup' | 'winter';

export interface CalendarBreak {
  /** 리그 경기가 없는 주말 (토요일) */
  date: IsoDate;
  kind: BreakKind;
}

export interface SeasonCalendar {
  season: number;
  /** 라운드마다 첫 경기 날짜 */
  roundDates: IsoDate[];
  /** schedule[r][i] 경기 날짜 */
  fixtureDates: IsoDate[][];
  /** 리그가 쉬는 주말 (A매치 휴식기, 컵 주말) */
  breaks: CalendarBreak[];
  opening: IsoDate;
  final: IsoDate;
}

type Slot = { date: IsoDate; kind: 'weekend' | 'midweek' | 'boxing' | 'newyear' | 'opening' | 'final' };

/**
 * 라운드 날짜 38개. 시드는 주중 라운드 수(4~5)·5번째 자리·뺄 컵 주말만 정한다.
 * 연도마다 요일이 달라도 "가장 가까운 토요일"로 같은 패턴을 만든다
 */
export function roundSlots(season: number, rng: Rng, rounds = 38): { slots: Slot[]; breaks: CalendarBreak[] } {
  const C = BALANCE.calendar;
  const y0 = season;
  const y1 = season + 1;
  const md = (y: number, [m, d]: readonly [number, number]) => isoDate(y, m, d);
  const opening = onOrAfter(isoDate(y0, 8, 1), 6);
  const openingSat = addDays(opening, 7 * (C.openingWeek - 1));
  const near = nearestSaturday(md(y1, C.finalNear));
  const final = addDays(near, 1);
  const breaks: CalendarBreak[] = [
    ...C.internationalBreaks.map(([y, m, d]) => ({ date: nearestSaturday(md(y ? y1 : y0, [m, d])), kind: 'international' as const })),
    ...C.cupWeekends.map(([y, m, d]) => ({ date: nearestSaturday(md(y ? y1 : y0, [m, d])), kind: 'cup' as const })),
  ];
  const off = new Set(breaks.map((b) => b.date));
  const boxing = isoDate(y0, 12, 26);
  const newYear = isoDate(y1, 1, 1);
  const slots: Slot[] = [{ date: openingSat, kind: 'opening' }];
  for (let d = addDays(openingSat, 7); daysBetween(d, final) > 1; d = addDays(d, 7)) {
    if (off.has(d)) continue;
    // 박싱데이·새해와 3일 안으로 붙는 주말은 뺀다 (연전 사이 최소 휴식)
    if (Math.abs(daysBetween(d, boxing)) < 3 || Math.abs(daysBetween(d, newYear)) < 3) continue;
    slots.push({ date: d, kind: 'weekend' });
  }
  slots.push({ date: boxing, kind: 'boxing' }, { date: newYear, kind: 'newyear' });
  // 주중 라운드: 기본 자리 4개 + 시드로 5번째. 화요일, 앞뒤 경기와 3일 이상 떨어진 자리만
  // 주말이 모자라는 해(개막이 늦고 종료가 이른 해)는 5번째를 꼭 넣는다
  const need = rounds - 1 - slots.length;
  const want = Math.min(5, Math.max(need, rng() < C.fifthMidweekChance ? 5 : 4));
  const extra = [...C.extraMidweek];
  const pick = extra.splice(Math.floor(rng() * extra.length), 1)[0]!;
  const targets = [...C.midweek, pick, ...extra];
  const midweek: Slot[] = [];
  const taken = () => [...slots, ...midweek].map((s) => s.date);
  for (const t of targets) {
    if (midweek.length >= want) break;
    const tue = onOrAfter(md(t[0] ? y1 : y0, [t[1], t[2]]), 2);
    if (taken().every((d) => Math.abs(daysBetween(d, tue)) >= 3)) midweek.push({ date: tue, kind: 'midweek' });
  }
  slots.push(...midweek);
  slots.sort((a, b) => daysBetween(b.date, a.date));
  // 38개에 맞춘다: 많으면 컵 주말 후보(뒤에서부터 시드로)부터 빼고, 모자라면 남은 주중 후보를 더한다
  const drop = C.droppableWeekends.map(([y, m, d]) => nearestSaturday(md(y ? y1 : y0, [m, d])));
  while (slots.length + 1 > rounds) {
    const cand = slots.filter((s) => s.kind === 'weekend' && drop.includes(s.date));
    const victim = cand.length ? cand[Math.floor(rng() * cand.length)]! : slots.filter((s) => s.kind === 'weekend').at(-1)!;
    slots.splice(slots.indexOf(victim), 1);
    breaks.push({ date: victim.date, kind: 'cup' });
  }
  for (let d = addDays(openingSat, 3); slots.length + 1 < rounds && daysBetween(d, final) > 3; d = addDays(d, 7)) {
    if (slots.every((s) => Math.abs(daysBetween(s.date, d)) >= 3)) slots.push({ date: d, kind: 'midweek' });
    slots.sort((a, b) => daysBetween(b.date, a.date));
  }
  slots.push({ date: final, kind: 'final' });
  breaks.sort((a, b) => daysBetween(b.date, a.date));
  return { slots, breaks };
}

/** 한 라운드 경기들을 요일에 나눈다. 다음 라운드와 팀마다 2일 이상 쉬도록 일·월요일 경기는 간격이 될 때만 */
function spreadRound(slot: Slot, gapNext: number, n: number, rng: Rng): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const offsets = new Array<number>(n).fill(0);
  const assign = (count: number, off: number, from: number) => {
    for (let k = from; k < from + count && k < n; k++) offsets[order[k]!] = off;
    return from + count;
  };
  switch (slot.kind) {
    case 'final':
    case 'boxing':
      break;
    case 'opening': {
      // 금요일 1경기, 토요일, 일요일 2~3경기
      let k = assign(1, -1, 0);
      k = assign(n - 1 - (2 + Math.floor(rng() * 2)), 0, k);
      assign(n, 1, k);
      break;
    }
    case 'midweek':
    case 'newyear': {
      // 화·수 (새해는 1·2일) 반반
      assign(n, 1, Math.ceil(n / 2) - (rng() < 0.5 ? 1 : 0));
      break;
    }
    case 'weekend': {
      const sun = gapNext >= 3 ? 2 + Math.floor(rng() * 2) : 0;
      const mon = gapNext >= 6 && rng() < 0.5 ? 1 : 0;
      let k = n - sun - mon;
      k = assign(sun, 1, k);
      assign(mon, 2, k);
      break;
    }
  }
  return offsets;
}

/**
 * 다른 리그 라운드 자리 (C.75m): 개막~최종 사이 주말(휴식기 빼고)을 쓰고, 많으면 시드로 주말을 빼고(컵 주말),
 * 모자라면 수요일 주중 라운드를 시즌에 고르게 더한다. PL 은 roundSlots 그대로
 */
function leagueSlots(season: number, calendar: 'autumn-spring' | 'spring-autumn', rng: Rng, rounds: number): { slots: Slot[]; breaks: CalendarBreak[] } {
  const P = BALANCE.calendar.leagues[calendar];
  const at = ([y, m, d]: readonly [number, number, number]) => isoDate(season + y, m, d);
  const openingSat = nearestSaturday(at(P.opening));
  const final = addDays(nearestSaturday(at(P.final)), 1);
  const breaks: CalendarBreak[] = P.breaks.map((b) => ({ date: nearestSaturday(at(b)), kind: 'international' as const }));
  const off = new Set(breaks.map((b) => b.date));
  const weekends: Slot[] = [];
  for (let d = addDays(openingSat, 7); daysBetween(d, final) > 1; d = addDays(d, 7)) if (!off.has(d)) weekends.push({ date: d, kind: 'weekend' });
  // 개막·최종 빼고 rounds − 2 자리
  while (weekends.length > rounds - 2) {
    const victim = weekends.splice(Math.floor(rng() * weekends.length), 1)[0]!;
    breaks.push({ date: victim.date, kind: 'cup' });
  }
  const need = rounds - 2 - weekends.length;
  const midweek: Slot[] = [];
  if (need > 0) {
    // 수요일 후보: 앞뒤 경기와 3일 이상 (토요일 사이 수요일), 휴식기 주 제외
    const cands: IsoDate[] = [];
    for (let d = addDays(openingSat, 4); daysBetween(d, final) > 3; d = addDays(d, 7)) {
      if (!off.has(addDays(d, -4)) && !off.has(addDays(d, 3))) cands.push(d);
    }
    if (cands.length < need) throw new Error(`리그 달력 자리가 모자람 (${rounds}라운드)`);
    const start = rng() * (cands.length / need);
    for (let k = 0; k < need; k++) midweek.push({ date: cands[Math.min(cands.length - 1, Math.floor(start + (k * cands.length) / need))]!, kind: 'midweek' });
  }
  const slots: Slot[] = [{ date: openingSat, kind: 'opening' }, ...weekends, ...midweek];
  slots.sort((a, b) => daysBetween(b.date, a.date));
  slots.push({ date: final, kind: 'final' });
  breaks.sort((a, b) => daysBetween(b.date, a.date));
  return { slots, breaks };
}

/** 라운드 자리 → 경기 날짜 (PL·다른 리그 공통) */
function buildCalendar(season: number, slots: Slot[], breaks: CalendarBreak[], schedule: Fixture[][], rng: Rng): SeasonCalendar {
  const fixtureDates = schedule.map((round, r) => {
    const slot = slots[r]!;
    const gapNext = r + 1 < slots.length ? daysBetween(slot.date, slots[r + 1]!.date) : 99;
    const offsets = spreadRound(slot, gapNext, round.length, rng);
    return offsets.map((o) => addDays(slot.date, o));
  });
  return {
    season,
    roundDates: fixtureDates.map((ds) => ds.reduce((a, b) => (daysBetween(a, b) < 0 ? b : a))),
    fixtureDates,
    breaks,
    opening: fixtureDates[0]!.reduce((a, b) => (daysBetween(a, b) < 0 ? b : a)),
    final: slots.at(-1)!.date,
  };
}

const leagueCache = new Map<string, SeasonCalendar>();

/** 다른 리그 시즌 일정 (C.75m, 시드로 다시 만든다). PL 이면 seasonCalendar 와 같다 */
export function leagueCalendar(
  worldSeed: string, league: { id: string; season: number; schedule: Fixture[][] }, calendar: 'autumn-spring' | 'spring-autumn',
): SeasonCalendar {
  if (league.id === 'pl') return seasonCalendar(worldSeed, league.season, league.schedule);
  const { schedule, season } = league;
  const key = `${worldSeed}:${league.id}:${season}:${schedule.length}:${schedule[0]?.[0]?.home ?? ''}${schedule[0]?.[0]?.away ?? ''}`;
  const hit = leagueCache.get(key);
  if (hit) return hit;
  const rng = createRng(hashSeed(`${worldSeed}:calendar:${league.id}:${season}`));
  const { slots, breaks } = leagueSlots(season, calendar, rng, schedule.length);
  const cal = buildCalendar(season, slots, breaks, schedule, rng);
  if (leagueCache.size > 64) leagueCache.clear();
  leagueCache.set(key, cal);
  return cal;
}

const cache = new Map<string, SeasonCalendar>();

/** 시즌 일정 (시드로 다시 만든다, 같은 시드·시즌·대진이면 같은 날짜) */
export function seasonCalendar(worldSeed: string, season: number, schedule: Fixture[][]): SeasonCalendar {
  const key = `${worldSeed}:${season}:${schedule.length}:${schedule[0]?.[0]?.home ?? ''}${schedule[0]?.[0]?.away ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rng = createRng(hashSeed(`${worldSeed}:calendar:${season}`));
  const { slots, breaks } = roundSlots(season, rng, schedule.length);
  const cal = buildCalendar(season, slots, breaks, schedule, rng);
  if (cache.size > 16) cache.clear();
  cache.set(key, cal);
  return cal;
}
