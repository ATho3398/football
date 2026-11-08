// 진단 (C.76z, 미해결 2): 거리별로 "잃은 패스" 의 실제 비용을 센다 — 잃은 뒤 20초 안 상대 슈팅·골, 10초 안 되찾기, 상대가 공을 잡은 지점과 3초 뒤 지점(우리 공격 기준 nx).
// 판단식 loss() 가 착지점에서 매기는 비용(lossCost)과 실제가 얼마나 다른지 본다.
// 실행: npx vite-node scripts/diag/pass-loss.ts -- [경기수=40] [홈레이팅=76] [원정레이팅=76] [경로=값 ...]
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import type { Flight } from '../../src/engine/state';
import { attackDir, toNorm } from '../../src/engine/pitch';
import { lossCost } from '../../src/engine/onball';
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
const N = Number(args[0] ?? 40);
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
type Row = { n: number; lost: number; shots20: number; goals20: number; regain10: number; lossNx: number; nx3: number; judged: number; fromNx: number; air: number; cnt3: number };
const rows: Row[] = BINS.slice(0, -1).map(() => ({ n: 0, lost: 0, shots20: 0, goals20: 0, regain10: 0, lossNx: 0, nx3: 0, judged: 0, fromNx: 0, air: 0, cnt3: 0 }));
// 비교용: 상대 진영(nx ≥ 0.6)에서 잃은 패스와 자기 진영에서 잃은 패스
type Watch = { team: number; b: number; t0: number; shots0: number; goals0: number; lossNx: number; regained: boolean; did3: boolean; tLoss: number };
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i, RH, RA), away: mk('b', i, RA, RH), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  let pend: { team: number; b: number; fromNx: number; toNx: number; toNy: number; left: number; air: boolean } | null = null;
  const watches: Watch[] = [];
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    // 추적 중인 상실
    for (let w = watches.length - 1; w >= 0; w--) {
      const x = watches[w]!;
      const opp = (1 - x.team) as 0 | 1;
      const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
      if (!x.did3 && s.t - x.tLoss >= 3) {
        x.did3 = true;
        const dir = attackDir(x.team as 0 | 1, s.half);
        rows[x.b]!.nx3 += toNorm(s.ball.x, s.ball.y, dir)[0];
        rows[x.b]!.cnt3++;
      }
      if (!x.regained && owner === x.team && s.t - x.tLoss <= 10) { x.regained = true; rows[x.b]!.regain10++; }
      if (s.t - x.t0 >= 20) {
        rows[x.b]!.shots20 += s.teams[opp]!.stats.shots - x.shots0;
        rows[x.b]!.goals20 += s.teams[opp]!.stats.goals - x.goals0;
        watches.splice(w, 1);
      }
    }
    if (pend) {
      const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
      if (owner >= 0 || s.restart || pend.left <= 0) {
        if (owner >= 0 && owner !== pend.team) {
          const ow = owner as 0 | 1;
          const r = rows[pend.b]!;
          r.lost++;
          const dir = attackDir(pend.team as 0 | 1, s.half);
          const [nx] = toNorm(s.ball.x, s.ball.y, dir);
          r.lossNx += nx;
          r.fromNx += pend.fromNx;
          r.judged += lossCost(pend.toNx, pend.toNy);
          if (pend.air) r.air++;
          watches.push({ team: pend.team, b: pend.b, t0: s.t, shots0: s.teams[ow]!.stats.shots, goals0: s.teams[ow]!.stats.goals, lossNx: nx, regained: false, did3: false, tLoss: s.t });
        }
        pend = null;
      } else pend.left--;
    }
    if (cur && fl !== cur) {
      const team = s.agents[cur.passer]!.team;
      const dir = attackDir(team as 0 | 1, s.half);
      const [fx] = toNorm(cur.fromX, cur.fromY, dir);
      const [tx, ty] = toNorm(cur.toX, cur.toY, dir);
      const b = bin(cur.aimD!);
      rows[b]!.n++;
      pend = { team, b, fromNx: fx, toNx: tx, toNy: ty, left: 10, air: cur.air };
      cur = null;
    }
    if (fl && fl !== cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross && fl.kind !== 'clear') cur = fl;
  }
}
const f = (x: number, d = 2) => x.toFixed(d);
console.log(`\n== 잃은 패스의 실제 비용 (${N}경기, ${RH} 대 ${RA}, 양 팀 합) ==`);
console.log('| 거리 | 패스/경기 | 잃음% | 공중% | 잃은 곳 nx(찬 곳) | 3초 뒤 nx | 10초 안 되찾기% | 잃음당 상대 슈팅/20초 | 잃음당 상대 골/20초 | 판단 lossCost 평균 |');
rows.forEach((r, b) => {
  const L = Math.max(1, r.lost);
  console.log(`| ${BINS[b]}~${BINS[b + 1]} m | ${f(r.n / N, 1)} | ${f((100 * r.lost) / Math.max(1, r.n), 1)} | ${f((100 * r.air) / L, 0)} | ${f(r.lossNx / L)} (${f(r.fromNx / L)}) | ${f(r.nx3 / Math.max(1, r.cnt3))} | ${f((100 * r.regain10) / L, 1)} | ${f(r.shots20 / L, 3)} | ${f(r.goals20 / L, 4)} | ${f(r.judged / L, 4)} |`);
});
process.exit(0);
