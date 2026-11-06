// C.77b 44h-i: 2선 침투자 "좁은 추적" (미해결 8·11, 8대 §9.15 가설 1) — defendTarget 줄 2 추적 배정·기억·해제
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import type { Agent } from '../src/engine/state';
import { createTeamRoster } from '../src/roster';
import { attackDir, dist, ownGoal } from '../src/engine/pitch';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c77b-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c77b-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

interface Probe { zoneTicks: number; trackedTicks: number; badTracker: number; badTarget: number; assigned: number; closeAtAssign: number }

/** 시드 3개: 상대 줄 2(소유자 아님)가 수비 골 trackZone 안에 있는 (선수, 틱) 중 추적자가 붙은 비율과 불변식(추적자는 줄 2 CDM/CM, 대상은 상대 줄 2) 위반 수 */
function probe(trackMax: number): Probe {
  const O = ENGINE.offball as { trackMax: number; trackZone: number; trackPickMax: number };
  const was = O.trackMax;
  O.trackMax = trackMax;
  const r: Probe = { zoneTicks: 0, trackedTicks: 0, badTracker: 0, badTarget: 0, assigned: 0, closeAtAssign: 0 };
  try {
    for (const seed of [91, 92, 93]) {
      const m = createMatch(input(seed));
      const s = m.state;
      const prev = new Map<Agent, number>();
      while (!s.done) {
        m.step();
        for (const d of s.agents) {
          if (d.trackIdx >= 0) {
            const o = s.agents[d.trackIdx]!;
            if (d.line !== 2 || !(d.pos === 'CDM' || d.pos === 'CM' || d.role.id === 'holdingCM')) r.badTracker++;
            if (o.team === d.team || o.line !== 2) r.badTarget++;
            if ((prev.get(d) ?? -1) !== d.trackIdx) {
              r.assigned++;
              if (dist(d.x, d.y, o.x, o.y) <= O.trackPickMax + 2) r.closeAtAssign++; // 배정 뒤 같은 틱의 이동(두 선수 상대 속도 최대 약 1.5 m) 허용
            }
          }
          prev.set(d, d.trackIdx);
        }
        if (s.tick % 5 !== 0 || s.restart) continue;
        const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
        const att = owner ? owner.team : s.possTeam;
        const def = (1 - att) as 0 | 1;
        const [gx, gy] = ownGoal(attackDir(def, s.half));
        for (const o of s.agents) {
          if (!o.onPitch || o.team !== att || o.line !== 2 || o === owner) continue;
          if (dist(o.x, o.y, gx, gy) >= O.trackZone) continue;
          r.zoneTicks++;
          if (s.agents.some((d) => d.onPitch && d.team === def && d.trackIdx === o.idx)) r.trackedTicks++;
        }
      }
    }
  } finally {
    O.trackMax = was;
  }
  return r;
}

describe('C.77b 2선 침투자 좁은 추적', () => {
  it('상수: 존 22 / 목표 20 / 최대 2명 / CDM 9 · 후보 12 m / 기억 0.7 · 해제 0.5 초 / 골 쪽 1.5(박스 밖 2.0) / 선읽기 0.5 / urgent 2 — 전면 마크가 아니라 좁은 추적 범위', () => {
    const O = ENGINE.offball;
    expect(O.trackZone).toBe(22);
    expect(O.trackTargetZone).toBeGreaterThanOrEqual(20);
    expect(O.trackTargetZone).toBeLessThanOrEqual(24);
    expect(O.trackMax).toBeGreaterThanOrEqual(0);
    expect(O.trackMax).toBeLessThanOrEqual(3);
    expect(O.trackCdmMax).toBeLessThanOrEqual(O.trackPickMax);
    expect(O.trackPickMax).toBeLessThanOrEqual(15);
    expect(O.trackHold).toBeGreaterThan(0);
    expect(O.trackRelease).toBeGreaterThan(0);
    expect(O.trackGap).toBeGreaterThanOrEqual(1);
    expect(O.trackGapOut).toBeGreaterThanOrEqual(O.trackGap);
    expect(O.trackUrgent).toBeGreaterThan(0);
  });
  it('같은 시드면 같은 결과 (결정성)', () => {
    const a = createMatch(input(77)).runToEnd();
    const b = createMatch(input(77)).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(a.events.length).toBe(b.events.length);
  });
  it('추적자는 줄 2 CDM/CM 만, 대상은 상대 줄 2 만, 배정 순간 거리는 trackPickMax 안 (불변식) · trackMax 0 이면 배정 없음', () => {
    const on = probe(2);
    expect(on.badTracker).toBe(0);
    expect(on.badTarget).toBe(0);
    expect(on.assigned).toBeGreaterThan(0);
    expect(on.closeAtAssign).toBe(on.assigned);
    const off = probe(0);
    expect(off.assigned).toBe(0);
    expect(off.trackedTicks).toBe(0);
  });
  it('존 22 m 안 상대 줄 2 가 있는 틱 중 추적자가 붙은 비율 ≥ 30% (§9.15.7 진단 일치 기준)', () => {
    const on = probe(2);
    expect(on.zoneTicks).toBeGreaterThan(0);
    expect(on.trackedTicks / on.zoneTicks).toBeGreaterThanOrEqual(0.3);
  });
});
