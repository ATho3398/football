// C.68b 캡처용 세이브: 몇 라운드 진행 + 잔고 넉넉히 + 집·차·기부·투자·TP. 실행: npx vite-node scripts/c68b-save.ts -- <out.json>
import { writeFileSync } from 'node:fs';
import { newGame, playRound } from '../src/game';
import { ensureMoney } from '../src/money';
import { serialize } from '../src/save';
import { donate, moveInvest, setLife } from '../src/wealth';

const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c68b-capture', difficulty: 'normal' });
for (let i = 0; i < 6; i++) playRound(g, { engine: 'quick' });
g.player.reputation = 420;
ensureMoney(g).cash = 1_200_000;
setLife(g, 'house', 2);
setLife(g, 'car', 1);
donate(g, 50000);
moveInvest(g, 'deposit', 100000);
moveInvest(g, 'estate', 50000);
g.cards!.tp = 4;
// 옛 localStorage 슬롯 형식 { meta, state } (initSaves 가 IndexedDB 로 옮긴다)
const meta = { slot: '1', savedAt: new Date().toISOString(), name: g.player.name, season: g.league.season, round: g.league.round, age: g.player.age, startPatch: g.startPatch, date: g.calendar.date };
writeFileSync(process.argv.at(-1)!, JSON.stringify({ meta, state: JSON.parse(serialize(g)) }));
console.log('ok', g.calendar.date);
