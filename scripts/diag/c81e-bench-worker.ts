// C.81e 브라우저 워커 엔진 시간 (PC 워커 흉내): 다른 팀 경기 N회를 Web Worker 안에서 — 냉(첫 경기)·온(나머지 평균)
// 빌드: esbuild 로 묶어 scripts/c81e-worker-bench.mjs 가 Chromium 워커에서 돌린다
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';

self.onmessage = (e: MessageEvent<number>) => {
  const N = e.data;
  const inputs = Array.from({ length: N }, (_, i) => {
    const hr = 64 + (i * 7) % 24;
    const ar = 64 + (i * 11) % 24;
    const home = createTeamRoster({ id: `h${i}`, rating: hr }, `same-h${i}`, 2018, []);
    const away = createTeamRoster({ id: `a${i}`, rating: ar }, `same-a${i}`, 2018, []);
    return { home: teamSetupFromRoster(home, hr, ar), away: teamSetupFromRoster(away, ar, hr), mode: 'auto' as const, difficulty: 'normal' as const, seed: 1000 + i, bigMatch: false };
  });
  const times: number[] = [];
  let goals = 0;
  for (const inp of inputs) {
    const t = performance.now();
    const r = createMatch(inp).runToEnd();
    times.push(performance.now() - t);
    goals += r.homeGoals + r.awayGoals;
  }
  (self as unknown as Worker).postMessage({ times, goals });
};
