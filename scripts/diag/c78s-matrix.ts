// @ts-nocheck — 진단 스크립트 (엔진관리자12, 엄격 타입 검사 제외)
// 진단 (엔진관리자12, C.78s 상성 진단): 성향끼리 라운드 로빈 득실차 · 총득점 · 무승부율 · 시간대(0~45 · 45~65 · 65~90+) 득실차.
// C.78y 측정기 개선: 칸당 경기수(기본 480)를 두 방향으로 나눈다 — 같은 시드 k 에서 A 가 로스터 a 인 경기와 로스터 b 인 경기를
//   짝으로 돌려(홈/원정도 짝 안에서 바꿈) 로스터·홈 효과를 지운다. SE 는 시드 짝 평균(두 경기 득실차 평균)의 표준오차.
//   dirs=1 이면 옛 방식(A = 로스터 a 만, 홈/원정 반씩).
// 실행: npx vite-node scripts/diag/c78s-matrix.ts -- [경기수=480] [레이팅=75:75] [전술…] [out=파일.json] [only=A/B,C/D] [경로=값 …]
//   전술 기본 7개: balanced tikitaka gegenpress counter direct block block@0020(= 버스 = 블록의 라인 매우 낮음)
//   표기는 tactic-pair 와 같다(성향@라인압박빌드업폭). 같은 시드(41000~), 4-4-2, 홈/원정 반씩. 왼쪽(행) 기준 득실차.
import { writeFileSync } from 'node:fs';
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 480;
let dirs = 2;
let ratings = [75, 75];
let out = '';
let only: [string, string][] | null = null;
for (const a of all) {
  if (a.startsWith('out=')) out = a.slice(4);
  else if (a.startsWith('dirs=')) dirs = Number(a.slice(5));
  else if (a.startsWith('only=')) only = a.slice(5).split(',').map((p) => p.split('/') as [string, string]);
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
if (!specs.length) specs.push('balanced', 'tikitaka', 'gegenpress', 'counter', 'direct', 'block', 'block@0020');
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
const pairs: [string, string][] = only ?? specs.flatMap((a, i) => specs.slice(i + 1).map((b) => [a, b] as [string, string]));
const jobs: MatchJob[] = [];
// 경기 k: 시드 41000 + ⌊k/dirs⌋, 방향 d = k % dirs (d = 1 이면 A 가 로스터 b), A 홈 여부 = (⌊k/dirs⌋ + d) % 2
const aHome = (k: number) => dirs === 1 ? k % 2 === 1 : (Math.floor(k / dirs) + (k % dirs)) % 2 === 1;
for (const [a, b] of pairs) for (let k = 0; k < n; k++) {
  const seed = 41000 + Math.floor(k / dirs);
  const flip = k % dirs === 1;
  const A = std(flip ? 'b' : 'a', seed, ratings[0], '4-4-2', tac(a));
  const B = std(flip ? 'a' : 'b', seed, ratings[1], '4-4-2', tac(b));
  jobs.push(aHome(k) ? { kind: 'match', seed, neutral: true, home: A, away: B, overrides } : { kind: 'match', seed, neutral: true, home: B, away: A, overrides });
}
const outs = await runJobs<MatchOut>(jobs, { label: `상성 ${jobs.length}경기` });
const BK = [0, 45 * 60, 65 * 60, 1e9];
const rows = pairs.map(([a, b], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  const r = { a, b, n, dirs, unit: [] as number[], gf: 0, ga: 0, draw: 0, win: 0, loss: 0, sq: 0, bk: [0, 0, 0], bkTot: [0, 0, 0], sh: [0, 0], ow: [0, 0], poss: 0, lp: [0, 0], pa: [0, 0], pc: [0, 0], cs: [0, 0], thr: [0, 0] };
  xs.forEach((m, k) => {
    const me = aHome(k) ? 0 : 1; // A 의 팀 번호
    const gf = me === 0 ? m.homeGoals : m.awayGoals, ga = me === 0 ? m.awayGoals : m.homeGoals;
    r.gf += gf; r.ga += ga; r.sq += (gf - ga) ** 2;
    const u = Math.floor(k / dirs); r.unit[u] = (r.unit[u] ?? 0) + (gf - ga) / dirs;
    if (gf === ga) r.draw++; else if (gf > ga) r.win++; else r.loss++;
    for (const g of m.goals) {
      const j = BK.findIndex((t, q) => g.t >= t && g.t < BK[q + 1]!);
      r.bk[j]! += g.team === me ? 1 : -1; r.bkTot[j]!++;
    }
    const A = m.team[me]!, B = m.team[1 - me]!;
    r.sh[0] += A.shots; r.sh[1] += B.shots; r.ow[0] += A.oppHalfWins; r.ow[1] += B.oppHalfWins;
    r.poss += (100 * A.possessionTicks) / (A.possessionTicks + B.possessionTicks);
    r.lp[0] += A.longPasses; r.lp[1] += B.longPasses; r.pa[0] += A.passes; r.pa[1] += B.passes; r.pc[0] += A.passesCompleted; r.pc[1] += B.passesCompleted;
    r.cs[0] += A.counterShots; r.cs[1] += B.counterShots; r.thr[0] += A.throughReceived; r.thr[1] += B.throughReceived;
  });
  return r;
});
console.log(`\n레이팅 ${ratings.join(' 대 ')}, ${n}경기씩(방향 ${dirs}), 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| A | B | A 득실차 (±SE) | 합계 골 | 무승부% | 승/무/패 | 0~45 | 45~65 | 65~ | 슈팅 A/B | 상대진영탈취 A/B | 점유 A% | 롱% A/B | 패스% A/B | 역습슛 A/B | 침투수신 A/B |');
for (const r of rows) {
  const d = (r.gf - r.ga) / n;
  // SE: 시드 짝(방향 평균) 단위 표준오차 — 짝 안 상관(같은 시드)을 반영
  const U = r.unit.length, um = r.unit.reduce((x, y) => x + y, 0) / U;
  const se = Math.sqrt(r.unit.reduce((x, y) => x + (y - um) ** 2, 0) / (U - 1) / U);
  const f = (v: number, q = 2) => (v / n).toFixed(q);
  console.log(`| ${r.a} | ${r.b} | ${d >= 0 ? '+' : ''}${d.toFixed(2)} (±${se.toFixed(2)}) | ${((r.gf + r.ga) / n).toFixed(2)} | ${((100 * r.draw) / n).toFixed(0)} | ${r.win}/${r.draw}/${r.loss} | ${r.bk.map((v) => (v >= 0 ? '+' : '') + f(v)).join(' | ')} | ${f(r.sh[0], 1)}/${f(r.sh[1], 1)} | ${f(r.ow[0], 1)}/${f(r.ow[1], 1)} | ${f(r.poss, 1)} | ${((100 * r.lp[0]) / r.pa[0]).toFixed(0)}/${((100 * r.lp[1]) / r.pa[1]).toFixed(0)} | ${((100 * r.pc[0]) / r.pa[0]).toFixed(0)}/${((100 * r.pc[1]) / r.pa[1]).toFixed(0)} | ${f(r.cs[0], 1)}/${f(r.cs[1], 1)} | ${f(r.thr[0], 1)}/${f(r.thr[1], 1)} |`);
}
if (out) writeFileSync(out, JSON.stringify(rows));
process.exit(0);
