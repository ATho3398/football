// U17-b 캡처용 세이브 (vite-node): 홈 상태별 — ① 첫날(가이드) ② 경기날 ③ 시즌 중 10경기 뒤 ④ 부상 중 ⑤ 비시즌
// 사용: npx vite-node scripts/u17b-save.ts -- <저장 폴더>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { endDay, isMatchDay, newGame, playOthers, playRound, type GameState } from '../src/game';
import { serialize } from '../src/save';

const dir = process.argv.at(-1)!.endsWith('.ts') ? 'tmp-u17b' : process.argv.at(-1)!;
mkdirSync(dir, { recursive: true });
const fresh = () => newGame({ mode: 'prospect', position: 'CAM', seed: 'u17b-home', difficulty: 'normal' });
const toMatchDay = (g: GameState) => { while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); } };
function play(g: GameState, matches: number): void {
  let n = 0;
  while (g.phase === 'season' && n < matches) {
    if (isMatchDay(g)) { playRound(g, { engine: 'quick' }); n++; } else { playOthers(g, 'quick'); endDay(g); }
  }
}
const put = (name: string, g: GameState) => writeFileSync(join(dir, `${name}.json`), serialize(g));

put('first', fresh());
const md = fresh(); toMatchDay(md); put('matchday', md);
const mid = fresh(); play(mid, 10); endDay(mid); put('mid', mid);
const inj = fresh(); play(inj, 6);
inj.player.injury = { grade: 'moderate', weeksTotal: 3, daysTotal: 21, daysLeft: 14, season: inj.league.season, round: inj.league.round, permanent: {} };
put('injured', inj);
const off = fresh(); play(off, 999); put('offseason', off);
console.log('ok', dir);
