// C.77e 44h-f2c: 펄스 나인 인계 러너 반복 침투 (미해결 4, 8대 §9.13.7) — 가설 1 배포, 가설 2(CB 따라나옴 좁히기)는 측정 뒤 끔
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createMatch } from '../src/engine/sim';
import type { EngineInput, TeamSetup } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';
import { teamSetupFromRoster } from '../src/engine/setup';

function team(id: string, roles?: Record<number, string>): TeamSetup {
  const r = createTeamRoster({ id, rating: 75 }, `c77e-${id}`, 2018, []);
  r.formation = '4-3-3';
  const s = teamSetupFromRoster(r, 75, 75);
  if (roles) for (const p of s.lineup) if (roles[p.slot]) p.role = roles[p.slot];
  return s;
}
const PAIR = { 9: 'falseNine', 8: 'wingForward', 10: 'wingForward', 6: 'boxToBox' };
const input = (seed: number): EngineInput => ({
  home: team('h', PAIR), away: team('a'), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

describe('C.77e 펄스 나인 인계 러너 반복 침투', () => {
  it('상수 범위 (가설 2 는 끔)', () => {
    expect(ENGINE.roles.nineRunFrom).toBe(6);
    expect(ENGINE.roles.nineRunGap).toBeGreaterThan(0);
    expect(ENGINE.offball.stepOutMax).toBe(0);
    expect(ENGINE.offball.stepOutLane).toBeGreaterThan(0);
  });

  it('가설 1: 같은 시드 같은 결과, 끄면(nineRunFrom 0) 펄스 나인 팀 경기가 달라진다', () => {
    const run = (from: number) => {
      const R = ENGINE.roles as { nineRunFrom: number };
      const was = R.nineRunFrom;
      R.nineRunFrom = from;
      try {
        const m = createMatch(input(93));
        const s = m.state;
        let sum = 0;
        while (!s.done) {
          m.step();
          for (const a of s.agents) if (a.team === 0 && s.t < a.runUntil) sum++;
        }
        return { sum, score: `${s.teams[0].stats.goals}-${s.teams[1].stats.goals}` };
      } finally {
        R.nineRunFrom = was;
      }
    };
    const a = run(6);
    expect(run(6)).toEqual(a);
    expect(run(0).sum).not.toBe(a.sum);
  }, 30_000);
});
