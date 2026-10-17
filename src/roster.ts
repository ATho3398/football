// 팀 로스터 생성기 (23번, R단계)
// 팀당 24명. 실제 A등급 선수는 소속팀 슬롯을 차지하고 나머지는 가상 선수로 채운다.
// 로스터는 월드 시드로 재생성한다. 세이브에는 시즌 갱신 횟수만 담고 불러올 때 다시 만든다 (save.ts).

import { A_GRADE_PLAYERS } from '../data/players';
import { FAMOUS_FULL_NAMES, NAME_POOLS, NAME_POOLS_V1, type NamePool } from '../data/names';
import { realAppearance, rollAppearance, type Appearance } from './appearance';
import { FIELD_ATTRIBUTES, GK_ATTRIBUTES, type FieldAttributes, type GkAttribute, type GkAttributes, type GkType } from './attributes';
import { BALANCE } from './config/balance';
import { FORMATION_SLOTS, FORMATIONS, type Formation, type FormationSlot } from './formations';
import { agingRate, randInt, skillTier } from './growth';
import { CLUB_TO_TEAM } from './league';
import { growNpc, shiftOvr, type NpcState } from './npc';
import { attributeOvrWeight, positionOvr, positionOvrExact, profileOf, type FieldPosition } from './positions';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { Position, Tier } from './types';
import { TEAM_TACTICS } from './engine/teamData';
import { realBody, rollBody, type Body } from './body';
import { fixHomegrown, normalizeSquad } from './squad';

export type PosGroup = 'GK' | 'CB' | 'FB' | 'CDM' | 'CM' | 'CAM' | 'WING' | 'ST';
export const POS_GROUPS: readonly PosGroup[] = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];

export function posGroup(p: Position): PosGroup {
  switch (p) {
    case 'GK': return 'GK';
    case 'CB': return 'CB';
    case 'LB': case 'RB': case 'LWB': case 'RWB': return 'FB';
    case 'CDM': return 'CDM';
    case 'CM': return 'CM';
    case 'CAM': return 'CAM';
    case 'LW': case 'RW': case 'LM': case 'RM': return 'WING';
    case 'ST': case 'CF': return 'ST';
  }
}

/** 서로 가까운 포지션군 (라인업 선택 시 패널티가 작다) */
const NEAR: Record<PosGroup, readonly PosGroup[]> = {
  GK: [],
  CB: ['FB', 'CDM'],
  FB: ['CB', 'WING'],
  CDM: ['CB', 'CM'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'WING', 'ST'],
  WING: ['FB', 'CAM', 'ST'],
  ST: ['CAM', 'WING'],
};

export interface RosterPlayer {
  id: string;
  /** 실제 A등급 선수면 true. 능력치와 나이는 NpcState 에서 동기화한다 */
  real: boolean;
  name: string;
  nameKo: string;
  nationality: string;
  /** 외모군 (부록 C.43): 기본 얼굴 이미지 고르기. 선수 id 로 따로 뽑아 시드 흐름과 무관 */
  appearance: Appearance;
  /** 신체·양발 (부록 C.45). 가상 선수는 `body:<id>` 시드로 따로 뽑아 시드 흐름과 무관 */
  body?: Body;
  /** 등번호 (부록 C.45): 실제 선수는 데이터, 가상 선수는 포지션 관례대로 팀 안에서 겹치지 않게 */
  shirt?: number;
  age: number;
  /** 주 포지션 */
  position: Position;
  /** 필드 선수 능력치 (GK 는 빈 값 대신 gk 를 쓴다) */
  attributes?: FieldAttributes;
  gk?: { attrs: GkAttributes; type: GkType };
  potentialTier: Tier;
  peakOvr: number;
  peakAge: number;
  /** 숨김 (18.6) */
  loyalty: number;
  contractEnd: number;
  /** 입단 시즌 */
  joined: number;
  /** 자국 육성 자동 조정 표시 (부록 C.46): 비자국 육성 상한을 넘을 때 생성기·시즌 갱신이 붙인다 (어릴 때 잉글랜드 구단에서 큰 선수) */
  hg?: boolean;
}

export interface TeamRoster {
  teamId: string;
  formation: Formation;
  players: RosterPlayer[];
  /** 커스텀 포메이션 슬롯 (E.5.1, 내 팀 경기 때만 붙인다. 세이브에는 담지 않는다) */
  customSlots?: readonly FormationSlot[];
}

export type Rosters = Record<string, TeamRoster>;

export interface LineupSlot {
  playerId: string;
  /** 포메이션 슬롯 순서 (FORMATION_SLOTS 의 인덱스) */
  slot: number;
  pos: Position;
  ovr: number;
}

export interface Lineup {
  formation: Formation;
  slots: LineupSlot[];
  bench: string[];
  /** 라인업 11명 슬롯 OVR 평균 (소수) */
  rating: number;
}

