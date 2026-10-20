// 45b(b) 다른 리그 풀 엔진 측정: 경기 하나 ms, 경기일 하루치, 시즌 전체 경기 수 → 걸리는 시간 추정 (노드 1스레드)
// 실행: npx vite-node scripts/diag/c76h-engine.ts -- [days(기본 21)]
import { allLeagueData } from '../../data/leagues';
import { newGame, playOthers, endDay, isMatchDay, playRound, todaysOthers } from '../../src/game';
import { otherLeagueJobs, applyOtherLeagueJob } from '../../src/otherLeagues';
import { playNpcMatch } from '../../src/engine/npcMatch';
import { autoAllocate } from '../../src/growth';

const days = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 21);
const all = allLeagueData().map((d) => d.id);
for (const [label, ids] of [['기본 6개', ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship']], ['14개 전부', all]] as const) {
  const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-e', difficulty: 'normal', leagues: [...ids] });
  let n = 0, ms = 0, maxDay = 0, mine = 0;
  for (let d = 0; d < days && g.phase === 'season'; d++) {
    const jobs = otherLeagueJobs(g, g.calendar.date);
    const t0 = performance.now();
    for (const j of jobs) applyOtherLeagueJob(g, j, playNpcMatch(j.input));
    const dt = performance.now() - t0;
    n += jobs.length; ms += dt; maxDay = Math.max(maxDay, jobs.length);
    mine += todaysOthers(g).length;
    if (isMatchDay(g)) { playRound(g, { others: 'engine' }); autoAllocate(g.player); } else { playOthers(g, 'engine'); endDay(g); }
  }
  const per = ms / Math.max(1, n);
  const season = allLeagueData().filter((d) => ids.includes(d.id as never)).reduce((t, d) => t + (d.teams.length * (d.teams.length - 1) * (d.teams.length <= 12 ? 1.5 : 1)), 0);
  console.log(`${label}: ${days}일 동안 다른 리그 경기 ${n}개 · 경기당 ${per.toFixed(0)} ms(1스레드) · 하루 최대 ${maxDay}경기 · 시즌 전체 경기(내 리그 포함) 약 ${Math.round(season)}개 → 1스레드 ${(season * per / 60000).toFixed(1)}분, 워커 3개 ${(season * per / 60000 / 3).toFixed(1)}분, 7개 ${(season * per / 60000 / 7).toFixed(1)}분`);
  void mine;
}
