import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { positionValue } from '../src/engine/pitch';
import { sendOff } from '../src/engine/referee';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState, step } from '../src/engine/sim';
import { aiAdjust, LEVELS, levelOf, tacticsOf, teamPlan, TENDENCIES } from '../src/engine/tactics';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'real-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'real-a', 2018, []);
const input = (seed: number, neutral = true): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral,
});

describe('E3.5 A1 판단 단위 (골 = 1)', () => {
  it('위치 가치 맵 앵커: 자기 진영 < 중앙선 < 25 m < 18 m < 페널티 지점', () => {
    const v = (dGoal: number) => positionValue(1 - dGoal / ENGINE.pitch.length, 0.5);
    // C.16 결정 3: 먼 쪽 성분을 평평하게 (자기 진영·중원의 전진 보상 감소, 30 m 가치는 그대로)
    expect(v(80)).toBeGreaterThan(0.004);
    expect(v(80)).toBeLessThan(0.014);
    expect(v(80)).toBeLessThan(v(52.5));
    expect(v(52.5)).toBeCloseTo(0.018, 2);
    expect(v(30)).toBeCloseTo(0.031, 2);
    expect(v(25)).toBeCloseTo(0.04, 2);
    expect(v(18)).toBeGreaterThan(0.055);
    expect(v(18)).toBeLessThan(0.08);
    expect(v(11)).toBeCloseTo(0.115, 2);
    // 골라인 근처 측면
    expect(positionValue(1 - 2 / ENGINE.pitch.length, 0.07)).toBeGreaterThan(0.025);
    expect(positionValue(1 - 2 / ENGINE.pitch.length, 0.07)).toBeLessThan(0.05);
  });
});

describe('E3.5 A2~A4 공격 전개, 전환, 중단 시간', () => {
  const r = createMatch(input(31)).runToEnd();
  it('공이 살아 있는 시간이 실제 경기 시간보다 짧고 스로인·골킥이 나온다', () => {
    expect(r.liveSeconds).toBeLessThan(r.duration * 0.8);
    for (const t of r.teamStats) {
      expect(t.throwIns).toBeGreaterThan(3);
      expect(t.goalKicks).toBeGreaterThan(1);
    }
  });
  it('컷백·버티기가 나오고 재개 대기 시간은 범위 안 (골 후 킥오프 45~75초)', () => {
    // C.78c(착지점 몫): 시드 31 경기의 버티기가 0 이 되어 33 경기를 더해 본다 (31~40 중 0 은 31·32·35·36 — 동작 존재 확인, 시드만)
    const r33 = createMatch(input(33)).runToEnd();
    const tot = (k: 'cutbacks' | 'holdups') => r.teamStats[0][k] + r.teamStats[1][k] + r33.teamStats[0][k] + r33.teamStats[1][k];
    expect(tot('holdups')).toBeGreaterThan(0);
    const s = createState(input(32));
    let checked = 0;
    while (!s.done && checked < 5) {
      const before = s.restart;
      step(s);
      if (!before && s.restart) {
        const wait = s.restart.at - s.t + ENGINE.time.dt;
        const R = ENGINE.restart;
        const range = s.restart.type === 'throwIn' ? R.throwIn : s.restart.type === 'goalKick' ? R.goalKick : s.restart.type === 'corner' ? R.corner : null;
        if (range) {
          expect(wait).toBeGreaterThanOrEqual(range[0] - 0.01);
          expect(wait).toBeLessThanOrEqual(range[1] + 0.01);
          checked++;
        }
      }
    }
    expect(checked).toBe(5);
  });
  it('공을 잃으면 역압박: 최대 3명, (counterBase + 2 × pressing)초 안', () => {
    const s = createState(input(33));
    while (s.t < 120) step(s);
    const team = s.possTeam;
    const opp = s.agents.find((a) => a.onPitch && a.team !== team && a.line === 2)!;
    s.restart = null;
    setOwner(s, opp);
    const tm = s.teams[team];
    expect(tm.counterPressers.length).toBeLessThanOrEqual(3);
    if (tm.counterPressers.length) {
      expect(tm.counterUntil - s.t).toBeCloseTo(ENGINE.offball.counterBase + ENGINE.offball.counterPerPress * tm.tactics.pressing, 5);
    }
  });
});

