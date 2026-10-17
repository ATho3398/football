// 리그별 로스터 인원 (pending 62.1, 부록 C.46): 최소·최대(21세 초과 등록 상한) + 21세 이하 추가, 비자국 육성 상한.
// 표는 6개 리그 모두 BALANCE.squad.leagues 에 두고 지금은 PL 만 쓴다. 위반은 경고 없이 자동 조정한다
// (생성기: 21세 이하 추가 유망주, 육성 이력 표시 / 시즌 갱신: 가장 낮은 순위 방출·보충 / 이적: 목적지 점수).

import { REAL_CAREER } from '../data/players/careers';
import { A_GRADE_PLAYERS } from '../data/players';
import { OUTSIDE_CLUBS } from '../data/outsideClubs';
import { BALANCE } from './config/balance';
import { initialTeams } from './league';
import { createRng, hashSeed } from './rng';
import { naturalOvr, pickLineup, posGroup, type RosterPlayer, type TeamRoster } from './roster';

export type LeagueKey = keyof typeof BALANCE.squad.leagues;

/** 지금 리그 (PL 하나) */
export const CURRENT_LEAGUE: LeagueKey = 'pl';

export const squadRule = (league: LeagueKey = CURRENT_LEAGUE) => BALANCE.squad.leagues[league];

export const isU21 = (age: number): boolean => age <= BALANCE.squad.u21Age;

const PL_IDS = new Set(initialTeams().map((t) => t.id));
const REAL_NATION = new Map(A_GRADE_PLAYERS.map((p) => [p.id, p.nationality]));

/** 생성 선수 유스 구단 (npcTags.npcYouth 와 같은 시드·규칙, 리그 밖 구단은 모두 '밖'으로 본다) */
function virtualYouthIsPl(id: string): boolean {
  const own = /^v:([^:]+):/.exec(id)?.[1];
  const rng = createRng(hashSeed(`youth:${id}`));
  if (own && rng() < BALANCE.tags.npcOwnYouth) return PL_IDS.has(own);
  // npcYouth: 리그 팀 + 리그 밖 클럽 중 하나. 앞쪽이 리그 팀
  const n = PL_IDS.size + OUTSIDE_CLUBS.length;
  return Math.floor(rng() * n) < PL_IDS.size;
}

/**
 * 자국 육성 (근사): 2018-19 PL 규정은 국적이 아니라 21세 전 잉글랜드·웨일스 구단 등록 3시즌.
 * 국적(잉글랜드·웨일스·스코틀랜드·북아일랜드) 또는 PL 구단 유스 출신 또는 자동 조정 표시(hg)로 본다
 */
export function homegrown(p: Pick<RosterPlayer, 'id' | 'real' | 'nationality' | 'hg'> & { youth?: string }): boolean {
  if (p.hg) return true;
  // 레전드 (C.47): 처음 소속 PL 팀 유스
  if (p.youth) return PL_IDS.has(p.youth);
  const nat = p.real ? REAL_NATION.get(p.id) ?? '' : p.nationality;
  if (BALANCE.squad.homegrownNations.includes(nat)) return true;
  if (p.real) {
    const y = REAL_CAREER[p.id]?.youth;
    return !!y && PL_IDS.has(y);
  }
  return virtualYouthIsPl(p.id);
}

export interface SquadCount { total: number; senior: number; u21: number; nonHg: number }

/** 인원 세기 (21세 초과 = 등록 인원, 비자국 육성은 21세 초과만) */
export function squadCount(players: readonly RosterPlayer[]): SquadCount {
  let senior = 0, nonHg = 0;
  for (const p of players) {
    if (isU21(p.age)) continue;
    senior++;
    if (!homegrown(p)) nonHg++;
  }
  return { total: players.length, senior, u21: players.length - senior, nonHg };
}

