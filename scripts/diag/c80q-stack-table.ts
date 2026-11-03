// @ts-nocheck — 진단 (C.80q): 공격 몰빵 억제 배수가 어떤 대형에 걸리는지 표 — 표준 대형 · custom-sweep 무작위 대형 300 · 실제 로스터 팀
// 실행: npx vite-node scripts/diag/c80q-stack-table.ts
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customLabel, customProblem, customSlots, FORMATION_SLOTS, FORMATIONS, GRID_LANES, GRID_ROWS } from '../../src/formations';
import { stackCount, stackMul } from '../../src/engine/stack';
import { ENGINE } from '../../src/engine/config';

console.log(`stackCap n=${ENGINE.stackCap.n} k=${ENGINE.stackCap.k}`);
console.log('| 표준 대형 | 공격 포지션 | 배수 |\n|---|---|---|');
for (const f of FORMATIONS) {
  const ps = FORMATION_SLOTS[f].map((s) => s.pos);
  console.log(`| ${f} | ${stackCount(ps)} | ${stackMul(ps)} |`);
}
function randomCells(i) {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) {
    const pool = [...all];
    const cells = [-1];
    for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    if (!customProblem(cells)) return cells;
  }
}
const hist = {};
const hit = [];
for (let i = 0; i < 300; i++) {
  const c = randomCells(i);
  const ps = customSlots(c).map((s) => s.pos);
  const n = stackCount(ps);
  hist[n] = (hist[n] ?? 0) + 1;
  if (stackMul(ps) < 1 || i === 35) hit.push(`${i} ${customLabel(c)} [${ps.slice(1).join(' ')}] 공격 ${n} × ${stackMul(ps).toFixed(2)}`);
}
console.log('\n무작위 커스텀 300 공격 포지션 분포', JSON.stringify(hist));
console.log(hit.slice(0, 40).join('\n'));
// 실제 로스터 팀은 프리셋 대형만 쓴다(roster.formation ∈ FORMATIONS, customSlots 는 내 팀 전술에서만) → 위 표준 표가 곧 로스터 표
