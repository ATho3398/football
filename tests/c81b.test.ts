// C.81b (53단계): 묶음 마무리 보정 2 — 수치만 (edgeZone 18 · 균형 점유 가치 0.02 · 블록→게겐 상성 칸 · saveBase 1.93 · 1대1 drop 0.3 · CM 평점 중심 2.43)
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';

describe('C.81b 묶음 마무리 보정 2', () => {
  it('상수', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(86);
    expect(ENGINE.offball.edgeZone).toBe(18);
    expect(ENGINE.decide.possess.balanced).toBe(0.02);
    expect(ENGINE.matchup.block!.gegenpress).toEqual({ air: 0, keep: 0 }); // C.82f: 1 → 0 (C.82g 병합 뒤 블록>게겐 +0.45) // C.81z keep 2 → 3 (블록>게겐 +0.01 → ≥ +0.08) → C.82g 0/1 (+0.36 → ±0.3 안)
    expect(ENGINE.matchup.balanced).toEqual({ tikitaka: { long: -10 } });
    expect(ENGINE.keeper.saveBase).toBe(2.11); // C.81s 1.93 → 2.02 → C.82g 2.11(뒤 공간 역습 마무리로 오른 총량 되돌림) · C.82f 유지
    expect(ENGINE.keeper.oneOnOne.drop).toBe(0.5); // C.81h 0.3 → 0.32 · C.81s 0.39 · C.82g 0.44 · C.82f 0.55 (득점 비율 ST 레버, 자유 반경 4 m) · C.82h 0.5 (자유 반경 골 쪽만 뒤 총량)
    expect(ENGINE.rating.center.CM).toBe(2.1); // C.81u: 수비 기록 칸 · CM 전진 패스 무릎 뒤 군 평균 유지로 다시 맞춤 ← C.81r: 평점 가중 뒤 군 평균 유지로 center 다시 맞춤(2.46) → C.81s 2.51 (engine:check CM 6.70 경계)
  });
});
