// 이적과 계약 (18.6 NPC 점수 모델, 18.10 내 선수, 부록 C.42).
// NPC: 이적시장(여름 = 비시즌, 겨울 = 1월)마다 이적 점수 push − resist + 노이즈 → 시그모이드로 이적 의향을 뽑고, 목적지 후보 점수로 가중 추첨한다.
// 로스터는 시드로 다시 만들고 이적 기록(TransferRec)만 세이브에 담아 같은 순서로 다시 적용한다 (rebuildRosters).
// 내 선수: 비시즌 제안 3~5개(같은 점수 모델을 팀 입장으로), 계약·재계약, 이적 요청, 임대. 연봉은 계산·표시만 (돈은 5-7)

import { onClubChange, onRenewal } from './startClub';
import { npcCareerTag } from './npcTags';
import { wageMul } from './tags';
import { trustOf } from './manager';
import { OUTSIDE_BY_ID, OUTSIDE_CLUBS, type OutsideClub } from '../data/outsideClubs';
import { canonicalClub } from '../data/clubAlias';
import { BALANCE } from './config/balance';
import type { GameState } from './game';
import { addDays, isoDate, type IsoDate } from './calendar';
import { randInt } from './growth';
import { leagueOfTeam, leagueTeamById, sortedTable, teamById, CLUB_TO_TEAM, type LeagueState } from './league';
import { calendarKind } from './otherLeagues';
import { prepareLeagueMove } from './leagueMove';
import { startProbability } from './match';
import { teamDefaultTactics } from './myTactics';
import { proficientOvr } from './proficiency';
import { FORMATION_SLOTS } from './formations';
import { assignShirts, makeFiller, naturalOvr, pickLineup, posGroup, realFiller, rosterRating, type RosterPlayer, type Rosters, type TeamRoster } from './roster';
import { npcOvr, type NpcState } from './npc';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import { affordable, marketValue, npcAnnualWage, npcValue, remainingBudget, wageRoom } from './finance';
import { onContractSigned } from './money';
import { fixHomegrown, homegrown, isU21, squadCount, squadRule } from './squad';
import type { Position } from './types';

export type Window = 'summer' | 'winter';
/** 이적 이유 (가장 큰 push 항목): 계약 만료 / 출전 부족 / 야망(팀보다 잘함) / 팀 성적 / 그 밖 (낮은 충성도·노이즈) */
export type TransferWhy = 'contract' | 'minutes' | 'ambition' | 'team' | 'other';

/** 이적 기록 하나. 세이브에 담고, 로스터 재생성 때 같은 순서로 다시 적용한다 */
export interface TransferRec {
  /** 적용 시점 = 그때까지의 로스터 시즌 갱신 횟수 (roster.updates) */
  at: number;
  /** 이적 시즌 (여름 이적시장은 다가올 시즌) */
  season: number;
  w: Window;
  id: string;
  name: string;
  pos: Position;
  ovr: number;
  age: number;
  /** 팀 id (리그) 또는 리그 밖 클럽 id ('x:...') */
  from: string;
  to: string;
  /** 새 계약 만료 시즌, 새 충성도 */
  ce: number;
  loy: number;
  why: TransferWhy;
  /** 실제 선수 */
  real?: boolean;
  /**
   * from 이 리그 팀이면 빈자리를 채운 선수: 가상 선수 (리그 밖 club 에서 옴) 또는 real = 다른 고른 리그의 실제 선수 (C.76c, id = NPC id, club = 그 리그 팀 id)
   */
  fill?: { id: string; ovr: number; age: number; club: string; name: string; real?: true };
  /** to 가 리그 팀이면 자리를 비우려고 내보낸 선수 */
  rel?: string;
  /** 몸값 (만 원, 부록 C.46). 자유계약·만료는 0 이라 없음. 산 팀 예산에서 빠지고 판 팀 예산에 일부 더해진다 */
  fee?: number;
}

// ── 공통 ──

const rngFor = (...parts: (string | number)[]): Rng => createRng(hashSeed(parts.join(':')));
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export const isOutside = (id: string): boolean => id.startsWith('x:');

/** 팀 이름 (리그 팀 또는 리그 밖 클럽, 다른 리그 팀 C.76c) */
export function clubNameKo(league: LeagueState, id: string): string {
  if (isOutside(id)) return OUTSIDE_BY_ID[id]?.nameKo ?? id;
  return league.teams.find((t) => t.id === id)?.nameKo ?? leagueTeamById(id)?.nameKo ?? id;
}

function clubRating(league: LeagueState, id: string): number {
  return isOutside(id) ? OUTSIDE_BY_ID[id]?.rating ?? 70 : teamById(league, id).rating;
}

/**
 * 내 선수 화면·제안에 쓰는 팀 레이팅: 비시즌이면 다음 시즌 레이팅(endSeason 이 nextRatings 에 계산해 둔다), 아니면 지금 리그 레이팅
 */
export function ratingOf(state: Pick<GameState, 'phase' | 'league' | 'nextRatings'>, id: string): number {
  const next = state.phase !== 'season' ? state.nextRatings?.[id] : undefined;
  return next !== undefined ? Math.round(next * 10) / 10 : teamById(state.league, id).rating;
}

