// 진단 (부록 C.32): 성향·세부 전술 하나를 상대(기본 균형)와 붙여 득실차와 원인 통계를 본다. 같은 시드, 홈/원정 반씩.
// 실행: npx vite-node scripts/diag/tactic-pair.ts -- [경기수=200] [레이팅=75:75] 전술1 전술2 ... [vs=전술] [경로=값 ...]
//   전술: 성향 이름(balanced, tikitaka, gegenpress, counter, direct, block) + 선택 @라인,압박,빌드업,폭 단계(0~2), 예: balanced@1211
//   경로=값: 엔진 상수(ENGINE) 또는 tendency.상수(성향 고유 행동) 덮어쓰기
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let vs = 'balanced';
const specs: string[] = [];
let n = 200;
let ratings = [75, 75];
for (const a of all) {
  if (a.startsWith('vs=')) vs = a.slice(3);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
const jobs: MatchJob[] = [];
for (const sp of specs) for (let k = 0; k < n; k++) {
  const seed = 31000 + k;
  const me = std('a', seed, ratings[0], '4-4-2', tac(sp));
  const op = std('b', seed, ratings[1], '4-4-2', tac(vs));
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: me, away: op, overrides } : { kind: 'match', seed, neutral: true, home: op, away: me, overrides });
}
const outs = await runJobs<MatchOut>(jobs, { label: `전술 짝 ${jobs.length}경기` });
console.log(`\n상대 ${vs}, 레이팅 ${ratings.join(' 대 ')}, ${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 전술 | 득점 | 실점 | 득실차 | 슈팅 | 허용 | 유효 | 역습슛 | 상대진영탈취 | 롱% | 패스% | 점유% | 상대 박스터치? |');
specs.forEach((sp, i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const acc = { gf: 0, ga: 0, sh: 0, sa: 0, sot: 0, cs: 0, ow: 0, lp: 0, pa: 0, pc: 0, poss: 0, thr: 0 };
  xs.forEach((m, k) => {
    const me = k % 2 ? 0 : 1;
    const op = 1 - me;
    const a = m.team[me]!, b = m.team[op]!;
    acc.gf += me === 0 ? m.homeGoals : m.awayGoals; acc.ga += me === 0 ? m.awayGoals : m.homeGoals;
    acc.sh += a.shots; acc.sa += b.shots; acc.sot += a.shotsOnTarget; acc.cs += a.counterShots; acc.ow += a.oppHalfWins;
    acc.lp += a.longPasses; acc.pa += a.passes; acc.pc += a.passesCompleted; acc.poss += (100 * a.possessionTicks) / (a.possessionTicks + b.possessionTicks); acc.thr += b.throughReceived;
  });
  const f = (v: number, d = 2) => (v / n).toFixed(d);
  console.log(`| ${sp} | ${f(acc.gf)} | ${f(acc.ga)} | ${((acc.gf - acc.ga) / n).toFixed(2)} | ${f(acc.sh, 1)} | ${f(acc.sa, 1)} | ${f(acc.sot, 1)} | ${f(acc.cs, 1)} | ${f(acc.ow, 1)} | ${((100 * acc.lp) / acc.pa).toFixed(1)} | ${((100 * acc.pc) / acc.pa).toFixed(1)} | ${f(acc.poss, 1)} | ${f(acc.thr, 1)} |`);
});
process.exit(0);
