// C.42 회귀: 이적이 꺼진 경로(첫 시즌 1월 이적시장 전)의 게임 지문. C.41 과 C.42 에서 같아야 한다.
// 실행: npx vite-node scripts/diag/c42-pre-window.ts
import { createHash } from 'node:crypto';
import { newGame, playRound } from '../../src/game';

const out = createHash('sha256');
for (const [i, opts] of ([
  { mode: 'prospect', position: 'ST', seed: 'c42-a', difficulty: 'normal' },
  { mode: 'real', playerId: 'son', seed: 'c42-b', difficulty: 'normal' },
] as const).entries()) {
  const g = newGame(opts as never);
  while (g.phase === 'season' && g.calendar.date < '2018-12-31') playRound(g, { engine: i === 0 ? 'agent' : 'quick', others: 'quick' });
  const pick = {
    date: g.calendar.date, table: g.league.table, ratings: g.league.teams.map((t) => t.rating),
    player: { ...g.player, history: g.player.history }, log: g.matchLog.map((m) => [m.round, m.goalsFor, m.goalsAgainst, m.rating, m.minutes]),
    rosters: Object.values(g.rosters).map((r) => r.players.map((p) => [p.id, p.age, p.attributes ?? p.gk])),
  };
  const h = createHash('sha256').update(JSON.stringify(pick)).digest('hex').slice(0, 12);
  console.log(`게임 ${i}: ${g.calendar.date} ${g.league.round}R ${h}`);
  out.update(h);
}
console.log(`지문 ${out.digest('hex').slice(0, 16)}`);
