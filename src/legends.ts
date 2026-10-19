// 레전드 팩 (pending 63, 부록 C.47): 2020년 말까지 은퇴한 레전드를 2018-19 세계에 15~22세로 넣는다.
// 데이터(data/players/legends.ts)는 전성기 능력치. 시작 능력치는 나이로 정한 모자람(startGap)만큼 낮추고 전성기 나이(29)에 전성기 OVR 로 자라게 한다.
// 소속 = 실제 유스·첫 프로 구단이 PL 팀이면 그 팀, 아니면 그 구단 수준에 가까운 PL 팀 (리그 밖 구단은 로스터가 없어 경기에 나오지 않는다).
// 모두 시드(`legend:<시드>:<id>`)로 따로 뽑아 기존 시드 흐름과 무관하다: 끄면 세계가 그대로다

import { FUTURE_STARS, LEGENDS, type FutureEntry, type LeagueId, type LegendData } from '../data/players/legends';
import { OUTSIDE_BY_ID } from '../data/outsideClubs';
import { A_GRADE_PLAYERS } from '../data/players';
import { ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes, type GkAttributes, type GkType } from './attributes';
import { rollAppearance } from './appearance';
import { BALANCE } from './config/balance';
import { agingRate, randInt } from './growth';
import { shiftOvr } from './npc';
import { positionOvr, type FieldPosition } from './positions';
import { createRng, hashSeed, type Rng } from './rng';
import { shiftGk, type RosterPlayer } from './roster';
import type { Position } from './types';

export { FUTURE_STARS, LEGENDS, type FutureEntry, type LegendData };

/** 레전드 팩 판 (C.75x): 1 = C.47 117명 (옛 세이브), 2 = + 도르트문트 레전드 (새 게임). 미래 스타는 따로 "미래 스타 팩" (C.75y) */
export const LEGEND_PACK = 2;

/** 그 판에서 처음부터 들어오는 레전드 */
export const packLegends = (pack: number = LEGEND_PACK): readonly LegendData[] => (pack >= 2 ? LEGENDS : LEGENDS.filter((l) => !l.group));

/** 게임에 구현된 리그 (C.75y): 미래 스타는 이 리그들의 첫 시즌에 등장. 타리그 패치가 리그를 켜면 여기에 더한다 */
export const IMPLEMENTED_LEAGUES: readonly LeagueId[] = ['pl'];

/**
 * 레전드 팩 2판에 든 선수와 같은 사람인 실제 선수 id (C.75x): 팩을 켜면 현역 로스터에서 뺀다 (중복 금지).
 * 지금 실제 선수 34명 중 해당자는 없다 (타리그 단계에 선수 풀이 늘면 이름으로 걸러진다)
 */
export function packRealExcludes(pack: number, future = false): ReadonlySet<string> {
  const pool = [...(pack >= 2 ? LEGENDS : []), ...(future ? FUTURE_STARS : [])];
  if (!pool.length) return new Set();
  const names = new Set(pool.map((l) => normName(l.name)));
  return new Set(A_GRADE_PLAYERS.filter((p) => names.has(normName(p.name))).map((p) => p.id));
}

const normName = (n: string): string => n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');

export const LEGEND_BY_ID: ReadonlyMap<string, LegendData> = new Map([...LEGENDS, ...FUTURE_STARS].map((l) => [l.id, l]));

export const isLegendId = (id: string | undefined): boolean => !!id && LEGEND_BY_ID.has(id);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export interface LegendPeak {
  attributes?: FieldAttributes;
  gk?: { attrs: GkAttributes; type: GkType };
  ovr: number;
}

const PEAK_CACHE = new Map<string, LegendPeak>();

/** 전성기 능력치·OVR */
export function legendPeak(l: LegendData): LegendPeak {
  const hit = PEAK_CACHE.get(l.id);
  if (hit) return hit;
  let out: LegendPeak;
  if (l.position === 'GK') {
    const [t, ...nums] = l.attrs.split(/\s+/);
    const [shotStopping, handling, commandOfArea, distribution] = nums.map(Number) as [number, number, number, number];
    const type: GkType = t === 'S' ? 'sweeper' : 'classic';
    const attrs = { shotStopping, handling, commandOfArea, distribution };
    out = { gk: { attrs, type }, ovr: peakOf(gkOvrOf(attrs, type), l) };
  } else {
    const nums = l.attrs.split(/[\s|]+/).filter(Boolean).map(Number);
    if (nums.length !== FIELD_ATTRIBUTES.length) throw new Error(`${l.id}: 능력치 ${nums.length}개`);
    const attributes = Object.fromEntries(FIELD_ATTRIBUTES.map((a, i) => [a, nums[i]])) as FieldAttributes;
    out = { attributes, ovr: peakOf(positionOvr(attributes, l.position as FieldPosition), l) };
  }
  PEAK_CACHE.set(l.id, out);
  return out;
}

