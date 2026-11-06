// C.81m 실측: 같은 시드로 시즌을 돌려 시즌 끝(offseason) 상태를 통째로 저장한다 (분석은 c81m-analyze.ts 가 저장본으로).
// 실행: npx vite-node scripts/diag/c81m-run.ts -- <mode=all|mine> <playerId> <seasons> <tag> <outDir>
import { writeFileSync } from 'node:fs';
import { newGame, playRound, startNextSeason, type GameState } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { DEFAULT_LEAGUES } from '../../data/leagues';

const args = process.argv.slice(2).filter((a) => a !== '--');
const mode = (args[0] ?? 'mine') as 'mine' | 'all';
const pid = args[1] ?? 'salah';
const seasons = Number(args[2] ?? 3);
const tag = args[3] ?? 'a';
const out = args[4] ?? '.';
const how = mode === 'all' ? 'engine' : mode;
const t0 = Date.now();
const g: GameState = newGame({ mode: 'real', playerId: pid, seed: `c81m-${tag}-${pid}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
g.options = { ...(g.options ?? {}), others: mode } as never;
for (let s = 0; s < seasons && g.phase !== 'retired'; s++) {
  while (g.phase === 'season') { playRound(g, { engine: 'quick', others: how } as never); autoAllocate(g.player); }
  if (g.phase !== 'offseason') break;
  writeFileSync(`${out}/${mode}-${pid}-${tag}-s${s}.json`, JSON.stringify(g));
  console.error(`${mode} ${pid} season ${s} done ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (s + 1 < seasons) startNextSeason(g);
}