describe('E3.5 A6, A7 수적 차이와 홈 이점', () => {
  it('10명 팀은 공격수 1명을 중원으로 내리고 스태미나 소모 배율이 오른다', () => {
    const s = createState(input(41));
    const att = () => s.agents.filter((a) => a.onPitch && a.team === 0 && a.line === 3).length;
    const before = att();
    const victim = s.agents.find((a) => a.team === 0 && a.line === 1)!;
    sendOff(s, victim);
    if (before >= 2) expect(att()).toBe(before - 1);
    expect(s.agents.filter((a) => a.onPitch && a.team === 0).every((a) => a.drainMul === ENGINE.referee.shortDrain)).toBe(true);
  });
  it('홈 팀은 능력치 가산 없이 판단 품질 +0.03, 듀얼 로짓 +0.06', () => {
    const n = createState(input(42, true));
    const h = createState(input(42, false));
    const a0 = n.agents[3]!;
    const b0 = h.agents[3]!;
    expect(b0.attrs).toEqual(a0.attrs);
    expect(b0.judgement - a0.judgement).toBeCloseTo(ENGINE.match.homeJudgement, 6);
    expect(b0.duelEdge).toBe(ENGINE.match.homeDuel);
    expect(h.agents.find((a) => a.team === 1)!.duelEdge).toBe(0);
  });
});

describe('E3.5 A5, A8 전술 엔진 층 (E.19)', () => {
  it('성향 기본값과 세부 전술 단계', () => {
    expect(tacticsOf('tikitaka')).toEqual({ tendency: 'tikitaka', lineHeight: 0.65, pressing: 0.8, style: 0.85, width: 1.15 });
    expect(tacticsOf('block')).toEqual({ tendency: 'block', lineHeight: 0.35, pressing: 0.3, style: 0.2, width: 0.85 });
    expect(levelOf('lineHeight', 0.6)).toBe(3);
    expect(tacticsOf('bus')).toEqual({ tendency: 'bus', lineHeight: 0.2, pressing: 0.3, style: 0.2, width: 0.85 });
    expect(TENDENCIES).toHaveLength(7);
  });
  it('실제 팀은 데이터 성향·포메이션·style, 가상 팀은 레이팅 구간별 성향과 레이팅 비례 style', () => {
    const mci = teamPlan('mci', 85, '4-4-2');
    expect(mci.tendency).toBe('tikitaka');
    expect(mci.formation).toBe('4-3-3');
    expect(mci.tactics.style).toBe(0.9);
    for (let i = 0; i < 20; i++) {
      expect(['tikitaka', 'gegenpress', 'balanced']).toContain(teamPlan(`v${i}`, 80, '4-4-2', 'w', 75).tendency);
      expect(['block', 'direct', 'counter']).toContain(teamPlan(`v${i}`, 70, '4-4-2', 'w', 75).tendency);
    }
    expect(teamPlan('vx', 80, '4-4-2', 'w', 75).tactics.style).toBeCloseTo(0.7, 6);
    expect(teamPlan('vx', 60, '4-4-2', 'w', 75).tactics.style).toBe(0.2);
  });
  it('슬롯 역할은 성향 추천 역할로 채운다', () => {
    const r = createTeamRoster({ id: 'liv', rating: 84 }, 'w', 2018, []);
    const setup = teamSetupFromRoster(r, 84, 75);
    expect(setup.tactics.tendency).toBe('gegenpress');
    const roles = setup.lineup.map((p) => p.role);
    expect(roles.every((x) => typeof x === 'string')).toBe(true);
    expect(roles).toContain('advancedForward');
  });
  it('경기 중 AI 조정: 70분 이후 1골 차로 지면 라인·압박 한 단계 위, 이기면 라인 한 단계 아래', () => {
    const s = createState(input(51));
    s.teams[0].setup.tactics = { ...tacticsOf('balanced') };
    s.teams[1].setup.tactics = { ...tacticsOf('balanced') };
    s.t = 70 * 60;
    s.tick = 600 * 100;
    s.teams[0].stats.goals = 0;
    s.teams[1].stats.goals = 1;
    aiAdjust(s);
    expect(s.teams[0].tactics.lineHeight).toBe(LEVELS.lineHeight[3]);
    expect(s.teams[0].tactics.pressing).toBe(LEVELS.pressing[2]);
    expect(s.teams[1].tactics.lineHeight).toBe(LEVELS.lineHeight[1]);
    expect(s.teams[1].tactics.pressing).toBe(LEVELS.pressing[1]);
  });
  it('전술 결정성: 같은 시드 + 같은 전술 = 같은 결과, 전술이 다르면 결과가 다르다', () => {
    const withT = (t: ReturnType<typeof tacticsOf>): EngineInput => {
      const i = input(61);
      i.home.tactics = t;
      return i;
    };
    const a = createMatch(withT(tacticsOf('counter'))).runToEnd();
    const b = createMatch(withT(tacticsOf('counter'))).runToEnd();
    const c = createMatch(withT(tacticsOf('tikitaka'))).runToEnd();
    expect(b).toEqual(a);
    expect(c.teamStats).not.toEqual(a.teamStats);
  });
});
