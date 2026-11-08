// C.81z (53단계, 엔진 묶음 E1): 게겐 축 정리 — 상성 칸 4개 · 게겐 뚫림 간격 배수(새 상수) · GK 쳐내기 코너 · 롱패스 착지 정확도
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { matchupPts } from '../src/engine/fit';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { TENDENCY, tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c81z-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c81z-a', 2018, []);
function match(a: Tendency, b: Tendency, seed: number) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}

describe('C.81z 게겐 축 정리', () => {
  it('상수: 엔진 96 · 상성 칸 4개 · 게겐 뚫림 간격 배수 1.5 · parryCorner 0.25 · longMiss 0.5', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(96);
    expect(ENGINE.matchup.tikitaka!.gegenpress).toEqual({ short: 3, keep: 3 });
    expect(ENGINE.matchup.block!.gegenpress).toEqual({ air: 2, keep: 3 });
    expect(ENGINE.matchup.gegenpress!.balanced).toEqual({ tackle: 2 });
    expect(ENGINE.matchup.gegenpress!.counter).toEqual({ tackle: 3, air: 2 });
    expect(ENGINE.matchup.gegenpress!.direct).toEqual({ tackle: 5, air: 4, keep: 2 }); // C.81t 그대로
    expect(ENGINE.matchup.gegenpress!.tikitaka).toEqual({ tackle: -10, air: -8 });
    expect(TENDENCY.gegenPressBreakMul).toBe(1); // 끔 (×1.5·3·5 모두 8초 상대 슈팅 무변화 — 부록 C.81z)
    expect(ENGINE.keeper.parryCorner).toBe(0.25);
    expect(ENGINE.prob.longMiss).toBe(0.5);
  });

  it('게겐 → 균형·역습 칸: 그 짝에서만 게겐 쪽 태클(·공중) 점수, 상대 쪽·다른 실행은 0', () => {
    const s1 = match('gegenpress', 'balanced', 3).state;
    expect(matchupPts(s1, 0, 'tackle')).toBe(2);
    expect(matchupPts(s1, 0, 'air')).toBe(0);
    expect(matchupPts(s1, 1, 'tackle')).toBe(0);
    const s2 = match('gegenpress', 'counter', 3).state;
    expect(matchupPts(s2, 0, 'tackle')).toBe(3);
    expect(matchupPts(s2, 0, 'air')).toBe(2);
    expect(matchupPts(s2, 1, 'tackle')).toBe(0);
    const s3 = match('block', 'gegenpress', 3).state;
    expect(matchupPts(s3, 0, 'keep')).toBe(3);
    expect(matchupPts(s3, 0, 'air')).toBe(2);
    expect(matchupPts(s3, 1, 'keep')).toBe(0);
    // 게겐 → 티키: 게겐 쪽 태클 −10·공중 −8, 티키 쪽은 짧은 패스·공 지키기 3
    const s5 = match('gegenpress', 'tikitaka', 3).state;
    expect(matchupPts(s5, 0, 'tackle')).toBe(-10);
    expect(matchupPts(s5, 0, 'air')).toBe(-8);
    expect(matchupPts(s5, 1, 'short')).toBe(3);
    expect(matchupPts(s5, 1, 'tackle')).toBe(0);
    // 게겐끼리·균형끼리는 0
    const s4 = match('gegenpress', 'gegenpress', 3).state;
    expect(matchupPts(s4, 0, 'tackle')).toBe(0);
  });

  it('게겐 뚫림 간격 배수: 켜면(3) 같은 시드 게겐 경기가 끔(1)과 달라진다(배수가 실제로 걸림), 균형끼리는 그대로', () => {
    const T = TENDENCY as { gegenPressBreakMul: number };
    const run = (a: Tendency, b: Tendency, seed: number) => {
      const r = match(a, b, seed).runToEnd();
      return `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;
    };
    const was = T.gegenPressBreakMul;
    try {
      const seeds = [1, 2, 3, 4, 5, 6];
      const on = seeds.map((k) => run('gegenpress', 'balanced', k));
      const same = seeds.map((k) => run('balanced', 'balanced', k));
      T.gegenPressBreakMul = 3;
      const off = seeds.map((k) => run('gegenpress', 'balanced', k));
      const same2 = seeds.map((k) => run('balanced', 'balanced', k));
      expect(same2).toEqual(same);
      expect(off.some((v, i) => v !== on[i])).toBe(true);
      // 결정성: 같은 설정이면 같은 결과
      T.gegenPressBreakMul = was;
      expect(seeds.map((k) => run('gegenpress', 'balanced', k))).toEqual(on);
    } finally {
      T.gegenPressBreakMul = was;
    }
  });
});
