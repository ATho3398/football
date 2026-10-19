// C.68a 측정: 레전더리 48시드 최적 배분, 스태프 none/full 별 35세 위상 (시드별). 실행: COACH=none|full npx vite-node scripts/c68-legend.ts
import { autoAllocate } from '../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../src/game';
import { autoStaff, ensureMoney } from '../src/money';
import { PLAYABLE_POSITIONS } from '../src/positions';
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const full = (env.COACH ?? 'full') === 'full';
const out: string[] = [];
for (let i = 0; i < 48; i++) {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const s = newGame({ mode: 'prospect', position, seed: `balance-legendary-${i}`, difficulty: 'normal' });
  s.player.potentialTier = 'legendary';
  const rep: Record<number, number> = {};
  while (s.player.age < 37) {
    while (s.phase === 'season') { playRound(s, { engine: 'quick' }); if (full) autoStaff(s); autoAllocate(s.player); }
    autoAllocate(s.player);
    rep[s.player.age] = s.player.reputation;
    if (s.phase !== 'offseason') break;
    autoMarket(s, 'stay');
    startNextSeason(s);
  }
  out.push(`${i} ${position} r30=${rep[30]} r35=${rep[35]} staff=${ensureMoney(s).history.length}`);
  console.log(out.at(-1));
}
