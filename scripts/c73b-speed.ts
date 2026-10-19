// C.73b 속도 측정 (22.3): 시즌 자동 진행 계산 시간 — 한 시즌을 화면 없이 끝까지 돌려 경기 수 · 총 ms · 경기당 ms 를 잰다.
// 내 경기 = 에이전트 엔진, 다른 경기 = 전체 엔진(기본) 또는 빠른 진행(통계). 브라우저는 다른 경기를 Web Worker 풀로 나눠 계산하므로 이 값(한 스레드)이 위쪽 한계다.
// npx vite-node scripts/c73b-speed.ts -- [seed] [others: engine|quick]
import { applyOther, endDay, isMatchDay, newGame, otherJob, playOthers, playRound, todaysOthers, type GameState } from '../src/game';
import { playNpcMatch } from '../src/engine/npcMatch';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seed = args[0] ?? 'c73b-speed';
const how = (args[1] ?? 'engine') as 'engine' | 'quick';

const g: GameState = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
let my = 0;
let others = 0;
let myMs = 0;
let othersMs = 0;
let dayMs = 0;
let days = 0;
const t0 = performance.now();
while (g.phase === 'season') {
  const a = performance.now();
  const jobs = todaysOthers(g);
  if (how === 'engine') for (const [r, i] of jobs) applyOther(g, r, i, playNpcMatch(otherJob(g, r, i).input));
  else playOthers(g, 'quick');
  others += jobs.length;
  const b = performance.now();
  othersMs += b - a;
  if (isMatchDay(g)) {
    // 그날 다른 경기는 이미 끝남 → playRound 는 내 경기 + 그날 끝내기만
    playRound(g, {});
    my++;
    myMs += performance.now() - b;
  } else {
    const c = performance.now();
    endDay(g);
    dayMs += performance.now() - c;
    days++;
  }
}
const total = performance.now() - t0;
const r = (x: number) => Math.round(x);
console.log(JSON.stringify({
  seed, others: how, myMatches: my, otherMatches: others, days, totalMs: r(total),
  myMsPer: r(myMs / Math.max(1, my)), otherMsPer: r(othersMs / Math.max(1, others)), dayMsPer: Math.round((dayMs / Math.max(1, days)) * 10) / 10,
  perMyMatchMs: r(total / Math.max(1, my)), phase: g.phase,
}));
