// 세이브 크기·시간 측정 (부록 C.41, 25.4): 3시즌을 전체 엔진(내 경기 + 다른 경기)으로 돌리며 시즌마다 압축 세이브 크기와 저장·불러오기 시간을 잰다.
// 사용: npx vite-node scripts/c41-save-size.ts [-- quick]  (quick = 다른 경기를 빠른 경기로)
import { newGame, playOthers, playRound, startNextSeason, endDay, isMatchDay } from '../src/game';
import { autoAllocate } from '../src/growth';
import { packState, serialize, deserialize } from '../src/save';
import { decompress } from '../src/saveStore';

const quick = process.argv.includes('quick');
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c41-size', difficulty: 'normal' });
const sizes: string[] = [];
for (let season = 0; season < 3; season++) {
  const t0 = Date.now();
  while (g.phase === 'season') {
    while (!isMatchDay(g)) { playOthers(g, quick ? 'quick' : 'engine'); endDay(g); }
    playRound(g, { others: quick ? 'quick' : 'engine' });
    autoAllocate(g.player);
  }
  const s0 = performance.now();
  const packed = await packState(g);
  const saveMs = performance.now() - s0;
  const l0 = performance.now();
  deserialize(await decompress(packed.data));
  const loadMs = performance.now() - l0;
  sizes.push(`${g.league.season} 시즌 끝: JSON ${(packed.raw / 1024).toFixed(0)} KB → gzip ${(packed.data.length / 1024).toFixed(0)} KB · 저장(직렬화+압축) ${saveMs.toFixed(0)} ms · 불러오기(풀기+변환+로스터 재생성) ${loadMs.toFixed(0)} ms · 시즌 계산 ${((Date.now() - t0) / 1000).toFixed(0)}초`);
  console.log(sizes.at(-1));
  startNextSeason(g);
}
const parts = JSON.parse(serialize(g));
const kb = (x: unknown) => (JSON.stringify(x).length / 1024).toFixed(0);
console.log(`구성 (KB, 압축 전): archive ${kb(parts.archive)} (시즌당 ${(JSON.stringify(parts.archive).length / 1024 / parts.archive.length).toFixed(0)}) · league ${kb(parts.league)} · npcs ${kb(parts.npcs)} · player ${kb(parts.player)} · cards ${kb(parts.cards)} · training ${kb(parts.training)}`);
