// C.78w 2단 체력 (사용자 제안 "피파식"): 순간 체력(연속 질주 12~13초 뒤 바닥 → 러닝 상한, 쉬면 다시 참) + 경기 체력(순간 체력 상한·재충전·가속을 깎음)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { burstCap, burstReady, effectiveAccel, effectiveMax, moveAgent } from '../src/engine/physics';
import type { Agent } from '../src/engine/state';
import { DT, pick, place, sceneState, setBody, speedOf } from './scenes/harness';

const P = ENGINE.physics;

/** 앞 40 m 를 긴급 목표로 둔 채 같은 자리에서 계속 달린다 (위치만 되돌림 — 속도·체력은 그대로). 스프린트 판정 속도 아래로 처음 떨어진 시각(초) */
function sprintUntilSlow(a: Agent, maxT = 30): { tSlow: number; vEnd: number } {
  let tSlow = -1;
  for (let t = 0; t < maxT; t += DT) {
    a.x = 20;
    a.tx = 60;
    a.ty = a.y;
    a.urgent = true;
    moveAgent(a, DT);
    if (t > 3 && tSlow < 0 && speedOf(a) <= a.maxSpeed * P.sprintRatio) tSlow = t;
  }
  return { tSlow, vEnd: speedOf(a) };
}

function runner(stamina = 100, acc = 75, stam = 70): Agent {
  const s = sceneState(1);
  const a = pick(s, 0, 2, 0);
  setBody(a, 80, acc);
  a.attrs = { ...a.attrs, stamina: stam };
  a.stamina = stamina;
  a.burst = burstCap(a);
  place(a, 20, 34, 0, 0);
  a.hx = 1;
  a.hy = 0;
  return a;
}

describe('C.78w 2단 체력', () => {
  it('연속 질주는 12~13초 뒤 감속하고(능력치 10~15초 폭), 바닥이면 러닝 상한(스프린트 판정 아래)', () => {
    const a = runner();
    const { tSlow, vEnd } = sprintUntilSlow(a);
    expect(tSlow).toBeGreaterThan(11);
    expect(tSlow).toBeLessThan(14);
    expect(vEnd).toBeLessThanOrEqual(a.maxSpeed * P.burst.runCap + 1e-3);
    expect(vEnd).toBeLessThan(a.maxSpeed * P.sprintRatio);
    // 가속·체력 능력치 낮음 / 높음
    expect(sprintUntilSlow(runner(100, 45, 45)).tSlow).toBeLessThan(12);
    expect(sprintUntilSlow(runner(100, 95, 95)).tSlow).toBeGreaterThan(13.5);
  });

  it('쉬면 다시 차고, 걷기가 러닝보다 빨리 찬다 (상한까지 수십 초)', () => {
    const rest = (walk: boolean) => {
      const a = runner();
      sprintUntilSlow(a);
      const b0 = a.burst;
      for (let t = 0; t < 10; t += DT) {
        a.x = 20;
        a.tx = walk ? 20 : 60;
        a.urgent = false;
        moveAgent(a, DT);
      }
      return { a, b0, b10: a.burst };
    };
    const w = rest(true);
    const r = rest(false);
    expect(w.b0).toBeLessThan(5);
    expect(w.b10).toBeGreaterThan(w.b0 + 25);
    expect(r.b10).toBeLessThan(w.b10);
    // 다 차는 데 30~45초 근처 (멈춰 서서)
    const a = w.a;
    let t = 10;
    while (a.burst < burstCap(a) - 0.5 && t < 120) {
      a.x = 20;
      a.tx = 20;
      moveAgent(a, DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(25);
    expect(t).toBeLessThan(50);
    // 다시 차면 다시 질주할 수 있다
    expect(sprintUntilSlow(a).tSlow).toBeGreaterThan(8);
  });

  it('경기 체력이 낮으면 순간 체력 상한·가속·연속 질주 시간이 준다', () => {
    const fresh = runner(100);
    const tired = runner(25);
    expect(burstCap(tired)).toBeLessThan(burstCap(fresh) - 25);
    expect(effectiveAccel(tired)).toBeLessThan(effectiveAccel(fresh) * 0.95);
    expect(effectiveMax(tired)).toBeLessThan(effectiveMax(fresh));
    expect(sprintUntilSlow(tired).tSlow).toBeLessThan(sprintUntilSlow(fresh).tSlow - 3);
  });

  it('판단은 자기 순간 체력만 본다: 바닥이면 0, 충분하면 1', () => {
    const a = runner();
    expect(burstReady(a)).toBe(1);
    sprintUntilSlow(a);
    expect(burstReady(a)).toBe(0);
  });
});
