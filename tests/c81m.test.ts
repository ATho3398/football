// C.81m (53단계): '내 리그만 엔진' 섞인 시상 표 — 다른 리그 추정 평점을 포지션군별 퍼짐·이동·잡음으로 엔진 척도에, 추정 리그 실점 항목 배수.
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEAGUES } from '../data/leagues';
import { buildResumes } from '../src/awards';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, type GameState } from '../src/game';

const GROUPS = ['GK', 'CB', 'FB', 'CDM', 'CM', 'CAM', 'WING', 'ST'];
const E = BALANCE.awards.estimate;

describe('C.81m 섞인 표 추정 평점 포지션별 보정', () => {
  it('보정 값: 포지션군 8개 모두 · 퍼짐 > 0 · 잡음 ≥ 0 · 실점 배수 (0, 1]', () => {
    for (const g of GROUPS) {
      expect(typeof E.mixedShift[g]).toBe('number');
      expect(E.mixedSpread[g]).toBeGreaterThan(0);
      expect(E.mixedJitter[g]).toBeGreaterThanOrEqual(0);
    }
    expect(E.mixedDef).toBeGreaterThan(0);
    expect(E.mixedDef).toBeLessThanOrEqual(1);
  });

  it('내 리그 엔진 + 다른 리그 추정: 다른 리그만 avg = B + (추정 − B) × 퍼짐 + 이동 (+ 잡음), def × 배수 · 내 리그는 그대로', { timeout: 120_000 }, () => {
    const g: GameState = newGame({ mode: 'real', playerId: 'salah', seed: 'c81m-t', difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
    g.options = { others: 'mine' };
    for (let k = 0; k < 2; k++) playRound(g, { engine: 'quick', others: 'mine' } as never);
    const saved = { shift: { ...E.mixedShift }, spread: { ...E.mixedSpread }, jitter: { ...E.mixedJitter }, def: E.mixedDef };
    const set = (shift: number, spread: number, jitter: number, def: number) => {
      for (const k of GROUPS) { E.mixedShift[k] = shift; E.mixedSpread[k] = spread; E.mixedJitter[k] = jitter; }
      (E as { mixedDef: number }).mixedDef = def;
    };
    try {
      set(0, 1, 0, 1);
      const base = buildResumes(g);
      set(-0.5, 1.5, 0, 0.5);
      const mod = buildResumes(g);
      const byId = new Map(base.map((r) => [r.id, r]));
      let other = 0;
      for (const r of mod) {
        const b = byId.get(r.id)!;
        if (r.lg === 'pl') { expect(r.avg).toBe(b.avg); expect(r.def).toBe(b.def); continue; }
        other++;
        expect(r.avg).toBeCloseTo(E.ratingBase + (b.avg - E.ratingBase) * 1.5 - 0.5, 9);
        expect(r.def).toBeCloseTo(b.def * 0.5, 9);
      }
      expect(other).toBeGreaterThan(100);
      // 잡음은 선수·시즌 시드라 결정적
      set(0, 1, 0.4, 1);
      const j1 = buildResumes(g).map((r) => r.avg);
      const j2 = buildResumes(g).map((r) => r.avg);
      expect(j1).toEqual(j2);
      expect(j1.some((x, i) => Math.abs(x - base[i]!.avg) > 1e-9)).toBe(true);
    } finally {
      Object.assign(E.mixedShift, saved.shift); Object.assign(E.mixedSpread, saved.spread); Object.assign(E.mixedJitter, saved.jitter);
      (E as { mixedDef: number }).mixedDef = saved.def;
    }
  });
});