/** 2018-19 팀별 포메이션 (부록 E.5 5종 중, E.19 AI 팀 전술 표). 없으면 시드로 고른다 */
export const TEAM_FORMATIONS: Record<string, Formation> = Object.fromEntries(
  Object.entries(TEAM_TACTICS).map(([id, t]) => [id, t.formation]),
);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rngFor = (...parts: (string | number)[]): Rng => createRng(hashSeed(parts.join(':')));

// ── OVR ──

export function gkOvrExact(attrs: GkAttributes, type: GkType): number {
  const w = BALANCE.goalkeeper.ovrWeights[type];
  return GK_ATTRIBUTES.reduce((t, a) => t + attrs[a] * w[a], 0);
}

export const gkOvr = (attrs: GkAttributes, type: GkType): number => Math.round(gkOvrExact(attrs, type));

/** 주 포지션 OVR */
export function naturalOvr(p: RosterPlayer): number {
  if (p.gk) return gkOvr(p.gk.attrs, p.gk.type);
  return positionOvr(p.attributes!, p.position as FieldPosition);
}

/** 그 슬롯 포지션에서의 OVR. 필드 선수가 GK 를 보면 fieldPlayerAsGk 능력치 */
export function slotOvr(p: RosterPlayer, pos: Position): number {
  if (pos === 'GK') return p.gk ? gkOvr(p.gk.attrs, p.gk.type) : gkOvr(BALANCE.goalkeeper.fieldPlayerAsGk, 'classic');
  if (p.gk) return 15;
  return positionOvr(p.attributes!, pos as FieldPosition);
}

// ── 능력치 생성 ──

/**
 * 포지션 + 목표 OVR 로 능력치 생성 (23번). 포지션 비중이 큰 능력치와 핵심 능력치는 높고 나머지는 낮다.
 * 가상 유망주 생성(prospect.ts)과 같은 방식이지만 상한을 두지 않아 고OVR 도 만든다
 */
export function attributesFromOvr(pos: FieldPosition, ovr: number, rng: Rng): FieldAttributes {
  const keys = profileOf(pos).keys;
  const weights = FIELD_ATTRIBUTES.map((a) => attributeOvrWeight(pos, a));
  const maxW = Math.max(...weights);
  const attrs = {} as FieldAttributes;
  FIELD_ATTRIBUTES.forEach((a, i) => {
    const relevance = weights[i]! / maxW;
    const base = ovr - 15 + relevance * 15 + (keys.includes(a) ? 4 : 0) + gaussian(rng) * 4;
    attrs[a] = Math.round(clamp(base, 20, 95));
  });
  // 가중치 합이 1이라 전 능력치에 같은 값을 더하면 OVR 도 그만큼 움직인다. 남은 차이만 shiftOvr 로
  for (let k = 0; k < 2; k++) {
    const off = Math.round(ovr - positionOvrExact(attrs, pos));
    if (off === 0) break;
    for (const a of FIELD_ATTRIBUTES) attrs[a] = clamp(attrs[a] + off, 1, BALANCE.growth.maxAttribute);
  }
  shiftOvr(attrs, pos, ovr - positionOvr(attrs, pos), rng);
  return attrs;
}

/** GK OVR 을 d 만큼 바꾼다. 가중치 큰 능력치일수록 자주 뽑힌다 */
export function shiftGk(attrs: GkAttributes, type: GkType, d: number, rng: Rng): void {
  if (d === 0) return;
  const w = BALANCE.goalkeeper.ovrWeights[type];
  const target = gkOvr(attrs, type) + d;
  for (let guard = 0; guard < 400 && gkOvr(attrs, type) !== target; guard++) {
    let r = rng();
    let a: GkAttribute = GK_ATTRIBUTES[0];
    for (const k of GK_ATTRIBUTES) {
      if (r < w[k]) { a = k; break; }
      r -= w[k];
    }
    attrs[a] = clamp(attrs[a] + Math.sign(d), 1, BALANCE.growth.maxAttribute);
  }
}

export function gkAttributesFromOvr(type: GkType, ovr: number, rng: Rng): GkAttributes {
  const w = BALANCE.goalkeeper.ovrWeights[type];
  const attrs = {} as GkAttributes;
  for (const a of GK_ATTRIBUTES) {
    attrs[a] = Math.round(clamp(ovr + (w[a] - 0.25) * 20 + gaussian(rng) * BALANCE.goalkeeper.attrSd, 20, 95));
  }
  shiftGk(attrs, type, ovr - gkOvr(attrs, type), rng);
  return attrs;
}

/** 선수의 주 포지션 OVR 을 d 만큼 바꾼다 */
function shiftPlayer(p: RosterPlayer, d: number, rng: Rng): void {
  if (p.gk) shiftGk(p.gk.attrs, p.gk.type, d, rng);
  else shiftOvr(p.attributes!, p.position as FieldPosition, d, rng);
}

/** 팀 실제 선수 능력치 기준 가상 선수 능력치 상한 (E.25). 실제 주전이 없으면 undefined */
export type AttrCap = Partial<FieldAttributes>;

