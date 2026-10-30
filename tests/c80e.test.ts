// C.80e: 전술 적합도 보너스 — 성향별 핵심 능력치 차이(선수단 − 리그 보통)만큼 그 성향 핵심 실행 능력치에 보너스, 보통 선수단이면 0, 판단 = 실행
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { aerialWin } from '../src/engine/duel';
import { fitGaps, fitPts } from '../src/engine/fit';
import { passProbability, laneRisk } from '../src/engine/onball';
import { pick, place, sceneState } from './scenes/harness';

describe('C.80e 전술 적합도', () => {
  it('보통 생성 선수단은 차이 ≈ 0 (리그 보통으로 중심화)', () => {
    const s = sceneState(5);
    for (const t of [0, 1] as const) for (const v of Object.values(s.teams[t].fit)) expect(Math.abs(v)).toBeLessThan(3);
  });

  it('직선 핵심 능력치를 올린 선수단은 차이 +, 내리면 −', () => {
    const s = sceneState(5);
    const field = s.agents.filter((a) => a.team === 0 && a.onPitch && !a.gk);
    const shift = (d: number) => field.map((a) => {
      const attrs = { ...a.spec.attrs };
      for (const k of ['longPassing', 'vision', 'ballControl', 'strength', 'jumping', 'heading'] as const) attrs[k] += d;
      return { attrs, pos: a.pos };
    });
    expect(fitGaps(shift(10)).direct).toBeGreaterThan(5);
    expect(fitGaps(shift(-10)).direct).toBeLessThan(-5);
  });

  it('보너스는 그 성향일 때만, 상한 안', () => {
    const s = sceneState(5);
    s.teams[0].fit.direct = 30;
    s.teams[0].tactics.tendency = 'balanced';
    expect(fitPts(s, 0, 'long')).toBe(0);
    s.teams[0].tactics.tendency = 'direct';
    expect(fitPts(s, 0, 'long')).toBe(ENGINE.tacticFit.cap);
    expect(fitPts(s, 0, 'short')).toBe(0);
    s.teams[0].fit.direct = 2;
    expect(fitPts(s, 0, 'air')).toBeCloseTo(2 * ENGINE.tacticFit.gain.direct.air);
  });

  it('맞는 직선 팀은 롱패스 확률(판단·실행 같은 식)과 공중 경합이 오른다', () => {
    const s = sceneState(5);
    const a = pick(s, 0, 1, 0);
    const def = pick(s, 1, 1, 0);
    const r = pick(s, 0, 3, 0);
    for (const o of s.agents) if (o !== a && o !== r) place(o, 5, 5);
    place(a, 30, 34);
    place(r, 70, 30);
    s.teams[0].tactics.tendency = 'direct';
    const lane = laneRisk(s, a, r.x, r.y);
    s.teams[0].fit.direct = 0;
    const p0 = passProbability(s, a, r.x, r.y, 'pass', lane);
    const w0 = aerialWin(r, def, fitPts(s, 0, 'air') - fitPts(s, 1, 'air'));
    s.teams[0].fit.direct = 6;
    const p1 = passProbability(s, a, r.x, r.y, 'pass', lane);
    const w1 = aerialWin(r, def, fitPts(s, 0, 'air') - fitPts(s, 1, 'air'));
    expect(p1).toBeGreaterThan(p0);
    expect(w1).toBeGreaterThan(w0);
  });
});
