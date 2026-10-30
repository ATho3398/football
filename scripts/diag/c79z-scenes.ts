// 진단 (엔진관리자22 c79z): 장면 ④(keeper)·⑬(runIn) 을 테스트와 같은 모드로 돌려 값·판정을 출력. 경로=값 덮어쓰기 (전역)
// 실행: npx vite-node scripts/diag/c79z-scenes.ts -- [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { SCENES, type SceneId } from '../../tests/scenes/scenes';
import { TARGETS } from '../../tests/scenes/targets';
import { KEEPER_OFF, KEEPER_ON, MOTION_OFF, MOTION_ON, RECEIVE_OFF, RECEIVE_ON, TOUCH_ON, TRANSITION_OFF, TRANSITION_ON, withEngine } from '../../tests/scenes/harness';
const kvs = process.argv.slice(2).filter((a) => a.includes('='));
for (const a of kvs) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path[path.length - 1]!] = Number(v);
}
const ids = (process.env.SCENES ?? 'keeper,runIn').split(',') as SceneId[];
console.log(`덮어쓰기 ${kvs.join(' ') || '없음'}`);
for (const id of ids) {
  const t = TARGETS[id];
  const modes: [string, Record<string, number>][] = t.touch
    ? [['on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON, ...TRANSITION_ON, ...TOUCH_ON }], ['off', { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF, ...TRANSITION_OFF, ...TOUCH_ON }]]
    : t.xyz ? [['on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON, ...TRANSITION_ON }], ['off', { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF, ...TRANSITION_ON }]]
    : t.both ? [['on', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON }], ['off', { ...MOTION_OFF, ...RECEIVE_ON, ...KEEPER_ON }]] : [['', { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON }]];
  for (const [label, over] of modes) {
    const out = withEngine(over, SCENES[id]);
    const ok = out.sane && (t.check?.(out.values) ?? true);
    const keys = id === 'keeper' ? ['centerSave', 'asideSave', 'slowSave', 'fastSave', 'emptyGoal', 'oneOnOneGoal', 'crowdGoal'] : Object.keys(out.values);
    console.log(`${id} ${label} ${ok ? '✓' : '✗'} ${keys.map((k) => `${k}=${Number(out.values[k]).toFixed(3)}`).join(' ')}`);
  }
}
process.exit(0);
