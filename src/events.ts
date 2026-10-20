// 이벤트 엔진 (20.1~20.3·20.7, 부록 C.63): 조건·확률·선택지·결과를 데이터 표(data/events.ts)로. 결과는 인박스(inbox.ts)로 간다.
// - 조건: { all } / { any } / { not } / [변수, 비교, 값] / { flag } / { tag }. 변수 목록은 EV_VARS 로 고정 (20.7 1번)
// - 효과: 위상·신뢰도·폼(다음 n경기)·피로·플래그·카드 선택권·XP·이벤트 예약·주장·생활 지표. 이벤트 1개당 상한 = BALANCE.events.caps
// - 스케줄러: 시즌 시작 때 선택형 슬롯 4~6개(주차), 조건을 만족하면 바로 뜨는 하루·경기 뒤 이벤트, 시즌 끝 이벤트. 쿨다운·중복 방지·시드 재현
// 엔진(src/engine)은 건드리지 않는다: 폼 효과는 경기 입력(matchForm)에만 더한다

import { BALANCE } from './config/balance';
import { addDays, daysBetween, type IsoDate } from './calendar';
import { grantMeetingPick } from './cardCollection';
import { chapterEventMul } from './chapters';
import { derbyOf } from './derby';
import { formBonus } from './form';
import { addXp, reputationTier } from './growth';
import { ensureInbox, isPending, pushInbox, type InboxCat, type InboxChoice, type InboxItem } from './inbox';
import { sortedTable, teamById } from './league';
import { addTrust } from './manager';
import { createRng, hashSeed } from './rng';
import { tagHas, type TagId } from './tags';
import { book, moneyLabel, myWage } from './money';
import { acceptDeal, declineDeal, eventCharity } from './wealth';
import { fill, pickText } from './text';
import type { GameState } from './game';
import { EVENTS } from '../data/events';
import { addLife, ensureLife, isForeign, lifeEventsFull, lifeSeasonEnd, lifeSeasonStart, lifeVar, type LifeKey } from './life';
import { detectCompetitor, rivalGap, rivalIntro, rivalOf, rivalSeasonEnd, rivalSeasonStart } from './rival';
import { captainSeasonEnd, captainSeasonStart, coachName, isCaptain, setCaptain, clubSeasons } from './club';

const E = () => BALANCE.events;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── 데이터 형식 ──

/** 조건 변수 (고정 목록, 20.7 1번) */
export const EV_VARS = [
  'rep', 'tier', 'trust', 'fatigue', 'form', 'goals', 'assists', 'apps', 'starts', 'avg', 'rank', 'round', 'seasonNo', 'age',
  'lastPlayed', 'lastResult', 'lastRating', 'lastGoals', 'lastAssists', 'lastRed', 'lastDerby', 'lastDecisive', 'lastMom', 'lastBig',
  'injured', 'injuryDays', 'benchRun', 'rivalGap', 'hasRival', 'captain', 'clubSeasons', 'foreign', 'contractLeft', 'offseason',
  'home', 'adapt', 'team', 'mental', 'cash',
] as const;
export type EvVar = typeof EV_VARS[number];
export type Op = '<' | '<=' | '>' | '>=' | '==' | '!=';

export type Cond =
  | { all: readonly Cond[] }
  | { any: readonly Cond[] }
  | { not: Cond }
  | readonly [EvVar, Op, number]
  | { flag: string }
  | { tag: string };

export type Effect =
  | { rep: number }
  | { trust: number }
  /** 다음 games 경기 폼 ± (경기 입력에만) */
  | { form: number; games: number }
  | { fatigue: number }
  | { flag: string; on?: boolean }
  | { pick: 'rare' }
  | { xp: number }
  /** 이벤트 예약 (days 일 뒤) */
  | { next: string; days: number }
  | { captain: boolean }
  /** 생활 지표 (b, life.ts) */
  | { life: LifeKey; add: number }
  /** 가족 휴가 (C.67a): BALANCE.events.familyLeaveDays 일 동안 경기 결장·훈련 없음 */
  | { leave: true }
  /** 돈 (C.68b, 20.2): 주급 × money (최소 500만 원). charity 면 기부(자선 누적) */
  | { money: number; charity?: true }
  /** 이벤트형 투자 (C.68b, 19.9): deal = 제안 받기, no = 거절 */
  | { invest: 'deal' | 'no' };

