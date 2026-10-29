// C.79o 빠른 경기 홈 이점 = 레이팅 이동, 결승·대표팀 대회 중립
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { expectedGoals, simulateScore } from '../src/league';
import { isNeutralMatch, venueKo } from '../src/game';
import type { MyCupTie } from '../src/cups';
import type { NatMatch } from '../src/national';
import { createRng } from '../src/rng';

describe('C.79o 빠른 경기 홈 이점', () => {
  it('홈 팀 득점에만 레이팅 +homeRating', () => {
    const M = BALANCE.match;
    expect(expectedGoals(70, 70, true)).toBeCloseTo(expectedGoals(70 + M.homeRating, 70, false), 10);
    expect(expectedGoals(70, 70, false)).toBeCloseTo(M.baseGoals, 10);
    // 약팀·강팀 홈 모두 같은 비율 (골 덧셈이 아님)
    expect(expectedGoals(60, 80, true) / expectedGoals(60, 80, false)).toBeCloseTo(expectedGoals(80, 60, true) / expectedGoals(80, 60, false), 10);
  });
  it('중립이면 두 팀 대칭', () => {
    let h = 0, a = 0;
    for (let k = 0; k < 4000; k++) {
      const [x, y] = simulateScore(createRng(k), 75, 75, true);
      h += x;
      a += y;
    }
    expect(Math.abs(h - a) / 4000).toBeLessThan(0.08);
  });
  it('결승·대표팀 대회 = 중립, 평가전·일반 경기는 아님', () => {
    expect(isNeutralMatch({ cup: { final: true } as MyCupTie })).toBe(true);
    expect(isNeutralMatch({ cup: { final: false } as MyCupTie })).toBe(false);
    expect(isNeutralMatch({ nat: { comp: 'wc' } as NatMatch })).toBe(true);
    expect(isNeutralMatch({ nat: { comp: 'friendly' } as NatMatch })).toBe(false);
    expect(isNeutralMatch({})).toBe(false);
    expect(venueKo(true, true)).toBe('중립');
    expect(venueKo(false)).toBe('원정');
  });
});
