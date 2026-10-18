// 도트 선수 아이콘 (부록 C.45, docs/design/pixel-kits.md): 경기 화면 캐릭터 보기의 인물(피부·머리)과 유니폼(홈·원정·GK) 고르기.
// 순수 로직 (화면·이미지 없음). 선수에는 인물만, 구단·대표팀에는 유니폼만 두고 경기마다 유니폼을 골라 입힌다.
// 난수는 `pixel:<선수 id>` 시드로 따로 만들어 경기 시드 흐름을 건드리지 않는다. 겉모습만이라 경기 결과에 영향이 없다
// 우선순위: 사용자 지정(GameState.pixelOverrides) > 실제 선수·구단 표 > 자동 규칙

import { CLUB_KITS, NATION_KITS, type KitPair } from '../data/kits';
import { PIXEL_KITS, PIXEL_PEOPLE } from '../data/pixelPack';
import { REAL_PIXEL_LOOK } from '../data/players/pixelLook';
import { TEAM_COLORS } from '../data/teamColors';
import type { Appearance } from './appearance';
import { BALANCE } from './config/balance';
import { createRng, hashSeed, type Rng } from './rng';

export interface PixelPerson { skin: string; hair: string }

/** 세이브 `pixelOverrides` (바꾼 것만) */
export interface PixelOverrides {
  players: Record<string, PixelPerson>;
  kits: Record<string, { home?: string; away?: string }>;
}

/** 경기 하나의 유니폼 (팩 유니폼 id, 예 C01·S05) */
export interface MatchKits { home: string; away: string; homeGk: string; awayGk: string }

/** 피부 → 가능한 머리 (팩 기준) */
export type PeopleTable = Readonly<Record<string, readonly string[]>>;

export const personKey = (p: PixelPerson): string => `${p.skin}_${p.hair}`;

/** 팩의 인물 14종 (피부 순, 머리 순) */
export function allPeople(people: PeopleTable = PIXEL_PEOPLE): PixelPerson[] {
  return Object.entries(people).flatMap(([skin, hairs]) => hairs.map((hair) => ({ skin, hair })));
}

/** 단색 유니폼 (C01~C11) */
export const SOLID_KITS: readonly string[] = Object.keys(PIXEL_KITS).filter((k) => k.startsWith('C')).sort();
export const ALL_KITS: readonly string[] = Object.keys(PIXEL_KITS).sort();

/**
 * 없는 조합 대체 (3.3): black+brown → black+black, mideast+blonde → mideast+brown, 그 밖에는 같은 피부의 첫 머리.
 * 피부가 팩에 없으면 white(없으면 첫 피부)
 */
export function validPerson(p: PixelPerson, people: PeopleTable = PIXEL_PEOPLE): PixelPerson {
  const skins = Object.keys(people);
  const skin = people[p.skin] ? p.skin : people.white ? 'white' : skins[0] ?? 'white';
  const hairs = people[skin] ?? [];
  if (hairs.includes(p.hair)) return { skin, hair: p.hair };
  const sub = BALANCE.pixelLook.missing[`${skin}_${p.hair}`];
  if (sub && hairs.includes(sub)) return { skin, hair: sub };
  return { skin, hair: hairs[0] ?? p.hair };
}

function pick(rng: Rng, dist: Readonly<Record<string, number>>): string | undefined {
  const entries = Object.entries(dist).filter(([, w]) => w > 0);
  const total = entries.reduce((t, [, w]) => t + w, 0);
  let r = rng() * total;
  for (const [k, w] of entries) {
    if (r < w) return k;
    r -= w;
  }
  return entries[0]?.[0];
}

/** 외모군 → 피부 (선수 id 시드). 외모군을 모르면 white */
function rollSkin(rng: Rng, appearance: Appearance | undefined): string {
  return (appearance && pick(rng, BALANCE.pixelLook.skin[appearance])) || 'white';
}

function hairDist(appearance: Appearance | undefined, skin: string): Readonly<Record<string, number>> {
  const P = BALANCE.pixelLook;
  return (appearance ? P.hair[appearance]?.[skin] : undefined) ?? P.hairBySkin[skin] ?? { black: 1 };
}

