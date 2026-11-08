// @ts-nocheck — C.81s: 장면 ④ 1대1 골 (saveBase·drop 후보). 실행: npx vite-node scripts/diag/c81s-scene4.ts -- 1.96:0.35 1.97:0.36 …
import { ENGINE } from '../../src/engine/config';
import { sceneKeeper } from '../../tests/scenes/scenes';
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  const [sb, dr] = a.split(':').map(Number);
  ENGINE.keeper.saveBase = sb; ENGINE.keeper.oneOnOne.drop = dr;
  const v = sceneKeeper().values ?? sceneKeeper();
  console.log(a, JSON.stringify(v).slice(0, 400));
}
