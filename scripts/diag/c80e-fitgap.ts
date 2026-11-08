// @ts-nocheck — 진단 (C.80e): c78s-fit(profile=c79d) 맞음/안 맞음 선수단의 직선 적합도 차이(fit.ts) 근사 — 시드 51000~ 20팀, 보상(−δ) 없이 +d 만
// 실행: npx vite-node scripts/diag/c80e-fitgap.ts
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { FORMATION_SLOTS } from '../../src/formations';
import { fitGaps } from '../../src/engine/fit';

const d = 10;
const FIT = { CB: ['longPassing', 'vision'], FB: ['longPassing', 'crossing', 'vision'], MID: ['longPassing', 'vision', 'crossing'], WING: ['ballControl', 'strength', 'pace', 'acceleration'], ST: ['ballControl', 'strength', 'jumping', 'heading'] };
const grp = (p) => (p === 'CB' ? 'CB' : p === 'LB' || p === 'RB' ? 'FB' : p === 'CM' || p === 'CDM' ? 'MID' : p === 'ST' ? 'ST' : 'WING');
for (const sign of [1, -1]) {
  const gs = [];
  for (let k = 0; k < 20; k++) {
    const roster = createTeamRoster({ id: `va${51000 + k}`, rating: 75 }, `eng-a-75-${51000 + k}`, 2018, []);
    roster.formation = '4-4-2';
    const setup = teamSetupFromRoster(roster, rosterRating(roster), 75, `w${51000 + k}`);
    const slots = FORMATION_SLOTS['4-4-2'];
    const ps = setup.lineup.filter((p) => slots[p.slot].pos !== 'GK').map((p) => {
      const a = { ...p.attrs };
      for (const x of FIT[grp(slots[p.slot].pos)]) a[x] = Math.max(1, Math.min(99, a[x] + sign * d));
      return { attrs: a, pos: slots[p.slot].pos };
    });
    gs.push(fitGaps(ps).direct);
  }
  console.log(sign > 0 ? '맞음' : '안 맞음', (gs.reduce((a, b) => a + b, 0) / gs.length).toFixed(2));
}
