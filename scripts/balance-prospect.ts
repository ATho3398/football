// C.78u 유망주 계약 측정 (pending 144): 나이·잠재력별 상위 6팀 제안 비율, 제안 주급·계약 기간, 유망주 계약 비율. 내 선수 OVR 65~70 · 위상 30으로 맞춘다 (상위 6팀 ≈ 레이팅 79~84).
// 실행: npm run balance:prospect -- [시드 수(기본 60)]   (PROSPECT_OFF=1: 유망주 가산 끄고 기준선)
import { newGame } from '../src/game';
import { makeOfferSet } from '../src/transfer';
import { BALANCE } from '../src/config/balance';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { setEnvironmentFixed } from '../src/weather';
import { shiftOvr } from '../src/npc';
import { playerOvr } from '../src/growth';
import { createRng } from '../src/rng';
import type { Tier } from '../src/types';

setEnvironmentFixed(true);
if (process.env.PROSPECT_OFF) BALANCE.transfer.prospect.maxAge = -1;
const N = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 60);
const avg = (xs: number[]) => (xs.length ? xs.reduce((t, x) => t + x, 0) / xs.length : 0);

const groups: { label: string; ages: number[]; tiers: Tier[] }[] = [
  { label: '18~20세 잠재력 상위', ages: [18, 19, 20], tiers: ['topClass', 'worldClass', 'legendary'] },
  { label: '21~22세 잠재력 상위', ages: [21, 22], tiers: ['topClass', 'worldClass', 'legendary'] },
  { label: '18~22세 보통·특별', ages: [18, 19, 20, 21, 22], tiers: ['normal', 'special'] },
  { label: '23~26세 (변화 없어야)', ages: [23, 24, 25, 26], tiers: ['normal', 'topClass', 'worldClass'] },
];
console.log(`유망주 측정 ${process.env.PROSPECT_OFF ? '(가산 끔 = 기준선)' : '(C.78u)'} · 시드 ${N}`);
for (const gr of groups) {
  const top6: number[] = []; const wage: number[] = []; const years: number[] = []; const pros: number[] = []; const nOff: number[] = [];
  for (let i = 0; i < N; i++) {
    const g = newGame({ mode: 'prospect', position: PLAYABLE_POSITIONS[i % PLAYABLE_POSITIONS.length]!, seed: `pr-${i}`, difficulty: 'normal' });
    g.market.contract.until = g.league.season; // 마지막 해 (제안 3~5개 단계)
    // 사용자 예시 (pending 144): OVR 65~70 유망주 (커트라인 80 강팀). 위상 30
    shiftOvr(g.player.attributes, g.player.position, 65 + (i % 6) - playerOvr(g.player), createRng(i + 1));
    g.player.reputation = 30;
    const top = new Set([...g.league.teams].sort((a, b) => b.rating - a.rating).slice(0, 6).map((t) => t.id));
    for (const age of gr.ages) for (const tier of gr.tiers) {
      g.player.age = age; g.player.potentialTier = tier;
      const offers = makeOfferSet(g, 'summer', `${age}-${tier}`).offers.filter((o) => o.kind === 'transfer');
      top6.push(offers.some((o) => top.has(o.teamId)) ? 1 : 0);
      nOff.push(offers.length);
      for (const o of offers) { wage.push(o.wage); years.push(o.years); pros.push(o.prospect ? 1 : 0); }
    }
  }
  console.log(`  ${gr.label}: 상위 6팀 제안 ${(avg(top6) * 100).toFixed(0)}% · 제안 ${avg(nOff).toFixed(2)}개 · 주급 평균 ${avg(wage).toFixed(0)}만 · 계약 ${avg(years).toFixed(2)}년 · 유망주 계약 ${(avg(pros) * 100).toFixed(0)}%`);
}