export interface EventChoice {
  id: string;
  label: string;
  desc: string;
  requires?: Cond;
  effects: readonly Effect[];
  /** 결과 문장 변형 (3개 이상 권장) */
  result: readonly string[];
}

/** 톤별 문장 (20.7 2번): 칭찬/중립/비판. 톤이 없으면 neutral */
export type ToneText = readonly string[] | { praise?: readonly string[]; neutral: readonly string[]; critic?: readonly string[] };

export interface EventDef {
  id: string;
  tags: readonly string[];
  /** message 정보형 / choice 선택형 / chain 연쇄형(선택형 + 예약) */
  kind: 'message' | 'choice' | 'chain';
  /** 뜨는 때: slot 시즌 주차 슬롯 / day 하루 끝 / match 내 경기 뒤 / season 시즌 끝 / next 다른 이벤트가 예약할 때만 */
  on: 'slot' | 'day' | 'match' | 'season' | 'next';
  cat: InboxCat;
  when?: Cond;
  /** 조건을 만족할 때 뜰 확률 (없으면 1) */
  chance?: number;
  /** 태그별 확률 배율 (C.63 b, 5-2 태그 몫: 리더 팀 불화 ×0.5, 문제아 인터뷰 실언 ×1.5, 스타 플레이어 루머 ×2 …) */
  chanceTags?: Readonly<Partial<Record<string, number>>>;
  /** 다시 뜨기까지 일. 'season' = 시즌에 한 번, 'once' = 커리어 한 번. 없으면 선택형 season / 정보형 messageCooldown */
  cooldown?: number | 'season' | 'once';
  /** 슬롯 가중치 */
  weight?: number;
  title: readonly string[];
  text: ToneText;
  effects?: readonly Effect[];
  choices?: readonly EventChoice[];
  /** 선택형 기한 (일, 없으면 BALANCE.events.deadlineDays). 기한이 지나면 fallback (없으면 마지막 선택지) */
  deadline?: number;
  fallback?: string;
}

export interface EventsState {
  season: number;
  /** 이번 시즌 선택형 슬롯 날짜 */
  slots: IsoDate[];
  /** 이벤트별 마지막으로 뜬 날 */
  fired: Record<string, IsoDate>;
  /** 이번 시즌 뜬 이벤트 */
  seasonFired: string[];
  /** 커리어 한 번 */
  once: string[];
  flags: Record<string, number>;
  /** 예약된 이벤트 */
  queue: { id: string; date: IsoDate }[];
  /** 다음 n경기 폼 보정 */
  formMod?: { v: number; games: number } | null;
  /** 마지막으로 바로 뜬 이벤트 날 (몰림 방지) */
  last: IsoDate | '';
  /** 이벤트 끔 (측정·테스트용: 위상·신뢰도를 정확히 재는 테스트). 화면에는 없다 */
  off?: boolean;
  /** 확인한 이적 기록 수 (같은 포지션 영입 감지) */
  tx: number;
  /** 가족 휴가 (C.67a, pending 102 ⑨): 이 날 전까지 경기 결장·훈련 없음. 없으면 휴가 아님 */
  leave?: IsoDate | null;
}

export function ensureEvents(state: GameState): EventsState {
  // 키를 처음부터 모두 둔다: 세이브 왕복 뒤에도 키 순서가 같아야 같은 세이브 문자열 (결정성 테스트)
  const ev = (state.events ??= { season: state.league.season, slots: [], fired: {}, seasonFired: [], once: [], flags: {}, queue: [], formMod: null, last: '', tx: state.transfers?.length ?? 0 });
  return ev;
}

