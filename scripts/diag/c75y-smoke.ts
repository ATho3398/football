// C.75y 다른 리그 시작 연기 시험: 내 리그를 바꿔 시즌을 끝까지 돌리고 상태를 찍는다.
// 실행: npx vite-node scripts/diag/c75y-smoke.ts -- <리그 id> [real 선수 id] [시즌 수]
import { newGame, playOthers, playRound, startNextSeason, endDay, isMatchDay, calendarOf, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { sortedTable } from '../../src/league';
import { serialize, deserialize } from '../../src/save';

const args = process.argv.slice(2).filter((a) => a !== '--');
const lg = args[0] ?? 'laliga';
const real = args[1] && args[1] !== '-' ? args[1] : undefined;
const seasons = Number(args[2] ?? 1);
const t0 = performance.now();
const g: GameState = real
  ? newGame({ mode: 'real', playerId: real, seed: 'c75y-smoke', difficulty: 'normal', leagues: [lg, 'pl', 'laliga', 'kleague1', 'mls'] })
  : newGame({ mode: 'prospect', position: 'ST', seed: 'c75y-smoke', difficulty: 'normal', leagues: [lg, 'pl', 'laliga', 'kleague1', 'mls'] });
console.log('새 게임', Math.round(performance.now() - t0), 'ms · 내 리그', g.league.id, g.league.name, '· 팀', g.player.teamId, '· 날짜', g.calendar.date, '· 개막', calendarOf(g).opening, '· 고른 리그', g.leagueIds?.join(','));
console.log('로스터 팀', Object.keys(g.rosters).length, '· 실제 선수(내 팀)', g.rosters[g.player.teamId]!.players.filter((p) => p.real).map((p) => p.nameKo).join(', '));
console.log('컵', g.cups?.fa ? `${g.cups.fa.rounds[0]!.length * 2}팀 ${g.cups.fa.dates.join(' ')}` : '없음', '· 챔스', g.cups?.ucl ? `${g.cups.ucl.groups.flat().length}팀` : '없음');
for (let s = 0; s < seasons; s++) {
  const t1 = performance.now();
  while (g.phase === 'season') {
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
    if (g.phase !== 'season') break;
    playRound(g, { others: 'quick' });
    autoAllocate(g.player);
  }
  const top = sortedTable(g.league).slice(0, 3).map((r) => `${r.teamId} ${r.points}`).join(' / ');
  console.log(`시즌 ${g.league.season} 끝 ${Math.round(performance.now() - t1)}ms · 날짜 ${g.calendar.date} · 상위 ${top} · 내 순위 ${sortedTable(g.league).findIndex((r) => r.teamId === g.player.teamId) + 1} · 컵 우승 ${g.cups?.fa?.winner ?? '-'} · 챔스 우승 ${g.cups?.ucl?.winner ?? '-'}`);
  console.log('  이적', (g.transfers ?? []).length, '· 실제 선수 보충', (g.transfers ?? []).filter((r) => r.fill?.real).map((r) => `${r.fill!.name}(${r.fill!.club}→${r.from})`).join(', '));
  for (const o of g.otherLeagues ?? []) console.log('  다른 리그', o.id, o.season, `${o.round}/${o.schedule.length}`, '득점 1위', Object.entries(o.stats ?? {}).sort((a, b) => b[1][0] - a[1][0])[0]?.join(':'), o.past?.at(-1)?.scorer?.join(' '));
  if (s < seasons - 1) startNextSeason(g);
}
const json = serialize(g);
const back = deserialize(json);
console.log('세이브', Math.round(json.length / 1024), 'KB · 왕복 팀', back.player.teamId, back.league.id, Object.keys(back.rosters).length);
