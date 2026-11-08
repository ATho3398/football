// C.76c 리그 이동 시험: PL 에서 한 시즌 → 비시즌 다른 리그 제안 수락 → 다음 시즌 그 리그. 세이브 왕복 로스터가 같은지 본다
import { newGame, playRound, startNextSeason, endDay, isMatchDay, playOthers, acceptMyOffer, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { serialize, deserialize } from '../../src/save';
import { leagueOfTeam } from '../../src/league';
import { createHash } from 'node:crypto';

const h = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex').slice(0, 12);
function season(g: GameState): void {
  while (g.phase === 'season') {
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
    if (g.phase !== 'season') break;
    playRound(g, { others: 'quick' });
    autoAllocate(g.player);
  }
}
const g = newGame({ mode: 'real', playerId: process.argv[2] ?? 'kane', seed: 'c76c-move', difficulty: 'normal', leagues: ['pl', 'laliga', 'bundesliga', 'kleague1'], futureStars: true });
season(g);
const offers = g.market.offers ?? [];
console.log('비시즌 제안', offers.map((o) => `${o.teamId}(${leagueOfTeam(o.teamId)})`).join(', '));
let i = offers.findIndex((o) => leagueOfTeam(o.teamId) !== 'pl');
if (i < 0) { console.log('다른 리그 제안 없음 — 강제로 하나 만든다'); g.market.offers = [...offers, { teamId: 'laliga:rma', kind: 'transfer', years: 3, wage: 2000, start: 0.6, interest: 1 }]; i = g.market.offers.length - 1; }
acceptMyOffer(g, i);
console.log('수락 →', g.player.teamId, '로스터 팀', Object.keys(g.rosters).length, 'myLeagues', JSON.stringify(g.myLeagues));
const mid = deserialize(serialize(g));
console.log('비시즌 왕복 로스터 같음', h(mid.rosters) === h(g.rosters), Object.keys(mid.rosters).length);
startNextSeason(g);
console.log('새 시즌', g.league.id, g.league.season, '팀', g.league.teams.length, '로스터', Object.keys(g.rosters).length, '다른 리그', g.otherLeagues?.map((o) => `${o.id} ${o.season} ${o.round}/${o.schedule.length}`).join(' · '), '고른 리그', g.leagueIds?.join(','));
const back = deserialize(serialize(g));
console.log('새 시즌 왕복 로스터 같음', h(back.rosters) === h(g.rosters));
season(g);
console.log('시즌 끝', g.league.id, g.league.season, '순위', g.player.history.at(-1)?.leaguePosition, '이적', g.transfers?.length);
const back2 = deserialize(serialize(g));
console.log('두 시즌 뒤 왕복 로스터 같음', h(back2.rosters) === h(g.rosters));
if (h(back2.rosters) !== h(g.rosters)) {
  for (const id of Object.keys(g.rosters)) if (h(g.rosters[id]) !== h(back2.rosters[id])) console.log(' 다름', id, g.rosters[id]!.players.length, back2.rosters[id]?.players.length);
}
{
  const a = g.rosters['laliga:rma']!.players, b = back2.rosters['laliga:rma']!.players;
  for (let k = 0; k < a.length; k++) if (h(a[k]) !== h(b[k])) {
    const x = a[k] as unknown as Record<string, unknown>, y = b[k] as unknown as Record<string, unknown>;
    console.log(' 선수', x.id, Object.keys({ ...x, ...y }).filter((key) => JSON.stringify(x[key]) !== JSON.stringify(y[key])).map((key) => `${key}: ${JSON.stringify(x[key])} / ${JSON.stringify(y[key])}`).join(' | '));
  }
}