/** 받침 있으면 "으로", 없거나 ㄹ 받침이면 "로" */
export function ro(word: string): string {
  const c = word.charCodeAt(word.length - 1);
  if (c < 0xac00 || c > 0xd7a3) return '로';
  const jong = (c - 0xac00) % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

/** 이 이적시장의 이적 시즌 (여름 = 다가올 시즌) */
export const windowSeason = (league: LeagueState, w: Window): number => (w === 'summer' ? league.season + 1 : league.season);

/** 겨울 이적시장 마지막 날 (그날이 끝나면 NPC 이동) */
/** 시즌 중 이적시장 (겨울 = 1월). 춘추제 리그(3~12월 시즌, C.76c)는 그해 7월 (여름 = 시즌 끝 비시즌) */
export const winterDeadline = (season: number, kind: 'autumn-spring' | 'spring-autumn' = 'autumn-spring'): IsoDate =>
  kind === 'spring-autumn' ? isoDate(season, 7, 31) : isoDate(season + 1, 1, 31);
export const winterOpen = (season: number, kind: 'autumn-spring' | 'spring-autumn' = 'autumn-spring'): IsoDate =>
  kind === 'spring-autumn' ? isoDate(season, 7, 1) : isoDate(season + 1, 1, 1);

/** 이적시장 이름 (C.76c): 8~5월 리그 = 시즌 중 겨울 · 비시즌 여름, 3~12월 리그 = 시즌 중 여름(7월) · 비시즌 겨울 */
export function windowKo(league: Pick<LeagueState, 'id'>, w: Window): string {
  const sa = calendarKind(league.id) === 'spring-autumn';
  return (w === 'winter') !== sa ? '겨울' : '여름';
}

/** 시즌 중 이적시장 여는 날 한 줄 ("1월 1일 겨울" / "7월 1일 여름") */
export function midWindowKo(league: Pick<LeagueState, 'id'>): string {
  return calendarKind(league.id) === 'spring-autumn' ? '7월 1일 여름' : '1월 1일 겨울';
}

// ── 로스터에 이적 기록 적용 (실제 진행과 재생성이 같은 함수를 쓴다) ──

/**
 * 기록 하나를 로스터에 적용한다. 팀 로스터 객체는 새로 만든다 (players 배열 교체).
 * 실제 선수 보충(fill.real, C.76c)은 그때 NPC 상태가 있어야 한다 (npcs 없으면 가상 선수로)
 */
export function applyTransfer(rosters: Rosters, rec: TransferRec, worldSeed: string, npcs?: readonly NpcState[]): void {
  const fromR = rosters[rec.from];
  let mover: RosterPlayer | undefined;
  if (fromR) {
    const players = [...fromR.players];
    const i = players.findIndex((p) => p.id === rec.id);
    if (i >= 0) {
      mover = players[i]!;
      const realIn = rec.fill?.real ? npcs?.find((n) => n.id === rec.fill!.id) : undefined;
      if (realIn) players[i] = realFiller(realIn, rec.season, worldSeed);
      else if (rec.fill) players[i] = makeFiller(rec.fill.id, rec.from, mover.position, rec.fill.ovr, rec.fill.age, rec.season, worldSeed);
      else players.splice(i, 1);
      rosters[rec.from] = { ...fromR, players };
      fixHomegrown(rosters[rec.from]!);
      assignShirts(rosters[rec.from]!);
    }
  }
  const toR = rosters[rec.to];
  if (toR && mover) {
    const players = toR.players.filter((p) => p.id !== rec.rel);
    players.push({ ...mover, contractEnd: rec.ce, loyalty: rec.loy, joined: rec.season });
    rosters[rec.to] = { ...toR, players };
    fixHomegrown(rosters[rec.to]!);
    // 등번호 (C.45): 새 팀에서 겹치면 관례대로 다시
    assignShirts(rosters[rec.to]!);
  }
}

// ── NPC 이적 점수 (18.6) ──

export interface MoveIntent {
  teamId: string;
  player: RosterPlayer;
  ovr: number;
  /** 이적 의향 확률 (그 이적시장 비중을 곱하기 전) */
  p: number;
  score: number;
  why: TransferWhy;
}

/**
 * 출전 시간 비율: 그 팀 경기의 엔진 기록(분)이 시즌을 거의 덮으면(기록된 최다 출전 ≥ 치른 경기 × 0.8) 그 값,
 * 아니면(빠른 진행·빠른 경기) 라인업 위치로 추정
 */
function minutesShareOf(
  id: string, roster: TeamRoster, lineup: { starters: Set<string>; bench: Set<string> }, stats: GameState['playerStats'], played: number,
): number {
  const T = BALANCE.transfer;
  const recorded = Math.max(0, ...roster.players.map((p) => (stats?.[p.id]?.[4] !== undefined ? stats[p.id]![0] : 0)));
  if (played > 0 && recorded >= played * 0.8) return clamp((stats?.[id]?.[4] ?? 0) / (recorded * 90), 0, 1);
  return lineup.starters.has(id) ? T.estShare.starter : lineup.bench.has(id) ? T.estShare.bench : T.estShare.reserve;
}

/** 한 선수의 이적 점수 (push − resist, 노이즈 전)와 가장 큰 이유 */
export function transferScore(o: {
  ovr: number; teamRating: number; age: number; loyalty: number; years: number; expiring: boolean; minutesShare: number; rank: number; winter: boolean;
}): { score: number; why: TransferWhy } {
  const T = BALANCE.transfer;
  const parts: [TransferWhy, number][] = [
    ['contract', o.expiring ? (o.winter ? T.push.contractWinter : T.push.contract) : 0],
    ['minutes', o.minutesShare < T.push.minutesShare ? T.push.minutes : 0],
    ['ambition', Math.max(0, (o.ovr - o.teamRating) * T.push.ambition)],
    ['team', o.rank >= T.push.bottomFrom ? T.push.bottom : 0],
    ['other', o.age >= T.push.veteranAge ? T.push.veteran : 0],
  ];
  const push = parts.reduce((t, [, v]) => t + v, 0);
  const resist = o.loyalty * T.resist.loyalty + Math.min(T.resist.yearsMax, o.years * T.resist.perYear);
  const top = parts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { score: push - resist, why: top[1] > 0 ? top[0] : 'other' };
}

/** 이 이적시장에서 움직이고 싶어 하는 NPC (확률 추첨 전 전체 목록, 측정·테스트용) */
export function moveIntents(state: GameState, w: Window): MoveIntent[] {
  const { league } = state;
  const T = BALANCE.transfer;
  const label = windowSeason(league, w);
  const out: MoveIntent[] = [];
  const ranks = Object.fromEntries(sortedTable(league).map((r, i) => [r.teamId, i + 1]));
  // 이번 이적 시즌에 이적·보충으로 온 선수는 다시 움직이지 않는다 (시작 로스터도 joined = 첫 시즌이라 joined 로는 가리지 않는다)
  const arrived = new Set((state.transfers ?? []).filter((r) => r.season === label).flatMap((r) => [r.id, r.fill?.id ?? '']));
  for (const t of league.teams) {
    const roster = state.rosters[t.id];
    if (!roster) continue;
    const lu = pickLineup(roster);
    const lineup = { starters: new Set(lu.slots.map((s) => s.playerId)), bench: new Set(lu.bench) };
    const played = league.table.find((r) => r.teamId === t.id)?.played ?? 0;
    for (const p of roster.players) {
      if (arrived.has(p.id)) continue;
      const ovr = naturalOvr(p);
      const scored = transferScore({
        ovr, teamRating: t.rating, age: p.age, loyalty: p.loyalty, years: Math.max(0, league.season - p.joined),
        expiring: p.contractEnd <= league.season + 1, minutesShare: minutesShareOf(p.id, roster, lineup, state.playerStats, played),
        rank: ranks[t.id] ?? 10, winter: w === 'winter',
      });
      // 원클럽맨·영원한 <구단> (C.47, NPC): 이적 점수 − (영원한 ×1.5)
      const tag = npcCareerTag(state, p, t.id);
      const why = scored.why;
      const score = scored.score - (tag ? BALANCE.tags.story.oneClubNpcResist * (tag === '원클럽맨' ? 1 : BALANCE.tags.story.eternalMul) : 0);
      out.push({ teamId: t.id, player: p, ovr, p: sigmoid((score - T.center) / T.scale), score, why });
    }
  }
  return out;
}

/** 이적 시즌 label 에 리그 팀이 영입한 수 (내 선수 제외) */
function signingsOf(state: GameState, label: number): Record<string, number> {
  const n: Record<string, number> = {};
  for (const r of state.transfers ?? []) if (r.season === label && !isOutside(r.to)) n[r.to] = (n[r.to] ?? 0) + 1;
  return n;
}

/** 포지션 필요도 0~1: 그 팀 같은 포지션군에서 주전이 되면 1, 1차 백업이면 backupNeed, 아니면 0 */
export function positionNeed(roster: TeamRoster, pos: Position, ovr: number, exceptId?: string): number {
  const g = posGroup(pos);
  const demand = FORMATION_SLOTS[roster.formation].filter((s) => posGroup(s.pos) === g).length || 1;
  const same = roster.players.filter((p) => p.id !== exceptId && posGroup(p.position) === g).map(naturalOvr).sort((a, b) => b - a);
  const starterCut = same[demand - 1] ?? -Infinity;
  const backupCut = same[2 * demand - 1] ?? -Infinity;
  if (ovr > starterCut) return 1;
  if (ovr > backupCut) return BALANCE.transfer.dest.backupNeed;
  return 0;
}

interface Dest { id: string; score: number }

/**
 * 목적지 후보와 점수 (18.6). 리그 팀은 영입 한도가 남은 팀만.
 * 재정 (C.46): 감당 가능한 팀만 (남은 영입 예산 ≥ 몸값, 남은 연봉 여력 ≥ 그 팀에서 받을 연봉). 비자국 육성 상한이 찬 팀은 점수 감점
 */
function destinations(state: GameState, from: string, p: RosterPlayer, ovr: number, signed: Record<string, number>, rng: Rng, value: number, label: number): Dest[] {
  const D = BALANCE.transfer.dest;
  const S = BALANCE.squad;
  const foreignSenior = !isU21(p.age) && !homegrown(p);
  const cur = clubRating(state.league, from);
  const ref = Math.min(cur, ovr + D.refOverOvr);
  const out: Dest[] = [];
  const add = (id: string, rating: number, need: number) => {
    if (rating < ref - D.minGap) return;
    const over = Math.max(0, rating - (ovr + D.overOvr)) * D.overPenalty;
    const noise = gaussian(rng) * D.noiseSd;
    if (!affordable(remainingBudget(state, id, label), wageRoom(state, id, rating), value, npcAnnualWage(p, rating))) return;
    const r = state.rosters[id];
    const hgFull = foreignSenior && r && squadCount(r.players).nonHg >= squadRule().nonHomegrownMax ? S.nonHomegrownPenalty : 0;
    out.push({ id, score: (rating - cur) + need * D.needWeight + noise - over - hgFull });
  };
  for (const t of state.league.teams) {
    if (t.id === from || (signed[t.id] ?? 0) >= BALANCE.transfer.maxSignings) continue;
    const r = state.rosters[t.id];
    if (r) add(t.id, t.rating, positionNeed(r, p.position, ovr));
  }
  // 리그 밖 클럽: 고른 리그의 팀과 같은 클럽이면 그 리그 팀 id 로 (C.76c, 아래 다른 리그 팀에서 한 번만)
  const ids = state.leagueIds ?? [];
  for (const c of OUTSIDE_CLUBS) if (canonicalClub(c.id, ids) === c.id) add(c.id, c.rating, D.outsideNeed);
  // 다른 고른 리그 팀 (C.76c, 45b: 이적 시장 = 고른 리그 전체). 로스터가 없어 리그 밖 클럽처럼 필요도 고정
  for (const lg of state.otherLeagues ?? []) for (const t of lg.teams) add(t.id, t.rating, D.outsideNeed);
  return out;
}

/**
 * 빈자리 보충 실제 선수 (C.76c): 다른 고른 리그(내 리그 제외) 팀에 있는 은퇴 안 한 실제 선수 중 같은 포지션군·OVR 이 보충 OVR ± realGap 안,
 * 지금 팀 레이팅이 받는 팀 + realFromGap 이하 (강팀 선수가 약팀으로 내려오지 않게). realShare 확률로 고르고(가까운 순 상위 3 중 하나),
 * 없으면 가상 선수. 이번 이적시장에 이미 움직인 선수는 뺀다
 */
function realFillCandidate(state: GameState, pos: Position, ovr: number, toRating: number, moved: ReadonlySet<string>, rng: Rng): NpcState | undefined {
  const F = BALANCE.transfer.fill;
  const others = new Map((state.otherLeagues ?? []).map((l) => [l.id, l]));
  if (!others.size || rng() >= F.realShare) return undefined;
  const g = posGroup(pos);
  const fromOk = (n: NpcState): boolean => {
    const team = CLUB_TO_TEAM[n.club];
    const lg = others.get(leagueOfTeam(team) ?? '');
    return !!lg && teamById(lg, team!).rating <= toRating + F.realFromGap;
  };
  const near = (state.npcs ?? [])
    .filter((n) => !n.retired && !moved.has(n.id) && posGroup(n.position) === g && Math.abs(npcOvr(n) - ovr) <= F.realGap && n.age <= F.realMaxAge && fromOk(n))
    .sort((a, b) => Math.abs(npcOvr(a) - ovr) - Math.abs(npcOvr(b) - ovr) || a.id.localeCompare(b.id))
    .slice(0, 3);
  return near.length ? near[Math.floor(rng() * near.length)] : undefined;
}

function pickWeighted<T extends { score: number }>(xs: T[], rng: Rng): T | null {
  const D = BALANCE.transfer.dest;
  const top = [...xs].sort((a, b) => b.score - a.score).slice(0, D.top);
  if (!top.length) return null;
  const w = top.map((x) => Math.exp((x.score - top[0]!.score) / D.temp));
  let r = rng() * w.reduce((t, x) => t + x, 0);
  for (let i = 0; i < top.length; i++) {
    if (r < w[i]!) return top[i]!;
    r -= w[i]!;
  }
  return top[top.length - 1]!;
}

/** 빈자리 보충 선수의 출신 클럽: 레이팅이 보충 OVR 에 가까운 3곳 중 하나 */
function fillerClub(ovr: number, rng: Rng): OutsideClub {
  const near = [...OUTSIDE_CLUBS].sort((a, b) => Math.abs(a.rating - ovr) - Math.abs(b.rating - ovr)).slice(0, 3);
  return near[Math.floor(rng() * near.length)]!;
}

/**
 * 자리를 비울 선수 (C.46: 들어온 뒤 softMax 를 넘거나 리그 상한을 넘을 때만): 같은 포지션군에서 OVR 이 가장 낮은 가상 선수 (없으면 팀 전체에서).
 * 21세 초과 등록 상한이 찬 팀에 21세 초과 선수가 오면 21세 초과 선수를 내보낸다
 */
function releaseCandidate(roster: TeamRoster, pos: Position, arrived: Set<string>, incomingAge: number): RosterPlayer | undefined {
  const S = BALANCE.squad;
  const R = squadRule();
  const c = squadCount(roster.players);
  const seniorFull = !isU21(incomingAge) && c.senior >= R.max;
  if (c.total + 1 <= S.softMax && c.total + 1 <= R.max + R.u21Extra && !seniorFull) return undefined;
  const g = posGroup(pos);
  const low = (xs: RosterPlayer[]) => [...xs].sort((a, b) => naturalOvr(a) - naturalOvr(b))[0];
  const pool = roster.players.filter((p) => !p.real && !p.legend && !arrived.has(p.id) && (!seniorFull || !isU21(p.age)));
  return low(pool.filter((p) => posGroup(p.position) === g)) ?? low(pool);
}

/**
 * NPC 이적시장 하나를 진행한다 (18.6): 이적 의향 추첨 → 목적지 가중 추첨(팀당 시즌 영입 최대 2) → 빈자리 보충 → 기록.
 * 겨울은 리그 팀 레이팅을 로스터 변화만큼 바로 고친다 (18.8, 시즌 팀 컨디션은 유지). 여름은 다음 시즌 시작 때 다시 계산된다
 */
export function runNpcWindow(state: GameState, w: Window): TransferRec[] {
  const { league } = state;
  const T = BALANCE.transfer;
  const label = windowSeason(league, w);
  const rng = rngFor(state.worldSeed, 'transfer', label, w);
  const share = T.windowShare[w];
  const intents = moveIntents(state, w).filter((m) => rng() < m.p * share);
  const signed = signingsOf(state, label);
  const arrived = new Set((state.transfers ?? []).filter((r) => r.season === label).flatMap((r) => [r.id, r.fill?.id ?? '']));
  const before = Object.fromEntries(league.teams.map((t) => [t.id, rosterRating(state.rosters[t.id]!)]));
  const npcById = new Map((state.npcs ?? []).map((n) => [n.id, n]));
  const recs: TransferRec[] = [];
  let k = 0;
  for (const m of intents) {
    if (!state.rosters[m.teamId]!.players.some((x) => x.id === m.player.id)) continue; // 이번 이적시장에 이미 내보낸 선수
    // 몸값 (C.46): 남은 계약 연수 = 계약 만료 − 다가올 시즌 (만료·자유계약이면 0)
    const fee = npcValue(m.player, league.season + 1);
    const dest = pickWeighted(destinations(state, m.teamId, m.player, m.ovr, signed, rng, fee, label), rng);
    if (!dest) continue;
    const fromRating = teamById(league, m.teamId).rating;
    const fOvr = Math.round(Math.max(45, Math.min(m.ovr + T.fill.offset + gaussian(rng) * T.fill.sd, fromRating + T.fill.overTeam)));
    const club = fillerClub(fOvr, rng);
    const fillId = `f:${label}:${w[0]}:${k++}`;
    const filler = makeFiller(fillId, m.teamId, m.player.position, fOvr, randInt(rng, T.fill.minAge, T.fill.maxAge), label, state.worldSeed);
    // 빈자리 보충은 나간 뒤 인원이 fillBelow 아래일 때만 (C.46)
    const fill = state.rosters[m.teamId]!.players.length - 1 < BALANCE.squad.fillBelow;
    // 다른 고른 리그의 실제 선수로 보충 (C.76c). 난수는 따로 (PL 만 고른 게임은 그대로)
    const realIn = fill ? realFillCandidate(state, m.player.position, fOvr, fromRating, arrived, rngFor(state.worldSeed, 'real-fill', label, w, k)) : undefined;
    const toR = state.rosters[dest.id];
    const rel = toR ? releaseCandidate(toR, m.player.position, arrived, m.player.age)?.id : undefined;
    const rec: TransferRec = {
      at: state.roster.updates, season: label, w, id: m.player.id, name: m.player.nameKo, pos: m.player.position, ovr: m.ovr, age: m.player.age,
      from: m.teamId, to: dest.id,
      ce: label + randInt(rng, T.newContract.min, T.newContract.max) - 1,
      loy: Math.round(clamp(m.player.loyalty * T.newLoyalty.keep + T.newLoyalty.mean + gaussian(rng) * T.newLoyalty.sd, 0, 100)),
      why: m.why,
      ...(m.player.real ? { real: true } : {}),
      ...(realIn ? { fill: { id: realIn.id, ovr: npcOvr(realIn), age: realIn.age, club: CLUB_TO_TEAM[realIn.club]!, name: realIn.nameKo, real: true as const } }
        : fill ? { fill: { id: fillId, ovr: naturalOvr(filler), age: filler.age, club: club.id, name: filler.nameKo } } : {}),
      ...(rel ? { rel } : {}),
      ...(fee > 0 ? { fee } : {}),
    };
    applyTransfer(state.rosters, rec, state.worldSeed, state.npcs);
    // 바로 기록해 같은 이적시장의 다음 이동이 남은 예산을 본다
    (state.transfers ??= []).push(rec);
    arrived.add(rec.id).add(rec.fill?.id ?? fillId);
    // 실제 선수 보충: 그 선수 소속을 내 리그 팀으로
    if (realIn) realIn.club = teamById(league, m.teamId).name;
    if (!isOutside(dest.id)) signed[dest.id] = (signed[dest.id] ?? 0) + 1;
    const n = npcById.get(m.player.id);
    if (n) n.club = isOutside(dest.id) ? OUTSIDE_BY_ID[dest.id]!.name : teamById(league, dest.id).name;
    recs.push(rec);
  }
  if (w === 'winter') {
    for (const t of league.teams) {
      const d = rosterRating(state.rosters[t.id]!) - before[t.id]!;
      if (d !== 0) t.rating = Math.round((t.rating + d) * 10) / 10;
    }
  }
  return recs;
}

/** 재생성: 적용 시점이 at 인 기록을 차례로 적용 (npcs = 그때 실제 선수 상태, 실제 선수 보충용) */
export function replayTransfers(rosters: Rosters, recs: readonly TransferRec[], at: number, worldSeed: string, npcs?: readonly NpcState[]): void {
  for (const r of recs) if (r.at === at) applyTransfer(rosters, r, worldSeed, npcs);
}

/** 가장 최근 이적시장의 기록 (월드 "이적 소식") */
export function latestWindow(state: GameState): { season: number; w: Window; recs: TransferRec[] } | null {
  const all = state.transfers ?? [];
  const last = all.at(-1);
  if (!last) return null;
  return { season: last.season, w: last.w, recs: all.filter((r) => r.season === last.season && r.w === last.w) };
}

/** 실제 선수 이적 반영: NpcState.club (재생성은 데이터의 시작 클럽 + 기록 재적용이라 이 값은 화면용) */
export function syncNpcClubs(npcs: NpcState[], recs: readonly TransferRec[], league: LeagueState): void {
  const byId = new Map(npcs.map((n) => [n.id, n]));
  for (const r of recs) {
    const n = byId.get(r.id);
    if (n) n.club = isOutside(r.to) ? OUTSIDE_BY_ID[r.to]?.name ?? n.club : league.teams.find((t) => t.id === r.to)?.name ?? leagueTeamById(r.to)?.name ?? n.club;
    const f = r.fill?.real ? byId.get(r.fill.id) : undefined;
    if (f) f.club = league.teams.find((t) => t.id === r.from)?.name ?? f.club;
  }
}

// ── 내 선수 (18.10) ──

export interface MyContract {
  teamId: string;
  /** 계약 시작 시즌, 마지막 시즌 (그 시즌이 끝나면 만료) */
  from: number;
  until: number;
  /** 주급 (만 원). 돈은 money.ts (C.68a) */
  wage: number;
  /** 임대 중이면 원 소속팀과 임대 마지막 시즌 */
  loan?: { parent: string; until: number } | null;
  /** 바이아웃 (만 원, C.48): 이 금액 이상 제안은 구단이 거절할 수 없다. 없으면(옛 세이브) 계약 길이로 계산 (myBuyout) */
  buyout?: number;
}

export type OfferKind = 'transfer' | 'loan';

export interface Offer {
  teamId: string;
  kind: OfferKind;
  /** 계약 연수 (임대는 1) */
  years: number;
  wage: number;
  /** 예상 선발 확률 (0~1) */
  start: number;
  /** 팀 입장 관심 점수 (정렬·측정용) */
  interest: number;
  /** 1군 테스트 합격 뒤 유스 구단(지금 팀) 계약 제안 (C.45) */
  youth?: boolean;
  /** 제안 이적료 (만 원, C.48). 계약 만료(자유계약)·임대면 없음 */
  fee?: number;
}

/** 소속 구단이 거절한 제안 (C.48): 고를 수 없고 뉴스 한 줄 */
export interface RefusedOffer { teamId: string; fee: number }

/** 내 선수 이적 시장 상태 (세이브에 담는다) */
export interface MarketState {
  contract: MyContract;
  /** 응답이 필요한 제안 (없으면 null) */
  offers: Offer[] | null;
  /** 이번 창에 소속 구단이 거절한 제안 (C.48, 뉴스 한 줄) */
  refused?: RefusedOffer[] | null;
  /** 제안이 온 이적시장 */
  offerWindow?: Window;
  /** 계약 만료: 재계약 선택이 남았다 */
  renewal: { years: number[]; wage: number } | null;
  /** 이적 요청 결과 (시즌당 1번) */
  request: { season: number; accepted: boolean } | null;
  /** 커리어 이적 (내 선수) */
  moves: { season: number; w: Window; from: string; to: string; loan?: boolean; back?: boolean }[];
  /** 이번 시즌 이적·복귀로 바뀐 팀 알림 (홈 카드 한 번) */
  notice?: string | null;
  /** 자유계약 신분 (C.45 시작 소속 없음·테스트 결과·방출): 제안을 모두 거절할 수 없다 */
  free?: boolean;
  /** 테스트·재계약에서 방출됐다 (방출의 설움 태그) */
  released?: boolean;
}

/** 나이에 따른 계약 연수 범위 */
export function contractYears(age: number): [number, number] {
  const row = BALANCE.transfer.years.find(([maxAge]) => age <= maxAge)!;
  return [row[1], row[2]];
}

/** 주급 (만 원, 19.11 곡선): 위상 앵커 사이 로그 선형 × 팀 규모 × OVR, ±15%, 50만 원 단위 */
export function wageFor(reputation: number, ovr: number, teamRating: number, mul = 1): number {
  const T = BALANCE.transfer;
  const c = T.wageCurve;
  const r = clamp(reputation, 0, c[c.length - 1]![0]);
  let base = c[c.length - 1]![1];
  for (let i = 1; i < c.length; i++) {
    const [r1, w1] = c[i]!;
    if (r <= r1) {
      const [r0, w0] = c[i - 1]!;
      base = Math.exp(Math.log(w0) + ((r - r0) / (r1 - r0)) * (Math.log(w1) - Math.log(w0)));
      break;
    }
  }
  const adj = clamp((teamRating - 75) * T.wageTeam + (ovr - 75) * T.wageOvr, -T.wageSpread, T.wageSpread);
  // 스타 플레이어 (C.45 장점): 연봉 × mul
  return Math.max(50, Math.round((base * (1 + adj) * mul) / 50) * 50);
}

/** 주급 표시 (만 원 → "1,050만 원" / "1.5억 원") */
export function wageLabel(w: number): string {
  return w >= 10000 ? `${(w / 10000).toFixed(w % 10000 === 0 ? 0 : 2).replace(/0$/, '')}억 원` : `${w.toLocaleString('ko-KR')}만 원`;
}

/** 연봉 표시 (×52) */
export function annualLabel(w: number): string {
  const y = w * 52;
  return y >= 10000 ? `${(y / 10000).toFixed(1)}억 원` : `${y.toLocaleString('ko-KR')}만 원`;
}

/** 새 게임 계약: 가상 유망주 3년, 실제 선수는 시드로 1~5년 */
export function initialContract(state: Pick<GameState, 'worldSeed' | 'league' | 'player' | 'phase'>): MyContract {
  const p = state.player;
  const season = state.league.season;
  const years = p.realPlayerId ? randInt(rngFor(state.worldSeed, 'my-contract'), ...contractYears(p.age)) : BALANCE.transfer.newGameYears;
  const rating = ratingOf(state as GameState, p.teamId);
  return { teamId: p.teamId, from: season, until: season + years - 1, wage: wageFor(p.reputation, proficientOvr(p, p.position), rating, wageMul(p)), loan: null, buyout: buyoutFor(p, years) };
}

/** 바이아웃 (C.48): 계약할 때 몸값(그 연수 기준) × buyoutMul */
export function buyoutFor(p: GameState['player'], years: number): number {
  const O = BALANCE.transfer.offers;
  const ovr = proficientOvr(p, p.position);
  const unit = BALANCE.finance.value.unit;
  const v = marketValue({ ovr, age: p.age, peak: p.peakTarget ?? ovr + Math.max(0, O.youthAge - p.age) * O.youthPerYear, reputation: p.reputation, yearsLeft: years });
  return Math.round((v * O.buyoutMul) / unit) * unit;
}

/** 지금 계약의 바이아웃 (옛 세이브는 계약 길이로 계산) */
export function myBuyout(state: Pick<GameState, 'market' | 'player'>): number {
  const c = state.market.contract;
  return c.buyout ?? buyoutFor(state.player, c.until - c.from + 1);
}

export function initialMarket(state: Pick<GameState, 'worldSeed' | 'league' | 'player' | 'phase'>): MarketState {
  return { contract: initialContract(state), offers: null, renewal: null, request: null, moves: [], notice: null };
}

/** 응답이 필요한 일 (제안·재계약)이 남았다: [계속]·휴가 넘기기·[다음 시즌]이 멈춘다 */
export function marketPending(state: GameState): boolean {
  const m = state.market;
  return !!m && (!!m.offers?.length || !!m.renewal);
}

/** 이번 시즌 내 출전 시간 비율 (내 팀 치른 경기 기준) */
function myShares(state: GameState): { starts: number; minutes: number; games: number } {
  const s = state.player.season;
  const games = state.matchLog?.length ?? s.apps;
  return { games, starts: games ? s.starts / games : 1, minutes: games ? s.minutes / (games * 90) : 1 };
}

/** 출전 시간 비율 판단: 이번 시즌 내 팀 경기를 minGames 이상 치렀으면 이번 시즌, 아니면 지난 시즌 기록 (없으면 null) */
function recentShare(state: GameState): number | null {
  const sh = myShares(state);
  if (state.phase === 'season' && sh.games >= BALANCE.transfer.request.minGames) return Math.min(sh.starts, sh.minutes);
  const h = state.player.history.at(-1);
  return h ? h.minutes / Math.max(1, state.league.schedule.length * 90) : null;
}

/** 팀 레이팅 → 그 팀 주전에게 기대되는 위상 (선형 보간) */
export function teamReputation(rating: number): number {
  const t = BALANCE.transfer.teamRep;
  if (rating <= t[0]![0]) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [r1, v1] = t[i]!;
    if (rating <= r1) {
      const [r0, v0] = t[i - 1]!;
      return v0 + ((rating - r0) / (r1 - r0)) * (v1 - v0);
    }
  }
  return t[t.length - 1]![1];
}

