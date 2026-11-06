// C.81l 캡처용 세이브 만들기: 월드클래스 손흥민(한국) 2018-19 시즌을 빠른 경기로 클럽 시즌 끝까지 → 2019 아시안컵 소집 → 조별 1차전 아침(또는 --camp 소집일 아침)에서 serialize.
// 사용: npx vite-node scripts/c81l-save.ts -- <out.json> [--camp] [--seed c81l]
import { writeFileSync } from 'node:fs';
import { BALANCE } from '../src/config/balance';
import { clubSeasonOver, endDay, isMatchDay, newGame, playOthers, playRound } from '../src/game';
import { ensureNational } from '../src/national';
import { serialize } from '../src/save';
import { daysBetween } from '../src/calendar';

const args = process.argv.slice(2).filter((a) => a !== '--');
const out = args.find((a) => !a.startsWith('--')) ?? 'docs/captures/c81l/save-c81l.json';
const seedAt = args.indexOf('--seed');
const seed = seedAt >= 0 ? args[seedAt + 1]! : 'c81l';
const atCamp = args.includes('--camp');
const g = newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });
g.player.reputation = BALANCE.reputation.tierCuts.worldClass + 1;
g.options = { others: 'quick' };
while (g.phase === 'season' && !clubSeasonOver(g)) playRound(g, { engine: 'quick' });
const nat = ensureNational(g);
if (!nat.live) throw new Error(`소집 안 됨 (seed ${seed}): ${JSON.stringify(nat.summer)}`);
const stopAt = atCamp ? nat.live.camp : nat.fixtures.find((m) => m.key.startsWith('t:'))!.date;
while (g.phase === 'season' && daysBetween(g.calendar.date, stopAt) > 0 && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
writeFileSync(out, serialize(g));
console.log(`${out}: ${g.calendar.date} · ${nat.live.id} 소집일 ${nat.live.camp} 첫 경기 ${nat.live.start} · 내 경기 ${nat.fixtures.filter((m) => m.key.startsWith('t:')).map((m) => `${m.date} ${m.stage} ${m.opp}`).join(', ')}`);
