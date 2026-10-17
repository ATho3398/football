// C.37 진단: 가상 유망주 첫 시즌들의 시즌 평균 평점 — 에이전트 엔진 vs 빠른 경기 (포변 조언 기준 6.2 확인용)
// 실행: npx vite-node scripts/diag/apt-rating-agent.ts -- [명] [시즌]
import { autoAllocate } from '../../src/growth';
import { rollProspect } from '../../src/aptitude';
import { newGame, playRound, startNextSeason } from '../../src/game';

const args = ((globalThis as { process?: { argv: string[] } }).process?.argv ?? []).slice(2).filter((a) => a !== '--');
const N = Number(args[0] ?? 8);
const S = Number(args[1] ?? 2);
for (const engine of ['quick', 'agent'] as const) {
  const rows: string[] = [];
  const all: number[] = [];
  for (let i = 0; i < N; i++) {
    const seed = `apt-career-${i}`;
    const g = newGame({ mode: 'prospect', position: rollProspect(seed).candidates[0]!.pos, seed, difficulty: 'normal', rolled: true });
    const out: string[] = [];
    for (let s = 0; s < S; s++) {
      while (g.phase === 'season') {
        playRound(g, { engine });
        autoAllocate(g.player);
      }
      const h = g.player.history.at(-1)!;
      const r = h.apps ? h.ratingSum / h.apps : 0;
      if (h.apps >= 10) all.push(r);
      out.push(`${h.age}세 ${h.apps}경기 ${r.toFixed(2)}`);
      startNextSeason(g);
    }
    rows.push(`  ${g.player.position.padEnd(4)} ${out.join(' · ')}`);
  }
  console.log(`[${engine}] 평균 ${(all.reduce((t, x) => t + x, 0) / all.length).toFixed(2)} · ≤6.2 ${all.filter((x) => x <= 6.2).length}/${all.length}`);
  console.log(rows.join('\n'));
}
