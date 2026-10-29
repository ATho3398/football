// 진단 (부록 C.33, E.5.1 검증): 배치 규칙을 지키는 무작위 커스텀 대형을 균형 4-4-2 와 동레이팅으로 붙여 "만능 대형"이 있는지 본다.
// 1차는 대형마다 적은 경기, 득실차가 높은 상위 대형만 큰 표본으로 다시 잰다 (전술 매트릭스와 같은 방식, D.17).
// 실행: npx vite-node scripts/diag/custom-sweep.ts -- [대형수=300] [1차경기=20] [재측정 상위=12] [재측정경기=200] [경로=값 ...]
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { createRng, hashSeed } from '../../src/rng';
import { cellExists, customLabel, customProblem, customSlots, GRID_LANES, GRID_ROWS, presetCells } from '../../src/formations';

const nums: number[] = [];
const overrides: Record<string, number> = {};
for (const a of process.argv.slice(2).filter((x) => x !== '--')) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else nums.push(Number(a));
}
const [N = 300, M = 20, TOP = 12, R = 200] = nums;
// 자세히 보기: DETAIL=35,4,base (대형 번호, base = 균형 4-4-2) → 팀 통계 비교 (R 경기)
const DETAIL = process.env.DETAIL;

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

const forms = Array.from({ length: N }, (_, i) => randomCells(i));
const shape = (c: number[]) => customSlots(c).slice(1).map((s) => s.pos).sort().join(' ');

async function play(list: number[][], n: number, base: number, label: string): Promise<{ gd: number; se: number; gf: number; ga: number }[]> {
  const jobs: MatchJob[] = [];
  for (const cells of list) for (let k = 0; k < n; k++) {
    const seed = base + k;
    const me = { ...std('a', seed, 75, '4-4-2', 'balanced'), cells };
    const op = std('b', seed, 75, '4-4-2', 'balanced');
    jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides });
  }
  const outs = await runJobs<MatchOut>(jobs, { label });
  return list.map((_, i) => {
    const xs = outs.slice(i * n, (i + 1) * n);
    const gf = xs.map((m, k) => (k % 2 ? m.homeGoals : m.awayGoals));
    const ga = xs.map((m, k) => (k % 2 ? m.awayGoals : m.homeGoals));
    const d = gf.map((g, k) => g - ga[k]!);
    const gd = d.reduce((a, b) => a + b, 0) / n;
    const sd = Math.sqrt(d.reduce((a, b) => a + (b - gd) ** 2, 0) / Math.max(1, n - 1));
    return { gd, se: sd / Math.sqrt(n), gf: gf.reduce((a, b) => a + b, 0) / n, ga: ga.reduce((a, b) => a + b, 0) / n };
  });
}

if (DETAIL) {
  const ids = DETAIL.split(',');
  const list = ids.map((id) => (id === 'base' ? presetCells('4-4-2') : forms[Number(id)]!));
  const jobs: MatchJob[] = [];
  const seed0 = Number(process.env.SEED0 ?? 71000); // 엔진관리자18: 다른 시드 묶음으로 독립 재측정
  for (const cells of list) for (let k = 0; k < R; k++) {
    const seed = seed0 + k;
    const me = { ...std('a', seed, 75, '4-4-2', 'balanced'), cells };
    const op = std('b', seed, 75, '4-4-2', 'balanced');
    jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides });
  }
  const outs = await runJobs<MatchOut>(jobs, { label: `자세히 ${jobs.length}경기` });
  const keys = ['goals', 'shots', 'shotsOnTarget', 'crosses', 'throughReceived', 'counterShots', 'oppHalfWins', 'possessionTicks', 'passes', 'cutbacks'] as const;
  console.log(`\n| 대형 | 쪽 | ${keys.join(' | ')} |`);
  console.log(`|${'---|'.repeat(keys.length + 2)}`);
  list.forEach((cells, i) => {
    const xs = outs.slice(i * R, (i + 1) * R);
    for (const side of ['나', '상대'] as const) {
      const v = keys.map((k) => xs.reduce((a, m, j) => a + (m.team[(j % 2 ? 1 : 0) ^ (side === '나' ? 1 : 0) ? 1 : 0] as unknown as Record<string, number>)[k]!, 0) / R);
      console.log(`| ${ids[i]} ${customLabel(cells)} | ${side} | ${v.map((x) => x.toFixed(k2(x))).join(' | ')} |`);
    }
  });
  process.exit(0);
}
function k2(x: number): number { return x >= 100 ? 0 : 2; }

const t0 = Date.now();
// 기준: 균형 4-4-2 를 칸으로 옮긴 대형 (같은 시드)
const first = await play(forms, M, 61000, `커스텀 1차 ${N}×${M}`);
const order = first.map((r, i) => ({ ...r, i })).sort((a, b) => b.gd - a.gd);
const mean = first.reduce((a, r) => a + r.gd, 0) / N;
console.log(`\n커스텀 대형 ${N}개 × ${M}경기 (동레이팅 75, 균형 전술, 상대 균형 4-4-2), 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log(`1차 평균 득실차 ${mean >= 0 ? '+' : ''}${mean.toFixed(3)}, 1차 +0.3 초과 ${first.filter((r) => r.gd > 0.3).length}개 (1차 표준오차 약 ±${(first.reduce((a, r) => a + r.se, 0) / N).toFixed(2)})`);
const hist = [-1.5, -1, -0.5, -0.3, 0, 0.3, 0.5, 1, 1.5].map((lo, k, xs) => `${lo}~${xs[k + 1] ?? '∞'}: ${first.filter((r) => r.gd >= lo && r.gd < (xs[k + 1] ?? Infinity)).length}`);
console.log(`분포: 아래 ${first.filter((r) => r.gd < -1.5).length} · ${hist.join(' · ')}`);
const top = order.slice(0, TOP);
const re = await play(top.map((t) => forms[t.i]!), R, 71000, `커스텀 재측정 ${TOP}×${R}`);
console.log(`\n상위 ${TOP}개 재측정 (${R}경기):`);
console.log('| # | 대형 | 포지션 | 1차 | 재측정 득실차 | ±SE | 득점 | 실점 |');
console.log('|---|---|---|---|---|---|---|---|');
top.forEach((t, k) => {
  const r = re[k]!;
  console.log(`| ${t.i} | ${customLabel(forms[t.i]!)} | ${shape(forms[t.i]!)} | ${t.gd >= 0 ? '+' : ''}${t.gd.toFixed(2)} | ${r.gd >= 0 ? '+' : ''}${r.gd.toFixed(2)} | ${r.se.toFixed(2)} | ${r.gf.toFixed(2)} | ${r.ga.toFixed(2)} |`);
});
const over = re.filter((r) => r.gd > 0.3).length;
console.log(`\n재측정 +0.3 초과: ${over}개. 걸린 시간 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
console.log('하위 5개 (1차):', order.slice(-5).map((t) => `${customLabel(forms[t.i]!)} ${t.gd.toFixed(2)}`).join(', '));
process.exit(0);
