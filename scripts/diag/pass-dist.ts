// 진단 (C.31): 패스 거리 분포와 거리별 성공률, 강·약 팀 차이를 센다.
// 실행: npx vite-node scripts/diag/pass-dist.ts -- [경기수=30] [홈레이팅=76] [원정레이팅=76]
// 패스(침투·컷백·레이오프 포함, 크로스 제외)를 찬 순간의 노린 거리(Flight.aimD)로 나누고,
// 비행 결과가 받기면 성공, 가로채기·루즈면 실패, 공중볼 경합이면 1초 안에 공을 가진 팀으로 센다.
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import type { Flight } from '../../src/engine/state';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';

import { ENGINE } from '../../src/engine/config';

// 경로=값 인자는 엔진 상수를 덮어쓴다 (예: prob.passBase=1.25)
const all = process.argv.slice(2).filter((a) => a !== '--');
for (const a of all.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = all.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 30);
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
type Row = { n: number; ok: number };
const rows: Row[][] = [0, 1].map(() => BINS.slice(0, -1).map(() => ({ n: 0, ok: 0 })));
const goals = [0, 0];
const shots = [0, 0];

for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('a', i, RH, RA), away: mk('b', i, RA, RH), mode: 'auto', difficulty: 'normal', seed: 7000 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  let pending: { team: number; b: number; left: number } | null = null;
  while (!s.done) {
    m.step();
    const fl = s.ball.flight;
    if (pending) {
      if (s.ball.owner >= 0 || s.restart || pending.left <= 0) {
        const own = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
        rows[pending.team]![pending.b]!.n++;
        if (own === pending.team) rows[pending.team]![pending.b]!.ok++;
        pending = null;
      } else pending.left--;
    }
    if (cur && fl !== cur) {
      const team = s.agents[cur.passer]!.team;
      const b = bin(cur.aimD!);
      const out = cur.outcome;
      pending = { team, b, left: 10 };
      cur = null;
      if (out !== 'aerial') {
        rows[team]![b]!.n++;
        if (out === 'receive') rows[team]![b]!.ok++;
        pending = null;
      } else if (s.ball.owner >= 0 || s.restart) {
        const own = s.ball.owner >= 0 ? s.agents[s.ball.owner]!.team : -1;
        rows[team]![pending.b]!.n++;
        if (own === team) rows[team]![pending.b]!.ok++;
        pending = null;
      }
    }
    if (fl && fl !== cur && fl.aimD !== undefined && fl.passer >= 0 && !fl.fromCross) cur = fl;
  }
  for (const t of [0, 1] as const) {
    goals[t]! += s.teams[t].stats.goals;
    shots[t]! += s.teams[t].stats.shots;
  }
}

const pct = (a: number, b: number) => ((100 * a) / Math.max(1, b)).toFixed(1);
console.log(`\n== 패스 거리 분포·성공률 (${N}경기, 홈 ${RH} 대 원정 ${RA}, 팀당 경기당) ==`);
for (const t of [0, 1]) {
  const r = rows[t]!;
  const tot = r.reduce((x, y) => x + y.n, 0);
  const ok = r.reduce((x, y) => x + y.ok, 0);
  const long = r.slice(3).reduce((x, y) => x + y.n, 0);
  const longOk = r.slice(3).reduce((x, y) => x + y.ok, 0);
  console.log(`[${t === 0 ? '홈' : '원정'}] 패스 ${(tot / N).toFixed(0)}, 성공률 ${pct(ok, tot)}%, 30 m+ 비율 ${pct(long, tot)}% 성공 ${pct(longOk, long)}%, 득점 ${(goals[t]! / N).toFixed(2)}, 슈팅 ${(shots[t]! / N).toFixed(1)}`);
  console.log('  ' + r.map((x, b) => `${BINS[b]}~${BINS[b + 1]} m: ${(x.n / N).toFixed(0)}회(${pct(x.n, tot)}%) ${pct(x.ok, x.n)}%`).join(' · '));
}
process.exit(0);
