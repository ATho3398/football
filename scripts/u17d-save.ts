// U17-d 캡처용 세이브 (vite-node): 경기 재생 · 결과 — ① 시즌 중 경기 날(자동 모드, 출전) ② 같은 날 부상(결장) ③ 리그 우승 확정 최종 라운드(우승 축하)
// 사용: npx vite-node scripts/u17d-save.ts -- <저장 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { serialize } from '../src/save';
import { sortedTable } from '../src/league';

const dir = process.argv.at(-1)!.endsWith('.ts') ? 'tmp-u17d' : process.argv.at(-1)!;
mkdirSync(dir, { recursive: true });
const toMatchDay = (g: GameState) => { while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); } };
function play(g: GameState, matches: number): void {
  let n = 0;
  while (g.phase === 'season' && n < matches) {
    if (isMatchDay(g)) { playRound(g, { engine: 'quick' }); n++; } else { playOthers(g, 'quick'); endDay(g); }
  }
}
const put = (name: string, g: GameState) => writeFileSync(join(dir, `${name}.json`), serialize(g));

const mid = newGame({ mode: 'real', playerId: 'son', seed: 'u17d-mid', difficulty: 'normal' });
mid.options = { others: 'quick' }; play(mid, 10); toMatchDay(mid);
mid.player.injury = null; mid.player.suspended = 0; mid.player.fatigue = 0;
mid.control = { mode: 'auto', stop: 'important' }; put('mid', mid);
const bench = structuredClone(mid); // 결장: 부상 2주 (컵 경기는 출장 정지가 안 걸려 부상으로)
bench.player.injury = { grade: 'minor', weeksTotal: 2, daysTotal: 14, daysLeft: 14, date: bench.calendar.date, season: bench.league.season, round: bench.league.round + 1, permanent: {}, ret: 'full' }; put('bench', bench);
let title: GameState | null = null;
for (let k = 0; k < 20 && !title; k++) {
  const t = newGame({ mode: 'real', playerId: 'de-bruyne', seed: `c81v-t${k}`, difficulty: 'normal' });
  t.options = { others: 'quick' };
  const L = t.league;
  while (t.phase === 'season' && L.round < L.schedule.length - 1) playRound(t, { engine: 'quick' });
  const tab = sortedTable(L);
  if (tab[0]!.teamId === t.player.teamId && tab[0]!.points - tab[1]!.points > 3) { toMatchDay(t); t.control = { mode: 'auto', stop: 'important' }; title = t; }
}
if (title) put('title', title);
console.log('ok', dir, mid.calendar.date, mid.league.round, !!title);
