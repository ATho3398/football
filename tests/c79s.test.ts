// C.79s: GK 예측 속임(keeper.read) — 선방 = 기다림·맞음·틀림(역동작) 기대값, 적중은 GK 선방 대 슈터 속임(침착·볼 컨트롤·시야), 판단·실행 같은 식
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { gkCtx, keeperOf, saveChance, type ShotCtx } from '../src/engine/keeper';
import { shotModel } from '../src/engine/onball';
import { L, W } from '../src/engine/pitch';
import { KEEPER_ON, pick, place, sceneState, withEngine } from './scenes/harness';

function ctxAt(sx: number, sy: number, gkAt: [number, number]): ShotCtx {
  const s = sceneState(3);
  const gk = keeperOf(s, 1)!;
  const a = pick(s, 0, 3, 1);
  for (const o of s.agents) if (o !== a && o !== gk) place(o, L / 2 - 15, 34);
  place(a, sx, sy);
  place(gk, gkAt[0], gkAt[1]);
  s.ball.x = sx;
  s.ball.y = sy;
  s.ball.owner = a.idx;
  s.ball.flight = null;
  // 1 m 비킨 GK·구석 0.9 (덮는 정도가 포화되지 않는 자리)
  return { ...shotModel(s, a).ctx, ...gkCtx(gk), stop: ENGINE.keeper.leagueShotStopping, body: 0, ty: W / 2 - 2.8, corner: 0.9 };
}

describe('C.79s GK 예측 속임', () => {
  it('기본 켬: read 1 · readCommit 0.3 · readMinT 0.3 (0.4 이상은 득점 가드 밖)', () => {
    const K = ENGINE.keeper;
    expect(K.read).toBe(1);
    expect(K.readCommit).toBe(0.3);
    expect(K.readMinT).toBe(0.3);
  });
  it('슛 자료에 슈터 속임 능력(침착 0.5 + 볼 컨트롤 0.3 + 시야 0.2)이 실린다', () => {
    withEngine(KEEPER_ON, () => {
      const c = ctxAt(L - 18, W / 2 - 4, [L - 3, W / 2 + 1]);
      expect(c.feint).toBeGreaterThan(0);
    });
  });
  it('먼 슛: 속임 좋은 슈터는 덜 막히고, 선방 좋은 GK 는 기제가 없을 때보다 더 막는다', () => {
    withEngine(KEEPER_ON, () => {
      const c = ctxAt(L - 18, W / 2 - 4, [L - 3, W / 2 + 1]);
      expect(saveChance({ ...c, feint: 90 })).toBeLessThan(saveChance({ ...c, feint: 50 }));
      const gain = (read: number) => withEngine({ 'keeper.read': read }, () => saveChance({ ...c, stop: 90 }) - saveChance({ ...c, stop: 60 }));
      expect(gain(1)).toBeGreaterThan(gain(0));
    });
  });
  it('1대1·근거리(공이 대응 지점까지 readMinT 미만)는 기울지 않는다 — read 끔과 같은 값', () => {
    withEngine(KEEPER_ON, () => {
      const c = ctxAt(L - 6, W / 2 - 1, [L - 2, W / 2]);
      const off = withEngine({ 'keeper.read': 0 }, () => saveChance({ ...c, feint: 95 }));
      expect(saveChance({ ...c, feint: 95 })).toBe(off);
    });
  });
  it('헤더는 제외', () => {
    withEngine(KEEPER_ON, () => {
      const c = { ...ctxAt(L - 18, W / 2 - 4, [L - 3, W / 2 + 1]), header: true };
      const off = withEngine({ 'keeper.read': 0 }, () => saveChance(c));
      expect(saveChance(c)).toBe(off);
    });
  });
});
