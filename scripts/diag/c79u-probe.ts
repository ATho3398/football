// @ts-nocheck — 진단 스크립트 (엔진관리자20, c79u 점유 가치 분해 탐침)
// 성향 짝 칸을 c78s-matrix 와 같은 시드·양방향 짝으로 돌리고, 팀별 과정 지표를 찍는다:
//   득실 · 점유 % · 패스/경기 · 0~10 m % · 30 m+ % · 패스 성공 · 오픈 플레이 상실 위치(자기 ⅓/중간/상대 ⅓) · 탈취 뒤 6초 패스(수·공중 몫·성공) · 30 m+ 패스(성공·공중볼 경합·가로챔) · 소유 길이(평균 초·10초+ 비율) · 역습슛 · 상대진영탈취 · 슈팅
// 실행: npx vite-node scripts/diag/c79u-probe.ts -- [경기수=160] [seed=41000] only=A/B,C/D [경로=값 …]
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf, type Level } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 160, seed0 = 41000, only: [string, string][] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('only=')) only = a.slice(5).split(',').map((p) => p.split('/') as [string, string]);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
if (!only.length) only = [['direct', 'counter'], ['direct', 'balanced'], ['block', 'counter'], ['block', 'balanced'], ['direct', 'tikitaka'], ['block', 'tikitaka']];
const tac = (spec: string) => {
  const [t, lv] = spec.split('@');
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t as never, levels);
};
const dirs = 2;
const aHome = (k: number) => (Math.floor(k / dirs) + (k % dirs)) % 2 === 1;
const jobs: MatchJob[] = [];
for (const [a, b] of only) for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / dirs);
  const flip = k % dirs === 1;
  const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tac(a));
  const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tac(b));
  jobs.push((aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, pdist: true, c79u: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, pdist: true, c79u: true }) as MatchJob);
}
const outs = await runJobs<MatchOut>(jobs, { label: `c79u 탐침 ${jobs.length}경기` });
console.log(`\n${n}경기씩(방향 2, 시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 칸 | 팀 | 득 / 실 | 점유 % | 패스 | 0~10 m % | 30 m+ % | 성공 % | 상실 자기⅓/중간/상대⅓ (회) | 전환 6초 패스 수 · 공중 % · 성공 % | 30 m+ 성공 % · 경합 % · 가로챔 % | 소유 평균 초 · 10초+ % | 역습슛 | 상대진영탈취 | 슈팅 |');
only.forEach(([a, b], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  for (const side of [0, 1]) {
    const acc = { gf: 0, ga: 0, poss: 0, pa: 0, pc: 0, pd: [0, 0, 0, 0, 0], lz: [0, 0, 0], tr: [0, 0, 0, 0], lg: [0, 0, 0, 0], ps: [0, 0, 0], cs: 0, ow: 0, sh: 0 };
    xs.forEach((m, k) => {
      const me = (aHome(k) ? 0 : 1) ^ side; // side 0 = A, 1 = B
      const T = m.team[me], O = m.team[1 - me];
      acc.gf += me === 0 ? m.homeGoals : m.awayGoals; acc.ga += me === 0 ? m.awayGoals : m.homeGoals;
      acc.poss += (100 * T.possessionTicks) / (T.possessionTicks + O.possessionTicks);
      acc.pa += T.passes; acc.pc += T.passesCompleted; acc.cs += T.counterShots; acc.ow += T.oppHalfWins; acc.sh += T.shots;
      m.pdist[me].forEach((v, q) => (acc.pd[q] += v));
      const u = m.c79u[me];
      u.lossZone.forEach((v, q) => (acc.lz[q] += v)); u.tr.forEach((v, q) => (acc.tr[q] += v)); u.lg.forEach((v, q) => (acc.lg[q] += v)); u.poss.forEach((v, q) => (acc.ps[q] += v));
    });
    const tot = acc.pd.reduce((x, y) => x + y, 0);
    const f = (v: number, d = 1) => (v / n).toFixed(d);
    const pc = (v: number, d: number) => (d ? ((100 * v) / d).toFixed(1) : '-');
    console.log(`| ${a}/${b} | ${side === 0 ? a : b} | ${f(acc.gf, 2)} / ${f(acc.ga, 2)} | ${f(acc.poss)} | ${f(acc.pa, 0)} | ${pc(acc.pd[0], tot)} | ${pc(acc.pd[3] + acc.pd[4], tot)} | ${pc(acc.pc, acc.pa)} | ${f(acc.lz[0])} / ${f(acc.lz[1])} / ${f(acc.lz[2])} | ${f(acc.tr[0])} · ${pc(acc.tr[1], acc.tr[0])} · ${pc(acc.tr[2], acc.tr[0])} (공중 ${pc(acc.tr[3], acc.tr[1])}) | ${pc(acc.lg[1], acc.lg[0])} · ${pc(acc.lg[2], acc.lg[0])} · ${pc(acc.lg[3], acc.lg[0])} (${f(acc.lg[0])}/경기) | ${(acc.ps[1] / Math.max(1, acc.ps[0])).toFixed(1)} · ${pc(acc.ps[2], acc.ps[0])} | ${f(acc.cs)} | ${f(acc.ow)} | ${f(acc.sh)} |`);
  }
});
process.exit(0);
