// 진단 (C.78c 1번): 게겐 대 상대 성향 분해 — ⒜ 탈취 높이·뒤 슈팅 ⒝ 압박 회피(롱볼·GK 롱킥) ⒞ 탈취 뒤 15초 슈팅·높은 라인 뒤 패스 ⒟ 골 출처. 엔진 코드는 바꾸지 않는다.
// 실행: npx vite-node scripts/diag/c78c-gegen.ts -- [경기수=60] [레이팅=75:75] [나=gegenpress] 상대1 상대2 ... [경로=값 ...]
//   tactic-pair 와 같은 시드·4-4-2·홈/원정 반씩. 나를 바꾸려면 me=성향
import type { MatchJob, MatchOut } from '../engine/job';
import type { GegenTeam } from '../engine/gegenProbe';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let me: Tendency = 'gegenpress';
const opps: Tendency[] = [];
let n = 60;
let ratings = [75, 75];
for (const a of all) {
  if (a.startsWith('me=')) me = a.slice(3) as Tendency;
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else opps.push(a as Tendency);
}
const jobs: MatchJob[] = [];
for (const vs of opps) for (let k = 0; k < n; k++) {
  const seed = 31000 + k;
  const a = std('a', seed, ratings[0], '4-4-2', tacticsOf(me));
  const b = std('b', seed, ratings[1], '4-4-2', tacticsOf(vs));
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: a, away: b, overrides, gegen: true } : { kind: 'match', seed, neutral: true, home: b, away: a, overrides, gegen: true });
}
const outs = await runJobs<MatchOut>(jobs, { label: `게겐 분해 ${jobs.length}경기` });
const sum = (xs: GegenTeam[]): GegenTeam => {
  const acc = JSON.parse(JSON.stringify(xs[0])) as GegenTeam;
  for (const x of xs.slice(1)) for (const k of Object.keys(acc) as (keyof GegenTeam)[]) {
    const v = acc[k];
    if (Array.isArray(v)) (x[k] as number[]).forEach((y, i) => { v[i]! += y; });
    else (acc[k] as number) += x[k] as number;
  }
  return acc;
};
const pc = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(1) : '–');
const pm = (x: number) => (x / n).toFixed(2);
console.log(`\n${me} 분해, 레이팅 ${ratings.join(' 대 ')}, ${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)}`);
const rows: string[][] = [];
opps.forEach((vs, i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  let gf = 0, ga = 0;
  const G: GegenTeam[] = [], O: GegenTeam[] = [];
  xs.forEach((m, k) => {
    const mi = k % 2 ? 0 : 1;
    gf += mi === 0 ? m.homeGoals : m.awayGoals; ga += mi === 0 ? m.awayGoals : m.homeGoals;
    G.push(m.gegen!.team[mi]!); O.push(m.gegen!.team[1 - mi]!);
  });
  rows.push([vs, ((gf - ga) / n).toFixed(2), `${pm(gf)}:${pm(ga)}`]);
  const g = sum(G), o = sum(O);
  for (const [who, T] of [[me, g], [vs, o]] as [string, GegenTeam][]) {
    console.log(`\n[대 ${vs}] ${who === me ? '나' : '상대'} ${who}  (득실 ${pm(gf)}:${pm(ga)}, 차 ${((gf - ga) / n).toFixed(2)})`);
    console.log(`  ⒜ 탈취 ${pm(T.wins)}/경기 · 높이 0~⅓/⅓~½/½~⅔/⅔~1 ${T.winZ.map((z) => pc(z, T.wins)).join('/')}% · 10초 슛 % ${T.shot10Z.map((z, j) => pc(z, T.winZ[j]!)).join('/')} · 15초 골/경기 ${T.goal15Z.map(pm).join('/')}`);
    console.log(`     상대 소유 중 공이 상대 ⅓ 에 있는 비율 ${pc(T.oppDeepTicks, T.oppTicks)}% · 그때 공 10 m 안 우리 수 ${(T.pressNear / Math.max(1, T.oppDeepTicks)).toFixed(2)}`);
    console.log(`  ⒝ 압박받는 결정(자기 절반·5 m) ${pm(T.pDec)}/경기: 짧은 ${pc(T.pShort, T.pDec)} · 롱 ${pc(T.pLong, T.pDec)} · 걷기 ${pc(T.pClear, T.pDec)} · 몰기 ${pc(T.pCarry, T.pDec)} · 유지 ${pc(T.pHold, T.pDec)}% · GK 결정 ${pm(T.gkDec)} 롱 ${pc(T.gkLong, T.gkDec)}%`);
    console.log(`     자기 절반 30 m+ ${pm(T.lb)}/경기 · 착지 높이 ${(T.lbNx / Math.max(1, T.lb)).toFixed(2)} · 라인 뒤 착지 ${pc(T.lbBehind, T.lb)}% · 3초 안 유지 ${pc(T.lbKeep, T.lb)}% (공격 줄 ${pc(T.lbFwd, T.lbKeep)}%) · 라인 뒤 착지 유지 ${pc(T.lbBehindKeep, T.lbBehind)}%`);
    console.log(`  ⒞ 탈취 뒤 15초 슛 ${pc(T.shot15, T.wins)}% · 높은 라인 뒤 패스 ${pm(T.behindTry)}/경기 성공 ${pc(T.behindOk, T.behindTry)}%`);
    const hw = T.winZ[3]!;
    console.log(`  ⒜' 높은 탈취 ${pm(hw)}/경기: 우리 역압박 창 안 ${pc(T.hiH, hw)}% · 잃은 팀 마지막 결정 짧은/롱/걷기/몰기/유지/없음 ${T.hiBy.map((x) => pc(x, hw)).join('/')}% · 잃은 팀 소유 ${(T.hiPossT / Math.max(1, hw)).toFixed(1)} s`);
    console.log(`  ⒝' 압박받는 결정 판단 p → 실제 성공(짧은/롱/걷기/몰기/유지): ${T.pN.map((x, j) => `${(T.pP[j]! / Math.max(1, x)).toFixed(2)}→${(T.pOk[j]! / Math.max(1, x)).toFixed(2)}`).join(' · ')}`);
    console.log(`  ⒟ 골/경기 세트 ${pm(T.gSet)} · 높은 탈취 ${pm(T.gHigh)} · 역습 ${pm(T.gCounter)} · 지공 ${pm(T.gSlow)}`);
  }
});
console.log('\n| 상대 | 득실차 | 득:실 |');
for (const r of rows) console.log(`| ${r.join(' | ')} |`);
process.exit(0);