/** 그 팀에서 내 예상 선발 확률 */
export function expectedStart(state: GameState, teamId: string): number {
  const p = state.player;
  return startProbability(proficientOvr(p, p.position), ratingOf(state, teamId), 0);
}

export function startLabel(p: number): string {
  return p >= 0.7 ? '주전' : p >= 0.4 ? '로테이션' : '벤치';
}

/** 팀 입장 관심 점수 (18.6 점수 모델을 팀 입장으로): 포지션 필요도 + 수준 맞음 + 위상 */
function interestOf(state: GameState, teamId: string, rng: Rng): number {
  const O = BALANCE.transfer.offers;
  const p = state.player;
  const ovr = proficientOvr(p, p.position);
  const roster = state.rosters[teamId];
  const need = roster ? positionNeed(roster, p.position, ovr) : 0.5;
  // 수준이 맞는 팀일수록 관심 (어린 선수는 잠재력만큼 OVR 을 높여 본다)
  const eff = ovr + Math.max(0, O.youthAge - p.age) * O.youthPerYear;
  return -Math.abs(eff - ratingOf(state, teamId) - O.fitOffset) * O.fit + need * O.needWeight + p.reputation / O.repDiv + gaussian(rng) * O.noiseSd;
}

/** 내 선수 남은 계약 연수 (이적 시즌 기준). 자유계약·만료면 0 */
export function myYearsLeft(state: Pick<GameState, 'market' | 'league' | 'phase'>): number {
  const m = state.market;
  if (!m || m.free || m.renewal) return 0;
  const next = state.league.season + (state.phase === 'season' ? 0 : 1);
  return Math.max(0, m.contract.until - next + 1);
}

