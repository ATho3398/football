// C.80b 빠른 경기 무승부 보정 정확 계산 (전 리그 모든 팀 쌍): npx vite-node scripts/diag/c80b-exact.ts
import { BALANCE } from '../../src/config/balance';
import { allLeagueData } from '../../data/leagues';
const M = BALANCE.match;
const fact = [1]; for (let i = 1; i < 30; i++) fact[i] = fact[i - 1]! * i;
const pois = (l: number, k: number) => Math.exp(-l) * l ** k / fact[k]!;
function exact(hr: number, c: number, rho: number, neutral = false) {
  let w = 0, d = 0, l = 0, g = 0, z = 0, n = 0;
  for (const D of allLeagueData()) for (const h of D.teams) for (const a of D.teams) {
    if (h === a) continue;
    const lh = M.baseGoals * Math.exp((h.rating - a.rating + (neutral ? 0 : hr)) * M.goalsK);
    const la = M.baseGoals * Math.exp((a.rating - h.rating) * M.goalsK);
    const s = c * Math.min(lh, la);
    let tot = 0; const P: number[][] = [];
    for (let x = 0; x < 15; x++) { P[x] = []; for (let y = 0; y < 15; y++) {
      let p = 0; for (let k = 0; k <= Math.min(x, y); k++) p += pois(lh - s, x - k) * pois(la - s, y - k) * pois(s, k);
      let tau = 1; if (x === 0 && y === 0) tau = 1 - lh * la * rho; else if (x === 0 && y === 1) tau = 1 + lh * rho; else if (x === 1 && y === 0) tau = 1 + la * rho; else if (x === 1 && y === 1) tau = 1 - rho;
      P[x]![y] = p * tau; tot += p * tau; } }
    for (let x = 0; x < 15; x++) for (let y = 0; y < 15; y++) { const p = P[x]![y]! / tot; if (x > y) w += p; else if (x === y) d += p; else l += p; g += p * (x + y) / 2; if (!x && !y) z += p; }
    n++;
  }
  return `W/D/L ${(100 * w / n).toFixed(1)}/${(100 * d / n).toFixed(1)}/${(100 * l / n).toFixed(1)} 팀득점 ${(g / n).toFixed(3)} 0-0 ${(100 * z / n).toFixed(1)}%`;
}
for (const [hr, c, rho] of [[3.4,0,-0.13],[3.4,0,-0.17],[3.4,0,-0.2],[3.8,0,-0.15],[4.0,0,-0.15],[4.0,0,-0.17],[4.4,0,-0.17]] as const)
  console.log(`hr ${hr} c ${c} rho ${rho}:`, exact(hr, c, rho), '| 중립', exact(hr, c, rho, true));
