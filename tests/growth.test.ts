import { describe, expect, it } from 'vitest';
import { ATTRIBUTE_GROUPS, FIELD_ATTRIBUTES, type FieldAttribute, type FieldAttributes } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats } from '../src/game';
import {
  addXp, applyAging, applyVeteranGrowth, autoAllocate, costTier, playerOvr, pointCost, raiseAttribute, raiseBlock,
  veteranXpMultiplier, xpToLevel,
} from '../src/growth';
import { createRng } from '../src/rng';
import { initialProficiency } from '../src/proficiency';
import type { PlayerState } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;
const XP = BALANCE.growth.xpPerLevel;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], season: emptySeasonStats(), history: [], suspended: 0,
    proficiency: initialProficiency('ST'), badges: [], formerPositions: [], honors: { ballonDor: 0, trebles: 0, worldCups: 0 },
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

  it('OVR 80 을 넘으면 필요 XP 가 늘어난다: 기본 × (1 + (OVR - 80) × perOvr) (부록 D.6 #2)', () => {
    expect(xpToLevel(player({ attributes: flat(80) }))).toBe(XP);
    const p = player({ attributes: flat(90) });
    expect(playerOvr(p)).toBe(90);
    const need = Math.round(XP * (1 + 10 * BALANCE.growth.xpByOvr.perOvr));
    expect(xpToLevel(p)).toBe(need);
    expect(addXp(p, need - 1)).toBe(0);
    expect(addXp(p, 1)).toBe(1);
  });
});

describe('포인트 비용 구간 (6.2)', () => {
  it('티어별 구간 경계', () => {
    expect([70, 71, 84, 85].map((v) => pointCost(v, 'normal'))).toEqual([1, 2, 2, 3]);
    expect([80, 81, 92].map((v) => pointCost(v, 'legendary'))).toEqual([1, 2, 2]);
    expect([76, 77, 89, 90].map((v) => pointCost(v, 'topClass'))).toEqual([1, 2, 2, 3]);
  });

  it('고값 추가 비용: 93~95 → 4, 96~97 → 6, 98 → 9 (위상 무관, 부록 D.6 #1)', () => {
    for (const tier of ['normal', 'legendary'] as const) {
      expect([92, 93, 95, 96, 97, 98].map((v) => pointCost(v, tier))).toEqual([tier === 'normal' ? 3 : 2, 4, 4, 6, 6, 9]);
    }
  });

  it('내 선수의 비용 구간은 숨은 잠재력도 위상도 아니라 현재 실력 티어(OVR)로 정한다 (성장 해금, 부록 C.23)', () => {
    expect(costTier(player({ potentialTier: 'legendary', reputation: 1000 }))).toBe('normal'); // OVR 60
    const top = player({ attributes: flat(80) });
    expect(playerOvr(top)).toBe(80);
    expect(costTier(top)).toBe('topClass');
    expect(costTier(player({ attributes: flat(80), reputation: 1000 }))).toBe('topClass');
    const p = player({ potentialTier: 'legendary', reputation: 1000, attributes: { ...flat(60), shooting: 72 } });
    addXp(p, XP);
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 일반 구간: 72 는 비용 2 (위상 1000 이어도)
    expect(p.unspentPoints).toBe(3);
    p.attributes = { ...flat(95), shooting: 73 };
    expect(costTier(p)).toBe('legendary');
    expect(raiseAttribute(p, 'shooting')).toBe(true); // 레전더리 실력 구간: 73 은 비용 1
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

  it('신체: 30세 -1, 32세 -2.2, 36세 -3 (부록 D.6 #6, 코드 세션 조정)', () => {
    expect(avgDrop(30, physical)).toBe(1);
    expect(avgDrop(32, physical)).toBeCloseTo(2.2, 1);
    expect(avgDrop(36, physical)).toBe(3);
  });

  it('기술/수비/멘탈: 32세까지 변화 없음, 33세 2년에 -1꼴, 35세 -1, 37세 -2', () => {
    expect(avgDrop(32, other)).toBe(0);
    expect(avgDrop(33, other)).toBeCloseTo(0.5, 1);
    expect(avgDrop(35, other)).toBe(1);
    expect(avgDrop(37, other)).toBe(2);
  });

  // 기획서 6.1.1은 절반(0.5). 실제 값은 BALANCE.veteran.agingFactor (부록 C.8)
  it('노련함 능력치: 34세까지 면제, 35세부터 기술/멘탈 하락 × agingFactor', () => {
    const f = BALANCE.veteran.agingFactor;
    expect(avgDrop(34, veteran)).toBe(0);
    expect(avgDrop(35, veteran)).toBeCloseTo(1 * f, 1);
    expect(avgDrop(37, veteran)).toBeCloseTo(2 * f, 1);
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

  it('26세 이하와 34세 이후는 없음, 27~30세 50%, 31~33세 25%. 노련함 능력치만 오른다', () => {
    expect(avgGain(26)).toBe(0);
    expect(avgGain(27)).toBeCloseTo(0.5, 1);
    expect(avgGain(30)).toBeCloseTo(0.5, 1);
    expect(avgGain(31)).toBeCloseTo(0.25, 1);
    expect(avgGain(33)).toBeCloseTo(0.25, 1);
    expect(avgGain(34)).toBe(0);
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
  it('29세 ×1, 30세 ×0.75, 32세 ×0.6, 34세 ×0.45, 36세 ×0.3 (부록 D.6 #4, 코드 세션 조정)', () => {
    expect([29, 30, 31, 32, 34, 36, 37].map(veteranXpMultiplier)).toEqual([1, 0.75, 0.75, 0.6, 0.45, 0.3, 0.3]);
  });
});