/**
 * 능력치별 상한 = max(그 팀 실제 선수의 같은 능력치 최대값, floor). floor 는 가상 선수 OVR 상한(실제 주전 평균, C.20).
 * floor 가 없으면 실제 선수가 공격수뿐인 팀의 가상 수비수 태클·마킹이 공격수 수준으로 깎여 팀이 무너진다 (C.21: 아스널 79 → 68)
 */
export function realAttrMax(reals: RosterPlayer[], rating: number, floor: number): AttrCap | undefined {
  const field = reals.filter((p) => p.real && p.attributes);
  if (!field.some((p) => naturalOvr(p) >= rating - BALANCE.roster.virtualCapStarterGap)) return undefined;
  const max = {} as AttrCap;
  for (const a of FIELD_ATTRIBUTES) max[a] = Math.max(floor, ...field.map((p) => p.attributes![a]));
  return max;
}

/**
 * 가상 선수 능력치 상한 (E.25 1번): 각 능력치 ≤ 자기 OVR + virtualAttrOverOvr, teamMax 가 있으면 ≤ 그 값.
 * GK 는 GK 능력치끼리 본다 (실제 GK 데이터가 없어 팀 상한은 필드 능력치에만). 깎인 만큼 다른 능력치로 옮기지 않는다
 */
export function capVirtualAttributes(p: RosterPlayer, teamMax?: AttrCap): void {
  if (p.real) return;
  // 깎으면 OVR 이 내려가 상한도 내려가므로 더 깎을 것이 없을 때까지 반복한다 (단조 감소라 금방 멈춘다)
  for (let changed = true, k = 0; changed && k < 20; k++) {
    changed = false;
    const lim = naturalOvr(p) + BALANCE.roster.virtualAttrOverOvr;
    const vals: Record<string, number> = p.gk ? p.gk.attrs : p.attributes!;
    for (const a of Object.keys(vals)) {
      const v = Math.min(vals[a]!, lim, p.gk ? Infinity : teamMax?.[a as keyof AttrCap] ?? Infinity);
      if (v < vals[a]!) { vals[a] = v; changed = true; }
    }
  }
}

// ── 이름, 나이, 숨김 값 ──

/**
 * 이름 풀 판 (부록 C.45 8번). 1 = 옛 풀(세이브에 namePool 이 없는 옛 게임), 2 = 늘린 풀(새 게임).
 * 로스터를 만들거나 다시 만들기 전에 game.ts(newGame)·save.ts(migrate) 가 그 게임의 판으로 맞춘다
 */
export type NamePoolVersion = 1 | 2;
let namePoolVersion: NamePoolVersion = 2;

export function setNamePoolVersion(v: number | undefined): void {
  namePoolVersion = v === 1 ? 1 : 2;
}

export function getNamePoolVersion(): NamePoolVersion {
  return namePoolVersion;
}

