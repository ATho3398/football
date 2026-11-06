// C.80b 빠른 경기 무승부 보정 (Dixon-Coles ρ) · 달력 칸 "중립"
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { scorePair } from '../src/league';
import { createRng } from '../src/rng';

function sample(rho: number, lh: number, la: number, n = 40000) {
  const M = BALANCE.match as { drawRho: number };
  const old = M.drawRho;
  M.drawRho = rho;
  let h = 0, a = 0, d = 0, z = 0;
  const rng = createRng(80);
  for (let k = 0; k < n; k++) {
    const [x, y] = scorePair(rng, lh, la);
    h += x; a += y;
    if (x === y) d++;
    if (!x && !y) z++;
  }
  M.drawRho = old;
  return { h: h / n, a: a / n, d: d / n, z: z / n };
}

describe('C.80b 빠른 경기 무승부 보정', () => {
  it('ρ < 0 이면 무승부·0-0 이 늘고 팀 득점 평균은 그대로', () => {
    const base = sample(0, 1.6, 1.3);
    const dc = sample(BALANCE.match.drawRho, 1.6, 1.3);
    expect(BALANCE.match.drawRho).toBeLessThan(0);
    expect(dc.d - base.d).toBeGreaterThan(0.025);
    expect(dc.z).toBeGreaterThan(base.z);
    expect(Math.abs(dc.h - 1.6)).toBeLessThan(0.03);
    expect(Math.abs(dc.a - 1.3)).toBeLessThan(0.03);
  });
  it('득점 기대가 커도 확률이 음수가 되지 않는다', () => {
    const r = sample(-0.5, 4, 0.3, 5000);
    expect(Number.isFinite(r.h)).toBe(true);
    expect(r.h).toBeGreaterThan(3.5);
  });
});
