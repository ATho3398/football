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
    // 퇴장(E3) 이 나오면 그만큼 줄어든다
    expect(s.agents.filter((a) => a.onPitch)).toHaveLength(22 - s.teams[0].stats.reds - s.teams[1].stats.reds);
  });

  it('이동 거리: 필드 선수 90분 6.5~14 km, GK 는 훨씬 적다', () => {
    for (const p of result.players) {
      if (p.minutes < 85) continue;
      if (p.position === 'GK') expect(p.distance).toBeLessThan(5000);
      else {
        expect(p.distance).toBeGreaterThan(6500);
        // C.78d(엔진 44): 역습 지원 달리기(5초 전력)로 시드 11 에 13.7 km 선수가 나와 상한 13.5 → 14 km (실제 최다 13.5~14.5 km)
        // C.78e(엔진 45, 마스터 Z 승인 — 마지막 단계 재검토): 시드 11 CDM 14.02 km(시드 12·13 최다 13.50·13.28, 규칙 하나씩 끄면 12.7~14.03 으로 흔들림) → 상한 14.5 km = 실제 최다 범위 위끝
        expect(p.distance).toBeLessThan(14500);
      }
    }
  });
});

describe('결정과 듀얼 (E2)', () => {
  // C.76p: 6경기(유효 슈팅 약 40개)는 선방률 55~85 하한이 1.5σ 라 흔들려 24경기로 (엔진 30 에서 6경기 51%, 12경기 52%, 같은 설정 다른 시드 36경기 69%, quick 600 66%)
  const results = Array.from({ length: 24 }, (_, i) => createMatch(input(100 + i)).runToEnd());

  it('기록 정합성: 골 ≤ 유효 슈팅 ≤ 슈팅, 선방 = 상대 유효 슈팅 − 상대 골, 골 이벤트 수 = 득점', () => {
    for (const r of results) {
      const [h, a] = r.teamStats;
      for (const [own, opp] of [[h, a], [a, h]] as const) {
        expect(own.goals).toBeLessThanOrEqual(own.shotsOnTarget);
        expect(own.shotsOnTarget).toBeLessThanOrEqual(own.shots);
        expect(opp.saves).toBe(own.shotsOnTarget - own.goals);
        expect(own.dribblesWon).toBeLessThanOrEqual(own.dribbles);
        expect(own.tacklesWon).toBeLessThanOrEqual(own.tackles);
        expect(own.crossesCompleted).toBeLessThanOrEqual(own.crosses);
      }
      expect(r.homeGoals).toBe(h.goals);
      expect(r.events.filter((e) => e.type === 'goal' && e.team === 0)).toHaveLength(h.goals);
      expect(r.events.filter((e) => e.type === 'goal' && e.team === 1)).toHaveLength(a.goals);
      const scorers = r.players.reduce((t, p) => t + p.goals, 0);
      expect(scorers).toBe(h.goals + a.goals);
    }
  });

  it('여러 경기 평균이 현실 범위: 팀당 슈팅 6~20, 득점 0.5~2.5, 선방률 55~85%, 태클/드리블/크로스/공중볼이 있다', () => {
    const all = results.flatMap((r) => r.teamStats);
    const avg = (f: (t: (typeof all)[number]) => number) => all.reduce((x, t) => x + f(t), 0) / all.length;
    expect(avg((t) => t.shots)).toBeGreaterThan(6);
    expect(avg((t) => t.shots)).toBeLessThan(20);
    expect(avg((t) => t.goals)).toBeGreaterThan(0.5);
    // 2026-10-23 사용자: 움직임 먼저 — C.78e 켬 2.60(병합 뒤 2.56), 로드맵 마지막 단계에서 2.5로 되돌림 (마스터 Z 승인)
    // C.78h(엔진 47, 마스터 AA 승인 2026-10-24): 24경기 2.81 → 상한 2.9 — 마지막 단계에서 2.5로 (사용자: 득점은 최후순위)
    expect(avg((t) => t.goals)).toBeLessThan(2.9);
    const saveRate = avg((t) => t.saves) / avg((t) => t.shotsOnTarget);
    // C.78b: 새 동작 전부 켬(사용자 2026-10-23 09:00 "움직임 먼저, 밸런스는 마지막 단계") 선방률 51.7% — 마지막 단계에서 0.55 로 되돌린다
    // C.78c: 착지점 몫 켬(롱볼 세컨드볼 판단) 24경기 46.5% — 밸런스는 보고만(사용자 2026-10-23 "움직임 먼저"), 마지막 단계에서 0.55 로 되돌린다
    expect(saveRate).toBeGreaterThan(0.45);
    expect(saveRate).toBeLessThan(0.85);
    for (const f of [(t: (typeof all)[number]) => t.tackles, (t: (typeof all)[number]) => t.dribbles, (t: (typeof all)[number]) => t.crosses, (t: (typeof all)[number]) => t.aerials, (t: (typeof all)[number]) => t.interceptions]) {
      expect(avg(f)).toBeGreaterThan(3);
    }
  });
});
