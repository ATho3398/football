// C.82j (53단계, 엔진 묶음 F4): 공격 국면 전방 잔류 — 최전방·측면 미드는 공보다 앞, 공 쪽 풀백은 공 높이까지 · 결정성
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { frontStayFb, offsideLine, updateOffball } from '../src/engine/offball';
import { attackDir, L, normX, normY } from '../src/engine/pitch';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';
import type { Formation } from '../src/formations';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82j-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82j-a', 2018, []);
function sim(hf: Formation = '4-4-2', af: Formation = '4-4-2', seed = 3) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.formation = hf;
  w.formation = af;
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;
const O = ENGINE.offball;
const OW = ENGINE.offball as unknown as { frontStay: number; frontStayRest: number };
const FB = new Set(['LB', 'RB', 'LWB', 'RWB']);

describe('C.82j 묶음 F4: 공격 국면 전방 잔류', () => {
  it('상수: 엔진 107 · frontStay 1 · 상대 ⅓ 0.667 · 앞 2 m · ①(ST·측면 바닥) 끔(drop 0·wide 0) · 풀백 공 +3 m(가운데 ⅓ 3 m 뒤 · 반대쪽 규칙 없음) · 여유 1 · 수비 줄 공격 시프트 0.14 그대로', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(107);
    expect(O.frontStay).toBe(1);
    expect(O.frontStayFromX).toBe(0.667);
    expect(O.frontStayAhead).toBe(2);
    expect(O.frontStayDrop).toBe(0); // ① 끔(출하) — 켜면 0.5
    expect(O.frontStayWide).toBe(0);
    expect(O.frontStayFbBehind).toBe(-3);
    expect(O.frontStayFbFromX).toBe(0.45);
    expect(O.frontStayFbTrail).toBe(3);
    expect(O.frontStayFbFar).toBe(0);
    expect(O.frontStayRest).toBe(1);
    expect(ENGINE.formation.attackShift[1]).toBe(0.14);
  });

  it('상대 ⅓ 에서 동료가 공을 가지면(① 을 drop 0.5·wide 1 로 켜고): 드롭 아닌 ST·측면 미드(LM·RM) 목표 x ≥ min(라인 − 1 m, 공 + 2 m) · 공 쪽 풀백 목표 x ≥ min(라인 − 1 m, 공 + 3 m)', () => {
    const OD = ENGINE.offball as unknown as { frontStayDrop: number; frontStayWide: number };
    const wasD = OD.frontStayDrop, wasW = OD.frontStayWide;
    OD.frontStayDrop = 0.5; OD.frontStayWide = 1;
    try {
    const m = sim();
    const s = m.state;
    let checked = 0, fbNear = 0, fbFar = 0;
    while (!s.done && s.t < 1500 && checked < 60) {
      m.step();
      if (s.restart || s.ball.owner < 0 || s.ball.flight) continue;
      const owner = s.agents[s.ball.owner]!;
      const team = owner.team;
      if (s.possTeam !== team) continue;
      const dir = attackDir(team, s.half);
      const bnx = normX(s.ball.x, dir), bny = normY(s.ball.y, dir);
      if (bnx < O.frontStayFromX || bnx > 0.9) continue;
      const line = offsideLine(s, team);
      const cap = line - 1 / L;
      for (const a of s.agents) {
        if (!a.onPitch || a.team !== team || a === owner || a.line === 0 || s.t < a.runUntil) continue;
        const tol = 0.3 / L + O.jitter / L; // 목표 지터(setTarget errY × jitter) 여유
        if ((a.pos === 'ST' || a.pos === 'CF' || (O.frontStayWide > 0 && (a.pos === 'LM' || a.pos === 'RM'))) && a.role.drop < O.frontStayDrop) {
          updateOffball(s, a);
          expect(normX(a.tx, dir), `${a.pos} t=${s.t.toFixed(1)}`).toBeGreaterThanOrEqual(Math.min(cap, bnx + O.frontStayAhead / L) - tol);
          checked++;
        } else if (FB.has(a.pos) && !a.role.modules.includes('between')) {
          const side = frontStayFb(s, a, dir, bnx, bny);
          if (side === 0 || (side === 2 && O.frontStayFbFar <= 0)) continue;
          updateOffball(s, a);
          if (s.t < a.runUntil) continue; // 갱신에서 오버래핑을 시작했으면 다른 규칙
          const want = side === 1 ? Math.min(cap, bnx - O.frontStayFbBehind / L) : Math.min(cap, bnx - O.frontStayFbFar / L);
          expect(normX(a.tx, dir), `${a.pos} ${side === 1 ? '공 쪽' : '반대쪽'} t=${s.t.toFixed(1)}`).toBeGreaterThanOrEqual(want - tol);
          if (side === 1) fbNear++; else fbFar++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(60);
    expect(fbNear).toBeGreaterThan(0);
    expect(fbFar).toBe(0); // frontStayFbFar 0 = 반대쪽 규칙 없음
    } finally { OD.frontStayDrop = wasD; OD.frontStayWide = wasW; }
  });

  it('풀백 쪽 판정: 공이 중앙 띠 안이면 팀 상태 frontFbSide 가 바뀌지 않고, 남은 수비가 상대 최전방보다 적으면 0', () => {
    const m = sim();
    const s = m.state;
    while (!s.done && s.t < 600) {
      m.step();
      if (s.restart || s.ball.owner < 0) continue;
      const owner = s.agents[s.ball.owner]!;
      const dir = attackDir(owner.team, s.half);
      const bnx = normX(s.ball.x, dir), bny = normY(s.ball.y, dir);
      if (bnx < O.frontStayFbFromX || Math.abs(bny - 0.5) >= O.frontStayFlip) continue;
      const tm = s.teams[owner.team];
      const fb = s.agents.find((a) => a.onPitch && a.team === owner.team && FB.has(a.pos))!;
      const before = tm.frontFbSide;
      if (before === 0) continue;
      frontStayFb(s, fb, dir, bnx, bny);
      expect(tm.frontFbSide).toBe(before);
      break;
    }
    // 상대 최전방이 많이 남으면(frontStayRest 를 크게) 0
    const was = OW.frontStayRest;
    try {
      OW.frontStayRest = 9;
      const fb = s.agents.find((a) => a.onPitch && a.team === 0 && FB.has(a.pos))!;
      expect(frontStayFb(s, fb, attackDir(0, s.half), 0.8, 0.3)).toBe(0);
    } finally {
      OW.frontStayRest = was;
    }
  });

  it('결정성: 같은 시드 두 번 같고, frontStay 를 끄면 달라진다', () => {
    const a = fp(sim('4-4-2', '4-3-3', 11).runToEnd());
    const b = fp(sim('4-4-2', '4-3-3', 11).runToEnd());
    expect(a).toBe(b);
    const was = OW.frontStay;
    try {
      OW.frontStay = 0;
      expect(fp(sim('4-4-2', '4-3-3', 11).runToEnd())).not.toBe(a);
    } finally {
      OW.frontStay = was;
    }
  });
});
