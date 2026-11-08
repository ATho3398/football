// U17-e 캡처용 세이브 (vite-node): 훈련 · 선수 — ① 시즌 중 훈련일(손흥민) ② 같은 날 부상 3주 ③ 비시즌 ④ 17세 유망주 ⑤ 은퇴
// 사용: npx vite-node scripts/u17e-save.ts -- <저장 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endDay, isMatchDay, newGame, playOthers, playRound, retire, type GameState } from '../src/game';
import { serialize } from '../src/save';
import { addCustomPreset } from '../src/training';

const dir = process.argv.at(-1)!.endsWith('.ts') ? 'tmp-u17e' : process.argv.at(-1)!;
mkdirSync(dir, { recursive: true });
function play(g: GameState, matches: number): void {
  let n = 0;
  while (g.phase === 'season' && n < matches) {
    if (isMatchDay(g)) { playRound(g, { engine: 'quick' }); n++; } else { playOthers(g, 'quick'); endDay(g); }
  }
}
const put = (name: string, g: GameState) => writeFileSync(join(dir, `${name}.json`), serialize(g));

const mid = newGame({ mode: 'real', playerId: 'son', seed: 'u17e-mid', difficulty: 'normal' });
mid.options = { others: 'quick' }; play(mid, 9);
// 경기 다음 날(훈련일)에서 멈춤
if (isMatchDay(mid)) { playRound(mid, { engine: 'quick' }); }
mid.player.injury = null; mid.player.suspended = 0; mid.player.unspentPoints = 6;
addCustomPreset(mid.training!, '슈팅 집중', ['tech', 'intense', 'recovery', 'tech', 'video', 'tech', 'rest']);
put('mid', mid);
const inj = structuredClone(mid);
inj.player.injury = { grade: 'moderate', weeksTotal: 3, daysTotal: 21, daysLeft: 21, date: inj.calendar.date, season: inj.league.season, round: inj.league.round + 1, permanent: {}, ret: 'full' } as GameState['player']['injury'];
put('injured', inj);
const off = structuredClone(mid);
while (off.phase === 'season') { if (isMatchDay(off)) playRound(off, { engine: 'quick' }); else { playOthers(off, 'quick'); endDay(off); } }
put('offseason', off);
const pro = newGame({ mode: 'prospect', position: 'RW', seed: 'u17e-pro', difficulty: 'normal', name: '김민준' });
pro.options = { others: 'quick' }; play(pro, 3); put('prospect', pro);
const ret = newGame({ mode: 'prospect', position: 'ST', seed: 'u17e-ret', difficulty: 'normal', name: '김은퇴' });
ret.player.age = 34;
while (ret.phase === 'season') playRound(ret, { engine: 'quick' });
retire(ret); put('retired', ret);
console.log('ok', dir, mid.calendar.date, mid.league.round, off.phase, pro.player.age, ret.phase);
