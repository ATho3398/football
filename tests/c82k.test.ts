// C.82k (53단계, 엔진 묶음 F5): 풀백 전진 높이를 수비 라인 높이에 비례 — 게겐·티키(0.65) 공 +3 m 그대로, 균형(0.5) 공 높이, 블록(0.35) 3 m 뒤, 버스(0.2) 6 m 뒤 · 결정성
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { frontStayFb, frontStayFbGap, offsideLine, updateOffball } from '../src/engine/offball';
import { attackDir, L, normX, normY } from '../src/engine/pitch';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf, type Tendency } from '../src/engine/tactics';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82k-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82k-a', 2018, []);
function sim(a: Tendency = 'gegenpress', b: Tendency = 'balanced', seed = 5) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;
const O = ENGINE.offball;
const OW = ENGINE.offball as unknown as { frontStayFbLineK: number };
const FB = new Set(['LB', 'RB', 'LWB', 'RWB']);

describe('C.82k 묶음 F5: 풀백 전진 높이 = 라인 높이 비례', () => {
  it('상수: 엔진 108 · frontStayFbLineK 20 · 기준 라인 0.65 · 공 +3 m · 가운데 ⅓ 3 m 뒤(C.82j 그대로)', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(108);
    expect(O.frontStayFbLineK).toBe(20);
    expect(O.frontStayFbLineRef).toBe(0.65);
    expect(O.frontStayFbBehind).toBe(-3);
    expect(O.frontStayFbTrail).toBe(3);
  });

  it('공 뒤 거리: 라인 높음 −3/3 · 보통 0/6 · 낮음 3/9 · 매우 낮음 6/12 m, K 0 이면 모두 −3/3', () => {
    const m = sim();
    const s = m.state;
    const at = (lh: number) => { s.teams[0].tactics.lineHeight = lh; return [frontStayFbGap(s, 0, true), frontStayFbGap(s, 0, false)]; };
    expect(at(0.65).map((v) => +v.toFixed(6))).toEqual([-3, 3]);
    expect(at(0.5).map((v) => +v.toFixed(6))).toEqual([0, 6]);
    expect(at(0.35).map((v) => +v.toFixed(6))).toEqual([3, 9]);
    expect(at(0.2).map((v) => +v.toFixed(6))).toEqual([6, 12]);
    const was = OW.frontStayFbLineK;
    try {
      OW.frontStayFbLineK = 0;
      expect(at(0.2)).toEqual([-3, 3]);
    } finally { OW.frontStayFbLineK = was; }
  });

  it('게겐 대 균형: 공 쪽 풀백 목표 x ≥ min(라인 − 1 m, 공 − 거리) — 게겐은 공 +3 m, 균형은 공 높이(두 팀 모두 장면 확인)', () => {
    const m = sim();
    const s = m.state;
    const seen = [0, 0];
    while (!s.done && s.t < 2400 && (seen[0] < 10 || seen[1] < 10)) {
      m.step();
      if (s.restart || s.ball.owner < 0 || s.ball.flight) continue;
      const owner = s.agents[s.ball.owner]!;
      const team = owner.team;
      if (s.possTeam !== team) continue;
      const dir = attackDir(team, s.half);
      const bnx = normX(s.ball.x, dir), bny = normY(s.ball.y, dir);
      if (bnx < O.frontStayFromX || bnx > 0.9) continue;
      const cap = offsideLine(s, team) - 1 / L;
      const tol = 0.3 / L + O.jitter / L;
      for (const a of s.agents) {
        if (!a.onPitch || a.team !== team || a === owner || a.line === 0 || s.t < a.runUntil || !FB.has(a.pos) || a.role.modules.includes('between')) continue;
        if (frontStayFb(s, a, dir, bnx, bny) !== 1) continue;
        updateOffball(s, a);
        if (s.t < a.runUntil) continue;
        const gap = frontStayFbGap(s, team, true);
        expect(gap).toBeCloseTo(team === 0 ? -3 : 0, 6);
        expect(normX(a.tx, dir), `${team ? '균형' : '게겐'} ${a.pos} t=${s.t.toFixed(1)}`).toBeGreaterThanOrEqual(Math.min(cap, bnx - gap / L) - tol);
        seen[team]++;
      }
    }
    expect(seen[0]).toBeGreaterThanOrEqual(10);
    expect(seen[1]).toBeGreaterThanOrEqual(10);
  });

  it('결정성: 같은 시드 두 번 같고, K 를 끄면(C.82j 동작) 달라진다', () => {
    const a = fp(sim('balanced', 'block', 17).runToEnd());
    expect(fp(sim('balanced', 'block', 17).runToEnd())).toBe(a);
    const was = OW.frontStayFbLineK;
    try {
      OW.frontStayFbLineK = 0;
      expect(fp(sim('balanced', 'block', 17).runToEnd())).not.toBe(a);
    } finally { OW.frontStayFbLineK = was; }
  });
});
