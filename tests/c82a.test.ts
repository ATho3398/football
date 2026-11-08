// C.82a (53단계): 뒷문 비움 — ST·CF 가 cbSt 명 이상인데 CB 가 cbMin 명보다 적으면 몰빵 억제(연계·수비 전환 체력)에 걸린다
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { stackOver, stackPenalty } from '../src/engine/stack';
import { FORMATION_SLOTS, FORMATIONS } from '../src/formations';

describe('C.82a 뒷문 비움', () => {
  it('켜져 있다: cbMin 1 · cbSt 2', () => {
    expect(ENGINE.stackCap.cbMin).toBe(1);
    expect(ENGINE.stackCap.cbSt).toBe(2);
  });

  it('표준 대형 8종은 CB 2명 이상이라 안 걸린다 (상호 득실 그대로)', () => {
    for (const f of FORMATIONS) {
      const ps = FORMATION_SLOTS[f].map((s) => s.pos);
      expect(ps.filter((p) => p === 'CB').length).toBeGreaterThanOrEqual(2);
      expect(stackOver(ps)).toBe(0);
    }
  });

  it('CB 0명 + ST 2명(커스텀 2-3-1-1-3)은 초과 1 · CB 0명이라도 ST 1명이면 안 걸림 · CB 1명이면 안 걸림', () => {
    const cb0 = ['GK', 'LB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'ST'] as const;
    const cb0st1 = ['GK', 'LB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CM', 'CAM', 'LW', 'ST'] as const;
    const cb1 = ['GK', 'CB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'ST'] as const;
    expect(stackOver([...cb0])).toBe(1);
    expect(stackPenalty([...cb0]).link).toBeLessThan(1);
    expect(stackOver([...cb0st1])).toBe(0);
    expect(stackOver([...cb1])).toBe(0);
  });
});

describe('C.82a 경고 문구', async () => {
  const { stackWarnOf } = await import('../src/ui/viewModels');
  it('CB 부족으로만 걸리면 "뒷문 비움"', () => {
    const cb0 = ['GK', 'LB', 'LWB', 'RB', 'RWB', 'CDM', 'CM', 'CAM', 'LW', 'ST', 'ST'] as const;
    expect(stackWarnOf([...cb0]).stackWarn).toMatch(/^뒷문 비움\(CB 0명 · 최전방 2명\) — 연계 −\d+% · 수비 전환 체력 소모 \+\d+%$/);
  });
});
