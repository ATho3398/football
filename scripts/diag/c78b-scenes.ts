// 진단 (C.78b): 장면 ⑫⑬⑭ 값을 x·y·z·78a 켬/끔 × 수신(78b) 켬/끔 네 가지로 찍는다 (테스트는 78b 켬만 판정)
import { SCENES } from '../../tests/scenes/scenes';
import { KEEPER_OFF, KEEPER_ON, MOTION_OFF, MOTION_ON, RECEIVE_OFF, RECEIVE_ON, TOUCH_OFF, TOUCH_ON, TRANSITION_ON, withEngine } from '../../tests/scenes/harness';
const T_OFF = Object.fromEntries(Object.keys(TRANSITION_ON).map((k) => [k, 0]));
const XON = { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON, ...TRANSITION_ON };
const XOFF = { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF, ...T_OFF };
const ids = (process.argv.slice(2).filter((a) => a !== '--').length ? process.argv.slice(2).filter((a) => a !== '--') : ['oneTwo', 'runIn', 'backPress']) as (keyof typeof SCENES)[];
for (const id of ids) for (const [lx, x] of [['xyz·78a on', XON], ['xyz·78a off', XOFF]] as const) for (const [lt, tr] of [['78b on', TOUCH_ON], ['78b off', TOUCH_OFF]] as const) {
  const out = withEngine({ ...x, ...tr }, SCENES[id]);
  console.log(`${id} [${lx}, ${lt}] ${Object.entries(out.values).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(' ')} sane=${out.sane}`);
}
