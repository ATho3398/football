// C.76n 진단: 레전더리 최적 48시드 30세까지 위상 900+ (balance 가드 "레전더리 30세까지 월드클래스 도달" 재현) — 개인 시상 켬/끔/위상 0 비교
// AW=off: 시상 없음 · AW=rep0: 시상 켬, 1위 위상 가산 0 · 그 밖: 지금 값. 대표팀은 balance 가드처럼 끔
import { autoAllocate } from '../../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../../src/game';
import { BALANCE } from '../../src/config/balance';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { setEnvironmentFixed } from '../../src/weather';
setEnvironmentFixed(true);
for (const k of Object.keys(BALANCE.national.callup)) if (k !== 'minAge') (BALANCE.national.callup as Record<string, number>)[k] = 0;
for (const k of Object.keys(BALANCE.records.reward)) (BALANCE.records.reward as unknown as Record<string, number[]>)[k] = [0, 0];
const mode = process.env.AW ?? 'on';
const defs = BALANCE.awards.defs as Record<string, { rep: number; xp: readonly number[] }>;
if (mode === 'off') for (const k of Object.keys(defs)) delete defs[k];
if (mode === 'rep0') for (const d of Object.values(defs)) d.rep = 0;
if (mode === 'xp0') for (const d of Object.values(defs)) { d.rep = 0; d.xp = []; }
const hit: string[] = [];
const from = Number(process.env.FROM ?? 0);
const to = Number(process.env.TO ?? 48);
for (let i = from; i < to; i++) {
  const s = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `balance-legendary-${i}`, difficulty: 'normal' });
  s.player.potentialTier = 'legendary';
  let max = 0;
  while (s.player.age <= 30) {
    while (s.phase === 'season') { playRound(s, { engine: 'quick' }); autoAllocate(s.player); }
    autoAllocate(s.player);
    if (s.player.age <= 30) max = Math.max(max, s.player.reputation);
    if (s.phase !== 'offseason') break;
    autoMarket(s, 'stay'); startNextSeason(s);
  }
  if (max >= 900) hit.push(i + '');
  const won = Object.entries(s.globalAwards?.years.flatMap((y) => y.shown.filter((k) => y.res[k]?.[0]?.me)) ?? []).length;
  console.log(i, max, 'awards', won);
}
console.log(mode, hit.length, hit.join(','));
