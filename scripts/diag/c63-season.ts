// C.63: 한 시즌(빠른 경기)을 돌려 인박스·이벤트·라이벌·경질을 본다
import { newGame, playRound, startNextSeason, selectableRealPlayers } from '../../src/game';
const seed = process.argv[2] ?? 'c63';
const p = selectableRealPlayers().find((x) => x.position === 'ST')!;
const g = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
const t0 = Date.now();
for (let s = 0; s < 2; s++) {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
  if (s === 0) startNextSeason(g);
}
console.log('ms', Date.now() - t0, 'items', g.inbox?.items.length, 'rival', g.rival?.id, 'captain', g.captain, 'coaches', g.coaches);
for (const it of g.inbox?.items ?? []) console.log(it.season, it.date, it.cat, it.title, '|', it.body.slice(0, 70), it.answer ? `→ ${it.answer.label}${it.answer.auto ? '(자동)' : ''}` : '');
void p;
