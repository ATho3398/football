// 레전드 팩 (pending 63, 부록 C.47): 2020년 말까지 은퇴한 레전드를 2018-19 세계에 15~22세로 넣는다.
// 데이터(data/players/legends.ts)는 전성기 능력치. 시작 능력치는 나이로 정한 모자람(startGap)만큼 낮추고 전성기 나이(29)에 전성기 OVR 로 자라게 한다.
// 소속 = 실제 유스·첫 프로 구단이 PL 팀이면 그 팀, 아니면 그 구단 수준에 가까운 PL 팀 (리그 밖 구단은 로스터가 없어 경기에 나오지 않는다).
// 모두 시드(`legend:<시드>:<id>`)로 따로 뽑아 기존 시드 흐름과 무관하다: 끄면 세계가 그대로다

import { FUTURE_STARS, LEGENDS, type FutureEntry, type LeagueId, type LegendData } from '../data/players/legends';
import { OUTSIDE_BY_ID, OUTSIDE_CLUBS } from '../data/outsideClubs';
import { OUTSIDE_TO_LEAGUE } from '../data/clubAlias';
import { initialTeams } from './league';
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

/**
 * 레전드 팩 판 (C.75x): 1 = C.47 117명 (옛 세이브), 2 = + 도르트문트 레전드 (C.75x·C.75y 세이브), 3 = + 추가 53명 (C.75w, 새 게임).
 * 미래 스타는 따로 "미래 스타 팩" (C.75y). 옛 판 세이브는 그 판 그대로 다시 만든다
 */
export const LEGEND_PACK = 3;

/** 그 판에서 들어오는 레전드 (3판은 일부가 리그 밖에서 기다렸다 이적으로 들어온다: legendPlacement) */
export const packLegends = (pack: number = LEGEND_PACK): readonly LegendData[] =>
  pack >= 3 ? LEGENDS : pack >= 2 ? LEGENDS.filter((l) => l.group !== 'ext') : LEGENDS.filter((l) => !l.group);

/**
 * 기본 리그 (C.76c 옛 규칙의 "구현 리그"): 고른 리그를 주지 않으면 PL 만. C.76c(45b)부터 미래 스타는 그 게임에서 고른 리그 기준이다
 * (등장 예정 = 고른 리그 중 가장 이른 첫 시즌, 로스터에 들어오는 것은 내 리그 첫 시즌)
 */
export const IMPLEMENTED_LEAGUES: readonly LeagueId[] = ['pl'];

/** 데이터의 팀 id (x: 리그 밖 표 id 포함) → 리그 팀 id (같은 클럽이면 리그 데이터 id) */
const entryTeam = (team: string): string => OUTSIDE_TO_LEAGUE[team] ?? team;

/**
 * 레전드 팩 2판에 든 선수와 같은 사람인 실제 선수 id (C.75x): 팩을 켜면 현역 로스터에서 뺀다 (중복 금지).
 * 지금 실제 선수 34명 중 해당자는 없다 (타리그 단계에 선수 풀이 늘면 이름으로 걸러진다)
 */
