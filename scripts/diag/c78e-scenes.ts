// 진단 (C.78e): 장면 ㉑㉒㉓ 값을 찍는다 (설정 그대로 = x~78d 켬). 인자로 장면 id, 경로=값 덮어쓰기
import { SCENES } from '../../tests/scenes/scenes';
import { withEngine } from '../../tests/scenes/harness';
const all = process.argv.slice(2).filter((a) => a !== '--');
const over = Object.fromEntries(all.filter((a) => a.includes('=')).map((a) => { const [k, v] = a.split('='); return [k!, Number(v)]; }));
const ids = (all.filter((a) => !a.includes('=')).length ? all.filter((a) => !a.includes('=')) : ['wideArrive', 'nineFollow', 'nineHold']) as (keyof typeof SCENES)[];
for (const id of ids) {
  const t = Date.now();
  const out = withEngine(over, SCENES[id]);
  console.log(`${id} (${((Date.now() - t) / 1000).toFixed(1)}s) ${Object.entries(out.values).map(([k, v]) => `${k}=${v.toFixed(3)}`).join(' ')} sane=${out.sane}`);
}
