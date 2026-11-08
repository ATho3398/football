// C.82e (53단계, 엔진 묶음 E6): 게겐 뒷공간 비용·재탈취 — 공격 국면 수비 줄 라인 높이(attackLineK) · 탈취 직후 공간 비례 침투 시야(throughSeeSpace) ·
// 게겐 역압박 가담자 압박 실효 거리(gegenPressReach) · defensiveLine 죽은 분기 정리(tikiLineDrop 삭제)
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { SLOT, slotTargetS } from '../src/engine/formation';
import { pressReachOf, pressureAt } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { TENDENCY, tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82e-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82e-a', 2018, []);
function match(a: Tendency, b: Tendency, seed: number) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}
const run = (a: Tendency, b: Tendency, seed: number) => {
  const r = match(a, b, seed).runToEnd();
  return `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;
};

describe('C.82e 게겐 뒷공간 비용·재탈취', () => {
  it('상수: 엔진 100 · 게겐 → 티키 칸 −9/−6 · attackLineK 끔(0) · throughSeeSpace 끔(0)/40 m/6 s · gegenPressReach 1.5 · tikiLineDrop 삭제', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(100);
    expect(ENGINE.formation.attackLineK).toBe(0); // 0.6 은 상성 960 행 ±0.13 · 게겐>티키 +0.04 로 관문 ✗ (부록 C.82e)
    expect((ENGINE.formation as Record<string, unknown>).tikiLineDrop).toBeUndefined();
    expect(ENGINE.onball.throughSeeSpace).toBe(0); // 켜도 게겐 전환 xG 가 안 움직이고 라인 낮은 수비만 올라 끔 (부록 C.82e)
    expect(ENGINE.onball.throughSeeSpaceFrom).toBe(40);
    expect(ENGINE.onball.throughSeeSpaceWin).toBe(6);
    expect(TENDENCY.gegenPressReach).toBe(1.5);
    expect(ENGINE.matchup.gegenpress!.tikitaka).toEqual({ tackle: -10, air: -7 }); // C.82g −9/−6 → −10/−7. C.82e: 가담자 압박 거리로 게겐>티키 +0.23 → +0.37 → 칸 감점 −7/−5 → −9/−6 으로 +0.23
  });

  it('공격 국면 수비 줄: 라인 높음(0.65)은 매우 낮음(0.2)보다 슬롯 x 가 attackLineK × 0.45 앞, 중원·공격 줄은 그대로', () => {
    const sim = match('balanced', 'balanced', 1);
    const s = sim.state;
    s.possTeam = 0;
    s.possSince = s.t - 100; // phase 1
    const cb = s.agents.find((a) => a.team === 0 && a.line === 1)!;
    const cm = s.agents.find((a) => a.team === 0 && a.line === 2)!;
    const at = (lh: number, a: typeof cb) => { s.teams[0].tactics.lineHeight = lh; slotTargetS(s, a); return SLOT.x; };
    const F = ENGINE.formation as { attackLineK: number };
    const was = F.attackLineK;
    try {
      // 끔(0): 라인 높이와 무관
      expect(at(0.65, cb)).toBeCloseTo(at(0.2, cb), 9);
      F.attackLineK = 0.6;
      const hiCb = at(0.65, cb), loCb = at(0.2, cb), midCb = at(0.5, cb);
      expect(hiCb - loCb).toBeCloseTo(0.6 * 0.45, 6);
      expect(hiCb - midCb).toBeCloseTo(0.6 * 0.15, 6);
      expect(at(0.65, cm)).toBeCloseTo(at(0.2, cm), 9);
      // 수비 국면(phase −1)에는 안 걸린다
      s.possTeam = 1;
      expect(at(0.65, cb)).toBeCloseTo(at(0.2, cb), 9);
    } finally {
      F.attackLineK = was;
    }
  });

  it('게겐 역압박 가담자 압박 거리: 창 안 가담자는 1.5배 멀리서 같은 압력, 창 밖·비가담·다른 성향은 1', () => {
    const sim = match('gegenpress', 'balanced', 2);
    const s = sim.state;
    const g = s.agents.find((a) => a.team === 0 && a.line === 2)!;
    const o = s.agents.find((a) => a.team === 1 && a.line === 2)!;
    const tm = s.teams[0];
    expect(pressReachOf(s, g)).toBe(1);
    tm.counterPressers = [g.idx];
    tm.counterUntil = s.t + 5;
    expect(pressReachOf(s, g)).toBe(1.5);
    // 가담 아닌 게겐 선수·상대(균형) 선수는 1
    const g2 = s.agents.find((a) => a.team === 0 && a.line === 3)!;
    expect(pressReachOf(s, g2)).toBe(1);
    expect(pressReachOf(s, o)).toBe(1);
    // 압력: 가담자를 상대 소유자에서 4 m(pressureDist 3 m 밖)에 두면 실효 2.67 m → 압력 > 0, 창이 끝나면 0
    for (const a of s.agents) if (a.team === 0) { a.x = 5; a.y = 5; }
    g.x = o.x + 4; g.y = o.y;
    expect(pressureAt(s, o)).toBeCloseTo(1 - 4 / 1.5 / ENGINE.prob.pressureDist, 9);
    tm.counterUntil = s.t;
    expect(pressureAt(s, o)).toBe(0);
  });

  it('레버 세 개가 실제로 걸린다(라인 K·공간 시야는 끔 → 켬): 켜고 끄면 같은 시드 게겐 경기가 달라지고, 가담자 배수는 균형끼리 경기를 안 바꾸며, 결정성 유지', () => {
    const F = ENGINE.formation as { attackLineK: number };
    const O = ENGINE.onball as { throughSeeSpace: number };
    const T = TENDENCY as { gegenPressReach: number };
    const was = [F.attackLineK, O.throughSeeSpace, T.gegenPressReach] as const;
    try {
      const seeds = [1, 2, 3, 4];
      const on = seeds.map((k) => run('gegenpress', 'balanced', k));
      const same = seeds.map((k) => run('balanced', 'balanced', k));
      T.gegenPressReach = 1;
      expect(seeds.map((k) => run('balanced', 'balanced', k))).toEqual(same);
      expect(seeds.map((k) => run('gegenpress', 'balanced', k)).some((v, i) => v !== on[i])).toBe(true);
      T.gegenPressReach = was[2];
      F.attackLineK = 0.6; // 끔(0) → 켜면 달라진다
      expect(seeds.map((k) => run('gegenpress', 'balanced', k)).some((v, i) => v !== on[i])).toBe(true);
      F.attackLineK = was[0];
      O.throughSeeSpace = 0.06; // 끔(0) → 켜면 달라진다 (코드가 살아 있음)
      expect(seeds.map((k) => run('gegenpress', 'balanced', k)).some((v, i) => v !== on[i])).toBe(true);
      O.throughSeeSpace = was[1];
      expect(seeds.map((k) => run('gegenpress', 'balanced', k))).toEqual(on);
    } finally {
      F.attackLineK = was[0]; O.throughSeeSpace = was[1]; T.gegenPressReach = was[2];
    }
  });
});
