// @ts-nocheck C.82g: 장면 ⑬ 값 보기
import { sceneRunIn } from '../../../tests/scenes/receive';
import { ENGINE } from '../../../src/engine/config';
const args = process.argv.slice(2).filter((a) => a !== '--');
for (const a of args) { const [k, v] = a.split('='); const parts = k.split('.'); let o: any = ENGINE; for (const p of parts.slice(0, -1)) o = o[p]; o[parts.at(-1)!] = Number(v); }
console.log(JSON.stringify(sceneRunIn()));
