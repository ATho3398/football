// 개인 재정과 스태프 (19번 5-7 a, 부록 C.68a): 잔고, 수입/지출 내역, 주 정산, 계약금·에이전트 수수료, 출전·골·우승 보너스, 스폰서,
// 생활비, 스태프 슬롯·코치 모집(다음 주 후보)·고용·해지, 코치 효과(D.13 재설계: 기술 훈련 게이지·XP 배율), 의료 효과(부상 확률·기간·회복).
// 금액은 모두 만 원 정수 (기존 주급 wageFor 와 같은 단위), 표시는 moneyLabel. 돈으로 능력치를 직접 사지 않는다 (19.1). 수치는 BALANCE.money / staff

import { ATTRIBUTE_GROUPS, ATTRIBUTE_NAMES_KO, GROUP_NAMES, type AttributeGroup, type FieldAttribute } from './attributes';
import { addDays, daysBetween, weekday, type IsoDate } from './calendar';
import { BALANCE } from './config/balance';
import { NAME_POOLS_V1 } from '../data/names';
import type { GameState } from './game';
import { reputationTier, TIER_NAMES_KO } from './growth';
import { pushInbox } from './inbox';
import { attributeOvrWeight, type FieldPosition } from './positions';
import { createRng, hashSeed, type Rng } from './rng';
import { BUNDLE_NAMES_KO } from './training';
import type { PlayerState, Tier } from './types';

const M = () => BALANCE.money;
const S = () => BALANCE.staff;
const TIERS: readonly Tier[] = ['normal', 'special', 'topClass', 'worldClass', 'legendary'];

export type MoneyCat =
  | 'wage' | 'signing' | 'appearance' | 'goal' | 'title' | 'sponsor'
  | 'living' | 'staff' | 'agent' | 'scout';
export const INCOME_CATS: readonly MoneyCat[] = ['wage', 'signing', 'appearance', 'goal', 'title', 'sponsor'];
export const EXPENSE_CATS: readonly MoneyCat[] = ['living', 'staff', 'agent', 'scout'];
export const MONEY_CAT_KO: Record<MoneyCat | 'week', string> = {
  week: '주 정산',
  wage: '주급', signing: '계약금', appearance: '출전수당', goal: '골 보너스', title: '우승 보너스', sponsor: '스폰서',
  living: '생활비', staff: '스태프 급여', agent: '에이전트 수수료', scout: '코치 모집',
};

export type StaffRole = 'coach' | 'doctor' | 'physio' | 'nutrition';
export const STAFF_ROLE_KO: Record<StaffRole, string> = { coach: '코치', doctor: '팀 닥터', physio: '물리치료사', nutrition: '영양사' };

export interface Staff {
  id: string;
  name: string;
  tier: Tier;
  role: StaffRole;
  /** 코치 전문 능력치 (같은 묶음 안, 티어별 개수) */
  attrs?: FieldAttribute[];
  /** 연 급여 (만 원, 고용 때 정해짐) */
  salary: number;
  /** 계약 시즌 수 (후보), 고용 뒤 마지막 시즌 */
  years: number;
  until?: number;
  /** 해지함: 이번 시즌 끝까지 일하고 다음 시즌부터 빠진다 (위약금 없음) */
  leaving?: boolean;
}

/** 내역 한 줄 [날짜, 항목(week = 주 정산 합계), 금액, 메모?] — 세이브 크기 때문에 튜플 */
export type LedgerEntry = [IsoDate, MoneyCat | 'week', number, string?];
export type Flows = Partial<Record<MoneyCat, number>>;

export interface MoneyState {
  /** 잔고 (만 원). 0 아래로 내려갈 수 있지만 (생활비·급여) 모집·고용은 잔고 안에서만 */
  cash: number;
  /** 최근 내역 (새 것이 뒤) */
  ledger: LedgerEntry[];
  /** 이번 시즌 항목별 합계 (수입 +, 지출 −) */
  season: Flows;
  /** 지난 시즌들 요약 (새 것이 뒤) */
  history: { season: number; flows: Flows; cash: number }[];
  /** 이번 시즌 정산한 주 수 (비시즌 몫 계산), 마지막으로 정산한 주의 일요일 */
  weeks: number;
  /** 보너스를 이미 준 출전·골 (이번 시즌 리그 + 컵 합계) */
  paidApps: number;
  paidGoals: number;
  staff: Staff[];
  /** 코치 모집: 후보 도착 날짜 (그 전에는 다시 모집할 수 없다) */
  scout: { arrive: IsoDate; n: number } | null;
  candidates: Staff[];
  /** 후보를 고를 수 있는 마지막 날 */
  candUntil: IsoDate | null;
  seq: number;
}