/** 비교용 이름 키: 악센트·대소문자 무시 */
export function nameKey(name: string): string {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** 2판에서 피하는 실제 선수 풀네임 (게임 데이터 실제 선수 + 유명 선수 표) */
const BANNED_NAMES = new Set([...A_GRADE_PLAYERS.map((p) => p.name), ...FAMOUS_FULL_NAMES].map(nameKey));

/**
 * 풀에서 고른 이름 (판별). 2판은 실제 유명 선수와 풀네임이 같으면 같은 풀의 다음 성으로 넘긴다 (rng 를 더 쓰지 않는다)
 * 1판은 옛 결과 그대로
 */
export function nameFromPool(pool: NamePool, gi: number, fi: number, v: NamePoolVersion): { name: string; nameKo: string } {
  const [g, gKo] = pool.given[gi]!;
  let k = fi;
  if (v === 2) {
    for (let n = 0; n < pool.family.length && BANNED_NAMES.has(nameKey(`${g} ${pool.family[k]![0]}`)); n++) k = (k + 1) % pool.family.length;
  }
  const [f, fKo] = pool.family[k]!;
  return { name: `${g} ${f}`, nameKo: `${gKo} ${fKo}` };
}

/** rng 를 정확히 3번 쓴다 (풀 판과 무관 → 이름 말고 다른 생성 결과는 판이 달라도 같다) */
function pickName(rng: Rng): { name: string; nameKo: string; nationality: string } {
  const pools = namePoolVersion === 1 ? NAME_POOLS_V1 : NAME_POOLS;
  const total = pools.reduce((t, p) => t + p.weight, 0);
  let r = rng() * total;
  let pool = pools[0]!;
  for (const p of pools) {
    if (r < p.weight) { pool = p; break; }
    r -= p.weight;
  }
  const gi = Math.floor(rng() * pool.given.length);
  const fi = Math.floor(rng() * pool.family.length);
  return { ...nameFromPool(pool, gi, fi, namePoolVersion), nationality: pool.nationality };
}

function rollLoyalty(rng: Rng): number {
  const L = BALANCE.roster.loyalty;
  return Math.round(clamp(L.mean + gaussian(rng) * L.sd, 0, 100));
}

function setPeak(p: RosterPlayer, rng: Rng): void {
  const R = BALANCE.roster;
  const ovr = naturalOvr(p);
  const gain = p.age < p.peakAge
    ? Math.round((p.peakAge - p.age) * (R.youthGrowthPerSeason.min + rng() * (R.youthGrowthPerSeason.max - R.youthGrowthPerSeason.min)))
    : 0;
  p.peakOvr = Math.max(ovr, Math.min(R.maxPeak, ovr + gain));
  p.potentialTier = skillTier(p.peakOvr);
}

interface VirtualSpec {
  id: string;
  teamId: string;
  position: Position;
  age: number;
  ovr: number;
  season: number;
  /** 팀 실제 선수 능력치 최대값 (E.25) */
  teamMax?: AttrCap;
}

function makeVirtual(spec: VirtualSpec, rng: Rng): RosterPlayer {
  const R = BALANCE.roster;
  const G = BALANCE.goalkeeper;
  const ovr = Math.round(clamp(spec.ovr, 35, 95));
  const isGk = spec.position === 'GK';
  const type: GkType = rng() < G.sweeperChance ? 'sweeper' : 'classic';
  const peakAge = isGk ? randInt(rng, G.peakAge.min, G.peakAge.max) : randInt(rng, BALANCE.npc.peakAge.min, BALANCE.npc.peakAge.max);
  const p: RosterPlayer = {
    id: spec.id,
    real: false,
    ...pickName(rng),
    appearance: 'white',
    age: spec.age,
    position: spec.position,
    ...(isGk
      ? { gk: { attrs: gkAttributesFromOvr(type, ovr, rng), type } }
      : { attributes: attributesFromOvr(spec.position as FieldPosition, ovr, rng) }),
    potentialTier: 'normal',
    peakOvr: ovr,
    peakAge,
    loyalty: rollLoyalty(rng),
    contractEnd: spec.season + randInt(rng, R.contractYears.min, R.contractYears.max),
    joined: spec.season,
  };
  p.appearance = rollAppearance(`${p.id}:${p.name}`, p.nationality);
  p.body = rollBody(p.id, p.position);
  capVirtualAttributes(p, spec.teamMax);
  return p;
}

/**
 * 이적시장 빈자리 보충 가상 선수 (18.6, 부록 C.42). id 로 시드를 정해 세이브 재생성 때 같은 선수가 나온다.
 * 리그 밖 클럽에서 데려온 선수로 보여 준다
 */
export function makeFiller(id: string, teamId: string, position: Position, ovr: number, age: number, season: number, worldSeed: string): RosterPlayer {
  const rng = rngFor(worldSeed, 'filler', id);
  const p = makeVirtual({ id, teamId, position, age, ovr, season }, rng);
  setPeak(p, rng);
  return p;
}

function realEntry(n: NpcState, season: number, rng: Rng): RosterPlayer {
  return {
    id: n.id,
    real: true,
    name: n.name,
    nameKo: n.nameKo,
    nationality: '',
    appearance: realAppearance(n.id, ''),
    ...(realBody(n.id) ? { body: realBody(n.id) } : {}),
    ...(REAL_SHIRT.get(n.id) !== undefined ? { shirt: REAL_SHIRT.get(n.id) } : {}),
    age: n.age,
    position: n.position,
    attributes: { ...n.attributes },
    potentialTier: n.potentialTier,
    peakOvr: n.peakOvr,
    peakAge: n.peakAge,
    loyalty: rollLoyalty(rng),
    contractEnd: season + randInt(rng, BALANCE.roster.contractYears.min, BALANCE.roster.contractYears.max),
    joined: season,
  };
}

function rollAge(rng: Rng): number {
  const A = BALANCE.roster.age;
  return Math.round(clamp(A.mean + gaussian(rng) * A.sd, A.min, A.max));
}

// ── 등번호 (부록 C.45, pending 54 7) ──

const REAL_SHIRT = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p.shirtNumber]));

/** 포지션 관례 등번호 (앞에서부터 비어 있는 번호) */
const SHIRT_PREF: Record<PosGroup, readonly number[]> = {
  GK: [1, 13, 25, 31, 12, 30, 40],
  CB: [4, 5, 6, 15, 23, 26, 32, 33],
  FB: [2, 3, 12, 22, 24, 27, 29],
  CDM: [6, 8, 16, 18, 24, 28],
  CM: [8, 14, 16, 18, 20, 28],
  CAM: [10, 8, 20, 21, 22],
  WING: [7, 11, 17, 19, 27, 37],
  ST: [9, 10, 19, 21, 39, 29],
};

