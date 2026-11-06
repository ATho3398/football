// @ts-nocheck — C.76u 에서 가져옴(C.76w). C.77l: main 에서도 돌게 edgeWingFromX 없으면 0.55, finalThirdJob 은 main 에서 export.
//   C.77l 'pre' 목표 분해 행: 목표 갱신 횟수·이동·방향 반전·목표 전진 속도·실제 속도·목표를 정한 분기(run/slot/support/lineCap)
// 진단 (C.76u, 미해결 9 LM/RM 슈팅 비중): 생성 팀 4-4-2(LM/RM) 대 4-3-3(LW/RW) 중립 N경기를 틱 단위로 돌려
//   공이 상대 최종 3분의 1에 있을 때 측면 선수(LM/RM·LW/RW)가 어디에 있는지(상황별: 자기 소유 / 같은 쪽 측면 / 반대쪽 측면 / 중앙),
//   슈팅이 어떤 상황·어떤 공 얻기 뒤에 나오는지, 측면 공의 소유자가 누구(포지션)인지 센다. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/wing-cutback.ts -- [경기수=20] [홈 포메이션=4-4-2] [원정 포메이션=4-3-3] [레이팅=72] [홈 성향=balanced] [경로=값 ...]
import { ENGINE } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { teamSetupFromRoster } from '../../src/engine/setup';
import { attackDir, dist, inOppBox, oppGoal, toNorm, L } from '../../src/engine/pitch';
import { finalThirdJob, offsideLine } from '../../src/engine/offball';
import { slotTarget } from '../../src/engine/formation';
import type { Agent } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import type { Formation } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { BALANCED } from '../engine/job';
import { tacticsOf } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';

const allArgs = process.argv.slice(2).filter((a) => a !== '--');
for (const a of allArgs.filter((x) => x.includes('='))) {
  const [k, v] = a.split('=') as [string, string];
  const path = k.split('.');
  let o = ENGINE as unknown as Record<string, unknown>;
  for (const key of path.slice(0, -1)) o = o[key] as Record<string, unknown>;
  o[path[path.length - 1]!] = Number(v);
}
const args = allArgs.filter((x) => !x.includes('='));
const N = Number(args[0] ?? 20);
const FH = (args[1] ?? '4-4-2') as Formation;
const FA = (args[2] ?? '4-3-3') as Formation;
const RATING = Number(args[3] ?? 72);
const TEND = (args[4] ?? 'balanced') as Tendency | 'balanced';
const O = ENGINE.offball;
const PRE_X = O.edgeWingFromX ?? 0.55;

const mkGen = (side: string, i: number, formation: Formation, opp: number): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: RATING }, `diagU-${side}-${RATING}-${i}`, 2018, []);
  r.formation = formation;
  const s = teamSetupFromRoster(r, rosterRating(r), opp, `wU${i}`);
  s.tactics = { ...s.tactics, ...BALANCED };
  // 홈 포메이션(LM/RM 팀) 성향: 실제 로스터 4-4-2 팀은 direct 3·counter 1·block 1·balanced 1 (wing-0)
  if (formation === FH && TEND !== 'balanced') s.tactics = { ...tacticsOf(TEND) };
  return s;
};

