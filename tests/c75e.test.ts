// C.75e 44c-b 수비 마크 배정 fix: 마크 배정·기억, 공에서 먼 상대는 느슨하게, 공격 오프볼 마커 떼기
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { updateMarks, updateOffball, updateSituations } from '../src/engine/offball';
import { attackDir, dist, ownGoal } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState } from '../src/engine/sim';
import type { Agent, SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c75e-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c75e-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/**
 * 원정(1)이 공격: 소유자는 공격수에게서 ballDist m 뒤, 원정 공격수 한 명이 홈(0) 골 goalDist m 앞 중앙에 서 있고
 * 홈 수비 줄 한 명(mk)이 그 골 쪽 1.5 m 에 붙어 있다. 홈 나머지 필드 선수는 골 20 m 앞 줄(오프사이드 라인), 홈 중원 둘은 공 옆(압박자·커버)
 */
function scene(goalDist: number, ballDist: number): { s: SimState; att: Agent; mk: Agent } {
  const s = createState(input(5));
  s.restart = null;
  const dir = attackDir(0, s.half);
  const [gx, gy] = ownGoal(dir);
  const owner = s.agents.find((a) => a.team === 1 && a.line === 2)!;
  const att = s.agents.find((a) => a.team === 1 && a.line === 3)!;
  for (const a of s.agents) if (a.team === 0 && a.line !== 0) { a.x = gx + dir * 20; a.y = 6 + a.idx * 2; }
  for (const a of s.agents) if (a.team === 1 && a.line !== 0) { a.x = gx + dir * 70; a.y = 6 + a.idx * 2; }
  att.x = gx + dir * goalDist;
  att.y = gy;
  owner.x = att.x + dir * ballDist;
  owner.y = gy + 2;
  setOwner(s, owner);
  s.ball.x = owner.x;
  s.ball.y = owner.y;
  s.possTeam = 1;
  s.possSince = s.t - 10;
  for (const t of s.teams) { t.counterUntil = 0; t.counterPressers = []; t.coverUntil = 0; }
  // 홈 중원 둘은 공 옆 (압박자 rank 0 과 위험지역 커버 rank 1) — mk 는 마크를 맡을 수 있다
  const [p0, p1] = s.agents.filter((a) => a.team === 0 && a.line === 2);
  p0!.x = owner.x + dir * 2;
  p0!.y = owner.y;
  p1!.x = owner.x + dir * 3;
  p1!.y = owner.y + 3;
  const mk = s.agents.find((a) => a.team === 0 && a.line === 1)!;
  mk.x = att.x - dir * 1.5;
  mk.y = att.y;
  return { s, att, mk };
}

const shakeCfg = ENGINE.offball.shake as { dist: number };

describe('C.75e 마크 배정 fix (44c-b)', () => {
  it('마크 배정: 골 40 m 안 상대에게 수비 줄 수비수 1명이 배정되고, 공격 팀은 배정이 없다', () => {
    const { s, att, mk } = scene(20, 15);
    updateSituations(s);
    updateMarks(s);
    expect(mk.markIdx).toBe(att.idx);
    expect(s.agents.filter((a) => a.team === 0 && a.markIdx === att.idx).length).toBe(1);
    expect(s.agents.filter((a) => a.team === 1).every((a) => a.markIdx < 0)).toBe(true);
  });

  it('공에서 먼 상대는 느슨하게: 공이 12 m 안이면 마크 거리 그대로, 18 m 밖이면 markFar 쪽으로', () => {
    const P = ENGINE.offball.plan;
    const gap = (ballDist: number): number => {
      const { s, att, mk } = scene(20, ballDist);
      updateSituations(s);
      updateMarks(s);
      expect(mk.markIdx).toBe(att.idx);
      mk.errX = 0;
      mk.errY = 0;
      updateOffball(s, mk);
      return dist(mk.tx, mk.ty, att.x, att.y);
    };
    const near = gap(P.markTightBall - 4); // 공 28 m: 위험지역 안이라 lineMarkHold 없음
    const far = gap(P.markTightBall + P.markFarRamp + 6);
    expect(near).toBeLessThan(P.markFar - 0.3);
    expect(far).toBeGreaterThan(near + 0.8);
    expect(far).toBeLessThanOrEqual(P.markFar + 2); // 공이 멀면 lineMarkHold 로 y 가 자리 쪽으로 조금 당겨진다
  });

  it('마커 떼기: 최종 3분의 1에서 마커가 2.5 m 안이면 (위치선정 100) 목표를 마커에서 더 먼 옆·앞 자리로 다시 고른다', () => {
    const run = (shake: boolean): [number, number] => {
      const { s, att, mk } = scene(28, 30);
      const dir = attackDir(1, s.half);
      att.attrs.offTheBall = 100;
      att.role = { ...att.role, run: 0 };
      att.runUntil = 0;
      const old = shakeCfg.dist;
      shakeCfg.dist = 0;
      try {
        // 먼저 떼기 없이 자기 자리(목표)로 보내고, 그 자리에 선 채 마커가 1.5 m 골 쪽에 붙은 장면을 만든다
        updateOffball(s, att);
        att.x = att.tx;
        att.y = att.ty;
        mk.x = att.x - dir * 1.5;
        mk.y = att.y;
        shakeCfg.dist = shake ? old : 0;
        updateOffball(s, att);
      } finally {
        shakeCfg.dist = old;
      }
      // [마커까지 거리, 앞으로 간 거리 (공격 방향, m)]
      return [dist(att.tx, att.ty, mk.x, mk.y), (att.tx - att.x) * dir];
    };
    const [without, fwd0] = run(false);
    const [withShake, fwd1] = run(true);
    expect(without).toBeLessThan(2);
    expect(withShake).toBeGreaterThan(without + 2.5);
    // 뒤로는 가지 않는다
    expect(fwd1).toBeGreaterThanOrEqual(fwd0 - 0.1);
  });

  it('결정성: 같은 시드 두 번 같은 결과', () => {
    const a = createMatch(input(13)).runToEnd();
    const b = createMatch(input(13)).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(JSON.stringify(a.teamStats)).toBe(JSON.stringify(b.teamStats));
  });

  it('버전: C.75e · 44단계 · 엔진 25, lineSqueeze 없음', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.7[5-9]/);
    expect(STAGE_LABEL).toMatch(/^4[4-9]단계$/);
    const { ENGINE_VERSION } = await import('../src/engine/config');
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(25);
    expect((ENGINE.offball.plan as Record<string, unknown>).lineSqueeze).toBeUndefined();
  });
});