/** 자동 규칙 (가상 선수, 3.2): 외모군에서 피부, 피부별 분포에서 머리. 같은 id 는 늘 같은 결과 */
export function rollPerson(id: string, appearance: Appearance | undefined, people: PeopleTable = PIXEL_PEOPLE): PixelPerson {
  const rng = createRng(hashSeed(`pixel:${id}`));
  const skin = rollSkin(rng, appearance);
  return validPerson({ skin, hair: pick(rng, hairDist(appearance, skin)) ?? 'black' }, people);
}

/** 그 피부의 기본 머리 (생성 화면 기본값): 같은 시드의 분포 추첨 */
export function defaultHair(id: string, appearance: Appearance | undefined, skin: string, people: PeopleTable = PIXEL_PEOPLE): string {
  const rng = createRng(hashSeed(`pixel:${id}`));
  rollSkin(rng, appearance);
  return validPerson({ skin, hair: pick(rng, hairDist(appearance, skin)) ?? 'black' }, people).hair;
}

/** 내 선수 피부 (외모군 → 피부, 같은 시드) */
export function skinOf(id: string, appearance: Appearance | undefined): string {
  return rollSkin(createRng(hashSeed(`pixel:${id}`)), appearance);
}

export interface PersonOpts {
  overrides?: PixelOverrides | undefined;
  /** 실제 선수 표 (기본 data/players/pixelLook.ts) */
  real?: Readonly<Record<string, PixelPerson>>;
  /** 내 선수가 고른 머리 (PlayerState.pixelHair) */
  hair?: string | undefined;
  /** 내 가상 선수 피부 (C.73c): 고른 인종 피부로 고정 (외모군 분포 추첨 대신) */
  skin?: string | undefined;
  people?: PeopleTable;
}

/** 자동 인물 (사용자 지정 없이): 실제 선수 표 > 내 선수 머리 > 외모군 분포 */
export function autoPerson(id: string, appearance: Appearance | undefined, opts: PersonOpts = {}): PixelPerson {
  const people = opts.people ?? PIXEL_PEOPLE;
  const real = (opts.real ?? REAL_PIXEL_LOOK)[id];
  if (real) return validPerson(real, people);
  if (opts.skin) return validPerson({ skin: opts.skin, hair: opts.hair ?? defaultHair(id, appearance, opts.skin, people) }, people);
  if (opts.hair) return validPerson({ skin: skinOf(id, appearance), hair: opts.hair }, people);
  return rollPerson(id, appearance, people);
}

/** 선수 → 인물: 사용자 지정 > 실제 선수 표 > 자동 */
export function personOf(id: string, appearance: Appearance | undefined, opts: PersonOpts = {}): PixelPerson {
  const own = opts.overrides?.players?.[id];
  if (own) return validPerson(own, opts.people ?? PIXEL_PEOPLE);
  return autoPerson(id, appearance, opts);
}

// ── 유니폼 ──

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const colorDist = (a: string, b: string): number => {
  const x = rgb(a);
  const y = rgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};
const kitMean = (k: string): string => PIXEL_KITS[k]?.mean ?? '#808080';

/** 두 유니폼의 색 거리 (몸통 픽셀 평균색 RGB 거리) */
export function kitDistance(a: string, b: string): number {
  return colorDist(kitMean(a), kitMean(b));
}

/**
 * 몸통 색이 겹쳐 보이는 경기인가 (C.54 디자인 139 kitClash): 평균색 거리로는 갈렸어도(matchKits) 두 유니폼 몸통 색 중
 * 가장 가까운 두 색의 RGB 거리가 BALANCE.pixelLook.clashBody 보다 작으면 겹친다 (예: 흑백 줄무늬 vs 검정). 화면만 쓴다 — 원정 몸통에 주황 테두리
 */
export function kitClash(home: string, away: string): boolean {
  const cols = (k: string) => [...(PIXEL_KITS[k]?.colors ?? []), kitMean(k)];
  const b = cols(away);
  return Math.min(...cols(home).flatMap((x) => b.map((y) => colorDist(x, y)))) < BALANCE.pixelLook.clashBody;
}

const isKit = (k: string | undefined): k is string => !!k && !!PIXEL_KITS[k];

