// C.77d 44h-f2b: 펄스 나인 미끼·2선 인계 (미해결 4, 8대 §9.13.5) — 가설 0 AI 짝 규칙, 가설 1 2선 러너 9번 자리, 가설 2 CB 따라나옴 판단
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { ROLES } from '../src/engine/roles';
import { createMatch } from '../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf } from '../src/engine/tactics';
import type { EngineInput, TeamSetup } from '../src/engine/types';
import { FORMATION_SLOTS } from '../src/formations';
import { createTeamRoster } from '../src/roster';

function team(id: string, roles?: Record<number, string>): TeamSetup {
  const r = createTeamRoster({ id, rating: 75 }, `c77d-${id}`, 2018, []);
  r.formation = '4-3-3';
  const s = teamSetupFromRoster(r, 75, 75);
  if (roles) for (const p of s.lineup) if (roles[p.slot]) p.role = roles[p.slot];
  return s;
}
const PAIR = { 9: 'falseNine', 8: 'wingForward', 10: 'wingForward', 6: 'boxToBox' };
const input = (seed: number): EngineInput => ({
  home: team('h', PAIR), away: team('a'), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

describe('C.77d 펄스 나인 미끼·2선 인계', () => {
  it('상수 범위', () => {
    const O = ENGINE.offball;
    expect(ENGINE.roles.nineMateRun).toBe(0.5);
    expect(ENGINE.roles.nineDeepGap).toBeGreaterThan(0);
    expect(O.stepOutMin).toBeLessThan(O.stepOutReach);
    expect(O.stepOutMax).toBe(0); // 지금은 끔 (켤 때 7)
    expect(O.stepOutBall[0]).toBeGreaterThanOrEqual(O.boxZone);
    expect(O.stepOutP[0]).toBeGreaterThan(0);
    expect(O.stepOutP[1]).toBeLessThan(1);
  });

  it('가설 0: AI 티키타카 4-3-3 펄스 나인 팀에는 공격형 CM 이 있다 (이미 정한 역할은 그대로)', () => {
    for (let i = 0; i < 20; i++) {
      const s = team(`t${i}`);
      s.tactics = tacticsOf('tikitaka');
      const slots = FORMATION_SLOTS[s.formation];
      for (const p of s.lineup) delete p.role;
      fillRoles(s, (slot) => slots[slot]!.pos);
      if (!s.lineup.some((p) => p.role === 'falseNine')) continue;
      expect(s.lineup.some((p) => slots[p.slot]!.pos === 'CM' && ROLES[p.role!]!.run >= ENGINE.roles.nineMateRun)).toBe(true);
    }
    // 사용자가 다 정한 팀(딥라잉 ×2 + 펄스 나인)은 바꾸지 않는다
    const s = team('u');
    s.tactics = tacticsOf('tikitaka');
    const slots = FORMATION_SLOTS[s.formation];
    for (const p of s.lineup) p.role = slots[p.slot]!.pos === 'CM' ? 'deepPlaymaker' : slots[p.slot]!.pos === 'ST' ? 'falseNine' : p.role;
    fillRoles(s, (slot) => slots[slot]!.pos);
    expect(s.lineup.filter((p) => p.role === 'deepPlaymaker').length).toBe(2);
  });

  it('가설 2: 따라나옴은 CB 만, 대상은 상대 공격 줄, 같은 시드 같은 결과, stepOutMax 0 이면 판단 없음', () => {
    const run = (stepOutMax: number) => {
      const O = ENGINE.offball as { stepOutMax: number };
      const was = O.stepOutMax;
      O.stepOutMax = stepOutMax;
      try {
        const m = createMatch(input(91));
        const s = m.state;
        let goTicks = 0, judged = 0, bad = 0;
        while (!s.done) {
          m.step();
          for (const d of s.agents) {
            if (d.stepOutIdx < 0) continue;
            judged++;
            const o = s.agents[d.stepOutIdx]!;
            if (d.pos !== 'CB' || o.team === d.team || o.line !== 3) bad++;
            if (d.stepOutGo) goTicks++;
          }
        }
        return { goTicks, judged, bad, score: `${s.teams[0].stats.goals}-${s.teams[1].stats.goals}` };
      } finally {
        O.stepOutMax = was;
      }
    };
    const a = run(7);
    expect(a.bad).toBe(0);
    expect(a.goTicks).toBeGreaterThan(0);
    expect(run(7)).toEqual(a);
    expect(run(0).judged).toBe(0);
  }, 30_000);
});
