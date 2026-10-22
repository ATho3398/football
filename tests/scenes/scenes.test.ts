// 기준 장면 (C.77w, 공통 규칙 로드맵 1단계): 지금 값을 출력·기록하고, targets.ts 에서 켠 장면만 목표를 판정한다 (C.77x: 이동 상수 켬)
import { describe, expect, it } from 'vitest';
import { SCENES, type SceneId } from './scenes';
import { TARGETS } from './targets';
import { MOTION_ON, withEngine } from './harness';

describe('기준 장면', () => {
  for (const id of Object.keys(SCENES) as SceneId[]) {
    it(`${TARGETS[id].goal}`, () => {
      // C.77x: 새 동작 상수는 켠 상태로 (설정이 꺼져 있어도)
      const out = withEngine(MOTION_ON, SCENES[id]);
      console.log(`[scene ${id}] ${Object.entries(out.values).map(([k, v]) => `${k}=${Number.isFinite(v) ? v.toFixed(3) : v}`).join(' ')}`);
      expect(out.sane).toBe(true);
      for (const v of Object.values(out.values)) expect(Number.isNaN(v)).toBe(false);
      const t = TARGETS[id];
      if (t.enabled) expect(t.check?.(out.values)).toBe(true);
    });
  }
});
