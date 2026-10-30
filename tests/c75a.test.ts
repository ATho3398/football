import { describe, expect, it } from 'vitest';
import { starterDeck } from '../src/config/cards';
import { playMyMatch } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { bestChoice, failFactor, keepSlots, pickOptions, type Moment, type MomentPolicy } from '../src/engine/moments';
import type { Candidate } from '../src/engine/onball';
import type { Agent } from '../src/engine/state';
import { newGame, roundMatch, selectableRealPlayers } from '../src/game';
import { posGroup } from '../src/roster';
import { choicesOf } from '../scripts/moment-shape';

const cand = (type: Candidate['type'], p: number, u: number, value: number, x = 0): Candidate => ({ type, p, u, x, y: 0, receiver: -1, value });
const st = { spec: { slot: 0, position: 'ST' }, pos: 'ST' } as unknown as Agent;
const cb = { spec: { slot: 0, position: 'CB' }, pos: 'CB' } as unknown as Agent;

describe('C.75a 결정 순간 다듬기 (E-0)', () => {
  it('도박 실패 완화: 성공 확률이 낮을수록 실패 감점 배수가 작다 (floor ~ 1)', () => {
    const F = ENGINE.moments.failRelief;
    expect(failFactor(0.1)).toBeCloseTo(F.floor + ((1 - F.floor) * 0.1) / F.pRef, 6);
    expect(failFactor(0)).toBe(F.floor);
    expect(failFactor(0.9)).toBe(1);
    expect(failFactor(null)).toBe(1);
    expect(failFactor(0.1)).toBeLessThan(failFactor(0.3));
  });

  it('슛 자리 보장: 안전·균형·도박이 밀어낸 슛(xG ≥ 기준)을 효용이 가장 낮은 칸과 바꾼다', () => {
    const pool = [
      cand('pass', 0.9, 0.5, 0.3, 1), cand('cutback', 0.6, 0.6, 0.5, 2), cand('carry', 0.7, 0.4, 0.6, 3),
      cand('shoot', ENGINE.moments.shotKeepXg + 0.01, 0.3, 0.07, 4),
    ];
    const before = pickOptions(pool);
    expect(before.some((c) => c?.type === 'shoot')).toBe(false);
    const after = keepSlots(st, pool, before);
    expect(after.some((c) => c?.type === 'shoot')).toBe(true);
    // 낮은 xG 슛은 보장하지 않는다
    const low = pool.map((c) => (c.type === 'shoot' ? { ...c, p: 0.02 } : c));
    expect(keepSlots(st, low, pickOptions(low)).some((c) => c?.type === 'shoot')).toBe(false);
  });

  it('개인기 자리 보장: 공격수는 드리블 칸을 넣고(슛 칸은 지킨다), 센터백은 그대로', () => {
    const pool = [
      cand('pass', 0.9, 0.5, 0.3, 1), cand('cutback', 0.6, 0.6, 0.5, 2), cand('carry', 0.7, 0.45, 0.6, 3),
      cand('shoot', 0.1, 0.3, 0.12, 4), cand('dribble', 0.4, 0.2, 0.55, 5),
    ];
    const out = keepSlots(st, pool, pickOptions(pool));
    expect(out.some((c) => c?.type === 'dribble')).toBe(true);
    expect(out.some((c) => c?.type === 'shoot')).toBe(true);
    expect(keepSlots(cb, pool, pickOptions(pool)).some((c) => c?.type === 'dribble')).toBe(false);
    // 이미 드리블 칸이 있으면 방향만 다른 돌파를 하나 더 넣지 않는다
    const two = [...pool, cand('dribble', 0.45, 0.25, 0.5, 6)];
    expect(keepSlots(st, two, [two[0]!, two[6]!, two[1]!]).filter((c) => c?.type === 'dribble').length).toBe(1);
  });

  it('직접 모드(카드 덱): 고를 거리 2개 미만 정지 없음 · 맡기기는 자동과 같다(카드 없음)', () => {
    const pool = selectableRealPlayers();
    let stops = 0;
    for (const grp of ['ST', 'WING', 'CB']) {
      const p = pool.find((x) => posGroup(x.position) === grp)!;
      const g = newGame({ mode: 'real', playerId: p.id, seed: `c75a-${p.id}`, difficulty: 'normal' });
      const rm = roundMatch(g, { cards: false });
      const deck = starterDeck(grp === 'CB' ? 'defense' : 'attack').map((c) => c.id);
      const seen: Moment[] = [];
      const bot: MomentPolicy = (m) => {
        seen.push(m);
        return bestChoice(m);
      };
      playMyMatch({ ...rm.input, cards: { deck }, control: { mode: 'direct', stop: 'all', policy: bot } });
      for (const m of seen) if (m.type !== 'react') expect(choicesOf(m)).toBeGreaterThanOrEqual(2);
      stops += seen.length;
      // 맡기기 = 자동 (카드 없는 경기, 직접 모드 경로가 자동 결과를 바꾸지 않는다)
      const auto = playMyMatch({ ...rm.input });
      const del = playMyMatch({ ...rm.input, control: { mode: 'direct', stop: 'important', policy: () => 'delegate' } });
      expect(del.result.rating).toBe(auto.result.rating);
      expect(del.engine.homeGoals).toBe(auto.engine.homeGoals);
    }
    expect(stops).toBeGreaterThan(0);
  });
});

describe('C.75a 버전', () => {
  it('라벨 · 엔진 23', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.([7-9]\d|7[4-9])/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
    expect(ENGINE.moments.minOptions).toBe(2);
    const { ENGINE_VERSION } = await import('../src/engine/config');
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(23);
  });
});
