// 카드 모음과 덱 (부록 F.1·F.3·F.3.1·F.3.2, I.17 9번, C.36): 가진 카드, 덱 세트 3개, 숙련도, 역할 시그니처 해금, 간이 획득 경로.
// 경기 엔진은 덱(카드 id 목록)과 숙련도만 받는다 (src/engine/cards.ts). 덱 규칙: 8~14장, 같은 카드 2장, 세트피스 3장.

import { BALANCE } from './config/balance';
import { CARDS, cardById, starterDeck, type CardDef, type CardGroup, type Rarity } from './config/cards';
import type { CardInput, CardReport } from './engine/cards';
import { requirementProblem } from './engine/cards';
import { posGroup } from './roster';
import { createRng, hashSeed, type Rng } from './rng';
import type { FieldAttributes } from './attributes';

const C = BALANCE.cards;

export interface CardPick {
  /** season = 시즌 보상(옛 3단계 경로·면담), level = 레벨업, goal = 시즌 목표 (C.65), award = 업적 (C.65) */
  source: 'season' | 'level' | 'goal' | 'award';
  /** 표시 ("시즌 2026 보상", "레벨 10 달성") */
  label: string;
  options: string[];
}

export interface CardCollection {
  /** 가진 카드 장수 (최대 maxCopies) */
  owned: Record<string, number>;
  /** 덱 세트 3개 (카드 id, 중복 가능) */
  decks: string[][];
  /** 지금 쓰는 덱 (0~2) */
  active: number;
  /** 카드별 사용 횟수 (숙련도) */
  mastery: Record<string, number>;
  /** 역할별 출전 경기 수 (시그니처 해금, F.0 5번) */
  roleApps: Record<string, number>;
  /** 받을 카드 선택권 (시즌 종료 3택 1, 레벨업 5레벨마다) */
  picks: CardPick[];
  /** 레벨 선택권을 준 마지막 레벨 */
  levelMark: number;
  /** 새로 얻은 카드 (덱 화면 표시 후 비운다) */
  fresh: string[];
}

export type StarterGroup = Exclude<CardGroup, 'common'>;

export function groupOfPosition(pos: string): StarterGroup {
  const g = posGroup(pos as never);
  return g === 'ST' || g === 'WING' || g === 'CAM' ? 'attack' : g === 'CM' || g === 'CDM' ? 'midfield' : 'defense';
}

/** 새 커리어 (또는 옛 세이브 변환): 포지션군 시작 덱 8장 (F.0 11번), 덱 세트 3개 모두 같은 시작 덱 */
export function initCollection(position: string, level = 0): CardCollection {
  const deck = starterDeck(groupOfPosition(position)).map((c) => c.id);
  const owned: Record<string, number> = {};
  for (const id of deck) owned[id] = (owned[id] ?? 0) + 1;
  return {
    owned, decks: [[...deck], [...deck], [...deck]], active: 0, mastery: {}, roleApps: {}, picks: [],
    levelMark: Math.floor(level / C.levelEvery) * C.levelEvery, fresh: [],
  };
}

/** 덱 규칙 위반 (F.3): 없으면 빈 배열 */
export function deckProblems(deck: string[]): string[] {
  const out: string[] = [];
  if (deck.length < C.deckMin) out.push(`덱은 ${C.deckMin}장 이상이어야 해요 (지금 ${deck.length}장)`);
  if (deck.length > C.deckMax) out.push(`덱은 ${C.deckMax}장까지예요`);
  const count: Record<string, number> = {};
  for (const id of deck) count[id] = (count[id] ?? 0) + 1;
  for (const [id, n] of Object.entries(count)) if (n > C.maxCopies) out.push(`${cardById(id)?.name ?? id}는 ${C.maxCopies}장까지예요`);
  const sp = deck.filter((id) => cardById(id)?.kind === 'setPiece').length;
  if (sp > C.maxSetPiece) out.push(`세트피스 카드는 ${C.maxSetPiece}장까지예요`);
  return out;
}

