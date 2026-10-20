// C.76q 44h-d: PK 빈도(박스 안 파울 배율) · 지정 PK 키커 · 12 m 밖 선방률 지표
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { penaltyTaker, setRestart } from '../src/engine/core';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { createTeamRoster } from '../src/roster';

function match(seed: number) {
  const home = createTeamRoster({ id: `h${seed}`, rating: 75 }, `c76q-h${seed}`, 2018, []);
  const away = createTeamRoster({ id: `a${seed}`, rating: 75 }, `c76q-a${seed}`, 2018, []);
  return createMatch({
    home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false,
  });
}

describe('C.76q PK·선방률 지표', () => {
  it('박스 안 파울 배율 0.08 (PK 경기당 약 0.28)', () => {
    expect(ENGINE.referee.boxFoulFactor).toBe(0.08);
  });

  it('지정 PK 키커 = 경기장 필드 선수 중 슈팅 + 침착성 최고 (공과의 거리 무관)', () => {
    const s = match(7).state;
    for (const team of [0, 1] as const) {
      const field = s.agents.filter((a) => a.team === team && a.onPitch && a.line !== 0);
      const best = Math.max(...field.map((a) => a.attrs.shooting + a.attrs.composure));
      const pick = penaltyTaker(s, team);
      expect(s.agents[pick]!.attrs.shooting + s.agents[pick]!.attrs.composure).toBe(best);
      expect(s.agents[pick]!.line).not.toBe(0);
      setRestart(s, 'penalty', team, 50, 34, 0);
      expect(s.restart!.taker).toBe(pick);
      // 빠진 선수는 고르지 않는다
      s.agents[pick]!.onPitch = false;
      expect(penaltyTaker(s, team)).not.toBe(pick);
      s.agents[pick]!.onPitch = true;
    }
  });

  it('12 m 밖 선방 집계: farSaves ≤ farOnTarget ≤ 유효 슈팅', () => {
    let far = 0;
    for (let seed = 1; seed <= 4; seed++) {
      const r = match(seed).runToEnd();
      for (const t of r.teamStats) {
        expect(t.farSaves).toBeLessThanOrEqual(t.farOnTarget);
        expect(t.farOnTarget).toBeLessThanOrEqual(t.shotsOnTarget);
        far += t.farOnTarget;
      }
    }
    expect(far).toBeGreaterThan(0);
  });
});
