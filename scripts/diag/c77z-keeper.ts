import { sceneKeeper } from '../../tests/scenes/scenes';
import { KEEPER_ON, MOTION_ON, MOTION_OFF, RECEIVE_ON, withEngine } from '../../tests/scenes/harness';
const extra = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('='); return [k!, Number(v)]; }));
for (const [lab, on] of [['off', {}], ['keeper', KEEPER_ON]] as const)
  for (const [ml, m] of [['mOn', MOTION_ON], ['mOff', MOTION_OFF]] as const) {
    const v = withEngine({ ...m, ...RECEIVE_ON, ...on, ...(lab === 'keeper' ? extra : {}) }, sceneKeeper).values;
    console.log(lab, ml, Object.entries(v).map(([k, x]) => `${k}=${x.toFixed(2)}`).join(' '));
  }
