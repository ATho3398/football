// C.76j 확인 캡처용 세이브: 실제 선수(살라 · 리버풀 · 챔스) 시즌 진행 단계별 3개.
// 실행: npx vite-node scripts/c76j-saves.ts -- <저장 폴더>
import { writeFileSync, mkdirSync } from 'node:fs';
import { newGame, playRound } from '../src/game';
import { serialize } from '../src/save';

// 옛 localStorage 형식 { meta, state } — 불러오면 IndexedDB 로 옮겨진다
const file = (g: ReturnType<typeof newGame>) => `{"meta":${JSON.stringify({ slot: '1', savedAt: new Date().toISOString(), name: g.player.name, season: g.league.season, round: g.league.round, age: g.player.age, date: g.calendar.date })},"state":${serialize(g)}}`;

const out = process.argv[2] ?? 'c76j-saves';
mkdirSync(out, { recursive: true });
const g = newGame({ mode: 'real', playerId: 'salah', seed: 'c76j', difficulty: 'normal' } as never);
const stops = ['2018-09-20', '2019-03-20'];
for (const stop of stops) {
  while (g.phase === 'season' && g.calendar.date < stop) playRound(g, { engine: 'quick' });
  writeFileSync(`${out}/${stop}.json`, file(g));
  console.log('saved', stop, g.calendar.date, g.league.round, 'ucl', !!g.cups?.ucl);
}
while (g.phase === 'season') playRound(g, { engine: 'quick' });
writeFileSync(`${out}/end.json`, file(g));
console.log('saved end', g.calendar.date, g.phase);
