// 커리어 챕터 (22.1, 부록 C.73a, pending 119): 나이(시즌 시작 기준)로 유망주 ≤20 · 도약 21~25 · 전성기 26~31 · 황혼 32~.
// 챕터마다 시즌 목표 섞기(seasonGoals) · 이벤트 분류 배율(events) · 챕터 끝 카드 선택권 1회를 바꾸고,
// 챕터가 바뀌는 시즌 종료(또는 은퇴) 뒤 챕터 리뷰를 한 번 보여 준다. XP·성장 수치는 바꾸지 않는다 (엔진 밖)

import { BALANCE } from './config/balance';
import type { Rarity } from './config/cards';
import { grantTierPick } from './cardCollection';
import { playerOvr, reputationTier } from './growth';
import { BADGE_NAMES_KO } from './badges';
import type { GameState } from './game';
import type { Badge, SeasonRecord, Tier } from './types';

const C = () => BALANCE.chapters;

export type ChapterId = 'prospect' | 'rise' | 'prime' | 'twilight';
export const CHAPTER_IDS: readonly ChapterId[] = ['prospect', 'rise', 'prime', 'twilight'];
export const CHAPTER_KO: Record<ChapterId, string> = { prospect: '유망주', rise: '도약', prime: '전성기', twilight: '황혼' };
/** 챕터 한 줄 (22.1) */
export const CHAPTER_THEME_KO: Record<ChapterId, string> = {
  prospect: '주전 경쟁과 첫 계약', rise: '이적과 위상 상승', prime: '개인상과 우승', twilight: '노화, 은퇴 선택, 레거시',
};

/** 하이라이트 한 줄 (점수가 높은 것부터 BALANCE.chapters.highlights 개) */
export interface ChapterHighlight { season: number; text: string; score: number }

export interface ChapterRec {
  id: ChapterId;
  startSeason: number;
  endSeason: number;
  startAge: number;
  endAge: number;
  startOvr: number;
  endOvr: number;
  startRep: number;
  endRep: number;
  startTier: Tier;
  endTier: Tier;
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  ratingSum: number;
  moms: number;
  highlights: ChapterHighlight[];
  /** 받은 레전드 배지 id */
  badges: string[];
  /** 트로피 (리그·FA컵·챔스 우승, 시즌 시상) — "2024 리그 우승" 꼴 */
  trophies: string[];
  /** 챕터가 끝났는가 (다음 챕터로 넘어감 또는 은퇴) */
  done: boolean;
  /** 챕터 끝 카드 선택권 이름 (없으면 null) */
  pick: string | null;
}

export interface ChaptersState {
  list: ChapterRec[];
  /** 보여 줄 챕터 리뷰 (list 순번). 본 뒤 null */
  review: number | null;
}

/** 나이 → 챕터 */
export function chapterOf(age: number): ChapterId {
  const M = C().maxAge;
  return age <= M.prospect ? 'prospect' : age <= M.rise ? 'rise' : age <= M.prime ? 'prime' : 'twilight';
}

/** 지금 챕터 (홈·선수 칩): 시즌 중이면 이번 시즌 나이, 비시즌이면 다음 시즌 나이 (endSeason 이 나이를 올린 뒤) */
export function currentChapter(state: GameState): ChapterId {
  return chapterOf(state.player.age);
}

export function ensureChapters(state: GameState): ChaptersState {
  return (state.chapters ??= { list: [], review: null });
}

/** 이벤트 태그 배율 (곱한 뒤 eventClamp 안) */
export function chapterEventMul(state: GameState, tags: readonly string[]): number {
  const map = C().eventMul[currentChapter(state)] ?? {};
  let m = 1;
  for (const t of tags) m *= map[t] ?? 1;
  const [lo, hi] = C().eventClamp;
  return m === 1 ? 1 : Math.min(hi, Math.max(lo, m));
}

