// @ts-nocheck — 진단 스크립트 (엔진관리자19, C.79l 미해결 6 GK 역동작 축 탐침)
// 균형 4-4-2 대 균형 4-4-2 (동레이팅 75, 메인 스레드 probe 훅 + 상태 읽기만, 지문 불변) 를 돌려 발 슛 1건마다
//  ⒜ 슛 순간 GK 의 옆 속도(골라인 방향 vy) 와 노린 쪽(aimY − gkY) 의 관계: 정지(<1 m/s) · 노린 쪽으로 움직임 · 반대쪽(역동작) · 슛 선 쪽(1대1 전진)
//  ⒝ 거리 구간(<12 · 12~16.5 · 16.5~25 · 25+)별 유효 슛 수·선방률·덮는 정도(cover)·모델 선방 확률
//  ⒞ 같은 슛에 역동작 항(반응 시간 + wf × min(1, 반대 속도/ref))을 넣었을 때 모델 선방 확률(실행식 재현, 엔진은 안 바꿈)
//  ⒟ 유효 슛 순간 마지막 패스 뒤 경과 시간·그 패스의 옆 이동(|Δy|)·GK urgent 비율
// 실행: npx vite-node scripts/diag/c79l-gk.ts -- [경기수=40] [A=balanced] [B=balanced] [seed=91000] [wf=0.3] [ref=3] [경로=값 …]

import { createMatch } from '../../src/engine/sim';
import { probe } from '../../src/engine/probe';
import { ENGINE } from '../../src/engine/config';
import { attackDir, ownGoal, dist, segDist, clamp } from '../../src/engine/pitch';
import { gkAttrs, saveChance, coverOf, reactOf } from '../../src/engine/keeper';
import { pressureAt } from '../../src/engine/onball';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { FORMATION_SLOTS } from '../../src/formations';
import { setEnvironmentFixed } from '../../src/weather';

