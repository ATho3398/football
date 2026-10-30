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
import { addNpcGegen, addNpcLoad, matchLoad, tendencyLoad, type NpcLoadMap } from './load';
import { teamPlan } from './engine/tactics';
import { rosterRating } from './roster';
import type { RosterPlayer, TeamRoster } from './roster';
import type { PlayerLine } from './engine/npcMatch';
import type { NpcBanMap } from './npcBan';

/**
 * [경기 뒤 피로, 그날 번호(마지막 경기 날), 부상 복귀 날 번호(그날부터 출전 가능, 없으면 부상 없음 — 세이브에선 null),
 *  직전 평점 ×10, 최근 평점 지수 평균 ×10, 평점 경기 수(최대 5), 연속 선발] — 뒤 넷은 감독 기용(C.79i), 평점 없는 간이 경기는 연속 선발만
 */
export type NpcFit = [number, number, (number | null)?, number?, number?, number?, number?];
export type NpcFitMap = Record<string, NpcFit>;

/**
 * 경기 입력용 컨디션 (직렬화, 미리 계산 키에 들어간다): 선수 id → [그날 아침 피로(소수 첫째), 부상 결장 1,
 *  직전 평점 ×10(없으면 0), 최근 평점 평균 ×10(formMinGames 경기 전이면 0), 연속 선발] (C.79i 감독 기용)
 */
export type NpcCond = Record<string, [number, 0 | 1, number?, number?, number?]>;

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
export const npcInjuredOn = (fit: NpcFit | undefined, day: number): boolean => fit?.[2] != null && day < fit[2];

/**
 * 그날 두 팀 선수 컨디션. 피로 0·부상 없는 선수는 넣지 않는다 (입력이 작고, 쉬던 팀은 미리 계산 키가 그대로).
 * ban 을 주면(리그 경기만, C.80a) 출장 정지 선수도 결장 칸 1 — 부상 결장과 같은 길로 선발에서 빠진다
 */