/** 그 팀에서 비어 있는 관례 번호 (없으면 2~99 중 첫 빈 번호) */
export function freeShirt(taken: ReadonlySet<number>, pos: Position): number {
  for (const n of SHIRT_PREF[posGroup(pos)]) if (!taken.has(n)) return n;
  for (let n = 2; n < 100; n++) if (!taken.has(n)) return n;
  return 99;
}

/**
 * 등번호 정리: 실제 선수 번호(데이터) 먼저, 나머지는 로스터 순서대로 포지션 관례 번호.
 * reserved 는 팀 밖에서 쓰는 번호 (내 선수). C.46: 지금 로스터만으로 정해진다 (진행 이력과 무관 → 세이브 재생성과 같은 번호)
 */
export function assignShirts(roster: TeamRoster, reserved: ReadonlySet<number> = new Set()): void {
  const taken = new Set<number>(reserved);
  const need: RosterPlayer[] = [];
  for (const p of roster.players) {
    const own = p.real ? REAL_SHIRT.get(p.id) : undefined;
    if (own !== undefined && !taken.has(own)) {
      p.shirt = own;
      taken.add(own);
    } else need.push(p);
  }
  for (const p of need) {
    p.shirt = freeShirt(taken, p.position);
    taken.add(p.shirt);
  }
}

// ── 라인업 ──

function selectionScore(p: RosterPlayer, pos: Position): number {
  const R = BALANCE.roster;
  const ovr = slotOvr(p, pos);
  const own = posGroup(p.position);
  const slot = posGroup(pos);
  if (own === slot) return ovr;
  return ovr - (NEAR[slot].includes(own) ? R.nearGroupPenalty : R.outOfGroupPenalty);
}

/** 슬롯별로 OVR 이 높은 선수가 선발 (23번). 선택 점수 내림차순 탐욕 배정. 벤치 7명은 포지션군별 */
export function pickLineup(roster: TeamRoster, exclude: ReadonlySet<string> = new Set()): Lineup {
  const slots = roster.customSlots ?? FORMATION_SLOTS[roster.formation];
  const pool = roster.players.filter((p) => !exclude.has(p.id));
  const pairs: { pi: number; si: number; score: number }[] = [];
  pool.forEach((p, pi) => slots.forEach((s, si) => pairs.push({ pi, si, score: selectionScore(p, s.pos) })));
  // 같은 점수면 선수 순서, 슬롯 순서 (결정성)
  pairs.sort((a, b) => b.score - a.score || a.pi - b.pi || a.si - b.si);
  const usedP = new Set<number>();
  const assigned: (LineupSlot | undefined)[] = slots.map(() => undefined);
  for (const { pi, si } of pairs) {
    if (usedP.has(pi) || assigned[si]) continue;
    const p = pool[pi]!;
    assigned[si] = { playerId: p.id, slot: si, pos: slots[si]!.pos, ovr: slotOvr(p, slots[si]!.pos) };
    usedP.add(pi);
  }
  const lineup = assigned.filter((x): x is LineupSlot => x !== undefined);

  // 벤치: GK 1, 수비/미드/공격 최소 2명씩, 남으면 OVR 순
  const B = BALANCE.roster.bench;
  const rest = pool.filter((_, i) => !usedP.has(i)).sort((a, b) => naturalOvr(b) - naturalOvr(a));
  const line = (p: RosterPlayer): keyof typeof B => {
    const g = posGroup(p.position);
    if (g === 'GK') return 'GK';
    if (g === 'CB' || g === 'FB') return 'DEF';
    if (g === 'CDM' || g === 'CM' || g === 'CAM') return 'MID';
    return 'ATT';
  };
  const bench: RosterPlayer[] = [];
  for (const k of Object.keys(B) as (keyof typeof B)[]) {
    bench.push(...rest.filter((p) => line(p) === k && !bench.includes(p)).slice(0, B[k]));
  }
  const benchSize = B.GK + B.DEF + B.MID + B.ATT;
  for (const p of rest) if (bench.length < benchSize && !bench.includes(p) && line(p) !== 'GK') bench.push(p);

  const rating = lineup.length ? lineup.reduce((t, s) => t + s.ovr, 0) / lineup.length : 0;
  return { formation: roster.formation, slots: lineup, bench: bench.map((p) => p.id), rating };
}

/** 팀 레이팅 = 라인업 11명 OVR 평균 (GK 포함), 소수 첫째 자리 */
export function rosterRating(roster: TeamRoster): number {
  return Math.round(pickLineup(roster).rating * 10) / 10;
}

// ── 생성 ──

interface TeamTarget {
  id: string;
  rating: number;
}

