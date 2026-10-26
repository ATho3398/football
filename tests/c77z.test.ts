// C.77z (공통 규칙 로드맵 4단계): 슛 1건 자료 — 판단(shotModel)과 실행(shoot → shotArrives)이 같은 식(saveChance)을 쓴다
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { coverOf, gkCtx, keeperCover, keeperOf, saveChance, saveProb } from '../src/engine/keeper';
import { shotExec, shotModel } from '../src/engine/onball';
import { L, W } from '../src/engine/pitch';
import { KEEPER_ON, pick, place, sceneState, withEngine } from './scenes/harness';

/** 슈터 한 명, 상대 GK 를 리그 GK(선방 leagueShotStopping·키 0)로, 나머지는 하프라인 */
function setup(sx: number, sy: number, gkAt: [number, number], gkV: [number, number] = [0, 0]) {
  const s = sceneState(3);
  const gk = keeperOf(s, 1)!;
  const a = pick(s, 0, 3, 1);
  for (const o of s.agents) if (o !== a && o !== gk) place(o, L / 2 - 15, 34);
  place(a, sx, sy);
  place(gk, gkAt[0], gkAt[1], gkV[0], gkV[1]);
  gk.gk = { ...gk.gk!, attrs: { ...gk.gk!.attrs, shotStopping: ENGINE.keeper.leagueShotStopping } };
  gk.body = { ...gk.body, gkSave: 0 };
  s.ball.x = sx;
  s.ball.y = sy;
  s.ball.owner = a.idx;
  s.ball.flight = null;
  return { s, a, gk };
}

describe('C.77z 슛 1건 자료 · 판단 = 실행', () => {
  const spots: [number, number, [number, number], [number, number]][] = [
    [L - 12, W / 2 - 3, [L - 3, W / 2 - 1], [0, 0]],
    [L - 9, W / 2 + 4, [L - 4, W / 2 - 4], [0, 3]],
    [L - 22, W / 2 + 8, [L - 2, W / 2 + 1], [0, -2]],
    [L - 7, W / 2, [L - 1, W / 2 + 3], [0, 0]],
  ];
  it('오차 0(리그 GK·같은 자리)이면 판단 xG = 실행 골 확률 (대응 시간 모델 켬)', () => {
    withEngine(KEEPER_ON, () => {
      for (const [sx, sy, g, v] of spots) {
        for (const header of [false, true]) {
          const { s, a } = setup(sx, sy, g, v);
          const m = shotModel(s, a, header);
          const e = shotExec(s, a, header);
          expect(e.goal).toBeCloseTo(m.xg, 12);
        }
      }
    });
  });
  it('꺼짐(timeModel 0): saveChance = 옛 saveProb × 옛 도달 항 (지문 불변)', () => {
    // C.78b: 설정은 켬(사용자 2026-10-23) — 꺼진 경로 검사는 상수를 명시적으로 꺼서 유지
    withEngine({ 'keeper.timeModel': 0, 'keeper.flightSet': 0 }, () => {
      const { s, a, gk } = setup(L - 12, W / 2 - 3, [L - 4, W / 2 + 2]);
      const m = shotModel(s, a);
      const ctx = { ...m.ctx, ...gkCtx(gk), corner: 0.8, ty: W / 2 + 2.4, speed: 30 };
      const old = saveProb(gk, 30, 0.8, m.d) * keeperCover(gk.x, gk.y, ctx.fx, ctx.fy, ctx.tx, ctx.ty, 30, ENGINE.keeper.leagueShotStopping);
      expect(saveChance(ctx)).toBe(old);
    });
  });
  it('대응 시간: 빠른 공·가까운 GK 는 덜 막고, 슛 선 쪽으로 움직이던 GK 는 더 덮는다', () => {
    withEngine(KEEPER_ON, () => {
      // C.78j: diveSpeed 6 이면 가운데 GK 는 두 경우 모두 덮는 정도 1(포화) — 1 m 비킨 GK 로 비교
      const { s, a, gk } = setup(L - 16, W / 2 - 4, [L - 3, W / 2 + 1]);
      const ctx = { ...shotModel(s, a).ctx, ...gkCtx(gk), ty: W / 2 - 2.8, corner: 0.9 };
      expect(saveChance({ ...ctx, speed: 34 })).toBeLessThan(saveChance({ ...ctx, speed: 22 }));
      const toward = coverOf({ ...ctx, gk: { ...ctx.gk!, vy: -4 } });
      const away = coverOf({ ...ctx, gk: { ...ctx.gk!, vy: 4 } });
      expect(toward).toBeGreaterThan(away);
    });
  });
  it('코드: 실행 선방은 saveChance(슛 순간 자료), 판단에는 따로 쓴 선방 식이 없다', () => {
    const act = readFileSync('src/engine/actions.ts', 'utf8');
    const onb = readFileSync('src/engine/onball.ts', 'utf8');
    expect(act).toContain('saveChance(sh.ctx)');
    expect(act).toContain('coverOf(sh.ctx)');
    expect(onb).not.toContain('leagueSaveProb');
    expect(onb).not.toContain('saveDifficulty');
    expect(onb).toContain('saveChance(ctx)');
  });
});
