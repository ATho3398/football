// 시즌 누적 부하 (C.77n, pending 142b — 게겐 대가): 경기마다 선수의 부하(출전 분 × 이동 거리 × 팀 성향 계수)를 시즌 누적 →
// (a) 부상 확률 가산, (b) 시즌 끝 마모로 쌓여 노쇠 시작 나이·하락 속도에 작은 가산. 내 선수(PlayerState.load·wear)와
// NPC(GameState.npcLoad)가 같은 함수를 쓴다. 측정 리그 시즌(scripts/engine/job.ts)도 같은 경로

import { BALANCE } from './config/balance';
import { ENGINE } from './engine/config';

/** NPC 부하: 선수 id → [이번 시즌 누적 부하, 지난 시즌까지 마모] */
export type NpcLoad = [number, number];
export type NpcLoadMap = Record<string, NpcLoad>;

/** 성향 계수 (모르는 성향은 1) */
export const tendencyLoad = (tendency: string | undefined): number => (tendency && BALANCE.load.tendency[tendency]) || 1;

/** 경기 부하 = 분/90 × 거리/기준 거리 × 성향 계수. 거리가 없으면 분 비례 기준 거리 */
export function matchLoad(minutes: number, distance: number | undefined, mul: number): number {
  if (minutes <= 0) return 0;
  const d = distance ?? (ENGINE.match.fatigueRefDistance * minutes) / 90;
  return (d / ENGINE.match.fatigueRefDistance) * mul;
}

/** 부상 확률 배율 (시즌 누적 부하, 경기 전 값) */
export function loadInjuryMul(load: number | undefined): number {
  const L = BALANCE.load;
  if (!L.on || !load) return 1;
  return 1 + Math.max(0, load - L.injuryFrom) * L.injuryPerPoint;
}

/** 시즌 끝 마모 증가분 */
export const seasonWear = (load: number | undefined): number => (BALANCE.load.on ? Math.max(0, (load ?? 0) - BALANCE.load.wearFrom) : 0);

/** 마모 → 노쇠 [나이 이동(시즌), 하락 속도 배율]. age 를 주면 load.wearAgeFrom 전에는 가산 없음 (정점 전 성장 보호) */
export function wearAging(wear: number | undefined, age?: number): { shift: number; mul: number } {
  const L = BALANCE.load;
  if (!L.on || !wear || (age !== undefined && age < L.wearAgeFrom)) return { shift: 0, mul: 1 };
  return { shift: Math.min(L.maxShift, wear * L.agePerWear), mul: 1 + Math.min(L.maxRate, wear * L.ratePerWear) };
}

/** NPC 경기 부하 더하기 */
export function addNpcLoad(map: NpcLoadMap, id: string, load: number): void {
  if (!BALANCE.load.on || load <= 0) return;
  const v = (map[id] ??= [0, 0]);
  v[0] = Math.round((v[0] + load) * 100) / 100;
}

/** 시즌 끝: 시즌 부하 → 마모, 시즌 부하 0. 마모 0 인 기록은 지운다 (세이브 크기) */
export function closeNpcLoadSeason(map: NpcLoadMap | undefined): void {
  if (!map) return;
  for (const [id, v] of Object.entries(map)) {
    const w = Math.round((v[1] + seasonWear(v[0])) * 10) / 10;
    if (w <= 0) delete map[id];
    else map[id] = [0, w];
  }
}

/** NPC 마모 (없으면 0) */
export const npcWear = (map: NpcLoadMap | undefined, id: string): number => map?.[id]?.[1] ?? 0;