export function initMoney(): MoneyState {
  return { cash: M().startCash, ledger: [], season: {}, history: [], weeks: 0, paidApps: 0, paidGoals: 0, staff: [], scout: null, candidates: [], candUntil: null, seq: 0 };
}

/** 옛 세이브·새 게임: 처음 쓸 때 만든다. 시즌 중간에 생기면 이미 치른 출전·골은 보너스 대상이 아니다 */
export function ensureMoney(state: GameState): MoneyState {
  if (!state.money) {
    state.money = initMoney();
    const t = appsGoals(state.player);
    state.money.paidApps = t.apps;
    state.money.paidGoals = t.goals;
  }
  return state.money;
}

const round = (v: number, unit = 10): number => Math.round(v / unit) * unit;

/** 금액 표시 (만 원 → "3,500만 원" / "1억 2,000만 원" / "−500만 원") */
export function moneyLabel(v: number, sign = false): string {
  const neg = v < 0;
  const a = Math.abs(Math.round(v));
  const eok = Math.floor(a / 10000);
  const man = a % 10000;
  const body = a === 0 ? '0원' : eok ? `${eok.toLocaleString('ko-KR')}억${man ? ` ${man.toLocaleString('ko-KR')}만` : ''} 원` : `${man.toLocaleString('ko-KR')}만 원`;
  return `${neg ? '−' : sign && a ? '+' : ''}${body}`;
}

/** 짧은 표시 (타일): "1.2억" / "3,500만" */
export function moneyShort(v: number): string {
  const a = Math.abs(v);
  const s = a >= 10000 ? `${(a / 10000).toFixed(a >= 100000 ? 0 : 1).replace(/\.0$/, '')}억` : `${Math.round(a).toLocaleString('ko-KR')}만`;
  return `${v < 0 ? '−' : ''}${s}`;
}

/** 돈 넣기·빼기 (amount: 수입 +, 지출 −). 0 이면 기록하지 않는다. log = false 면 합계만 (주 정산은 한 줄로 모아 남긴다) */
export function book(state: GameState, cat: MoneyCat, amount: number, note?: string, date: IsoDate = state.calendar.date, log = true): void {
  const m = ensureMoney(state);
  const a = Math.round(amount);
  if (!a) return;
  m.cash += a;
  m.season[cat] = (m.season[cat] ?? 0) + a;
  if (log) logLine(m, [date, cat, a, ...(note ? [note] : [])] as LedgerEntry);
}

function logLine(m: MoneyState, e: LedgerEntry): void {
  m.ledger.push(e);
  if (m.ledger.length > M().ledgerMax) m.ledger.splice(0, m.ledger.length - M().ledgerMax);
}

const sum = (f: Flows, cats: readonly MoneyCat[]): number => cats.reduce((t, c) => t + (f[c] ?? 0), 0);
export const flowsIn = (f: Flows): number => sum(f, INCOME_CATS);
export const flowsOut = (f: Flows): number => -sum(f, EXPENSE_CATS);

// ── 내 계약 금액 ──

/** 지금 주급 (자유계약·은퇴면 0) */
export function myWage(state: GameState): number {
  if (state.phase === 'retired' || state.market?.free) return 0;
  return state.market?.contract.wage ?? 0;
}

export const annualOf = (weekly: number): number => weekly * 52;

/** 계약금 = 연봉 × 10% × 계약 연수(최대 5) */
export function signingBonus(weekly: number, years: number): number {
  return round(annualOf(weekly) * M().signingShare * Math.min(M().signingYearsMax, Math.max(1, years)));
}

/** 에이전트 수수료 = (계약금 + 첫해 연봉) × 5% */
export function agentFee(weekly: number, bonus: number): number {
  return round((bonus + annualOf(weekly)) * M().agent);
}

