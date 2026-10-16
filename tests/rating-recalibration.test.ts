import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { ENGINE } from '../src/engine/config';
import { ratingDelta, ratingFromParts, type RatingParts } from '../src/engine/rating';
import { positionCenter, simulateMatch } from '../src/match';
import type { FieldPosition } from '../src/positions';
import { createRng, hashSeed } from '../src/rng';

const blank = (extra: Partial<RatingParts> = {}): RatingParts => ({
  group: 'ST', passes: 0, forward: 0, keyPasses: 0, onTarget: 0, goals: 0, assists: 0, dribbles: 0, tackles: 0,
  interceptions: 0, aerials: 0, lost: 0, dangerLost: 0, attackLost: 0, fouls: 0, offsides: 0, yellows: 0, red: 0,
  conceded: 0, saves: 0, cleanSheet: 0, result: 0, ...extra,
});

describe('엔진 평점 재보정 (C.26)', () => {
  const R = ENGINE.rating;

  it('골은 평점 약 +1.0, 도움은 약 +0.6 (scale 포함). 골이 된 슈팅은 유효 슈팅으로 다시 세지 않는다', () => {
    const goal = ratingDelta(blank({ goals: 1, onTarget: 1 })) - ratingDelta(blank());
    expect(goal * R.scale).toBeCloseTo(1.0, 1);
    const assist = ratingDelta(blank({ assists: 1 })) - ratingDelta(blank());
    expect(assist * R.scale).toBeCloseTo(0.6, 1);
    // 골 없는 유효 슈팅은 그대로 +onTarget
    expect(ratingDelta(blank({ onTarget: 2, goals: 1 })) - ratingDelta(blank({ onTarget: 1, goals: 1 }))).toBeCloseTo(R.onTarget);
  });

  it('상대 진영 마지막 1/3 공 상실은 보통 상실 감점의 절반, 우리 진영 1/3 은 위험 지역 감점', () => {
    const base = ratingDelta(blank());
    expect(ratingDelta(blank({ lost: 1 })) - base).toBeCloseTo(R.lost);
    expect(ratingDelta(blank({ lost: 1, attackLost: 1 })) - base).toBeCloseTo(R.lost * 0.5);
    expect(ratingDelta(blank({ lost: 1, dangerLost: 1 })) - base).toBeCloseTo(R.dangerLost);
  });

  it('포지션 center 에서 평균 6.5, 3.0~10.0 으로 자른다', () => {
    const p = blank({ group: 'CM' });
    const d = ratingDelta(p);
    const at = (shift: number) => ratingFromParts(p, { ...R, center: { ...R.center, CM: d + shift } });
    expect(at(0)).toBe(6.5);
    expect(at(10)).toBe(3);
    expect(at(-10)).toBe(10);
  });
});

describe('빠른 경기 평점 재보정 (C.26)', () => {
  const run = (position: FieldPosition, n: number) => {
    const rng = createRng(hashSeed(`c26-${position}`));
    const out: { r: number; g: number }[] = [];
    for (let i = 0; i < n; i++) {
      const m = simulateMatch({ ovr: 75, position, fatigue: 0, teamRating: 75, oppRating: 75, home: i % 2 === 0, difficulty: 'normal' }, rng);
      if (m.rating !== null && m.minutes === 90) out.push({ r: m.rating, g: m.goals });
    }
    return out;
  };
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it('동레이팅이면 포지션마다 평균이 약 6.5 (기대 골·도움·클린시트 몫을 뺀다)', () => {
    for (const pos of ['CB', 'CM', 'LW', 'ST'] as FieldPosition[]) {
      expect(Math.abs(avg(run(pos, 3000).map((x) => x.r)) - 6.5)).toBeLessThan(0.08);
    }
    expect(positionCenter('ST', 1, 1)).toBeGreaterThan(positionCenter('CM', 1, 1));
    // 교체로 짧게 뛰면 기대 몫도 작다
    expect(positionCenter('ST', 0.3, 0.4)).toBeLessThan(positionCenter('ST', 1, 1));
  });

  it('ST 득점 경기는 무득점 경기보다 약 1 이상 높다', () => {
    const xs = run('ST', 4000);
    const zero = avg(xs.filter((x) => x.g === 0).map((x) => x.r));
    const one = avg(xs.filter((x) => x.g === 1).map((x) => x.r));
    expect(one - zero).toBeGreaterThan(0.9);
    expect(one - zero).toBeLessThan(1.5);
    expect(BALANCE.rating.goal).toBe(1.0);
  });
});
