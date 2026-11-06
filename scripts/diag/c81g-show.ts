// @ts-nocheck — 진단 (C.81g): custom-sweep 번호 대형의 슬롯 포지션·초과 m
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customLabel, customProblem, customSlots, GRID_LANES, GRID_ROWS } from '../../src/formations';
import { stackOver, stackCount } from '../../src/engine/stack';
function randomCells(i) {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) { const pool = [...all]; const cells = [-1]; for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]); if (!customProblem(cells)) return cells; }
}
for (const id of (process.env.IDS ?? '91').split(',')) { const c = randomCells(+id); const sl = customSlots(c); console.log(id, customLabel(c), 'm', stackOver(sl.map((s) => s.pos)), 'att', stackCount(sl.map((s) => s.pos)), sl.map((s) => `${s.pos}(${s.x.toFixed(2)},${s.y.toFixed(2)})`).join(' ')); }
