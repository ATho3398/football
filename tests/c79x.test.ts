// C.79x: 거리 구간별 선방 보정(keeper.distAdj) · 1대1 선방 보정(keeper.oneOnOne, GK 능력·슈터 마무리 차등) — 판단·실행 같은 식(saveChance)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { distAdj, gkCtx, keeperOf, oneOnOneAdj, saveChance, type ShotCtx } from '../src/engine/keeper';
import { shotModel } from '../src/engine/onball';
import { L, W } from '../src/engine/pitch';
import { KEEPER_ON, pick, place, sceneState, withEngine } from './scenes/harness';

function ctxAt(sx: number, sy: number, defender: boolean): ShotCtx {
  // defender: 슛 길 가운데에 수비 한 명
  const s = sceneState(3);
  const gk = keeperOf(s, 1)!;
  const a = pick(s, 0, 3, 1);
  const d = s.agents.find((o) => o.team === 1 && o.line !== 0)!;
  for (const o of s.agents) if (o !== a && o !== gk) place(o, L / 2 - 15, 34);
  place(a, sx, sy);
  place(gk, L - 3, W / 2);
  if (defender) place(d, (sx + L) / 2, W / 2 + (sy - W / 2) / 2);
  s.ball.x = sx;
  s.ball.y = sy;
  s.ball.owner = a.idx;
  s.ball.flight = null;
  return { ...shotModel(s, a).ctx, ...gkCtx(gk) };
}

describe('C.79x 거리별·1대1 선방', () => {
  it('거리 보정: 12 m 안 0, 12~16.5 m 음수, 27 m 이상 끝 값, 그 사이 선형', () => {
    const K = ENGINE.keeper;
    expect(distAdj(8)).toBe(0);
    expect(distAdj(12)).toBe(0);
    expect(distAdj(15)).toBeLessThan(0);
    expect(distAdj(30)).toBe(K.distAdjV[K.distAdjV.length - 1]);
    expect(distAdj(12.5)).toBeCloseTo(K.distAdjV[1]! / 2, 6);
  });
  it('1대1 보정: 압박 0 · 12.5 m 안 발 슛만, 좋은 GK 는 덜 깎이고 좋은 슈터는 더 깎는다', () => {
    withEngine(KEEPER_ON, () => {
      // 구석 0.9 · 빠른 공 (선방 상한 0.95 에 안 붙는 슛)
      const c = { ...ctxAt(L - 11, W / 2 - 1, false), ty: W / 2 - 2.8, corner: 0.9, speed: 30 };
      expect(c.press3).toBe(0);
      expect(oneOnOneAdj(c)).toBeLessThan(0);
      expect(oneOnOneAdj({ ...c, press3: 1 })).toBe(0);
      expect(oneOnOneAdj({ ...c, d: 13 })).toBe(0);
      expect(oneOnOneAdj({ ...c, gk1: 90 })).toBeGreaterThan(oneOnOneAdj({ ...c, gk1: 55 }));
      expect(oneOnOneAdj({ ...c, fin: 90 })).toBeLessThan(oneOnOneAdj({ ...c, fin: 50 }));
      expect(saveChance({ ...c, gk1: 90 })).toBeGreaterThan(saveChance({ ...c, gk1: 55 }));
      // 같은 자리, 압박이 있으면 보정이 없다
      expect(saveChance({ ...c, press3: 1 })).toBeGreaterThan(saveChance(c));
    });
  });
  it('헤더는 거리·1대1 보정 밖', () => {
    withEngine(KEEPER_ON, () => {
      const c = ctxAt(L - 14, W / 2 - 1, false);
      const h = { ...c, header: true };
      expect(saveChance({ ...h, press3: 0 })).toBe(saveChance({ ...h, press3: 1 }));
    });
  });
});
