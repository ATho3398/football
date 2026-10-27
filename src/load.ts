// 시즌 누적 부하 (C.77n, pending 142b — 게겐 대가): 경기마다 선수의 부하(출전 분 × 이동 거리 × 팀 성향 계수)를 시즌 누적 →
// (a) 부상 확률 가산, (b) 시즌 끝 마모로 쌓여 노쇠 시작 나이·하락 속도에 작은 가산. 내 선수(PlayerState.load·wear)와
// NPC(GameState.npcLoad)가 같은 함수를 쓴다. 측정 리그 시즌(scripts/engine/job.ts)도 같은 경로

import { BALANCE } from './config/balance';
import { ENGINE } from './engine/config';

/** NPC 부하: 선수 id → [이번 시즌 누적 부하, 지난 시즌까지 마모, 이번 시즌 게겐 출전 분, 게겐 시즌 수] (C.78t 3·4번째 칸, 없으면 0) */
export type NpcLoad = [number, number, number?, number?];
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

/** 게겐 시즌 수 → 노화 앞당김 시즌 (C.78t, gegenCost.careerShift 계단) */
export function gegenShift(seasons: number | undefined): number {
  const G = BALANCE.gegenCost;
  if (!G.on || !seasons) return 0;
  let s = 0;
  for (const [from, shift] of G.careerShift) if (seasons >= from) s = shift;
  return s;
}

/**
 * 마모 → 노쇠 [나이 이동(시즌), 하락 속도 배율]. age 를 주면 load.wearAgeFrom 전에는 가산 없음 (정점 전 성장 보호).
 * gegen = 게겐 시즌 수 (C.78t): gegenShift 만큼 더 앞당기고, 그 이동은 wearAgeFrom − 이동 나이부터 건다 ("노화가 1~2년 빨리")
 */
export function wearAging(wear: number | undefined, age?: number, gegen?: number): { shift: number; mul: number } {
  const L = BALANCE.load;
  const g = gegenShift(gegen);
  const gOn = g > 0 && (age === undefined || age >= L.wearAgeFrom - g);
  const wOn = L.on && !!wear && (age === undefined || age >= L.wearAgeFrom);
  const ws = wOn ? Math.min(L.maxShift, wear! * L.agePerWear) : 0;
  const shift = Math.min(Math.max(L.maxShift, BALANCE.gegenCost.maxTotalShift), ws + (gOn ? g : 0));
  return { shift, mul: wOn ? 1 + Math.min(L.maxRate, wear! * L.ratePerWear) : 1 };
}

/** NPC 경기 부하 더하기 */
export function addNpcLoad(map: NpcLoadMap, id: string, load: number): void {
  if (!BALANCE.load.on || load <= 0) return;
  const v = (map[id] ??= [0, 0]);
  v[0] = Math.round((v[0] + load) * 100) / 100;
}

/** NPC 게겐 클럽 출전 분 더하기 (C.78t) */
export function addNpcGegen(map: NpcLoadMap, id: string, minutes: number): void {
  if (!BALANCE.gegenCost.on || minutes <= 0) return;
  const v = (map[id] ??= [0, 0]);
  v[2] = (v[2] ?? 0) + minutes;
}

/** 시즌 게겐 출전 분 → 게겐 시즌 1 증가 여부 (C.78t) */
export const gegenSeasonDone = (minutes: number | undefined): boolean => BALANCE.gegenCost.on && (minutes ?? 0) >= BALANCE.gegenCost.seasonMinutes;

/** 시즌 끝: 시즌 부하 → 마모, 시즌 부하 0, 게겐 출전 분 → 게겐 시즌. 마모·게겐 시즌 0 인 기록은 지운다 (세이브 크기) */
export function closeNpcLoadSeason(map: NpcLoadMap | undefined): void {
  if (!map) return;
  for (const [id, v] of Object.entries(map)) {
    const w = Math.round((v[1] + seasonWear(v[0])) * 10) / 10;
    const g = (v[3] ?? 0) + (gegenSeasonDone(v[2]) ? 1 : 0);
    if (w <= 0 && g <= 0) delete map[id];
    else map[id] = g > 0 ? [0, w, 0, g] : [0, w];
  }
}

/** NPC 마모 (없으면 0) */
export const npcWear = (map: NpcLoadMap | undefined, id: string): number => map?.[id]?.[1] ?? 0;

/** NPC 게겐 시즌 수 (없으면 0, C.78t) */
export const npcGegen = (map: NpcLoadMap | undefined, id: string): number => map?.[id]?.[3] ?? 0;