/** 계약 서명 (이적·재계약·1군 계약): 계약금 수령, 에이전트 수수료 차감. 임대는 없음 */
export function onContractSigned(state: GameState, c: { wage: number; from: number; until: number; loan?: unknown }, why: string): void {
  if (c.loan) return;
  const years = c.until - c.from + 1;
  const bonus = signingBonus(c.wage, years);
  book(state, 'signing', bonus, `${why} · ${years}년`);
  book(state, 'agent', -agentFee(c.wage, bonus), why);
}

// ── 주 정산 ──

function appsGoals(p: Pick<PlayerState, 'season'>): { apps: number; goals: number } {
  const s = p.season;
  return { apps: (s?.apps ?? 0) + (s?.cup?.apps ?? 0), goals: (s?.goals ?? 0) + (s?.cup?.goals ?? 0) };
}

/** n 주 급여 몫 (주급 + 생활비 + 스태프), 내역은 한 줄 */
function payWeeks(state: GameState, weeks: number, date: IsoDate, note?: string): void {
  if (weeks <= 0) return;
  const w = myWage(state);
  const m = ensureMoney(state);
  const c0 = m.cash;
  book(state, 'wage', w * weeks, note, date, false);
  book(state, 'living', -round(w * M().living * weeks), note, date, false);
  const sal = m.staff.reduce((t, s) => t + s.salary, 0);
  book(state, 'staff', -round((sal / 52) * weeks), note, date, false);
  if (m.cash !== c0) logLine(m, [date, 'week', m.cash - c0, note ?? `${weeks}주`]);
}

/** 출전·골 보너스: 지난 정산 뒤 늘어난 출전·골 (리그 + 컵·챔스). log = false 면 주 정산 줄에 합친다 */
function payBonuses(state: GameState, date: IsoDate, log = true): void {
  const m = ensureMoney(state);
  const t = appsGoals(state.player);
  const w = myWage(state);
  const apps = Math.max(0, t.apps - m.paidApps);
  const goals = Math.max(0, t.goals - m.paidGoals);
  m.paidApps = t.apps;
  m.paidGoals = t.goals;
  if (apps) book(state, 'appearance', round(w * M().bonus.appearance * apps, 1), `${apps}경기`, date, log);
  if (goals) book(state, 'goal', round(w * M().bonus.goal * goals, 1), `${goals}골`, date, log);
}

/** 하루 끝 (game.endDay): 일요일이면 주 정산, 코치 후보 도착·만료 */
export function moneyDayEnd(state: GameState, ended: IsoDate): void {
  const m = ensureMoney(state);
  if (weekday(ended) === 0) {
    // 주 정산 한 줄 = 보너스 + 주급 − 생활비 − 스태프 급여
    const c0 = m.cash;
    payBonuses(state, ended, false);
    if (m.weeks < 52) {
      payWeeks(state, 1, ended, '');
      m.weeks++;
      if (m.ledger.at(-1)?.[1] === 'week' && m.ledger.at(-1)![0] === ended) m.ledger.pop();
    }
    if (m.cash !== c0) logLine(m, [ended, 'week', m.cash - c0]);
  }
  const next = addDays(ended, 1);
  if (m.scout && daysBetween(m.scout.arrive, next) >= 0) arriveCandidates(state, next);
  if (m.candUntil && daysBetween(m.candUntil, ended) >= 0 && !m.scout) {
    m.candidates = [];
    m.candUntil = null;
  }
}

/** 시즌 끝 (game.endSeason): 남은 출전·골 보너스, 우승 보너스, 스폰서 (위상 티어는 시즌 끝 위상) */
export function moneySeasonEnd(state: GameState, titles: string[]): void {
  ensureMoney(state);
  const date = state.calendar.date;
  payBonuses(state, date);
  const annual = annualOf(myWage(state));
  for (const t of titles) book(state, 'title', round(annual * M().bonus.title), t, date);
  const tier = reputationTier(state.player.reputation, state.player.honors);
  const sp = Math.min(M().sponsorMax, round(annual * M().sponsor[tier], 500));
  if (sp > 0) book(state, 'sponsor', sp, `${TIER_NAMES_KO[tier]} 위상`, date);
}

