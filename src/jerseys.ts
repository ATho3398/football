// 유니폼 교환 · 진열실 (46b단계, 부록 C.76b, pending 130 ②③): 엔진 경기가 끝나면 결과 화면에서 상대 팀 실제 선수(도감 번호가 있는 선수,
// 레전드·미래 스타 포함, 가상 제외) 한 명에게 경기당 한 번 유니폼 교환을 요청한다. 성공 확률 = 내 위상 티어 + 상대 멘탈(침착성·리더십)
// + 오늘 평점 + 관계(더비·라이벌 −, 같은 국적·내가 뛰었던 팀 +). 성공하면 포토카드 jersey = true (카드가 없으면 같이 얻음).
// 진열실 = 집 단계별 칸(BALANCE.jerseys.showroomSlots)에 트로피(챕터 기록)·얻은 유니폼을 진열, 나머지는 보관함.
// 세이브: state.showcase = 교환 기록(날짜·상대·선수·성공) + 진열 배치(항목 id 순서). 트로피·유니폼 목록은 볼 때 기록에서 만든다

import { BALANCE } from './config/balance';
import { derbyOf } from './derby';
import { reputationTier } from './growth';
import { npcOvr } from './npc';
import { DEX_NO, dexCandidate } from './photocards';
import { rivalOf } from './rival';
import { findRosterPlayer, naturalOvr } from './roster';
import { createRng, hashSeed } from './rng';
import type { IsoDate } from './calendar';
import type { PlayerStats } from './engine/types';
import type { GameState, MatchReport } from './game';
import type { Tier } from './types';

const J = () => BALANCE.jerseys;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ── 세이브 ──

/** 교환 요청 한 번 */
export interface SwapRec {
  /** 날짜 · 시즌 · 상대 팀 id · 선수 id · 성공 */
  d: IsoDate;
  s: number;
  vs: string;
  id: string;
  ok: boolean;
}

export interface ShowcaseState {
  /** 요청 순서대로 */
  swaps: SwapRec[];
  /** 진열한 항목 id (진열 순서). 트로피 `t:<라벨>#<같은 라벨 순번>`, 유니폼 `j:<선수 id>` */
  shown: string[];
}

export const emptyShowcase = (): ShowcaseState => ({ swaps: [], shown: [] });

function ensureShowcase(state: GameState): ShowcaseState {
  return (state.showcase ??= emptyShowcase());
}

// ── 요청 후보 ──

/** 경기 끝 (game.ts): 내가 뛰었으면 상대 팀에서 뛴 실제 선수 id. 빠른 경기(출전 명단 없음)·결장이면 undefined */
export function jerseyPool(players: readonly PlayerStats[] | undefined, mySide: 0 | 1, myId: string): string[] | undefined {
  if (!players) return undefined;
  const me = players.find((p) => p.id === myId);
  if (!me || me.minutes <= 0) return undefined;
  const ids = players.filter((p) => p.team !== mySide && p.minutes > 0 && DEX_NO.has(p.id)).map((p) => p.id);
  return ids.length ? ids : undefined;
}

/** 지금 그 선수가 받은 유니폼이 있는지 */
export function hasJersey(state: GameState, id: string): boolean {
  return !!state.photos?.cards.some((c) => c.id === id && c.jersey);
}

// ── 확률 ──

export type RelationKind = 'derby' | 'bigDerby' | 'rival' | 'sameNation' | 'formerClub';
export const RELATION_KO: Readonly<Record<RelationKind, string>> = {
  derby: '더비 상대', bigDerby: '큰 더비', rival: '내 라이벌', sameNation: '같은 국적', formerClub: '내가 뛰었던 팀',
};

export interface JerseyChance {
  p: number;
  tier: Tier;
  base: number;
  mental: number;
  rating: number;
  relations: { kind: RelationKind; v: number }[];
}

/** 확률 계산에 쓰는 값 (테스트·측정은 이걸로 직접 부른다) */
export interface JerseyInputs {
  tier: Tier;
  /** 상대 (침착성 + 리더십) / 2, 모르면(GK 등) null */
  mental: number | null;
  /** 오늘 내 평점 */
  rating: number;
  relations: readonly RelationKind[];
}

