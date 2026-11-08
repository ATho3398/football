// U17-c 캡처용 세이브 (vite-node): 경기 준비 · 결정 순간 — ① 첫 경기 날(첫 경기) ② 시즌 중 경기 날(덱 · 전술 열림) ③ 직접 모드 경기 날
// 사용: npx vite-node scripts/u17c-save.ts -- <저장 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { serialize } from '../src/save';

const dir = process.argv.at(-1)!.endsWith('.ts') ? 'tmp-u17c' : process.argv.at(-1)!;
mkdirSync(dir, { recursive: true });
const fresh = () => newGame({ mode: 'real', playerId: 'son', seed: 'u17c-prep', difficulty: 'normal' });
const toMatchDay = (g: GameState) => { while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); } };
function play(g: GameState, matches: number): void {
  let n = 0;
  while (g.phase === 'season' && n < matches) {
    if (isMatchDay(g)) { playRound(g, { engine: 'quick' }); n++; } else { playOthers(g, 'quick'); endDay(g); }
  }
}
const put = (name: string, g: GameState) => writeFileSync(join(dir, `${name}.json`), serialize(g));

const first = fresh(); first.options = { others: 'quick' }; toMatchDay(first); put('first', first);
const mid = fresh(); mid.options = { others: 'quick' }; play(mid, 10); toMatchDay(mid);
mid.player.injury = null; mid.player.suspended = 0; mid.player.fatigue = 0;
mid.control = { mode: 'auto', stop: 'important' }; put('mid', mid);
const direct = structuredClone(mid); direct.control = { mode: 'direct', stop: 'all' }; put('direct', direct);
console.log('ok', dir, mid.calendar.date, mid.league.round);
