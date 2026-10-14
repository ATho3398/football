import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { attackDir, L, toNorm, W } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch, createState, step } from '../src/engine/sim';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 76 }, 'eng-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'eng-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 76, 74),
  away: teamSetupFromRoster(away, 74, 76),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false,
});

describe('경기 엔진 코어 (E1)', () => {
  const result = createMatch(input(11)).runToEnd();

  it('90분 + 추가시간을 끝까지 진행하고 킥오프/하프타임/종료 이벤트가 있다', () => {
    const T = ENGINE.time;
    expect(result.duration).toBeGreaterThanOrEqual(2 * T.halfSeconds + 120);
    expect(result.duration).toBeLessThanOrEqual(2 * T.halfSeconds + 8 * 60);
    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe('kickoff');
    expect(types).toContain('halftime');
    expect(types.at(-1)).toBe('fulltime');
  });

  it('결정성: 같은 시드면 같은 결과, 다른 시드면 다른 결과', () => {
    const again = createMatch(input(11)).runToEnd();
    expect(again).toEqual(result);
    const other = createMatch(input(12)).runToEnd();
    expect(other.teamStats).not.toEqual(result.teamStats);
  });

  it('양 팀 모두 점유와 패스가 있고 성공 수는 시도 이하', () => {
    const [h, a] = result.teamStats;
    const share = h.possessionTicks / (h.possessionTicks + a.possessionTicks);
    expect(share).toBeGreaterThan(0.3);
    expect(share).toBeLessThan(0.7);
    for (const t of result.teamStats) {
      expect(t.passes).toBeGreaterThan(150);
      expect(t.passesCompleted).toBeLessThanOrEqual(t.passes);
    }
  });

  it('22명이 대형을 유지한다: 평균 위치가 수비 < 중원 < 공격 순, 피치 안', () => {
    const s = createState(input(21));
    const sum: Record<string, [number, number]> = {};
    let n = 0;
    while (!s.done) {
      step(s);
      if (s.tick % 50 !== 0) continue;
      n++;
      for (const a of s.agents) {
        expect(a.x).toBeGreaterThanOrEqual(-2);
        expect(a.x).toBeLessThanOrEqual(L + 2);
        expect(a.y).toBeGreaterThanOrEqual(-2);
        expect(a.y).toBeLessThanOrEqual(W + 2);
        const [nx] = toNorm(a.x, a.y, attackDir(a.team, s.half));
        const k = `${a.team}:${a.line}`;
        sum[k] = [(sum[k]?.[0] ?? 0) + nx, (sum[k]?.[1] ?? 0) + 1];
      }
    }
    expect(n).toBeGreaterThan(500);
    for (const team of [0, 1]) {
      const m = (line: number) => sum[`${team}:${line}`]![0] / sum[`${team}:${line}`]![1];
      expect(m(0)).toBeLessThan(m(1));
      expect(m(1)).toBeLessThan(m(2));
      expect(m(2)).toBeLessThan(m(3));
    }
    expect(s.agents.filter((a) => a.onPitch)).toHaveLength(22);
  });

  it('이동 거리: 필드 선수 90분 5.5~14 km, GK 는 훨씬 적다', () => {
    for (const p of result.players) {
      if (p.minutes < 85) continue;
      if (p.position === 'GK') expect(p.distance).toBeLessThan(5000);
      else {
        expect(p.distance).toBeGreaterThan(5500);
        expect(p.distance).toBeLessThan(14000);
      }
    }
  });
});
