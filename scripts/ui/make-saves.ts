// UI_6 전체 캡처용 세이브 (docs/ui-requests/17-full): 화면 상태별 세이브를 JSON 내보내기 형식으로 만든다.
// 실행: npx vite-node scripts/ui/make-saves.ts -- <저장 폴더>   (capture-all.ts 가 먼저 부른다)
import { mkdirSync, writeFileSync } from 'node:fs';
import { newGame, playRound, startNextSeason, retire, selectableRealPlayers } from '../../src/game';
import { serialize } from '../../src/save';
import { autoAllocate } from '../../src/growth';
import type { GameState } from '../../src/game';

const out = process.argv.at(-1)!.startsWith('-') ? 'tmp-saves' : process.argv.at(-1)!;
mkdirSync(out, { recursive: true });
const save = (name: string, g: GameState) => {
  writeFileSync(`${out}/${name}.json`, `{"kind":"football-career-save","meta":{},"state":${serialize(g)}}`);
  console.log('saved', name, g.calendar.date, g.phase, 'round', g.league.round, 'age', g.player.age);
};
const until = (g: GameState, date: string, alloc = true) => {
  while (g.phase === 'season' && g.calendar.date < date) {
    playRound(g, { engine: 'quick' });
    if (alloc) autoAllocate(g.player);
  }
};

// A. 실제 선수 시즌 중 (챔스 팀) — 10월·3월
const reals = selectableRealPlayers();
const pick = reals.find((p) => p.id === 'salah') ?? reals[0]!;
const a = newGame({ mode: 'real', playerId: pick.id, seed: 'ui6-a', difficulty: 'normal' } as never);
until(a, '2018-10-25', false);
save('A1_real-oct', a);
until(a, '2019-03-20');
save('A2_real-mar', a);
while (a.phase === 'season') { playRound(a, { engine: 'quick' }); autoAllocate(a.player); }
save('A3_real-offseason', a);
startNextSeason(a);
until(a, '2019-09-25');
save('A4_real-s2-sep', a);

// B. 가상 유망주 — 몇 경기 뒤 (포인트 남김) · 시즌 끝
const b = newGame({ mode: 'prospect', name: '김민준', position: 'ST', seed: 'ui6-b', difficulty: 'normal' } as never);
until(b, '2018-09-15', false);
save('B1_prospect-sep', b);
while (b.phase === 'season') playRound(b, { engine: 'quick' });
save('B2_prospect-offseason', b);

// C. 가장 나이 많은 실제 선수 → 은퇴 가능해질 때까지 시즌을 돌린 뒤 은퇴 (여러 시즌 기록·시상 이력)
const old = [...reals].sort((x, y) => x.birthYear - y.birthYear)[0]!;
const c = newGame({ mode: 'real', playerId: old.id, seed: 'ui6-c', difficulty: 'normal' } as never);
for (let s = 0; s < 8; s++) {
  while (c.phase === 'season') { playRound(c, { engine: 'quick' }); autoAllocate(c.player); }
  if (c.phase !== 'offseason' || c.lastSeasonSummary?.canRetire) break;
  startNextSeason(c);
}
save('C1_old-offseason', c);
retire(c);
save('C2_retired', c);
