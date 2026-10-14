import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats } from '../src/game';
import {
  addXp, applyAging, applyVeteranGrowth, autoAllocate, costTier, pointCost, raiseAttribute, raiseBlock,
  veteranXpMultiplier,
} from '../src/growth';
import { createRng } from '../src/rng';
import type { PlayerState } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;
const XP = BALANCE.growth.xpPerLevel;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], season: emptySeasonStats(), history: [],
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

  it('내 선수의 비용 구간은 숨은 잠재력이 아니라 현재 위상 티어로 정한다 (성장 해금)', () => {
    const cuts = BALANCE.reputation.tierCuts;
    expect(costTier(player({ potentialTier: 'legendary', reputation: 0 }))).toBe('normal');
    expect(costTier(player({ reputation: cuts.topClass }))).toBe('topClass');
    const p = player({ potentialTier: 'legendary', attributes: { ...flat(60), shooting: 72 } });
    addXp(p, XP);
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 일반 구간: 72 는 비용 2
    expect(p.unspentPoints).toBe(3);
    p.reputation = cuts.legendary;
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 레전더리 구간: 73 은 비용 1
    expect(p.unspentPoints).toBe(2);
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
  const veteran = [...BALANCE.veteran.attributes];
  const other = FIELD_ATTRIBUTES.filter((a) => !physical.includes(a) && !veteran.includes(a));

  /** 시드 여러 개로 능력치 묶음별 평균 하락 */
  function avgDrop(age: number, attrs: FieldAttribute[]): number {
    let drop = 0;
    for (let s = 0; s < 200; s++) {
      const a = flat(80);
      applyAging(a, age, createRng(s));
      for (const k of attrs) drop += 80 - a[k];
    }
    return drop / (200 * attrs.length);
  }

  it('29세까지는 변화 없음', () => {
    const a = flat(80);
    expect(applyAging(a, 29, createRng(1))).toEqual({});
    expect(a).toEqual(flat(80));
  });

  it('신체: 30세 2년에 -1꼴, 32세 매년 -1, 36세 매년 -2', () => {
    expect(avgDrop(30, physical)).toBeCloseTo(0.5, 1);
    expect(avgDrop(32, physical)).toBe(1);
    expect(avgDrop(36, physical)).toBe(2);
  });

  it('기술/수비/멘탈: 32세까지 변화 없음, 33세 2년에 -1꼴, 35세 -1, 37세 -2', () => {
    expect(avgDrop(32, other)).toBe(0);
    expect(avgDrop(33, other)).toBeCloseTo(0.5, 1);
    expect(avgDrop(35, other)).toBe(1);
    expect(avgDrop(37, other)).toBe(2);
  });

  it('노련함 능력치: 35세까지 면제, 36세부터 기술/멘탈 하락의 절반', () => {
    expect(avgDrop(35, veteran)).toBe(0);
    expect(avgDrop(36, veteran)).toBeCloseTo(0.5, 1);
    expect(avgDrop(37, veteran)).toBe(1);
  });
});

describe('노련함 성장 (6.1.1)', () => {
  function avgGain(age: number): number {
    let gain = 0;
    for (let s = 0; s < 200; s++) {
      const a = flat(80);
      applyVeteranGrowth(a, age, createRng(s));
      for (const k of FIELD_ATTRIBUTES) gain += a[k] - 80;
    }
    return gain / (200 * BALANCE.veteran.attributes.length);
  }

  it('26세 이하와 35세 이후는 없음, 27~31세 50%, 32~34세 30%. 노련함 능력치만 오른다', () => {
    expect(avgGain(26)).toBe(0);
    expect(avgGain(27)).toBeCloseTo(0.5, 1);
    expect(avgGain(31)).toBeCloseTo(0.5, 1);
    expect(avgGain(32)).toBeCloseTo(0.3, 1);
    expect(avgGain(35)).toBe(0);
    const a = flat(80);
    const d = applyVeteranGrowth(a, 28, createRng(3));
    for (const k of Object.keys(d)) expect(BALANCE.veteran.attributes).toContain(k);
  });

  it('최대 99', () => {
    const a = flat(99);
    expect(applyVeteranGrowth(a, 28, createRng(1))).toEqual({});
  });
});

describe('고령 XP 감쇠 (6.1)', () => {
  it('32세 ×1, 33세 ×0.8, 35세 ×0.6, 37세 ×0.4', () => {
    expect([32, 33, 34, 35, 36, 37].map(veteranXpMultiplier)).toEqual([1, 0.8, 0.8, 0.6, 0.6, 0.4]);
  });
});
