// C.78n: 레버별 장면 ④·⑬·㉘ 값 (경로=값 덮어쓰기) — npx vite-node scripts/diag/c78n-scenes.ts -- ball.shotSpeed=29 keeper.availRef=0.4 keeper.openSpan=0
import { SCENES } from '../../tests/scenes/scenes';
import { KEEPER_ON, MOTION_ON, RECEIVE_ON, TOUCH_ON, TRANSITION_ON, withEngine } from '../../tests/scenes/harness';
const extra = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('='); return [k!, Number(v)]; }));
const base = { ...MOTION_ON, ...RECEIVE_ON, ...KEEPER_ON };
for (const [id, over] of [['keeper', base], ['runIn', { ...base, ...TRANSITION_ON, ...TOUCH_ON }], ['laneAngle', base]] as const) {
  const out = withEngine({ ...over, ...extra }, SCENES[id as keyof typeof SCENES]);
  console.log(id, Object.entries(out.values).map(([k, v]) => `${k}=${(v as number).toFixed(3)}`).join(' '));
}
