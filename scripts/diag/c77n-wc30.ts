// C.77n 진단: balance.ts "레전더리 30세까지 월드클래스 도달"(최적 배분, 시드 balance-legendary-<i>, 0.1~0.2) 만 빠르게 재현.
// runCareer 와 같은 경로(빠른 경기 · autoAllocate · autoMarket stay · 환경 고정)로 30세까지만. 부상 풀타임 환산(30세까지)도 같이.
// 실행: npx vite-node scripts/diag/c77n-wc30.ts -- [시드 수=48]   환경 변수 BASE = injury.base 덮어쓰기
import { autoMarket, newGame, playRound, startNextSeason } from '../../src/game';
import { autoAllocate } from '../../src/growth';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { BALANCE } from '../../src/config/balance';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
// balance.ts 회귀 가드와 같은 조건: 기록 보상 끔 · 대표팀 소집 끔
for (const r of Object.values(BALANCE.records.reward as unknown as Record<string, [number, number]>)) { r[0] = 0; r[1] = 0; }
const callup = BALANCE.national.callup as unknown as Record<string, number>;
for (const k of Object.keys(callup)) if (k !== 'minAge') callup[k] = 0;
if (process.env.BASE) (BALANCE.injury as { base: number }).base = Number(process.env.BASE);
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 48);
let wc = 0;
let inj = 0;
let min = 0;
for (let i = 0; i < N; i++) {
  const s = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `balance-legendary-${i}`, difficulty: 'normal' });
  s.player.potentialTier = 'legendary';
  let hit = false;
  while (s.player.age <= 30) {
    while (s.phase === 'season') {
      playRound(s, { engine: 'quick' });
      autoAllocate(s.player);
    }
    autoAllocate(s.player);
    const h = s.player.history.at(-1)!;
    inj += h.injuries;
    min += h.minutes;
    if (s.player.age <= 30 && s.player.reputation >= 900) hit = true;
    if (s.phase !== 'offseason') break;
    autoMarket(s, 'stay');
    startNextSeason(s);
  }
  if (hit) wc++;
}
console.log(`레전더리 30세까지 900+ ${wc}/${N} = ${(wc / N).toFixed(3)} (0.1~0.2) · 30세까지 부상 풀타임 환산 ${((inj / min) * 90 * 38).toFixed(3)} · injury.base ${BALANCE.injury.base}`);
