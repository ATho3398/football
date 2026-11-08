// 진단 (C.78r): 12 m 밖 선방률을 슛 상황 구간(거리 × GK 자리)으로 나눠 본다 — 선택 효과(어떤 상황을 쏘나)와 실행(그 상황 선방률) 분리. 경로=값 덮어쓰기
// 실행: N=200 npx vite-node scripts/diag/c78r-save.ts -- decide.bias.shoot=0
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { ENGINE } from '../../src/engine/config';
import { BALANCED } from '../engine/job';
for (const kv of process.argv.slice(2).filter((a) => a.includes('='))) {
  const [k, v] = kv.split('=') as [string, string];
  const ks = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const p of ks.slice(0, -1)) o = o[p] as Record<string, unknown>;
  o[ks[ks.length - 1]!] = Number(v);
}
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const N = Number(process.env.N ?? 200);
const S0 = Number(process.env.START ?? 0);
const on = [0, 0, 0, 0, 0, 0], sv = [0, 0, 0, 0, 0, 0];
let fo = 0, fs = 0, goals = 0;
for (let i = S0; i < S0 + N; i++) {
  const r = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true }).runToEnd();
  for (const st of r.teamStats) {
    st.farBinOn.forEach((x, k) => (on[k]! += x));
    st.farBinSaves.forEach((x, k) => (sv[k]! += x));
    fo += st.farOnTarget; fs += st.farSaves; goals += st.goals;
  }
}
const T = N * 2;
const names = ['12~16.5', '16.5~25', '25+'];
console.log(`팀당 득점 ${(goals / T).toFixed(2)} · 12 m 밖 유효 ${(fo / T).toFixed(2)} · 선방 ${((100 * fs) / Math.max(1, fo)).toFixed(1)}%`);
for (let k = 0; k < 6; k++) console.log(`  ${names[k >> 1]} ${k & 1 ? 'GK 빈' : 'GK 자리'}: 유효 ${(on[k]! / T).toFixed(3)} (${((100 * on[k]!) / Math.max(1, fo)).toFixed(1)}%) 선방 ${((100 * sv[k]!) / Math.max(1, on[k]!)).toFixed(1)}%`);
console.log(`JSON ${JSON.stringify({ on, sv })}`);
