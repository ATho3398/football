import {
  ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, GK_ATTRIBUTES, GROUP_NAMES, SECONDARY_GROUPS, groupOf,
  type AttributeGroup, type FieldAttribute, type FieldAttributes, type GkAttribute, type GkAttributes,
} from './attributes';
import { createRng, gaussian, hashSeed } from './rng';
import type { FieldPlayerData, GoalkeeperData, PlayerData } from './types';

export const DEFAULT_SPREAD = 5;

// 3단계 운의 표준편차 (변동 폭 1.0 기준). 합산 후 [-1, 1]로 자름
const SD_GLOBAL = 0.35;
const SD_GROUP = 0.35;
const SD_INDIVIDUAL = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export type GeneratedFieldPlayer = Omit<FieldPlayerData, 'variance'>;
export type GeneratedGoalkeeper = Omit<GoalkeeperData, 'variance'>;
export type GeneratedPlayer = GeneratedFieldPlayer | GeneratedGoalkeeper;

/**
 * 새 게임 시드와 선수 id로 능력치 생성. 선수별로 독립된 난수열을 쓰므로
 * 선수가 추가/삭제돼도 다른 선수의 결과는 바뀌지 않는다.
 */
export function generatePlayer(data: FieldPlayerData, worldSeed: string): GeneratedFieldPlayer;
export function generatePlayer(data: GoalkeeperData, worldSeed: string): GeneratedGoalkeeper;
export function generatePlayer(data: PlayerData, worldSeed: string): GeneratedPlayer;
export function generatePlayer(data: PlayerData, worldSeed: string): GeneratedPlayer {
  const rng = createRng(hashSeed(`${worldSeed}:${data.id}`));
  const spread = data.variance?.spread ?? DEFAULT_SPREAD;
  const globalLuck = gaussian(rng) * SD_GLOBAL;

  if (data.position === 'GK') {
    const { gkAttributes, variance: _v, ...rest } = data;
    const out = {} as GkAttributes;
    for (const a of GK_ATTRIBUTES) {
      const n = clamp(globalLuck + gaussian(rng) * SD_INDIVIDUAL, -1, 1);
      out[a as GkAttribute] = Math.round(clamp(gkAttributes[a] + n * spread, 0, 100));
    }
    return { ...rest, gkAttributes: out } as GeneratedPlayer;
  }

  const groupLuck = {} as Record<AttributeGroup, number>;
  for (const g of GROUP_NAMES) groupLuck[g] = gaussian(rng) * SD_GROUP;

  const { attributes, variance, ...rest } = data;
  const out = {} as FieldAttributes;
  for (const a of FIELD_ATTRIBUTES as readonly FieldAttribute[]) {
    let group = groupLuck[groupOf(a)];
    const sec = SECONDARY_GROUPS[a];
    if (sec) group = group * (1 - sec.weight) + groupLuck[sec.group] * sec.weight;
    const n = clamp(globalLuck + group + gaussian(rng) * SD_INDIVIDUAL, -1, 1);

    const override = variance?.overrides?.[a];
    out[a] = override
      ? Math.round(clamp(override[0] + ((n + 1) / 2) * (override[1] - override[0]), 0, 100))
      : Math.round(clamp(attributes[a] + n * spread, 0, 100));
  }
  return { ...rest, attributes: out } as GeneratedPlayer;
}

export { ATTRIBUTE_GROUPS };
