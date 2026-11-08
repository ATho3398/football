// C.80w (53단계): 공중 롱패스 착지 정확도(prob.longMiss) · 판단 효용 가중(decide.bias.longW) · 상성 칸 되돌림(ENGINE.matchup long)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { matchupPts } from '../src/engine/fit';
import { candidates } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80w-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80w-a', 2018, []);
function state(a: Tendency, b: Tendency) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 5, bigMatch: false, neutral: true }).state;
}

/** 킥오프 상태에서 팀 0 CB 의 패스 후보 (목표점까지 거리 d, 판단 확률 p, 비행 확률 pFlight) */
function cbPasses(longMiss: number) {
  const O = ENGINE.prob as { longMiss: number };
  const was = O.longMiss;
  O.longMiss = longMiss;
  try {
    const s = state('balanced', 'balanced');
    const cb = s.agents.find((a) => a.team === 0 && a.pos === 'CB')!;
    s.ball.owner = cb.idx;
    return candidates(s, cb).filter((c) => c.type === 'pass').map((c) => ({ r: c.receiver, d: Math.hypot(c.x - cb.x, c.y - cb.y), p: c.p, pf: c.pFlight ?? c.p }));
  } finally {
    O.longMiss = was;
  }
}

describe('C.80w 롱패스 착지 정확도', () => {
  it('상수: longMiss 0.54 (C.81z 0.6 → 0.54) · longW 0.25 · saveBase 1.89 (C.80w 1.75 + C.80u 세트피스 헤더 되돌림 0.07 + C.81a 박스 인원 되돌림 0.07)', () => {
    expect(ENGINE.prob.longMiss).toBe(0.54); // C.81z 0.6 → 0.54 (롱패스 성공률 49 → 50~55%; 0.5 는 이동 거리 평균 14.13 km ✗ · 0.55~0.59 는 한 선수 최다 15.4~15.8 ✗)
    expect(ENGINE.decide.bias.longW).toBe(0.4); // C.81h 0.25 → 0.4 (롱패스 비율 10.9 → 12.5%)
    expect(ENGINE.keeper.saveBase).toBe(2.02); // C.81b 1.93 → C.81s 2.02
  });

  it('30 m 넘는 패스만 비행 실패 × longMiss, 짧은 패스는 그대로 (판단 p 와 실행 pFlight 같은 값에서)', () => {
    const on = cbPasses(0.6);
    const off = cbPasses(1);
    let longN = 0;
    for (const a of on) {
      const b = off.find((x) => x.r === a.r)!;
      if (a.d > ENGINE.prob.airPass) {
        longN++;
        expect(a.pf).toBeGreaterThan(b.pf);
        expect(a.pf).toBeCloseTo(Math.min(ENGINE.prob.passCap, Math.max(ENGINE.prob.passMin, 1 - (1 - b.pf) * 0.6)), 6);
      } else {
        expect(a.pf).toBe(b.pf);
        expect(a.p).toBe(b.p);
      }
    }
    expect(longN).toBeGreaterThan(0);
  });

  it('상성 칸: 직선 → 티키·게겐, 균형·블록 → 티키 롱패스만 감점, 반대쪽은 0', () => {
    expect(matchupPts(state('direct', 'tikitaka'), 0, 'long')).toBe(-15);
    // C.81g: 직선 → 게겐 롱패스 −12 → −6 · 직선 → 블록 공 지키기·짧은 패스 +1 (롱패스 0)
    expect(matchupPts(state('direct', 'gegenpress'), 0, 'long')).toBe(-6);
    expect(matchupPts(state('direct', 'block'), 0, 'short')).toBe(1);
    expect(matchupPts(state('direct', 'block'), 0, 'keep')).toBe(1);
    expect(matchupPts(state('direct', 'block'), 0, 'long')).toBe(0);
    expect(matchupPts(state('direct', 'block'), 0, 'air')).toBe(1); // C.81s
    expect(matchupPts(state('gegenpress', 'direct'), 0, 'tackle')).toBe(5); // C.81s 게겐 → 직선 태클 4 · 공중 3 · 공 지키기 1 → C.81t 5·4·2 (리바운드 런 뒤 게겐>직선 −0.01 → +0.08)
    expect(matchupPts(state('gegenpress', 'direct'), 0, 'air')).toBe(4);
    expect(matchupPts(state('gegenpress', 'direct'), 0, 'keep')).toBe(2);
    expect(matchupPts(state('direct', 'gegenpress'), 0, 'tackle')).toBe(0);
    expect(matchupPts(state('block', 'direct'), 0, 'short')).toBe(0);
    expect(matchupPts(state('balanced', 'tikitaka'), 0, 'long')).toBe(-10);
    expect(matchupPts(state('block', 'tikitaka'), 0, 'long')).toBe(-7);
    expect(matchupPts(state('direct', 'tikitaka'), 1, 'long')).toBe(0);
    expect(matchupPts(state('direct', 'balanced'), 0, 'long')).toBe(0);
    expect(matchupPts(state('direct', 'tikitaka'), 0, 'air')).toBe(0);
  });
});