export const eventById = (id: string): EventDef | undefined => EVENTS.find((e) => e.id === id);

// ── 변수 ──

function lastMatch(state: GameState) {
  const r = state.lastMatch;
  return r && r.season === state.league.season ? r : null;
}

/** 조건 변수 값 */
export function evVar(state: GameState, v: EvVar): number {
  const p = state.player;
  const s = p.season;
  const lm = lastMatch(state);
  switch (v) {
    case 'rep': return p.reputation;
    case 'tier': return ['normal', 'special', 'topClass', 'worldClass', 'legendary'].indexOf(reputationTier(p.reputation, p.honors));
    case 'trust': return state.manager && state.manager.teamId === p.teamId ? state.manager.trust : 50;
    case 'fatigue': return p.fatigue;
    case 'form': return formBonus(p.recentRatings);
    case 'goals': return s.goals;
    case 'assists': return s.assists;
    case 'apps': return s.apps;
    case 'starts': return s.starts;
    case 'avg': return s.apps ? s.ratingSum / s.apps : 0;
    case 'rank': return Math.max(1, sortedTable(state.league).findIndex((r) => r.teamId === p.teamId) + 1);
    case 'round': return state.league.round;
    case 'seasonNo': return p.history.length + 1;
    case 'age': return p.age;
    case 'lastPlayed': return lm && lm.result.minutes > 0 ? 1 : 0;
    case 'lastResult': return !lm ? 0 : lm.result.outcome === 'win' ? 1 : lm.result.outcome === 'loss' ? -1 : 0;
    case 'lastRating': return lm?.result.rating ?? 0;
    case 'lastGoals': return lm?.result.goals ?? 0;
    case 'lastAssists': return lm?.result.assists ?? 0;
    case 'lastRed': return lm?.cards?.red ? 1 : 0;
    case 'lastDerby': return lm && derbyOf(p.teamId, lm.opponentId) ? 1 : 0;
    case 'lastDecisive': return lm && lm.result.outcome === 'win' && lm.result.goals > 0 && lm.result.goalsFor - lm.result.goalsAgainst === 1 ? 1 : 0;
    case 'lastMom': return lm?.result.mom ? 1 : 0;
    case 'lastBig': {
      if (!lm) return 0;
      const rank = [...state.league.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === lm.opponentId) + 1;
      return derbyOf(p.teamId, lm.opponentId) || rank <= 6 ? 1 : 0;
    }
    case 'injured': return p.injury ? 1 : 0;
    case 'injuryDays': return p.injury?.daysTotal ?? 0;
    case 'benchRun': {
      let n = 0;
      for (let i = state.matchLog.length - 1; i >= 0 && state.matchLog[i]!.absent === 'bench'; i--) n++;
      return n;
    }
    case 'rivalGap': return rivalGap(state) ?? 0;
    case 'hasRival': return rivalOf(state) ? 1 : 0;
    case 'captain': return isCaptain(state) ? 1 : 0;
    case 'clubSeasons': return clubSeasons(state);
    case 'foreign': return isForeign(p) ? 1 : 0;
    case 'contractLeft': return state.market?.contract ? state.market.contract.until - state.league.season : 9;
    case 'offseason': return state.phase === 'season' ? 0 : 1;
    case 'home': case 'adapt': case 'team': case 'mental': return lifeVar(state, v);
    case 'cash': return Math.floor((state.money?.cash ?? 0) / 10000);
    default: return 0;
  }
}