const peakOf = (raw: number, l: LegendData): number => {
  const L = BALANCE.legends;
  // 도르트문트·미래 스타 (C.75x): 데이터의 전성기 OVR 지정값 (하한을 낮춰 88로 끌어올리지 않는다)
  if (l.peak !== undefined) return clamp(l.peak, L.groupMinPeak, L.maxPeak);
  return clamp(raw + L.peakBonus, L.minPeak, L.maxPeak);
};

function gkOvrOf(attrs: GkAttributes, type: GkType): number {
  const w = BALANCE.goalkeeper.ovrWeights[type];
  return Math.round(attrs.shotStopping * w.shotStopping + attrs.handling * w.handling + attrs.commandOfArea * w.commandOfArea + attrs.distribution * w.distribution);
}

const rngOf = (worldSeed: string, part: string, id: string): Rng => createRng(hashSeed(`legend:${worldSeed}:${part}:${id}`));

/** 그 시즌(8월 1일 기준) 실제 나이: 미래 스타 (C.75x) */
export const futureAge = (l: LegendData, season: number): number => season - l.born![0] - (l.born![1] > 8 ? 1 : 0);

/** 미래 스타의 등장 자리 (C.75y): 구현된 리그 중 가장 이른 첫 시즌. 없으면 undefined (리그 추가 후 등장) */
export function futureEntry(l: LegendData, leagues: readonly LeagueId[] = IMPLEMENTED_LEAGUES): FutureEntry | undefined {
  return [...(l.entries ?? [])].filter((e) => leagues.includes(e.league)).sort((a, b) => a.season - b.season)[0];
}

/** 미래 스타가 세계에 들어오는 시즌 (이미 지났으면 게임 시작 시즌). 구현 리그 기록이 없으면 undefined */
export function futureDebut(l: LegendData): number | undefined {
  const e = futureEntry(l);
  return e ? Math.max(e.season, BALANCE.newGame.startYear) : undefined;
}

/** 시작 나이 (지정 없으면 15~22 시드 랜덤). 미래 스타는 들어오는 시즌의 실제 나이 */
export function legendAge(l: LegendData, worldSeed: string): number {
  const L = BALANCE.legends;
  if (l.group === 'future') return futureAge(l, futureDebut(l) ?? BALANCE.newGame.startYear);
  return l.age ?? randInt(rngOf(worldSeed, 'age', l.id), L.minAge, L.maxAge);
}

/** 나이로 정한 전성기까지 모자란 OVR */
export const legendGap = (age: number): number => agingRate(BALANCE.legends.startGap, age);

/** 소속 팀: 실제 유스 구단이 리그 팀이면 그 팀, 아니면 수준이 가까운 리그 팀 near 곳 중 하나 */
export function legendClub(l: LegendData, worldSeed: string, teams: readonly { id: string; rating: number }[]): string {
  if (teams.some((t) => t.id === l.youth)) return l.youth;
  const lv = OUTSIDE_BY_ID[l.youth]?.rating ?? l.lv;
  const near = [...teams].sort((a, b) => Math.abs(a.rating - lv) - Math.abs(b.rating - lv) || a.id.localeCompare(b.id)).slice(0, BALANCE.legends.near);
  return near[Math.floor(rngOf(worldSeed, 'club', l.id)() * near.length)]!.id;
}

const MENTAL: readonly FieldAttribute[] = ['composure', 'bigMatch', 'leadership'];
const PHYS: readonly FieldAttribute[] = [...ATTRIBUTE_GROUPS.pace, ...ATTRIBUTE_GROUPS.physical];

