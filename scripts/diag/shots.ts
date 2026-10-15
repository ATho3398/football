// 진단: 슈팅 거리 분포와 xG (표준 4-2-3-1 동레이팅)
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { ENGINE } from '../../src/engine/config';
import { BALANCED } from '../engine/job';
for (const kv of process.argv.slice(2)) {
  const [k, v] = kv.split('=') as [string, string];
  const ks = k.split('.');
  (ENGINE as unknown as Record<string, Record<string, number>>)[ks[0]!]![ks[1]!] = Number(v);
}
const mk = (side: string, i: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `eng-${side}-75-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `w${1000 + i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const N = Number(process.env.N ?? 20);
const bins = [0, 6, 11, 16, 20, 25, 31];
const cnt = bins.map(() => 0), xg = bins.map(() => 0), gl = bins.map(() => 0);
let shots = 0;
for (let i = 0; i < N; i++) {
  const r = createMatch({ home: mk('a', i), away: mk('b', i), mode: 'auto', difficulty: 'normal', seed: 1000 + i, bigMatch: false, neutral: true }).runToEnd();
  let last = -1;
  for (const e of r.events) {
    if (e.type === 'shot') {
      const d = Number(e.params?.d ?? 0);
      let b = 0;
      while (b + 1 < bins.length && d >= bins[b + 1]!) b++;
      cnt[b]!++; xg[b]! += Number(e.params?.xg ?? 0); shots++; last = b;
    }
    if (e.type === 'goal' && last >= 0) { gl[last]!++; last = -1; }
  }
}
console.log('팀당 슈팅', (shots / N / 2).toFixed(1));
bins.forEach((b, k) => console.log(`${b}m~: 팀당 ${(cnt[k]! / N / 2).toFixed(2)} 평균 xG ${(xg[k]! / Math.max(1, cnt[k]!)).toFixed(3)} 골 ${(gl[k]! / N / 2).toFixed(2)}`));