/** 조건 판정 */
export function check(state: GameState, c: Cond | undefined): boolean {
  if (!c) return true;
  if (Array.isArray(c)) {
    const [v, op, n] = c as readonly [EvVar, Op, number];
    const x = evVar(state, v);
    switch (op) {
      case '<': return x < n;
      case '<=': return x <= n;
      case '>': return x > n;
      case '>=': return x >= n;
      case '==': return x === n;
      case '!=': return x !== n;
    }
  }
  const o = c as Exclude<Cond, readonly [EvVar, Op, number]>;
  if ('all' in o) return o.all.every((x) => check(state, x));
  if ('any' in o) return o.any.some((x) => check(state, x));
  if ('not' in o) return !check(state, o.not);
  if ('flag' in o) return (state.events?.flags[o.flag] ?? 0) > 0;
  if ('tag' in o) return tagHas(state.player, o.tag as TagId);
  return false;
}

// ── 텍스트 ──

/** 톤 (20.7 2번): 직전 결과·평점·위상 티어 */
export function toneOf(state: GameState): 'praise' | 'neutral' | 'critic' {
  const lm = lastMatch(state);
  if (lm && lm.result.minutes > 0) {
    if (lm.result.rating !== null && lm.result.rating >= 7.3 || (lm.result.outcome === 'win' && lm.result.goals + lm.result.assists > 0)) return 'praise';
    if (lm.result.outcome === 'loss' && (lm.result.rating ?? 6.5) < 6.2) return 'critic';
  }
  return evVar(state, 'tier') >= 2 ? 'praise' : 'neutral';
}

function textVars(state: GameState): Record<string, string | number> {
  const p = state.player;
  const lm = lastMatch(state);
  const rv = rivalOf(state);
  return {
    name: p.name, team: teamById(state.league, p.teamId)?.nameKo ?? p.teamId, opp: lm ? teamById(state.league, lm.opponentId)?.nameKo ?? '' : '상대',
    manager: coachName(state, p.teamId), rival: rv?.name ?? '라이벌', rivalTeam: rv?.team ?? '', goals: p.season.goals, assists: p.season.assists,
    rating: lm?.result.rating?.toFixed(1) ?? '-', rank: evVar(state, 'rank'), pos: p.position, age: p.age, round: state.league.round,
    deal: state.money?.invest?.offer ? state.money.invest.offer.label : '사업', dealAmount: state.money?.invest?.offer ? moneyLabel(state.money.invest.offer.amount) : '',
  };
}

function toneText(t: ToneText, tone: 'praise' | 'neutral' | 'critic'): readonly string[] {
  if (Array.isArray(t)) return t as readonly string[];
  const o = t as Exclude<ToneText, readonly string[]>;
  return o[tone] ?? o.neutral;
}

function rngOf(state: GameState, ...parts: (string | number)[]) {
  return createRng(hashSeed([state.worldSeed, 'ev', ...parts].join(':')));
}

// ── 효과 ──

