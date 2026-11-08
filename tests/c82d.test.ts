// C.82d (53단계, 엔진 묶음 E5): 중원 줄 공격 자리 상한 — 공미가 최전방 깊이까지 올라가지 않는다 (4-3-1-2 다이아몬드 과강 · 4-2-3-1 CAM 오픈 플레이 골)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { slotTarget } from '../src/engine/formation';
import { L, W } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState } from '../src/engine/sim';
import type { SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster, type TeamRoster } from '../src/roster';
import type { Formation } from '../src/formations';

const F = ENGINE.formation;
function roster(id: string, formation: Formation): TeamRoster {
  const r = createTeamRoster({ id, rating: 75 }, `c82d-${id}`, 2018, []);
  r.formation = formation;
  return r;
}
function state(home: Formation, away: Formation): SimState {
  const input: EngineInput = {
    home: teamSetupFromRoster(roster('h', home), 75, 75), away: teamSetupFromRoster(roster('a', away), 75, 75),
    mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true,
  };
  const s = createState(input);
  s.restart = null;
  // 공은 중앙 (블록 쏠림 항 0) — 슬롯 목표에 phase 시프트와 역할 dx 만 남는다
  s.bsx = L / 2;
  s.bsy = W / 2;
  s.ball.x = L / 2;
  s.ball.y = W / 2;
  return s;
}
/** 홈 공격 국면(phase 1) */
function attacking(s: SimState): void {
  s.possTeam = 0;
  s.possSince = s.t - 100;
}
function withCap<T>(cap: number, f: () => T): T {
  const prev = F.midAttackCap;
  (F as { midAttackCap: number }).midAttackCap = cap;
  try { return f(); } finally { (F as { midAttackCap: number }).midAttackCap = prev; }
}

describe('C.82d 중원 줄 공격 자리 상한', () => {
  it('켜져 있다 (0 < midAttackCap < 최전방 슬롯 0.76)', () => {
    expect(F.midAttackCap).toBeGreaterThan(0);
    expect(F.midAttackCap).toBeLessThan(0.76);
  });

  it('공격 국면: 4-2-3-1 CAM 슬롯 0.58 + 시프트 0.25 = 0.83 이 상한에서 멈춘다 (역할 dx 0 인 클래식 10번 기준), 끄면 0.83', () => {
    const s = state('4-2-3-1', '4-4-2');
    attacking(s);
    const cam = s.agents.find((a) => a.team === 0 && a.pos === 'CAM')!;
    const dx = cam.role.dx;
    const on = slotTarget(s, cam)[0];
    const off = withCap(0, () => slotTarget(s, cam)[0]);
    expect(off).toBeCloseTo(0.58 + F.attackShift[2] + dx, 5);
    expect(on).toBeCloseTo(F.midAttackCap + dx, 5);
  });

  it('중앙 중원 수: 4-4-2·3-4-3 2명 · 4-3-3·4-2-3-1·4-1-4-1·3-5-2·5-3-2 3명 · 4-3-1-2 4명', () => {
    const expected: Record<Formation, number> = { '4-4-2': 2, '3-4-3': 2, '4-3-3': 3, '4-2-3-1': 3, '4-1-4-1': 3, '3-5-2': 3, '5-3-2': 3, '4-3-1-2': 4 };
    for (const f of Object.keys(expected) as Formation[]) expect(state(f, '4-4-2').teams[0].centralMids, f).toBe(expected[f]);
  });

  it('4-3-1-2(중앙 중원 4명): 실효 상한 = midAttackCap − midAttackCapPer — CAM·CM 모두 그 아래로, ST(줄 3) 는 상한과 무관', () => {
    const s = state('4-3-1-2', '4-4-2');
    attacking(s);
    const cap = F.midAttackCap - F.midAttackCapPer * (s.teams[0].centralMids - F.midAttackCapN);
    expect(cap).toBeLessThan(F.midAttackCap);
    for (const a of s.agents) {
      if (a.team !== 0 || a.line === 0) continue;
      const on = slotTarget(s, a)[0];
      const off = withCap(0, () => slotTarget(s, a)[0]);
      if (a.line !== 2) expect(on).toBe(off);
      else expect(on).toBeCloseTo(Math.min(off, Math.max(a.sx, cap) + a.role.dx), 5);
    }
  });

  it('4-4-2(중앙 중원 2명)는 상한에 닿지 않는다 — 공격 국면 자리가 켬/끔 같다', () => {
    const s = state('4-4-2', '4-3-1-2');
    attacking(s);
    for (const a of s.agents) {
      if (a.team !== 0 || a.line === 0) continue;
      expect(slotTarget(s, a)[0]).toBe(withCap(0, () => slotTarget(s, a)[0]));
    }
  });

  it('수비 국면에서는 아무것도 바뀌지 않는다', () => {
    const s = state('4-3-1-2', '4-4-2');
    s.possTeam = 1;
    s.possSince = s.t - 100;
    for (const a of s.agents) {
      if (a.team !== 0 || a.line === 0) continue;
      const [x, y] = slotTarget(s, a);
      const [x0, y0] = withCap(0, () => slotTarget(s, a));
      expect(x).toBe(x0);
      expect(y).toBe(y0);
    }
  });

  it('슬롯 자체가 상한보다 앞이면 슬롯 자리는 지킨다 (상한이 뒤로 끌어내리지 않는다)', () => {
    const s = state('4-2-3-1', '4-4-2');
    attacking(s);
    const cam = s.agents.find((a) => a.team === 0 && a.pos === 'CAM')!;
    const x = withCap(0.5, () => slotTarget(s, cam)[0]);
    expect(x).toBeCloseTo(cam.sx + cam.role.dx, 5);
  });
});