function squadPositions(formation: Formation, rng: Rng): Record<PosGroup, Position[]> {
  const sq = BALANCE.roster.squad;
  const wide = formation === '4-4-2' ? (['LM', 'RM'] as const) : (['LW', 'RW'] as const);
  const rep = (n: number, ...ps: Position[]) => Array.from({ length: n }, (_, i) => ps[i % ps.length]!);
  return {
    GK: rep(sq.GK, 'GK'),
    CB: rep(sq.CB, 'CB'),
    FB: rep(sq.FB, 'LB', 'RB'),
    CDM: rep(sq.CDM, 'CDM'),
    CM: rep(sq.CM, 'CM'),
    CAM: rep(sq.CAM, 'CAM'),
    WING: rep(sq.WING, wide[0], wide[1], rng() < 0.5 ? wide[0] : wide[1]),
    ST: rep(sq.ST, 'ST', 'ST', 'CF'),
  };
}

function formationDemand(formation: Formation): Record<PosGroup, number> {
  const d = Object.fromEntries(POS_GROUPS.map((g) => [g, 0])) as Record<PosGroup, number>;
  for (const s of FORMATION_SLOTS[formation]) d[posGroup(s.pos)]++;
  return d;
}

export function teamFormation(teamId: string, worldSeed: string): Formation {
  const f = TEAM_FORMATIONS[teamId];
  if (f) return f;
  const rng = rngFor(worldSeed, 'formation', teamId);
  return FORMATIONS[Math.floor(rng() * FORMATIONS.length)]!;
}

/** 팀 하나 생성. 실제 선수는 그 포지션군 슬롯을 먼저 차지한다 */
export function createTeamRoster(team: TeamTarget, worldSeed: string, season: number, reals: NpcState[]): TeamRoster {
  const R = BALANCE.roster;
  const rng = rngFor(worldSeed, 'roster', team.id, season);
  const formation = teamFormation(team.id, worldSeed);
  const positions = squadPositions(formation, rng);
  const demand = formationDemand(formation);

  const realByGroup = Object.fromEntries(POS_GROUPS.map((g) => [g, [] as NpcState[]])) as Record<PosGroup, NpcState[]>;
  for (const n of reals) realByGroup[posGroup(n.position)].push(n);
  // 그룹별 가상 선수 수. 실제 선수가 넘치면 수요 대비 여유가 가장 큰 그룹에서 줄여 24명을 지킨다
  const virtualCount = Object.fromEntries(
    POS_GROUPS.map((g) => [g, Math.max(0, positions[g].length - realByGroup[g].length)]),
  ) as Record<PosGroup, number>;
  const squadSize = POS_GROUPS.reduce((t, g) => t + positions[g].length, 0);
  let total = reals.length + POS_GROUPS.reduce((t, g) => t + virtualCount[g], 0);
  while (total > squadSize) {
    const g = [...POS_GROUPS]
      .filter((x) => x !== 'GK' && virtualCount[x] > 0)
      .sort((a, b) => (virtualCount[b] + realByGroup[b].length - demand[b]) - (virtualCount[a] + realByGroup[a].length - demand[a]))[0];
    if (!g) break;
    virtualCount[g]--;
    total--;
  }

  const players: RosterPlayer[] = [];
  const realEntries = new Map(POS_GROUPS.flatMap((g) => realByGroup[g]).map((real) => [real.id, realEntry(real, season, rng)] as const));
  // 가상 선수 OVR 상한 (E.24 3번): 실제 주전(팀 레이팅 − virtualCapStarterGap 이상)이 있는 팀은 그 평균 OVR 을 넘지 않는다
  const realStarters = [...realEntries.values()].map(naturalOvr).filter((v) => v >= team.rating - R.virtualCapStarterGap);
  const cap = R.virtualCapToReal && realStarters.length
    ? Math.floor(realStarters.reduce((t, v) => t + v, 0) / realStarters.length)
    : Infinity;
  // 능력치 상한 (E.25 1번): 실제 주전이 있는 팀은 실제 선수 같은 능력치 최대값 (단 OVR 상한 아래로는 깎지 않는다)
  const teamMax = cap === Infinity ? undefined : realAttrMax([...realEntries.values()], team.rating, cap);
  let n = 0;
  for (const g of POS_GROUPS) {
    for (const real of realByGroup[g]) players.push(realEntries.get(real.id)!);
    const r = realByGroup[g].length;
    for (let i = 0; i < virtualCount[g]; i++) {
      const rank = r + i;
      const d = demand[g];
      const [off, sd] = rank < d ? [R.starterOffset, R.starterSd]
        : rank < 2 * d || d === 0 ? [R.backupOffset, R.backupSd]
        : [R.reserveOffset, R.reserveSd];
      const position = positions[g][rank % positions[g].length]!;
      players.push(makeVirtual(
        { id: `v:${team.id}:${n++}`, teamId: team.id, position, age: rollAge(rng), ovr: Math.min(cap, team.rating + off + gaussian(rng) * sd), season, teamMax },
        rng,
      ));
    }
  }
  const roster: TeamRoster = { teamId: team.id, formation, players };
  fitRating(roster, team.rating, rng, cap, teamMax);
  for (const p of players) if (!p.real) setPeak(p, rng);
  addU21Prospects(roster, team, worldSeed, season, cap, teamMax);
  fixHomegrown(roster);
  assignShirts(roster);
  return roster;
}

