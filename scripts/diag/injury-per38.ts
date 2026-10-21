// C.77m 진단: balance.ts [부상] "38경기 풀타임 환산" 가드만 빠르게 (최적 배분, 빠른 경기, 같은 시드 balance-<티어>-<i>)
// 실행: npx vite-node scripts/diag/injury-per38.ts -- [티어당 시드 수=8]   환경 변수 FFROM·FPP = injury.fatigueFrom·fatiguePerPoint 덮어쓰기
import { newGame, playRound, startNextSeason } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { BALANCE } from '../../src/config/balance';
import { setEnvironmentFixed } from '../../src/weather';
import type { Tier } from '../../src/types';

setEnvironmentFixed(true);
const I = BALANCE.injury as { fatigueFrom: number; fatiguePerPoint: number };
if (process.env.FFROM) I.fatigueFrom = Number(process.env.FFROM);
if (process.env.FPP) I.fatiguePerPoint = Number(process.env.FPP);
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 8);
const TIERS: Tier[] = ['normal', 'topClass', 'worldClass', 'legendary'];
let inj = 0;
let min = 0;
for (const tier of TIERS) {
  for (let i = 0; i < N; i++) {
    const s = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
    s.player.potentialTier = tier;
    while (s.player.age < 37) {
      while (s.phase === 'season') {
        playRound(s, { engine: 'quick' });
        autoAllocate(s.player);
      }
      const h = s.player.history.at(-1)!;
      inj += h.injuries;
      min += h.minutes;
      if (s.phase !== 'offseason') break;
      startNextSeason(s);
    }
  }
}
console.log(`풀타임 환산 ${((inj / min) * 90 * 38).toFixed(3)} (부상 ${inj}, 분 ${min}, fatigueFrom ${I.fatigueFrom}, perPoint ${I.fatiguePerPoint})`);