/** 내 선수 몸값 (만 원, C.46): OVR·나이·잠재력(전성기 목표)·위상·남은 계약 */
export function myValue(state: GameState): number {
  const p = state.player;
  const ovr = proficientOvr(p, p.position);
  return marketValue({ ovr, age: p.age, peak: p.peakTarget ?? ovr + Math.max(0, BALANCE.transfer.offers.youthAge - p.age) * BALANCE.transfer.offers.youthPerYear, reputation: p.reputation, yearsLeft: myYearsLeft(state) });
}

/**
 * 재정 (C.46): 그 팀이 내 선수를 감당할 수 있으면 제안 주급(남은 연봉 여력 안으로 깎음), 못 하면 null.
 * 몸값 > 남은 영입 예산이거나 여력이 원래 주급의 minWageShare 아래면 못 한다
 */
export function affordableWage(state: GameState, teamId: string, wage: number, w: Window, value = myValue(state)): number | null {
  const F = BALANCE.finance;
  const label = windowSeason(state.league, w);
  if (remainingBudget(state, teamId, label) < value) return null;
  const room = Math.floor(wageRoom(state, teamId, ratingOf(state, teamId)) / 52);
  if (room < wage * F.minWageShare) return null;
  return Math.max(50, Math.min(wage, Math.floor(room / 50) * 50));
}