export function npcConditions(map: NpcFitMap | undefined, rosters: readonly TeamRoster[], day: number, ban?: NpcBanMap): NpcCond | undefined {
  if ((!map && !ban) || !BALANCE.fatigue.npc.on) return undefined;
  const out: NpcCond = {};
  let n = 0;
  for (const r of rosters) {
    for (const p of r.players) {
      const fit = map?.[p.id];
      const banned = (ban?.[p.id]?.[1] ?? 0) > 0;
      if (!fit && !banned) continue;
      const f = Math.round(npcFatigueOn(fit, day) * 10) / 10;
      const inj = npcInjuredOn(fit, day) || banned ? 1 : 0;
      const last = fit?.[3] ?? 0;
      const streak = fit?.[6] ?? 0;
      if (f <= 0 && !inj && !last && !streak) continue;
      out[p.id] = last || streak ? [f, inj, last, (fit![5] ?? 0) >= BALANCE.selection.formMinGames ? fit![4] ?? 0 : 0, streak] : [f, inj];
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
  const m1 = G.minor.chance;
  const m2 = m1 + G.moderate.chance;
  const m3 = m2 + G.major.chance;
  const [lo, hi] = r < m1 ? G.minor.weeks : r < m2 ? G.moderate.weeks : r < m3 ? G.major.weeks : [G.seasonEnding.minWeeks, G.seasonEnding.minWeeks];
  return (lo + Math.floor(rng() * (hi - lo + 1))) * 7;
}

/** 경기 한 줄: 선수 id · 출전 분 · 이동 거리(m) · 교체 투입 (C.77w, 간이 경기만) */
export interface NpcLine { id: string; minutes: number; distance: number; sub?: boolean; /** 평점 (엔진 경기만, C.79i) */ rating?: number }

const TENDENCY = new Map<string, string>();

/**
 * 팀 성향 (C.77n 부하 계수·C.78t 게겐 비용): 데이터 팀은 데이터 성향, 아니면 teamPlan 시드 추첨(레이팅 = 로스터 레이팅). 팀·월드 시드마다 캐시
 * (경기마다 상대에 맞춘 약자 전술 조정은 보지 않는다 — 시즌 누적 근사)
 */
export function rosterTendency(roster: TeamRoster, worldSeed: string): string {
  const key = `${worldSeed}:${roster.teamId}`;
  let v = TENDENCY.get(key);
  if (v === undefined) {
    if (TENDENCY.size > 512) TENDENCY.clear();
    v = teamPlan(roster.teamId, rosterRating(roster), roster.formation, worldSeed).tendency as string;
    TENDENCY.set(key, v);
  }
  return v;
}

/** 팀 성향 부하 계수 (C.77n) */
export const rosterLoadMul = (roster: TeamRoster, worldSeed: string): number => tendencyLoad(rosterTendency(roster, worldSeed));

/**
 * 경기 뒤 (day 날): 뛴 선수마다 피로 += 거리 비례, 부상 판정(확률 = 내 선수 injuryChance — 경기 시작 피로·신체·나이, 난이도 보통·태그 없음
 * × 시즌 누적 부하 배율 C.77n). load 를 주면 경기 부하(분 × 거리 × 팀 성향)를 시즌 누적에 더한다.
 * 난수는 (worldSeed, 경기 시드, 선수 id) 로 결정적. 로스터에 없는 id(내 선수 등)는 건너뛴다
 */
export function npcAfterMatch(
  map: NpcFitMap, rosters: readonly TeamRoster[], lines: readonly NpcLine[], day: number, worldSeed: string, matchSeed: number, load?: NpcLoadMap,
): void {
  if (!BALANCE.fatigue.npc.on) return;
  const byId = new Map<string, RosterPlayer>();
  const mulOf = new Map<string, number>();
  const gegenOf = new Set<string>();
  for (const r of rosters) {
    const mul = load ? rosterLoadMul(r, worldSeed) : 1;
    const gegen = !!load && rosterTendency(r, worldSeed) === BALANCE.gegenCost.tendency;
    for (const p of r.players) { byId.set(p.id, p); mulOf.set(p.id, mul); if (gegen) gegenOf.add(p.id); }
  }
  const S = BALANCE.selection;
  const played = new Set<string>();
  for (const l of lines) {
    if (l.minutes <= 0) continue;
    const p = byId.get(l.id);
    if (!p) continue;
    played.add(l.id);
    const seasonLoad = load?.[l.id]?.[0];
    if (load) addNpcLoad(load, l.id, matchLoad(l.minutes, l.distance, mulOf.get(l.id)!));
    // 게겐 클럽 출전 분 (C.78t 선수 생명): 시즌 끝 gegenCost.seasonMinutes 이상이면 게겐 시즌 +1
    if (load && gegenOf.has(l.id)) addNpcGegen(load, l.id, l.minutes);
    const old = map[l.id];
    const before = npcFatigueOn(old, day);
    const f = Math.min(BALANCE.fatigue.max, before + npcMatchFatigue(l.distance));
    const fit: NpcFit = [Math.round(f * 10) / 10, day];
    if (old?.[2] != null && old[2] > day) fit[2] = old[2];
    // 감독 기용 (C.79i): 평점(엔진 경기)은 직전·지수 평균·경기 수, 선발이면 연속 선발 +1 (교체 출전은 0으로)
    const r10 = l.rating !== undefined ? Math.round(l.rating * 10) : undefined;
    const n = r10 !== undefined ? Math.min(5, (old?.[5] ?? 0) + 1) : old?.[5] ?? 0;
    const avg = r10 === undefined ? old?.[4] ?? 0 : old?.[4] ? Math.round(old[4] + (r10 - old[4]) * S.formAlpha) : r10;
    const streak = !l.sub && l.minutes >= S.startMinutes ? (old?.[6] ?? 0) + 1 : 0;
    if (r10 !== undefined || old?.[3] || streak) {
      fit[2] ??= null;
      fit.push(r10 ?? old?.[3] ?? 0, avg, n, streak);
    }
    const attributes = p.attributes ?? gkFieldAttributes(p.gk!.attrs);
    const rng = createRng(hashSeed(`${worldSeed}:npc-injury:${matchSeed}:${l.id}`));
    if (rng() < injuryChance({ attributes, age: p.age, fatigue: before, load: seasonLoad }, l.minutes, 'normal') * BALANCE.fatigue.npc.injuryMul) {
      fit[2] = day + 1 + npcInjuryDays(rng);
    }
    map[l.id] = fit;
  }
  // 이번 경기에 안 뛴 선수는 연속 선발이 끊긴다
  for (const id of byId.keys()) {
    const fit = map[id];
    if (!played.has(id) && fit?.[6]) fit[6] = 0;
  }
}

/** 엔진 요약 선수 기록 → 피로 줄 (거리가 없는 옛 기록은 출전 분 비례 기준 거리) */
export function npcLines(res: { players: readonly PlayerLine[] }): NpcLine[] {
  return res.players.map(([id, minutes, , , r10, d]) => ({ id, minutes, distance: d ?? (ENGINE.match.fatigueRefDistance * minutes) / 90, ...(minutes > 0 ? { rating: r10 / 10 } : {}) }));
}

/** 다 회복한(피로 0·부상 없음) 선수를 지운다 (세이브 크기, 하루 끝에 한 번) */
export function pruneNpcFit(map: NpcFitMap | undefined, day: number): void {
  if (!map) return;
  // 평점 기록(C.79i)은 마지막 경기 뒤 formKeepDays 까지 둔다
  const keep = BALANCE.selection.formKeepDays;
  for (const [id, fit] of Object.entries(map)) {
    if (npcFatigueOn(fit, day) <= 0 && !npcInjuredOn(fit, day) && (fit[3] === undefined || day - fit[1] > keep)) delete map[id];
  }
}
