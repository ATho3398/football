// C.80b 빠른 경기 20시즌 표본 전후 (실제 simulateScore): npx vite-node scripts/diag/c80b-sample.ts
import { BALANCE } from '../../src/config/balance';
import { allLeagueData } from '../../data/leagues';
import { simulateScore } from '../../src/league';
import { createRng, hashSeed } from '../../src/rng';
function run(rho: number, neutral = false) {
  (BALANCE.match as { drawRho: number }).drawRho = rho;
  let w = 0, d = 0, l = 0, g = 0, z = 0, n = 0;
  for (let s = 0; s < 20; s++) for (const D of allLeagueData()) {
    const rng = createRng(hashSeed(`c80b:${s}:${D.id}`));
    for (const h of D.teams) for (const a of D.teams) {
      if (h === a) continue;
      const [x, y] = simulateScore(rng, h.rating, a.rating, neutral);
      if (x > y) w++; else if (x === y) d++; else l++; g += x + y; if (!x && !y) z++; n++;
    }
  }
  const p = (v: number) => (100 * v / n).toFixed(1);
  return `${n}경기 홈 ${p(w)}/${p(d)}/${p(l)} · 팀 득점 ${(g / n / 2).toFixed(3)} · 0-0 ${p(z)}%`;
}
console.log('전 (ρ 0)   ', run(0)); console.log('후 (ρ −0.17)', run(-0.17));
console.log('중립 전', run(0, true)); console.log('중립 후', run(-0.17, true));
