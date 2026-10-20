// C.75y 캡처용 세이브: PL 유망주 + 다른 리그 4개를 겨울 이적시장 뒤(2월)까지 · K리그1 에서 시작한 새 게임. .fcsave.gz 로 쓴다
// 실행: npx vite-node scripts/diag/c75y-saves.ts -- <저장 폴더>
import { writeFileSync, mkdirSync } from 'node:fs';
import { newGame, playRound, endDay, isMatchDay, playOthers } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { exportSave } from '../../src/save';

const out = process.argv.slice(2).find((a) => a !== '--') ?? '.';
mkdirSync(out, { recursive: true });
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75y-cap', difficulty: 'normal', leagues: ['pl', 'laliga', 'bundesliga', 'mls', 'kleague1'] });
while (g.calendar.date < '2019-02-04' && g.phase === 'season') {
  while (g.phase === 'season' && !isMatchDay(g) && g.calendar.date < '2019-02-04') { playOthers(g, 'quick'); endDay(g); }
  if (g.calendar.date >= '2019-02-04' || g.phase !== 'season') break;
  playRound(g, { engine: 'quick', others: 'quick' });
  autoAllocate(g.player);
}
console.log('세이브 A', g.calendar.date, g.league.round, '이적', g.transfers?.length, '실제 보충', g.transfers?.filter((r) => r.fill?.real).map((r) => r.fill!.name).join(', '));
writeFileSync(`${out}/c75y-a.fcsave.gz`, await exportSave(g));
const k = newGame({ mode: 'real', playerId: 'messi', seed: 'c75y-cap', difficulty: 'normal', leagues: ['laliga', 'pl', 'seriea'] });
writeFileSync(`${out}/c75y-b.fcsave.gz`, await exportSave(k));
console.log('세이브 B', k.league.id, k.player.teamId, k.calendar.date);