/** 덱에 넣을 수 있는가 (가진 장수, 같은 카드 2장, 세트피스 3장, 14장) */
export function canAdd(col: CardCollection, deck: string[], id: string): string | null {
  const def = cardById(id);
  if (!def) return '없는 카드';
  if (def.inactiveUntil) return `${def.inactiveUntil}에 열려요`;
  if (deck.length >= C.deckMax) return `덱은 ${C.deckMax}장까지예요`;
  const n = deck.filter((x) => x === id).length;
  if (n >= (col.owned[id] ?? 0)) return '가진 장수를 다 넣었어요';
  if (n >= C.maxCopies) return `같은 카드는 ${C.maxCopies}장까지예요`;
  if (def.kind === 'setPiece' && deck.filter((x) => cardById(x)?.kind === 'setPiece').length >= C.maxSetPiece) return `세트피스는 ${C.maxSetPiece}장까지예요`;
  return null;
}

/** 지금 포지션·능력치·역할로 못 쓰는 카드와 이유 (덱 화면 회색, 홈 경고) */
export function unusableReason(def: CardDef, attrs: FieldAttributes, pos: string, role: string | undefined): string | null {
  return requirementProblem(def, attrs as unknown as Record<string, number>, pos, role);
}

/** 경기 엔진 입력: 지금 덱과 숙련도. 덱 규칙을 어기면 (옛 세이브 등) 앞에서부터 규칙에 맞게 자른다 */
export function cardInput(col: CardCollection): CardInput {
  const deck = col.decks[col.active] ?? [];
  const valid: string[] = [];
  for (const id of deck) if (canAdd({ ...col, owned: { ...col.owned, [id]: C.maxCopies } }, valid, id) === null) valid.push(id);
  return { deck: valid, mastery: { ...col.mastery } };
}

function addOwned(col: CardCollection, id: string): void {
  col.owned[id] = Math.min(C.maxCopies, (col.owned[id] ?? 0) + 1);
  if (!col.fresh.includes(id)) col.fresh.push(id);
}

/** 선택권 받기 */
export function takePick(col: CardCollection, idx: number, option: number): string | null {
  const pk = col.picks[idx];
  const id = pk?.options[option];
  if (!pk || !id) return null;
  addOwned(col, id);
  col.picks.splice(idx, 1);
  return id;
}

/** 후보 뽑기 (결정적): 이미 2장 가진 카드는 빼고, 내 포지션군·공용 카드 */
function drawOptions(pool: CardDef[], col: CardCollection, rng: Rng, n: number): string[] {
  const cands = pool.filter((c) => (col.owned[c.id] ?? 0) < C.maxCopies);
  const out: string[] = [];
  while (out.length < n && cands.length) {
    const i = Math.floor(rng() * cands.length);
    out.push(cands.splice(i, 1)[0]!.id);
  }
  return out;
}

function poolFor(group: StarterGroup, rarities: Rarity[]): CardDef[] {
  return CARDS.filter((c) => (c.group === 'common' || c.group === group) && c.kind !== 'signature' && c.kind !== 'directive' && rarities.includes(c.rarity));
}

/** 레벨업 5레벨마다 일반 카드 3택 1 (F.0 5번) */
export function grantLevelPicks(col: CardCollection, level: number, position: string, seed: string): void {
  while (level >= col.levelMark + C.levelEvery) {
    col.levelMark += C.levelEvery;
    const rng = createRng(hashSeed(`${seed}:card-level:${col.levelMark}`));
    const options = drawOptions(poolFor(groupOfPosition(position), ['common']), col, rng, C.pickOptions);
    if (options.length) col.picks.push({ source: 'level', label: `레벨 ${col.levelMark} 달성`, options });
  }
}

/** 감독 보상 면담 (C.62): 희귀 3택 1 (덱 슬롯은 이미 14장이라 "덱 슬롯 +1" 대신) */
export function grantMeetingPick(col: CardCollection, key: string, position: string, seed: string, label: string): void {
  const rng = createRng(hashSeed(`${seed}:card-meeting:${key}`));
  const options = drawOptions(poolFor(groupOfPosition(position), ['rare']), col, rng, C.pickOptions);
  if (options.length) col.picks.push({ source: 'season', label, options });
}