setEnvironmentFixed(true);
const all = process.argv.slice(2).filter((a) => a !== '--');
const overrides: Record<string, number> = {};
let n = 40;
let seed0 = 91000;
let wf = 0.3;
let ref = 3;
const specs: string[] = [];
for (const a of all) {
  if (a.startsWith('seed=')) seed0 = Number(a.slice(5));
  else if (a.startsWith('wf=')) wf = Number(a.slice(3));
  else if (a.startsWith('ref=')) ref = Number(a.slice(4));
  else if (a.includes('=')) { const [k, v] = a.split('='); overrides[k!] = Number(v); }
  else if (/^\d+$/.test(a)) n = Number(a);
  else specs.push(a);
}
if (specs.length < 2) specs.push(...['balanced', 'balanced'].slice(specs.length));
for (const [path, v] of Object.entries(overrides)) {
  const keys = path.split('.'); let o = ENGINE as unknown as Record<string, unknown>;
  for (const k of keys.slice(0, -1)) o = o[k] as Record<string, unknown>;
  o[keys[keys.length - 1]!] = v;
}
const BALANCED = { tendency: 'balanced', lineHeight: 0.5, pressing: 0.55, style: 0.5, width: 1 };
const tac = (spec: string) => {
  if (spec === 'balanced') return BALANCED;
  const [t, lv] = spec.split('@') as [Tendency, string | undefined];
  const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined;
  return tacticsOf(t, levels);
};
function build(side: string, seed: number, rating: number, spec: string, oppRating: number) {
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
const K = ENGINE.keeper;
/** keeper.ts timeTerms + saveChance 재현 (reactExtra 초를 반응 시간에 더함) */
function modelSave(c: any, reactExtra: number): { p: number; cover: number } {
  const g = c.gk;
  const [e, k] = segDist(g.x, g.y, c.fx, c.fy, c.tx, c.ty);
  const tBall = (k * dist(c.fx, c.fy, c.tx, c.ty)) / Math.max(1, c.speed);
  const react = reactOf(c.stop) + reactExtra;
  let drift = 0;
  if (e > 1e-6) {
    const px = c.fx + (c.tx - c.fx) * k;
    const py = c.fy + (c.ty - c.fy) * k;
    drift = clamp(((px - g.x) * g.vx + (py - g.y) * g.vy) / e, -K.driftMax, K.driftMax) * Math.min(tBall, react);
  }
  const dive = Math.max(0, tBall - react);
  const reach = K.timeReach + K.diveSpeed * dive * (c.stop / 80) + drift + K.setSpeed * c.lead;
  const cover = clamp(1 - (e - reach) / K.reachSpan, 0, 1);
  const avail = dive + c.lead;
  const delta = K.speedW * (c.speed / 30) + K.cornerW * c.corner + K.distW * (1 - clamp(avail / K.availRef, 0, 1));
  return { p: clamp(K.saveBase - K.saveDelta * delta + (K.saveSkill * (c.stop - K.saveCenter)) / 100 + c.body, 0.05, 0.95) * cover, cover };
}
interface Rec { d: number; out: any; gkV: number; vLat: number; vTo: number; vAlong: number; cover: number; pSave: number; pWf: number; pWf2: number; sincePass: number; passDy: number; urgent: boolean; press3: number; gs: number; one: boolean; mismatch: number }
const recs: Rec[] = [];
let mismatchMax = 0;
for (let k = 0; k < n; k++) {
  const seed = seed0 + k;
  const A = build('a', seed, 75, specs[0]!, 75);
  const B = build('b', seed, 75, specs[1]!, 75);
  const sim = createMatch({ home: k % 2 ? A : B, away: k % 2 ? B : A, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = sim.state;
  probe.shot = (st, p) => {
    if (p.kind !== 'foot' || p.outcome !== 'onTarget') return;
    const a = st.agents[p.shooter]!;
    const defTeam = (1 - a.team) as 0 | 1;
    const dirD = attackDir(defTeam, st.half);
    const [gx, gy] = ownGoal(dirD);
    let gk: any = null;
    let gs = 0;
    for (const o of st.agents) {
      if (!o.onPitch || o.team !== defTeam) continue;
      if (o.line === 0) gk = o;
      else if (dist(o.x, o.y, gx, gy) < p.d - 0.5) gs++;
    }
    if (!gk) return;
    const corner = clamp(Math.abs(p.aimY - gy) / (ENGINE.pitch.goalWidth / 2 - 0.3), 0, 1);
    const ctx = {
      fx: p.x, fy: p.y, svx: a.vx, svy: a.vy, d: p.d, header: false, press3: p.press3, pressure: pressureAt(st, a),
      tx: p.aimX, ty: p.aimY, corner, speed: p.ballSpeed, gk: { x: gk.x, y: gk.y, vx: gk.vx, vy: gk.vy }, stop: gkAttrs(gk).shotStopping, body: gk.body.gkSave ?? 0, lead: 0, screen: 0,
    };
    const m0 = modelSave(ctx, 0);
    const mismatch = Math.abs(m0.p - saveChance(ctx));
    mismatchMax = Math.max(mismatchMax, mismatch);
    // 옆 속도: 골라인 방향(y). 노린 쪽 = sign(aimY − gkY)
    const toSign = Math.sign(p.aimY - gk.y) || 1;
    const vTo = gk.vy * toSign; // + 노린 쪽으로, − 반대(역동작)
    const vOpp = Math.max(0, -vTo);
    const m1 = modelSave(ctx, wf * Math.min(1, vOpp / ref));
    const m2 = modelSave(ctx, 2 * wf * Math.min(1, vOpp / ref));
    // 슛 선 방향 속도 (슈터 쪽 +)
    const sx = p.x - gk.x, sy = p.y - gk.y, sl = Math.hypot(sx, sy) || 1;
    const vAlong = (gk.vx * sx + gk.vy * sy) / sl;
    const lp = st.lastPass;
    const sincePass = lp ? st.t - lp.t : 99;
    const passDy = lp && lp.t >= st.possSince ? Math.abs((st.agents[lp.passer]?.y ?? 0) - a.y) : NaN;
    const rec: Rec = { d: p.d, out: p, gkV: Math.hypot(gk.vx, gk.vy), vLat: Math.abs(gk.vy), vTo, vAlong, cover: m0.cover, pSave: m0.p, pWf: m1.p, pWf2: m2.p, sincePass, passDy, urgent: !!gk.urgent, press3: p.press3, gs, one: gs === 0, mismatch };
    recs.push(rec);
  };
  while (!s.done) sim.step();
  probe.shot = undefined;
}
const pc = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(1) : '-');
const f2 = (x: number) => x.toFixed(2);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const saved = (r: Rec) => r.out.outcome === 'save';
console.log(`\n${specs[0]} 대 ${specs[1]} · 75:75 · ${n}경기 · 시드 ${seed0}~ · 덮어쓰기 ${JSON.stringify(overrides)} · 역동작 가정 wf=${wf}s ref=${ref}m/s · 실행식 재현 오차 최대 ${mismatchMax.toExponential(2)}`);
const bins: [number, number, string][] = [[0, 12, '<12'], [12, 16.5, '12~16.5'], [16.5, 25, '16.5~25'], [25, 99, '25+']];
const classes: [string, (r: Rec) => boolean][] = [
  ['정지 |vy|<1', (r) => r.vLat < 1],
  ['노린 쪽 1~3', (r) => r.vLat >= 1 && r.vLat < 3 && r.vTo > 0],
  ['역동작 1~3', (r) => r.vLat >= 1 && r.vLat < 3 && r.vTo < 0],
  ['노린 쪽 3+', (r) => r.vLat >= 3 && r.vTo > 0],
  ['역동작 3+', (r) => r.vLat >= 3 && r.vTo < 0],
];
console.log('\n⒜⒝ 발 유효 슛 (팀당 /경기): 거리 × GK 옆 속도 분류 — n · 선방% · cover 평균 · 모델 선방 평균 · 역동작 항 넣은 모델 선방(wf · 2wf) · 자리(cover ≥ 0.9)%');
console.log('| 거리 | 분류 | n/경기 | 선방% | cover | 모델 | +wf | +2wf | 자리% | 1대1(gs 0)% |');
console.log('|---|---|---|---|---|---|---|---|---|---|');
for (const [lo, hi, nm] of bins) {
  const xs = recs.filter((r) => r.d >= lo && r.d < hi);
  const rows = [['전체', () => true] as [string, (r: Rec) => boolean], ...classes];
  for (const [cn, f] of rows) {
    const ys = xs.filter(f);
    if (!ys.length) continue;
    console.log(`| ${nm} | ${cn} | ${f2(ys.length / n / 2)} | ${pc(ys.filter(saved).length, ys.length)} | ${f2(avg(ys.map((r) => r.cover)))} | ${f2(avg(ys.map((r) => r.pSave)))} | ${f2(avg(ys.map((r) => r.pWf)))} | ${f2(avg(ys.map((r) => r.pWf2)))} | ${pc(ys.filter((r) => r.cover >= 0.9).length, ys.length)} | ${pc(ys.filter((r) => r.one).length, ys.length)} |`);
  }
}
console.log('\n⒟ 12~16.5 m 유효 슛 — 마지막 패스 뒤 경과 시간 분포 · 그 패스 옆 이동 · GK urgent · GK 속도 분포');
const mid = recs.filter((r) => r.d >= 12 && r.d < 16.5);
const tb: [number, number, string][] = [[0, 0.5, '<0.5s'], [0.5, 1, '0.5~1'], [1, 2, '1~2'], [2, 4, '2~4'], [4, 99, '4+']];
for (const [lo, hi, nm] of tb) {
  const ys = mid.filter((r) => r.sincePass >= lo && r.sincePass < hi);
  console.log(`- 패스 뒤 ${nm}: ${pc(ys.length, mid.length)}% · 선방 ${pc(ys.filter(saved).length, ys.length)}% · GK 옆 속도 평균 ${f2(avg(ys.map((r) => r.vLat)))} · 역동작(vTo<−1) ${pc(ys.filter((r) => r.vTo < -1).length, ys.length)}% · 패스 |Δy| 평균 ${f2(avg(ys.filter((r) => !Number.isNaN(r.passDy)).map((r) => r.passDy)))} m · urgent ${pc(ys.filter((r) => r.urgent).length, ys.length)}%`);
}
const vb: [number, number, string][] = [[0, 1, '<1'], [1, 2, '1~2'], [2, 3, '2~3'], [3, 5, '3~5'], [5, 99, '5+']];
console.log('- GK 전체 속도 분포(12~16.5): ' + vb.map(([lo, hi, nm]) => `${nm}: ${pc(mid.filter((r) => r.gkV >= lo && r.gkV < hi).length, mid.length)}%`).join(' · '));
console.log('- 슛 선 쪽 전진 속도 vAlong ≥ 2 (12~16.5): ' + pc(mid.filter((r) => r.vAlong >= 2).length, mid.length) + '% · 1대1(gs 0) 중 ' + pc(mid.filter((r) => r.one && r.vAlong >= 2).length, mid.filter((r) => r.one).length) + '%');
// 거리 구간별 득점 변화 추정: (모델 선방 − 역동작 모델 선방) 합 / 경기
console.log('\n⒞ 역동작 항을 넣으면 거리별 기대 골 변화 (유효 슛 합산, /경기·팀): ' + bins.map(([lo, hi, nm]) => { const ys = recs.filter((r) => r.d >= lo && r.d < hi); return `${nm}: +${(ys.reduce((a, r) => a + (r.pSave - r.pWf), 0) / n / 2).toFixed(3)} (2wf +${(ys.reduce((a, r) => a + (r.pSave - r.pWf2), 0) / n / 2).toFixed(3)})`; }).join(' · '));
process.exit(0);
