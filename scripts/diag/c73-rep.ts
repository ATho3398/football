// C.73a 진단: 챕터 이벤트 배율이 위상 가드(일반·레전더리 30세 위상 중앙값, 레전더리 35세 900+ 비율)에 주는 영향만 빠르게 (balance.ts 첫 표와 같은 시뮬)
// 실행: TIER=legendary|normal OFF=1(챕터 효과 끔) npx vite-node scripts/diag/c73-rep.ts
import { autoAllocate } from '../../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../../src/game';
import { BALANCE } from '../../src/config/balance';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import type { Tier } from '../../src/types';
import { EVENTS } from '../../data/events';
import type { EventDef } from '../../src/events';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const tier = (env.TIER ?? 'legendary') as Tier;
const N = Number(env.SEEDS ?? 48);
const C = BALANCE.chapters as { eventMul: Record<string, Record<string, number>>; goalMix: Record<string, { easier: number; harder: number }>; pick: Record<string, string | null> };
if (env.OFF) { for (const k of Object.keys(C.eventMul)) C.eventMul[k] = {}; }
if (env.MUL) Object.assign(C.eventMul, JSON.parse(env.MUL));
if (env.GOAL === '0') { for (const k of Object.keys(C.goalMix)) C.goalMix[k] = { easier: 0, harder: 0 }; (BALANCE.chapters.twilightGoal as { personalMul: number; personalRating: number }).personalMul = 1; (BALANCE.chapters.twilightGoal as { personalRating: number }).personalRating = 0; }
if (env.PICK === '0') for (const k of Object.keys(C.pick)) C.pick[k] = null;
if (env.TWX) { const a = EVENTS as EventDef[]; for (const id of env.TWX.split(',')) a.splice(a.findIndex((e) => e.id === id), 1); }
if (env.TW === '0') { const a = EVENTS as EventDef[]; for (const id of ['d_agingBody', 'd_retireTalk', 'd_mentor']) a.splice(a.findIndex((e) => e.id === id), 1); }
const rep30: number[] = [];
let wc35 = 0;
for (let i = 0; i < N; i++) {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const s = newGame({ mode: 'prospect', position, seed: `balance-${tier}-${i}`, difficulty: 'normal' });
  s.player.potentialTier = tier;
  while (s.player.age < 37) {
    while (s.phase === 'season') { playRound(s, { engine: 'quick' }); autoAllocate(s.player); }
    autoAllocate(s.player);
    if (s.player.age === 30) rep30.push(s.player.reputation);
    if (s.player.age === 35) { if (s.player.reputation >= 900) wc35++; break; }
    if (s.phase !== 'offseason') break;
    autoMarket(s, 'stay');
    startNextSeason(s);
  }
}
rep30.sort((a, b) => a - b);
console.log(`${tier} OFF=${env.OFF ?? ""} GOAL=${env.GOAL ?? ""} PICK=${env.PICK ?? ""} TW=${env.TW ?? ""} TWX=${env.TWX ?? ""} MUL=${env.MUL ? "y" : ""}: 30세 위상 중앙값 ${rep30[Math.floor(rep30.length / 2)]} · 35세 900+ ${wc35}/${N} = ${(wc35 / N).toFixed(3)}`);
