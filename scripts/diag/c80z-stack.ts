// @ts-nocheck — 진단 (C.80z): 공격 몰빵 대형 득실 재측정 — 대형별 × 상대(칸 4-4-2 · 기본 4-4-2) × 시드
// 실행: IDS=35,25,58,174,199,220 R=800 SEEDS=71000,81000 OPP=both npx vite-node scripts/diag/c80z-stack.ts -- [경로=값 ...]
//       SWEEP=300 M=20 (무작위 커스텀 중 몰빵(초과>0)만 M 경기씩, 상대 둘 다) — 평균·상위
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customLabel, customProblem, customSlots, GRID_LANES, GRID_ROWS, presetCells } from '../../src/formations';
import { stackOver } from '../../src/engine/stack';

const overrides: Record<string, number> = {};
for (const a of process.argv.slice(2).filter((x) => x !== '--')) if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
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
const cellsOf = (id) => (id === 'base' ? presetCells('4-4-2') : randomCells(Number(id)));
const opps = (process.env.OPP ?? 'both') === 'both' ? ['custom', 'base'] : [process.env.OPP];
const seeds = (process.env.SEEDS ?? '71000').split(',').map(Number);

async function play(ids, R, label) {
  const jobs = [];
  const keys = [];
  for (const id of ids) for (const opp of opps) for (const s0 of seeds) {
    keys.push({ id, opp, s0 });
    for (let k = 0; k < R; k++) {
      const seed = s0 + k;
      const me = { ...std('a', seed, 75, '4-4-2', 'balanced'), cells: cellsOf(id) };
      const op = { ...std('b', seed, 75, '4-4-2', 'balanced'), ...(opp === 'custom' ? { cells: presetCells('4-4-2') } : {}) };
      jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides });
    }
  }
  const outs = await runJobs<MatchOut>(jobs, { label });
  return keys.map((key, i) => {
    const xs = outs.slice(i * R, (i + 1) * R);
    const gf = xs.map((m, k) => (k % 2 ? m.homeGoals : m.awayGoals));
    const ga = xs.map((m, k) => (k % 2 ? m.awayGoals : m.homeGoals));
    const d = gf.map((g, k) => g - ga[k]);
    const gd = d.reduce((a, b) => a + b, 0) / R;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - gd) ** 2, 0) / Math.max(1, R - 1));
    return { ...key, gd, se: sd / Math.sqrt(R), gf: gf.reduce((a, b) => a + b, 0) / R, ga: ga.reduce((a, b) => a + b, 0) / R };
  });
}
const f = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(2)}`;
const t0 = Date.now();
console.log(`덮어쓰기 ${JSON.stringify(overrides)}`);
if (process.env.SWEEP) {
  const N = Number(process.env.SWEEP), M = Number(process.env.M ?? 20);
  const ids = [];
  for (let i = 0; i < N; i++) if (stackOver(customSlots(randomCells(i)).map((s) => s.pos)) > 0) ids.push(String(i));
  const rs = await play(ids, M, `몰빵 훑기 ${ids.length}×${opps.length}×${M}`);
  for (const opp of opps) {
    const xs = rs.filter((r) => r.opp === opp).sort((a, b) => b.gd - a.gd);
    const mean = xs.reduce((a, r) => a + r.gd, 0) / xs.length;
    console.log(`\n상대 ${opp}: 몰빵 ${xs.length}개 평균 ${f(mean)} · > −0.3 ${xs.filter((r) => r.gd > -0.3).length} · > 0 ${xs.filter((r) => r.gd > 0).length}`);
    console.log('상위 12:', xs.slice(0, 12).map((r) => `${r.id} ${customLabel(randomCells(+r.id))} m${stackOver(customSlots(randomCells(+r.id)).map((s) => s.pos))} ${f(r.gd)}`).join(' · '));
  }
} else {
  const ids = (process.env.IDS ?? '35').split(',');
  const R = Number(process.env.R ?? 800);
  const rs = await play(ids, R, `몰빵 ${ids.length}×${opps.length}×${seeds.length}×${R}`);
  console.log('| 대형 | 초과 | 상대 | 시드 | 득실 | ±SE | 득점 | 실점 |\n|---|---|---|---|---|---|---|---|');
  for (const r of rs) {
    const c = cellsOf(r.id);
    console.log(`| ${r.id} ${customLabel(c)} | ${stackOver(customSlots(c).map((s) => s.pos))} | ${r.opp} | ${r.s0} | ${f(r.gd)} | ${r.se.toFixed(2)} | ${r.gf.toFixed(2)} | ${r.ga.toFixed(2)} |`);
  }
}
console.log(`걸린 시간 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
process.exit(0);
