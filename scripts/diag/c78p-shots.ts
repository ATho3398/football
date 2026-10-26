// 진단 (C.78p): 거리별 슛 분포(12 m 안 · 12~25 m · 25 m+)와 유효·골·선방 — 판단 보정(decide.bias) 전후 비교. 경로=값 덮어쓰기(깊은 경로)
// 실행: N=120 START=0 npx vite-node scripts/diag/c78p-shots.ts -- ball.shotSpeed=25 decide.bias.shoot=0.06
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
const N = Number(process.env.N ?? 120);
const S0 = Number(process.env.START ?? 0);
const bins = [0, 12, 25];
const names = ['12m 안', '12~25m', '25m+'];
const z = () => bins.map(() => 0);
const cnt = z(), on = z(), gl = z(), sv = z(), xg = z();
for (let i = S0; i < S0 + N; i++) {
  const r = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true }).runToEnd();
  let last = -1;
  for (const e of r.events) {
    if (e.type === 'shot') {
      const d = Number(e.params?.d ?? 0);
      let b = 0;
      while (b + 1 < bins.length && d >= bins[b + 1]!) b++;
      cnt[b]!++; xg[b]! += Number(e.params?.xg ?? 0); if (Number(e.params?.onTarget)) on[b]!++; last = b;
    } else if (e.type === 'goal' && last >= 0) { gl[last]!++; last = -1; }
    else if (e.type === 'save' && last >= 0) { sv[last]!++; last = -1; }
  }
}
const T = N * 2;
const sum = (a: number[]) => a.reduce((t, x) => t + x, 0);
console.log(`팀당 득점 ${(sum(gl) / T).toFixed(2)} 슛 ${(sum(cnt) / T).toFixed(1)} 유효 ${(sum(on) / T).toFixed(2)} 유효 중 골 ${((100 * sum(gl)) / Math.max(1, sum(on))).toFixed(1)}% 슛당 ${((100 * sum(gl)) / Math.max(1, sum(cnt))).toFixed(1)}%`);
names.forEach((nm, k) => console.log(`  ${nm}: 슛 ${(cnt[k]! / T).toFixed(2)} (${((100 * cnt[k]!) / Math.max(1, sum(cnt))).toFixed(0)}%) xG/슛 ${(xg[k]! / Math.max(1, cnt[k]!)).toFixed(3)} 유효 ${(on[k]! / T).toFixed(2)} 골 ${(gl[k]! / T).toFixed(2)} 선방 ${((100 * sv[k]!) / Math.max(1, sv[k]! + gl[k]!)).toFixed(0)}%`));
