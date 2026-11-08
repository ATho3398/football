// C.75m 다른 리그 빠른 시뮬 비용: 고른 리그 8개를 2시즌(하루씩) 진행하는 데 드는 시간만 잰다
import { createLeague } from '../../src/league';
import { addDays } from '../../src/calendar';
import { syncOtherLeagues, type OtherLeague } from '../../src/otherLeagues';
import { registerFakeLeagues } from './c75m-fake-leagues';

const ids = registerFakeLeagues();
const st = { worldSeed: 'c75m-speed', otherLeagues: ids.map((id) => createLeague('c75m-speed', 2018, id)) as OtherLeague[] };
let d = '2018-08-01';
const t0 = performance.now();
let n = 0;
for (let k = 0; k < 730; k++) { n += syncOtherLeagues(st, d); d = addDays(d, 1); }
const ms = performance.now() - t0;
console.log(`리그 ${ids.length}개 · 730일 · 경기 ${n} · ${ms.toFixed(0)} ms (하루 ${(ms / 730).toFixed(2)} ms, 시즌 약 ${(ms / 2).toFixed(0)} ms)`);
