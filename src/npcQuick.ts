// NPC 끼리 컵·챔스 간이 경기 피로 (C.77n, pending 142b): 레이팅 간이 계산(simulateScore) 경기는 라인업이 없어 피로가 안 쌓였다 →
// 그날 컨디션으로 pickLineup(부상 결장은 엔진 경기와 같은 함수, 피로 감점은 cupRestFrom 부터 — 컵 로테이션)을 돌려 선발 11명에게 cupMinutes 분(기준 거리 비례) 피로·부상·부하를 더한다.
// 엔진 없이 경기당 수 ms. 스코어는 그대로(레이팅 간이 계산). 본편 cups.ts 와 측정 scripts/engine/job.ts 가 같이 쓴다

import { BALANCE } from './config/balance';
import { ENGINE } from './engine/config';
import { npcInjuredOut } from './engine/setup';
import type { NpcLoadMap } from './load';
import { npcAfterMatch, npcConditions, type NpcFitMap, type NpcLine } from './npcFit';
import { pickLineup, type TeamRoster } from './roster';

/** 간이 경기 선발 11명 줄 (그날 아침 컨디션: 부상 결장·피로 감점), 출전 fatigue.npc.cupMinutes 분 */
export function quickLines(roster: TeamRoster, map: NpcFitMap, day: number): NpcLine[] {
  const cond = npcConditions(map, [roster], day);
  // 컵 로테이션 (C.77n 조정 2): 감점이 리그(penaltyFrom)보다 이른 cupRestFrom 부터
  const N = BALANCE.fatigue.npc;
  const lu = pickLineup(roster, npcInjuredOut(roster, cond), cond ? (id) => Math.max(0, (cond[id]?.[0] ?? 0) - N.cupRestFrom) * N.selectPerPoint : undefined);
  const min = BALANCE.fatigue.npc.cupMinutes;
  return lu.slots.map((s) => ({ id: s.playerId, minutes: min, distance: (ENGINE.match.fatigueRefDistance * min) / 90 }));
}

/** 간이 경기 뒤 (day 날): 로스터가 있는 팀(내 리그)만. 돌려주는 값 = 선발 줄 (측정 기록용) */
export function npcQuickMatch(map: NpcFitMap, load: NpcLoadMap | undefined, rosters: readonly TeamRoster[], day: number, worldSeed: string, matchSeed: number): NpcLine[] {
  if (!BALANCE.fatigue.npc.on || !BALANCE.fatigue.npc.cup || !rosters.length) return [];
  const lines = rosters.flatMap((r) => quickLines(r, map, day));
  npcAfterMatch(map, rosters, lines, day, worldSeed, matchSeed, load);
  return lines;
}
