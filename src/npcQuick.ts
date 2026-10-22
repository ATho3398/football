// NPC 끼리 컵·챔스 간이 경기 피로 (C.77n, pending 142b): 레이팅 간이 계산(simulateScore) 경기는 라인업이 없어 피로가 안 쌓였다 →
// 그날 컨디션으로 pickLineup(부상 결장은 엔진 경기와 같은 함수, 피로 감점은 cupRestFrom 부터 — 컵 로테이션)을 돌려 출전 명단에 출전 분(기준 거리 비례) 피로·부상·부하를 더한다.
// 출전 분 (C.77w): GK·선발 90분, 교체 cupSubs 분에 필드 선발이 나가고 벤치 선수가 남은 분. 같은 명단에서 컵 득점자를 뽑는다(cups.ts).
// 엔진 없이 경기당 수 ms. 스코어는 그대로(레이팅 간이 계산). 본편 cups.ts 와 측정 scripts/engine/job.ts 가 같이 쓴다

import { BALANCE } from './config/balance';
import { ENGINE } from './engine/config';
import { npcInjuredOut } from './engine/setup';
import type { NpcLoadMap } from './load';
import { npcAfterMatch, npcConditions, type NpcCond, type NpcFitMap, type NpcLine } from './npcFit';
import { naturalOvr, pickLineup, posGroup, type TeamRoster } from './roster';

const line = (id: string, minutes: number, sub = false): NpcLine => ({ id, minutes, distance: (ENGINE.match.fatigueRefDistance * minutes) / 90, ...(sub ? { sub: true } : {}) });

/**
 * 간이 경기 출전 명단 (그날 아침 컨디션: 부상 결장·피로 감점). 선발 11명 + 교체 투입 선수, 출전 분 합 = 990.
 * 교체: 필드 선발 중 cupSubOrder 포지션군 앞쪽(같으면 피로 높은 쪽)이 cupSubs 분에 나가고, 벤치(부상 제외, GK 제외)에서 같은 포지션군 OVR 1위(없으면 전체 1위)가 들어간다
 */
export function quickLines(roster: TeamRoster, map: NpcFitMap | undefined, day: number): NpcLine[] {
  const cond = npcConditions(map, [roster], day);
  return lineupLines(roster, cond);
}

/** 컨디션(없으면 모두 쌩쌩)으로 출전 명단 */
export function lineupLines(roster: TeamRoster, cond: NpcCond | undefined): NpcLine[] {
  // 컵 로테이션 (C.77n 조정 2): 감점이 리그(penaltyFrom)보다 이른 cupRestFrom 부터
  const N = BALANCE.fatigue.npc;
  const out = npcInjuredOut(roster, cond);
  const fat = (id: string): number => cond?.[id]?.[0] ?? 0;
  const lu = pickLineup(roster, out, cond ? (id) => Math.max(0, fat(id) - N.cupRestFrom) * N.selectPerPoint : undefined);
  const byId = new Map(roster.players.map((p) => [p.id, p]));
  const starters = lu.slots.map((s) => s.playerId);
  const on = new Set(starters);
  const rank = (id: string): number => {
    const k = N.cupSubOrder.indexOf(posGroup(byId.get(id)!.position));
    return k < 0 ? N.cupSubOrder.length : k;
  };
  const leaving = starters.filter((id) => byId.get(id)!.position !== 'GK')
    .sort((a, b) => rank(a) - rank(b) || fat(b) - fat(a) || starters.indexOf(a) - starters.indexOf(b));
  const bench = roster.players.filter((p) => !on.has(p.id) && !out.has(p.id) && p.position !== 'GK')
    .sort((a, b) => naturalOvr(b) - naturalOvr(a) || roster.players.indexOf(a) - roster.players.indexOf(b));
  const minutes = new Map(starters.map((id) => [id, 90]));
  const subs: NpcLine[] = [];
  N.cupSubs.forEach((m, i) => {
    const off = leaving[i];
    if (!off || !bench.length) return;
    const g = posGroup(byId.get(off)!.position);
    const k = Math.max(0, bench.findIndex((p) => posGroup(p.position) === g));
    const inP = bench.splice(k, 1)[0]!;
    minutes.set(off, m);
    subs.push(line(inP.id, 90 - m, true));
  });
  return [...starters.map((id) => line(id, minutes.get(id)!)), ...subs];
}

/** 간이 경기 뒤 (day 날): 로스터가 있는 팀(내 리그)만. lines 가 있으면 그 명단(득점자와 같은 명단), 없으면 quickLines. 돌려주는 값 = 출전 명단 (측정 기록용) */
export function npcQuickMatch(map: NpcFitMap, load: NpcLoadMap | undefined, rosters: readonly TeamRoster[], day: number, worldSeed: string, matchSeed: number, lines?: NpcLine[]): NpcLine[] {
  if (!BALANCE.fatigue.npc.on || !BALANCE.fatigue.npc.cup || !rosters.length) return [];
  const ls = lines ?? rosters.flatMap((r) => quickLines(r, map, day));
  npcAfterMatch(map, rosters, ls, day, worldSeed, matchSeed, load);
  return ls;
}
