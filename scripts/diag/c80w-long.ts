// @ts-nocheck — 진단 (C.80w 롱패스 성공률): 30 m+ 패스 단계별 결과(비행 성공·실패 종류, 도착 시 수신자 거리·공중/땅볼 경합) 분해.
// 엔진은 probe.long 만. 실행: npx vite-node scripts/diag/c80w-long.ts -- [경기수=40] [시작 k=0] [성향=balanced] [경로=값 …]
import { runMatchJob } from '../engine/job';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import { probe } from '../../src/engine/probe';
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides = {}; const nums = []; let tn = 'balanced';
for (const a of all) { if (a.includes('=')) { const [k, v] = a.split('='); overrides[k] = Number(v); } else if (/^\d+$/.test(a)) nums.push(Number(a)); else tn = a; }
const [n = 40, k0 = 0] = nums;
const ev = {}; let pSum = 0; let pN = 0; const farD = [];
probe.long = (s, e, p) => { ev[e] = (ev[e] ?? 0) + 1; if (e.startsWith('launch') || e === 'offside') { pSum += p; pN++; } if (e === 'arrive:far') farD.push(p); };
let lp = 0, lc = 0, pa = 0;
for (let k = k0; k < k0 + n; k++) {
  const seed = 41000 + Math.floor(k / 2); const flip = k % 2 === 1;
  const A = std(flip ? 'b' : 'a', seed, 75, '4-4-2', tacticsOf(tn)); const B = std(flip ? 'a' : 'b', seed, 75, '4-4-2', tacticsOf('balanced'));
  const m = runMatchJob({ kind: 'match', seed, neutral: true, home: A, away: B, overrides });
  for (const t of m.team) { lp += t.longPasses; lc += t.longCompleted; pa += t.passes; }
}
console.log(JSON.stringify({ n, k0, tn, overrides, lp, lc, pa, pSum, pN, ev, far: farD.length ? [Math.min(...farD), farD.sort((a, b) => a - b)[farD.length >> 1]] : [] }));
process.exit(0);
