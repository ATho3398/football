// @ts-nocheck — 진단 스크립트 (엔진관리자25 전체 점검): 성향 T 대 균형 n 경기(로스터·홈 양방향 짝) — T 쪽 선수 이동 거리(경기 최다 · 상위 3 평균 · 필드 평균),
//   0~10 m 패스 비중 · 30 m+ 비중 · 롱%. 실행: npx vite-node scripts/diag/em25-dist.ts -- [경기수=120] [성향…] [경로=값 …]
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides = {}; const specs = []; let n = 120; let seed0 = 41000;
for (const a of all) { if (a.startsWith('seed=')) seed0 = Number(a.slice(5)); else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k] = Number(v); } else if (/^\d+$/.test(a)) n = Number(a); else specs.push(a); }
if (!specs.length) specs.push('balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block');
const jobs = []; const aHome = (k) => (Math.floor(k / 2) + (k % 2)) % 2 === 1;
for (const t of specs) for (let k = 0; k < n; k++) {
  const seed = seed0 + Math.floor(k / 2); const flip = k % 2 === 1;
  const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tacticsOf(t)); const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tacticsOf('balanced'));
  jobs.push(aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides, pdist: true } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides, pdist: true });
}
const outs = await runJobs<MatchOut>(jobs, { label: `거리 ${jobs.length}경기` });
console.log(`\n성향 대 균형 75:75 ${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 성향 | 경기 최다 km 평균 | 최다 km 최대 | 상위3 평균 km | 필드(교체 제외 선발 90분) 평균 km | 0~10 m % | 30 m+ % | 경기당 ms |');
console.log('|---|---|---|---|---|---|---|---|');
specs.forEach((t, i) => {
  const xs = outs.slice(i * n, (i + 1) * n); let top = 0, topMax = 0, top3 = 0, fld = 0, fldN = 0; const b = [0, 0, 0, 0, 0]; let ms = 0;
  xs.forEach((m, k) => { const me = aHome(k) ? 0 : 1; ms += m.ms;
    const ds = m.players.filter((p) => p.team === me && p.position !== 'GK').map((p) => p.distance / 1000).sort((a, c) => c - a);
    top += ds[0]; topMax = Math.max(topMax, ds[0]); top3 += (ds[0] + ds[1] + ds[2]) / 3;
    for (const p of m.players) if (p.team === me && p.position !== 'GK' && p.starter && p.minutes >= 89) { fld += p.distance / 1000; fldN++; }
    m.pdist[me].forEach((v, j) => (b[j] += v)); });
  const tot = b.reduce((a, c) => a + c, 0);
  console.log(`| ${t} | ${(top / n).toFixed(2)} | ${topMax.toFixed(2)} | ${(top3 / n).toFixed(2)} | ${(fld / Math.max(1, fldN)).toFixed(2)} | ${(100 * b[0] / tot).toFixed(1)} | ${(100 * b[3] / tot + 100 * b[4] / tot).toFixed(1)} | ${(ms / n).toFixed(0)} |`);
});