/** 효과 적용 (상한 안에서). 바뀐 내용 한 줄들 */
export function applyEffects(state: GameState, effects: readonly Effect[], why: string): string[] {
  const p = state.player;
  const ev = ensureEvents(state);
  const out: string[] = [];
  for (const e of effects) {
    if ('rep' in e) {
      const d = clamp(e.rep, -E().caps.rep, E().caps.rep);
      p.reputation = Math.max(0, p.reputation + d);
      out.push(`위상 ${d > 0 ? '+' : '−'}${Math.abs(d)}`);
    } else if ('trust' in e) {
      const d = addTrust(state, clamp(e.trust, -E().caps.trust, E().caps.trust), why, { scaled: false });
      if (d) out.push(`감독 신뢰도 ${d > 0 ? '+' : '−'}${Math.abs(d)}`);
    } else if ('form' in e) {
      const v = clamp((ev.formMod?.games ? ev.formMod.v : 0) + e.form, -E().formMax, E().formMax);
      ev.formMod = { v: Math.round(v * 100) / 100, games: Math.max(e.games, ev.formMod?.games ?? 0) };
      out.push(`다음 ${e.games}경기 폼 ${e.form > 0 ? '+' : '−'}${Math.abs(e.form)}`);
    } else if ('fatigue' in e) {
      p.fatigue = clamp(p.fatigue + e.fatigue, 0, BALANCE.fatigue.max);
      out.push(`체력 ${e.fatigue > 0 ? '−' : '+'}${Math.abs(e.fatigue)}`);
    } else if ('flag' in e) {
      if (e.on === false) delete ev.flags[e.flag];
      else ev.flags[e.flag] = (ev.flags[e.flag] ?? 0) + 1;
    } else if ('pick' in e) {
      if (state.cards) {
        grantMeetingPick(state.cards, `ev:${why}:${state.calendar.date}`, p.position, state.worldSeed, '이벤트 보상');
        out.push('카드 선택권 +1');
      }
    } else if ('xp' in e) {
      addXp(p, e.xp);
      out.push(`XP +${e.xp}`);
    } else if ('next' in e) {
      ev.queue.push({ id: e.next, date: addDays(state.calendar.date, e.days) });
    } else if ('captain' in e) {
      setCaptain(state, e.captain);
      out.push(e.captain ? '주장 완장' : '주장 내려놓음');
    } else if ('life' in e) {
      // 숨은 지표라 결과 문장에 숫자를 보이지 않는다
      addLife(state, e.life, e.add);
    } else if ('money' in e) {
      const w = myWage(state);
      const a = Math.sign(e.money) * Math.max(BALANCE.wealth.eventMinUnit, Math.round(Math.abs(w * e.money) / 10) * 10);
      book(state, e.charity ? 'charity' : 'event', a, why);
      if (e.charity) eventCharity(state, -a);
      out.push(`${e.charity ? '기부' : '돈'} ${moneyLabel(a, true)}`);
    } else if ('invest' in e) {
      if (e.invest === 'deal') {
        const t = acceptDeal(state);
        if (t) out.push(t);
      } else declineDeal(state);
    } else if ('leave' in e) {
      const days = BALANCE.events.familyLeaveDays;
      ev.leave = addDays(state.calendar.date, days);
      out.push(`${days}일 휴가 · 그동안 경기 결장`);
    }
  }
  return out;
}


/** 이번 경기 폼 보정 (matchForm 에 더한다) */
export function eventForm(state: GameState): number {
  const m = state.events?.formMod;
  return m && m.games > 0 ? m.v : 0;
}

// ── 발동 ──

function cooldownOk(state: GameState, d: EventDef, date: IsoDate): boolean {
  const ev = ensureEvents(state);
  const cd = d.cooldown ?? (d.kind === 'message' ? E().messageCooldown : 'season');
  if (cd === 'once') return !ev.once.includes(d.id);
  if (cd === 'season') return !ev.seasonFired.includes(d.id);
  const last = ev.fired[d.id];
  return !last || daysBetween(last, date) >= cd;
}

function eligible(state: GameState, d: EventDef, date: IsoDate): boolean {
  // 생활 이벤트는 시즌 상한 (pending 47 질문 ④)
  if (d.tags.includes('life') && lifeEventsFull(state)) return false;
  return cooldownOk(state, d, date) && check(state, d.when);
}

/** 태그 배율을 건 확률 */
export function chanceOf(state: GameState, d: EventDef): number {
  let c = d.chance ?? 1;
  for (const [t, m] of Object.entries(d.chanceTags ?? {})) if (m !== undefined && tagHas(state.player, t as TagId)) c *= m;
  // 챕터 이벤트 분류 배율 (22.1, C.73a)
  c *= chapterEventMul(state, d.tags);
  return Math.min(1, c);
}

