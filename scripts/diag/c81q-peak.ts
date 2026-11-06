// C.81q: 실제 선수 정점 여지 (balance.ts [D.6/D.7] 와 같은 커리어 명세) — 한 선수 또는 전체. 실행: npx vite-node scripts/diag/c81q-peak.ts -- [id,...]
import { runCareerJob } from '../balance/career';
import { selectableRealPlayers } from '../../src/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const ALL = selectableRealPlayers().map((d) => d.id);
const sh = /^(\d+)\/(\d+)$/.exec(args[0] ?? '');
const ids = sh ? ALL.filter((_, i) => i % Number(sh[2]) === Number(sh[1])) : args[0] ? args[0].split(',') : ALL;
const all = selectableRealPlayers();
let inRange = 0;
for (const id of ids) {
  const d = all.find((x) => x.id === id)!;
  const deltas: number[] = [];
  let room = 0;
  for (let i = 0; i < 6; i++) {
    const r = runCareerJob({ kind: 'real', id, seed: `real-all-${id}-${i}`, i, strategy: 'best', policy: 'stay', coach: 'none', spend: false, records: false, national: false } as never);
    room = r.peakRoom;
    deltas.push(Math.max(...Object.values(r.ovrByAge)) - r.startOvr);
  }
  const delta = deltas.reduce((t, x) => t + x, 0) / deltas.length;
  const ok = Math.abs(delta - room) <= 1.5;
  if (ok) inRange++;
  console.log(`${id} ${2018 - d.birthYear}세 목표 +${room} 결과 +${delta.toFixed(2)} ${ok ? '✓' : '✗'} [${deltas.map((x) => x.toFixed(1)).join(' ')}]`);
}
console.log(`${inRange}/${ids.length}`);