function nearestSolid(color: string): string {
  return SOLID_KITS.reduce((best, k) => (colorDist(kitMean(k), color) < colorDist(kitMean(best), color) ? k : best), SOLID_KITS[0]!);
}
function farthestSolid(fromKit: string): string {
  return SOLID_KITS.reduce((best, k) => (kitDistance(k, fromKit) > kitDistance(best, fromKit) ? k : best), SOLID_KITS[0]!);
}

/** 표에 없는 팀: 팀 주 색과 가장 가까운 단색이 홈, 홈과 가장 먼 단색이 원정. 색을 모르면 흰/검정 */
export function autoKit(teamId: string): KitPair {
  const color = TEAM_COLORS[teamId]?.[0];
  if (!color) return { ...BALANCE.pixelLook.fallbackKit };
  const home = nearestSolid(color);
  return { home, away: farthestSolid(home) };
}

/** 자동 유니폼 (사용자 지정 없이): 구단 표 > 대표팀 표(`n:<국가>`) > 팀 색 */
export function tableKit(teamId: string): KitPair {
  const t = CLUB_KITS[teamId] ?? (teamId.startsWith('n:') ? NATION_KITS[teamId.slice(2)] : undefined);
  return t ? { ...t } : autoKit(teamId);
}

/** 팀 → 홈·원정: 사용자 지정 > 표 > 자동 */
export function kitFor(teamId: string, overrides?: PixelOverrides): KitPair {
  const base = tableKit(teamId);
  const o = overrides?.kits?.[teamId];
  return { home: isKit(o?.home) ? o.home : base.home, away: isKit(o?.away) ? o.away : base.away };
}

/**
 * 경기 유니폼 (4번): 홈 팀은 홈. 원정 팀은 홈, 단 홈 팀 유니폼과 기준보다 가까우면 원정, 원정도 가까우면 홈 팀과 가장 먼 단색.
 * GK는 BALANCE.pixelLook.gkOrder 순서(그다음 나머지 단색)로 양 팀 필드 유니폼·상대 GK와 모두 기준 이상 떨어진 첫 번째(홈 GK 먼저). 없으면 가장 덜 겹치는 것
 */
export function matchKits(homeTeamId: string, awayTeamId: string, overrides?: PixelOverrides): MatchKits {
  const clash = BALANCE.pixelLook.clashDistance;
  const H = kitFor(homeTeamId, overrides);
  const A = kitFor(awayTeamId, overrides);
  const home = H.home;
  const away = kitDistance(A.home, home) >= clash ? A.home : kitDistance(A.away, home) >= clash ? A.away : farthestSolid(home);
  const gk = (avoid: string[]): string => {
    const order = BALANCE.pixelLook.gkOrder.filter(isKit);
    // 순서표에서 못 찾으면(예: 맨시티 하늘 vs 원정 남색 + 상대 GK 노랑) 나머지 단색도 본다, 그래도 없으면 가장 덜 겹치는 것
    const pool = [...order, ...SOLID_KITS.filter((k) => !order.includes(k))];
    const ok = pool.find((k) => avoid.every((x) => kitDistance(k, x) >= clash));
    if (ok) return ok;
    const score = (k: string) => Math.min(...avoid.map((x) => kitDistance(k, x)));
    return pool.reduce((best, k) => (score(k) > score(best) ? k : best), pool[0]!);
  };
  const homeGk = gk([home, away]);
  const awayGk = gk([home, away, homeGk]);
  return { home, away, homeGk, awayGk };
}

// ── 사용자 지정 고치기 (설정 → 경기 아이콘) ──

export function emptyOverrides(): PixelOverrides {
  return { players: {}, kits: {} };
}

/** 선수 인물 지정. person 이 없으면 자동으로 되돌리기 */
export function setPersonOverride(o: PixelOverrides, id: string, person: PixelPerson | null): void {
  if (person) o.players[id] = { skin: person.skin, hair: person.hair };
  else delete o.players[id];
}

/** 팀 유니폼 지정 (홈·원정 한쪽). kit 이 없으면 그쪽을 표·자동으로 되돌리기 */
export function setKitOverride(o: PixelOverrides, teamId: string, side: 'home' | 'away', kit: string | null): void {
  const cur = { ...(o.kits[teamId] ?? {}) };
  if (kit && isKit(kit)) cur[side] = kit;
  else delete cur[side];
  if (cur.home || cur.away) o.kits[teamId] = cur;
  else delete o.kits[teamId];
}