/**
 * 21세 이하 추가 유망주 (부록 C.46, PL 25 + 21세 이하): 기본 24명 뒤에 0~3명. 별도 시드라 기본 24명은 그대로이고,
 * OVR 이 낮아 라인업에 들지 않으니 팀 레이팅도 그대로다
 */
function addU21Prospects(roster: TeamRoster, team: TeamTarget, worldSeed: string, season: number, cap: number, teamMax?: AttrCap): void {
  const S = BALANCE.squad;
  const rng = rngFor(worldSeed, 'u21', team.id, season);
  const n = randInt(rng, S.extraU21[0], S.extraU21[1]);
  const groups: PosGroup[] = ['CB', 'CM', 'WING', 'ST', 'FB', 'CAM', 'CDM'];
  for (let i = 0; i < n; i++) {
    const g = groups[Math.floor(rng() * groups.length)]!;
    const position: Position = g === 'FB' ? (rng() < 0.5 ? 'LB' : 'RB') : g === 'WING' ? (rng() < 0.5 ? 'LW' : 'RW') : (g as Position);
    const age = randInt(rng, S.extraAge[0], S.extraAge[1]);
    const ovr = Math.min(cap, team.rating + S.extraOffset + gaussian(rng) * S.extraSd);
    const p = makeVirtual({ id: `v:${team.id}:u${i}`, teamId: team.id, position, age, ovr, season, teamMax }, rng);
    setPeak(p, rng);
    roster.players.push(p);
  }
}

/** 라인업 평균이 목표 ±fitTolerance 가 될 때까지 가상 주전의 OVR 을 조정. 올릴 때는 cap 을 넘기지 않는다 (못 맞추면 목표보다 낮게 둔다) */
function fitRating(roster: TeamRoster, target: number, rng: Rng, cap = Infinity, teamMax?: AttrCap): void {
  const R = BALANCE.roster;
  for (let it = 0; it < R.fitIterations; it++) {
    const lu = pickLineup(roster);
    const diff = target - lu.rating;
    if (Math.abs(diff) <= R.fitTolerance) break;
    const starters = lu.slots
      .map((s) => roster.players.find((p) => p.id === s.playerId)!)
      .filter((p) => !p.real && (diff < 0 || naturalOvr(p) < cap));
    if (!starters.length) break;
    let units = Math.round(diff * lu.slots.length);
    if (units === 0) units = Math.sign(diff);
    const per = Math.trunc(units / starters.length);
    let extra = Math.abs(units % starters.length);
    // 매번 같은 선수만 움직이지 않도록 시작 위치를 바꾼다
    const start = it % starters.length;
    starters.forEach((_, k) => {
      const p = starters[(start + k) % starters.length]!;
      const d = per + (extra > 0 ? Math.sign(units) : 0);
      if (extra > 0) extra--;
      shiftPlayer(p, d > 0 ? Math.min(d, cap - naturalOvr(p)) : d, rng);
      capVirtualAttributes(p, teamMax);
    });
  }
  // 능력치 조정의 반올림으로 상한을 넘은 가상 선수는 상한으로 되돌린다
  for (const p of roster.players) {
    if (p.real) continue;
    for (let k = 0; cap !== Infinity && k < 3 && naturalOvr(p) > cap; k++) shiftPlayer(p, cap - naturalOvr(p), rng);
    capVirtualAttributes(p, teamMax);
  }
}

/** 리그 전체 로스터. reals 는 내 선수를 뺀 실제 A등급 NPC (리그 밖 클럽 선수는 무시) */
export function createRosters(worldSeed: string, season: number, teams: TeamTarget[], npcs: NpcState[]): Rosters {
  const out: Rosters = {};
  for (const t of teams) {
    const reals = npcs.filter((n) => !n.retired && CLUB_TO_TEAM[n.club] === t.id);
    out[t.id] = createTeamRoster(t, worldSeed, season, reals);
  }
  return out;
}

// ── 시즌 갱신 (5.6 성장/노화, 은퇴 보충) ──

/** 가상 필드 선수 성장: NPC 성장 곡선(growNpc)을 그대로 쓴다 */
function growVirtualField(p: RosterPlayer, worldSeed: string, season: number): RosterPlayer {
  const n: NpcState = {
    id: p.id, name: p.name, nameKo: p.nameKo, club: '', position: p.position as FieldPosition, age: p.age,
    potentialTier: p.potentialTier, peakOvr: p.peakOvr, peakAge: p.peakAge, attributes: { ...p.attributes! },
    lastChange: 0, retired: false,
  };
  const g = growNpc(n, worldSeed, season);
  return { ...p, age: g.age, attributes: g.attributes };
}

