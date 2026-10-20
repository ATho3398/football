// C.75y 리그별 시즌 측정 (부록 C.75y 7번): 리그마다 빠른 시뮬 N시즌(다른 리그로 고를 때와 같은 계산) + 내 리그로 한 시즌(내 경기 엔진 + 다른 경기 quick).
// 평균 득점(경기당) · 레이팅 순위와 최종 순위 스피어만 상관 · 우승 팀의 레이팅 순위 분포. 마지막에 14개 리그를 다 고른 시즌 진행 시간.
// 실행: npx vite-node scripts/diag/c75y-leagues.ts -- [빠른 시뮬 시즌 수(기본 40)] [engine] [speed] [only=mls,saudi] [nofast]
import { allLeagueData } from '../../data/leagues';
import { createLeague, recordResult, simulateScore, sortedTable, teamById, type LeagueState } from '../../src/league';
import { createRng, hashSeed } from '../../src/rng';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 40);
const doEngine = args.includes('engine');
const doSpeed = args.includes('speed');
const only = args.find((a) => a.startsWith('only='))?.slice(5).split(',');
const noFast = args.includes('nofast');

function spearman(lg: LeagueState): number {
  const byRating = [...lg.teams].sort((a, b) => b.rating - a.rating).map((t) => t.id);
  const fin = sortedTable(lg).map((r) => r.teamId);
  const n = fin.length;
  const d2 = fin.reduce((t, id, i) => t + (i - byRating.indexOf(id)) ** 2, 0);
  return 1 - (6 * d2) / (n * (n * n - 1));
}
const ratingRank = (lg: LeagueState, id: string) => [...lg.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === id) + 1;
const goalsPerGame = (lg: LeagueState) => {
  const g = lg.table.reduce((t, r) => t + r.gf, 0);
  const m = lg.table.reduce((t, r) => t + r.played, 0) / 2;
  return g / m;
};

console.log(`## 빠른 시뮬 ${N}시즌 (다른 리그 계산)\n`);
console.log('| 리그 | 팀 | 경기당 득점 | 레이팅↔순위 상관 | 우승 = 레이팅 1위 | 우승 ⊂ 레이팅 3위 안 | 우승 팀 레이팅 순위 평균 |');
console.log('|---|---|---|---|---|---|---|');
for (const d of noFast ? [] : allLeagueData()) {
  let gpg = 0, rho = 0, top1 = 0, top3 = 0, rr = 0;
  for (let k = 0; k < N; k++) {
    const lg = createLeague(`c75y-m:${k}`, 2018, d.id);
    lg.schedule.forEach((round, r) => round.forEach((f, i) => {
      const [hg, ag] = simulateScore(createRng(hashSeed(`c75y-m:${k}:${d.id}:${r}:${i}`)), teamById(lg, f.home).rating, teamById(lg, f.away).rating);
      recordResult(lg, f, hg, ag);
    }));
    gpg += goalsPerGame(lg);
    rho += spearman(lg);
    const champ = sortedTable(lg)[0]!.teamId;
    const cr = ratingRank(lg, champ);
    rr += cr;
    if (cr === 1) top1++;
    if (cr <= 3) top3++;
  }
  console.log(`| ${d.nameKo} | ${d.teams.length} | ${(gpg / N).toFixed(2)} | ${(rho / N).toFixed(2)} | ${Math.round((top1 / N) * 100)}% | ${Math.round((top3 / N) * 100)}% | ${(rr / N).toFixed(1)} |`);
}

function playSeason(g: GameState): number {
  const t0 = performance.now();
  while (g.phase === 'season') {
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
    if (g.phase !== 'season') break;
    playRound(g, { others: 'quick' });
    autoAllocate(g.player);
  }
  return performance.now() - t0;
}

if (doEngine) {
  console.log('\n## 내 리그로 한 시즌 (유망주 ST · 내 경기 엔진 · 다른 경기 quick, 시드 c75y-e)\n');
  console.log('| 리그 | 경기당 득점 | 레이팅↔순위 상관 | 우승 (레이팅 순위) | 내 팀 순위 | 시즌 시간 |');
  console.log('|---|---|---|---|---|---|');
  for (const d of allLeagueData().filter((x) => !only || only.includes(x.id))) {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75y-e', difficulty: 'normal', leagues: [d.id] });
    const ms = playSeason(g);
    const lg = g.league;
    const champ = sortedTable(lg)[0]!.teamId;
    console.log(`| ${d.nameKo} | ${goalsPerGame(lg).toFixed(2)} | ${spearman(lg).toFixed(2)} | ${teamById(lg, champ).nameKo} (${ratingRank(lg, champ)}) | ${g.player.history.at(-1)?.leaguePosition} / ${lg.teams.length} | ${(ms / 1000).toFixed(1)}초 |`);
  }
}

if (doSpeed) {
  console.log('\n## 고른 리그 수별 시즌 진행 시간 (내 리그 PL, 유망주 ST, 시드 c75y-sp, 내 경기 엔진 + 다른 경기 quick, 노드 1스레드)\n');
  const all = allLeagueData().map((d) => d.id);
  for (const [label, ids] of [['PL 만', ['pl']], ['기본 6개', ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship']], ['14개 전부', all]] as const) {
    const t0 = performance.now();
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75y-sp', difficulty: 'normal', leagues: [...ids] });
    const make = performance.now() - t0;
    const ms = playSeason(g);
    console.log(`- ${label}: 새 게임 ${Math.round(make)} ms · 시즌 ${(ms / 1000).toFixed(1)}초 · NPC ${g.npcs.length}명 · 세이브 ${Math.round(JSON.stringify(g).length / 1024)} KB(압축 전)`);
  }
}