/**
 * 새 시즌 (game.startNextSeason, 재계약·이적 뒤): 비시즌 주급 몫(52 − 정산한 주)을 한 번에, 지난 시즌 요약을 남기고 비운다.
 * 계약이 끝났거나 해지한 스태프는 빠진다. 지난 시즌 몫은 지난 시즌 합계에 넣는다
 */
export function moneySeasonStart(state: GameState, endedSeason: number): void {
  const m = ensureMoney(state);
  payWeeks(state, 52 - m.weeks, state.calendar.date, '비시즌');
  m.history.push({ season: endedSeason, flows: m.season, cash: m.cash });
  if (m.history.length > M().historyMax) m.history.splice(0, m.history.length - M().historyMax);
  m.season = {};
  m.weeks = 0;
  m.paidApps = 0;
  m.paidGoals = 0;
  const season = state.league.season;
  const gone = m.staff.filter((s) => s.leaving || (s.until ?? season) < season);
  m.staff = m.staff.filter((s) => !gone.includes(s));
  if (gone.length) {
    pushInbox(state, {
      cat: 'money', title: '스태프 계약 종료', key: `staff-end:${season}`,
      body: `${gone.map((s) => `${STAFF_ROLE_KO[s.role]} ${s.name}`).join(', ')} — 계약이 끝나 팀을 떠났어요.`, link: { to: 'finance', label: '재정 보기' },
    });
  }
}

// ── 스태프 슬롯·모집·고용 ──

export function staffSlots(state: GameState): number {
  return S().slots[reputationTier(state.player.reputation, state.player.honors)];
}

/** 모집 비용 = 주급 × 0.5 (500만 원 단위, 최소 500만 원) */
export function scoutCost(state: GameState): number {
  return Math.max(500, round(myWage(state) * S().scoutCost, 500));
}

export function staffSalary(state: GameState, tier: Tier): number {
  return Math.max(S().salaryUnit, round(annualOf(myWage(state)) * S().salary[tier], S().salaryUnit));
}

/** 모집할 수 없는 이유 (없으면 null) */
export function scoutBlocked(state: GameState): string | null {
  const m = ensureMoney(state);
  if (state.phase !== 'season') return '시즌 중에만 모집할 수 있어요';
  if (m.scout) return '후보를 기다리는 중이에요';
  if (m.cash < scoutCost(state)) return '잔고가 모자라요';
  return null;
}

/** 코치 모집: 비용을 내고 scoutDays 일 뒤 후보 2~3명 */
export function startScout(state: GameState): boolean {
  if (scoutBlocked(state)) return false;
  const m = ensureMoney(state);
  const cost = scoutCost(state);
  book(state, 'scout', -cost);
  const rng = staffRng(state, 'scout-n', m.seq);
  const [lo, hi] = S().candidates;
  m.scout = { arrive: addDays(state.calendar.date, S().scoutDays), n: lo + Math.floor(rng() * (hi - lo + 1)) };
  m.candidates = [];
  m.candUntil = null;
  return true;
}

function staffRng(state: GameState, ...parts: (string | number)[]): Rng {
  return createRng(hashSeed([state.worldSeed, 'staff', ...parts].join(':')));
}

function pickWeighted<T extends string>(rng: Rng, w: Record<T, number>): T {
  const keys = Object.keys(w) as T[];
  let r = rng() * keys.reduce((t, k) => t + w[k], 0);
  for (const k of keys) if ((r -= w[k]) < 0) return k;
  return keys[keys.length - 1]!;
}

function bundleWeight(pos: FieldPosition, g: AttributeGroup): number {
  const attrs = ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[];
  return attrs.reduce((t, a) => t + attributeOvrWeight(pos, a), 0) / attrs.length;
}

function staffName(rng: Rng): string {
  const pools = NAME_POOLS_V1;
  const pool = pools[Math.floor(rng() * pools.length)]!;
  const g = pool.given[Math.floor(rng() * pool.given.length)]!;
  const f = pool.family[Math.floor(rng() * pool.family.length)]!;
  return `${g[1]} ${f[1]}`;
}