export function packRealExcludes(pack: number, future = false): ReadonlySet<string> {
  const pool = [...(pack >= 2 ? packLegends(pack) : []), ...(future ? FUTURE_STARS : [])];
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

/**
 * 미래 스타의 등장 자리 (C.76c): 고른 리그 중 가장 이른 첫 시즌 (팀 = 리그 팀 id). 없으면 undefined (그 리그를 고르지 않음)
 */
export function futureEntry(l: LegendData, leagues: readonly string[] = IMPLEMENTED_LEAGUES): FutureEntry | undefined {
  const e = [...(l.entries ?? [])].filter((x) => leagues.includes(x.league)).sort((a, b) => a.season - b.season)[0];
  return e ? { ...e, team: entryTeam(e.team) } : undefined;
}

/** 미래 스타가 세계에 들어오는 시즌 (이미 지났으면 게임 시작 시즌). 고른 리그 기록이 없으면 undefined */
export function futureDebut(l: LegendData, leagues: readonly string[] = IMPLEMENTED_LEAGUES): number | undefined {
  const e = futureEntry(l, leagues);
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

/** 소속 팀: 실제 유스 구단이 리그 팀이면 그 팀 (리그 밖 표 id 면 같은 클럽의 리그 팀, C.76c), 아니면 수준이 가까운 리그 팀 near 곳 중 하나 */
export function legendClub(l: LegendData, worldSeed: string, teams: readonly { id: string; rating: number }[]): string {
  if (teams.some((t) => t.id === l.youth)) return l.youth;
  const y = OUTSIDE_TO_LEAGUE[l.youth];
  if (y && teams.some((t) => t.id === y)) return y;
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

/** 로스터 선수 하나 (가상 선수 성장 곡선을 그대로 쓴다: 전성기 OVR = 데이터, 전성기 나이 29·GK 30). older = 리그 밖에서 보낸 시즌 수 (C.75w 이적 유입) */
export function legendRosterPlayer(l: LegendData, worldSeed: string, season: number, older = 0): RosterPlayer {
  const L = BALANCE.legends;
  // 미래 스타: 들어오는 시즌의 실제 나이 (C.76c: PL 밖 리그 등장·리그 이동도 그 시즌 기준. PL 등장은 전과 같다)
  const age = l.group === 'future' ? futureAge(l, season) : legendAge(l, worldSeed) + older;
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

const spawnOf = (l: LegendData, worldSeed: string, season: number, teams: readonly { id: string; rating: number }[], mine: readonly string[] = IMPLEMENTED_LEAGUES): LegendSpawn => {
  // 미래 스타 (C.76c): 내 리그 등장 기록의 그 팀 (리그 팀이 아니면 수준 가까운 팀으로)
  const e = l.group === 'future' ? futureEntry(l, mine) : undefined;
  const teamId = e && teams.some((t) => t.id === e.team) ? e.team : legendClub(l, worldSeed, teams);
  return { legend: l, teamId, player: { ...legendRosterPlayer(l, worldSeed, season), youth: teamId } };
};

/** 레전드 팩 시작 명단 (except = 내 선수로 고른 레전드). 3판(C.75w)은 팀당 상한 안의 선수만 (넘친 선수는 리그 밖 대기) */
export function legendSpawns(worldSeed: string, season: number, teams: readonly { id: string; rating: number }[], except?: string, pack: number = LEGEND_PACK): LegendSpawn[] {
  if (pack >= 3) return legendPlacement(worldSeed, teams, except).spawns.map((x) => ({ ...x, player: { ...legendRosterPlayer(x.legend, worldSeed, season), youth: x.teamId } }));
  return packLegends(pack).filter((l) => l.id !== except).map((l) => spawnOf(l, worldSeed, season, teams));
}

// ── 3판 배치 (C.75w): 레전드가 191명이라 한 팀에 몰리지 않게 팀당 상한(BALANCE.legends.maxPerTeam)을 둔다.
// 소속 후보 = 유스 PL 팀 → 기존 규칙(legendClub)이 고른 팀 → 수준이 가까운 near 팀 중 레전드가 적은 팀. 모두 차면 리그 밖 구단에서 시작해
// 다음 시즌부터 시즌마다 arrivalsPerSeason 명씩 이적으로 들어온다 (리그 추가 뒤에는 그 리그로) ──

/** 리그 밖에서 기다리는 레전드: 시작 구단(리그 밖 id)과 들어오는 시즌 */
export interface LegendAbroad { legend: LegendData; club: string; season: number }

export interface LegendPlacement { spawns: { legend: LegendData; teamId: string }[]; abroad: LegendAbroad[] }

const PLACE_CACHE = new Map<string, LegendPlacement>();

/** 리그 밖 시작 구단: 유스 구단이 리그 밖 표에 있으면 그 구단, 아니면 수준이 가장 가까운 리그 밖 구단 */
function abroadClub(l: LegendData): string {
  if (OUTSIDE_BY_ID[l.youth]) return l.youth;
  return [...OUTSIDE_CLUBS].sort((a, b) => Math.abs(a.rating - l.lv) - Math.abs(b.rating - l.lv) || a.id.localeCompare(b.id))[0]!.id;
}

/** 수준(lv)이 가까운 팀 순 */
const nearTeams = (lv: number, teams: readonly { id: string; rating: number }[]) =>
  [...teams].sort((a, b) => Math.abs(a.rating - lv) - Math.abs(b.rating - lv) || a.id.localeCompare(b.id));

const levelOf = (l: LegendData): number => OUTSIDE_BY_ID[l.youth]?.rating ?? l.lv;

/** 3판 시작 배치 (시드로 정해진다). 순서 = 전성기 높은 순 (같으면 id) */
export function legendPlacement(worldSeed: string, teams: readonly { id: string; rating: number }[], except?: string): LegendPlacement {
  const key = `${worldSeed}|${except ?? ''}|${teams.map((t) => `${t.id}:${t.rating}`).join(',')}`;
  const hit = PLACE_CACHE.get(key);
  if (hit) return hit;
  const L = BALANCE.legends;
  const count: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, 0]));
  const spawns: LegendPlacement['spawns'] = [];
  const over: LegendData[] = [];
  const order = packLegends(3).filter((l) => l.id !== except).sort((a, b) => legendPeak(b).ovr - legendPeak(a).ovr || a.id.localeCompare(b.id));
  for (const l of order) {
    const room = (id: string) => (count[id] ?? Infinity) < L.maxPerTeam;
    const first = legendClub(l, worldSeed, teams);
    const near = nearTeams(levelOf(l), teams).slice(0, L.near).filter((t) => room(t.id)).sort((a, b) => count[a.id]! - count[b.id]!)[0]?.id;
    const teamId = room(first) ? first : near;
    if (!teamId) { over.push(l); continue; }
    count[teamId]!++;
    spawns.push({ legend: l, teamId });
  }
  const start = BALANCE.newGame.startYear;
  const abroad = over.map((l, i) => ({ legend: l, club: abroadClub(l), season: start + 1 + Math.floor(i / L.arrivalsPerSeason) }));
  const out = { spawns, abroad };
  PLACE_CACHE.set(key, out);
  return out;
}

/**
 * 이 시즌에 리그 밖에서 이적으로 들어오는 레전드 (3판). rosters = 지금 로스터 (레전드가 적은 팀으로): 수준이 가까운 near 팀 중
 * 상한 아래인 팀 → 없으면 리그 전체에서 상한 아래 · 가까운 팀 → 없으면 레전드가 가장 적은 팀
 */
export function legendArrivals(
  worldSeed: string, season: number, teams: readonly { id: string; rating: number }[], rosters: Readonly<Record<string, { players: readonly { legend?: boolean }[] }>>, except?: string,
): LegendSpawn[] {
  const L = BALANCE.legends;
  const start = BALANCE.newGame.startYear;
  const list = legendPlacement(worldSeed, teams.map((t) => ({ id: t.id, rating: t.rating })), except).abroad.filter((a) => a.season === season);
  const count: Record<string, number> = Object.fromEntries(teams.map((t) => [t.id, rosters[t.id]?.players.filter((p) => p.legend).length ?? 0]));
  return list.map((a) => {
    const all = nearTeams(levelOf(a.legend), teams);
    const open = (xs: typeof all) => xs.filter((t) => count[t.id]! < L.maxPerTeam);
    const teamId = (open(all.slice(0, L.near))[0] ?? open(all)[0] ?? [...all].sort((x, y) => count[x.id]! - count[y.id]!)[0]!).id;
    count[teamId]!++;
    // 리그 밖에서 보낸 시즌만큼 나이가 들고 그 나이의 능력치로 들어온다. 유스 = 리그 밖 구단 (자국 육성 아님)
    const player = { ...legendRosterPlayer(a.legend, worldSeed, season, season - start), youth: a.club };
    return { legend: a.legend, teamId, player };
  });
}

/** 아직 리그 밖에서 기다리는 레전드 (월드 화면): 들어오는 시즌이 season 보다 뒤 */
export const abroadLegends = (worldSeed: string, season: number, except?: string, myLeague = 'pl'): LegendAbroad[] =>
  legendPlacement(worldSeed, initialTeams(myLeague).map((t) => ({ id: t.id, rating: t.baseRating })), except).abroad.filter((a) => a.season > season);

/**
 * 이 시즌(season)에 내 리그에 처음 들어오는 미래 스타 (C.76c). 게임 시작 시즌이면 그 전에 이미 뛰던 선수까지.
 * leagueIds = 고른 리그 (맨 앞 = 내 리그). 로스터는 내 리그만 있어 내 리그 등장 기록으로 들어온다 (다른 고른 리그 등장은 월드 "등장 예정"에만)
 */
export function futureSpawns(worldSeed: string, season: number, teams: readonly { id: string; rating: number }[], leagueIds: readonly string[] = IMPLEMENTED_LEAGUES): LegendSpawn[] {
  const mine = leagueIds.slice(0, 1);
  return FUTURE_STARS.filter((l) => futureDebut(l, mine) === season).map((l) => spawnOf(l, worldSeed, season, teams, mine));
}

/** 아직 등장 전인 미래 스타 (월드 화면 "등장 예정"): 고른 리그 기록이 있는 선수만, 시즌 순 */
export const upcomingFutureStars = (season: number, leagueIds: readonly string[] = IMPLEMENTED_LEAGUES): LegendData[] =>
  FUTURE_STARS.filter((l) => (futureDebut(l, leagueIds) ?? 0) > season)
    .sort((a, b) => futureDebut(a, leagueIds)! - futureDebut(b, leagueIds)! || a.nameKo.localeCompare(b.nameKo));

/** 고른 리그에 기록이 없어 등장하지 않는 미래 스타 (그 리그를 고르면 등장) */
export const waitingFutureStars = (leagueIds: readonly string[] = IMPLEMENTED_LEAGUES): LegendData[] => FUTURE_STARS.filter((l) => futureDebut(l, leagueIds) === undefined);

/** 내 선수로 고를 수 있는 레전드 (필드 선수만, 미래 스타는 고를 수 없음) */
export const selectableLegends = (pack: number = LEGEND_PACK): LegendData[] => packLegends(pack).filter((l) => l.position !== 'GK');
