// NPC 피로·부상 (C.77m, pending 142a): 내 선수와 같은 규칙 — 경기 뒤 이동 거리 비례 피로(fatigueFromDistance 와 같은 식),
// 하루 weeklyRecovery ÷ 7 회복, 피로 부상(injury.fatigue*). 선발은 피로 페널티로 로테이션 (pickLineup 의 penalty).
// 선수마다 [그날 경기 뒤 피로, 그날 번호, 복귀 날 번호] 만 담고, 회복은 읽을 때 날 수만큼 계산한다(매일 수천 명을 돌지 않는다).
// 측정 리그 시즌(scripts/engine/job.ts runLeagueSeasonJob)과 본편(game.ts 다른 경기·내 경기 양 팀)이 같은 함수를 쓴다

import { BALANCE } from './config/balance';
import { daysBetween, type IsoDate } from './calendar';
import { ENGINE } from './engine/config';
import { gkFieldAttributes } from './engine/sim';
import { createRng, hashSeed } from './rng';
import { injuryChance } from './injury';
import type { RosterPlayer, TeamRoster } from './roster';
import type { PlayerLine } from './engine/npcMatch';

/** [경기 뒤 피로, 그날 번호, 부상 복귀 날 번호(그날부터 출전 가능, 없으면 부상 없음)] */
export type NpcFit = [number, number, number?];
export type NpcFitMap = Record<string, NpcFit>;

/** 경기 입력용 컨디션 (직렬화, 미리 계산 키에 들어간다): 선수 id → [그날 아침 피로(소수 첫째), 부상 결장 1] */
export type NpcCond = Record<string, [number, 0 | 1]>;

const EPOCH = '2000-01-01';

/** 날짜 → 날 번호 (2000-01-01 = 0) */
export const dayNum = (date: IsoDate): number => daysBetween(EPOCH, date);

/** 하루 회복량 = 주간 회복 ÷ 7 (내 선수 기본 훈련 주 합계와 같은 값) */
export const npcDailyRecovery = (): number => BALANCE.fatigue.weeklyRecovery / 7;

/** day 날 아침 피로 */
export function npcFatigueOn(fit: NpcFit | undefined, day: number): number {
  if (!fit) return 0;
  return Math.max(0, fit[0] - npcDailyRecovery() * Math.max(0, day - fit[1]));
}

/** day 날 부상으로 결장 */
export const npcInjuredOn = (fit: NpcFit | undefined, day: number): boolean => fit?.[2] !== undefined && day < fit[2];

/** 그날 두 팀 선수 컨디션. 피로 0·부상 없는 선수는 넣지 않는다 (입력이 작고, 쉬던 팀은 미리 계산 키가 그대로) */
export function npcConditions(map: NpcFitMap | undefined, rosters: readonly TeamRoster[], day: number): NpcCond | undefined {
  if (!map || !BALANCE.fatigue.npc.on) return undefined;
  const out: NpcCond = {};
  let n = 0;
  for (const r of rosters) {
    for (const p of r.players) {
      const fit = map[p.id];
      if (!fit) continue;
      const f = Math.round(npcFatigueOn(fit, day) * 10) / 10;
      const inj = npcInjuredOn(fit, day) ? 1 : 0;
      if (f <= 0 && !inj) continue;
      out[p.id] = [f, inj];
      n++;
    }
  }
  return n ? out : undefined;
}

/** 선발 점수 피로 페널티 (OVR 점수): penaltyFrom 을 넘은 만큼 × npc.selectPerPoint */
export function npcSelectPenalty(fatigue: number): number {
  const F = BALANCE.fatigue;
  return Math.max(0, fatigue - F.penaltyFrom) * F.npc.selectPerPoint;
}

/** 경기 피로 = perMatch90 × 이동 거리 / 기준 거리 (내 선수 fatigueFromDistance 와 같은 식) */
export const npcMatchFatigue = (distance: number): number => (BALANCE.fatigue.perMatch90 * distance) / ENGINE.match.fatigueRefDistance;

/** 부상 기간(일): 등급 추첨은 내 선수와 같은 표. 시즌아웃은 최소 주 수 */
function npcInjuryDays(rng: () => number): number {
  const G = BALANCE.injury.grades;
  const r = rng();
  const [lo, hi] = r < G.minor.chance ? G.minor.weeks : r < G.minor.chance + G.major.chance ? G.major.weeks : [G.seasonEnding.minWeeks, G.seasonEnding.minWeeks];
  return (lo + Math.floor(rng() * (hi - lo + 1))) * 7;
}

/** 경기 한 줄: 선수 id · 출전 분 · 이동 거리(m) */
export interface NpcLine { id: string; minutes: number; distance: number }

/**
 * 경기 뒤 (day 날): 뛴 선수마다 피로 += 거리 비례, 부상 판정(확률 = 내 선수 injuryChance — 경기 시작 피로·신체·나이, 난이도 보통·태그 없음).
 * 난수는 (worldSeed, 경기 시드, 선수 id) 로 결정적. 로스터에 없는 id(내 선수 등)는 건너뛴다
 */
export function npcAfterMatch(map: NpcFitMap, rosters: readonly TeamRoster[], lines: readonly NpcLine[], day: number, worldSeed: string, matchSeed: number): void {
  if (!BALANCE.fatigue.npc.on) return;
  const byId = new Map<string, RosterPlayer>();
  for (const r of rosters) for (const p of r.players) byId.set(p.id, p);
  for (const l of lines) {
    if (l.minutes <= 0) continue;
    const p = byId.get(l.id);
    if (!p) continue;
    const old = map[l.id];
    const before = npcFatigueOn(old, day);
    const f = Math.min(BALANCE.fatigue.max, before + npcMatchFatigue(l.distance));
    const fit: NpcFit = [Math.round(f * 10) / 10, day];
    if (old?.[2] !== undefined && old[2] > day) fit[2] = old[2];
    const attributes = p.attributes ?? gkFieldAttributes(p.gk!.attrs);
    const rng = createRng(hashSeed(`${worldSeed}:npc-injury:${matchSeed}:${l.id}`));
    if (rng() < injuryChance({ attributes, age: p.age, fatigue: before }, l.minutes, 'normal') * BALANCE.fatigue.npc.injuryMul) {
      fit[2] = day + 1 + npcInjuryDays(rng);
    }
    map[l.id] = fit;
  }
}

/** 엔진 요약 선수 기록 → 피로 줄 (거리가 없는 옛 기록은 출전 분 비례 기준 거리) */
export function npcLines(res: { players: readonly PlayerLine[] }): NpcLine[] {
  return res.players.map(([id, minutes, , , , d]) => ({ id, minutes, distance: d ?? (ENGINE.match.fatigueRefDistance * minutes) / 90 }));
}

/** 다 회복한(피로 0·부상 없음) 선수를 지운다 (세이브 크기, 하루 끝에 한 번) */
export function pruneNpcFit(map: NpcFitMap | undefined, day: number): void {
  if (!map) return;
  for (const [id, fit] of Object.entries(map)) if (npcFatigueOn(fit, day) <= 0 && !npcInjuredOn(fit, day)) delete map[id];
}
