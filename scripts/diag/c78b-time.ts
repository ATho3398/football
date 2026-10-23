// 진단 (C.78b): 경기 계산 시간·결정 수 (수신 상수별). npx vite-node scripts/diag/c78b-time.ts -- [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { probe } from '../../src/engine/probe';
import { createTeamRoster, rosterRating } from '../../src/roster';
for (const a of process.argv.slice(2).filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
let dec = 0;
probe.decide = () => { dec++; };
const ms: number[] = [];
for (let i = 0; i < 6; i++) {
  const h = createTeamRoster({ id: 'th', rating: 75 }, `t-h${i}`, 2018, []);
  const a = createTeamRoster({ id: 'ta', rating: 75 }, `t-a${i}`, 2018, []);
  const m = createMatch({ home: teamSetupFromRoster(h, rosterRating(h), 75, `h${i}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `a${i}`), mode: 'auto', difficulty: 'normal', seed: 500 + i, bigMatch: false, neutral: true });
  const t0 = performance.now();
  m.runToEnd();
  ms.push(performance.now() - t0);
}
console.log(`경기당 ${(ms.slice(1).reduce((x, y) => x + y, 0) / 5).toFixed(0)} ms · 결정 ${(dec / 6).toFixed(0)}/경기`);
