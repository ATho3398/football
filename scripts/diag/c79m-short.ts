// @ts-nocheck — 진단 스크립트 (C.79m 점유 가치)
// 성향별 패스 거리·점유: 성향 T 대 균형 n 경기(로스터·홈 양방향 짝), T 쪽 0~10 m 비중 · 30 m+ 비중 · 롱%(30 m+ 시도/패스) · 패스 성공 · 점유 · 득점.
// 실행: npx vite-node scripts/diag/c79m-short.ts -- [경기수=120] [레이팅=75:75] [성향…] [opp=상대 성향] [경로=값 …]
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 120;
let ratings = [75, 75];
let seed0 = 41000;
let opp = 'balanced'; // C.80c: opp= 상대 성향(기본 균형)
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('opp=')) opp = a.slice(4);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
if (!specs.length) specs.push('balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block');
const jobs: MatchJob[] = [];
const aHome = (k: number) => (Math.floor(k / 2) + (k % 2)) % 2 === 1;
for (const t of specs) for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2);
  const flip = k % 2 === 1;
  const A = std(flip ? 'b' : 'a', seed, ratings[0], '4-4-2', tacticsOf(t));
  const B = std(flip ? 'a' : 'b', seed, ratings[1], '4-4-2', tacticsOf(opp));
  const j = aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, pdist: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, pdist: true };
  jobs.push(j as MatchJob);
}
const outs = await runJobs<MatchOut>(jobs, { label: `짧은 패스 ${jobs.length}경기` });
console.log(`\n레이팅 ${ratings.join(' 대 ')}, 성향 대 ${opp} ${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 성향 | 0~10 m % | 10~20 | 20~30 | 30 m+ | 롱% | 패스/경기 | 패스 성공 % | 점유 % | 득 / 실 | 상대(균형) 0~10 m % |');
let sAll = 0;
specs.forEach((t, i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const b = [0, 0, 0, 0, 0], bo = [0, 0, 0, 0, 0];
  let pa = 0, pc = 0, lp = 0, poss = 0, gf = 0, ga = 0;
  xs.forEach((m, k) => {
    const me = aHome(k) ? 0 : 1;
    m.pdist[me].forEach((v, q) => (b[q] += v));
    m.pdist[1 - me].forEach((v, q) => (bo[q] += v));
    const A = m.team[me], B = m.team[1 - me];
    pa += A.passes; pc += A.passesCompleted; lp += A.longPasses;
    poss += (100 * A.possessionTicks) / (A.possessionTicks + B.possessionTicks);
    gf += me === 0 ? m.homeGoals : m.awayGoals; ga += me === 0 ? m.awayGoals : m.homeGoals;
  });
  const tot = b.reduce((x, y) => x + y, 0), totO = bo.reduce((x, y) => x + y, 0);
  const p = (v: number, d = tot) => ((100 * v) / d).toFixed(1);
  sAll += (100 * b[0]) / tot;
  console.log(`| ${t} | ${p(b[0])} | ${p(b[1])} | ${p(b[2])} | ${p(b[3] + b[4])} | ${((100 * lp) / pa).toFixed(1)} | ${(pa / n).toFixed(0)} | ${((100 * pc) / pa).toFixed(1)} | ${(poss / n).toFixed(1)} | ${(gf / n).toFixed(2)} / ${(ga / n).toFixed(2)} | ${p(bo[0], totO)} |`);
});
console.log(`성향 평균 0~10 m ${(sAll / specs.length).toFixed(1)}%`);
process.exit(0);
