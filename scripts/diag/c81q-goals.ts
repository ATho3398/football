// C.81q: 리그별 경기당 골 — 전부 엔진 저장본(모든 리그, 내 리그 포함) 대 같은 시드 빠른 진행(다른 리그). 실행: npx vite-node scripts/diag/c81q-goals.ts -- <snapDir> [maxSeason=0]
import { readdirSync, readFileSync } from 'node:fs';
import { newGame, type GameState } from '../../src/game';
import { finishOtherSeason } from '../../src/otherLeagues';
import { DEFAULT_LEAGUES } from '../../data/leagues';
import type { LeagueState } from '../../src/league';

const args = process.argv.slice(2).filter((a) => a !== '--');
const dir = args[0]!;
const maxS = Number(args[1] ?? 0);
const acc: Record<string, { e: [number, number]; q: [number, number] }> = {};
const add = (lg: LeagueState, k: 'e' | 'q') => {
  const A = ((acc[lg.id] ??= { e: [0, 0], q: [0, 0] })[k]);
  for (const f of lg.schedule.flat()) if (f.homeGoals !== undefined) { A[0] += f.homeGoals + f.awayGoals!; A[1]++; }
};
const pids = new Set<string>();
for (const f of readdirSync(dir).filter((f) => /^all-.*-s\d+\.json$/.test(f))) {
  const m = /^all-(\w+?)-(\w+)-s(\d+)\.json$/.exec(f)!;
  if (Number(m[3]) > maxS) continue;
  pids.add(m[1]!);
  const g = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')) as GameState;
  add(g.league, 'e');
  for (const o of g.otherLeagues ?? []) add(o, 'e');
}
for (const pid of pids) for (let r = 0; r < 3; r++) {
  const g: GameState = newGame({ mode: 'real', playerId: pid, seed: `c81m-a-${pid}${r ? `-r${r}` : ''}`, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
  for (const lg of g.otherLeagues ?? []) { finishOtherSeason(g.worldSeed, lg, g.npcs); add(lg, 'q'); }
}
for (const [id, { e, q }] of Object.entries(acc)) console.log(`${id}\t엔진 ${(e[0] / e[1]).toFixed(3)} (${e[1]})\t빠른 ${(q[0] / q[1]).toFixed(3)} (${q[1]})\t비 ${((e[0] / e[1]) / (q[0] / q[1])).toFixed(3)}`);
