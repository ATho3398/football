// C.75m 시즌 지문·속도: 같은 시드로 시즌을 돌려 상태 해시와 시즌 시간을 잰다. PL만 고른 게임은 C.75m 전후 지문이 같아야 한다.
// 실행: npx vite-node scripts/diag/c75m-season.ts -- [시즌 수(기본 1)] [leagues=pl,laliga,...] [engine]
import { createHash } from 'node:crypto';
import { newGame, playOthers, playRound, startNextSeason, endDay, isMatchDay } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { registerFakeLeagues } from './c75m-fake-leagues';

const seasons = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 1);
const leaguesArg = process.argv.find((a) => a.startsWith('leagues='))?.slice(8).split(',');
if (leaguesArg) registerFakeLeagues(leaguesArg);
const how = process.argv.includes('engine') ? 'engine' : 'quick';
/** C.75m 에서 더한 필드는 지문에서 뺀다 (옛 커밋에는 없다) */
const NEW = new Set(['otherLeagues', 'leagueIds', 'saveFormat', 'id', 'country', 'tier']);
const strip = (v: unknown): unknown => JSON.parse(JSON.stringify(v, (k, x) => (NEW.has(k) ? undefined : x)));
const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75m-fp', difficulty: 'normal', ...(leaguesArg ? { leagues: leaguesArg } : {}) } as Parameters<typeof newGame>[0]);
for (let s = 0; s < seasons; s++) {
  const t0 = performance.now();
  while (g.phase === 'season') {
    while (g.phase === 'season' && !isMatchDay(g)) { playOthers(g, how); endDay(g); }
    if (g.phase !== 'season') break;
    playRound(g, { others: how });
    autoAllocate(g.player);
  }
  const ms = performance.now() - t0;
  const h = createHash('sha256').update(JSON.stringify([strip(g.league), strip(g.player), g.playerStats, g.calendar])).digest('hex').slice(0, 16);
  console.log(`${g.league.season} 시즌 지문 ${h} · 시즌 계산 ${(ms / 1000).toFixed(1)}초 (다른 경기 ${how})`);
  const others = (g as { otherLeagues?: { id: string; season: number; round: number; schedule: unknown[] }[] }).otherLeagues;
  if (others) console.log(`  다른 리그: ${others.map((l) => `${l.id} ${l.season} ${l.round}/${l.schedule.length}`).join(' · ')}`);
  startNextSeason(g);
}
