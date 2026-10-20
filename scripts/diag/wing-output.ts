// 진단 (엔진 관리자 3대, 44d E-3 평점·윙 산출, pending 39 7번): 실제 로스터 PL 리그 1시즌(380경기)을 돌려 선수별 출전·골·도움·평점을 모은다.
//   포지션군별로 20경기(45분 이상) 이상 뛴 선수의 0 G+A 비율, G+A 중앙값, 평균 평점, OVR 구간별 분해. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/wing-output.ts -- [worldSeed=wing-0] [최소출전=20] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { posGroup } from '../../src/roster';
import { rebuildRosters } from '../../src/game';
import { naturalOvr, teamRatings } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const WORLD = args[0] ?? 'wing-0';
const MIN_APPS = Number(args[1] ?? 20);

const rosters = rebuildRosters(WORLD, undefined, 0);
const ratings = teamRatings(rosters);
const ids = Object.keys(ratings);
const leagueAvg = ids.reduce((t, id) => t + ratings[id]!, 0) / ids.length;
interface Acc { pos: Record<string, number>; apps: number; starts: number; minutes: number; goals: number; assists: number; shots: number; keyPasses: number; dribblesWon: number; ratingSum: number; ratingN: number; team: string; ovr: number; age: number }
const acc = new Map<string, Acc>();
const ovrOf = new Map<string, { ovr: number; age: number; team: string }>();
const teamShots = new Map<string, number>();
for (const id of ids) for (const p of rosters[id]!.players) ovrOf.set(p.id, { ovr: naturalOvr(p), age: p.age, team: id });

