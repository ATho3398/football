// 은퇴 후 (18.11 · I.14, 부록 C.73b): 명예의 전당(이 기기 로컬 상위 커리어 3개, 세이브 밖 localStorage)과 새 게임 보너스(시작 카드 선택권 1회).
// 은퇴한 커리어를 기록하면 보너스가 하나 예약되고, 다음 새 게임을 시작할 때 덱 선택권으로 받는다 (레전드 배지를 받은 커리어면 희귀).
// 커리어마다 한 번만 기록·지급한다 (key = 월드 시드 · 이름 · 시작 시즌)

import { BALANCE } from './config/balance';
import type { Rarity } from './config/cards';
import { grantTierPick } from './cardCollection';
import { careerTotals, type GameState } from './game';
import { reputationTier } from './growth';
import { endingScores } from './wealth';
import type { Position, Tier } from './types';

export interface HallEntry {
  key: string;
  name: string;
  position: Position;
  /** 은퇴 나이 · 마지막 시즌 */
  age: number;
  lastSeason: number;
  seasons: number;
  apps: number;
  goals: number;
  assists: number;
  peakOvr: number;
  reputation: number;
  tier: Tier;
  asset: number;
  badges: number;
  trophies: number;
  score: number;
}

export interface LegacyBonus { key: string; rarity: Rarity; from: string; legend: boolean }

export interface LegacyStore {
  hall: HallEntry[];
  /** 다음 새 게임에서 받을 보너스 (없으면 null) */
  bonus: LegacyBonus | null;
  /** 이미 기록한 커리어 (보너스를 다시 주지 않는다) */
  done: string[];
}

const KEY = 'po-legacy';
const L = () => BALANCE.legacy;
type Store = Pick<Storage, 'getItem' | 'setItem'>;

const empty = (): LegacyStore => ({ hall: [], bonus: null, done: [] });

export function loadLegacy(store?: Pick<Storage, 'getItem'> | null): LegacyStore {
  try {
    const raw = (store === undefined ? globalThis.localStorage : store)?.getItem(KEY);
    if (!raw) return empty();
    const o = JSON.parse(raw) as Partial<LegacyStore>;
    return { hall: Array.isArray(o.hall) ? o.hall : [], bonus: o.bonus ?? null, done: Array.isArray(o.done) ? o.done : [] };
  } catch {
    return empty();
  }
}

export function saveLegacy(x: LegacyStore, store?: Pick<Storage, 'setItem'> | null): void {
  try {
    (store === undefined ? globalThis.localStorage : store)?.setItem(KEY, JSON.stringify(x));
  } catch {
    // 저장소를 못 쓰면 명예의 전당 없이 진행
  }
}

export function careerKey(g: GameState): string {
  return `${g.worldSeed}:${g.player.name}:${g.player.history[0]?.season ?? g.league.season}`;
}

/** 커리어 점수 = 최종 위상 + 자산 점수 × assetW + 레전드 배지 × badgeW + 트로피 × trophyW + 통산 (골 + 도움) × gaW */
export function careerScore(e: Pick<HallEntry, 'reputation' | 'asset' | 'badges' | 'trophies' | 'goals' | 'assists'>): number {
  const w = L().score;
  return Math.round(e.reputation + e.asset * w.assetW + e.badges * w.badgeW + e.trophies * w.trophyW + (e.goals + e.assists) * w.gaW);
}

export function hallEntry(g: GameState): HallEntry {
  const p = g.player;
  const t = careerTotals(p);
  const trophies = (g.chapters?.list ?? []).reduce((n, c) => n + c.trophies.length, 0);
  const base = {
    key: careerKey(g), name: p.name, position: p.position, age: p.age, lastSeason: p.history.at(-1)?.season ?? g.league.season,
    seasons: t.seasons, apps: t.apps, goals: t.goals, assists: t.assists, peakOvr: t.peakOvr, reputation: p.reputation,
    tier: reputationTier(p.reputation, p.honors), asset: endingScores(g).asset, badges: (p.badges ?? []).length, trophies,
  };
  return { ...base, score: careerScore(base) };
}

/** 명예의 전당에 넣기 (같은 key 는 바꿔 넣기), 점수 순 상위 hallSize 개 */
export function addToHall(hall: readonly HallEntry[], e: HallEntry): HallEntry[] {
  return [...hall.filter((x) => x.key !== e.key), e].sort((a, b) => b.score - a.score || a.lastSeason - b.lastSeason).slice(0, L().hallSize);
}

/**
 * 은퇴한 커리어 기록 (은퇴 화면에 들어올 때): 명예의 전당 갱신 + 처음이면 새 게임 보너스 예약.
 * 돌려주는 값: 이번 커리어의 명예의 전당 순위(1~, 밖이면 null), 저장된 상태
 */
export function recordRetirement(g: GameState, store?: Store | null): { rank: number | null; legacy: LegacyStore } {
  if (g.phase !== 'retired') return { rank: null, legacy: loadLegacy(store) };
  const x = loadLegacy(store);
  const e = hallEntry(g);
  x.hall = addToHall(x.hall, e);
  if (!x.done.includes(e.key)) {
    x.done = [...x.done, e.key].slice(-50);
    const legend = e.badges > 0;
    x.bonus = { key: e.key, rarity: (legend ? L().bonus.legend : L().bonus.normal) as Rarity, from: e.name, legend };
  }
  saveLegacy(x, store);
  const i = x.hall.findIndex((h) => h.key === e.key);
  return { rank: i >= 0 ? i + 1 : null, legacy: x };
}

/** 새 게임 시작: 예약된 보너스를 덱 선택권 1회로 주고 지운다. 준 보너스를 돌려준다 */
export function claimNewGameBonus(g: GameState, store?: Store | null): LegacyBonus | null {
  const x = loadLegacy(store);
  const b = x.bonus;
  if (!b || !g.cards) return null;
  const ok = grantTierPick(g.cards, `legacy:${b.key}`, g.player.position, g.worldSeed, `명예의 전당 보너스 · ${b.from}`, { [b.rarity]: 1 }, 'legacy');
  if (!ok) return null;
  x.bonus = null;
  saveLegacy(x, store);
  return b;
}
