// C.76d 진단: 레전더리 최적 48시드 30세까지 위상 900+ — 대표팀 켬/끔 비교 (NAT=off 면 소집 0)
import { autoAllocate } from '../../src/growth';
import { autoMarket, newGame, playRound, startNextSeason } from '../../src/game';
import { BALANCE } from '../../src/config/balance';
import { PLAYABLE_POSITIONS } from '../../src/positions';
import { setEnvironmentFixed } from '../../src/weather';
setEnvironmentFixed(true);
const off = process.env.NAT === 'off';
if (off) for (const k of Object.keys(BALANCE.national.callup)) if (k !== 'minAge') (BALANCE.national.callup as Record<string, number>)[k] = 0;
const hit: string[] = [];
for (let i = 0; i < 48; i++) {
  const s = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `balance-legendary-${i}`, difficulty: 'normal' });
  s.player.potentialTier = 'legendary';
  let max = 0; let wc = 0; let badge = '';
  while (s.player.age <= 30) {
    while (s.phase === 'season') { playRound(s, { engine: 'quick' }); autoAllocate(s.player); }
    autoAllocate(s.player);
    if (s.player.age <= 30) max = Math.max(max, s.player.reputation);
    wc = s.player.honors.worldCups;
    badge = s.player.badges.map((b) => b.id).join(',');
    if (s.phase !== 'offseason') break;
    autoMarket(s, 'stay'); startNextSeason(s);
  }
  if (max >= 900) hit.push(i + '');
  console.log(i, max, 'wc', wc, badge, s.national?.career.apps ?? 0);
}
console.log(off ? 'OFF' : 'ON', hit.length, hit.join(','));
