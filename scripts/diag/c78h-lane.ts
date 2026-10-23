// 진단 (C.78h 0번): 슛 레인 분해 — 짝마다 수비 쪽 허용 발 슛의 레인 위 수비·가장 가까운 골 쪽 수비 위치·2초 경로. blockProbe(C.78d)에 레인 항목을 더해 쓴다.
// 실행: npx vite-node scripts/diag/c78h-lane.ts -- [경기수=80] [레이팅=75:75] 짝1 짝2 ... [경로=값 ...] [seed0=31000]
import type { MatchJob, MatchOut } from '../engine/job';
import type { BlockTeam } from '../engine/blockProbe';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const pairs: [Tendency, Tendency][] = [];
let n = 80;
let seed0 = 31000;
let ratings = [75, 75];
for (const a of all) {
  if (a.startsWith('seed0=')) seed0 = Number(a.slice(6));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else pairs.push(a.split(':') as [Tendency, Tendency]);
}
const jobs: MatchJob[] = [];
for (const [x, y] of pairs) for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const a = std('a', seed, ratings[0], '4-4-2', tacticsOf(x));
  const b = std('b', seed, ratings[1], '4-4-2', tacticsOf(y));
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: a, away: b, overrides, block: true } : { kind: 'match', seed, neutral: true, home: b, away: a, overrides, block: true });
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `레인 분해 ${jobs.length}경기` });
const sum = (xs: BlockTeam[]): BlockTeam => {
  const acc = JSON.parse(JSON.stringify(xs[0])) as BlockTeam;
  for (const x of xs.slice(1)) for (const k of Object.keys(acc) as (keyof BlockTeam)[]) {
    const v = acc[k];
    if (Array.isArray(v)) (x[k] as number[]).forEach((y, i) => { v[i]! += y; });
    else (acc[k] as number) += x[k] as number;
  }
  return acc;
};
const pc = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(1) : '–');
const pm = (x: number) => (x / n).toFixed(2);
const av = (x: number, d: number, f = 1) => (d ? (x / d).toFixed(f) : '–');
console.log(`\n레인 분해, 레이팅 ${ratings.join(' 대 ')}, ${n}경기씩(시드 ${seed0}~), 덮어쓰기 ${JSON.stringify(overrides)}`);
const rows: string[] = [];
let msSum = 0;
pairs.forEach(([x, y], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  let gf = 0, ga = 0;
  const B: BlockTeam[] = [];
  xs.forEach((m, k) => {
    const ai = k % 2 ? 0 : 1;
    gf += ai === 0 ? m.homeGoals : m.awayGoals; ga += ai === 0 ? m.awayGoals : m.homeGoals;
    B.push(m.block!.team[1 - ai]!);
    msSum += m.ms;
  });
  const b = sum(B);
  rows.push(`| ${x} 대 ${y} | ${pm(gf)}:${pm(ga)} (${((gf - ga) / n).toFixed(2)}) | ${pm(b.sa)} · ${av(b.saXg, b.sa, 3)} · ${pc(b.saBlocked, b.sa)} | ${pm(b.ln)} · ${av(b.lnXg, b.ln, 3)} · ${pc(b.lnBlocked, b.ln)} | ${pc(b.lnOn, b.ln)} · ${pc(b.lnOn6, b.ln)} · ${av(b.lnCnt, b.ln, 2)} | ${av(b.lnLat, b.ln, 2)} · ${pc(b.lnSame, b.ln)} · ${av(b.lnTraj, b.ln, 2)} · ${av(b.lnNear, b.ln, 2)} | ${b.lnVia.map((v) => pc(v, b.ln)).join('/')} · 레인 위 ${b.lnViaOn.map((v, j) => pc(v, b.lnVia[j]!)).join('/')} | ${av(b.lnRecvLat, b.lnRecvN, 2)} | ${av(b.saDense6, b.sa, 2)} |`);
});
console.log('\n| 짝(A 대 B) | A 득:실(차) | B 허용 슛/경기 · xG/슛 · 블록 % | 발 슛/경기 · xG/슛 · 블록 % | 레인 위 수비 있는 슛 % · 그중 6 m 안 % · 레인 위 수비 수 | 가장 가까운 골 쪽 수비: 공-골 선 가로 m · 겨눈 쪽 % · 실제 궤적까지 m · 슈터까지 m | 2초 경로 패스/몰기/루즈 % · 경로별 레인 위 % | 받는 순간 가장 가까운 수비 가로 m | 6 m 골 쪽 수비 |');
console.log('|---|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(r);
console.log(`\n경기당 계산 ${(msSum / outs.length).toFixed(0)} ms · 전체 ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
