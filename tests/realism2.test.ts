import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { focusThreat, keeperTarget, updateMarks, updateOffball } from '../src/engine/offball';
import { averageSelf, candidates, carryLoseProb, finishMult, judgedP, loseProb, passSkillApply } from '../src/engine/onball';
import { dist, L, W } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState, curveAttr } from '../src/engine/sim';
import type { Agent, SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'real2-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'real2-a', 2018, []);
home.formation = '4-4-2';
away.formation = '4-4-2';
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 전반(팀 0 이 +x 로 공격)에서 모든 선수를 지정 위치로 옮기고 소유자를 정한다. 나머지는 멀리 둔다 */
function scene(place: (s: SimState) => Agent): SimState {
  const s = createState(input(71));
  s.restart = null;
  for (const a of s.agents) {
    a.x = a.team === 0 ? 10 : 95;
    a.y = 5 + (a.idx % 11) * 5.5;
    a.vx = a.vy = 0;
  }
  const owner = place(s);
  setOwner(s, owner);
  owner.cooldown = 0;
  s.ball.x = s.bsx = owner.x;
  s.ball.y = s.bsy = owner.y;
  return s;
}

const of = (s: SimState, team: 0 | 1, pos: string, k = 0) => s.agents.filter((a) => a.team === team && a.pos === pos)[k]!;

describe('E3.5 2차 1번: 판단용 P = 본인 50% + 리그 평균 50%', () => {
  it('평균 선수는 능력치 70, 폼 0, 위치는 본인 그대로', () => {
    const s = createState(input(72));
    const a = s.agents[6]!;
    a.spec.form = 0.3;
    const av = averageSelf(a);
    expect(Object.values(av.attrs).every((v) => v === ENGINE.onball.judgeAvgAttr)).toBe(true);
    expect(av.spec.form).toBe(0);
    expect([av.x, av.y, av.team]).toEqual([a.x, a.y, a.team]);
    expect(judgedP(0.8, 0.6)).toBeCloseTo(0.7, 10);
  });
  it('패스 능력치는 실패 확률을 비율로 줄인다: 평균 선수(70)는 그대로, 쉬운 패스·어려운 패스 모두 같은 비율', () => {
    expect(passSkillApply(0.9, ENGINE.prob.skillCenter)).toBeCloseTo(0.9, 10);
    const easy = 1 - passSkillApply(0.95, 85);
    const hard = 1 - passSkillApply(0.6, 85);
    expect(easy / 0.05).toBeCloseTo(hard / 0.4, 6);
    expect(easy).toBeLessThan(0.05);
  });
});

describe('E3.5 2차 7번: 슈팅 결과 = 기회의 질 × 마무리 배수', () => {
  it('마무리 배수는 70 에서 1, 능력치당 0.012, 0.8~1.25 로 자른다', () => {
    const base = createState(input(73)).agents[9]!.attrs;
    const at = (v: number) => ({ ...base, shooting: v, composure: v, bigMatch: v });
    expect(finishMult(at(70), 'shot')).toBeCloseTo(1, 10);
    expect(finishMult(at(80), 'shot')).toBeCloseTo(1.12, 10);
    expect(finishMult(at(99), 'shot')).toBe(ENGINE.prob.finishMax);
    expect(finishMult(at(40), 'shot')).toBe(ENGINE.prob.finishMin);
  });
  it('능력치 곡선 (E.24): 70 은 그대로, 50~90 은 차이를 k 배, 90 위는 0.5k, 50 아래는 k', () => {
    const k = ENGINE.prob.curveK;
    expect(curveAttr(70)).toBeCloseTo(70, 10);
    expect(curveAttr(80)).toBeCloseTo(70 + 10 * k, 10);
    expect(curveAttr(90)).toBeCloseTo(70 + 20 * k, 10);
    expect(curveAttr(99)).toBeCloseTo(70 + 20 * k + 0.5 * k * 9, 10);
    expect(curveAttr(40)).toBeCloseTo(70 - 20 * k - 10 * k, 10);
  });
});

describe('E3.5 2차 2번: 전환 위험과 수신 지원도', () => {
  it('공보다 앞에 우리 선수가 많을수록 소유를 잃는 손해가 크다 (유지 효용이 낮아진다)', () => {
    const build = (ahead: boolean) => scene((s) => {
      const o = of(s, 0, 'CM');
      [o.x, o.y] = [50, 34];
      of(s, 1, 'CM').x = 51;
      of(s, 1, 'CM').y = 34;
      // 압박 수비수 1 m (빼앗길 확률이 있어야 상실 비용이 효용에 들어간다)
      for (const a of s.agents.filter((x) => x.team === 0 && x !== o && x.line !== 0)) a.x = ahead ? 70 : 30;
      return o;
    });
    const hold = (s: SimState) => candidates(s, s.agents[s.ball.owner]!).find((c) => c.type === 'hold')!;
    const behind = build(false);
    const front = build(true);
    expect(loseProb(front, front.agents[front.ball.owner]!)).toBeGreaterThan(0);
    expect(hold(front).u).toBeLessThan(hold(behind).u);
  });
  it('고립된 선수에게 가는 패스는 동료가 근처에 있을 때보다 받는 자리 가치가 낮다', () => {
    const build = (support: boolean) => scene((s) => {
      const o = of(s, 0, 'CB');
      [o.x, o.y] = [30, 34];
      const st = of(s, 0, 'ST');
      [st.x, st.y] = [60, 34];
      const mates = s.agents.filter((x) => x.team === 0 && x !== o && x !== st && x.line !== 0);
      mates.forEach((m, i) => {
        m.x = support && i < 2 ? 55 + i * 2 : 20;
        m.y = support && i < 2 ? 30 + i * 8 : 5 + i * 6;
      });
      return o;
    });
    const value = (s: SimState) => candidates(s, s.agents[s.ball.owner]!).find((c) => c.receiver === of(s, 0, 'ST').idx)!.value;
    expect(value(build(false))).toBeLessThan(value(build(true)));
    expect(value(build(false)) / value(build(true))).toBeGreaterThan(ENGINE.onball.supportBase - 0.01);
  });
});

describe('E3.5 2차 3번 · 8번: 박스 앞 수비 블록, ST 마크, 수비 주의 집중', () => {
  const s = scene((st) => {
    // 팀 0 이 공격: CM 이 상대 골 20 m 앞에서 공을 가졌고, ST 가 12 m 지점
    const o = of(st, 0, 'CM');
    [o.x, o.y] = [L - 20, 30];
    const f = of(st, 0, 'ST');
    [f.x, f.y] = [L - 12, 38];
    const f2 = of(st, 0, 'ST', 1);
    [f2.x, f2.y] = [L - 30, 60];
    // 수비 팀 1 의 수비수 4명은 박스 근처, 미드 2명이 공 가까이 (압박 담당)
    st.agents.filter((a) => a.team === 1 && a.line === 1).forEach((a, i) => { [a.x, a.y] = [L - 14, 20 + i * 9]; });
    of(st, 1, 'CM').x = L - 21;
    of(st, 1, 'CM').y = 31;
    of(st, 1, 'CM', 1).x = L - 22;
    of(st, 1, 'CM', 1).y = 28;
    return o;
  });
  // C.75j (C.75d 마크 배정): 위협 마크는 updateMarks 가 배정하고, 남은 수비 줄이 자리를 덮는다
  updateMarks(s);
  for (const a of s.agents) if (a.team === 1) updateOffball(s, a);
  const st = of(s, 0, 'ST');
  const defs = s.agents.filter((a) => a.team === 1 && a.line === 1);
  it('수비 주의 집중: 가장 위협적인 ST 는 맡은 수비수 1명이 골 쪽 1.5 × 0.6 m 에서 마크하고, 둘째는 붙지 않고 자리를 덮는다 (C.75j 배정 기준)', () => {
    const O = ENGINE.offball;
    expect(focusThreat(s, 1)).toBe(st);
    const close = defs.filter((a) => dist(a.tx, a.ty, st.x, st.y) < O.stMark + 0.6);
    expect(close.length).toBe(1);
    const marker = close[0]!;
    expect(marker.markIdx).toBe(st.idx);
    expect(Math.abs(dist(marker.tx, marker.ty, st.x, st.y) - O.stMark * O.focusMark)).toBeLessThan(0.3);
    expect(marker.pos).toBe('CB');
    expect(dist(marker.tx, marker.ty, L, W / 2)).toBeLessThan(dist(st.x, st.y, L, W / 2));
  });
  it('나머지 수비수는 니어 포스트·페널티 지점 순서로 박스 안 공간을 덮는다', () => {
    const O = ENGINE.offball;
    const spots: [number, number][] = [[L - O.coverPostDepth, W / 2 - O.coverPostY], [L - O.coverSpot, W / 2]];
    for (const [x, y] of spots) expect(defs.some((a) => dist(a.tx, a.ty, x, y) < 1.5)).toBe(true);
  });
  it('GK 는 박스 안 12 m 안으로 들어온 소유자에게 각을 좁힌다', () => {
    const t = scene((x) => {
      const o = of(x, 0, 'ST');
      [o.x, o.y] = [L - 9, 30];
      return o;
    });
    const gk = t.agents.find((a) => a.team === 1 && a.line === 0)!;
    keeperTarget(t, gk);
    expect(dist(gk.tx, gk.ty, L - 9, 30)).toBeLessThan(ENGINE.keeper.rushGap + 0.01);
  });
});

describe('E3.5 2차 4번 · 5번: 침투 패스와 몰고 가기', () => {
  it('침투 패스의 목표는 오프사이드 라인 뒤 공간이다', () => {
    const s = scene((x) => {
      const o = of(x, 0, 'CM');
      [o.x, o.y] = [50, 34];
      const f = of(x, 0, 'ST');
      [f.x, f.y] = [68, 34];
      f.runUntil = 1e9;
      for (const a of x.agents) if (a.team === 1 && a.line >= 2) a.x = 40;
      x.agents.filter((a) => a.team === 1 && a.line === 1).forEach((a, i) => { [a.x, a.y] = [70, 15 + i * 12]; });
      return o;
    });
    const c = candidates(s, s.agents[s.ball.owner]!).find((k) => k.type === 'through')!;
    expect(c).toBeDefined();
    expect(c.x).toBeGreaterThan(70 + ENGINE.onball.throughMin);
  });
  it('몰고 가는 길 바로 옆의 수비수도 빼앗을 확률에 들어간다 (도착 지점만 보지 않는다)', () => {
    const s = scene((x) => {
      const o = of(x, 0, 'ST');
      [o.x, o.y] = [80, 34];
      const d = of(x, 1, 'CB');
      [d.x, d.y] = [83, 35.5];
      return o;
    });
    const o = s.agents[s.ball.owner]!;
    expect(loseProb(s, o, 86, 34)).toBe(0);
    expect(carryLoseProb(s, o, 86, 34)).toBeGreaterThan(0.2);
  });
});