const t0 = Date.now();
let seed = 500000;
let n = 0;
for (const h of ids) for (const a of ids) {
  if (h === a) continue;
  const home = teamSetupFromRoster(rosters[h]!, ratings[h]!, ratings[a]!, WORLD, undefined, leagueAvg);
  const away = teamSetupFromRoster(rosters[a]!, ratings[a]!, ratings[h]!, WORLD, undefined, leagueAvg);
  const r = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: seed++, bigMatch: false }).runToEnd();
  for (const p of r.players) {
    const tid = p.team === 0 ? h : a;
    teamShots.set(tid, (teamShots.get(tid) ?? 0) + p.shots);
    const meta = ovrOf.get(p.id) ?? { ovr: 0, age: 0, team: '?' };
    const x = acc.get(p.id) ?? { pos: {}, apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, shots: 0, keyPasses: 0, dribblesWon: 0, ratingSum: 0, ratingN: 0, team: meta.team, ovr: meta.ovr, age: meta.age };
    if (p.minutes <= 0) continue;
    x.pos[p.position] = (x.pos[p.position] ?? 0) + p.minutes;
    x.minutes += p.minutes;
    if (p.minutes >= 45) { x.apps++; x.ratingSum += p.rating; x.ratingN++; }
    x.goals += p.goals; x.assists += p.assists; x.shots += p.shots; x.keyPasses += p.keyPasses; x.dribblesWon += p.dribblesWon;
    acc.set(p.id, x);
  }
  n++;
  if (n % 50 === 0) process.stdout.write(`  경기 ${n}/380 (${((Date.now() - t0) / 1000).toFixed(0)}초)\r`);
}
console.log(`\n### 윙 산출 (실제 로스터 PL ${WORLD}, 380경기, ${((Date.now() - t0) / 60000).toFixed(1)}분, 출전 = 45분 이상, 최소 ${MIN_APPS}경기)`);
const rows = [...acc.entries()].map(([id, x]) => {
  const mainPos = Object.entries(x.pos).sort((p, q) => q[1] - p[1])[0]![0];
  return { id, ...x, mainPos, group: posGroup(mainPos as never) as string, ga: x.goals + x.assists, rating: x.ratingSum / Math.max(1, x.ratingN) };
}).filter((x) => x.apps >= MIN_APPS);
const med = (xs: number[]) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0; };
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const pct = (v: number, n: number) => `${(100 * v / Math.max(1, n)).toFixed(0)}%`;
console.log('\n포지션군 | 선수 수 | 0 G+A | G+A ≤ 2 | G+A 중앙값 | 골 평균 | 도움 평균 | 슈팅/경기 | 키패스/경기 | 평균 평점 | 0 G+A 선수 평점');
for (const g of ['ST', 'WING', 'CAM', 'CM', 'CDM', 'FB', 'CB', 'GK']) {
  const xs = rows.filter((x) => x.group === g);
  if (!xs.length) continue;
  const zero = xs.filter((x) => x.ga === 0);
  console.log(`${g.padEnd(5)} | ${String(xs.length).padStart(3)} | ${pct(zero.length, xs.length).padStart(4)} | ${pct(xs.filter((x) => x.ga <= 2).length, xs.length).padStart(4)} | ${med(xs.map((x) => x.ga))} | ${avg(xs.map((x) => x.goals)).toFixed(1)} | ${avg(xs.map((x) => x.assists)).toFixed(1)} | ${avg(xs.map((x) => x.shots / x.apps)).toFixed(2)} | ${avg(xs.map((x) => x.keyPasses / x.apps)).toFixed(2)} | ${avg(xs.map((x) => x.rating)).toFixed(2)} | ${zero.length ? avg(zero.map((x) => x.rating)).toFixed(2) : '-'}`);
}
console.log('\n윙어 OVR 구간별 (20경기 이상): 구간 | 선수 수 | 0 G+A | G+A 중앙값 | 골·도움 평균 | 슈팅/경기 | 크로스? 키패스/경기 | 평점');
for (const [lo, hi] of [[0, 60], [60, 70], [70, 78], [78, 100]] as const) {
  const xs = rows.filter((x) => x.group === 'WING' && x.ovr >= lo && x.ovr < hi);
  if (!xs.length) { console.log(`  ${lo}~${hi}: 0명`); continue; }
  console.log(`  ${lo}~${hi} | ${xs.length} | ${pct(xs.filter((x) => x.ga === 0).length, xs.length)} | ${med(xs.map((x) => x.ga))} | ${avg(xs.map((x) => x.goals)).toFixed(1)}·${avg(xs.map((x) => x.assists)).toFixed(1)} | ${avg(xs.map((x) => x.shots / x.apps)).toFixed(2)} | ${avg(xs.map((x) => x.keyPasses / x.apps)).toFixed(2)} | ${avg(xs.map((x) => x.rating)).toFixed(2)}`);
}
console.log('\n윙어 세부 (20경기 이상): 구분 | 선수 수 | 0 G+A | G+A ≤ 2 | G+A 중앙값 | 슈팅/경기 | 팀 슈팅 중 비중 % | 키패스/경기 | 평점');
const wingRow = (label: string, xs: typeof rows) => { if (!xs.length) { console.log(`  ${label}: 0명`); return; } const share = avg(xs.map((x) => x.shots / Math.max(1, (teamShots.get(x.team) ?? 0) / 38 * (x.apps / 38) * 38) )); void share; const sh = avg(xs.map((x) => (x.shots / x.apps) / ((teamShots.get(x.team) ?? 1) / 38))); console.log(`  ${label.padEnd(18)} | ${xs.length} | ${pct(xs.filter((x) => x.ga === 0).length, xs.length)} | ${pct(xs.filter((x) => x.ga <= 2).length, xs.length)} | ${med(xs.map((x) => x.ga))} | ${avg(xs.map((x) => x.shots / x.apps)).toFixed(2)} | ${(100 * sh).toFixed(0)}% | ${avg(xs.map((x) => x.keyPasses / x.apps)).toFixed(2)} | ${avg(xs.map((x) => x.rating)).toFixed(2)}`); };
const wings = rows.filter((x) => x.group === 'WING');
wingRow('LW/RW', wings.filter((x) => x.mainPos === 'LW' || x.mainPos === 'RW'));
wingRow('LM/RM', wings.filter((x) => x.mainPos === 'LM' || x.mainPos === 'RM'));
for (const [lo, hi, lb] of [[0, 72, '팀 레이팅 <72'], [72, 78, '팀 72~78'], [78, 100, '팀 ≥78']] as const) wingRow(lb, wings.filter((x) => (ratings[x.team] ?? 0) >= lo && (ratings[x.team] ?? 0) < hi));
for (const [lo, hi, lb] of [[0, 72, 'ST 팀 <72'], [78, 100, 'ST 팀 ≥78']] as const) wingRow(lb, rows.filter((x) => x.group === 'ST' && (ratings[x.team] ?? 0) >= lo && (ratings[x.team] ?? 0) < hi));
console.log(`  팀 슈팅/경기: ${ids.map((id) => `${id} ${ratings[id]!.toFixed(0)} ${((teamShots.get(id) ?? 0) / 38).toFixed(1)}`).join(' · ')}`);
console.log('\n윙어 전원 (20경기 이상, G+A 오름차순 하위 12명): id | 팀 | OVR | 나이 | 출전 | 골 | 도움 | 슈팅/경기 | 평점');
for (const x of rows.filter((x) => x.group === 'WING').sort((p, q) => p.ga - q.ga || p.rating - q.rating).slice(0, 12)) console.log(`  ${x.id.padEnd(22)} ${x.team.padEnd(8)} ${x.ovr.toFixed(0)} ${x.age} ${x.apps} ${x.goals} ${x.assists} ${(x.shots / x.apps).toFixed(2)} ${x.rating.toFixed(2)}`);
const st = rows.filter((x) => x.group === 'ST').sort((p, q) => p.ga - q.ga).slice(0, 5);
console.log('\nST 하위 5명: ' + st.map((x) => `${x.id} ${x.ovr.toFixed(0)} ${x.apps}경기 ${x.goals}+${x.assists} ${x.rating.toFixed(2)}`).join(' · '));
process.exit(0);