/** 후보 한 명 (시드: 세계 · 모집 순번 · 자리) */
export function makeCandidate(state: GameState, seq: number, i: number): Staff {
  const rng = staffRng(state, 'cand', seq, i);
  const tier = pickWeighted(rng, S().tierWeight);
  const coach = rng() < S().coachShare;
  const role: StaffRole = coach ? 'coach' : (['doctor', 'physio', 'nutrition'] as const)[Math.floor(rng() * 3)]!;
  const name = staffName(rng);
  const years = S().years[0] + Math.floor(rng() * (S().years[1] - S().years[0] + 1));
  const base = { id: `st${seq}-${i}`, name, tier, role, salary: staffSalary(state, tier), years };
  if (!coach) return base;
  const pos = state.player.position;
  const top = [...GROUP_NAMES].sort((a, b) => bundleWeight(pos, b) - bundleWeight(pos, a)).slice(0, 3);
  const pool = rng() < S().coach.fitShare ? top : GROUP_NAMES;
  const g = pool[Math.floor(rng() * pool.length)]!;
  const all = [...(ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[])];
  const n = Math.min(all.length, S().coach.range[tier]);
  const attrs: FieldAttribute[] = [];
  while (attrs.length < n) attrs.push(all.splice(Math.floor(rng() * all.length), 1)[0]!);
  return { ...base, attrs };
}

function arriveCandidates(state: GameState, date: IsoDate): void {
  const m = ensureMoney(state);
  const n = m.scout?.n ?? 2;
  m.seq++;
  m.candidates = Array.from({ length: n }, (_, i) => makeCandidate(state, m.seq, i));
  m.scout = null;
  m.candUntil = addDays(date, S().keepDays - 1);
  pushInbox(state, {
    cat: 'money', title: `코치 후보 ${n}명 도착`, key: `cand:${m.seq}`, date,
    body: `${m.candidates.map((c) => `${staffLine(c)}`).join(' / ')}. ${S().keepDays}일 안에 재정 화면에서 고용할 수 있어요.`,
    link: { to: 'finance', label: '후보 보기' },
  });
}

/** 한 줄 소개 "스페셜 코치 홍길동 · 드리블·볼 컨트롤" */
export function staffLine(s: Staff): string {
  return `${TIER_NAMES_KO[s.tier]} ${STAFF_ROLE_KO[s.role]} ${s.name}${s.attrs ? ` · ${s.attrs.map((a) => attrShort(a)).join('·')}` : ''}`;
}

export const attrShort = (a: FieldAttribute): string => ATTRIBUTE_NAMES_KO[a].replace(/\(.*\)$/, '');

/** 스태프 효과 설명 한 줄 */
export function staffEffect(s: Pick<Staff, 'role' | 'tier' | 'attrs'>): string {
  const C = S().coach;
  const D = S().medical;
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  switch (s.role) {
    case 'coach': {
      const g = s.attrs?.length ? GROUP_NAMES.find((x) => (ATTRIBUTE_GROUPS[x] as readonly string[]).includes(s.attrs![0]!)) : undefined;
      return `${g ? `${BUNDLE_NAMES_KO[g]} ` : ''}기술 훈련 효과 +${pct(C.boost[s.tier])} · 능력치 ${C.limit[s.tier]} 이하만`;
    }
    case 'doctor': return `부상 확률 −${pct(D.doctor[s.tier])}`;
    case 'physio': return `부상 기간 −${pct(D.physio[s.tier])}`;
    case 'nutrition': return `체력 회복 +${pct(D.nutrition[s.tier])}`;
  }
}

/** 고용할 수 없는 이유 (없으면 null): 슬롯, 잔고(첫 달 급여 몫 이상) */
export function hireBlocked(state: GameState, s: Staff): string | null {
  const m = ensureMoney(state);
  if (m.staff.filter((x) => !x.leaving).length >= staffSlots(state)) return `슬롯이 꽉 찼어요 (${staffSlots(state)}개)`;
  if (m.cash < Math.ceil(s.salary / 12)) return '잔고가 모자라요 (한 달 급여 이상 필요)';
  return null;
}

export function hireStaff(state: GameState, id: string): boolean {
  const m = ensureMoney(state);
  const c = m.candidates.find((x) => x.id === id);
  if (!c || hireBlocked(state, c)) return false;
  m.candidates = m.candidates.filter((x) => x !== c);
  m.staff.push({ ...c, until: state.league.season + c.years - 1 });
  return true;
}

