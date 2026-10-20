// 포토카드 도감 (46a단계, 부록 C.75t, pending 130): 내 선수와 같은 경기에 출전한 실제 선수(레전드·미래 스타 포함, 가상 선수 제외)를
// 경기가 끝날 때 자동으로 모은다. 세이브에는 선수 id · 처음 만난 날짜·경기 · 유니폼 여부 · "처음 만났을 때"(그때 팀·OVR)만 담고,
// 나이·OVR·소속·리그·등번호는 볼 때 지금 데이터에서 읽는다. 리그에서 사라진(은퇴한) 레전드는 시즌 갱신 때 마지막 값을 고정한다 (ret).
// 도감 번호는 data/players/photoDex.ts (고정, 뒤에 이어 붙이기만: scripts/dex-append.ts)

import { messi } from '../data/players/messi';
import { stars } from '../data/players/stars';
import { LEAGUE_PLAYERS } from '../data/players';
import { allLeagueData } from '../data/leagues';
import { DEX_CLUB_RANK, DEX_IDS, DEX_LEAGUES } from '../data/players/photoDex';
import { BALANCE } from './config/balance';
import { FUTURE_STARS, LEGENDS, legendPeak } from './legends';
import { npcOvr, type NpcState } from './npc';
import { positionOvr } from './positions';
import { findRosterPlayer, naturalOvr, type RosterPlayer } from './roster';
import type { IsoDate } from './calendar';
import type { CompId } from './cups';
import type { PlayerStats } from './engine/types';
import type { GameState } from './game';
import type { Position } from './types';

// ── 도감 번호 ──

export type DexKind = 'active' | 'legend' | 'future';
export type PosLine = 'GK' | 'DF' | 'MF' | 'FW';
export const POS_LINES: readonly PosLine[] = ['GK', 'DF', 'MF', 'FW'];
export const POS_LINE_KO: Readonly<Record<PosLine, string>> = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' };

export function posLine(p: Position): PosLine {
  if (p === 'GK') return 'GK';
  if (p === 'CB' || p === 'LB' || p === 'RB' || p === 'LWB' || p === 'RWB') return 'DF';
  if (p === 'LW' || p === 'RW' || p === 'CF' || p === 'ST') return 'FW';
  return 'MF';
}

/** 도감 번호를 매길 실제 선수 한 명 (정렬에 쓰는 값만) */
export interface DexCandidate {
  id: string;
  nameKo: string;
  kind: DexKind;
  position: Position;
  shirt: number;
  /** 현역만: 데이터의 리그·구단 이름 */
  league?: string;
  club?: string;
}

/**
 * 게임 안 실제 선수 전원 (도감 후보). 새 리그 선수 데이터(data/players/<리그>.ts)가 생기면 여기 active 목록에 더한다 (45b, C.75y: 13개 리그 필드 선수.
 * 리그 데이터 GK 는 경기에 나오지 않아 빼 둔다). 2018-07 ~ 2020-12 은퇴자도 실제 선수라 넣는다 (레전드 팩으로 나온다)
 */
export function dexCandidates(): DexCandidate[] {
  const active = [messi, ...stars, ...Object.values(LEAGUE_PLAYERS).flat()].map((p): DexCandidate => ({
    id: p.id, nameKo: p.nameKo, kind: 'active', position: p.position, shirt: p.shirtNumber, league: p.league, club: p.club,
  }));
  const legend = (kind: DexKind) => (l: (typeof LEGENDS)[number]): DexCandidate => ({ id: l.id, nameKo: l.nameKo, kind, position: l.position, shirt: l.shirt });
  return [...active, ...LEGENDS.map(legend('legend')), ...FUTURE_STARS.map(legend('future'))];
}

const lc = (s: string | undefined) => (s ?? '').trim().toLowerCase();

function tableIndex(table: readonly (readonly string[])[], key: string | undefined): number {
  const k = lc(key);
  const i = table.findIndex((names) => names.includes(k));
  return i < 0 ? table.length : i;
}

const KIND_ORDER: Readonly<Record<DexKind, number>> = { active: 0, legend: 1, future: 2 };

/** 리그 데이터 팀 순서 (C.75y): 구단 이름(소문자) → 리그 안 자리 */
const DATA_CLUB_ORDER: ReadonlyMap<string, number> = new Map(allLeagueData().flatMap((d) => d.teams.map((t, i) => [lc(t.name), i] as const)));

