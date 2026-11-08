// 진단 (C.78a): 장면 ⑨⑩⑪ 값을 x·y·z 켬/끔 × 전환(78a) 켬/끔 네 가지로 찍는다 (테스트는 78a 켬만 판정)
import { SCENES } from '../../tests/scenes/scenes';
import { KEEPER_OFF, KEEPER_ON, MOTION_OFF, MOTION_ON, RECEIVE_OFF, RECEIVE_ON, TRANSITION_ON, withEngine } from '../../tests/scenes/harness';
const T_OFF = Object.fromEntries(Object.keys(TRANSITION_ON).map((k) => [k, 0]));
const XON = { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON };
const XOFF = { ...MOTION_OFF, ...RECEIVE_OFF, ...KEEPER_OFF };
const ids = (process.argv.slice(2).filter((a) => a !== '--').length ? process.argv.slice(2).filter((a) => a !== '--') : ['pressBreak', 'slowLine', 'allIn']) as (keyof typeof SCENES)[];
for (const id of ids) for (const [lx, x] of [['xyz on', XON], ['xyz off', XOFF]] as const) for (const [lt, tr] of [['78a on', TRANSITION_ON], ['78a off', T_OFF]] as const) {
  const out = withEngine({ ...x, ...tr }, SCENES[id]);
  console.log(`${id} [${lx}, ${lt}] ${Object.entries(out.values).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(' ')} sane=${out.sane}`);
}
