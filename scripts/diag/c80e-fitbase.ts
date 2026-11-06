// @ts-nocheck — 진단 스크립트 (C.80e): 생성 선수단 선발의 포지션별 (핵심 능력치 평균 − 자기 평균) 평균 → ENGINE.tacticFit.base, 그리고 팀 차이(base 뺀 값) 분포
// 실행: npx vite-node scripts/diag/c80e-fitbase.ts -- [팀 수=100]
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { FORMATION_SLOTS } from '../../src/formations';
import { fitGaps, rawGap, FIT_TENDENCIES } from '../../src/engine/fit';

const n = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 100);
const pos: Record<string, Record<string, number[]>> = {};
for (const formation of ['4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '5-3-2', '4-1-4-1']) {
  if (!FORMATION_SLOTS[formation]) continue;
  const acc: Record<string, number[]> = {};
  for (const rating of [60, 70, 75, 80, 85]) for (let k = 0; k < n; k++) {
    const roster = createTeamRoster({ id: `va${k}`, rating }, `eng-a-${rating}-${k}`, 2018, []);
    roster.formation = formation;
    const setup = teamSetupFromRoster(roster, rosterRating(roster), rating, `w${k}`);
    const slots = FORMATION_SLOTS[formation];
    const ps = setup.lineup.filter((p) => slots[p.slot].pos !== 'GK').map((p) => ({ attrs: p.attrs, pos: slots[p.slot].pos }));
    for (const t of FIT_TENDENCIES) for (const p of ps) ((pos[t] ??= {})[p.pos] ??= []).push(rawGap(p.attrs, p.pos, t));
    const g = fitGaps(ps);
    for (const t of FIT_TENDENCIES) (acc[t] ??= []).push(g[t]);
  }
  console.log(`${formation}: ` + FIT_TENDENCIES.map((t) => { const v = acc[t]; const m = v.reduce((a, b) => a + b, 0) / v.length; const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); return `${t} ${m.toFixed(2)}±${sd.toFixed(2)}`; }).join(' · '));
}
for (const t of FIT_TENDENCIES) console.log(`${t}: { ` + Object.entries(pos[t]).map(([p, v]) => `${p}: ${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}`).join(', ') + ' },');
