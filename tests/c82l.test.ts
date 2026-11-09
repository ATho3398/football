// C.82l (53단계, 엔진 묶음 F6): 게겐 첫 패스 압박 항(TENDENCY.gegenFirstPass — 상대가 뺏은 직후 패스 성공 확률에서 가담자 수 × k) ·
// 게겐 역압박 뚫린 뒤 가담자 복귀 지연(gegenBreakDelay) · 라인 유지 연장(gegenLineHoldExtra) · 정통 윙어 쪽 풀백 전방 잔류 가산(roles.classicWingerFbGap) · 결정성
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { classicWingerFbGap, frontStayFbGap } from '../src/engine/offball';
import { gegenFirstPassPen } from '../src/engine/onball';
import { ROLES } from '../src/engine/roles';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { TENDENCY, tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { FORMATION_SLOTS } from '../src/formations';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82l-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82l-a', 2018, []);
const WIDE = new Set(['LM', 'RM', 'LW', 'RW']);
const FB = new Set(['LB', 'RB', 'LWB', 'RWB']);
function sim(a: Tendency = 'gegenpress', b: Tendency = 'balanced', seed = 5, pickWinger = false) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  if (pickWinger) {
    const slots = FORMATION_SLOTS[h.formation];
    const wing = h.lineup.find((p) => WIDE.has(slots[p.slot]!.pos))!;
    wing.role = 'classicWinger';
    wing.rolePicked = true;
  }
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;
const TW = TENDENCY as unknown as { gegenFirstPass: number; gegenBreakDelay: number; gegenLineHoldExtra: number };
const RW = ENGINE.roles as unknown as { classicWingerFbGap: number };

describe('C.82l 묶음 F6: 게겐 전용 비용 · 재탈취 · 정통 윙어', () => {
  it('상수: 엔진 109 · 첫 패스 압박 __FP__ (창 2 s) · 복귀 지연 __BD__ s · 라인 유지 연장 __LH__ s · 정통 윙어 쪽 풀백 __FBG__ m', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(109);
    expect(TENDENCY.gegenFirstPass).toBe(__FP__);
    expect(TENDENCY.gegenFirstPassWin).toBe(2);
    expect(TENDENCY.gegenBreakDelay).toBe(__BD__);
    expect(TENDENCY.gegenLineHoldExtra).toBe(__LH__);
    expect(ENGINE.roles.classicWingerFbGap).toBe(__FBG__);
  });

  it('첫 패스 압박: 균형이 게겐에게서 뺏은 직후(창 안·역압박 가담자 있음) 패스만 k × 가담자 수, 게겐 쪽·창 밖·k 0 은 0', () => {
    const m = sim();
    const s = m.state;
    let seen = 0;
    while (!s.done && s.t < 2400 && seen < 5) {
      m.step();
      const g = s.teams[0];
      if (s.possTeam !== 1 || s.possOrigin !== 'open' || s.t - s.teams[1].wonAt > TENDENCY.gegenFirstPassWin || s.t >= g.counterUntil || !g.counterPressers.length) continue;
      const bal = s.agents.find((a) => a.onPitch && a.team === 1 && a.line !== 0)!;
      const geg = s.agents.find((a) => a.onPitch && a.team === 0 && a.line !== 0)!;
      const n = Math.min(g.counterPressers.length, TENDENCY.gegenMax);
      expect(gegenFirstPassPen(s, bal)).toBeCloseTo(TENDENCY.gegenFirstPass * n, 9);
      expect(gegenFirstPassPen(s, bal)).toBeGreaterThan(0);
      expect(gegenFirstPassPen(s, geg)).toBe(0);
      const was = s.teams[1].wonAt;
      s.teams[1].wonAt = s.t - TENDENCY.gegenFirstPassWin - 1;
      expect(gegenFirstPassPen(s, bal)).toBe(0);
      s.teams[1].wonAt = was;
      const k = TW.gegenFirstPass;
      try { TW.gegenFirstPass = 0; expect(gegenFirstPassPen(s, bal)).toBe(0); } finally { TW.gegenFirstPass = k; }
      seen++;
    }
    expect(seen).toBe(5);
  });

  it('복귀 지연: 게겐 역압박이 뚫리면 가담자의 다음 오프더볼 판단이 뚫린 시각 + gegenBreakDelay 이후, 균형은 바로(0.5 s 안)', () => {
    const m = sim();
    const s = m.state;
    const got = [0, 0];
    let last = [-1, -1];
    while (!s.done && s.t < 2700 && (got[0]! < 3 || got[1]! < 3)) {
      m.step();
      for (const team of [0, 1] as const) {
        const tm = s.teams[team];
        if (tm.brokeAt < 0 || tm.brokeAt === last[team] || !tm.counterPressers.length) continue;
        last[team] = tm.brokeAt;
        if (s.t - tm.brokeAt > 0.2) continue;
        for (const i of tm.counterPressers) {
          const a = s.agents[i]!;
          if (team === 0) expect(a.nextOffball).toBeGreaterThanOrEqual(tm.brokeAt + TENDENCY.gegenBreakDelay - 1e-6);
          else expect(a.nextOffball).toBeLessThan(tm.brokeAt + 1.0);
        }
        got[team] = (got[team] ?? 0) + 1;
      }
    }
    expect(got[0]).toBeGreaterThanOrEqual(3);
    expect(got[1]).toBeGreaterThanOrEqual(3);
  });

  it('정통 윙어 쪽 풀백: 직접 고른 정통 윙어와 같은 측면의 풀백만 공 뒤 거리 + classicWingerFbGap, 반대쪽·기본 역할 윙어는 그대로', () => {
    const m = sim('balanced', 'balanced', 3);
    const s = m.state;
    const wing = s.agents.find((a) => a.team === 0 && WIDE.has(a.pos))!;
    const fbs = s.agents.filter((a) => a.team === 0 && FB.has(a.pos));
    const same = fbs.find((a) => (a.sy < 0.5) === (wing.sy < 0.5))!;
    const other = fbs.find((a) => (a.sy < 0.5) !== (wing.sy < 0.5))!;
    const base = frontStayFbGap(s, 0, true);
    expect(classicWingerFbGap(s, same)).toBe(0);
    wing.role = ROLES.classicWinger!;
    wing.rolePicked = false;
    expect(classicWingerFbGap(s, same)).toBe(0);
    wing.rolePicked = true;
    expect(classicWingerFbGap(s, same)).toBe(ENGINE.roles.classicWingerFbGap);
    expect(classicWingerFbGap(s, other)).toBe(0);
    expect(frontStayFbGap(s, 0, true, same)).toBeCloseTo(base + ENGINE.roles.classicWingerFbGap, 9);
    expect(frontStayFbGap(s, 0, true, other)).toBeCloseTo(base, 9);
    expect(frontStayFbGap(s, 0, true)).toBeCloseTo(base, 9);
    const g = RW.classicWingerFbGap;
    try { RW.classicWingerFbGap = 0; expect(frontStayFbGap(s, 0, true, same)).toBeCloseTo(base, 9); } finally { RW.classicWingerFbGap = g; }
  });

  it('결정성: 같은 시드 두 번 같고, 레버를 하나씩 끄면 달라진다', () => {
    const a = fp(sim('gegenpress', 'balanced', 17).runToEnd());
    expect(fp(sim('gegenpress', 'balanced', 17).runToEnd())).toBe(a);
    for (const k of ['gegenFirstPass', 'gegenBreakDelay', 'gegenLineHoldExtra'] as const) {
      const was = TW[k];
      if (was === 0) continue;
      try { TW[k] = 0; expect(fp(sim('gegenpress', 'balanced', 17).runToEnd()), k).not.toBe(a); } finally { TW[k] = was; }
    }
    const b = fp(sim('balanced', 'balanced', 19, true).runToEnd());
    expect(fp(sim('balanced', 'balanced', 19, true).runToEnd())).toBe(b);
    const g = RW.classicWingerFbGap;
    try { RW.classicWingerFbGap = 0; expect(fp(sim('balanced', 'balanced', 19, true).runToEnd())).not.toBe(b); } finally { RW.classicWingerFbGap = g; }
  });
});