/** 남은 계약에 따른 제안 단계 (C.48): 남은 0~1시즌(만료·마지막 해) last, 2시즌 one, 3시즌 이상 more. 이번 시즌 이적 명단(요청 수락)이면 last */
export type OfferTier = 'last' | 'one' | 'more';
export function offerTier(state: GameState): OfferTier {
  const m = state.market;
  if (m?.request?.season === state.league.season && m.request.accepted) return 'last';
  const y = myYearsLeft(state);
  return y <= 1 ? 'last' : y === 2 ? 'one' : 'more';
}

/** 내가 팀 OVR 상위 3 안인지 (로스터 NPC 와 비교, 구단 수락 판정) */
export function myTop3(state: GameState): boolean {
  const p = state.player;
  const ovr = proficientOvr(p, p.position);
  return (state.rosters[p.teamId]?.players ?? []).filter((x) => naturalOvr(x) > ovr).length < 3;
}

/** 소속 구단이 이적료 fee 제안을 받아들일 확률 (C.48). 바이아웃 이상이면 1 */
export function clubAcceptChance(state: GameState, fee: number, value = myValue(state)): number {
  const C = BALANCE.transfer.offers.club;
  if (value <= 0 || fee >= myBuyout(state)) return 1;
  return clamp(C.base + (fee / value - 1) * C.slope - (myTop3(state) ? C.top3 : 0), C.minP, 1);
}