type Sit = 'self' | 'same' | 'opp' | 'center' | 'pre';
interface Cell { ticks: number; dGoal: number; in25: number; inBox: number; behindLine: number; urgent: number; dOwner: number; nx: number; ny: number; job: Record<string, number>; tGoal: number; tDist: number; running: number }
const cell = (): Cell => ({ ticks: 0, dGoal: 0, in25: 0, inBox: 0, behindLine: 0, urgent: 0, dOwner: 0, nx: 0, ny: 0, job: {}, tGoal: 0, tDist: 0, running: 0 });
interface Pre { ticks: number; upd: number; jump: number; fwd: number; rev: number; tgtX0: number; tgtX1: number; secs: number; speed: number; vToward: number; vx: number; tvx: number; tvxN: number; behindBall: number; lab: Record<string, number>; labGap: Record<string, number>; slotGap: number; slotAhead: number; jy: number; ownJ: number; ownN: number; prof: number[]; profN: number[] }
const pre = (): Pre => ({ ticks: 0, upd: 0, jump: 0, fwd: 0, rev: 0, tgtX0: 0, tgtX1: 0, secs: 0, speed: 0, vToward: 0, vx: 0, tvx: 0, tvxN: 0, behindBall: 0, lab: {}, labGap: {}, slotGap: 0, slotAhead: 0, jy: 0, ownJ: 0, ownN: 0, prof: [0, 0, 0, 0, 0], profN: [0, 0, 0, 0, 0] });
interface Acc { pre2: Pre; entryPoss: number[]; entryLine: number[]; entries: number; dwell: number; entryD: number[]; profile: number[][]; players: Set<string>; apps: number; shots: number; teamShots: number; sit: Record<Sit, Cell>; shotBy: Record<string, number>; shotD: number[]; got: Record<string, number>; prevSit: Record<string, number>; ownerPos: Record<string, number>; thirdTicks: number; wideTicks: number }
const acc = (): Acc => ({ pre2: pre(), entryPoss: [], entryLine: [], entries: 0, dwell: 0, entryD: [], profile: [[], [], [], []], players: new Set(), apps: 0, shots: 0, teamShots: 0, sit: { self: cell(), same: cell(), opp: cell(), center: cell(), pre: cell() }, shotBy: {}, shotD: [], got: {}, prevSit: {}, ownerPos: {}, thirdTicks: 0, wideTicks: 0 });
const out: Record<string, Acc> = { 'LM/RM': acc(), 'LW/RW': acc() };
const groupOf = (a: Agent): string | null => (a.pos === 'LM' || a.pos === 'RM' ? 'LM/RM' : a.pos === 'LW' || a.pos === 'RW' ? 'LW/RW' : null);
const inc = (r: Record<string, number>, k: string, v = 1) => (r[k] = (r[k] ?? 0) + v);

