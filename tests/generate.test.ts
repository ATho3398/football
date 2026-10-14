import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { generatePlayer } from '../src/generate';
import { messi } from '../data/players/messi';

describe('generatePlayer', () => {
  it('같은 시드면 같은 결과', () => {
    expect(generatePlayer(messi, 'save-1')).toEqual(generatePlayer(messi, 'save-1'));
  });

  it('시드가 다르면 결과가 달라짐', () => {
    expect(generatePlayer(messi, 'save-1').attributes).not.toEqual(generatePlayer(messi, 'save-2').attributes);
  });

  it('능력치 25개, 모두 0~100 정수, 변동 폭 이내', () => {
    for (let s = 0; s < 200; s++) {
      const p = generatePlayer(messi, `seed-${s}`);
      expect(Object.keys(p.attributes)).toHaveLength(25);
      for (const a of FIELD_ATTRIBUTES) {
        const v = p.attributes[a];
        expect(Number.isInteger(v)).toBe(true);
        if (a === 'heading') {
          expect(v).toBeGreaterThanOrEqual(58);
          expect(v).toBeLessThanOrEqual(70);
        } else {
          expect(Math.abs(v - messi.attributes[a])).toBeLessThanOrEqual(3);
        }
      }
    }
  });

  it('회차마다 선수 전체 수준이 달라짐 (전체 운)', () => {
    const avg = (s: string) => {
      const a = generatePlayer(messi, s).attributes;
      return FIELD_ATTRIBUTES.reduce((t, k) => t + a[k], 0) / FIELD_ATTRIBUTES.length;
    };
    const avgs = Array.from({ length: 100 }, (_, i) => avg(`seed-${i}`));
    expect(Math.max(...avgs) - Math.min(...avgs)).toBeGreaterThan(1.5);
  });

  it('같은 묶음 능력치는 같이 움직임 (드리블↔볼 컨트롤 상관 > 0)', () => {
    const xs: number[] = [], ys: number[] = [];
    for (let i = 0; i < 500; i++) {
      const a = generatePlayer({ ...messi, variance: { spread: 8 } }, `s${i}`).attributes;
      xs.push(a.dribbling); ys.push(a.ballControl);
    }
    const m = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    const mx = m(xs), my = m(ys);
    const cov = xs.reduce((t, x, i) => t + (x - mx) * (ys[i]! - my), 0);
    const corr = cov / Math.sqrt(xs.reduce((t, x) => t + (x - mx) ** 2, 0) * ys.reduce((t, y) => t + (y - my) ** 2, 0));
    expect(corr).toBeGreaterThan(0.4);
  });
});