/**
 * 제안 만들기 (18.10, C.48): 리그 팀(내 팀·원 소속팀 제외) 관심 상위 n개 — n 은 남은 계약별 (byYears), 2년 이상 남으면 지금 팀보다 강한 팀만.
 * 감당 가능한 팀만 (C.46). 계약 중이면 이적료를 붙이고 소속 구단이 수락 판정 (거절된 제안은 refused).
 * 21세 이하이고 출전이 부족하면 임대 제안 1~2개 (내가 주전이 될 약팀)
 */
export function makeOfferSet(state: GameState, w: Window, tag: string | number = state.league.season): { offers: Offer[]; refused: RefusedOffer[] } {
  const T = BALANCE.transfer;
  const O = T.offers;
  const p = state.player;
  const rng = rngFor(state.worldSeed, 'offers', tag, w);
  const m = state.market;
  const exclude = new Set([p.teamId, m?.contract.loan?.parent].filter(Boolean) as string[]);
  const ovr = proficientOvr(p, p.position);
  const value = myValue(state);
  const tier = offerTier(state);
  const cur = ratingOf(state, p.teamId);
  const pool = state.league.teams
    .filter((t) => !exclude.has(t.id))
    .map((t) => ({ t, interest: interestOf(state, t.id, rng), wage: affordableWage(state, t.id, wageFor(p.reputation, ovr, ratingOf(state, t.id), wageMul(p)), w, value) }))
    .sort((a, b) => b.interest - a.interest);
  const n = randInt(rng, ...O.byYears[tier]);
  const [ylo, yhi] = contractYears(p.age);
  const picked = pool.filter((x) => x.wage !== null && (tier !== 'more' || ratingOf(state, x.t.id) > cur)).slice(0, n);
  const offers: Offer[] = picked.map(({ t, interest, wage }) => ({
    teamId: t.id, kind: 'transfer', years: randInt(rng, ylo, yhi), wage: wage!, start: expectedStart(state, t.id), interest,
  }));
  // 다른 리그 제안 (C.76c): 비시즌 여름 창, 내 리그와 달력이 같은 고른 리그 팀. 난수는 따로 (다른 리그가 없으면 그대로)
  if (w === 'summer' && state.phase !== 'season') offers.push(...abroadOffers(state, tag, tier, cur, value, ylo, yhi));
  // 소속 구단 수락 판정 (C.48): 계약 중(몸값 > 0)이고 이적 명단이 아니면. 난수는 따로 (임대 제안이 바뀌지 않게)
  const refused: RefusedOffer[] = [];
  const listed = m?.request?.season === state.league.season && !!m.request.accepted;
  if (value > 0) {
    const C = O.club;
    const unit = BALANCE.finance.value.unit;
    const crng = rngFor(state.worldSeed, 'club-accept', tag, w);
    const label = windowSeason(state.league, w);
    for (const o of offers) {
      const raw = value * (C.feeMin + crng() * (C.feeMax - C.feeMin));
      o.fee = Math.max(unit, Math.round(Math.min(raw, Math.max(value, remainingBudget(state, o.teamId, label))) / unit) * unit);
      const roll = crng();
      if (!listed && roll >= clubAcceptChance(state, o.fee, value)) refused.push({ teamId: o.teamId, fee: o.fee });
    }
  }
  const kept = offers.filter((o) => !refused.some((r) => r.teamId === o.teamId));
  // 임대 (21세 이하 + 출전 부족, 1시즌)
  if (p.age <= T.loan.maxAge && (recentShare(state) ?? 1) < T.loan.maxShare && !m?.contract.loan) {
    const taken = new Set(offers.map((o) => o.teamId));
    const loans = state.league.teams
      .filter((t) => !exclude.has(t.id) && !taken.has(t.id))
      .map((t) => ({ t, interest: interestOf(state, t.id, rng), start: expectedStart(state, t.id) }))
      .sort((a, b) => b.start - a.start || ratingOf(state, b.t.id) - ratingOf(state, a.t.id));
    const k = randInt(rng, T.loan.offers[0], T.loan.offers[1]);
    for (const { t, interest } of loans.slice(0, k)) {
      kept.push({ teamId: t.id, kind: 'loan', years: 1, wage: m?.contract.wage ?? wageFor(p.reputation, ovr, ratingOf(state, t.id), wageMul(p)), start: expectedStart(state, t.id), interest });
    }
  }
  return { offers: kept, refused };
}

