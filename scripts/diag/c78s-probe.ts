// 진단 (엔진관리자12, C.78s): 성향 짝 하나의 움직임 축 탐침 — 시간대(0~45 · 45~65 · 65~)별로
//  ⒜ 스태미나 평균 ⒝ 상대 소유 중 소유자 4 m 안 우리 2명+ 비율(2:1 압박)·상대 진영에서 그 비율 ⒞ 오픈 플레이 탈취(상대 진영 / 자기 진영) ·
//  잃은 뒤 7명이 공보다 골 쪽으로 돌아오는 시간(10초 상한) · 잃은 뒤 10초 상대 슈팅 ⒟ 압박받은 패스(3 m 안 상대) 성공률 · 자기 진영 절반 잃음 ⒠ 소유 중 소유자 15 m 안 동료 수·
//  상대 수비 폭(필드 10명 y 범위) ⒡ 반대 전환(|Δy| ≥ 30 m 패스) 시도·성공, 30 m+ 패스 3초 뒤 우리 소유 ⒢ 슈팅·골.
// 메인 스레드(probe 훅 · 상태 읽기만, 지문 불변). 실행: npx vite-node scripts/diag/c78s-probe.ts -- [경기수=40] A전술 B전술 [레이팅=75:75] [경로=값 …]
import { setEnvironmentFixed } from '../../src/weather';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { FORMATION_SLOTS } from '../../src/formations';
import { createMatch } from '../../src/engine/sim';
import { ENGINE } from '../../src/engine/config';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import { attackDir, dist, toNorm, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { TeamSetup, Tendency } from '../../src/engine/types';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
const specs: string[] = [];
let n = 40;
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
const mk = () => ({
  stam: z(), stamN: z(), oppT: z(), opp2: z(), oppHiT: z(), oppHi2: z(), winHi: z(), winLo: z(), lost: z(), back: z(), backN: z(), shot10: z(),
  prP: z(), prOk: z(), ownLost: z(), possT: z(), sup: z(), oppWid: z(), sw: z(), swOk: z(), lp: z(), lpKeep: z(), shots: z(), goals: z(), shotNear: z(),
});
type T = ReturnType<typeof mk>;
const acc: [T, T] = [mk(), mk()]; // 0 = A, 1 = B
for (let k = 0; k < n; k++) {
  const seed = 41000 + k;
  const A = build('a', seed, ratings[0]!, specs[0]!, ratings[1]!);
  const B = build('b', seed, ratings[1]!, specs[1]!, ratings[0]!);
  const aHome = k % 2 === 1;
  const sim = createMatch({ home: aHome ? A : B, away: aHome ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  const who = (team: 0 | 1) => ((team === 0) === aHome ? 0 : 1);
  let pend: { team: 0 | 1; kind: 'pr' | 'sw'; bk: number } | null = null;
  let lastTeam: number = -1;
  const lossWatch: ({ t: number; bk: number; back: boolean; shots: number } | null)[] = [null, null];
  let lpWatch: { team: 0 | 1; t: number; bk: number } | null = null;
  const prevShots = [0, 0], prevGoals = [0, 0];
  probe.decide = (st, p) => {
    const a = p.a, c = p.chosen;
    if (pend) { const X = acc[who(pend.team)]; if (pend.team === a.team) { if (pend.kind === 'pr') X.prOk[pend.bk]!++; else X.swOk[pend.bk]!++; } pend = null; }
    if (st.possOrigin !== 'open' && st.restart) return;
    if (c.receiver < 0 || a.line === 0) return;
    const X = acc[who(a.team)], bk = bucket(st.t);
    let near = 99;
    for (const o of st.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) near = Math.min(near, dist(o.x, o.y, a.x, a.y));
    if (Math.abs(c.y - a.y) >= 30) { X.sw[bk]!++; pend = { team: a.team, kind: 'sw', bk }; }
    else if (near <= 3) { X.prP[bk]!++; pend = { team: a.team, kind: 'pr', bk }; }
    if (dist(a.x, a.y, c.x, c.y) >= 30) { X.lp[bk]!++; lpWatch = { team: a.team, t: st.t, bk }; }
  };
  while (!s.done) {
    sim.step();
    const t = s.t, bk = bucket(t), b = s.ball;
    for (const tm of [0, 1] as const) {
      const X = acc[who(tm)];
      const sh = s.teams[tm].stats.shots, g = s.teams[tm].stats.goals;
      if (sh > prevShots[tm]!) { X.shots[bk]! += sh - prevShots[tm]!; const w = lossWatch[1 - tm]; if (w && t - w.t <= 10) acc[who((1 - tm) as 0 | 1)].shot10[w.bk]! += sh - prevShots[tm]!; }
      if (g > prevGoals[tm]!) X.goals[bk]! += g - prevGoals[tm]!;
      prevShots[tm] = sh; prevGoals[tm] = g;
    }
    if (lpWatch && t - lpWatch.t >= 3) { if (b.owner >= 0 && s.agents[b.owner]!.team === lpWatch.team) acc[who(lpWatch.team)].lpKeep[lpWatch.bk]!++; lpWatch = null; }
    if (s.tick % 10 === 0) for (const a of s.agents) if (a.onPitch && a.line !== 0) { const X = acc[who(a.team)]; X.stam[bk]! += a.stamina; X.stamN[bk]!++; }
    if (b.owner < 0 || s.restart) continue;
    const o = s.agents[b.owner]!;
    const ot = o.team, dt = (1 - ot) as 0 | 1;
    // 탈취 (오픈 플레이)
    if (lastTeam >= 0 && lastTeam !== ot && s.possOrigin === 'open') {
      const W2 = acc[who(ot)];
      const nx = toNorm(o.x, o.y, attackDir(ot, s.half))[0];
      if (nx >= 0.5) W2.winHi[bk]!++; else W2.winLo[bk]!++;
      const Lx = acc[who(dt)]; Lx.lost[bk]!++; if (nx < 0.5) {/* 잃은 팀의 상대 진영 */} else Lx.ownLost[bk]!++;
      lossWatch[dt] = { t, bk, back: false, shots: 0 };
    }
    lastTeam = ot;
    // 잃은 뒤 복귀: 잃은 팀 필드 7명이 공보다 자기 골 쪽
    const w = lossWatch[dt];
    if (w && !w.back) {
      const dir = attackDir(dt, s.half);
      const bx = toNorm(b.x, b.y, dir)[0];
      let behind = 0;
      for (const a of s.agents) if (a.onPitch && a.team === dt && a.line !== 0 && toNorm(a.x, a.y, dir)[0] < bx) behind++;
      if (behind >= 7) { w.back = true; acc[who(dt)].back[w.bk]! += Math.min(10, t - w.t); acc[who(dt)].backN[w.bk]!++; }
      else if (t - w.t >= 10) { w.back = true; acc[who(dt)].back[w.bk]! += 10; acc[who(dt)].backN[w.bk]!++; }
    }
    // 압박: 소유자 4 m 안 수비 수
    let n4 = 0, sup = 0, ymin = 99, ymax = -99;
    for (const a of s.agents) {
      if (!a.onPitch || a.line === 0) continue;
      if (a.team === dt) { if (dist(a.x, a.y, o.x, o.y) <= 4) n4++; ymin = Math.min(ymin, a.y); ymax = Math.max(ymax, a.y); }
      else if (a !== o && dist(a.x, a.y, o.x, o.y) <= 15) sup++;
    }
    const D = acc[who(dt)], P = acc[who(ot)];
    D.oppT[bk]!++; if (n4 >= 2) D.opp2[bk]!++;
    if (toNorm(o.x, o.y, attackDir(ot, s.half))[0] < 0.5) { D.oppHiT[bk]!++; if (n4 >= 2) D.oppHi2[bk]!++; }
    P.possT[bk]!++; P.sup[bk]! += sup; P.oppWid[bk]! += ymax - ymin;
  }
  probe.decide = undefined;
}
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-');
const per = (a: number) => (a / n).toFixed(2);
console.log(`\n${specs[0]} 대 ${specs[1]} · ${ratings.join(':')} · ${n}경기 · 덮어쓰기 ${JSON.stringify(overrides)}`);
console.log('| 팀 | 시간대 | 스태미나 | 상대 소유 중 2명+ 압박% | 상대 진영 2명+% | 상대진영 탈취/경기 | 자기진영 탈취 | 잃음 | 7명 복귀 초 | 잃은 뒤 10초 상대 슛 | 압박받은 패스 성공% | 자기 진영 잃음 | 소유자 15 m 동료 | 상대 수비 폭 m | 반대 전환/성공% | 30 m+ 3초 소유% | 슈팅 | 골 |');
['A', 'B'].forEach((nm, i) => {
  const X = acc[i]!;
  for (let q = 0; q < NB; q++) console.log(`| ${nm} ${specs[i]} | ${['0~45', '45~65', '65~'][q]} | ${(X.stam[q]! / X.stamN[q]!).toFixed(1)} | ${pc(X.opp2[q]!, X.oppT[q]!)} | ${pc(X.oppHi2[q]!, X.oppHiT[q]!)} | ${per(X.winHi[q]!)} | ${per(X.winLo[q]!)} | ${per(X.lost[q]!)} | ${(X.back[q]! / X.backN[q]!).toFixed(2)} | ${per(X.shot10[q]!)} | ${pc(X.prOk[q]!, X.prP[q]!)} | ${per(X.ownLost[q]!)} | ${(X.sup[q]! / X.possT[q]!).toFixed(2)} | ${(X.oppWid[q]! / X.possT[q]!).toFixed(1)} | ${per(X.sw[q]!)}/${pc(X.swOk[q]!, X.sw[q]!)} | ${pc(X.lpKeep[q]!, X.lp[q]!)} | ${per(X.shots[q]!)} | ${per(X.goals[q]!)} |`);
});
void W;
process.exit(0);
