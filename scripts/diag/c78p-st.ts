// 진단 (C.78p 질문 2, 미해결 1): ST 슈팅·결정력·침착성 +10(양 팀 ST) 반응을 시드 2벌로 — ST 슛·유효·골·팀 득점·박스 밖 슛 비율. 엔진 코드는 바꾸지 않는다.
// 실행: npx vite-node scripts/diag/c78p-st.ts -- [쌍=400] [시드 시작=1000] [경로=값 ...]
import type { MatchJob, MatchOut, CompactPlayer } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const nums: number[] = [];
for (const a of all) { if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); } else nums.push(Number(a)); }
const [N = 400, S0 = 1000] = nums;
const ST = 9;
const mods = [0, 1].map((team) => ({ team: team as 0 | 1, slot: ST, attrs: ['shooting', 'bigMatch', 'composure'], delta: 10 }));
const job = (i: number, mod: boolean): MatchJob => ({ kind: 'match', seed: S0 + i, home: std('a', S0 - 1000 + i, 75, '4-4-2'), away: std('b', S0 - 1000 + i, 75, '4-4-2'), neutral: true, overrides, ...(mod ? { mods } : {}) });
const jobs = [...Array.from({ length: N }, (_, i) => job(i, false)), ...Array.from({ length: N }, (_, i) => job(i, true))];
const outs = await runJobs<MatchOut>(jobs, { label: `ST 반응 ${N}쌍 (시드 ${S0}~)` });
const agg = (xs: MatchOut[]) => {
  let sh = 0, on = 0, g = 0, tg = 0, n = 0, oth = 0;
  for (const m of xs) {
    tg += m.homeGoals + m.awayGoals;
    for (const p of m.players as (CompactPlayer & { slot?: number })[]) {
      if (p.slot === ST && p.starter) { sh += p.shots; on += p.shotsOnTarget; g += p.goals; n++; }
      else oth += p.goals;
    }
  }
  return { sh: sh / n, on: on / n, g: g / n, rate: (100 * on) / sh, conv: (100 * g) / sh, tg: tg / xs.length / 2, oth: oth / xs.length / 2, n };
};
const b = agg(outs.slice(0, N)), m = agg(outs.slice(N));
const f = (x: number, k = 3) => x.toFixed(k);
console.log(`\nST 반응 ${N}쌍, 시드 ${S0}~, 덮어쓰기 ${JSON.stringify(overrides)} (ST 표본 ${b.n}/${m.n})`);
console.log(`| | ST 슛/경기 | 유효 | 유효율 % | 골 | 슛당 골 % | 팀 득점 | 다른 선수 골/팀 |`);
console.log(`| 기준 | ${f(b.sh, 2)} | ${f(b.on, 2)} | ${f(b.rate, 1)} | ${f(b.g)} | ${f(b.conv, 1)} | ${f(b.tg, 2)} | ${f(b.oth, 2)} |`);
console.log(`| +10 | ${f(m.sh, 2)} | ${f(m.on, 2)} | ${f(m.rate, 1)} | ${f(m.g)} | ${f(m.conv, 1)} | ${f(m.tg, 2)} | ${f(m.oth, 2)} |`);
console.log(`변화: 유효율 ${(m.rate - b.rate).toFixed(2)}%p · ST 골 ${(100 * (m.g / b.g - 1)).toFixed(1)}% · ST 슛 ${(100 * (m.sh / b.sh - 1)).toFixed(1)}% · 슛당 골 ${(m.conv - b.conv).toFixed(2)}%p`);
process.exit(0);