const RARITY_DOWN: Record<Rarity, Rarity | null> = { legendary: 'epic', epic: 'rare', rare: 'common', common: null };

/**
 * 희귀도 가중 3택 1 (C.65 시즌 목표·업적): 후보마다 가중대로 희귀도를 뽑고, 그 희귀도 풀(내 포지션군 + 공용)이 비면 한 단계씩 내린다.
 * 같은 key 는 같은 후보 (결정적). 후보가 하나도 없으면 선택권을 만들지 않는다
 */
export function grantTierPick(col: CardCollection, key: string, position: string, seed: string, label: string, weights: Partial<Record<Rarity, number>>, source: CardPick['source']): boolean {
  const rng = createRng(hashSeed(`${seed}:card-tier:${key}`));
  const g = groupOfPosition(position);
  const entries = Object.entries(weights).filter(([, w]) => (w ?? 0) > 0) as [Rarity, number][];
  const total = entries.reduce((t, [, w]) => t + w, 0);
  const options: string[] = [];
  for (let k = 0; k < C.pickOptions && entries.length; k++) {
    let x = rng() * total;
    let r: Rarity | null = entries.find(([, w]) => (x -= w) < 0)?.[0] ?? entries.at(-1)![0];
    let got: string | undefined;
    while (r && !got) {
      got = drawOptions(poolFor(g, [r]).filter((c) => !options.includes(c.id)), col, rng, 1)[0];
      r = RARITY_DOWN[r];
    }
    if (got) options.push(got);
  }
  if (!options.length) return false;
  col.picks.push({ source, label, options });
  return true;
}

/** 시즌 종료 보상: 희귀·에픽 3택 1 (F.1 간이 경로). 에픽은 후보마다 seasonEpicChance 확률. C.65부터 게임은 시즌 목표 보상(grantTierPick)을 쓰고 이 경로는 부르지 않는다 */
export function grantSeasonPick(col: CardCollection, season: number, position: string, seed: string): void {
  const rng = createRng(hashSeed(`${seed}:card-season:${season}`));
  const g = groupOfPosition(position);
  const rare = poolFor(g, ['rare']);
  const epic = poolFor(g, ['epic']);
  const options: string[] = [];
  for (let k = 0; k < C.pickOptions; k++) {
    const pool = (rng() < C.seasonEpicChance ? epic : rare).filter((c) => !options.includes(c.id));
    const got = drawOptions(pool.length ? pool : rare.filter((c) => !options.includes(c.id)), col, rng, 1);
    if (got[0]) options.push(got[0]);
  }
  if (options.length) col.picks.push({ source: 'season', label: `${season} 시즌 보상`, options });
}

/**
 * 경기 뒤 (playRound): 쓴 카드의 숙련도 +1, 그 역할 출전 +1 → 10경기면 역할 시그니처 해금 (덱에는 직접 넣는다).
 * 해금된 시그니처 id 를 돌려준다
 */
export function afterMatch(col: CardCollection, report: CardReport | undefined, role: string | undefined, played: boolean): string | null {
  for (const u of report?.uses ?? []) col.mastery[u.id] = (col.mastery[u.id] ?? 0) + 1;
  if (!played || !role) return null;
  col.roleApps[role] = (col.roleApps[role] ?? 0) + 1;
  const sig = `sig-${role}`;
  if (col.roleApps[role]! >= C.signatureUnlock && !col.owned[sig] && cardById(sig)) {
    addOwned(col, sig);
    return sig;
  }
  return null;
}

/** 시그니처 해금 진행 (역할 n/10경기) */
export function signatureProgress(col: CardCollection, role: string): { id: string; apps: number; need: number; unlocked: boolean } | null {
  const id = `sig-${role}`;
  if (!cardById(id)) return null;
  return { id, apps: col.roleApps[role] ?? 0, need: C.signatureUnlock, unlocked: (col.owned[id] ?? 0) > 0 };
}

export { createRng };
