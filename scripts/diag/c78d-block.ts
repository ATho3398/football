// 진단 (C.78d 0번): 깊은 블록 분해 — 짝마다 양 팀의 ⒜ 허용 슛 위치·xG·블록 ⒝ 수비 모양·박스 앞 존 인원 ⒞ 뚫는 경로·줄 사이 수신 ⒟ 자기 ⅓ 탈취 뒤 역습. 엔진 코드는 바꾸지 않는다.
// 실행: npx vite-node scripts/diag/c78d-block.ts -- [경기수=60] [레이팅=75:75] 짝1 짝2 ... [경로=값 ...]
//   짝: A:B (예 balanced:bus, bus:bus, balanced:balanced). tactic-pair 와 같은 시드·4-4-2·홈/원정 반씩
import type { MatchJob, MatchOut } from '../engine/job';
import type { BlockTeam } from '../engine/blockProbe';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const pairs: [Tendency, Tendency][] = [];
let n = 60;
let ratings = [75, 75];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else pairs.push(a.split(':') as [Tendency, Tendency]);
}
const jobs: MatchJob[] = [];
for (const [x, y] of pairs) for (let k = 0; k < n; k++) {
  const seed = 31000 + k;
  const a = std('a', seed, ratings[0], '4-4-2', tacticsOf(x));
  const b = std('b', seed, ratings[1], '4-4-2', tacticsOf(y));
  jobs.push(k % 2 ? { kind: 'match', seed, neutral: true, home: a, away: b, overrides, block: true } : { kind: 'match', seed, neutral: true, home: b, away: a, overrides, block: true });
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `블록 분해 ${jobs.length}경기` });
const sum = (xs: BlockTeam[]): BlockTeam => {
  const acc = JSON.parse(JSON.stringify(xs[0])) as BlockTeam;
  for (const x of xs.slice(1)) for (const k of Object.keys(acc) as (keyof BlockTeam)[]) {
    const v = acc[k];
    if (Array.isArray(v)) (x[k] as number[]).forEach((y, i) => { v[i]! += y; });
    else (acc[k] as number) += x[k] as number;
  }
  return acc;
};
const pc = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(1) : '–');
const pm = (x: number) => (x / n).toFixed(2);
const av = (x: number, d: number, f = 1) => (d ? (x / d).toFixed(f) : '–');
console.log(`\n블록 분해, 레이팅 ${ratings.join(' 대 ')}, ${n}경기씩, 덮어쓰기 ${JSON.stringify(overrides)}`);
const rows: string[] = [];
let msSum = 0;
pairs.forEach(([x, y], i) => {
  const xs = outs.slice(i * n, (i + 1) * n);
  let gf = 0, ga = 0;
  const A: BlockTeam[] = [], B: BlockTeam[] = [];
  xs.forEach((m, k) => {
    const ai = k % 2 ? 0 : 1;
    gf += ai === 0 ? m.homeGoals : m.awayGoals; ga += ai === 0 ? m.awayGoals : m.homeGoals;
    A.push(m.block!.team[ai]!); B.push(m.block!.team[1 - ai]!);
    msSum += m.ms;
  });
  const a = sum(A), b = sum(B);
  console.log(`\n=== ${x} 대 ${y}: 득실 ${pm(gf)}:${pm(ga)} (차 ${((gf - ga) / n).toFixed(2)})`);
  for (const [who, T] of [[x, a], [y, b]] as [string, BlockTeam][]) {
    console.log(`  [${who} 수비] 허용 슛 ${pm(T.sa)}/경기 · 박스 안/앞 중앙 존/먼 곳 ${pc(T.saBox, T.sa)}/${pc(T.saZ14, T.sa)}/${pc(T.saFar, T.sa)}% · 머리 ${pc(T.saHead, T.sa)}% · xG/슛 ${av(T.saXg, T.sa, 3)} · xG/경기 ${pm(T.saXg)} · 블록 ${pc(T.saBlocked, T.sa)}% (pBlock ${av(T.saPBlock, T.sa, 2)}) · 3 m 수비 ${av(T.saPress3, T.sa, 2)} · 6 m 골 쪽 수비 ${av(T.saDense6, T.sa, 2)} · 받고 슛까지 ${av(T.saRecvT, T.saRecvN, 2)} s · 거리 ${av(T.saD, T.sa)} m · 골 ${pm(T.saGoals)} · 세트 소유 ${pc(T.saSetPoss, T.sa)}%`);
    console.log(`     경로 크로스/줄 사이/침투/그 밖 패스/없음 · 6초 안 두 번째 슛 ${T.via.map((v) => pc(v, T.sa)).join('/')}% · 상대 크로스 ${pm(T.crossFaced)}/경기 · 경로별 xG/슛 ${T.viaXg.slice(0, 5).map((v, j) => av(v, T.via[j]!, 3)).join('/')} · 머리 xG/슛 ${av(T.headXg, T.saHead, 3)} · 박스 안 xG/슛 ${av(T.boxXg, T.saBox, 3)} · 박스 밖 ${av(T.saXg - T.boxXg, T.sa - T.saBox, 3)}`);
    console.log(`     모양(표본 ${pm(T.sh)}) 수비 줄 ${av(T.shDef, T.sh)} m · 중원 줄 ${av(T.shMid, T.sh)} m · 간격 ${av(T.shGap, T.sh)} m · 박스 앞 존 우리/상대 ${av(T.shZoneUs, T.sh, 2)}/${av(T.shZoneThem, T.sh, 2)} · 박스 안 ${av(T.shBoxUs, T.sh, 2)}/${av(T.shBoxThem, T.sh, 2)} · 공 뒤 우리 ${av(T.shBehind, T.sh, 2)}`);
    console.log(`     상대 줄 사이 수신 ${pm(T.btw)}/경기 · 가장 가까운 수비 ${av(T.btwNear, T.btw)} → 1초 뒤 ${av(T.btwNear1, T.btw)} m · 6초 슛 ${pc(T.btwShot6, T.btw)}%`);
    console.log(`  [${who} 공격] 자기 ⅓ 탈취 ${pm(T.low)}/경기 (전체 ${pm(T.wins)}, 15초 슛 ${pc(T.winShot15, T.wins)}%) · 첫 결정 ${av(T.lowT1, T.lowDec, 2)} s · 첫 패스 전진 ${av(T.lowFwd, T.lowDec)} m · 10 m+ 전진 ${pc(T.lowFwdN, T.lowDec)}% · 3초 뒤 공 앞 동료 ${av(T.lowAhead3, T.low, 2)} (달림 ${av(T.lowRun3, T.low, 2)}) · 15초 안 상대 ⅓ ${pc(T.lowF3, T.low)}% · 슛 ${pc(T.lowShot15, T.low)}% · 골 ${pm(T.lowGoal15)} · 5/10초 유지 ${pc(T.lowKeep5, T.low)}/${pc(T.lowKeep10, T.low)}% · 첫 결정 롱 ${pc(T.lowLong, T.lowDec)}% (3초 안 유지 ${pc(T.lowLongKeep, T.lowLong)}%)`);
  }
  rows.push(`| ${x} 대 ${y} | ${((gf - ga) / n).toFixed(2)} | ${pm(b.sa)} · ${pc(b.saBox, b.sa)}/${pc(b.saZ14, b.sa)}/${pc(b.saFar, b.sa)} · ${av(b.saXg, b.sa, 3)} · ${pc(b.saBlocked, b.sa)} | ${av(b.shGap, b.sh)} · ${av(b.shZoneUs, b.sh, 2)}/${av(b.shZoneThem, b.sh, 2)} | ${pm(b.btw)} · ${av(b.btwNear, b.btw)}→${av(b.btwNear1, b.btw)} | ${pm(b.low)} · ${pc(b.lowShot15, b.low)} · ${av(b.lowAhead3, b.low, 2)}/${av(b.lowRun3, b.low, 2)} |`);
});
console.log('\n| 짝(A 대 B) | A 득실차 | B 허용 슛 · 박스/존/먼 % · xG/슛 · 블록 % | B 줄 간격 · 박스 앞 존 B/A | A 줄 사이 수신 · 수비 m → 1초 | B 자기 ⅓ 탈취 · 15초 슛 % · 3초 앞 동료/달림 |');
for (const r of rows) console.log(r);
console.log(`\n경기당 계산 ${(msSum / outs.length).toFixed(0)} ms · 전체 ${((Date.now() - t0) / 1000).toFixed(0)} s`);
process.exit(0);
