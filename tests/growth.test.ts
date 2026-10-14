import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats } from '../src/game';
import { addXp, applyAging, autoAllocate, pointCost, raiseAttribute, raiseBlock } from '../src/growth';
import { createRng } from '../src/rng';
import type { PlayerState } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;
const XP = BALANCE.growth.xpPerLevel;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, reputation: 0, coachWarned: false, season: emptySeasonStats(), history: [],
    ...overrides,
  };
}

describe('레벨업', () => {
  it('XP 가 차면 레벨업하고 포인트 5개', () => {
    const p = player();
    expect(addXp(p, XP - 1)).toBe(0);
    expect(addXp(p, 1)).toBe(1);
    expect(p).toMatchObject({ level: 1, unspentPoints: 5, xp: 0 });
    expect(addXp(p, XP * 2 + 10)).toBe(2);
    expect(p).toMatchObject({ level: 3, unspentPoints: 15, xp: 10, totalXp: XP * 3 + 10 });
  });
});

describe('포인트 비용 구간 (6.2)', () => {
  it('티어별 구간 경계', () => {
    expect([70, 71, 84, 85].map((v) => pointCost(v, 'normal'))).toEqual([1, 2, 2, 3]);
    expect([80, 81, 92, 93].map((v) => pointCost(v, 'legendary'))).toEqual([1, 2, 2, 3]);
    expect([76, 77, 89, 90].map((v) => pointCost(v, 'topClass'))).toEqual([1, 2, 2, 3]);
  });

  it('비용만큼 포인트가 줄고, 비용 2 구간에 들어서면 코치 코멘트', () => {
    const p = player({ attributes: { ...flat(60), shooting: 69 } });
    addXp(p, XP);
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 69→70, 비용 1
    expect(p.coachWarned).toBe(false);
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 70→71, 비용 1, 이제 비용 2 구간
    expect(p.coachWarned).toBe(true);
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 71→72, 비용 2
    expect(p.unspentPoints).toBe(1);
    expect(raiseBlock(p, 'shooting')).toBe('points');
  });

  it('한 번의 레벨업에서 한 능력치 최대 +3, 레벨이 쌓이면 상한도 늘어남', () => {
    const p = player();
    addXp(p, XP);
    for (let i = 0; i < 3; i++) expect(raiseAttribute(p, 'pace')).toBe(true);
    expect(raiseBlock(p, 'pace')).toBe('cap');
    expect(raiseAttribute(p, 'pace')).toBe(false);
    addXp(p, XP);
    expect(raiseAttribute(p, 'pace')).toBe(true);
  });

  it('포인트가 모자라거나 99면 못 올린다', () => {
    const p = player({ attributes: { ...flat(60), pace: 99, shooting: 90 } });
    expect(raiseBlock(p, 'dribbling')).toBe('points');
    addXp(p, XP);
    expect(raiseBlock(p, 'pace')).toBe('max');
    p.unspentPoints = 2;
    expect(raiseBlock(p, 'shooting')).toBe('points'); // 비용 3
  });

  it('자동 배분은 포인트를 다 쓰거나 더 쓸 데가 없을 때 멈춘다', () => {
    const p = player();
    addXp(p, XP * 2);
    autoAllocate(p);
    expect(p.unspentPoints).toBe(0);
    const sum = FIELD_ATTRIBUTES.reduce((t, a) => t + p.attributes[a], 0);
    expect(sum).toBe(60 * 25 + 10);
  });
});

describe('노화 (6.1)', () => {
  const physical = [...ATTRIBUTE_GROUPS.pace, ...ATTRIBUTE_GROUPS.physical] as FieldAttribute[];
  const other = FIELD_ATTRIBUTES.filter((a) => !physical.includes(a));

  it('28세까지는 변화 없음', () => {
    const a = flat(80);
    expect(applyAging(a, 28, createRng(1))).toEqual({});
    expect(a).toEqual(flat(80));
  });

  it('29세: 신체 능력치만 -1~2', () => {
    const a = flat(80);
    applyAging(a, 29, createRng(2));
    for (const k of physical) expect(80 - a[k]).toBeGreaterThanOrEqual(1);
    for (const k of physical) expect(80 - a[k]).toBeLessThanOrEqual(2);
    for (const k of other) expect(a[k]).toBe(80);
  });

  it('33세: 기술/멘탈/수비도 -1', () => {
    const a = flat(80);
    applyAging(a, 33, createRng(3));
    for (const k of other) expect(a[k]).toBe(79);
  });

  it('35세 이후 하락 폭 1.5배', () => {
    let drop33 = 0;
    let drop35 = 0;
    for (let s = 0; s < 50; s++) {
      const a = flat(80);
      const b = flat(80);
      applyAging(a, 33, createRng(s));
      applyAging(b, 35, createRng(s));
      for (const k of FIELD_ATTRIBUTES) {
        drop33 += 80 - a[k];
        drop35 += 80 - b[k];
      }
    }
    expect(drop35 / drop33).toBeGreaterThan(1.35);
    expect(drop35 / drop33).toBeLessThan(1.65);
  });
});