// C.77l: 'pre' 구간 목표 추적. 에이전트별 직전 목표·직전 점프 방향·현재 분기
const last = new Map<Agent, { tx: number; ty: number; t: number; sgn: number; lab: string; on: boolean; own: number }>();
function trackPre(g: Acc, a: Agent, s: any, owner: Agent, dir: 1 | -1, bnx: number) {
  const P = g.pre2;
  const dt = ENGINE.time.dt;
  P.ticks++;
  P.secs += dt;
  let L0 = last.get(a);
  const [anx] = toNorm(a.x, a.y, dir);
  const [tnx] = toNorm(a.tx, a.ty, dir);
  const line = offsideLine(s, a.team);
  if (!L0 || !L0.on) { L0 = { tx: a.tx, ty: a.ty, t: s.t, sgn: 0, lab: '?', on: true, own: owner.idx }; last.set(a, L0); }
  const jd = dist(L0.tx, L0.ty, a.tx, a.ty);
  if (jd > 1e-6) {
    P.upd++;
    P.jump += jd;
    P.jy += Math.abs(a.ty - L0.ty);
    if (owner.idx !== L0.own) { P.ownJ += jd; P.ownN++; L0.own = owner.idx; }
    const fx = (a.tx - L0.tx) * dir;
    P.fwd += fx;
    const sg = Math.abs(fx) > 1 ? Math.sign(fx) : 0;
    if (sg && L0.sgn && sg !== L0.sgn) P.rev++;
    if (sg) L0.sgn = sg;
    // 분기 판정: 침투 중 / 슬롯 그대로 / 지원 간격으로 당김 / 라인 캡
    const [snx] = slotTarget(s, a);
    const running = s.t < a.runUntil;
    let lab = 'slot';
    if (running) lab = 'run';
    else if ((snx - tnx) * L > 2.5) lab = Math.abs((line - 1 / L - tnx) * L) < 2.5 ? 'lineCap' : 'support';
    else if ((tnx - snx) * L > 2.5) lab = 'ahead';
    L0.lab = lab;
    L0.tx = a.tx; L0.ty = a.ty;
  }
  const lab = L0.lab;
  P.lab[lab] = (P.lab[lab] ?? 0) + 1;
  const gap = dist(a.x, a.y, a.tx, a.ty);
  P.labGap[lab] = (P.labGap[lab] ?? 0) + gap;
  const el = s.t - L0.t;
  for (const [k, sec] of [0, 1, 2, 3, 5].entries()) if (Math.abs(el - sec) < ENGINE.time.dt / 2) { P.prof[k] += gap; P.profN[k]++; }
  const [snx] = slotTarget(s, a);
  P.slotGap += (snx - anx) * L;
  if (snx > tnx + 2.5 / L) P.slotAhead++;
  const sp = Math.hypot(a.vx, a.vy);
  P.speed += sp;
  P.vToward += gap > 0.1 ? (a.vx * (a.tx - a.x) + a.vy * (a.ty - a.y)) / gap : 0;
  P.vx += a.vx * dir;
  if (tnx < bnx) P.behindBall++;
}
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  for (const swap of [false, true]) {
    const home = mkGen('a', i, swap ? FA : FH, RATING);
    const away = mkGen('b', i, swap ? FH : FA, RATING);
    const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: 7600 + i * 2 + (swap ? 1 : 0), bigMatch: false, neutral: true });
    const s = m.state;
    const prevShots = new Map<Agent, number>();
    // 마지막으로 관찰한 "소유 전 상황": 공을 얻기 직전 틱의 상황 (같은 쪽/반대쪽/중앙/자기 소유) 과 공을 얻은 방식
    const lastSit = new Map<Agent, Sit | 'deep'>();
    const entry = new Map<Agent, { sit: string; got: string }>();
    let prevOwner = -1;
    // 최종 3분의 1 진입 추적: 팀별 진입 시각 (없으면 -1)
    const enteredAt: [number, number] = [-1, -1];
    let lastFl: import('../../src/engine/state').Flight | null = null;
    const wideAgents = s.agents.filter((a) => groupOf(a));
    for (const a of wideAgents) prevShots.set(a, 0);
    while (!s.done) {
      m.step();
      const b = s.ball;
      if (b.flight) lastFl = b.flight;
      const owner = b.owner >= 0 ? s.agents[b.owner]! : null;
      // 소유자가 바뀐 틱: 측면 선수가 공을 얻었으면 직전 상황을 기록
      if (b.owner !== prevOwner) {
        if (owner && groupOf(owner)) {
          const ls = lastSit.get(owner) ?? 'deep';
          const fl = lastFl && lastFl.receiver === owner.idx && s.t - lastFl.t0 < 4 ? lastFl : null;
          const got = owner.gotBy === 'gain' ? 'gain' : fl ? (fl.kind === 'cross' ? 'cross' : fl.quick ? 'quick' : fl.kind) : 'pass';
          entry.set(owner, { sit: ls, got });
        }
        prevOwner = b.owner;
      }
      // 최종 3분의 1 진입/이탈 (팀 소유·리스타트 아님·bnx ≥ lateRunFromX)
      for (const team of [0, 1] as const) {
        const own = !s.restart && owner && owner.team === team;
        const inThird = own && toNorm(b.x, b.y, attackDir(team, s.half))[0] >= O.lateRunFromX;
        if (inThird && enteredAt[team] < 0) {
          enteredAt[team] = s.t;
          for (const a of wideAgents) {
            if (!a.onPitch || a.team !== team) continue;
            const g = out[groupOf(a)!]!;
            g.entries++;
            g.entryD.push(dist(a.x, a.y, ...oppGoal(attackDir(team, s.half))));
            g.entryPoss.push(s.t - s.possSince);
            g.entryLine.push((1 - offsideLine(s, team)) * L);
          }
        } else if (!inThird && enteredAt[team] >= 0) {
          for (const a of wideAgents) if (a.onPitch && a.team === team) out[groupOf(a)!]!.dwell += s.t - enteredAt[team];
          enteredAt[team] = -1;
        }
        if (inThird && enteredAt[team] >= 0) {
          const el = s.t - enteredAt[team];
          for (const k of [1, 2, 3, 5]) {
            if (Math.abs(el - k) < ENGINE.time.dt / 2) for (const a of wideAgents) if (a.onPitch && a.team === team) out[groupOf(a)!]!.profile[[1, 2, 3, 5].indexOf(k)]!.push(dist(a.x, a.y, ...oppGoal(attackDir(team, s.half))));
          }
        }
      }
      for (const a of wideAgents) {
        if (!a.onPitch) continue;
        const g = out[groupOf(a)!]!;
        g.players.add(`${a.team}:${a.id}`);
        // 슈팅 발생: 직전 소유 전 상황별로 센다
        const sh = a.stats.shots;
        if (sh > (prevShots.get(a) ?? 0)) {
          prevShots.set(a, sh);
          const e = entry.get(a) ?? { sit: '?', got: '?' };
          inc(g.shotBy, `${e.sit}/${e.got}`);
          g.shotD.push(dist(a.x, a.y, ...oppGoal(attackDir(a.team, s.half))));
        }
        const pv = last.get(a);
        if (pv) pv.on = pv.on && !s.restart && !!owner && owner.team === a.team && owner !== a && toNorm(b.x, b.y, attackDir(a.team, s.half))[0] >= PRE_X && toNorm(b.x, b.y, attackDir(a.team, s.half))[0] < O.lateRunFromX;
        if (s.restart || !owner || owner.team !== a.team) continue;
        const dir = attackDir(a.team, s.half);
        const [bnx, bny] = toNorm(b.x, b.y, dir);
        if (bnx < O.lateRunFromX) {
          lastSit.set(a, 'deep');
          if (bnx >= PRE_X && owner !== a) {
            trackPre(g, a, s, owner, dir, bnx);
            const c = g.sit.pre;
            c.ticks++;
            const [gx, gy] = oppGoal(dir);
            const d = dist(a.x, a.y, gx, gy);
            c.dGoal += d;
            if (d <= 25) c.in25++;
            const [anx, any] = toNorm(a.x, a.y, dir);
            c.nx += anx; c.ny += Math.abs(any - 0.5);
            const line = offsideLine(s, a.team);
            if (anx >= line - 3 / L) c.behindLine++;
            if (a.urgent) c.urgent++;
            c.dOwner += dist(a.x, a.y, owner.x, owner.y);
            c.tGoal += dist(a.tx, a.ty, gx, gy);
            c.tDist += dist(a.tx, a.ty, a.x, a.y);
            if (s.t < a.runUntil) c.running++;
            inc(c.job, `line${Math.round((1 - line) * L / 5) * 5}`);
          }
          continue;
        }
        g.thirdTicks++;
        const wide = Math.abs(bny - 0.5) >= O.lateRunWide;
        if (wide) g.wideTicks++;
        const sideOf = Math.sign(bny - 0.5);
        const mySide = Math.sign(a.sy - 0.5);
        const sit: Sit = owner === a ? 'self' : !wide ? 'center' : sideOf === mySide ? 'same' : 'opp';
        lastSit.set(a, sit);
        if (wide && owner !== a) inc(g.ownerPos, sideOf === mySide ? `same:${owner.pos}` : `opp:${owner.pos}`);
        const c = g.sit[sit];
        c.ticks++;
        const [gx, gy] = oppGoal(dir);
        const d = dist(a.x, a.y, gx, gy);
        c.dGoal += d;
        if (d <= 25) c.in25++;
        if (inOppBox(a.x, a.y, dir)) c.inBox++;
        const [anx, any] = toNorm(a.x, a.y, dir);
        c.nx += anx;
        c.ny += Math.abs(any - 0.5);
        const line = offsideLine(s, a.team);
        if (anx >= line - 3 / L) c.behindLine++;
        if (a.urgent) c.urgent++;
        c.dOwner += dist(a.x, a.y, owner.x, owner.y);
        inc(c.job, owner === a ? '-' : String(finalThirdJob(s, a, owner)));
        c.tGoal += dist(a.tx, a.ty, gx, gy);
        c.tDist += dist(a.tx, a.ty, a.x, a.y);
        if (s.t < a.runUntil) c.running++;
      }
    }
    const r = m.runToEnd();
    for (const p of r.players) {
      const g = p.position === 'LM' || p.position === 'RM' ? out['LM/RM']! : p.position === 'LW' || p.position === 'RW' ? out['LW/RW']! : null;
      if (!g || p.minutes < 45) continue;
      g.apps++;
      g.shots += p.shots;
    }
    const tsH = s.teams[0].stats.shots, tsA = s.teams[1].stats.shots;
    out[swap ? 'LW/RW' : 'LM/RM']!.teamShots += tsH;
    out[swap ? 'LM/RM' : 'LW/RW']!.teamShots += tsA;
  }
  process.stdout.write(`  경기 ${(i + 1) * 2}/${N * 2} (${((Date.now() - t0) / 1000).toFixed(0)}초)\r`);
}

