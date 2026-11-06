// C.81q: 전부 엔진 저장본(c81m-run all) 이력서 풀을 c81q-quick.ts 와 같은 모양 JSON 으로 (내 리그 뺀 리그만 — 같은 시드 빠른 진행과 같은 선수 풀)
// 실행: npx vite-node scripts/diag/c81q-engine.ts -- <snapDir> [maxSeason=0] [withMine=0]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes } from '../../src/awards';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const maxS = Number(args[1] ?? 0);
const withMine = args[2] === '1';
const out: { pid: string; s: number; my: string; rs: { lg: string; group: string; goals: number; assists: number }[] }[] = [];
for (const f of readdirSync(dir).filter((f) => /^all-.*-s\d+\.json$/.test(f)).sort()) {
  const m = /^all-(\w+?)-(\w+)-s(\d+)\.json$/.exec(f)!;
  const s = Number(m[3]);
  if (s > maxS) continue;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  out.push({ pid: m[1]!, s, my, rs: buildResumes(g).filter((x) => !x.me && (withMine || x.lg !== my)).map((x) => ({ lg: x.lg, group: x.group, goals: x.goals, assists: x.assists })) });
}
console.log(JSON.stringify(out));