export function chanceFrom(x: JerseyInputs): JerseyChance {
  const c = J();
  const base = c.base[x.tier];
  const mental = x.mental === null ? 0 : clamp((x.mental - c.mental.center) * c.mental.perPoint, -c.mental.cap, c.mental.cap);
  const rating = clamp((x.rating - c.rating.center) * c.rating.perPoint, -c.rating.cap, c.rating.cap);
  const relations = x.relations.map((kind) => ({ kind, v: c[kind] }));
  const p = clamp(base + mental + rating + relations.reduce((t, r) => t + r.v, 0), c.min, c.max);
  return { p, tier: x.tier, base, mental, rating, relations };
}

/** 그 선수의 지금 멘탈·국적 (로스터 → 실제 A등급 NPC) */
function oppInfo(state: GameState, id: string): { mental: number | null; nationality: string; ovr: number; team: string } {
  const r = findRosterPlayer(state.rosters, id);
  if (r) {
    const a = r.player.attributes;
    return { mental: a ? (a.composure + a.leadership) / 2 : null, nationality: r.player.nationality, ovr: naturalOvr(r.player), team: r.teamId };
  }
  const n = state.npcs.find((x) => x.id === id);
  if (n) return { mental: n.attributes ? (n.attributes.composure + n.attributes.leadership) / 2 : null, nationality: '', ovr: npcOvr(n), team: n.club };
  return { mental: null, nationality: '', ovr: 0, team: '' };
}

/** 관계 (데이터 있는 것만): 더비·큰 더비, 내 라이벌, 같은 국적, 내가 뛰었던 팀 (지금 팀 말고) */
export function relationsOf(state: GameState, id: string, oppTeamId: string): RelationKind[] {
  const out: RelationKind[] = [];
  const d = derbyOf(state.player.teamId, oppTeamId);
  if (d) out.push('derby');
  if (d?.big) out.push('bigDerby');
  if (rivalOf(state)?.id === id) out.push('rival');
  const nat = oppInfo(state, id).nationality;
  if (nat && state.player.nationality && nat === state.player.nationality) out.push('sameNation');
  if (oppTeamId !== state.player.teamId && state.player.history.some((h) => h.teamId === oppTeamId)) out.push('formerClub');
  return out;
}

export function jerseyChance(state: GameState, id: string, m: MatchReport = state.lastMatch!): JerseyChance {
  return chanceFrom({
    tier: reputationTier(state.player.reputation, state.player.honors),
    mental: oppInfo(state, id).mental,
    rating: m.result.rating ?? J().rating.center,
    relations: relationsOf(state, id, m.opponentId),
  });
}

// ── 요청 ──

const OK_LINES = [
  '좋은 경기였어요. 이거 받아요!',
  '당신 플레이 인상 깊었어요. 기꺼이 바꾸죠.',
  '물론이죠. 다음에 또 만나요.',
  '오늘은 당신이 더 잘했어요. 가져가요.',
];
const NO_LINES = [
  '미안해요, 이미 다른 선수랑 바꾸기로 했어요.',
  '오늘은 기분이 별로라… 다음에요.',
  '이 유니폼은 가족에게 주기로 했어요.',
  '음… 아직 당신을 잘 몰라서요.',
];
const DERBY_NO = '더비 상대한테는 줄 수 없죠. 팬들이 가만있지 않을 거예요.';

export interface JerseyResult { id: string; ok: boolean; p: number; line: string }

/** 그 경기에 요청할 수 있는지 (막히면 이유) */
export function jerseyBlocked(state: GameState, id: string, m: MatchReport | undefined = state.lastMatch): string | null {
  if (!m) return '경기 기록이 없어요';
  if (m.jersey) return '이 경기에서 이미 요청했어요';
  if (!m.jerseyPool?.length) return m.engine ? '상대 팀에 실제 선수가 없어요' : '자동 경기에서는 요청할 수 없어요';
  if (!m.jerseyPool.includes(id)) return '이 경기에 뛴 상대 선수가 아니에요';
  if (hasJersey(state, id)) return '이미 받은 유니폼이에요';
  return null;
}

/**
 * 유니폼 교환 요청 (경기당 1번). 결정적: worldSeed · 시즌 · 라운드 · 선수 id 로 굴린다.
 * 성공하면 포토카드 jersey = true (카드가 없으면 같이 얻음) + 진열 칸이 남으면 바로 진열
 */
