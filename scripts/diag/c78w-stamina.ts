// @ts-nocheck — 진단 스크립트 (엄격 타입 검사 제외)
// C.78w 2단 체력 측정: 성향 짝 하나 — 시간대(0~45 · 45~65 · 65~)별 경기 체력·순간 체력 평균, 상대 소유 중 소유자 4 m 안 2명+ 압박 비율,
// 경기당 필드 선수 이동 거리(평균·최다), 스프린트 수(팀 합), 연속 스프린트 최장(초), 침투 수신·슈팅·골.
// 메인 스레드(상태 읽기만). 실행: npx vite-node scripts/diag/c78w-stamina.ts -- [경기수=30] A전술 B전술 [레이팅=75:75] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { dist } from '../../src/engine/pitch';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 30;
let ratings = [75, 75];
for (const a of all) {
  if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else if (/^\d+:\d+$/.test(a)) ratings = a.split(':').map(Number);
  else specs.push(a);
}
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
const tac = (spec: string) => {
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
function build(side: string, seed: number, rating: number, spec: string, oppRating: number): TeamSetup {
  const roster = createTeamRoster({ id: `v${side}${seed}`, rating }, `eng-${side}-${rating}-${seed}`, 2018, []);
  roster.formation = '4-4-2';
  const setup = teamSetupFromRoster(roster, rosterRating(roster), oppRating, `w${seed}`);
  const before = setup.tactics.tendency;
  setup.tactics = { ...setup.tactics, ...tac(spec) };
  if (setup.tactics.tendency !== before) {
    const slots = FORMATION_SLOTS[roster.formation];
    for (const p of setup.lineup) delete p.role;
    fillRoles(setup, (slot) => slots[slot]!.pos);
  }
  return setup;
}
const NB = 3;
const bucket = (t: number) => (t < 45 * 60 ? 0 : t < 65 * 60 ? 1 : 2);
const z = () => Array(NB).fill(0) as number[];
const mk = () => ({ stam: z(), burst: z(), sN: z(), oppT: z(), opp2: z(), sprints: z(), spr1: z(), dist: 0, distMax: 0, longest: 0, long10: 0, thr: 0, shots: 0, goals: 0, players: 0 });
type T = ReturnType<typeof mk>;
const acc: [T, T] = [mk(), mk()];
let distMaxAll = 0;
for (let k = 0; k < n; k++) {
  const seed = 41000 + k;
  const A = build('a', seed, ratings[0]!, specs[0]!, ratings[1]!);
  const B = build('b', seed, ratings[1]!, specs[1]!, ratings[0]!);
  const aHome = k % 2 === 1;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const who = (team: 0 | 1) => ((team === 0) === aHome ? 0 : 1);
  const runT = new Map<number, number>();
  const prevSpr = new Map<number, number>();
  while (!s.done) {
    sim.step();
    const t = s.t, bk = bucket(t), b = s.ball;
    for (const a of s.agents) {
      if (!a.onPitch || a.line === 0) continue;
      const X = acc[who(a.team)];
      const ps = prevSpr.get(a.idx) ?? 0;
      if (a.stats.sprints > ps) { X.sprints[bk]! += a.stats.sprints - ps; prevSpr.set(a.idx, a.stats.sprints); }
      const r = a.sprinting ? (runT.get(a.idx) ?? 0) + ENGINE.time.dt : 0;
      if (!a.sprinting && (runT.get(a.idx) ?? 0) >= 1) X.spr1[bk]!++;
      if (r >= 10 && (runT.get(a.idx) ?? 0) < 10) X.long10++;
      runT.set(a.idx, r);
      if (r > X.longest) X.longest = r;
      if (s.tick % 10 === 0) { X.stam[bk]! += a.stamina; X.burst[bk]! += a.burst ?? 100; X.sN[bk]!++; }
    }
    if (b.owner < 0 || s.restart) continue;
    const o = s.agents[b.owner]!;
    const dt = (1 - o.team) as 0 | 1;
    let n4 = 0;
    for (const a of s.agents) if (a.onPitch && a.line !== 0 && a.team === dt && dist(a.x, a.y, o.x, o.y) <= 4) n4++;
    const D = acc[who(dt)];
    D.oppT[bk]!++; if (n4 >= 2) D.opp2[bk]!++;
  }
  for (const a of s.agents) {
    if (a.line === 0 || a.stats.distance <= 0) continue;
    const X = acc[who(a.team)];
    X.dist += a.stats.distance; X.players++;
    if (a.stats.distance > X.distMax) X.distMax = a.stats.distance;
    if (a.stats.distance > distMaxAll) distMaxAll = a.stats.distance;
  }
  for (const tm of [0, 1] as const) { const X = acc[who(tm)]; X.thr += s.teams[tm].stats.throughReceived ?? 0; X.shots += s.teams[tm].stats.shots; X.goals += s.teams[tm].stats.goals; }
}
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-');
const per = (a: number) => (a / n).toFixed(1);
console.log(`\n${specs[0]} 대 ${specs[1]} · ${ratings.join(':')} · ${n}경기 · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 팀 | 시간대 | 경기 체력 | 순간 체력 | 2명+ 압박% | 스프린트/경기 | 1초+ 스프린트/경기 |');
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  for (let q = 0; q < NB; q++) console.log(`| ${nm} ${specs[i]} | ${['0~45', '45~65', '65~'][q]} | ${(X.stam[q]! / X.sN[q]!).toFixed(1)} | ${(X.burst[q]! / X.sN[q]!).toFixed(1)} | ${pc(X.opp2[q]!, X.oppT[q]!)} | ${per(X.sprints[q]!)} | ${per(X.spr1[q]!)} |`);
});
console.log('| 팀 | 필드 선수 평균 km | 팀 최다 km(전 경기) | 스프린트 합/경기 | 1초+ 합 | 연속 스프린트 최장 초 | 10초+ 연속/경기 | 침투 수신 | 슈팅 | 골 |');
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  console.log(`| ${nm} ${specs[i]} | ${(X.dist / X.players / 1000).toFixed(2)} | ${(X.distMax / 1000).toFixed(2)} | ${per(X.sprints.reduce((p, c) => p + c, 0))} | ${per(X.spr1.reduce((p, c) => p + c, 0))} | ${X.longest.toFixed(1)} | ${(X.long10 / n).toFixed(2)} | ${per(X.thr)} | ${per(X.shots)} | ${per(X.goals)} |`);
});
console.log(`전체 최다 이동 거리 ${(distMaxAll / 1000).toFixed(2)} km`);
process.exit(0);