/** 리그 규칙 범위 안인가 */
export function withinRules(players: readonly RosterPlayer[], league: LeagueKey = CURRENT_LEAGUE): boolean {
  const R = squadRule(league);
  const c = squadCount(players);
  return c.total >= R.min && c.senior <= R.max && c.total <= R.max + R.u21Extra && c.nonHg <= R.nonHomegrownMax;
}

/**
 * 팀 안 순위 (낮을수록 내보낼 후보): 라인업 선발 → 벤치 → 나머지, 같은 묶음 안은 OVR 순.
 * 반환은 내보낼 순서 (가장 낮은 순위 먼저). 실제 선수는 뒤로
 */
export function releaseOrder(roster: TeamRoster, filter: (p: RosterPlayer) => boolean = () => true): RosterPlayer[] {
  const lu = pickLineup(roster);
  const starters = new Set(lu.slots.map((s) => s.playerId));
  const bench = new Set(lu.bench);
  const tier = (p: RosterPlayer) => (p.real || p.legend ? 3 : starters.has(p.id) ? 2 : bench.has(p.id) ? 1 : 0);
  return roster.players
    .filter(filter)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => tier(a.p) - tier(b.p) || naturalOvr(a.p) - naturalOvr(b.p) || a.i - b.i)
    .map((x) => x.p);
}

/** 비자국 육성 상한 자동 조정: 넘치면 순위가 가장 낮은 생성 선수부터 육성 이력(hg)을 붙인다 (어릴 때 잉글랜드 구단에서 큰 선수로 본다) */
export function fixHomegrown(roster: TeamRoster, league: LeagueKey = CURRENT_LEAGUE): void {
  const max = squadRule(league).nonHomegrownMax;
  let over = squadCount(roster.players).nonHg - max;
  if (over <= 0) return;
  for (const p of releaseOrder(roster, (x) => !x.real && !isU21(x.age) && !homegrown(x))) {
    if (over-- <= 0) break;
    p.hg = true;
  }
}

/**
 * 시즌 갱신 뒤 인원 맞추기: 21세 초과가 max 를 넘거나 전체가 max + u21Extra 를 넘으면 순위가 가장 낮은 선수 방출(리그 밖으로),
 * 최소 아래면 make(포지션) 로 보충. 방출·보충 모두 시드로 정해져 재생성과 같다
 */
export function normalizeSquad(
  roster: TeamRoster, make: (pos: RosterPlayer['position'], k: number) => RosterPlayer, league: LeagueKey = CURRENT_LEAGUE,
): { released: string[]; added: string[] } {
  const R = squadRule(league);
  const released: string[] = [];
  const added: string[] = [];
  for (let guard = 0; guard < 40; guard++) {
    const c = squadCount(roster.players);
    if (c.senior <= R.max && c.total <= R.max + R.u21Extra) break;
    const seniorOver = c.senior > R.max;
    const out = releaseOrder(roster, (p) => !p.real && !p.legend && (!seniorOver || !isU21(p.age)))[0];
    if (!out) break;
    roster.players = roster.players.filter((p) => p !== out);
    released.push(out.id);
  }
  for (let k = 0; squadCount(roster.players).total < R.min && k < 40; k++) {
    const p = make(neediestPosition(roster), k);
    roster.players = [...roster.players, p];
    added.push(p.id);
  }
  fixHomegrown(roster, league);
  return { released, added };
}

/** 가장 모자란 포지션군의 대표 포지션 (기본 24명 구성 대비) */
export function neediestPosition(roster: TeamRoster): RosterPlayer['position'] {
  const sq = BALANCE.roster.squad;
  const rep: Record<keyof typeof sq, RosterPlayer['position']> = { GK: 'GK', CB: 'CB', FB: 'LB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', WING: 'LW', ST: 'ST' };
  let best: keyof typeof sq = 'CM';
  let gap = -Infinity;
  for (const g of Object.keys(sq) as (keyof typeof sq)[]) {
    const have = roster.players.filter((p) => posGroup(p.position) === g).length;
    const d = sq[g] - have;
    if (d > gap) { gap = d; best = g; }
  }
  return rep[best];
}
