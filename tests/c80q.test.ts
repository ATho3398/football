// C.80q (53단계): 공격 몰빵 강제 억제 — 선발 공격 포지션(윙·CAM·ST) n명 이상이면 슛 유효 확률(xG) 배수
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { shotModel } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { stackCount, stackMul } from '../src/engine/stack';
import { customSlots, FORMATION_SLOTS, FORMATIONS } from '../src/formations';
import { createTeamRoster } from '../src/roster';
import { stackWarnOf } from '../src/ui/viewModels';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80q-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80q-a', 2018, []);
/** 몰빵 커스텀 대형: 공격 포지션(윙·CAM·ST) 6명 */
const STACK35 = [-1, 1, 3, 25, 27, 2, 15, 21, 12, 23, 17];

function state(cells?: number[]) {
  const h = teamSetupFromRoster(cells ? { ...home, customSlots: customSlots(cells) } : home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 7, bigMatch: false, neutral: true }).state;
}

describe('C.80q 공격 몰빵 억제', () => {
  it('표준 대형 8종은 공격 포지션 4명 이하라 배수 1', () => {
    for (const f of FORMATIONS) {
      const ps = FORMATION_SLOTS[f].map((s) => s.pos);
      expect(stackCount(ps)).toBeLessThan(ENGINE.stackCap.n);
      expect(stackMul(ps)).toBe(1);
    }
  });

  it('배수 = 1 − k × (인원 − n + 1): 4명 1 · 5명 1 − k · 6명 1 − 2k', () => {
    const { n, k } = ENGINE.stackCap;
    expect(n).toBe(5);
    const four = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'LM', 'RM', 'ST', 'ST'] as const;
    const five = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CAM', 'LM', 'RM', 'ST', 'ST'] as const;
    const six = ['GK', 'CB', 'CB', 'LB', 'RB', 'CAM', 'CAM', 'LW', 'RW', 'ST', 'ST'] as const;
    expect(stackMul([...four])).toBe(1);
    expect(stackMul([...five])).toBeCloseTo(1 - k, 12);
    expect(stackMul([...six])).toBeCloseTo(1 - 2 * k, 12);
    expect(stackMul([...six], { n: 5, k: 0, groups: ENGINE.stackCap.groups })).toBe(1);
    expect(stackWarnOf([...four])).toEqual({});
    expect(stackWarnOf([...six]).stackWarn).toBe(`공격 인원 과다(6명) — 골 결정력 −${Math.round(2 * k * 100)}%`);
  });

  it('경기 상태: 몰빵 팀만 배수가 걸리고 슛 판단(shotModel) xG 가 그 배수만큼 준다', () => {
    const s = state(STACK35);
    expect(s.teams[0].stackMul).toBeCloseTo(1 - 2 * ENGINE.stackCap.k, 12);
    expect(s.teams[1].stackMul).toBe(1);
    const a = s.agents.find((x) => x.team === 0 && x.onPitch && !x.gk && x.pos === 'ST')!;
    const m1 = shotModel(s, a);
    s.teams[0].stackMul = 1;
    const m0 = shotModel(s, a);
    expect(m0.xg).toBeGreaterThan(0);
    expect(m1.xg / m0.xg).toBeCloseTo(1 - 2 * ENGINE.stackCap.k, 9);
    expect(state().teams[0].stackMul).toBe(1);
  });
});
