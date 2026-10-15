import { describe, expect, it } from 'vitest';
import { proficientAttrs } from '../src/engine/adapter';
import { ENGINE } from '../src/engine/config';
import { attackDir, L, W } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState, step } from '../src/engine/sim';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';
import { countTeleports } from '../scripts/engine/teleport';

const home = createTeamRoster({ id: 'h', rating: 76 }, 'pol-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'pol-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 76, 74),
  away: teamSetupFromRoster(away, 74, 76),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false,
});

describe('엔진 다듬기 (C.24)', () => {
  it('순간이동 없음: 선수 틱당 1 m, 공 3 m 초과 이동 0회, 킥오프 때 전원 자기 진영', () => {
    expect(countTeleports(2)).toEqual({ matches: 2, player: 0, ball: 0, kickoffOut: 0 });
  });

  it('킥오프 대형: 키커는 중앙 점, 전원 자기 진영', () => {
    const s = createState(input(3));
    const taker = s.agents[s.restart!.taker]!;
    expect(taker.x).toBe(L / 2);
    expect(taker.y).toBe(W / 2);
    for (const a of s.agents) if (a.onPitch) expect((a.x - L / 2) * attackDir(a.team, 1)).toBeLessThanOrEqual(0);
  });

  it('골 뒤: 세리머니가 있고, 선수들은 킥오프 직전까지 걸어서 돌아온다', () => {
    const s = createState(input(21));
    let found = false;
    while (!s.done && !found) {
      step(s);
      const g = s.restart?.goal;
      if (!g) continue;
      found = true;
      const R = ENGINE.restart;
      expect(g.until - g.t).toBeGreaterThanOrEqual(R.celebrate[0]);
      expect(g.until - g.t).toBeLessThanOrEqual(R.celebrate[1]);
      expect(g.joiners.length).toBeGreaterThanOrEqual(R.celebrateJoin[0]);
      // 골 직후 아무도 전력으로 달리지 않는다 (키커 포함)
      for (let k = 0; k < 30; k++) step(s);
      for (const a of s.agents) if (a.onPitch && a.line !== 0) expect(Math.hypot(a.vx, a.vy)).toBeLessThanOrEqual(ENGINE.physics.run + 0.01);
    }
    expect(found).toBe(true);
  });

  it('숙련도 페널티: 내 선수 필드 능력치 전부에서 OVR 페널티만큼 뺀다 (숙련도 100 이면 그대로)', () => {
    const attrs = teamSetupFromRoster(home, 76, 74).lineup[5]!.attrs;
    expect(proficientAttrs(attrs, 100)).toEqual(attrs);
    const low = proficientAttrs(attrs, 70);
    for (const k of Object.keys(attrs) as (keyof typeof attrs)[]) expect(low[k]).toBeCloseTo(Math.max(1, attrs[k] - 7.5));
  });
});
