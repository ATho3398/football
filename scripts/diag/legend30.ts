// C.77w fix 진단: balance:check "레전더리 30세까지 월드클래스 도달"(0.1~0.2) 한 가드만 잰다 — balance.ts 와 같은 조건(맑음 고정·기록 보상·대표팀 끔·스태프 없음·stay·최적 배분)
// npx vite-node scripts/diag/legend30.ts -- [시드=48] [경로=값 ...]   예: injury.grades.major.weeks=[9,18] injury.permanent.moderateMul=0.5
import { autoAllocate, playerOvr } from '../../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../../src/game';
import { BALANCE } from '../../src/config/balance';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
const args = process.argv.slice(2).filter((a) => a !== '--');
for (const a of args.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string]; const path = k.split('.');
  let o = BALANCE as unknown as Record<string, unknown>; for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>; o[path.at(-1)!] = JSON.parse(v);
}
const r = BALANCE.records.reward as unknown as Record<string, [number, number]>;
for (const k of Object.keys(r)) r[k] = [0, 0];
const c = BALANCE.national.callup as unknown as Record<string, number>;
for (const k of Object.keys(c)) if (k !== 'minAge') c[k] = 0;
const N = Number(args.find((x) => !x.includes('=')) ?? 48);
let wc = 0;
const ovr30: number[] = [];
let injWeeks = 0, inj = 0;
for (let i = 0; i < N; i++) {
  const position = PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!;
  const s = newGame({ mode: 'prospect', position, seed: `balance-legendary-${i}`, difficulty: 'normal' });
  s.player.potentialTier = 'legendary';
  let hit = false;
  while (s.player.age <= 30) {
    while (s.phase === 'season') {
      const rep = playRound(s, { engine: 'quick' });
      if (rep.injury) { inj++; injWeeks += rep.injury.weeksTotal; }
      autoAllocate(s.player);
    }
    autoAllocate(s.player);
    if (s.player.age <= 30 && s.player.reputation >= 900) hit = true;
    if (s.player.age === 30) ovr30.push(playerOvr(s.player));
    if (s.phase !== 'offseason' || s.player.age >= 30) break;
    autoMarket(s, 'stay');
    startNextSeason(s);
  }
  if (hit) wc++;
}
console.log(`레전더리 30세까지 900+ ${wc}/${N} = ${(wc / N).toFixed(3)} (0.1~0.2) · 30세 OVR ${(ovr30.reduce((a, b) => a + b, 0) / ovr30.length).toFixed(1)} · 부상 ${inj}건 평균 ${(injWeeks / Math.max(1, inj)).toFixed(2)}주`);
