// 진단 (C.26 평점 재보정): 실제 선수 ST/CF 커리어(빠른 경기)의 골 수별 시즌 평균 평점, 평점 상수를 환경 변수로 바꿔 본다
// R='{"perOvrDiff":0.025}' X='{"ratingBase":4.3}' vite-node scripts/diag/rating-real-st.ts -- [시드 수]
import { BALANCE } from '../../src/config/balance';
import { autoAllocate } from '../../src/growth';
import { newGame, playRound, selectableRealPlayers, startNextSeason } from '../../src/game';

const args = process.argv.slice(2).filter((a) => a !== '--');
const seeds = Number(args[0] ?? 6);
Object.assign(BALANCE.rating, JSON.parse(process.env.R ?? '{}'));
Object.assign(BALANCE.matchXp, JSON.parse(process.env.X ?? '{}'));
Object.assign(BALANCE.form, JSON.parse(process.env.F ?? '{}'));
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const seasons: { goals: number; apps: number; r: number; age: number }[] = [];
for (const d of selectableRealPlayers()) {
  for (let i = 0; i < seeds; i++) {
    const g = newGame({ mode: 'real', playerId: d.id, seed: `real-all-${d.id}-${i}`, difficulty: 'normal' });
    if (g.player.position !== 'ST' && g.player.position !== 'CF') break;
    while (g.player.age < 37) {
      while (g.phase === 'season') {
        playRound(g, { engine: 'quick' });
        autoAllocate(g.player);
      }
      const h = g.player.history.at(-1)!;
      if (h.apps >= 25) seasons.push({ goals: h.goals, apps: h.apps, r: h.ratingSum / h.apps, age: h.age });
      if (g.phase !== 'offseason') break;
      startNextSeason(g);
    }
  }
}
for (const [lo, hi] of [[0, 8], [9, 16], [17, 23], [24, 30], [31, 99]] as const) {
  const xs = seasons.filter((s) => s.goals >= lo && s.goals <= hi);
  console.log(`${lo}~${hi}골 ${xs.length}시즌 평균 평점 ${avg(xs.map((s) => s.r)).toFixed(2)}`);
}
process.exit(0);
