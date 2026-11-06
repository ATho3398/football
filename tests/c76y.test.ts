// C.76y 44h-f2: 역할 득실 편차(미해결 4) — 메짤라 run 0.6 → 0.5 배포, 펄스 나인은 run 0.5·shoot 1 이 득점을 못 올려 엔진 33 값 그대로 (roles.ts 만)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { ROLES, hasModule } from '../src/engine/roles';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

describe('C.76y 역할 파라미터 (미해결 4)', () => {
  it('펄스 나인: 엔진 33 값 그대로 (run 0.35·shoot 0.9 — 조정 1회가 슈팅만 늘리고 득점은 못 올렸다)', () => {
    const f = ROLES.falseNine!;
    expect(f.run).toBe(0.35);
    expect(f.run).toBeLessThan(ENGINE.offball.lateRunRun);
    expect(f.pref.shoot).toBe(0.9);
    expect(f.pref.pass).toBe(1.3);
    expect(f.drop).toBe(0.5);
    expect(f.dx).toBe(-0.1);
    expect(hasModule(f, 'between')).toBe(true);
  });
  it('메짤라: 침투 0.5 (박스투박스 0.6 보다 낮고 늦은 침투 문턱 이상), 나머지 그대로', () => {
    const m = ROLES.mezzala!;
    expect(m.run).toBe(0.5);
    expect(m.run).toBeLessThan(ROLES.boxToBox!.run);
    expect(m.run).toBeGreaterThanOrEqual(ENGINE.offball.lateRunRun);
    expect(m.dx).toBe(0.06);
    expect(m.pref.shoot).toBe(1.1);
  });
  it('펄스 나인 팀 경기는 결정적이다 (같은 시드 같은 결과)', () => {
    const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76y-h', 2018, []);
    const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76y-a', 2018, []);
    const input = (): EngineInput => {
      const h = teamSetupFromRoster(home, 75, 75);
      const st = h.lineup.find((p) => p.slot === 9) ?? h.lineup.find((p) => p.position === 'ST' || p.position === 'CF');
      if (st) st.role = 'falseNine';
      return { home: h, away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed: 7601, bigMatch: false, neutral: true };
    };
    const run = () => { const m = createMatch(input()); while (!m.state.done) m.step(); return `${m.state.teams[0].stats.goals}-${m.state.teams[1].stats.goals}`; };
    expect(run()).toBe(run());
  });
});
