// C.76p 44h-c: 깊은 블록(수비 블록·버스 세우기) 밀집 비용 — 비행 중 가로채기(cutter)·받는 순간 밀착·둘째 ST 마크, 단계 C 1대1 상수
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf } from '../src/engine/tactics';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76p-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76p-a', 2018, []);
const input = (seed: number, tendency: 'bus' | 'block' | 'balanced'): EngineInput => {
  const h = teamSetupFromRoster(home, 75, 75);
  h.tactics = tendency === 'bus' ? tacticsOf('block', { lineHeight: 0 }) : tacticsOf(tendency);
  return { home: h, away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true };
};

describe('C.76p 깊은 블록 밀집 비용', () => {
  it('상수: 가로채기(cutter)·밀착·둘째 ST 마크는 offball, 1대1 상수(단계 C)는 켜져 있다', () => {
    const O = ENGINE.offball;
    expect(O.deepCutReach).toBeGreaterThan(0);
    expect(O.deepCutRadius).toBeGreaterThan(0);
    expect(O.deepCutP).toBeGreaterThan(0);
    expect(O.deepCutP).toBeLessThanOrEqual(1);
    expect(O.deepCloseDownGap).toBeLessThanOrEqual(O.closeDownGap);
    expect(O.deepCloseDownSecond).toBeGreaterThan(O.deepCloseDownGap);
    expect(O.deepSecondStZone).toBeGreaterThan(0);
  });
  it('버스·블록 팀 경기는 끝까지 진행되고 같은 시드면 같은 결과(결정성), 가로채기 집계가 남는다', () => {
    for (const t of ['bus', 'block'] as const) {
      const a = createMatch(input(76, t)).runToEnd();
      const b = createMatch(input(76, t)).runToEnd();
      expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
      expect(a.events.length).toBe(b.events.length);
      expect(a.teamStats[0].interceptions).toBe(b.teamStats[0].interceptions);
      expect(a.teamStats[0].interceptions).toBeGreaterThan(0);
    }
  });
  it('균형 팀끼리는 깊은 블록 분기가 돌지 않는다 (경기 끝까지 진행, 결정성)', () => {
    const a = createMatch(input(77, 'balanced')).runToEnd();
    const b = createMatch(input(77, 'balanced')).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
  });
});
