// 도감 번호 이어 붙이기 (C.75t): src/photocards.ts dexCandidates() 의 실제 선수 중 아직 번호가 없는 선수를 규칙대로 정렬해
// data/players/photoDex.ts 의 DEX_IDS 뒤에 붙이고, 새 고정 확인(DEX_LOCKS)을 하나 더한다. 기존 번호는 바꾸지 않는다.
// 실행: npm run dex:append   (선수 데이터를 더한 세션이 실행해 같이 커밋한다)

import { readFileSync, writeFileSync } from 'node:fs';
import { DEX_IDS, DEX_LOCKS } from '../data/players/photoDex';
import { dexAppend, dexCandidates, dexHash } from '../src/photocards';

const FILE = new URL('../data/players/photoDex.ts', import.meta.url);
const next = dexAppend(DEX_IDS, dexCandidates());
const added = next.length - DEX_IDS.length;
if (!added) {
  console.log(`새 선수 없음 (도감 ${DEX_IDS.length}명)`);
} else {
  const locks = [...DEX_LOCKS.map(([n, h]) => [n, h] as const), [next.length, dexHash(next)] as const];
  const src = readFileSync(FILE, 'utf8');
  const ids = `export const DEX_IDS: readonly string[] = [\n${next.map((id, i) => `  '${id}', // ${i + 1}`).join('\n')}\n];`;
  const lk = `export const DEX_LOCKS: readonly (readonly [number, string])[] = [\n${locks.map(([n, h]) => `  [${n}, '${h}'],`).join('\n')}\n];`;
  const out = src
    .replace(/export const DEX_IDS: readonly string\[\] = \[[\s\S]*?\n\];/, ids)
    .replace(/export const DEX_LOCKS: readonly \(readonly \[number, string\]\)\[\] = \[[\s\S]*?\n\];/, lk);
  writeFileSync(FILE, out);
  console.log(`도감 ${DEX_IDS.length} → ${next.length}명 (+${added}): No.${DEX_IDS.length + 1} ${next[DEX_IDS.length]} … No.${next.length} ${next[next.length - 1]}`);
}
