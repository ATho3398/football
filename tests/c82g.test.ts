// C.82g (53단계, 엔진 묶음 F1): 전환 구조 — 뒤에서 쫓는 수비는 몰기 압박이 아니다(carryChase) · 달리며 받는 첫 터치 앞으로(runOnTouch) ·
// 켜 둔 코드지만 끈 레버(runFace · carryRunOn) · 라인 레버(attackLineK · throughSeeSpace)는 그대로 끔
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { setOwner } from '../src/engine/core';
import { carryReachDist } from '../src/engine/onball';
import { createMatch, createState } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf } from '../src/engine/tactics';
import type { Agent, SimState } from '../src/engine/state';
import type { EngineInput, Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82g-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82g-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});
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
function scene(place: (s: SimState) => Agent): SimState {
  const s = createState(input(71));
  s.restart = null;
  for (const a of s.agents) {
    a.x = a.team === 0 ? 10 : 95;
    a.y = 5 + (a.idx % 11) * 5.5;
    a.vx = a.vy = 0;
  }
  const owner = place(s);
  setOwner(s, owner);
  owner.cooldown = 0;
  s.ball.x = s.bsx = owner.x;
  s.ball.y = s.bsy = owner.y;
  return s;
}
const of = (s: SimState, team: 0 | 1, pos: string, k = 0) => s.agents.filter((a) => a.team === team && a.pos === pos)[k]!;

describe('C.82g 전환 구조: 공 앞 인원·높은 라인 비용', () => {
  it('상수: 엔진 103 · carryChase 1/램프 2 m · runOnTouch 4 m/앞 5 m/골 쪽 ≤ 3 · runFace·carryRunOn 끔 · 라인 레버(attackLineK·throughSeeSpace) 그대로 끔', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(103);
    expect(ENGINE.onball.carryChase).toBe(0.3); // 1 은 장면 ⑬ 슛 0.5 → 0.3 (뒤 3 m CB 를 무시하고 몰다 잡힘)
    expect(ENGINE.onball.carryChaseRamp).toBe(2);
    expect(ENGINE.receive.runOnTouch).toBe(4);
    expect(ENGINE.receive.runOnFree).toBe(5);
    expect(ENGINE.receive.runOnBack).toBe(3);
    expect(ENGINE.receive.runFace).toBe(0); // 모든 수신에 걸면 슛 13 → 18/경기 (부록 C.82g)
    expect(ENGINE.onball.carryRunOn).toBe(0); // 첫 터치 앞으로와 겹치면 균형끼리 득점 1.29 → 1.73 (부록 C.82g)
    expect(ENGINE.formation.attackLineK).toBe(0); // 켜도 라인 높은 팀 전환 xG 가 균형보다 낮아(0.90) 비용이 안 생김 (부록 C.82g)
    expect(ENGINE.onball.throughSeeSpace).toBe(0);
  });

  it('뒤에서 쫓는 수비: 몰고 가는 방향 뒤 3 m 상대는 몰 거리 6 m 의 carryChase 몫만큼 덜 좁혀 실효 거리가 옛 값보다 크고, 길 옆 상대는 그대로', () => {
    const s = scene((x) => {
      const o = of(x, 0, 'ST');
      [o.x, o.y] = [70, 34];
      return o;
    });
    const o = s.agents[s.ball.owner]!;
    const behind = of(s, 1, 'CB');
    [behind.x, behind.y] = [67, 34]; // 몰기 방향(+x) 뒤 3 m
    const beside = of(s, 1, 'CB', 1);
    [beside.x, beside.y] = [73, 36.5]; // 길 옆 2.5 m
    const dBehind = carryReachDist(s, behind, o, 76, 34);
    const dBeside = carryReachDist(s, beside, o, 76, 34);
    const O = ENGINE.onball as { carryChase: number };
    const K = O.carryChase;
    try {
      O.carryChase = 0;
      const dBehind0 = carryReachDist(s, behind, o, 76, 34);
      const dBeside0 = carryReachDist(s, beside, o, 76, 34);
      expect(dBehind0).toBeLessThan(3); // 옛 동작: 3 − 0.3 × 최고 속도
      expect(dBehind).toBeGreaterThan(dBehind0);
      expect(dBehind).toBeCloseTo(3 - (ENGINE.onball.carryClose * behind.maxSpeed - K * 6), 5); // 3 − (2.25 − 1.8) ≈ 2.55
      expect(dBeside).toBeCloseTo(dBeside0, 9);
      expect(dBeside0).toBeLessThan(2.5);
    } finally {
      O.carryChase = K;
    }
  });

  it('뒤에서 쫓는 수비 램프: 2 m 뒤(램프 끝) 상대는 몰 거리 몫을 다 덜고, 1 m 뒤는 절반만', () => {
    const s = scene((x) => {
      const o = of(x, 0, 'ST');
      [o.x, o.y] = [70, 34];
      return o;
    });
    const o = s.agents[s.ball.owner]!;
    const behind = of(s, 1, 'CB');
    [behind.x, behind.y] = [68, 34];
    const d2 = carryReachDist(s, behind, o, 76, 34);
    [behind.x, behind.y] = [69, 34];
    const d1 = carryReachDist(s, behind, o, 76, 34);
    const O = ENGINE.onball as { carryChase: number };
    const K = O.carryChase;
    const close = ENGINE.onball.carryClose * behind.maxSpeed;
    try {
      O.carryChase = 0;
      const d0 = carryReachDist(s, behind, o, 76, 34);
      expect(d2).toBeGreaterThan(d0);
      expect(d2).toBeCloseTo(Math.max(0, 2 - (close - K * 6)), 5); // 2 m 뒤 = 램프 끝: 몰 거리 6 m × 0.3 을 다 덜어 낸다
      expect(d1).toBeCloseTo(Math.max(0, 1 - (close - K * 6 * 0.5)), 5); // 1 m 뒤 = 절반
    } finally {
      O.carryChase = K;
    }
  });

  it('레버가 실제로 걸린다: 두 레버를 끄면 게겐 대 균형 경기가 달라지고, 같은 설정은 결정적', () => {
    const on1 = run('gegenpress', 'balanced', 41007);
    const on2 = run('gegenpress', 'balanced', 41007);
    expect(on1).toBe(on2);
    const O = ENGINE.onball as { carryChase: number }, R = ENGINE.receive as { runOnTouch: number };
    const K = O.carryChase, T = R.runOnTouch;
    try {
      O.carryChase = 0;
      R.runOnTouch = 0;
      const off = run('gegenpress', 'balanced', 41007);
      expect(off).not.toBe(on1);
    } finally {
      O.carryChase = K;
      R.runOnTouch = T;
    }
  });
});