/** 내 선수가 옮길 수 있는 다른 리그 (C.76c): 고른 다른 리그 중 내 리그와 달력이 같은 리그 (시즌 번호가 같이 간다) */
export function movableLeagues(state: Pick<GameState, 'league' | 'otherLeagues'>): string[] {
  const kind = calendarKind(state.league.id);
  return (state.otherLeagues ?? []).filter((o) => calendarKind(o.id) === kind).map((o) => o.id);
}

/** 다른 리그 제안 (C.76c): 관심 상위 n 개 (BALANCE.transfer.offers.abroad), 감당 가능한 팀만, 2년 이상 남으면 지금 팀보다 강한 팀만 */
function abroadOffers(state: GameState, tag: string | number, tier: OfferTier, cur: number, value: number, ylo: number, yhi: number): Offer[] {
  const ids = new Set(movableLeagues(state));
  if (!ids.size) return [];
  const O = BALANCE.transfer.offers;
  const p = state.player;
  const ovr = proficientOvr(p, p.position);
  const rng = rngFor(state.worldSeed, 'offers-abroad', tag);
  const pool = (state.otherLeagues ?? []).filter((o) => ids.has(o.id)).flatMap((o) => o.teams)
    .map((t) => ({ t, interest: interestOf(state, t.id, rng), wage: affordableWage(state, t.id, wageFor(p.reputation, ovr, ratingOf(state, t.id), wageMul(p)), 'summer', value) }))
    .filter((x) => x.wage !== null && (tier !== 'more' || ratingOf(state, x.t.id) > cur))
    .sort((a, b) => b.interest - a.interest || a.t.id.localeCompare(b.t.id));
  const n = randInt(rng, ...O.abroad[tier]);
  return pool.slice(0, n).map(({ t, interest, wage }) => ({
    teamId: t.id, kind: 'transfer' as const, years: randInt(rng, ylo, yhi), wage: wage!, start: expectedStart(state, t.id), interest,
  }));
}

/** 고를 수 있는 제안만 (구단이 거절한 제안 빼고) */
export function makeOffers(state: GameState, w: Window, tag: string | number = state.league.season): Offer[] {
  return makeOfferSet(state, w, tag).offers;
}

/** 이적시장 창의 제안을 연다: 고를 수 있는 제안 + 구단이 거절한 제안 뉴스 */
function openOffers(state: GameState, w: Window, tag?: string | number): void {
  const m = state.market;
  const r = makeOfferSet(state, w, tag);
  m.offers = r.offers;
  m.refused = r.refused.length ? r.refused : null;
  m.offerWindow = w;
}

/** 비시즌 시작 (시즌 종료 직후): 임대 복귀 → 계약 만료면 재계약 선택 → 제안 3~5개 */
export function openOffseasonMarket(state: GameState): void {
  const m = (state.market ??= initialMarket(state));
  const season = state.league.season;
  const p = state.player;
  // 임대 끝: 원 소속팀으로 복귀
  if (m.contract.loan && m.contract.loan.until <= season) {
    const parent = m.contract.loan.parent;
    m.moves.push({ season: season + 1, w: 'summer', from: p.teamId, to: parent, back: true });
    joinTeam(state, parent);
    m.contract.loan = null;
    const name = clubNameKo(state.league, parent);
    m.notice = `임대가 끝나 ${name}${ro(name)} 돌아왔어요.`;
  }
  const rating = ratingOf(state, p.teamId);
  if (m.contract.until <= season) {
    const [lo, hi] = contractYears(p.age);
    m.renewal = { years: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), wage: wageFor(p.reputation, proficientOvr(p, p.position), rating, wageMul(p)) };
  }
  openOffers(state, 'summer');
}

/** 팀을 옮긴다: 소속팀, 전술(새 팀 기본값). 숙련도·적성·덱·능력치는 선수 것이라 그대로 (부록 C.42) */
function joinTeam(state: GameState, teamId: string): void {
  // 떠나는 팀 등번호는 내 번호 자리 비움 없이 다시 (세이브 재생성과 같게, C.46)
  const old = state.rosters[state.player.teamId];
  if (old) assignShirts(old);
  state.player.teamId = teamId;
  state.tactics = teamDefaultTactics(teamId, state.rosters[teamId], state.player.position);
}

/** 약팀 이적 위상 감점 (D.19): 새 팀 레이팅이 minGap 이상 낮으면 (차이 − minGap + 1) × perPoint, 최대 maxShare */
export function weakMovePenalty(reputation: number, fromRating: number, toRating: number): number {
  const W = BALANCE.reputation.weakMove;
  const gap = fromRating - toRating;
  if (gap < W.minGap) return 0;
  return Math.round(reputation * Math.min(W.maxShare, (gap - W.minGap + 1) * W.perPoint));
}

/** 제안 수락: 이적(새 계약) 또는 임대(계약 그대로, 1시즌 뒤 복귀). 재계약 선택은 지운다 (FA 이적) */
export function acceptOffer(state: GameState, index: number, deduct: (points: number) => number): { points: number } {
  const m = state.market!;
  const o = m.offers?.[index];
  if (!o) throw new Error('제안이 없음');
  const p = state.player;
  const from = p.teamId;
  const fromRating = ratingOf(state, from);
  const toRating = ratingOf(state, o.teamId);
  const w = m.offerWindow ?? (state.phase === 'season' ? 'winter' : 'summer');
  const season = windowSeason(state.league, w);
  let points = 0;
  if (o.teamId === from) {
    // 지금 팀과 계약 (C.45: 1군 테스트 합격 뒤 유스 구단 제안, 자유계약 신분에서 같은 팀)
    m.contract = { teamId: from, from: state.league.season + (state.phase === 'season' ? 0 : 1), until: state.league.season + (state.phase === 'season' ? 0 : 1) + o.years - 1, wage: o.wage, loan: null, buyout: buyoutFor(p, o.years) };
    m.offers = null;
    m.refused = null;
    m.renewal = null;
    m.notice = `${clubNameKo(state.league, from)} 1군 계약`;
    // 재정 (C.68a): 계약금·에이전트 수수료
    onContractSigned(state, m.contract, `${clubNameKo(state.league, from)} 1군 계약`);
    onClubChange(state, from);
    return { points };
  }
  if (o.kind === 'loan') {
    m.contract.loan = { parent: from, until: season };
  } else {
    points = deduct(weakMovePenalty(p.reputation, fromRating, toRating));
    m.contract = { teamId: o.teamId, from: season, until: season + o.years - 1, wage: o.wage, loan: null, buyout: buyoutFor(p, o.years) };
    onContractSigned(state, m.contract, `${clubNameKo(state.league, o.teamId)} 이적`);
  }
  m.moves.push({ season, w, from, to: o.teamId, ...(o.kind === 'loan' ? { loan: true } : {}) });
  // 다른 리그 팀 (C.76c): 새 리그 로스터를 만들고 다음 시즌부터 그 리그가 내 리그 (applyLeagueMove)
  prepareLeagueMove(state, o.teamId);
  // 원클럽맨 계열 (C.45): 이적이면 떨어지고 새 구단 기록 (임대는 이적 아님)
  if (o.kind !== 'loan') onClubChange(state, o.teamId);
  joinTeam(state, o.teamId);
  m.offers = null;
  m.refused = null;
  m.renewal = null;
  m.notice = `${clubNameKo(state.league, o.teamId)}${o.kind === 'loan' ? ' 임대 합류' : ' 이적 완료'}`;
  return { points };
}

/** 모든 제안 거절 (재계약 선택은 남는다) */
export function declineOffers(state: GameState): void {
  const m = state.market!;
  // 자유계약 신분 (C.45)이면 하나는 골라야 한다
  if (m.free) return;
  m.offers = null;
  m.refused = null;
}