/** 시즌 기록에서 하이라이트 후보 (경기 목록 · 트로피 · 배지) */
function seasonHighlights(state: GameState, season: number, trophies: readonly string[], badges: readonly Badge[]): ChapterHighlight[] {
  const out: ChapterHighlight[] = [];
  const played = state.matchLog.filter((e) => e.minutes > 0 && e.rating !== null);
  const best = [...played].sort((a, b) => (b.rating! + b.goals * 0.3 + b.assists * 0.2) - (a.rating! + a.goals * 0.3 + a.assists * 0.2))[0];
  if (best) {
    const opp = state.league.teams.find((t) => t.id === best.opponentId)?.nameKo ?? '상대';
    const ga = [best.goals ? `${best.goals}골` : '', best.assists ? `${best.assists}도움` : ''].filter(Boolean).join(' ');
    out.push({ season, text: `${opp}전 평점 ${best.rating!.toFixed(1)}${ga ? ` · ${ga}` : ''}${best.mom ? ' · MOM' : ''}`, score: best.rating! + best.goals * 0.3 + best.assists * 0.2 });
  }
  const s = state.player.season;
  if (s.goals + s.assists >= 15) out.push({ season, text: `한 시즌 ${s.goals}골 ${s.assists}도움`, score: 6 + (s.goals + s.assists) / 10 });
  for (const t of trophies) out.push({ season, text: t, score: 10 });
  for (const b of badges) out.push({ season, text: `레전드 배지 · ${BADGE_NAMES_KO[b.id] ?? b.id}`, score: 12 });
  return out;
}

function mergeHighlights(a: readonly ChapterHighlight[], b: readonly ChapterHighlight[]): ChapterHighlight[] {
  return [...a, ...b].sort((x, y) => y.score - x.score || x.season - y.season).slice(0, C().highlights);
}

/** 챕터 끝 카드 선택권 (C.65 흐름 재사용). 선택권 이름을 돌려준다 */
function grantChapterPick(state: GameState, rec: ChapterRec): string | null {
  const r = C().pick[rec.id] as Rarity | null;
  if (!r || !state.cards) return null;
  const label = `${CHAPTER_KO[rec.id]} 챕터 완주 보상`;
  return grantTierPick(state.cards, `chapter:${rec.id}:${rec.startSeason}`, state.player.position, state.worldSeed, label, { [r]: 1 }, 'chapter') ? label : null;
}

export interface ChapterSeasonInput {
  season: number;
  /** 그 시즌 나이 (시즌 시작 기준) */
  age: number;
  /** 시즌 시작 OVR · 시즌 끝(노화 뒤) OVR, 시즌 시작 위상 · 시즌 끝 위상 */
  ovrStart: number;
  ovrEnd: number;
  repStart: number;
  repEnd: number;
  record: SeasonRecord;
  badges: readonly Badge[];
  trophies: readonly string[];
}

/**
 * 시즌 끝 (endSeason, 나이를 올린 뒤): 이번 시즌을 그 챕터 기록에 더하고, 다음 시즌 나이가 다른 챕터면 챕터를 닫는다
 * (챕터 리뷰 예약 + 카드 선택권). 닫은 챕터를 돌려준다
 */
export function chaptersSeasonEnd(state: GameState, x: ChapterSeasonInput): ChapterRec | null {
  const cs = ensureChapters(state);
  const id = chapterOf(x.age);
  const honors = state.player.honors;
  let rec = cs.list.at(-1);
  if (!rec || rec.done || rec.id !== id) {
    rec = {
      id, startSeason: x.season, endSeason: x.season, startAge: x.age, endAge: x.age,
      startOvr: x.ovrStart, endOvr: x.ovrEnd, startRep: x.repStart, endRep: x.repEnd,
      startTier: reputationTier(x.repStart, honors), endTier: reputationTier(x.repEnd, honors),
      seasons: 0, apps: 0, goals: 0, assists: 0, ratingSum: 0, moms: 0, highlights: [], badges: [], trophies: [], done: false, pick: null,
    };
    cs.list.push(rec);
  }
  const r = x.record;
  Object.assign(rec, {
    endSeason: x.season, endAge: x.age, endOvr: x.ovrEnd, endRep: x.repEnd, endTier: reputationTier(x.repEnd, honors),
    seasons: rec.seasons + 1, apps: rec.apps + r.apps, goals: rec.goals + r.goals, assists: rec.assists + r.assists,
    ratingSum: rec.ratingSum + r.ratingSum, moms: rec.moms + (r.moms ?? 0),
  });
  rec.badges.push(...x.badges.map((b) => b.id));
  rec.trophies.push(...x.trophies.map((t) => `${x.season} ${t}`));
  rec.highlights = mergeHighlights(rec.highlights, seasonHighlights(state, x.season, x.trophies, x.badges));
  if (chapterOf(state.player.age) === id) return null;
  rec.done = true;
  rec.pick = grantChapterPick(state, rec);
  cs.review = cs.list.length - 1;
  return rec;
}

