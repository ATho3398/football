// 진단 (부록 C.80s): 같은 대형을 프리셋 경로와 칸(customSlots) 경로로 만들어 균형 4-4-2 상대 득실을 같은 시드로 잰다.
// 실행: npx vite-node scripts/diag/c80s-custom.ts -- [경기=800] [변형,...]   변형: preset | cells | slots:<json 파일>
// FORM=4-4-2 (대형), SEED0=71000
import type { MatchJob, MatchOut, TeamSpec } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { cellSlot, customSlots, FORMATION_SLOTS, presetCells, type Formation } from '../../src/formations';

const args = process.argv.slice(2).filter((x) => x !== '--');
const N = Number(args[0] ?? 800);
const variants = (args[1] ?? 'preset,cells').split(',');
const form = (process.env.FORM ?? '4-4-2') as Formation;
const seed0 = Number(process.env.SEED0 ?? 71000);

function spec(v: string, seed: number): TeamSpec {
  const me = std('a', seed, 75, form, 'balanced');
  if (v === 'preset') return me;
  if (v === 'cells') return { ...me, cells: presetCells(form) };
  if (v === 'exact') return { ...me, slots: FORMATION_SLOTS[form].map((s) => ({ ...s })) };
  // 섞기: 칸 슬롯에서 x 만(presetY) 또는 y 만(presetX) 프리셋 값으로
  const cs = customSlots(presetCells(form));
  if (v === 'presetY') return { ...me, slots: cs.map((s, i) => ({ ...s, y: FORMATION_SLOTS[form][i]!.y })) };
  if (v === 'presetX') return { ...me, slots: cs.map((s, i) => ({ ...s, x: FORMATION_SLOTS[form][i]!.x })) };
  if (v === 'old') return { ...me, slots: presetCells(form).map((c, i) => (i === 0 ? { ...FORMATION_SLOTS[form][0]! } : cellSlot(c))) };
  if (v === 'new') return { ...me, cells: presetCells(form) };
  throw new Error(v);
}
const jobs: MatchJob[] = [];
for (const v of variants) for (let k = 0; k < N; k++) {
  const seed = seed0 + k;
  const me = spec(v, seed);
  const op = std('b', seed, 75, '4-4-2', 'balanced');
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op } : { kind: 'match', seed, neutral: true, home: op, away: me });
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `c80s ${form} ${jobs.length}` });
console.log(`\n${form} 대 균형 4-4-2, ${N}경기, 시드 ${seed0}~`);
console.log('| 변형 | 득점 | 실점 | 득실 | ±SE | 슈팅 | 상대 슈팅 |');
console.log('|---|---|---|---|---|---|---|');
variants.forEach((v, i) => {
  const xs = outs.slice(i * N, (i + 1) * N);
  const gf = xs.map((m, k) => (k % 2 ? m.homeGoals : m.awayGoals));
  const ga = xs.map((m, k) => (k % 2 ? m.awayGoals : m.homeGoals));
  const sh = xs.map((m, k) => m.team[k % 2 ? 0 : 1].shots);
  const osh = xs.map((m, k) => m.team[k % 2 ? 1 : 0].shots);
  const d = gf.map((g, k) => g - ga[k]!);
  const av = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const m = av(d);
  const se = Math.sqrt(d.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1)) / Math.sqrt(N);
  console.log(`| ${v} | ${av(gf).toFixed(3)} | ${av(ga).toFixed(3)} | ${m >= 0 ? '+' : ''}${m.toFixed(3)} | ${se.toFixed(3)} | ${av(sh).toFixed(2)} | ${av(osh).toFixed(2)} |`);
});
// 첫 변형 대비 같은 시드 짝 차이 (짝 SE)
const dOf = (i: number) => outs.slice(i * N, (i + 1) * N).map((m, k) => (k % 2 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals));
const d0 = dOf(0);
variants.slice(1).forEach((v, j) => {
  const dd = dOf(j + 1).map((x, k) => x - d0[k]!);
  const m = dd.reduce((a, b) => a + b, 0) / N;
  const se = Math.sqrt(dd.reduce((a, b) => a + (b - m) ** 2, 0) / (N - 1)) / Math.sqrt(N);
  console.log(`${v} − ${variants[0]}: ${m >= 0 ? '+' : ''}${m.toFixed(3)} ± ${se.toFixed(3)}`);
});
console.log(`걸린 시간 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
process.exit(0);