/** 구단 순위 자리: 순위 표 → 리그 데이터 팀 순서 (표 뒤) → 둘 다 없으면 맨 뒤 */
function clubRank(club: string | undefined): number {
  const i = tableIndex(DEX_CLUB_RANK, club);
  if (i < DEX_CLUB_RANK.length) return i;
  const d = DATA_CLUB_ORDER.get(lc(club));
  return d === undefined ? DEX_CLUB_RANK.length + 1000 : DEX_CLUB_RANK.length + d;
}

/** 도감 정렬 규칙 (pending 130): 현역 = 리그 → 구단(2018-19 순위) → 포지션 줄 → 등번호, 레전드·미래 스타 = 포지션 줄 → 이름 */
export function dexCompare(a: DexCandidate, b: DexCandidate): number {
  const k = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (k) return k;
  const line = POS_LINES.indexOf(posLine(a.position)) - POS_LINES.indexOf(posLine(b.position));
  if (a.kind === 'active') {
    const lg = tableIndex(DEX_LEAGUES, a.league) - tableIndex(DEX_LEAGUES, b.league);
    if (lg) return lg;
    if (tableIndex(DEX_LEAGUES, a.league) === DEX_LEAGUES.length && a.league !== b.league) return lc(a.league) < lc(b.league) ? -1 : 1;
    const club = clubRank(a.club) - clubRank(b.club);
    if (club) return club;
    if (a.club !== b.club) return lc(a.club) < lc(b.club) ? -1 : 1;
    if (line) return line;
    if (a.shirt !== b.shirt) return a.shirt - b.shirt;
  } else if (line) return line;
  return a.nameKo.localeCompare(b.nameKo, 'ko') || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** 기존 번호 뒤에 새 선수만 규칙대로 정렬해 이어 붙인 목록 (기존 순서는 그대로) */
export function dexAppend(existing: readonly string[], candidates: readonly DexCandidate[]): string[] {
  const have = new Set(existing);
  const seen = new Set<string>();
  const fresh = candidates.filter((c) => !have.has(c.id) && !seen.has(c.id) && seen.add(c.id)).sort(dexCompare);
  return [...existing, ...fresh.map((c) => c.id)];
}

/** 앞부분 고정 확인용 해시 (FNV-1a 32비트, 16진 8자리) */
export function dexHash(ids: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const ch of ids.join('\n')) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 선수 id → 도감 번호 (1부터) */
export const DEX_NO: ReadonlyMap<string, number> = new Map(DEX_IDS.map((id, i) => [id, i + 1]));
export const DEX_TOTAL = DEX_IDS.length;
export const dexLabel = (no: number): string => `No.${String(no).padStart(3, '0')}`;

const CANDIDATE_BY_ID: ReadonlyMap<string, DexCandidate> = new Map(dexCandidates().map((c) => [c.id, c]));
export const dexCandidate = (id: string): DexCandidate | undefined => CANDIDATE_BY_ID.get(id);

// ── 세이브 ──

/** 포토카드 한 장 (세이브) */
export interface PhotoCard {
  id: string;
  /** 처음 만난 날짜 */
  d: IsoDate;
  /** 처음 만난 경기: 시즌 · 상대 팀 id · 대회(컵이면) */
  s: number;
  vs: string;
  c?: CompId;
  /** 유니폼 교환으로 받았는지 (46b에서 씀, 지금은 늘 false) */
  jersey: boolean;
  /** 처음 만났을 때: 그때 팀(팀 id 또는 구단 이름) · OVR */
  first: { t: string; o: number };
  /** 리그에서 은퇴로 사라진 레전드·미래 스타: 마지막 값 고정 [팀, OVR, 나이, 등번호, 포지션] */
  ret?: { t: string; o: number; a: number; n: number; p: Position };
}

export interface PhotoState {
  /** 획득순 */
  cards: PhotoCard[];
}

export const emptyPhotos = (): PhotoState => ({ cards: [] });

function ensurePhotos(state: GameState): PhotoState {
  return (state.photos ??= emptyPhotos());
}

/** 지금 그 선수가 어디서 어떤 값인지 (로스터 → 실제 A등급 NPC) */
function locate(state: GameState, id: string): { team: string; ovr: number; age: number; shirt?: number; position: Position; player?: RosterPlayer; npc?: NpcState } | null {
  const r = findRosterPlayer(state.rosters, id);
  if (r) return { team: r.teamId, ovr: naturalOvr(r.player), age: r.player.age, ...(r.player.shirt ? { shirt: r.player.shirt } : {}), position: r.player.position, player: r.player };
  const n = state.npcs.find((x) => x.id === id);
  if (n) return { team: n.club, ovr: npcOvr(n), age: n.age, position: n.position, npc: n };
  return null;
}

/** 내 선수가 실제 선수(실제 A등급·레전드)면 그 id */
function selfId(state: GameState): string | undefined {
  const id = state.player.realPlayerId ?? state.player.legendId;
  return id && DEX_NO.has(id) ? id : undefined;
}

/**
 * 경기 끝 (C.75t): 내 선수가 뛰었으면 같은 경기에 뛴 실제 선수(양 팀) 중 처음 만난 선수를 모은다. 새로 모은 장 수.
 * 내가 실제 선수면 내 카드도 첫 출전 때 같이 들어온다
 */
export function collectPhotos(
  state: GameState, players: readonly PlayerStats[] | undefined, myId: string, match: { date: IsoDate; season: number; vs: string; comp?: CompId },
): number {
  if (!players) return 0;
  const me = players.find((p) => p.id === myId);
  if (!me || me.minutes <= 0) return 0;
  const ph = ensurePhotos(state);
  const have = new Set(ph.cards.map((c) => c.id));
  let n = 0;
  const add = (id: string, first: { t: string; o: number }) => {
    ph.cards.push({ id, d: match.date, s: match.season, vs: match.vs, ...(match.comp ? { c: match.comp } : {}), jersey: false, first });
    have.add(id);
    n++;
  };
  const self = selfId(state);
  if (self && !have.has(self)) add(self, { t: state.player.teamId, o: positionOvr(state.player.attributes, state.player.position as Exclude<Position, 'GK'>) });
  for (const p of players) {
    if (p.id === myId || p.minutes <= 0 || have.has(p.id) || !DEX_NO.has(p.id)) continue;
    const at = locate(state, p.id);
    add(p.id, { t: at?.team ?? '', o: at?.ovr ?? 0 });
  }
  return n;
}

/** 시즌 갱신 전: 모은 레전드·미래 스타(로스터에만 있는 선수)의 지금 값 */
export function photoSnapshot(state: GameState): Map<string, NonNullable<PhotoCard['ret']>> {
  const out = new Map<string, NonNullable<PhotoCard['ret']>>();
  for (const c of state.photos?.cards ?? []) {
    if (c.ret || dexCandidate(c.id)?.kind === 'active') continue;
    const r = findRosterPlayer(state.rosters, c.id);
    if (r) out.set(c.id, { t: r.teamId, o: naturalOvr(r.player), a: r.player.age, n: r.player.shirt ?? dexCandidate(c.id)?.shirt ?? 0, p: r.player.position });
  }
  return out;
}

/** 시즌 갱신 뒤: 로스터에서 사라진(은퇴) 선수는 갱신 전 값으로 고정 */
export function photoRetirements(state: GameState, before: ReadonlyMap<string, NonNullable<PhotoCard['ret']>>): void {
  for (const c of state.photos?.cards ?? []) {
    const snap = before.get(c.id);
    if (snap && !findRosterPlayer(state.rosters, c.id)) c.ret = snap;
  }
}

// ── 볼 때 값 ──

export type PhotoSort = 'no' | 'pos' | 'name' | 'shirt' | 'age' | 'ovr' | 'league' | 'got';
export const PHOTO_SORTS: readonly PhotoSort[] = ['no', 'pos', 'name', 'shirt', 'age', 'ovr', 'league', 'got'];
export const PHOTO_SORT_KO: Readonly<Record<PhotoSort, string>> = {
  no: '도감 번호', pos: '포지션', name: '이름', shirt: '등번호', age: '나이', ovr: '능력치', league: '리그', got: '획득순',
};

export type PhotoGrade = 'common' | 'rare' | 'epic' | 'legend';

export function photoGrade(ovr: number): PhotoGrade {
  const g = BALANCE.photocards.grade;
  return ovr >= g.legend ? 'legend' : ovr >= g.epic ? 'epic' : ovr >= g.rare ? 'rare' : 'common';
}

/** 포지션 줄 핵심 스탯 (능력치 정렬 보조): GK 선방 · DF 태클 · MF 숏패스 · FW 슈팅 */
export const KEY_STAT_KO: Readonly<Record<PosLine, string>> = { GK: '선방', DF: '태클', MF: '숏패스', FW: '슈팅' };

function keyStat(line: PosLine, p?: RosterPlayer, n?: NpcState): number {
  if (line === 'GK') return p?.gk?.attrs.shotStopping ?? 0;
  const a = p?.attributes ?? n?.attributes;
  if (!a) return 0;
  return line === 'DF' ? a.tackling : line === 'MF' ? a.shortPassing : a.shooting;
}

/** 도감 한 칸 (모은 카드). 값은 지금 데이터 기준 */
export interface PhotoView {
  no: number;
  id: string;
  name: string;
  position: Position;
  line: PosLine;
  /** 지금 팀 (팀 id 또는 구단 이름, 모르면 '') */
  team: string;
  league: string;
  ovr: number;
  age: number;
  shirt: number;
  key: number;
  grade: PhotoGrade;
  /** 은퇴 (값 고정) */
  retired: boolean;
  /** 리그 밖 (지금 값을 몰라 처음 만났을 때 값) */
  away: boolean;
  jersey: boolean;
  /** 획득순 (0부터) */
  got: number;
  card: PhotoCard;
  kind: DexKind;
}

/** 리그 이름: 로스터 팀이면 지금 리그, NPC 면 데이터 리그(구단이 바뀌었으면 그 구단), 은퇴·리그 밖이면 마지막 값 */
export function photoView(state: GameState, card: PhotoCard, got: number): PhotoView {
  const cand = dexCandidate(card.id);
  const no = DEX_NO.get(card.id) ?? 0;
  const base = { no, id: card.id, name: cand?.nameKo ?? card.id, jersey: card.jersey, got, card, kind: cand?.kind ?? 'legend' } as const;
  const make = (v: { team: string; league: string; ovr: number; age: number; shirt: number; position: Position; key: number; retired: boolean; away: boolean }): PhotoView =>
    ({ ...base, ...v, line: posLine(v.position), grade: photoGrade(v.ovr) });
  if (card.ret) {
    return make({ team: card.ret.t, league: state.league.name, ovr: card.ret.o, age: card.ret.a, shirt: card.ret.n, position: card.ret.p, key: 0, retired: true, away: false });
  }
  const self = selfId(state) === card.id;
  if (self) {
    const pos = state.player.position as Exclude<Position, 'GK'>;
    return make({ team: state.player.teamId, league: state.league.name, ovr: positionOvr(state.player.attributes, pos), age: state.player.age, shirt: cand?.shirt ?? 0, position: pos,
      key: keyStat(posLine(pos), undefined, { attributes: state.player.attributes } as NpcState), retired: state.phase === 'retired', away: false });
  }
  const at = locate(state, card.id);
  if (at?.player) {
    return make({ team: at.team, league: state.league.name, ovr: at.ovr, age: at.age, shirt: at.shirt ?? cand?.shirt ?? 0, position: at.position, key: keyStat(posLine(at.position), at.player), retired: false, away: false });
  }
  if (at?.npc) {
    const n = at.npc;
    const league = n.club === cand?.club ? cand.league ?? '' : '';
    return make({ team: n.club, league, ovr: at.ovr, age: n.age, shirt: cand?.shirt ?? 0, position: n.position, key: keyStat(posLine(n.position), undefined, n), retired: n.retired, away: false });
  }
  // 리그 밖 레전드 (이적·아직 리그에 없음): 처음 만났을 때 값
  const l = [...LEGENDS, ...FUTURE_STARS].find((x) => x.id === card.id);
  const position = l?.position ?? cand?.position ?? 'CM';
  return make({ team: card.first.t, league: '', ovr: card.first.o || (l ? legendPeak(l).ovr : 0), age: 0, shirt: cand?.shirt ?? 0, position, key: 0, retired: false, away: true });
}

export function photoViews(state: GameState): PhotoView[] {
  return (state.photos?.cards ?? []).map((c, i) => photoView(state, c, i)).filter((v) => v.no > 0);
}

/** 정렬 (오름차순 기준, desc 면 뒤집음). 같으면 도감 번호 */
export function sortPhotos(list: readonly PhotoView[], by: PhotoSort, desc = false): PhotoView[] {
  const leagueIx = (v: PhotoView) => tableIndex(DEX_LEAGUES, v.league || undefined);
  const cmp: Record<PhotoSort, (a: PhotoView, b: PhotoView) => number> = {
    no: (a, b) => a.no - b.no,
    pos: (a, b) => POS_LINES.indexOf(a.line) - POS_LINES.indexOf(b.line),
    name: (a, b) => a.name.localeCompare(b.name, 'ko'),
    shirt: (a, b) => a.shirt - b.shirt,
    age: (a, b) => a.age - b.age,
    ovr: (a, b) => a.ovr - b.ovr || a.key - b.key,
    league: (a, b) => leagueIx(a) - leagueIx(b) || a.league.localeCompare(b.league),
    got: (a, b) => a.got - b.got,
  };
  const f = cmp[by];
  return [...list].sort((a, b) => (desc ? -f(a, b) : f(a, b)) || a.no - b.no);
}
