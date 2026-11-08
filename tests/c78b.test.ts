// C.78b 수신·첫 터치 (공통 규칙 로드맵 5단계 2차): 원터치 판단 = 실행 같은 배수, 정지 시간 차등 방향
import { describe, expect, it } from 'vitest';
import { receiveTime } from '../src/engine/core';
import { oneTouchMul, shotModel } from '../src/engine/onball';
import { pick, place, sceneState, withEngine } from './scenes/harness';

describe('C.78b 수신·첫 터치', () => {
  it('원터치 배수: 빠른 공·압박이면 낮고 첫 터치가 좋으면 높다 (otMin~1)', () => {
    const s = sceneState(3);
    const a = pick(s, 0, 3);
    a.attrs = { ...a.attrs, ballControl: 70 };
    const base = oneTouchMul(a, 12, 0);
    expect(oneTouchMul(a, 22, 0)).toBeLessThan(base);
    expect(oneTouchMul(a, 12, 1)).toBeLessThan(base);
    a.attrs = { ...a.attrs, ballControl: 90 };
    expect(oneTouchMul(a, 12, 0)).toBeGreaterThan(base);
    expect(oneTouchMul(a, 40, 1)).toBeGreaterThanOrEqual(0.6 - 1e-12);
  });

  it('원터치 슛: 실행 중(otUntil 전) shotModel 이 원터치 배수를 곱한다 (판단과 같은 식), 지나면 그대로', () => {
    const s = sceneState(3);
    const a = pick(s, 0, 3);
    place(a, 90, 34);
    const p0 = shotModel(s, a).pOn;
    a.otMul = 0.8;
    a.otUntil = s.t + 0.25;
    const p1 = shotModel(s, a).pOn;
    // 원터치 배수는 마무리 배수 뒤·1대1 상황 보너스 앞에 곱한다 → 보통 × 0.8 이상, 보통 미만
    expect(p1).toBeGreaterThanOrEqual(p0 * 0.8 - 1e-12);
    expect(p1).toBeLessThan(p0);
    a.otUntil = s.t - 0.1;
    expect(shotModel(s, a).pOn).toBe(p0);
  });

  it('정지 시간: 등지고·압박·빠른 공이면 길고, 앞 보고·자유·좋은 첫 터치면 짧다 (min~max)', () => {
    withEngine({ 'receive.timeModel': 1 }, () => {
      const s = sceneState(3);
      const a = pick(s, 0, 3);
      const d = pick(s, 1, 1);
      a.attrs = { ...a.attrs, ballControl: 85 };
      place(a, 70, 34);
      place(d, 90, 34);
      const free = receiveTime(s, a, 12, false);
      place(d, 71.2, 34);
      a.attrs = { ...a.attrs, ballControl: 60 };
      const hard = receiveTime(s, a, 22, true);
      expect(hard).toBeGreaterThan(free + 0.3);
      expect(free).toBeGreaterThanOrEqual(0.3);
      expect(hard).toBeLessThanOrEqual(1.1);
    });
  });
});
