// C.75c 44c-a 수비 계획: 공으로 가는 사람은 1명, 둘째는 커버 · 상황 판정 · 역압박 전술 상한 · 1대1 자격
import { describe, expect, it } from 'vitest';
import { duelEligible } from '../src/engine/actions';
import { ENGINE } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { ballRank, pressLevel, updateOffball, updateSituations } from '../src/engine/offball';
import { attackDir, dist, ownGoal } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState } from '../src/engine/sim';
import type { SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c75c-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c75c-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 원정(1) 공격수가 홈(0) 박스 안에서 공을 갖고, 홈 수비 둘이 각각 1.2 m · 1.8 m 에 있는 장면 */
function boxScene(): { s: SimState; d0: number; d1: number } {
  const s = createState(input(7));
  s.restart = null;
  const dir = attackDir(0, s.half);
  const [gx, gy] = ownGoal(dir);
  const att = s.agents.find((a) => a.team === 1 && a.line === 3)!;
  att.x = gx + dir * 12;
  att.y = gy + 3;
  setOwner(s, att);
  s.ball.x = att.x;
  s.ball.y = att.y;
  s.possSince = s.t - 10;
  for (const t of s.teams) { t.counterUntil = 0; t.counterPressers = []; }
  const defs = s.agents.filter((a) => a.team === 0 && a.line === 1);
  // 나머지 홈 필드 선수는 멀리
  for (const a of s.agents) if (a.team === 0 && a.line !== 0) { a.x = gx + dir * 40; a.y = 10 + a.idx; }
  for (const a of s.agents) if (a.team === 1 && a !== att) { a.x = gx + dir * 60; a.y = 10 + a.idx; }
  const [p, c] = defs;
  p!.x = att.x - dir * 1.2; p!.y = att.y;
  c!.x = att.x; c!.y = att.y + 1.8;
  return { s, d0: p!.idx, d1: c!.idx };
}

describe('C.75c 수비 계획 (44c-a)', () => {
  it('박스 안: 가장 가까운 1명만 공으로, 둘째는 공과 골 사이 coverBehind 커버 자리', () => {
    const { s, d0, d1 } = boxScene();
    const p = s.agents[d0]!;
    const c = s.agents[d1]!;
    updateSituations(s);
    expect(s.teams[0].sit).toBe('E');
    updateOffball(s, p);
    updateOffball(s, c);
    const o = s.agents[s.ball.owner]!;
    expect(dist(p.tx, p.ty, o.x, o.y)).toBeLessThan(1);
    const [gx, gy] = ownGoal(attackDir(0, s.half));
    expect(dist(c.tx, c.ty, s.ball.x, s.ball.y)).toBeCloseTo(ENGINE.offball.plan.coverBehind, 1);
    // 커버는 공보다 골에 가깝다
    expect(dist(c.tx, c.ty, gx, gy)).toBeLessThan(dist(s.ball.x, s.ball.y, gx, gy));
  });

  it('1대1 판단: 2 m 안이어도 압박자(공에 가장 가까운 선수)만, 둘째는 돌파 후 커버로 불렸을 때만', () => {
    const { s, d0, d1 } = boxScene();
    const o = s.agents[s.ball.owner]!;
    const p = s.agents[d0]!;
    const c = s.agents[d1]!;
    expect(ballRank(s, p, o.x, o.y)).toBe(0);
    expect(duelEligible(s, o, p)).toBe(true);
    expect(duelEligible(s, o, c)).toBe(false);
    s.teams[0].coverAgent = c.idx;
    s.teams[0].coverUntil = s.t + 1;
    expect(duelEligible(s, o, c)).toBe(true);
  });

  it('상황 판정: 우리 공 "-", 루즈볼 G (즉시), 역압박 H', () => {
    const { s } = boxScene();
    updateSituations(s);
    expect(s.teams[1].sit).toBe('-');
    s.ball.owner = -1;
    s.ball.flight = null;
    updateSituations(s);
    expect(s.teams[0].sit).toBe('G');
    expect(s.teams[1].sit).toBe('G');
  });

  it('역압박 상한 = 전술 압박 단계 (낮음 1 / 보통 2 / 높음 3)', () => {
    const s = createState(input(3));
    const lv = (p: number) => { s.teams[0].tactics = { ...s.teams[0].tactics, pressing: p }; return pressLevel(s, 0); };
    expect([lv(0.3), lv(0.55), lv(0.8)]).toEqual([0, 1, 2]);
    expect(ENGINE.offball.plan.sit.H.pressers).toEqual([1, 2, 3]);
  });

  it('결정성: 같은 시드 두 번 같은 결과', () => {
    const a = createMatch(input(11)).runToEnd();
    const b = createMatch(input(11)).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(JSON.stringify(a.teamStats)).toBe(JSON.stringify(b.teamStats));
  });

  it('버전: C.75c · 44단계 · 엔진 24', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.7[5-9]/);
    expect(STAGE_LABEL).toMatch(/^(4[4-9]|5\d)단계$/);
    const { ENGINE_VERSION } = await import('../src/engine/config');
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(24);
  });
});