console.log(`\n### 측면 선수 분해 (생성 ${RATING} 대 ${RATING} 중립, ${FH}(${TEND}) 대 ${FA} 홈/원정 바꿔 ${N * 2}경기, ${((Date.now() - t0) / 60000).toFixed(1)}분)`);
const pct = (v: number, n: number) => `${(100 * v / Math.max(1, n)).toFixed(0)}%`;
for (const [label, g] of Object.entries(out)) {
  const perApp = g.shots / Math.max(1, g.apps);
  const teamPer = g.teamShots / (N * 2);
  console.log(`\n${label}: 출전 ${g.apps} · 슈팅/경기 ${perApp.toFixed(2)} · 팀 슈팅/경기 ${teamPer.toFixed(1)} · 비중(선수 1명) ${pct(perApp, teamPer)} · 평균 슛 거리 ${(g.shotD.reduce((a, b) => a + b, 0) / Math.max(1, g.shotD.length)).toFixed(1)} m`);
  console.log('  최종 3분의 1 공격 틱 상황 | 틱 비중 | 골 평균 거리 | 25 m 안 | 박스 안 | 라인 3 m 안 | urgent | 침투 중 | 소유자 거리 | 평균 nx | 평균 |ny−0.5| | 목표→골 거리 | 나→목표 거리 | finalThirdJob');
  for (const k of ['pre', 'self', 'same', 'opp', 'center'] as const) {
    const c = g.sit[k];
    if (!c.ticks) continue;
    console.log(`  ${k.padEnd(6)} | ${pct(c.ticks, g.thirdTicks).padStart(4)} | ${(c.dGoal / c.ticks).toFixed(1).padStart(5)} | ${pct(c.in25, c.ticks).padStart(4)} | ${pct(c.inBox, c.ticks).padStart(4)} | ${pct(c.behindLine, c.ticks).padStart(4)} | ${pct(c.urgent, c.ticks).padStart(4)} | ${pct(c.running, c.ticks).padStart(4)} | ${(c.dOwner / c.ticks).toFixed(1)} | ${(c.nx / c.ticks).toFixed(2)} | ${(c.ny / c.ticks).toFixed(2)} | ${(c.tGoal / c.ticks).toFixed(1)} | ${(c.tDist / c.ticks).toFixed(1)} | ${Object.entries(c.job).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${pct(v, c.ticks)}`).join(' ')}`);
  }
  const P = g.pre2;
  if (P.ticks) {
    const n = P.ticks;
    console.log(`  [C.77l pre 목표] 틱 ${n} · 목표 갱신 ${(P.upd / P.secs).toFixed(2)}회/초 · 갱신당 이동 ${(P.jump / Math.max(1, P.upd)).toFixed(2)} m(전진 성분 ${(P.fwd / Math.max(1, P.upd)).toFixed(2)}) · 방향 반전 ${(60 * P.rev / P.secs).toFixed(1)}/분(갱신의 ${pct(P.rev, P.upd)}) · 목표 전진 속도 ${(P.fwd / P.secs).toFixed(2)} m/s · 실제 속도 ${(P.speed / n).toFixed(2)} m/s(목표 쪽 ${(P.vToward / n).toFixed(2)}, 전진 ${(P.vx / n).toFixed(2)}) · 목표가 공보다 뒤 ${pct(P.behindBall, n)} · 슬롯이 목표보다 2.5 m+ 앞 ${pct(P.slotAhead, n)} · 슬롯−나 ${(P.slotGap / n).toFixed(1)} m`);
    console.log(`  [C.77l pre 목표 2] 갱신당 |Δy| ${(P.jy / Math.max(1, P.upd)).toFixed(2)} m · 소유자 바뀐 갱신 ${pct(P.ownN, P.upd)}(이동 ${(P.ownJ / Math.max(1, P.ownN)).toFixed(1)} m, 나머지 ${((P.jump - P.ownJ) / Math.max(1, P.upd - P.ownN)).toFixed(1)} m) · 창 안 경과별 나→목표 ` + [0, 1, 2, 3, 5].map((sec, k) => `${sec}s ${(P.prof[k]! / Math.max(1, P.profN[k]!)).toFixed(1)}(${P.profN[k]})`).join(' · '));
    console.log(`  [C.77l pre 분기] ` + Object.entries(P.lab).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${pct(v, n)}(나→목표 ${(P.labGap[k]! / v).toFixed(1)} m)`).join(' · '));
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
  const within = (xs: number[], d: number) => pct(xs.filter((x) => x <= d).length, xs.length);
  console.log(`  진입 때 소유 경과 ${avg(g.entryPoss).toFixed(1)}초(3초 미만 ${pct(g.entryPoss.filter((x) => x < 3).length, g.entryPoss.length)}, 6초 이상 ${pct(g.entryPoss.filter((x) => x >= 6).length, g.entryPoss.length)}) · 상대 라인 골 거리 ${avg(g.entryLine).toFixed(1)} m`);
  console.log(`  최종 3분의 1 진입 ${g.entries}회(선수 기준) · 체류 평균 ${(g.dwell / Math.max(1, g.entries)).toFixed(1)}초 · 골 거리 진입 때 ${avg(g.entryD).toFixed(1)} m(25 m 안 ${within(g.entryD, 25)}) → +1초 ${avg(g.profile[0]!).toFixed(1)}(${within(g.profile[0]!, 25)}) · +2초 ${avg(g.profile[1]!).toFixed(1)}(${within(g.profile[1]!, 25)}) · +3초 ${avg(g.profile[2]!).toFixed(1)}(${within(g.profile[2]!, 25)}) · +5초 ${avg(g.profile[3]!).toFixed(1)}(${within(g.profile[3]!, 25)}) [표본 ${g.profile.map((x) => x.length).join('/')}]`);
  const tot = Object.values(g.shotBy).reduce((a, b) => a + b, 0);
  console.log(`  슈팅 ${tot}개 — 직전 상황/얻은 방식: ` + Object.entries(g.shotBy).sort((p, q) => q[1] - p[1]).map(([k, v]) => `${k} ${v}(${pct(v, tot)})`).join(' · '));
  const op = Object.entries(g.ownerPos).sort((p, q) => q[1] - p[1]);
  const opTot = op.reduce((a, [, v]) => a + v, 0);
  console.log(`  측면 공(내가 아닌) 소유자 포지션: ` + op.slice(0, 10).map(([k, v]) => `${k} ${pct(v, opTot)}`).join(' · '));
}
process.exit(0);
