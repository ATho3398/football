// C.81e 엔진 계산 시간: 다른 팀 경기(auto, 재생 데이터 없음) N회 — 냉(첫 경기)·온(나머지 평균), GC 시간
// 실행: npx vite-node scripts/diag/c81e-bench.ts -- [N=100]
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';

const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 100);
let gcMs = 0;
new PerformanceObserver((l) => { for (const e of l.getEntries()) gcMs += e.duration; }).observe({ entryTypes: ['gc'] });
const inputs = Array.from({ length: N }, (_, i) => {
  const hr = 64 + (i * 7) % 24;
  const ar = 64 + (i * 11) % 24;
  const home = createTeamRoster({ id: `h${i}`, rating: hr }, `same-h${i}`, 2018, []);
  const away = createTeamRoster({ id: `a${i}`, rating: ar }, `same-a${i}`, 2018, []);
  return { home: teamSetupFromRoster(home, hr, ar), away: teamSetupFromRoster(away, ar, hr), mode: 'auto' as const, difficulty: 'normal' as const, seed: 1000 + i, bigMatch: false };
});
const times: number[] = [];
let goals = 0;
const gc0 = gcMs;
const T0 = performance.now();
let cpuWarm = 0;
for (const inp of inputs) {
  const t = performance.now();
  const c0 = process.cpuUsage();
  const r = createMatch(inp).runToEnd();
  times.push(performance.now() - t);
  if (times.length > 1) { const c = process.cpuUsage(c0); cpuWarm += (c.user + c.system) / 1000; }
  goals += r.homeGoals + r.awayGoals;
}
const total = performance.now() - T0;
await new Promise((r) => setTimeout(r, 50));
const warm = times.slice(1);
const avg = warm.reduce((a, b) => a + b, 0) / warm.length;
const sorted = [...warm].sort((a, b) => a - b);
console.log(`N=${N} CPU 온 평균 ${(cpuWarm / warm.length).toFixed(1)}ms · 냉 ${times[0]!.toFixed(0)}ms 온 평균 ${avg.toFixed(1)}ms 중앙 ${sorted[Math.floor(sorted.length / 2)]!.toFixed(1)}ms 합 ${(total / 1000).toFixed(2)}s GC ${(gcMs - gc0).toFixed(0)}ms (${((gcMs - gc0) / total * 100).toFixed(1)}%) 득점 ${goals}`);
