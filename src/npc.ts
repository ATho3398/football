// NPC 성장 곡선 (5.6, B.6). XP 없이 시즌 종료 때 일괄 처리

import { FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from './attributes';
import { BALANCE } from './config/balance';
import { generatePlayer } from './generate';
import { applyAging, applyVeteranGrowth, randInt } from './growth';
import { attributeOvrWeight, positionOvr, profileOf, type FieldPosition } from './positions';
import { createRng, gaussian, hashSeed, type Rng } from './rng';
import type { FieldPlayerData, Tier } from './types';

export interface NpcState {
  id: string;
  name: string;
  nameKo: string;
  club: string;
  position: FieldPosition;
  age: number;
  potentialTier: Tier;
  peakOvr: number;
  peakAge: number;
  attributes: FieldAttributes;
  /** 마지막 시즌 종료 때 OVR 변화 */
  lastChange: number;
  retired: boolean;
}

export function createNpc(data: FieldPlayerData, worldSeed: string, season: number): NpcState {
  const rng = createRng(hashSeed(`${worldSeed}:npc:${data.id}`));
  const [lo, hi] = BALANCE.npc.peakOvr[data.potentialTier];
  const gen = generatePlayer(data, worldSeed);
  return {
    id: data.id,
    name: data.name,
    nameKo: data.nameKo,
    club: data.club,
    position: data.position,
    age: season - data.birthYear,
    potentialTier: data.potentialTier,
    peakOvr: randInt(rng, lo, hi),
    peakAge: randInt(rng, BALANCE.npc.peakAge.min, BALANCE.npc.peakAge.max),
    attributes: gen.attributes,
    lastChange: 0,
    retired: false,
  };
}

export const npcOvr = (n: NpcState): number => positionOvr(n.attributes, n.position);

const SHIFT_WEIGHTS = new Map<FieldPosition, { weights: number[]; total: number }>();
function shiftWeights(pos: FieldPosition): { weights: number[]; total: number } {
  let w = SHIFT_WEIGHTS.get(pos);
  if (!w) {
    const keys = profileOf(pos).keys;
    const weights = FIELD_ATTRIBUTES.map((a: FieldAttribute) => {
      const base = attributeOvrWeight(pos, a);
      return base === 0 ? 0 : base * (keys.includes(a) ? BALANCE.npc.keyAttributeWeight : 1);
    });
    w = { weights, total: weights.reduce((t, x) => t + x, 0) };
    SHIFT_WEIGHTS.set(pos, w);
  }
  return w;
}

/** OVR 을 d 만큼 바꾸도록 능력치를 하나씩 조정. 핵심 능력치일수록 자주 뽑힌다 */
export function shiftOvr(attrs: FieldAttributes, pos: FieldPosition, d: number, rng: Rng): void {
  if (d === 0) return;
  const { weights, total } = shiftWeights(pos);
  const target = positionOvr(attrs, pos) + d;
  for (let guard = 0; guard < 500 && positionOvr(attrs, pos) !== target; guard++) {
    let r = rng() * total;
    let i = 0;
    while (r > weights[i]! && i < weights.length - 1) r -= weights[i++]!;
    const a = FIELD_ATTRIBUTES[i]!;
    attrs[a] = Math.max(1, Math.min(BALANCE.growth.maxAttribute, attrs[a] + Math.sign(d)));
  }
}

/** 시즌 종료 NPC 성장. age 는 그 시즌의 나이이며, 처리 후 +1 된다 */
export function growNpc(n: NpcState, worldSeed: string, season: number): NpcState {
  if (n.retired) return n;
  const N = BALANCE.npc;
  const rng = createRng(hashSeed(`${worldSeed}:npc-growth:${n.id}:${season}`));
  const attrs = { ...n.attributes };
  const before = positionOvr(attrs, n.position);

  if (n.age < n.peakAge) {
    // 전성기 OVR 을 향해 남은 시즌 수에 맞춰 접근
    const remaining = n.peakAge - n.age;
    let d = Math.min(N.maxSeasonGain, (Math.max(0, n.peakOvr - before) / remaining) * N.approach) + gaussian(rng) * N.seasonLuck;
    const roll = rng();
    if (roll < N.breakoutChance) d += N.breakoutBonus;
    else if (roll < N.breakoutChance + N.stagnationChance) d = 0;
    shiftOvr(attrs, n.position, Math.round(d), rng);
  } else {
    // 전성기 이후: 노련함 성장 + 노화 곡선 + 시즌 운 (6.1.1).
    // 전성기 전에는 전성기 OVR 접근 곡선에 노련함이 이미 포함된 것으로 본다
    applyVeteranGrowth(attrs, n.age, rng);
    applyAging(attrs, n.age, rng, n.position);
    shiftOvr(attrs, n.position, Math.round(gaussian(rng) * N.seasonLuck * 0.5), rng);
  }

  const age = n.age + 1;
  return {
    ...n,
    age,
    attributes: attrs,
    lastChange: positionOvr(attrs, n.position) - before,
    retired: age >= BALANCE.retirement.forcedAge,
  };
}