/** 이벤트를 띄운다: 정보형은 효과를 바로, 선택형은 인박스에 선택지. 인박스 알림을 돌려준다 */
export function fireEvent(state: GameState, d: EventDef, tagKey = ''): InboxItem {
  const ev = ensureEvents(state);
  const date = state.calendar.date;
  ev.fired[d.id] = date;
  if (!ev.seasonFired.includes(d.id)) ev.seasonFired.push(d.id);
  if (d.tags.includes('life')) ensureLife(state).events++;
  if (d.cooldown === 'once' && !ev.once.includes(d.id)) ev.once.push(d.id);
  const rng = rngOf(state, 'text', d.id, date, tagKey);
  const vars = textVars(state);
  const title = fill(pickText(d.title, rng()), vars);
  let body = fill(pickText(toneText(d.text, toneOf(state)), rng()), vars);
  if (d.kind === 'message') {
    const got = d.effects ? applyEffects(state, d.effects, title) : [];
    if (got.length) body += ` (${got.join(' · ')})`;
    return pushInbox(state, { cat: d.cat, title, body, ev: d.id });
  }
  const choices: InboxChoice[] = (d.choices ?? []).map((c) => ({ id: c.id, label: c.label, desc: c.desc, ...(c.requires && !check(state, c.requires) ? { disabled: '지금은 고를 수 없어요' } : {}) }));
  return pushInbox(state, { cat: d.cat, title, body, ev: d.id, choices, due: addDays(date, d.deadline ?? E().deadlineDays) });
}

/** 선택형 답하기. 결과 문장을 돌려준다 */
export function answerEvent(state: GameState, itemId: number, choiceId: string, auto = false): string {
  const it = ensureInbox(state).items.find((x) => x.id === itemId);
  if (!it || !isPending(it)) throw new Error('답할 수 없는 알림');
  const d = it.ev ? eventById(it.ev) : undefined;
  const c = d?.choices?.find((x) => x.id === choiceId);
  if (!d || !c) throw new Error('없는 선택');
  if (!auto && it.choices?.find((x) => x.id === choiceId)?.disabled) throw new Error('고를 수 없는 선택');
  const vars = textVars(state);
  let text = fill(pickText(c.result, rngOf(state, 'result', d.id, it.id)()), vars);
  const got = applyEffects(state, c.effects, it.title);
  if (got.length) text += ` (${got.join(' · ')})`;
  it.answer = { id: c.id, label: c.label, text, ...(auto ? { auto: true } : {}) };
  it.read = true;
  return text;
}

// ── 자동 진행 중 인터뷰 (C.75x) ──

/** 인터뷰 이벤트 (태그 interview): 자동 진행 중에는 멈추지 않고 손해가 가장 적은 답을 고른다. 다른 선택형은 지금처럼 멈춘다 */
export const isInterviewEvent = (d: EventDef | undefined): boolean => !!d?.tags.includes('interview');

/**
 * 효과 묶음의 손해 (가중치 없이 단위 합): 위상·신뢰도·생활 지표(팀·집·적응) 감소, 멘탈 피로·체력 소모 증가, 폼 감소(%p), 돈 감소(주급 배수, 기부 제외),
 * 예약 이벤트(next)는 그 이벤트의 손해(정보형 = 효과, 선택형 = 가장 적은 답)
 */
export function effectsPenalty(effects: readonly Effect[], depth = 0): number {
  let pen = 0;
  for (const e of effects) {
    if ('rep' in e) pen += Math.max(0, -e.rep);
    else if ('trust' in e) pen += Math.max(0, -e.trust);
    else if ('form' in e) pen += Math.max(0, -e.form) * 100;
    else if ('fatigue' in e) pen += Math.max(0, e.fatigue);
    else if ('life' in e) pen += e.life === 'mental' ? Math.max(0, e.add) : Math.max(0, -e.add);
    else if ('money' in e) pen += e.charity ? 0 : Math.max(0, -e.money);
    else if ('next' in e && depth < 3) {
      const d = eventById(e.next);
      if (d?.kind === 'message') pen += effectsPenalty(d.effects ?? [], depth + 1);
      else if (d?.choices?.length) pen += Math.min(...d.choices.map((c) => effectsPenalty(c.effects, depth + 1)));
    }
  }
  return pen;
}

