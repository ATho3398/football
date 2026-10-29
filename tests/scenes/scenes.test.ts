// 기준 장면 (C.77w, 공통 규칙 로드맵 1단계): 지금 값을 출력·기록하고, targets.ts 에서 켠 장면만 목표를 판정한다 (C.77x: 이동 상수 켬)
import { describe, expect, it } from 'vitest';
import { SCENES, type SceneId } from './scenes';
import { TARGETS } from './targets';
import { KEEPER_OFF, KEEPER_ON, MOTION_OFF, MOTION_ON, RECEIVE_OFF, RECEIVE_ON, TOUCH_ON, TRANSITION_OFF, TRANSITION_ON, withEngine } from './harness';

describe('기준 장면', () => {
  for (const id of Object.keys(SCENES) as SceneId[]) {
    const t = TARGETS[id];
    // C.77x: 새 동작 상수는 켠 상태로 (설정이 꺼져 있어도). C.77y: 3단계 장면은 이동 제어기 켬/끔 둘 다. C.77z: GK 대응 시간 모델도 켬
    // C.78a: 5단계 장면은 x·y·z 전부 켬 / 전부 끔 둘 다 (전환 상수는 켬)
    // C.78b: 5단계 2차 장면은 x·y·z·78a 전부 켬 / 전부 끔 둘 다 (수신 상수는 켬)
    const modes: [string, Record<string, number>][] = t.touch
      ? [['xyz·78a on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON, ...TRANSITION_ON, ...TOUCH_ON }], ['xyz·78a off', { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF, ...TRANSITION_OFF, ...TOUCH_ON }]]
      : t.xyz
      ? [['xyz on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON, ...TRANSITION_ON }], ['xyz off', { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF, ...TRANSITION_ON }]]
      : t.both ? [['motion on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON }], ['motion off', { ...MOTION_OFF, ...RECEIVE_ON, ...KEEPER_ON }]] : [['', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON }]];
    for (const [label, over0] of modes) {
      // 엔진관리자19: SCENE_OVER="경로=값,경로=값" 환경 변수로 진단 스위치를 얹어 장면을 돌려 본다 (기본 없음 = 그대로)
      const extra = Object.fromEntries((process.env.SCENE_OVER ?? '').split(',').filter((x) => x.includes('=')).map((x) => { const [k, v] = x.split('='); return [k!, Number(v)]; }));
      const over = { ...over0, ...extra };
      it(`${t.goal}${label ? ` [${label}]` : ''}`, () => {
        const out = withEngine(over, SCENES[id]);
        console.log(`[scene ${id}${label ? ` ${label}` : ''}] ${Object.entries(out.values).map(([k, v]) => `${k}=${Number.isFinite(v) ? v.toFixed(3) : v}`).join(' ')}`);
        expect(out.sane).toBe(true);
        for (const v of Object.values(out.values)) expect(Number.isNaN(v)).toBe(false);
        if (t.enabled) expect(t.check?.(out.values)).toBe(true);
      });
    }
  }
});