function growVirtualGk(p: RosterPlayer, worldSeed: string, season: number): RosterPlayer {
  const N = BALANCE.npc;
  const G = BALANCE.goalkeeper;
  const rng = rngFor(worldSeed, 'gk-growth', p.id, season);
  const attrs = { ...p.gk!.attrs };
  const ovr = gkOvr(attrs, p.gk!.type);
  let d: number;
  if (p.age < p.peakAge) {
    d = Math.min(N.maxSeasonGain, Math.max(0, p.peakOvr - ovr) / (p.peakAge - p.age)) + gaussian(rng) * N.seasonLuck;
  } else {
    d = -agingRate(G.aging, p.age) + gaussian(rng) * N.seasonLuck * 0.5;
  }
  shiftGk(attrs, p.gk!.type, Math.round(d), rng);
  return { ...p, age: p.age + 1, gk: { ...p.gk!, attrs } };
}

function retires(p: RosterPlayer, rng: Rng): boolean {
  if (p.age >= BALANCE.retirement.forcedAge) return true;
  return rng() < agingRate(BALANCE.roster.retireChance, p.age);
}

/** 은퇴 자리 보충: 같은 포지션의 가상 신인. 전성기 OVR 은 팀 장기 평균 레이팅 근처 */
function makeRookie(teamId: string, position: Position, baseRating: number, worldSeed: string, season: number, k: number): RosterPlayer {
  const K = BALANCE.roster.rookie;
  const rng = rngFor(worldSeed, 'rookie', teamId, season, k);
  const age = randInt(rng, K.minAge, K.maxAge);
  const peak = Math.round(Math.min(BALANCE.roster.maxPeak, baseRating + K.peakOffset + gaussian(rng) * K.peakSd));
  const yearsToPeak = Math.max(0, 27 - age);
  const ovr = Math.max(K.minOvr, Math.round(peak - yearsToPeak * (1 + rng())));
  const p = makeVirtual({ id: `v:${teamId}:${season + 1}:${k}`, teamId, position, age, ovr, season: season + 1 }, rng);
  p.peakOvr = Math.max(ovr, peak);
  p.potentialTier = skillTier(p.peakOvr);
  return p;
}

/**
 * 시즌 종료 갱신. npcs 는 이번 시즌 성장(growNpc)을 마친 실제 선수 목록.
 * 가상 선수 성장/노화 → 은퇴(가상: 확률, 실제: NpcState.retired) → 신인 보충 → 재계약
 */
export function updateRostersForSeason(
  rosters: Rosters, worldSeed: string, season: number, baseRatings: Record<string, number>, npcs: NpcState[],
): Rosters {
  const R = BALANCE.roster;
  const byId = new Map(npcs.map((n) => [n.id, n]));
  const out: Rosters = {};
  for (const [teamId, roster] of Object.entries(rosters)) {
    const rng = rngFor(worldSeed, 'roster-season', teamId, season);
    let k = 0;
    const players: RosterPlayer[] = [];
    for (const p of roster.players) {
      let next: RosterPlayer;
      let retired: boolean;
      if (p.real) {
        const n = byId.get(p.id);
        retired = !n || n.retired;
        next = n ? { ...p, age: n.age, attributes: { ...n.attributes } } : p;
      } else {
        next = p.gk ? growVirtualGk(p, worldSeed, season) : growVirtualField(p, worldSeed, season);
        retired = retires(next, rng);
      }
      if (retired) {
        players.push(makeRookie(teamId, p.position, baseRatings[teamId] ?? 70, worldSeed, season, k++));
        continue;
      }
      if (next.contractEnd <= season + 1) next = { ...next, contractEnd: season + 1 + randInt(rng, R.renewYears.min, R.renewYears.max) };
      players.push(next);
    }
    out[teamId] = { ...roster, players };
    // 리그 인원 규칙 (C.46): 넘치면 가장 낮은 순위 방출, 모자라면 보충, 비자국 육성 상한
    normalizeSquad(out[teamId]!, (pos, j) => makeRookie(teamId, pos, baseRatings[teamId] ?? 70, worldSeed, season, 100 + j));
    assignShirts(out[teamId]!);
  }
  return out;
}

/** 실제 선수 항목의 능력치와 나이를 NpcState 와 맞춘다 */
export function syncRealPlayers(rosters: Rosters, npcs: NpcState[]): void {
  const byId = new Map(npcs.map((n) => [n.id, n]));
  for (const r of Object.values(rosters)) {
    for (const p of r.players) {
      const n = p.real ? byId.get(p.id) : undefined;
      if (n) {
        p.age = n.age;
        p.attributes = { ...n.attributes };
      }
    }
  }
}

export function teamRatings(rosters: Rosters): Record<string, number> {
  return Object.fromEntries(Object.entries(rosters).map(([id, r]) => [id, rosterRating(r)]));
}

export function findRosterPlayer(rosters: Rosters, id: string): { teamId: string; player: RosterPlayer } | null {
  for (const r of Object.values(rosters)) {
    const p = r.players.find((x) => x.id === id);
    if (p) return { teamId: r.teamId, player: p };
  }
  return null;
}
