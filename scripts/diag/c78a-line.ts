// 진단 (C.78a ⑤): 높은 라인 + 느린 CB 실점 (balance-sweep 상호작용 ③ 과 같은 짝: 홈 4-4-2 균형/라인 높음 0.65 × CB 보통/속도·가속 −10, 상대 균형)
// 실행: npx vite-node scripts/diag/c78a-line.ts -- [경기수=200] [경로=값 ...]  →  (느린 CB 높음−보통 실점) − (보통 CB 높음−보통 실점), C.32 −0.39
import type { AttrMod, MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 200;
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else n = Number(a);
}
const bal = tacticsOf('balanced');
const conds: [string, AttrMod[]][] = [['CB 보통', []], ['CB 속도·가속 −10', [2, 3].map((slot) => ({ team: 0 as const, slot, attrs: ['pace', 'acceleration'], delta: -10 }))]];
const tacs: [string, typeof bal][] = [['라인 보통', bal], ['라인 높음', { ...bal, lineHeight: 0.65 }]];
const jobs: MatchJob[] = [];
for (const [, cm] of conds) for (const [, tt] of tacs) for (let k = 0; k < n; k++) {
  const seed = 23000 + k;
  jobs.push({ kind: 'match', seed, neutral: true, home: std('a', seed, 75, '4-4-2', tt), away: std('b', seed, 75, '4-4-2', bal), mods: cm, overrides });
}
const outs = await runJobs<MatchOut>(jobs, { label: `라인×CB ${jobs.length}경기` });
const ga: number[] = [];
const shotsA: number[] = [];
for (let c = 0; c < 4; c++) {
  const xs = outs.slice(c * n, (c + 1) * n);
  ga.push(xs.reduce((v, m) => v + m.awayGoals, 0) / n);
  shotsA.push(xs.reduce((v, m) => v + m.team[1].shots, 0) / n);
}
console.log(`\n높은 라인 × 느린 CB (${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)})`);
console.log(`CB 보통: 실점 라인 보통 ${ga[0]!.toFixed(2)} · 높음 ${ga[1]!.toFixed(2)} (상대 슈팅 ${shotsA[0]!.toFixed(1)} · ${shotsA[1]!.toFixed(1)})`);
console.log(`CB 느림: 실점 라인 보통 ${ga[2]!.toFixed(2)} · 높음 ${ga[3]!.toFixed(2)} (상대 슈팅 ${shotsA[2]!.toFixed(1)} · ${shotsA[3]!.toFixed(1)})`);
console.log(`상호작용 (느린 CB 높음−보통) − (보통 CB 높음−보통) = ${((ga[3]! - ga[2]!) - (ga[1]! - ga[0]!)).toFixed(2)} (C.32 −0.39, 목표 +)`);
process.exit(0);
