// 진단 (부록 C.82a): 대형 대 대형 득실 — 프리셋 이름(4-3-1-2), 칸 경로 프리셋(c:4-3-1-2), 무작위 커스텀 번호(custom-sweep 와 같은 생성, 예 80)
// 실행: PAIRS="80:4-4-2,119:4-4-2" SEED0=71000 npx vite-node scripts/diag/c82a-forms.ts -- [경기=400] [경로=값 ...]
//   PAIRS 대신 FORMS="80,119" OPP=4-4-2 도 된다. STDMAT=1 이면 표준 대형 상호 표(4-4-2·4-3-3·4-2-3-1·3-5-2·5-3-2·4-3-1-2·4-1-4-1·3-4-3).
import type { MatchJob, MatchOut, TeamSpec } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { createRng, hashSeed } from '../../src/rng';
import { type Formation, FORMATIONS, cellExists, customLabel, customProblem, GRID_LANES, GRID_ROWS, presetCells } from '../../src/formations';

const nums: number[] = [];
const overrides: Record<string, number> = {};
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else nums.push(Number(a));
}
const [R = 400] = nums;
const SEED0 = Number(process.env.SEED0 ?? 71000);

function randomCells(i: number): number[] {
  const rng = createRng(hashSeed(`custom-sweep:${i}`));
  const all = Array.from({ length: GRID_ROWS * GRID_LANES }, (_, c) => c).filter(cellExists);
  for (;;) {
    const pool = [...all];
    const cells = [-1];
    for (let k = 0; k < 10; k++) cells.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
    if (!customProblem(cells)) return cells;
  }
}

function spec(id: string, side: string, seed: number): TeamSpec {
  if (/^\d+$/.test(id)) return { ...std(side, seed, 75, '4-4-2', 'balanced'), cells: randomCells(Number(id)) };
  if (id.startsWith('c:')) return { ...std(side, seed, 75, '4-4-2', 'balanced'), cells: presetCells(id.slice(2) as Formation) };
  return std(side, seed, 75, id as Formation, 'balanced');
}
function label(id: string): string {
  if (/^\d+$/.test(id)) return `#${id} ${customLabel(randomCells(Number(id)))}`;
  return id;
}

let pairs: [string, string][] = [];
if (process.env.STDMAT) {
  const F = (process.env.STDMAT === '1' ? [...FORMATIONS] : process.env.STDMAT.split(',')) as string[];
  for (let i = 0; i < F.length; i++) for (let j = i + 1; j < F.length; j++) pairs.push([F[i]!, F[j]!]);
} else if (process.env.PAIRS) pairs = process.env.PAIRS.split(',').map((p) => p.split(':') as [string, string]);
else pairs = (process.env.FORMS ?? '80,119,26').split(',').map((f) => [f, process.env.OPP ?? '4-4-2']);

const jobs: MatchJob[] = [];
for (const [a, b] of pairs) for (let k = 0; k < R; k++) {
  const seed = SEED0 + k;
  const me = spec(a, 'a', seed);
  const op = spec(b, 'b', seed);
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides });
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `대형 ${pairs.length}쌍 × ${R}` });
console.log(`\n덮어쓰기 ${JSON.stringify(overrides)} · 시드 ${SEED0} · ${R}경기`);
console.log('| 대형 | 상대 | 득실 | ±SE | 득점 | 실점 | 슈팅 | 상대 슈팅 |');
console.log('|---|---|---|---|---|---|---|---|');
const res: Record<string, number> = {};
pairs.forEach(([a, b], i) => {
  const xs = outs.slice(i * R, (i + 1) * R);
  const gf = xs.map((m, k) => (k % 2 ? m.homeGoals : m.awayGoals));
  const ga = xs.map((m, k) => (k % 2 ? m.awayGoals : m.homeGoals));
  const sh = xs.map((m, k) => m.team[k % 2 ? 0 : 1]!.shots);
  const osh = xs.map((m, k) => m.team[k % 2 ? 1 : 0]!.shots);
  const d = gf.map((g, k) => g - ga[k]!);
  const avg = (v: number[]) => v.reduce((x, y) => x + y, 0) / R;
  const gd = avg(d);
  const sd = Math.sqrt(d.reduce((x, y) => x + (y - gd) ** 2, 0) / (R - 1));
  res[`${a}:${b}`] = gd;
  console.log(`| ${label(a)} | ${label(b)} | ${gd >= 0 ? '+' : ''}${gd.toFixed(3)} | ${(sd / Math.sqrt(R)).toFixed(3)} | ${avg(gf).toFixed(2)} | ${avg(ga).toFixed(2)} | ${avg(sh).toFixed(1)} | ${avg(osh).toFixed(1)} |`);
});
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(res, null, 1));
console.log(`걸린 시간 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
process.exit(0);
