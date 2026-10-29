// C.79q 53단계: 슛 발 판정 — 공격 방향 가로 부호 대신 몸 방향 기준 + 시간이 있으면 주발로 옮겨 찬다 (인버티드 윙어의 감아 차기)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { bodyMods, shotFootMul, shotWeakShare } from '../src/body';

const left = bodyMods({ height: 178, weight: 72, foot: 'left', weakFoot: 1 });
const right = bodyMods({ height: 178, weight: 72, foot: 'right', weakFoot: 1 });
// 공격 방향 +x, y 는 공격 방향 왼쪽이 0. 오른쪽 측면(y 50)에서 골(105, 34) 파 포스트(y 31) 쪽으로 15 m 앞
const dx = 15;
const dy = 31 - 50;

describe('슛 발 판정 (C.79q)', () => {
  it('안으로 치고 들어오는(몸 방향 −y) 오른쪽 왼발잡이는 파 포스트를 주발로 — 급해도 약발 아님', () => {
    expect(shotWeakShare(left, 0, -1, dx, dy, 1)).toBe(0);
    expect(shotFootMul(left, 0, -1, dx, dy, 1)).toBe(1);
  });
  it('골라인 쪽으로 달리며(몸 방향 +x) 원터치로 차면 오른발이 필요 — 왼발잡이는 약발, 오른발잡이는 그대로', () => {
    expect(shotWeakShare(left, 1, 0, dx, dy, 1, true)).toBeGreaterThan(0.9);
    expect(shotFootMul(left, 1, 0, dx, dy, 1, true)).toBeLessThan(0.8);
    expect(shotWeakShare(right, 1, 0, dx, dy, 1, true)).toBe(0);
  });
  it('발밑 공(원터치 아님)은 주발 인사이드로 몸 반대쪽까지 감아 차 — 같은 급함에서 약발 몫이 원터치보다 작다', () => {
    const ot = shotWeakShare(left, 1, 0, dx, dy, 1, true);
    const feet = shotWeakShare(left, 1, 0, dx, dy, 1);
    expect(feet).toBeLessThan(ot);
    // 몸 정면에서 조금 비켜 차는 공(가로 sin ≈ 0.4)은 발밑이면 약발 아님, 원터치면 약발
    expect(shotWeakShare(left, 1, 0, 20, -9, 1)).toBe(0);
    expect(shotWeakShare(left, 1, 0, 20, -9, 1, true)).toBeGreaterThan(0);
  });
  it('시간이 있으면(급함 0) 공을 주발 쪽으로 옮겨 약발 몫이 shotSet 만큼 준다', () => {
    const hurry = shotWeakShare(left, 1, 0, dx, dy, 1, true);
    const calm = shotWeakShare(left, 1, 0, dx, dy, 0, true);
    expect(calm).toBeCloseTo(hurry * (1 - BALANCE.body.shotSet), 6);
  });
  it('몸 뒤쪽으로 차면 완전히 돌아 차야 한다 (가로 1)', () => {
    expect(shotWeakShare(left, -1, 0.05, 15, 1, 1, true)).toBe(1);
    expect(shotWeakShare(left, -1, 0.05, 15, 1, 1)).toBe(1);
  });
  it('약발 5 는 언제나 1', () => {
    expect(shotFootMul({ ...left, weakFoot: 5 }, 1, 0, dx, dy, 1)).toBe(1);
  });
});
