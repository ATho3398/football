// C.81b (53단계): 묶음 마무리 보정 2 — 수치만 (edgeZone 18 · 균형 점유 가치 0.02 · 블록→게겐 상성 칸 · saveBase 1.93 · 1대1 drop 0.3 · CM 평점 중심 2.43)
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';

describe('C.81b 묶음 마무리 보정 2', () => {
  it('상수', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(86);
    expect(ENGINE.offball.edgeZone).toBe(18);
    expect(ENGINE.decide.possess.balanced).toBe(0.02);
    expect(ENGINE.matchup.block!.gegenpress).toEqual({ air: 2, keep: 2 });
    expect(ENGINE.matchup.balanced).toEqual({ tikitaka: { long: -10 } });
    expect(ENGINE.keeper.saveBase).toBe(2.02); // C.81s 1.93 → 2.02
    expect(ENGINE.keeper.oneOnOne.drop).toBe(0.39); // C.81h 0.3 → 0.32 (윙어 마무리 0.92 뒤 장면 ④ 1대1 골 0.253) → C.81s 0.39 (saveBase 2.02 뒤 0.254)
    expect(ENGINE.rating.center.CM).toBe(2.43);
  });
});
