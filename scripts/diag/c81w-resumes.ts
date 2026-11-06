// C.81w: c81q-engine 과 같은 이력서 풀 JSON (PRE=all|mine 저장본, 내 리그 뺌) — 내 리그만 실제 시즌 대 엔진 비교용
// 실행: npx vite-node scripts/diag/c81q-engine.ts -- <snapDir> [maxSeason=0] [withMine=0]
import { readdirSync, readFileSync } from 'node:fs';
import type { GameState } from '../../src/game';
import { buildResumes } from '../../src/awards';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const maxS = Number(args[1] ?? 0);
const withMine = args[2] === '1';
const out: { pid: string; s: number; my: string; rs: { lg: string; group: string; goals: number; assists: number }[] }[] = [];
for (const f of readdirSync(dir).filter((f) => new RegExp(`^${process.env.PRE ?? "all"}-.*-s\\d+\\.json$`).test(f)).sort()) {
  const m = /^(?:all|mine)-(\w+?)-(\w+)-s(\d+)\.json$/.exec(f)!;
  const s = Number(m[3]);
  if (s > maxS) continue;
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  const my = (g.league as { id: string }).id;
  out.push({ pid: m[1]!, s, my, rs: buildResumes(g).filter((x) => !x.me && (withMine || x.lg !== my)).map((x) => ({ lg: x.lg, group: x.group, goals: x.goals, assists: x.assists })) });
}
console.log(JSON.stringify(out));