/** 시작 능력치: 전성기 값에서 모자람 × 묶음 배율을 빼고, 남은 차이는 OVR 가중으로 맞춘다 */
export function legendStartAttributes(l: LegendData, age: number, worldSeed: string): LegendPeak {
  const peak = legendPeak(l);
  const gap = legendGap(age);
  const target = peak.ovr - gap;
  const rng = rngOf(worldSeed, 'attrs', l.id);
  if (peak.gk) {
    const attrs = { ...peak.gk.attrs };
    for (const k of Object.keys(attrs) as (keyof GkAttributes)[]) attrs[k] = clamp(attrs[k] - gap, 25, 99);
    shiftGk(attrs, peak.gk.type, target - gkOvrOf(attrs, peak.gk.type), rng);
    return { gk: { attrs, type: peak.gk.type }, ovr: gkOvrOf(attrs, peak.gk.type) };
  }
  const M = BALANCE.legends.gapMul;
  const attrs = { ...peak.attributes! };
  for (const a of FIELD_ATTRIBUTES) {
    const mul = MENTAL.includes(a) ? M.mental : PHYS.includes(a) ? M.physical : M.other;
    attrs[a] = clamp(Math.round(attrs[a] - gap * mul), 20, 99);
  }
  const pos = l.position as FieldPosition;
  shiftOvr(attrs, pos, target - positionOvr(attrs, pos), rng);
  return { attributes: attrs, ovr: positionOvr(attrs, pos) };
}

/** 로스터 선수 하나 (가상 선수 성장 곡선을 그대로 쓴다: 전성기 OVR = 데이터, 전성기 나이 29·GK 30) */
export function legendRosterPlayer(l: LegendData, worldSeed: string, season: number): RosterPlayer {
  const L = BALANCE.legends;
  const age = legendAge(l, worldSeed);
  const start = legendStartAttributes(l, age, worldSeed);
  const rng = rngOf(worldSeed, 'contract', l.id);
  return {
    id: l.id,
    real: false,
    legend: true,
    name: l.name,
    nameKo: l.nameKo,
    nationality: l.nationality,
    appearance: rollAppearance(`${l.id}:${l.name}`, l.nationality),
    body: { height: l.height, weight: l.weight, foot: l.foot === 'left' ? 'left' : 'right', weakFoot: l.weakFoot },
    shirt: l.shirt,
    age,
    position: l.position as Position,
    ...(start.gk ? { gk: start.gk } : { attributes: start.attributes! }),
    potentialTier: 'legendary',
    peakOvr: legendPeak(l).ovr,
    peakAge: l.position === 'GK' ? L.gkPeakAge : L.peakAge,
    loyalty: L.loyalty,
    contractEnd: season + randInt(rng, 2, 5),
    joined: season,
  };
}

export interface LegendSpawn { legend: LegendData; teamId: string; player: RosterPlayer }

const spawnOf = (l: LegendData, worldSeed: string, season: number, teams: readonly { id: string; rating: number }[]): LegendSpawn => {
  // 미래 스타 (C.75y): 등장 리그의 그 팀 (리그 팀이 아니면 수준 가까운 팀으로)
  const e = l.group === 'future' ? futureEntry(l) : undefined;
  const teamId = e && teams.some((t) => t.id === e.team) ? e.team : legendClub(l, worldSeed, teams);
  return { legend: l, teamId, player: { ...legendRosterPlayer(l, worldSeed, season), youth: teamId } };
};

/** 레전드 팩 시작 명단 (except = 내 선수로 고른 레전드) */
export function legendSpawns(worldSeed: string, season: number, teams: readonly { id: string; rating: number }[], except?: string, pack: number = LEGEND_PACK): LegendSpawn[] {
  return packLegends(pack).filter((l) => l.id !== except).map((l) => spawnOf(l, worldSeed, season, teams));
}

/** 이 시즌(season)에 구현 리그에 처음 들어오는 미래 스타 (C.75y). 게임 시작 시즌이면 그 전에 이미 뛰던 선수까지 */
export function futureSpawns(worldSeed: string, season: number, teams: readonly { id: string; rating: number }[]): LegendSpawn[] {
  return FUTURE_STARS.filter((l) => futureDebut(l) === season).map((l) => spawnOf(l, worldSeed, season, teams));
}

/** 아직 등장 전인 미래 스타 (월드 화면 "등장 예정"): 구현 리그 기록이 있는 선수만, 시즌 순 */
export const upcomingFutureStars = (season: number): LegendData[] =>
  FUTURE_STARS.filter((l) => (futureDebut(l) ?? 0) > season).sort((a, b) => futureDebut(a)! - futureDebut(b)! || a.nameKo.localeCompare(b.nameKo));

/** 리그가 아직 없어 등장하지 않는 미래 스타 (리그 추가 후 등장) */
export const waitingFutureStars = (): LegendData[] => FUTURE_STARS.filter((l) => futureDebut(l) === undefined);

/** 내 선수로 고를 수 있는 레전드 (필드 선수만, 미래 스타는 고를 수 없음) */
export const selectableLegends = (pack: number = LEGEND_PACK): LegendData[] => packLegends(pack).filter((l) => l.position !== 'GK');
