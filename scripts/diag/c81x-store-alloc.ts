// C.81x 실수 필드 저장이 상자(HeapNumber)를 새로 만드는지: 경기 6000틱 뒤 실제 선수 객체에 5천만 번 실수를 저장하고 GC 횟수를 센다.
// 결론: 선수·기록·공 객체 모두 GC 0~1회(새 상자 없음 = V8 Double 표현 제자리 저장) — 구조체 배열로 옮겨도 저장 비용은 같다.
// 실행: npx esbuild scripts/diag/c81x-store-alloc.ts --bundle --platform=node --format=esm --outfile=/tmp/sa.mjs && node /tmp/sa.mjs
import { PerformanceObserver, performance } from 'node:perf_hooks';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch, step } from '../../src/engine/sim';
import { createTeamRoster } from '../../src/roster';
import type { Agent, Ball } from '../../src/engine/state';

const home = createTeamRoster({ id: 'h0', rating: 70 }, 'same-h0', 2018, []);
const away = createTeamRoster({ id: 'a0', rating: 72 }, 'same-a0', 2018, []);
const s = createMatch({ home: teamSetupFromRoster(home, 70, 72), away: teamSetupFromRoster(away, 72, 70), mode: 'auto', difficulty: 'normal', seed: 1000, bigMatch: false }).state;
for (let i = 0; i < 6000; i++) step(s);
let gcN = 0;
new PerformanceObserver((l) => { gcN += l.getEntries().length; }).observe({ entryTypes: ['gc'] });
const a = s.agents[5]!;
function fx(o: Agent, n: number): void { for (let i = 0; i < n; i++) o.x = o.x * 0.999 + 0.001; }
function fst(o: Agent, n: number): void { for (let i = 0; i < n; i++) o.stats.distance = o.stats.distance * 0.999 + 0.001; }
function fb(o: Ball, n: number): void { for (let i = 0; i < n; i++) o.x = o.x * 0.999 + 0.001; }
const plain = { x: 0.5 };
function fp(o: { x: number }, n: number): void { for (let i = 0; i < n; i++) o.x = o.x * 0.999 + 0.001; }
const run = async (name: string, f: () => void): Promise<void> => {
  gcN = 0;
  const t = performance.now();
  f();
  await new Promise((r) => setTimeout(r, 30));
  console.log(name.padEnd(16), `${(performance.now() - t).toFixed(0)}ms gc ${gcN}`);
};
await run('warm', () => { fx(a, 1e6); fst(a, 1e6); fb(s.ball, 1e6); fp(plain, 1e6); });
await run('agent.x', () => fx(a, 5e7));
await run('stats.distance', () => fst(a, 5e7));
await run('ball.x', () => fb(s.ball, 5e7));
await run('plain.x', () => fp(plain, 5e7));
