// 진단 (부록 C.33, E.21 5번): 같은 슬롯에서 역할만 바꾼 짝지은 비교. 같은 시드, 홈/원정 반씩, 상대는 균형 4-3-3(CAM 은 4-2-3-1).
// 역할마다 그 선수의 활동 위치(평균 위치, 공격·수비 시 x, 측면 정도, 박스 안 비율), 터치, 침투, 태클·인터셉트, 슈팅과 팀 득실차를 낸다.
// 실행: npx vite-node scripts/diag/role-pair.ts -- [경기수=200] [포지션군 ...] [경로=값 ...]
//   SEED=57000 환경변수로 시드 묶음을 바꿔 표본 오차를 확인한다 (기본 47000, 엔진 관리자 C.33 진단)
//   포지션군: WING ST CAM CM CDM FB CB (생략하면 전부)
//   PAIR=1 (C.77d, 펄스 나인 짝 조건 §9.13.5): ST 비교 때 4-3-3 슬롯 8·10 윙 포워드, 6 박스투박스로 고정하고 팀 2선(윙+미드)·ST 골 행을 더 낸다
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
let n = 200;
const groups: string[] = [];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else groups.push(a.toUpperCase());
}
const use = groups.length ? groups : Object.keys(GROUPS);

const plan: { group: string; role: string }[] = [];
for (const g of use) for (const role of ROLE_OPTIONS[g]!) plan.push({ group: g, role });
const jobs: MatchJob[] = [];
for (const { group, role } of plan) {
  const G = GROUPS[group]!;
  for (let k = 0; k < n; k++) {
    const seed = Number(process.env.SEED ?? 47000) + k;
    const pair: Record<number, string> = process.env.PAIR === '1' && group === 'ST' ? { 8: 'wingForward', 10: 'wingForward', 6: 'boxToBox' } : {};
    const me = { ...std('a', seed, 75, G.formation, 'balanced'), roles: { ...pair, [G.slot]: role } };
    const op = std('b', seed, 75, G.formation, 'balanced');
    const home = k % 2 === 0;
    jobs.push({ kind: 'match', seed, neutral: true, home: home ? me : op, away: home ? op : me, overrides, track: { team: home ? 0 : 1, slot: G.slot } });
  }
}
const t0 = Date.now();
const outs = await runJobs<MatchOut>(jobs, { label: `역할 짝 ${jobs.length}경기` });
const msAvg = outs.reduce((t, o) => t + o.ms, 0) / outs.length;
console.log(`\n역할 짝 비교: 레이팅 75 대 75, 균형 전술, 역할마다 ${n}경기, 덮어쓰기 ${JSON.stringify(overrides)}, 경기당 계산 ${(msAvg / 1000).toFixed(2)}초, 전체 ${((Date.now() - t0) / 60000).toFixed(1)}분`);
let i = 0;
for (const g of use) {
  const G = GROUPS[g]!;
  console.log(`\n### ${g} (${G.formation} 슬롯 ${G.slot})`);
  console.log('| 역할 | 득실차 | ±SE | 대비 평균 | 득점 | 실점 | 평균 x | 공격 x | 수비 x | 측면 거리 | 박스% | 최종1/3% | 공간 m | 터치 | 침투 | 슈팅 | 패스 | 롱% | 드리블 | 크로스 | 태클+인터셉트 | 이동 km |');
  console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  const rows: { role: string; gd: number; se: number; line: string; split: string }[] = [];
  for (const role of ROLE_OPTIONS[g]!) {
    const xs = outs.slice(i * n, (i + 1) * n);
    i++;
    const gds = xs.map((m, k) => (k % 2 === 0 ? m.homeGoals - m.awayGoals : m.awayGoals - m.homeGoals));
    const gd = gds.reduce((a, b) => a + b, 0) / n;
    const gf = xs.reduce((a, m, k) => a + (k % 2 === 0 ? m.homeGoals : m.awayGoals), 0) / n;
    const sd = Math.sqrt(gds.reduce((a, b) => a + (b - gd) ** 2, 0) / Math.max(1, n - 1));
    const T = (f: (t: NonNullable<MatchOut['track']>) => number) => xs.reduce((a, m) => a + f(m.track!), 0) / n;
    const lp = (() => {
      const tot = xs.reduce((a, m) => a + m.track!.stats.passes, 0);
      return tot;
    })();
    const line = `${T((t) => t.x).toFixed(3)} | ${T((t) => t.ax).toFixed(3)} | ${T((t) => t.dx).toFixed(3)} | ${T((t) => t.wide).toFixed(3)} | ${(100 * T((t) => t.box)).toFixed(1)} | ${(100 * T((t) => t.final3)).toFixed(1)} | ${T((t) => t.space).toFixed(1)} | ${T((t) => t.touches).toFixed(1)} | ${T((t) => t.runs).toFixed(1)} | ${T((t) => t.stats.shots).toFixed(2)} | ${T((t) => t.stats.passes).toFixed(1)} | - | ${T((t) => t.stats.dribbles).toFixed(2)} | ${T((t) => t.stats.crosses).toFixed(2)} | ${T((t) => t.stats.tackles + t.stats.interceptions).toFixed(2)} | ${(T((t) => t.stats.distance) / 1000).toFixed(2)}`;
    void lp;
    // 팀 득점 분해 (C.77d): ST / 2선(윙+미드) 골·슛 — 펄스 나인은 ST 골 ↓ 대신 2선 골 ↑ 이 의도 (사용자 13:08)
    const grp = (pos: string) => (pos === 'ST' || pos === 'CF' ? 'ST' : pos === 'LW' || pos === 'RW' || pos === 'LM' || pos === 'RM' || pos === 'CM' || pos === 'CAM' || pos === 'CDM' ? 'L2' : 'X');
    const acc = { ST: [0, 0], L2: [0, 0], X: [0, 0] } as Record<string, [number, number]>;
    xs.forEach((m, k) => { const tm = k % 2 === 0 ? 0 : 1; for (const p of m.players) if (p.team === tm) { const v = acc[grp(p.position)]!; v[0] += p.goals; v[1] += p.shots; } });
    const split = `ST 골/슛 ${(acc.ST![0] / n).toFixed(2)}/${(acc.ST![1] / n).toFixed(2)} · 2선 골/슛 ${(acc.L2![0] / n).toFixed(2)}/${(acc.L2![1] / n).toFixed(2)}`;
    rows.push({ role, gd, se: sd / Math.sqrt(n), line: `${gf.toFixed(2)} | ${(gf - gd).toFixed(2)} | ${line}`, split });
  }
  const mean = rows.reduce((a, r) => a + r.gd, 0) / rows.length;
  for (const r of rows) console.log(`| ${ROLE_NAMES_KO[r.role]} | ${r.gd >= 0 ? '+' : ''}${r.gd.toFixed(2)} | ${r.se.toFixed(2)} | ${r.gd - mean >= 0 ? '+' : ''}${(r.gd - mean).toFixed(2)} | ${r.line} |`);
  console.log(`\n팀 득점 분해${process.env.PAIR === '1' && g === 'ST' ? ' (짝 조건: 윙 포워드 ×2 + 박스투박스)' : ''}:`);
  for (const r of rows) console.log(`- ${ROLE_NAMES_KO[r.role]}: ${r.split}`);
}
process.exit(0);
