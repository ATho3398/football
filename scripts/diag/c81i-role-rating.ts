// 진단 (C.81i, 역할별 평점 득실 재측정): role-pair 와 같은 표본(같은 슬롯에서 역할만 바꾼 짝, 75 대 75 균형, 홈/원정 반씩)에서
// 추적 선수의 평점·골·도움과 팀 득실(득점·실점)을 역할별로 내고, 포지션군 평균과의 차(대비 평균)를 같이 적는다.
// 실행: npx vite-node scripts/diag/c81i-role-rating.ts -- [경기수=400] [포지션군 ...] [경로=값 ...]   SEED=57000 ROLES=a,b 는 role-pair 와 같다
import type { MatchJob, MatchOut } from '../engine/job';
import { runJobs } from '../engine/pool';
import { std } from '../engine/suite';
import { ROLE_NAMES_KO, ROLE_OPTIONS } from '../../src/engine/roles';
import type { Formation } from '../../src/formations';

const GROUPS: Record<string, { formation: Formation; slot: number }> = {
  WING: { formation: '4-3-3', slot: 8 },
  ST: { formation: '4-3-3', slot: 9 },
  CAM: { formation: '4-2-3-1', slot: 8 },
  CM: { formation: '4-3-3', slot: 6 },
  CDM: { formation: '4-3-3', slot: 5 },
  FB: { formation: '4-3-3', slot: 1 },
  CB: { formation: '4-3-3', slot: 2 },
};

const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 400;
const groups: string[] = [];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else groups.push(a.toUpperCase());
}
const use = groups.length ? groups : Object.keys(GROUPS);
const only = process.env.ROLES ? process.env.ROLES.split(',') : null;
const roleList = (g: string) => ROLE_OPTIONS[g]!.filter((r) => !only || only.includes(r));
const seed0 = Number(process.env.SEED ?? 47000);
const jobs: MatchJob[] = [];
for (const g of use) for (const role of roleList(g)) {
  const G = GROUPS[g]!;
  for (let k = 0; k < n; k++) {
    const seed = seed0 + k;
    const me = { ...std('a', seed, 75, G.formation, 'balanced'), roles: { [G.slot]: role } };
    const op = std('b', seed, 75, G.formation, 'balanced');
    const home = k % 2 === 0;
    jobs.push({ kind: 'match', seed, neutral: true, home: home ? me : op, away: home ? op : me, overrides, track: { team: home ? 0 : 1, slot: G.slot } });
  }
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `역할 평점 ${jobs.length}경기` });
console.log(`\n역할별 평점 득실 (C.81i): 레이팅 75 대 75, 균형 전술, 역할마다 ${n}경기, 시드 ${seed0}~, 덮어쓰기 ${JSON.stringify(overrides)}, 전체 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
console.log('대비 평균 = 그 포지션군 역할 평균과의 차 (득실차 목표 ±0.10 → ±0.08 안, 평점은 기록). ±SE 는 득실차 표준오차.');
let i = 0;
const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
for (const g of use) {
  const G = GROUPS[g]!;
  console.log(`\n### ${g} (${G.formation} 슬롯 ${G.slot})`);
  console.log('| 역할 | 득실차 | ±SE | 대비 평균 | 평점 | 평점 대비 | 골 | 도움 | 득점 | 실점 | 실점 대비 | 슈팅 | 패스 | 태클+인터셉트 | 이동 km |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rows: { role: string; gd: number; se: number; rt: number; goals: number; assists: number; gf: number; ga: number; shots: number; passes: number; def: number; km: number }[] = [];
  for (const role of roleList(g)) {
    const xs = outs.slice(i * n, (i + 1) * n);
    i++;
    const gds = xs.map((m, k) => (k % 2 === 0 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals));
    const gd = gds.reduce((a, b) => a + b, 0) / n;
    const gf = xs.reduce((a, m, k) => a + (k % 2 === 0 ? m.homeGoals : m.awayGoals), 0) / n;
    const sd = Math.sqrt(gds.reduce((a, b) => a + (b - gd) ** 2, 0) / Math.max(1, n - 1));
    const T = (f: (s: NonNullable<MatchOut['track']>['stats']) => number) => xs.reduce((a, m) => a + f(m.track!.stats), 0) / n;
    rows.push({
      role, gd, se: sd / Math.sqrt(n), rt: T((s) => s.rating), goals: T((s) => s.goals), assists: T((s) => s.assists), gf, ga: gf - gd,
      shots: T((s) => s.shots), passes: T((s) => s.passes), def: T((s) => s.tackles + s.interceptions), km: T((s) => s.distance) / 1000,
    });
  }
  const mean = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0) / rows.length;
  const mGd = mean((r) => r.gd), mRt = mean((r) => r.rt), mGa = mean((r) => r.ga);
  for (const r of rows) {
    console.log(`| ${ROLE_NAMES_KO[r.role]} | ${sgn(r.gd)} | ${r.se.toFixed(2)} | ${sgn(r.gd - mGd)} | ${r.rt.toFixed(2)} | ${sgn(r.rt - mRt)} | ${r.goals.toFixed(2)} | ${r.assists.toFixed(2)} | ${r.gf.toFixed(2)} | ${r.ga.toFixed(2)} | ${sgn(r.ga - mGa)} | ${r.shots.toFixed(2)} | ${r.passes.toFixed(1)} | ${r.def.toFixed(2)} | ${r.km.toFixed(2)} |`);
  }
}
process.exit(0);