/** 재계약 (연장): years 년, 지금 팀 */
export function renewContract(state: GameState, years: number): void {
  const m = state.market!;
  if (!m.renewal) throw new Error('재계약할 계약이 없음');
  const season = state.league.season + (state.phase === 'season' ? 0 : 1);
  m.contract = { teamId: state.player.teamId, from: season, until: season + years - 1, wage: m.renewal.wage, loan: null, buyout: buyoutFor(state.player, years) };
  m.renewal = null;
  onContractSigned(state, m.contract, '재계약');
  onRenewal(state);
}

/**
 * 이적 요청을 할 수 있는지 (18.10, C.62 신뢰도 훅): 감독 신뢰도가 requestBelow 미만, 또는 위상이 팀 격차를 넘을 때.
 * 출전 시간 부족은 시즌 중반 "낮은 신뢰 면담"이 열려 그 면담에서 요청한다 (viaMeeting)
 */
export function requestEligibility(state: GameState, viaMeeting = false): { ok: boolean; reason: string } {
  const R = BALANCE.transfer.request;
  const m = state.market;
  if (state.phase !== 'season') return { ok: false, reason: '시즌 중에만 요청할 수 있어요 (비시즌에는 제안을 받아요)' };
  if (m?.contract.loan) return { ok: false, reason: '임대 중에는 요청할 수 없어요' };
  if (m?.request?.season === state.league.season) return { ok: false, reason: m.request.accepted ? '이미 이적 명단에 올랐어요' : '이번 시즌에는 이미 거절당했어요' };
  if (marketPending(state)) return { ok: false, reason: '먼저 받은 제안에 답해 주세요' };
  if (state.calendar.date > winterDeadline(state.league.season)) return { ok: false, reason: '겨울 이적시장이 닫혔어요 (비시즌에 제안이 와요)' };
  if (viaMeeting) return { ok: true, reason: '감독 면담에서 이적을 요청해요' };
  const p = state.player;
  const trust = trustOf(state);
  const below = BALANCE.manager.requestBelow;
  if (trust < below) return { ok: true, reason: `감독 신뢰도가 낮아요 (${Math.round(trust)})` };
  const rating = ratingOf(state, p.teamId);
  const ovr = proficientOvr(p, p.position);
  if (p.reputation >= teamReputation(rating) + R.repOver && ovr >= rating + R.ovrOver) return { ok: true, reason: '내 위상이 팀 수준을 넘었어요' };
  return { ok: false, reason: `감독 신뢰도 ${below} 미만이거나 위상이 팀 수준을 넘어야 해요 (출전이 적으면 시즌 중반 감독 면담에서)` };
}

/** 팀 내 OVR 1위인지 (로스터 NPC 와 비교) */
function topOfTeam(state: GameState): boolean {
  const p = state.player;
  const ovr = proficientOvr(p, p.position);
  return (state.rosters[p.teamId]?.players ?? []).every((x) => naturalOvr(x) <= ovr);
}

/** 놓아줄 확률 = 기본 70% (계약 만료 시즌이면 100%) − 팀 내 OVR 1위면 30%p */
export function releaseChance(state: GameState): number {
  const R = BALANCE.transfer.request;
  const m = state.market!;
  const base = m.contract.until <= state.league.season ? 1 : R.base;
  return clamp(base - (topOfTeam(state) ? R.topPenalty : 0), 0, 1);
}

/**
 * 이적 요청 (시즌 중, 시즌당 1번): 구단이 놓아주면 이적 명단 → 겨울 이적시장(1월)이 열려 있으면 바로, 아니면 1월 1일에 제안.
 * 거절되면 이번 시즌은 끝
 */
export function requestTransfer(state: GameState, viaMeeting = false): { accepted: boolean; chance: number; offersNow: boolean } {
  const el = requestEligibility(state, viaMeeting);
  if (!el.ok) throw new Error(el.reason);
  const m = state.market!;
  const chance = releaseChance(state);
  const accepted = rngFor(state.worldSeed, 'request', state.league.season)() < chance;
  m.request = { season: state.league.season, accepted };
  let offersNow = false;
  if (accepted && state.calendar.date >= winterOpen(state.league.season)) {
    openOffers(state, 'winter', `req${state.league.season}`);
    offersNow = true;
  }
  return { accepted, chance, offersNow };
}

/** 하루가 끝날 때 (endDay): 1월 1일이 되면 이적 명단의 내 선수에게 제안, 1월 31일이 끝나면 NPC 겨울 이적시장 */
export function onDayEnd(state: GameState, endedDate: IsoDate): TransferRec[] {
  const season = state.league.season;
  const m = state.market;
  const kind = calendarKind(state.league.id);
  if (m?.request?.season === season && m.request.accepted && !m.offers && addDays(endedDate, 1) === winterOpen(season, kind)) {
    openOffers(state, 'winter', `req${season}`);
  }
  if (endedDate === winterDeadline(season, kind)) {
    // 마감까지 답하지 않은 겨울 제안은 사라진다
    if (m?.offerWindow === 'winter') {
      m.offers = null;
      m.refused = null;
    }
    return runNpcWindow(state, 'winter');
  }
  return [];
}

/** 커리어 시뮬(밸런스·테스트)의 자동 응답: stay = 모두 거절·재계약, best = 레이팅이 minGain 이상 높고 주전/로테이션인 제안 중 최고 */
export function autoResolveMarket(state: GameState, policy: 'stay' | 'best', deduct: (points: number) => number, minGain = 2): void {
  const m = state.market;
  if (!m) return;
  // 자유계약 신분 (C.45)이면 하나는 수락한다: 유스 구단 제안이 있으면 그것, 아니면 첫 제안
  if (m.free && m.offers?.length) {
    const i = Math.max(0, m.offers.findIndex((o) => o.youth));
    acceptOffer(state, i, deduct);
    m.free = false;
    m.released = false;
    return;
  }
  if (m.offers?.length && policy === 'best') {
    const cur = ratingOf(state, state.player.teamId);
    const ok = m.offers
      .map((o, i) => ({ o, i, r: ratingOf(state, o.teamId) }))
      .filter((x) => x.o.kind === 'transfer' && x.r >= cur + minGain && x.o.start >= 0.4)
      .sort((a, b) => b.r - a.r)[0];
    if (ok) {
      acceptOffer(state, ok.i, deduct);
      return;
    }
  }
  if (m.offers) declineOffers(state);
  if (m.renewal) renewContract(state, m.renewal.years[Math.floor(m.renewal.years.length / 2)]!);
}

/** 팀 레이팅 순위 (1 = 최강, 제안 화면 표시용) */
export function teamRank(state: Pick<GameState, 'phase' | 'league' | 'nextRatings'>, teamId: string): number {
  const own = ratingOf(state, teamId);
  return 1 + state.league.teams.filter((t) => ratingOf(state, t.id) > own).length;
}

/** 제안 하나 거절. 남은 제안이 없으면 응답 끝 */
export function declineOffer(state: GameState, index: number): void {
  const m = state.market!;
  if (!m.offers) return;
  if (m.free && m.offers.length <= 1) return;
  m.offers = m.offers.filter((_, i) => i !== index);
  if (!m.offers.length) m.offers = null;
}

export const WHY_KO: Record<TransferWhy, string> = {
  contract: '계약 만료', minutes: '출전 시간', ambition: '더 큰 무대', team: '팀 성적', other: '새 도전',
};
