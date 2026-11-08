// 진단 (C.78b): 침투 패스 도착 순간 받을 선수의 속도·도착점까지 거리·먼저 도착했는가, 받는 방식(바로/굴려 보냄). 엔진 코드는 바꾸지 않는다.
// npx vite-node scripts/diag/c78b-through.ts -- [경기수=6] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { TeamSetup } from '../../src/engine/types';
import type { Flight } from '../../src/engine/state';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const N = Number(allArgs.filter((x) => !x.includes('='))[0] ?? 6);
const mk = (side: string, i: number): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`);
  s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};
const R = { n: 0, v: [] as number[], d: [] as number[], early: 0, snap: 0, roll: 0, miss: 0, tRun: [] as number[] };
for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('H', i), away: mk('A', i), mode: 'auto', difficulty: 'normal', seed: 9300 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let cur: Flight | null = null;
  let firstNear = -1;
  while (!s.done) {
    const fl = s.ball.flight;
    if (fl && fl.through && fl.outcome === 'receive' && fl !== cur) { cur = fl; firstNear = -1; }
    if (cur && fl === cur) {
      const rc = s.agents[cur.receiver]!;
      if (firstNear < 0 && Math.hypot(rc.x - cur.toX, rc.y - cur.toY) < 1.5) firstNear = s.t;
      const k = (s.t + ENGINE.time.dt - cur.t0) / cur.dur;
      if (k >= 1 - 1e-9) {
        R.n++;
        R.v.push(Math.hypot(rc.vx, rc.vy));
        R.d.push(Math.hypot(rc.x - cur.toX, rc.y - cur.toY));
        if (firstNear >= 0) { R.early++; R.tRun.push(s.t - firstNear); }
        m.step();
        if (s.ball.owner === rc.idx) R.snap++;
        else if (s.ball.reserve?.idx === rc.idx) R.roll++;
        else R.miss++;
        cur = null;
        continue;
      }
    }
    m.step();
  }
}
const avg = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const pc = (x: number) => `${((x / Math.max(1, R.n)) * 100).toFixed(0)}%`;
console.log(`침투 패스 도착 ${R.n}: 받을 선수 속도 ${avg(R.v).toFixed(1)} m/s · 도착점까지 ${avg(R.d).toFixed(1)} m · 먼저 도착(1.5 m 안) ${pc(R.early)} (평균 ${avg(R.tRun).toFixed(2)} s 전) · 바로 받음 ${pc(R.snap)} · 굴려 보냄 ${pc(R.roll)} · 그 밖 ${pc(R.miss)}`);
