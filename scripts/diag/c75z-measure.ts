// C.75z 측정: 커리어 10시즌 빠른 경기로 티어별 소집률 · 연간 A매치 수 · 대회 성적 분포
// 실행: npx vite-node scripts/diag/c75z-measure.ts -- [시즌 수=10]
import { endDay, isMatchDay, newGame, playOthers, playRound, startNextSeason, type GameState } from '../../src/game';
import { ensureNational } from '../../src/national';
import { reputationTier } from '../../src/growth';
const seasons = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 10);
const starts: [string, Parameters<typeof newGame>[0]][] = [
  ['유망주 ST', { mode: 'prospect', position: 'ST', seed: 'm1', difficulty: 'normal' }],
  ['유망주 CM', { mode: 'prospect', position: 'CM', seed: 'm2', difficulty: 'normal' }],
  ['유망주 CB', { mode: 'prospect', position: 'CB', seed: 'm3', difficulty: 'normal' }],
  ...(['son', 'salah', 'mane', 'kane', 'sterling', 'van-dijk', 'de-bruyne', 'pogba', 'hazard'] as const).map((id, k) => [id, { mode: 'real', playerId: id, seed: `m${k + 4}`, difficulty: 'normal' }] as [string, Parameters<typeof newGame>[0]]),
];
const byTier: Record<string, [number, number]> = {};
const perSeason: number[] = [];
const reach: Record<string, Record<string, number>> = {};
const t0 = Date.now();
for (const [name, opts] of starts) {
  let g: GameState;
  try { g = newGame(opts); } catch { console.log('skip', name); continue; }
  const nat = ensureNational(g);
  for (let s = 0; s < seasons; s++) {
    const before = nat.fixtures.length;
    while (g.phase === 'season') {
      const tier = reputationTier(g.player.reputation, g.player.honors);
      const known = new Set(Object.keys(nat.calls));
      if (isMatchDay(g)) playRound(g, { engine: 'quick' }); else { playOthers(g, 'quick'); endDay(g); }
      for (const [k, v] of Object.entries(nat.calls)) if (!known.has(k)) { const b = (byTier[tier] ??= [0, 0]); b[0]++; if (v) b[1]++; }
    }
    perSeason.push(nat.fixtures.slice(before).filter((m) => (m.min ?? 0) > 0).length);
    const t = g.lastSeasonSummary?.nat;
    const tr = nat.tournaments.at(-1);
    if (t?.label && t.reach && tr && tr.year === g.league.season + 1) {
      const comp = tr.comp === 'wc' ? '월드컵' : '대륙컵';
      const r = (reach[comp] ??= {});
      const key = tr.called ? tr.reach : tr.qualified ? '미소집' : '본선 실패';
      r[key] = (r[key] ?? 0) + 1;
    }
    if (g.phase === 'offseason') startNextSeason(g); else break;
  }
  console.log(name, ensureNational(g).nation, 'A매치', nat.career.apps, '골', nat.career.goals, '대회', nat.honors.map((h) => `${h.year}${h.comp}:${h.reach}`).join(' '));
}
console.log('티어별 소집(판정 수, 소집, 비율)', Object.fromEntries(Object.entries(byTier).map(([k, [n, c]]) => [k, `${n} / ${c} / ${(c / n * 100).toFixed(0)}%`])));
const avg = perSeason.reduce((a, b) => a + b, 0) / perSeason.length;
console.log('시즌당 출전 A매치 평균', avg.toFixed(2), '분포', perSeason.reduce((m, x) => ((m[x] = (m[x] ?? 0) + 1), m), {} as Record<number, number>));
console.log('대회 성적', JSON.stringify(reach));
console.log('시간', ((Date.now() - t0) / 1000).toFixed(0), '초');