/** 손해가 가장 적은 답 (고를 수 있는 것 중). 같으면 기본 선택(fallback = 무난한 답), 그다음 데이터 순서 */
export function leastPenaltyChoice(d: EventDef, item: InboxItem): EventChoice | undefined {
  const open = (d.choices ?? []).filter((c) => !item.choices?.find((x) => x.id === c.id)?.disabled);
  let best: EventChoice | undefined;
  let bestPen = Infinity;
  for (const c of open) {
    const pen = effectsPenalty(c.effects);
    if (pen < bestPen || (pen === bestPen && c.id === d.fallback)) { best = c; bestPen = pen; }
  }
  return best;
}

/** 자동 진행 중 새로 뜬 인터뷰에 답한다 (skip = 진행 전부터 있던 알림 id, 그건 사용자 몫). 답한 알림의 한 줄 목록 */
export function autoAnswerInterviews(state: GameState, skip: ReadonlySet<number> = new Set()): string[] {
  const out: string[] = [];
  for (const it of state.inbox?.items ?? []) {
    if (!isPending(it) || skip.has(it.id)) continue;
    const d = it.ev ? eventById(it.ev) : undefined;
    if (!d || !isInterviewEvent(d)) continue;
    const c = leastPenaltyChoice(d, it);
    if (!c) continue;
    const text = answerEvent(state, it.id, c.id, true);
    it.answer!.text = `자동 진행 · 손해가 가장 적은 답. ${text}`;
    out.push(`${it.title} → ${c.label}`);
  }
  return out;
}

/** 기한 지난 선택형: 기본 선택 (fallback, 없으면 고를 수 있는 마지막 선택지) */
function expire(state: GameState, date: IsoDate): void {
  for (const it of state.inbox?.items ?? []) {
    if (!isPending(it) || !it.due || daysBetween(it.due, date) < 0) continue;
    const d = it.ev ? eventById(it.ev) : undefined;
    if (!d?.choices) { it.answer = { id: '', label: '', text: '기한이 지났어요', auto: true }; continue; }
    const open = d.choices.filter((c) => !it.choices?.find((x) => x.id === c.id)?.disabled);
    const pick = d.choices.find((c) => c.id === d.fallback) ?? open[open.length - 1] ?? d.choices[d.choices.length - 1]!;
    answerEvent(state, it.id, pick.id, true);
  }
}

/** 하나 고르기 (가중치·시드) */
function pickWeighted(state: GameState, list: readonly EventDef[], r: number): EventDef | undefined {
  // 슬롯 가중치 × 챕터 이벤트 분류 배율 (22.1, C.73a)
  const w = (d: EventDef) => (d.weight ?? 1) * chapterEventMul(state, d.tags);
  const tot = list.reduce((t, d) => t + w(d), 0);
  let x = r * tot;
  for (const d of list) {
    x -= w(d);
    if (x < 0) return d;
  }
  return list[list.length - 1];
}

/** 바로 뜨는 이벤트 한 개 (조건·확률, 표 순서 = 우선순위) */
function fireImmediate(state: GameState, on: EventDef['on'], date: IsoDate): InboxItem | null {
  const ev = ensureEvents(state);
  if (ev.last && daysBetween(ev.last, date) < E().minGapDays) return null;
  const rng = rngOf(state, on, date);
  for (const d of EVENTS) {
    if (d.on !== on || !eligible(state, d, date)) continue;
    if (rng() >= chanceOf(state, d)) continue;
    ev.last = date;
    return fireEvent(state, d);
  }
  return null;
}

