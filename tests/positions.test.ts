import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { attributeOvrWeight, positionOvr, positionOvrExact, PLAYABLE_POSITIONS, profileOf } from '../src/positions';
import { messi } from '../data/players/messi';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

describe('포지션 OVR', () => {
  it('모든 포지션 묶음 가중치 합이 100', () => {
    for (const p of PLAYABLE_POSITIONS) {
      expect(Object.values(profileOf(p).weights).reduce((a, b) => a + b, 0)).toBe(100);
    }
  });

  it('능력치가 모두 같으면 OVR 도 같은 값', () => {
    for (const p of PLAYABLE_POSITIONS) expect(positionOvr(flat(70), p)).toBe(70);
  });

  it('핵심 능력치는 묶음 평균에서 2배', () => {
    // ST 마무리 묶음: 슈팅(핵심) 2, 중거리 1, 헤더 1, 위치선정(핵심) 2 → 슈팅 +6 은 묶음 평균 +2, OVR +0.8
    const a = flat(60);
    a.shooting += 6;
    expect(positionOvrExact(a, 'ST')).toBeCloseTo(60 + 2 * 0.4);
    expect(attributeOvrWeight('ST', 'shooting')).toBeCloseTo(0.4 * 2 / 6);
    expect(attributeOvrWeight('ST', 'tackling')).toBe(0);
  });

  it('LWB/RWB 는 LB/RB 가중치를 쓴다', () => {
    expect(positionOvrExact(messi.attributes, 'LWB')).toBe(positionOvrExact(messi.attributes, 'LB'));
    expect(positionOvrExact(messi.attributes, 'RWB')).toBe(positionOvrExact(messi.attributes, 'RB'));
  });

  it('메시는 RW 가 CB 보다 훨씬 높다', () => {
    expect(positionOvr(messi.attributes, 'RW')).toBeGreaterThanOrEqual(85);
    expect(positionOvr(messi.attributes, 'CB')).toBeLessThan(60);
  });
});
