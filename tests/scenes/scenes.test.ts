// 기준 장면 (C.77w, 공통 규칙 로드맵 1단계): 지금 값을 출력·기록하고, targets.ts 에서 켠 장면만 목표를 판정한다 (C.77x: 이동 상수 켬)
import { describe, expect, it } from 'vitest';
import { SCENES, type SceneId } from './scenes';
import { TARGETS } from './targets';
import { KEEPER_ON, MOTION_OFF, MOTION_ON, RECEIVE_ON, withEngine } from './harness';

describe('기준 장면', () => {
  for (const id of Object.keys(SCENES) as SceneId[]) {
    const t = TARGETS[id];
    // C.77x: 새 동작 상수는 켠 상태로 (설정이 꺼져 있어도). C.77y: 3단계 장면은 이동 제어기 켬/끔 둘 다. C.77z: GK 대응 시간 모델도 켬
    const modes: [string, Record<string, number>][] = t.both ? [['motion on', MOTION_ON], ['motion off', MOTION_OFF]] : [['', MOTION_ON]];
    for (const [label, motion] of modes) {
      it(`${t.goal}${label ? ` [${label}]` : ''}`, () => {
        const out = withEngine({ ...motion, ...RECEIVE_ON, ...KEEPER_ON }, SCENES[id]);
        console.log(`[scene ${id}${label ? ` ${label}` : ''}] ${Object.entries(out.values).map(([k, v]) => `${k}=${Number.isFinite(v) ? v.toFixed(3) : v}`).join(' ')}`);
        expect(out.sane).toBe(true);
        for (const v of Object.values(out.values)) expect(Number.isNaN(v)).toBe(false);
        if (t.enabled) expect(t.check?.(out.values)).toBe(true);
      });
    }
  }
});
