// C.76s 44h-c2: 게겐프레싱·높은 압박의 대가(둘째 압박자·역압박 창·소모 배수·블록 따라가기·피로 → 경합·판단·패스)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { duelEdgeOf, tiredRatio } from '../src/engine/physics';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { Agent } from '../src/engine/state';
import { tacticsOf } from '../src/engine/tactics';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76s-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76s-a', 2018, []);
const input = (seed: number, tendency: 'gegenpress' | 'balanced'): EngineInput => {
  const h = teamSetupFromRoster(home, 75, 75);
  h.tactics = tacticsOf(tendency);
  return { home: h, away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true };
};

describe('C.76s 게겐 대가·밀집 블록', () => {
  it('상수: 피로 시작 70, 경합·판단·패스 피로 상수, 소모 배수, 역압박 창, 콘 폭은 1.2 그대로', () => {
    const P = ENGINE.physics;
    expect(P.staminaLowFrom).toBe(70);
    expect(P.tiredDuel).toBeGreaterThan(0);
    expect(P.pressDrainBase + P.pressDrainPer * 0.8).toBeGreaterThan(P.pressDrainBase + P.pressDrainPer * 0.55);
    expect(ENGINE.onball.tiredTemp).toBeGreaterThan(0);
    expect(ENGINE.prob.tiredPass).toBeGreaterThan(0);
    expect(ENGINE.offball.counterBase).toBe(4);
    expect(ENGINE.offball.counterRadius).toBe(14);
    expect(ENGINE.offball.secondPressDist).toBeGreaterThan(0);
    expect(ENGINE.prob.coneWidth).toBe(1.2); // 가설 3(coneWidth 2.0)은 C.76p 가 측정·되돌림 — C.76s 는 B(게겐 대가)만
  });
  it('tiredRatio: staminaLowFrom 이상 0, 아래에서 비례, 0 이면 1 — duelEdgeOf 는 홈 보정에서 tiredDuel × 비율을 뺀다', () => {
    const P = ENGINE.physics;
    const a = { stamina: P.staminaLowFrom, duelEdge: 0.1 } as Agent;
    expect(tiredRatio(a)).toBe(0);
    expect(duelEdgeOf(a)).toBeCloseTo(0.1);
    a.stamina = P.staminaLowFrom / 2;
    expect(tiredRatio(a)).toBeCloseTo(0.5);
    expect(duelEdgeOf(a)).toBeCloseTo(0.1 - P.tiredDuel * 0.5);
    a.stamina = 0;
    expect(tiredRatio(a)).toBe(1);
  });
  it('게겐프레싱 경기는 끝까지 진행되고 같은 시드면 같은 결과(결정성), 이동 거리·스프린트 집계가 남는다', () => {
    const a = createMatch(input(76, 'gegenpress')).runToEnd();
    const b = createMatch(input(76, 'gegenpress')).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(a.events.length).toBe(b.events.length);
    const dist = a.players.filter((p) => p.team === 0).reduce((t, p) => t + p.distance, 0);
    expect(dist).toBeGreaterThan(0);
  });
  it('균형 팀끼리도 끝까지 진행되고 결정적이다', () => {
    const a = createMatch(input(77, 'balanced')).runToEnd();
    const b = createMatch(input(77, 'balanced')).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
  });
});