/** 해지: 위약금 없음, 이번 시즌 끝까지 일하고 다음 시즌부터 빠진다. 다시 누르면 취소 */
export function toggleLeave(state: GameState, id: string): boolean {
  const s = ensureMoney(state).staff.find((x) => x.id === id);
  if (!s) return false;
  if (s.leaving) {
    if (ensureMoney(state).staff.filter((x) => !x.leaving).length >= staffSlots(state)) return false;
    delete s.leaving;
  } else s.leaving = true;
  return true;
}

// ── 효과 ──

const active = (state: Pick<GameState, 'money'>): Staff[] => state.money?.staff ?? [];

/**
 * 코치 효과 (D.13): 묶음 g 기술 훈련에서 코치 전문 능력치 중 한계 이하인 것이 있으면, 그중 가장 낮은 능력치를 게이지 목표로 삼고
 * 그 능력치를 맡은 코치 배율을 더한다 (상한 maxBoost). 없으면 null (보통 기술 훈련 = 묶음에서 가장 낮은 능력치)
 */
export function coachBoost(state: Pick<GameState, 'money'>, p: Pick<PlayerState, 'attributes' | 'position'>, g: AttributeGroup): { target: FieldAttribute; boost: number } | null {
  const C = BALANCE.staff.coach;
  const inG = ATTRIBUTE_GROUPS[g] as readonly FieldAttribute[];
  const max = BALANCE.growth.maxAttribute;
  const elig = new Map<FieldAttribute, number>();
  for (const s of active(state)) {
    if (s.role !== 'coach') continue;
    for (const a of s.attrs ?? []) {
      if (!inG.includes(a) || p.attributes[a] > C.limit[s.tier] || p.attributes[a] >= max) continue;
      elig.set(a, (elig.get(a) ?? 0) + C.boost[s.tier]);
    }
  }
  if (!elig.size) return null;
  const target = [...elig.keys()].reduce((lo, a) => {
    const d = p.attributes[a] - p.attributes[lo];
    return d < 0 || (d === 0 && attributeOvrWeight(p.position, a) > attributeOvrWeight(p.position, lo)) ? a : lo;
  });
  return { target, boost: Math.min(C.maxBoost, elig.get(target)!) };
}

/** 같은 종류 의료 스태프 중 가장 높은 효과 */
function medical(state: Pick<GameState, 'money'>, role: 'doctor' | 'physio' | 'nutrition'): number {
  const D = BALANCE.staff.medical[role];
  return active(state).filter((s) => s.role === role).reduce((t, s) => Math.max(t, D[s.tier]), 0);
}

/** 부상 확률 배율 (팀 닥터) */
export const injuryChanceMul = (state: Pick<GameState, 'money'>): number => 1 - medical(state, 'doctor');
/** 부상 기간 배율 (물리치료사) */
export const injuryDaysMul = (state: Pick<GameState, 'money'>): number => 1 - medical(state, 'physio');
/** 피로 회복 배율 (영양사) */
export const staffRecoveryMul = (state: Pick<GameState, 'money'>): number => 1 + medical(state, 'nutrition');


/**
 * 자동 스태프 (측정용, npm run balance COACH=full — autoMarket 처럼 화면에서는 쓰지 않는다): 슬롯이 비면 모집하고,
 * 후보가 오면 코치 우선(내 포지션 OVR 비중 큰 묶음 · 높은 티어)으로 슬롯이 찰 때까지 고용한다 = 코치 풀 투자
 */
export function autoStaff(state: GameState): void {
  if (state.phase !== 'season') return;
  const m = ensureMoney(state);
  const pos = state.player.position;
  const score = (s: Staff): number => {
    const t = TIERS.indexOf(s.tier) + 1;
    if (s.role !== 'coach') return t * 0.5;
    const g = GROUP_NAMES.find((x) => (ATTRIBUTE_GROUPS[x] as readonly string[]).includes(s.attrs![0]!))!;
    return t * (1 + bundleWeight(pos, g) * 10) * s.attrs!.length;
  };
  for (const c of [...m.candidates].sort((a, b) => score(b) - score(a))) if (!hireBlocked(state, c)) hireStaff(state, c.id);
  if (!m.scout && !m.candidates.length && m.staff.filter((s) => !s.leaving).length < staffSlots(state) && !scoutBlocked(state)) startScout(state);
}
