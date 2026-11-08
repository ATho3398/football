// 진단 (C.78b, 공통 규칙 로드맵 5단계 2차 1번 분해): 오픈 플레이 패스 수신 → 첫 결정까지 시간, 그 사이 가장 가까운 수비 거리 변화, 첫 결정 종류를
// 수신 상황별(압박 거리·공 속도·몸 방향·달리는 중·포지션)로 나눈다. 엔진 코드는 바꾸지 않는다(probe.decide 만).
// npx vite-node scripts/diag/c78b-receive.ts -- [경기수=10] [전술=balanced] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency, TeamSetup } from '../../src/engine/types';
import { probe } from '../../src/engine/probe';
import { attackDir, toNorm } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
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
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 10);
const TN = (args[1] ?? 'balanced') as Tendency;
const mk = (side: string, i: number, tn: Tendency): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = '4-2-3-1';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`);
  s.tactics = tacticsOf(tn);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};

function nearOpp(s: SimState, a: Agent): number {
  let d = Infinity;
  for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) d = Math.min(d, Math.hypot(o.x - a.x, o.y - a.y));
  return d;
}

interface Rec { thr: boolean; v: number; press: number; speed: number; back: boolean; run: boolean; grp: string; nx: number; dt: number; d0: number; d1: number; type: string; oneTouch: boolean }
const recs: Rec[] = [];
let open = null as (Omit<Rec, 'dt' | 'd1' | 'type'> & { a: number; t0: number }) | null;
let decided = null as { a: number; t: number; type: string; d: number } | null;
const last = new Map<number, { a: number; t: number; type: string; d: number }>();
probe.decide = (s, { a, chosen }) => {
  last.set(a.idx, { a: a.idx, t: s.t, type: chosen.type + (chosen.ot ? '·원터치' : ''), d: nearOpp(s, a) });
  if (open && a.idx === open.a && !decided) decided = last.get(a.idx)!;
};
const grpOf = (pos: string) => (/CB|LB|RB|WB/.test(pos) ? 'DEF' : /DM|CM|AM/.test(pos) ? 'MID' : /W|LM|RM/.test(pos) ? 'WIDE' : 'FWD');

for (let i = 0; i < N; i++) {
  const m = createMatch({ home: mk('H', i, TN), away: mk('A', i, 'balanced'), mode: 'auto', difficulty: 'normal', seed: 9300 + i, bigMatch: false, neutral: true });
  const s = m.state;
  let prevOwner = -1;
  let lastFl: { speed: number; fromX: number; fromY: number; thr: boolean } | null = null;
  open = null;
  decided = null;
  last.clear();
  while (!s.done) {
    const fl = s.ball.flight;
    if (fl && fl.outcome === 'receive' && (fl.kind === 'pass' || fl.kind === 'long')) lastFl = { speed: fl.aimD ? fl.aimD / fl.dur : 15, fromX: fl.fromX, fromY: fl.fromY, thr: !!fl.through };
    m.step();
    const o = s.ball.owner;
    if (open && (o !== open.a || decided)) {
      const a: Agent | undefined = s.agents[open.a];
      if (!a) { open = null; decided = null; continue; }
      if (decided) recs.push({ ...open, dt: decided.t - open.t0, d1: decided.d, type: decided.type });
      else recs.push({ ...open, dt: s.t - open.t0, d1: nearOpp(s, a), type: 'lost' });
      open = null;
      decided = null;
    }
    if (o >= 0 && o !== prevOwner && s.lastPass && s.lastPass.receiver === o && Math.abs(s.lastPass.t - s.t) < 0.25 && !s.restart) {
      const a: Agent = s.agents[o]!;
      const dir = attackDir(a.team, s.half);
      open = {
        a: o, t0: s.t, thr: !!lastFl?.thr, v: Math.hypot(a.vx, a.vy), press: nearOpp(s, a), speed: lastFl?.speed ?? 15, back: a.backToGoal, run: Math.hypot(a.vx, a.vy) >= 3,
        grp: grpOf(a.pos), nx: toNorm(a.x, a.y, dir)[0], d0: nearOpp(s, a), oneTouch: !!a.pre,
      };
      // 원터치는 받는 순간(같은 틱) 정했다 — 실행은 다음 틱
      const ld = last.get(o);
      decided = ld && ld.t >= s.t - 0.15 ? { ...ld, t: s.t + 0.1 } : null;
    }
    prevOwner = o;
  }
}

const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
const q = (x: number[], p: number) => { const y = [...x].sort((a, b) => a - b); return y[Math.floor(p * (y.length - 1))] ?? NaN; };
function row(name: string, rs: Rec[]): string {
  const types: Record<string, number> = {};
  for (const r of rs) types[r.type] = (types[r.type] ?? 0) + 1;
  const top = Object.entries(types).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} ${((v / rs.length) * 100).toFixed(0)}`).join(' · ');
  const dts = rs.map((r) => r.dt);
  const v = avg(rs.map((r) => r.v));
  return `| ${name} | ${rs.length} · ${v.toFixed(1)} m/s | ${avg(dts).toFixed(2)} (${q(dts, 0.1).toFixed(1)}~${q(dts, 0.9).toFixed(1)}) | ${avg(rs.map((r) => Math.min(r.d0, 30))).toFixed(1)} → ${avg(rs.map((r) => Math.min(r.d1, 30))).toFixed(1)} | ${((rs.filter((r) => r.d1 <= 1.5).length / Math.max(1, rs.length)) * 100).toFixed(0)}% | ${top} |`;
}
console.log(`수신 → 첫 결정 · ${N}경기 4-2-3-1 ${TN} 대 balanced · 오픈 플레이 패스 수신 ${recs.length} (${(recs.length / N).toFixed(0)}/경기)`);
console.log('| 상황 | 수신 · 받을 때 속도 | 첫 결정까지 s 평균 (10~90%) | 가장 가까운 수비 m 수신 → 결정 | 결정 때 ≤ 1.5 m | 첫 결정 % |');
console.log('|---|---|---|---|---|---|');
console.log(row('전체', recs));
const bins: [string, (r: Rec) => boolean][] = [
  ['압박 < 2 m', (r) => r.press < 2], ['압박 2~5 m', (r) => r.press >= 2 && r.press < 5], ['압박 5 m+', (r) => r.press >= 5],
  ['공 느림 < 12 m/s', (r) => r.speed < 12], ['공 빠름 ≥ 16 m/s', (r) => r.speed >= 16],
  ['등지고 받음', (r) => r.back], ['앞 보고 받음', (r) => !r.back],
  ['침투 패스 수신', (r) => r.thr], ['달리며 (≥ 3 m/s)', (r) => r.run], ['서서', (r) => !r.run],
  ['DEF', (r) => r.grp === 'DEF'], ['MID', (r) => r.grp === 'MID'], ['WIDE', (r) => r.grp === 'WIDE'], ['FWD', (r) => r.grp === 'FWD'],
  ['상대 진영 마지막 1/3', (r) => r.nx > 2 / 3], ['원터치', (r) => r.oneTouch],
  ['서서 받음 < 1 m/s', (r) => r.v < 1], ['앞 보고·달리며·압박 5 m+', (r) => !r.back && r.run && r.press >= 5], ['등지고·압박 < 2 m', (r) => r.back && r.press < 2],
];
for (const [n, f] of bins) console.log(row(n, recs.filter(f)));
