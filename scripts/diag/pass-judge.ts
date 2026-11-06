// 진단 (C.76z, 미해결 2): 패스 순간 판단(candidates 의 p·u)과 실제 결과를 거리별로 비교한다.
// 롱볼(30 m+)은 판단 때 착지점 2.8 m 안 수비수(경합 예상)와 착지 때 실제 경합도 같이 센다.
// 실행: npx vite-node scripts/diag/pass-judge.ts -- [경기수=20] [홈레이팅=76] [원정레이팅=76] [경로=값 ...]
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import type { Flight } from '../../src/engine/state';
import { dist } from '../../src/engine/pitch';
import { candidates } from '../../src/engine/onball';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
import { ENGINE } from '../../src/engine/config';

const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = all.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20);
const RH = Number(args[1] ?? 76);
const RA = Number(args[2] ?? 76);
const mk = (side: string, i: number, rating: number, opp: number) => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating }, `diagC-${side}-${rating}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wC${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  return s;
};
const BINS = [0, 10, 20, 30, 40, 50];
const bin = (d: number) => { let b = 0; while (b + 1 < BINS.length - 1 && d >= BINS[b + 1]!) b++; return b; };
type Row = { n: number; ok: number; pj: number; u: number; alt: number; top: number; jc: number; ac: number; val: number; nonePick: number };
const rows: Row[] = BINS.slice(0, -1).map(() => ({ n: 0, ok: 0, pj: 0, u: 0, alt: 0, top: 0, jc: 0, ac: 0, val: 0, nonePick: 0 }));
let noMatch = 0;
const LC = ENGINE.prob.longContest;
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i, RH, RA), away: mk('b', i, RA, RH), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  let curInfo: { b: number; team: number; jc: boolean } | null = null;
  let pend: { team: number; b: number; left: number } | null = null;
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (pend) {
      const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
      if (owner >= 0 || s.restart || pend.left <= 0) {
        if (owner === pend.team) rows[pend.b]!.ok++;
        pend = null;
      } else pend.left--;
    }
    if (cur && fl !== cur) {
      // 착지: 받는 선수 2.8 m 안 상대 (실제 경합)
      if (curInfo && cur.air) {
        const rc = s.agents[cur.receiver];
        if (rc) { let bd = Infinity; for (const o of s.agents) if (o.onPitch && o.team !== rc.team && o.line !== 0) bd = Math.min(bd, dist(o.x, o.y, rc.x, rc.y)); if (bd < LC) rows[curInfo.b]!.ac++; }
      }
      if (curInfo) pend = { team: curInfo.team, b: curInfo.b, left: 50 };
      cur = null; curInfo = null;
    }
    if (fl && fl !== cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross && fl.kind !== 'clear') {
      cur = fl;
      const a = s.agents[fl.passer]!;
      const b = bin(fl.aimD);
      const cs = candidates(s, a);
      const ch = cs.find((c) => c.receiver === fl.receiver && (c.type === 'pass' || c.type === 'through' || c.type === 'cutback' || c.type === 'layoff'));
      let maxU = -Infinity; for (const c of cs) maxU = Math.max(maxU, c.u);
      let alt = -Infinity;
      for (const c of cs) { if (c === ch) continue; const d = dist(a.x, a.y, c.x, c.y); if ((c.type === 'pass' || c.type === 'through' || c.type === 'carry' || c.type === 'dribble' || c.type === 'hold' || c.type === 'layoff' || c.type === 'cutback') && d < 30) alt = Math.max(alt, c.u); }
      const r = rows[b]!;
      r.n++;
      let jc = false;
      if (ch) {
        r.pj += ch.p; r.u += ch.u; r.val += ch.value; if (ch.u >= maxU - 1e-9) r.top++;
        if (Number.isFinite(alt)) r.alt += alt; else r.nonePick++;
        if (fl.air) { let bd = Infinity; for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) bd = Math.min(bd, dist(o.x, o.y, ch.x, ch.y)); jc = bd < LC; if (jc) r.jc++; }
      } else noMatch++;
      curInfo = { b, team: a.team, jc };
    }
  }
}
const f = (x: number, d = 3) => x.toFixed(d);
console.log(`\n== 패스 판단 대 실제 (${N}경기, ${RH} 대 ${RA}, 양 팀 합; 후보 못 찾음 ${noMatch}) ==`);
console.log('| 거리 | 패스/경기 | 판단 p | 실제 성공%(5초 안 우리 소유) | 효용 u | 대안 최고 u(<30 m) | 최고 효용이었던 비율% | 판단 경합%(착지 2.8 m) | 실제 경합% | 가치 |');
rows.forEach((r, b) => {
  const n = Math.max(1, r.n);
  console.log(`| ${BINS[b]}~${BINS[b + 1]} m | ${f(r.n / N, 1)} | ${f(r.pj / n)} | ${f((100 * r.ok) / n, 1)} | ${f(r.u / n, 4)} | ${f(r.alt / Math.max(1, r.n - r.nonePick), 4)} | ${f((100 * r.top) / n, 0)} | ${f((100 * r.jc) / n, 0)} | ${f((100 * r.ac) / n, 0)} | ${f(r.val / n, 4)} |`);
});
process.exit(0);
