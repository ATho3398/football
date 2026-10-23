// 진단 (C.78h): 경기 계산 시간 — 같은 시드 N경기를 한 스레드로 차례로(데운 뒤), C.78h 슛 레인 규칙 켬 대 끔 (c78d-time 과 같은 짝). 엔진 코드는 바꾸지 않는다.
// 실행: npx vite-node scripts/diag/c78h-time.ts -- [경기수=30]
import { runMatchJob, type MatchJob } from '../engine/job';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 30);
const OFF = { 'prob.laneSide': 0, 'offball.laneBlock': 0, 'onball.laneCarry': 0 };
const pairs: [Tendency, Tendency][] = [['balanced', 'bus'], ['gegenpress', 'block'], ['balanced', 'counter']];
const job = (k: number, overrides: Record<string, number>): MatchJob => {
  const [x, y] = pairs[k % pairs.length]!;
  return { kind: 'match', seed: 31000 + k, neutral: true, home: std('a', 31000 + k, 75, '4-4-2', tacticsOf(x)), away: std('b', 31000 + k, 75, '4-4-2', tacticsOf(y)), overrides };
};
for (let k = 0; k < 3; k++) runMatchJob(job(k, {}));
for (const [label, ov] of [['켬', {}], ['끔', OFF], ['켬', {}], ['끔', OFF]] as [string, Record<string, number>][]) {
  let ms = 0;
  let mx = 0;
  for (let k = 0; k < n; k++) {
    const t0 = performance.now();
    runMatchJob(job(k, ov));
    const d = performance.now() - t0;
    ms += d;
    mx = Math.max(mx, d);
  }
  console.log(`${label}: 경기당 ${(ms / n).toFixed(0)} ms · 최대 ${mx.toFixed(0)} ms (${n}경기, 깊은 블록 성향 짝)`);
}
process.exit(0);