/** 은퇴 (retire): 지금 챕터를 닫고 챕터 리뷰 → 커리어 요약 (선택권은 없음) */
export function chaptersRetire(state: GameState): ChapterRec | null {
  const cs = ensureChapters(state);
  const rec = cs.list.at(-1);
  if (!rec) return null;
  rec.done = true;
  cs.review = cs.list.length - 1;
  return rec;
}

/** 챕터 리뷰를 봤다 */
export function chapterReviewed(state: GameState): void {
  if (state.chapters) state.chapters.review = null;
}

/** 보여 줄 챕터 리뷰 */
export function pendingChapterReview(state: GameState): ChapterRec | null {
  const i = state.chapters?.review;
  return i === null || i === undefined ? null : state.chapters!.list[i] ?? null;
}

/**
 * 옛 세이브 이식 (세이브 39 → 40): 지난 시즌 기록(history)을 나이로 묶어 챕터 기록을 채운다.
 * 시작 OVR = 첫 시즌 기록 OVR(그 시즌 끝 노화 전), 끝 OVR = 다음 시즌 기록 OVR(마지막이면 지금 OVR). 리뷰·선택권은 주지 않는다
 */
export function chaptersFromHistory(state: GameState): ChaptersState {
  const p = state.player;
  const list: ChapterRec[] = [];
  const h = p.history;
  h.forEach((r, i) => {
    const id = chapterOf(r.age);
    const endOvr = h[i + 1]?.ovr ?? playerOvr(p);
    const repStart = i > 0 ? h[i - 1]!.reputation : r.reputation;
    let rec = list.at(-1);
    if (!rec || rec.id !== id) {
      rec = {
        id, startSeason: r.season, endSeason: r.season, startAge: r.age, endAge: r.age, startOvr: r.ovr, endOvr, startRep: repStart, endRep: r.reputation,
        startTier: reputationTier(repStart, p.honors), endTier: reputationTier(r.reputation, p.honors),
        seasons: 0, apps: 0, goals: 0, assists: 0, ratingSum: 0, moms: 0, highlights: [], badges: [], trophies: [], done: true, pick: null,
      };
      list.push(rec);
    }
    Object.assign(rec, {
      endSeason: r.season, endAge: r.age, endOvr, endRep: r.reputation, endTier: reputationTier(r.reputation, p.honors),
      seasons: rec.seasons + 1, apps: rec.apps + r.apps, goals: rec.goals + r.goals, assists: rec.assists + r.assists, ratingSum: rec.ratingSum + r.ratingSum, moms: rec.moms + (r.moms ?? 0),
    });
    const hl: ChapterHighlight[] = [];
    if (r.leaguePosition === 1) { rec.trophies.push(`${r.season} 리그 우승`); hl.push({ season: r.season, text: '리그 우승', score: 10 }); }
    if (r.goals + r.assists >= 15) hl.push({ season: r.season, text: `한 시즌 ${r.goals}골 ${r.assists}도움`, score: 6 + (r.goals + r.assists) / 10 });
    else if (r.apps > 0) hl.push({ season: r.season, text: `${r.apps}경기 평점 ${(r.ratingSum / r.apps).toFixed(2)}`, score: r.ratingSum / r.apps });
    const bs = (p.badges ?? []).filter((b) => b.season === r.season);
    rec.badges.push(...bs.map((b) => b.id));
    hl.push(...bs.map((b) => ({ season: r.season, text: `레전드 배지 · ${BADGE_NAMES_KO[b.id] ?? b.id}`, score: 12 })));
    rec.highlights = mergeHighlights(rec.highlights, hl);
  });
  // 마지막 챕터가 지금 나이 챕터와 같으면 아직 진행 중
  const last = list.at(-1);
  if (last && state.phase !== 'retired' && chapterOf(p.age) === last.id) last.done = false;
  return { list, review: null };
}
