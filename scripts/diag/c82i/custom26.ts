// C.82i: 커스텀 #26 2-4-1-3 슬롯 x·최전방 인원
import { createRng, hashSeed } from '../../../src/rng';
import { GRID_LANES, GRID_ROWS, cellExists, customProblem, customLabel, customSlots } from '../../../src/formations';
function randomCells(i: number): number[] {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) { const pool = [...all]; const cells = [-1]; for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!); if (!customProblem(cells)) return cells; }
}
const c = randomCells(26);
console.log(customLabel(c));
const sl = (customSlots as any)(c);
console.log(sl.map((s: any) => `${s.pos}:${s.x.toFixed(2)}`).join(' '));
