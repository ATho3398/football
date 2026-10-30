// @ts-nocheck — 진단 (C.80c): 장면 ⑨ 값, 게겐 마크 켬/끔
import { scenePressBreak } from '../../tests/scenes/transition';
import { TENDENCY } from '../../src/engine/tactics';
for (const n of [6, 0]) { TENDENCY.gegenMarkN = n; console.log('gegenMarkN', n, JSON.stringify(scenePressBreak().values)); }
process.exit(0);