export function requestJersey(state: GameState, id: string): JerseyResult | null {
  const m = state.lastMatch;
  if (!m || jerseyBlocked(state, id, m)) return null;
  const ch = jerseyChance(state, id, m);
  const rng = createRng(hashSeed([state.worldSeed, 'jersey', m.season, m.round, id].join(':')));
  const ok = rng() < ch.p;
  const pick = (list: readonly string[]) => list[Math.floor(rng() * list.length)]!;
  const line = ok ? pick(OK_LINES) : ch.relations.some((r) => r.kind === 'derby') && rng() < 0.6 ? DERBY_NO : pick(NO_LINES);
  m.jersey = { id, ok, line };
  const sc = ensureShowcase(state);
  sc.swaps.push({ d: state.calendar.date, s: m.season, vs: m.opponentId, id, ok });
  if (ok) {
    const photos = (state.photos ??= { cards: [] });
    const card = photos.cards.find((c) => c.id === id);
    if (card) card.jersey = true;
    else {
      const o = oppInfo(state, id);
      photos.cards.push({ id, d: state.calendar.date, s: m.season, vs: m.opponentId, jersey: true, first: { t: o.team, o: o.ovr } });
    }
    const key = `j:${id}`;
    if (!sc.shown.includes(key) && shownItems(state).length < showroomSlots(state)) sc.shown.push(key);
  }
  return { id, ok, p: ch.p, line };
}

// ── 진열실 ──

/** 진열 칸 수 = 집 단계 */
export function showroomSlots(state: GameState): number {
  const t = J().showroomSlots;
  return t[clamp(state.money?.house ?? 0, 0, t.length - 1)]!;
}

export interface ShowItem {
  key: string;
  kind: 'trophy' | 'jersey';
  /** 트로피 = "2019 리그 우승", 유니폼 = 선수 id */
  label: string;
  /** 유니폼: 받은 시즌 · 상대 팀 id */
  season?: number;
  vs?: string;
}

/** 지금 가진 진열 항목: 트로피(챕터 기록, 같은 라벨은 순번) → 받은 유니폼(받은 순) */
export function showItems(state: GameState): ShowItem[] {
  const out: ShowItem[] = [];
  const seen = new Map<string, number>();
  for (const t of (state.chapters?.list ?? []).flatMap((c) => c.trophies)) {
    const k = (seen.get(t) ?? 0) + 1;
    seen.set(t, k);
    out.push({ key: `t:${t}#${k}`, kind: 'trophy', label: t });
  }
  const got = new Set<string>();
  for (const s of state.showcase?.swaps ?? []) {
    if (!s.ok || got.has(s.id)) continue;
    got.add(s.id);
    out.push({ key: `j:${s.id}`, kind: 'jersey', label: s.id, season: s.s, vs: s.vs });
  }
  return out;
}

/** 진열 중인 항목 (진열 순서, 칸 수까지). 칸이 줄면(집을 줄임) 넘친 것은 보관함으로 */
export function shownItems(state: GameState): ShowItem[] {
  const by = new Map(showItems(state).map((x) => [x.key, x]));
  return (state.showcase?.shown ?? []).flatMap((k) => (by.has(k) ? [by.get(k)!] : [])).slice(0, showroomSlots(state));
}

/** 보관함 = 진열하지 않은 항목 */
export function storedItems(state: GameState): ShowItem[] {
  const on = new Set(shownItems(state).map((x) => x.key));
  return showItems(state).filter((x) => !on.has(x.key));
}

/** 진열 칸에 넣기. 칸이 다 찼거나 없는 항목이면 false */
export function showcasePut(state: GameState, key: string): boolean {
  if (!showItems(state).some((x) => x.key === key)) return false;
  const shown = shownItems(state);
  if (shown.some((x) => x.key === key) || shown.length >= showroomSlots(state)) return false;
  const sc = ensureShowcase(state);
  sc.shown = [...shown.map((x) => x.key), key];
  return true;
}

/** 진열 칸에서 빼기 (보관함으로) */
export function showcaseTake(state: GameState, key: string): boolean {
  const shown = shownItems(state);
  if (!shown.some((x) => x.key === key)) return false;
  ensureShowcase(state).shown = shown.filter((x) => x.key !== key).map((x) => x.key);
  return true;
}

/** 이름 (화면용): 유니폼 = 도감 이름 */
export const jerseyName = (id: string): string => dexCandidate(id)?.nameKo ?? id;
