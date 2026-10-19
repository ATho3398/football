// C.68b 경제 점검 보정용 (빠름): 코치 풀 투자 + 평범한 지출(autoSpend) 커리어를 일반·레전더리 최적 배분으로 돌려 누적 순수입·순자산·자산 점수를 본다.
// 실행: SEEDS=12 npx vite-node scripts/c68b-econ.ts. 환경 AS='{"houseCash":2.5,...}' 로 AUTO_SPEND 덮어쓰기, UPKEEP='[0.03,0.05]'
import { autoMarket, newGame, playRound, startNextSeason } from '../src/game';
import { autoAllocate } from '../src/growth';
import { autoStaff, CHOICE_CATS, ensureMoney, flowsIn, flowsOut } from '../src/money';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { BALANCE } from '../src/config/balance';
import { assetScore, AUTO_SPEND, autoSpend, careerNet, netWorth } from '../src/wealth';
import type { Tier } from '../src/types';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const N = Number(env.SEEDS ?? 12);
if (env.AS) Object.assign(AUTO_SPEND, JSON.parse(env.AS));
if (env.UPKEEP) {
  const [h, c] = JSON.parse(env.UPKEEP);
  Object.assign(BALANCE.wealth as object, { houseUpkeep: h, carUpkeep: c });
}
const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))]!;
for (const tier of ['normal', 'legendary'] as Tier[]) {
  const rows: { career: number; worth: number; neg: number; seasons: number; net30: number; rep30: number }[] = [];
  for (let i = 0; i < N; i++) {
    const state = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
    state.player.potentialTier = tier;
    let neg = 0;
    let seasons = 0;
    let net30 = 0;
    let rep30 = 0;
    while (state.player.age < 37) {
      while (state.phase === 'season') {
        playRound(state, { engine: 'quick' });
        autoStaff(state);
        autoAllocate(state.player);
      }
      autoAllocate(state.player);
      if (state.phase !== 'offseason') break;
      autoMarket(state, 'stay');
      startNextSeason(state);
      const h = ensureMoney(state).history.at(-1)!;
      const net = flowsIn(h.flows) - flowsOut(h.flows);
      if (net - CHOICE_CATS.reduce((t, c) => t + (h.flows[c] ?? 0), 0) < 0) neg++;
      seasons++;
      if (state.player.age - 1 === 30) { net30 = net; rep30 = state.player.reputation; }
      autoSpend(state);
    }
    rows.push({ career: careerNet(state), worth: netWorth(state), neg, seasons, net30, rep30 });
  }
  const w = rows.map((r) => r.worth / 1e4);
  const s = rows.map((r) => assetScore(r.worth));
  const c = rows.map((r) => r.career / 1e4);
  console.log(`${tier}: 누적 순수입 중앙 ${q(c, 0.5).toFixed(0)}억(평균 ${(c.reduce((a, b) => a + b, 0) / N).toFixed(0)}) · 순자산 중앙 ${q(w, 0.5).toFixed(0)}억(10% ${q(w, 0.1).toFixed(0)} · 90% ${q(w, 0.9).toFixed(0)})` +
    ` · 자산 점수 평균 ${(s.reduce((a, b) => a + b, 0) / N).toFixed(1)} 중앙 ${q(s, 0.5)} · 30세 순수입 중앙 ${(q(rows.map((r) => r.net30), 0.5) / 1e4).toFixed(1)}억 · 30세 위상 중앙 ${q(rows.map((r) => r.rep30), 0.5)}` +
    ` · 음수 시즌 ${rows.reduce((t, r) => t + r.neg, 0)}/${rows.reduce((t, r) => t + r.seasons, 0)}`);
}
