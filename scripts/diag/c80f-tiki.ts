// @ts-nocheck — 진단 스크립트 (C.80f 티키 롱패스 판단 감점)
// 성향 A 대 상대 B n 경기(로스터·홈 양방향 짝): A 쪽 5 m 단위 패스 시도/경기 · 20 m+ /경기 · <10 m % · 패스 성공 · 점유 · 득실.
// 실행: npx vite-node scripts/diag/c80f-tiki.ts -- [경기수=160] [seed=41000] [only=tikitaka/gegenpress,tikitaka/balanced] [경로=값 …]
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 160, seed0 = 41000;
let pairs: [string, string][] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('only=')) pairs = a.slice(5).split(',').map((p) => p.split('/') as [string, string]);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
}
if (!pairs.length) pairs = [['tikitaka', 'gegenpress'], ['tikitaka', 'balanced'], ['gegenpress', 'tikitaka']];
const aHome = (k: number) => (Math.floor(k / 2) + (k % 2)) % 2 === 1;
const jobs: MatchJob[] = [];
for (const [a, b] of pairs) for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2);
  const flip = k % 2 === 1;
  const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tacticsOf(a));
  const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tacticsOf(b));
  jobs.push((aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, pdist: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, pdist: true }) as MatchJob);
}
const outs = await runJobs<MatchOut>(jobs, { label: `c80f ${jobs.length}경기` });
console.log(`\n${n}경기씩(방향 2, 시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| A(대 B) | 0~5 | 5~10 | 10~15 | 15~20 | 20~25 | 25~30 | 30+ | 패스/경기 | 20 m+ /경기 | <10 m % | 성공 % | 점유 % | 득실(A) ± SE |');
pairs.forEach(([a, b], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const d = [0, 0, 0, 0, 0, 0, 0];
  let pa = 0, pc = 0, poss = 0, gd = 0, gd2 = 0;
  xs.forEach((m, k) => {
    const me = aHome(k) ? 0 : 1;
    m.pdist5[me].forEach((v, q) => (d[q] += v));
    const A = m.team[me], B = m.team[1 - me];
    pa += A.passes; pc += A.passesCompleted;
    poss += (100 * A.possessionTicks) / (A.possessionTicks + B.possessionTicks);
    const g = (me === 0 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals);
    gd += g; gd2 += g * g;
  });
  const tot = d.reduce((x, y) => x + y, 0);
  const mean = gd / n, se = Math.sqrt((gd2 / n - mean * mean) / n);
  console.log(`| ${a}(${b}) | ${d.map((v) => (v / n).toFixed(1)).join(' | ')} | ${(tot / n).toFixed(0)} | ${((d[4] + d[5] + d[6]) / n).toFixed(1)} | ${((100 * (d[0] + d[1])) / tot).toFixed(1)} | ${((100 * pc) / pa).toFixed(1)} | ${(poss / n).toFixed(1)} | ${mean >= 0 ? '+' : ''}${mean.toFixed(2)} ± ${se.toFixed(2)} |`);
});
process.exit(0);
