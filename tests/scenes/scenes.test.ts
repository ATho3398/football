// 기준 장면 (C.77w, 공통 규칙 로드맵 1단계): 지금 값을 출력·기록하고, targets.ts 에서 켠 장면만 목표를 판정한다
import { describe, expect, it } from 'vitest';
import { SCENES, type SceneId } from './scenes';
import { TARGETS } from './targets';

describe('기준 장면', () => {
  for (const id of Object.keys(SCENES) as SceneId[]) {
    it(`${TARGETS[id].goal}`, () => {
      const out = SCENES[id]();
      console.log(`[scene ${id}] ${Object.entries(out.values).map(([k, v]) => `${k}=${Number.isFinite(v) ? v.toFixed(3) : v}`).join(' ')}`);
      expect(out.sane).toBe(true);
      for (const v of Object.values(out.values)) expect(Number.isNaN(v)).toBe(false);
      const t = TARGETS[id];
      if (t.enabled) expect(t.check?.(out.values)).toBe(true);
    });
  }
});
