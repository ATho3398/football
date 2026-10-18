import { newGame, playRound, calendarOf, myMatchDates, startNextSeason } from '../src/game';
import { daysBetween } from '../src/calendar';
import { reachLabel, stageName } from '../src/cups';
const t0 = Date.now();
for (const seed of ['c67a', 'c67b', 'c67c']) {
  const g = newGame({ mode: 'real', playerId: 'salah', seed, difficulty: 'normal' } as never);
  for (let season = 0; season < 2; season++) {
    const fa = g.cups!.fa!;
    console.log(seed, g.league.season, 'dates', fa.dates.join(' '), 'final league', calendarOf(g).final);
    const reports: string[] = [];
    while (g.phase === 'season') {
      const r = playRound(g, { engine: 'quick' });
      if (r.cup) reports.push(`${r.cup.stage} ${r.opponentId} ${r.result.goalsFor}-${r.result.goalsAgainst}${r.cup.pens ? ` p${r.cup.pens}` : ''} ${r.cup.through ? '통과' : '탈락'}`);
    }
    const ds = myMatchDates(g);
    let minGap = 99;
    for (let i = 1; i < ds.length; i++) minGap = Math.min(minGap, daysBetween(ds[i - 1]!, ds[i]!));
    console.log(' my cup:', reports.join(' | '), '· winner', fa.winner, '· me', reachLabel(fa, g.player.teamId), '· minGap', minGap, '· date', g.calendar.date, g.phase, 'stages', fa.rounds.map((r, s) => stageName(fa, s) + r.length).join(','));
    if (g.phase === 'offseason') startNextSeason(g);
  }
}
console.log('ms', Date.now() - t0);