/** 시즌 시작: 선택형 슬롯 4~6개 (주차 슬롯 중 가중 샘플링 → 날짜) */
export function eventsSeasonStart(state: GameState, opening: IsoDate): void {
  const ev = ensureEvents(state);
  const S = E().slots;
  const rng = rngOf(state, 'slots', state.league.season);
  const n = S.min + Math.floor(rng() * (S.max - S.min + 1));
  const weeks = [...S.weeks];
  const picked: number[] = [];
  const k = Math.min(n, weeks.length);
  while (picked.length < k) picked.push(weeks.splice(Math.floor(rng() * weeks.length), 1)[0]!);
  ev.season = state.league.season;
  ev.slots = picked.sort((a, b) => a - b).map((w) => addDays(opening, w * 7 + Math.floor(rng() * 5)));
  ev.seasonFired = [];
  ev.last = '';
  ev.tx = state.transfers?.length ?? 0;
  // 라이벌 (20.5): 없거나 떠났거나 격차가 크면 새로
  const rv = rivalSeasonStart(state);
  if (rv) rivalIntro(state, rv);
  // 주장: 이적했으면 끝, 신뢰도가 낮으면 완장을 뺏김
  captainSeasonStart(state);
  // 생활 이벤트 시즌 상한 다시 (C.63 b)
  lifeSeasonStart(state);
}

/** 하루 끝 (endDay): 기한 지난 선택 → 예약 → 슬롯 → 하루 이벤트 */
export function eventsDayEnd(state: GameState, date: IsoDate): void {
  const ev = ensureEvents(state);
  if (ev.off) return;
  ev.tx = detectCompetitor(state, ev.flags, ev.tx);
  expire(state, date);
  for (const q of [...ev.queue]) {
    if (daysBetween(q.date, date) < 0) continue;
    ev.queue.splice(ev.queue.indexOf(q), 1);
    const d = eventById(q.id);
    if (d && check(state, d.when)) fireEvent(state, d, 'q');
  }
  if (ev.slots.includes(date)) {
    const pool = EVENTS.filter((d) => d.on === 'slot' && eligible(state, d, date));
    const d = pickWeighted(state, pool, rngOf(state, 'slot', date)());
    if (d) fireEvent(state, d, 'slot');
  }
  fireImmediate(state, 'day', date);
}

/** 내 경기 뒤: 폼 효과 경기 수를 줄이고 경기 뒤 이벤트 */
export function eventsAfterMatch(state: GameState): void {
  const ev = ensureEvents(state);
  if (ev.formMod && ev.formMod.games > 0) {
    ev.formMod.games--;
    if (ev.formMod.games <= 0) ev.formMod = null;
  }
  if (ev.off) return;
  fireImmediate(state, 'match', `${state.calendar.date}`);
}

/** 시즌 끝: 시즌 끝 이벤트 (기한은 다음 시즌까지 넘어가지 않게 비시즌에 자동 처리) */
export function eventsSeasonEnd(state: GameState): void {
  const date = state.calendar.date;
  if (state.events?.off) return;
  rivalSeasonEnd(state);
  const cap = captainSeasonEnd(state);
  if (cap) pushInbox(state, { cat: 'club', key: `captain-end:${state.league.season}`, title: '주장으로 한 시즌', body: `완장을 차고 시즌을 마쳤어요. 위상 +${cap}.` });
  // 생활 플레이 태그 (C.63 b): 라커룸 리더 · 언론의 총아
  lifeSeasonEnd(state);
  for (const d of EVENTS) if (d.on === 'season' && eligible(state, d, date) && rngOf(state, 'season', d.id, state.league.season)() < chanceOf(state, d)) fireEvent(state, d, 'season');
}

/** 비시즌이 끝날 때(새 시즌 시작 직전): 답하지 않은 선택형은 기본 선택 */
export function eventsCloseOffseason(state: GameState): void {
  for (const it of state.inbox?.items ?? []) if (isPending(it) && it.due) it.due = state.calendar.date;
  expire(state, state.calendar.date);
}

/** 가족 휴가 중인 날인지 (C.67a): 그날 경기 결장, 훈련 대신 휴가 */
export function onLeave(state: GameState, date: IsoDate): boolean {
  const l = state.events?.leave;
  return !!l && daysBetween(date, l) > 0 && daysBetween(state.calendar.date, date) >= 0;
}
