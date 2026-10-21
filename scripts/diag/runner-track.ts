// 진단 (엔진 관리자 8대, 44h-i "좁은 추적" 처방 기준선): 줄 2(CDM/CM/CAM) 공격수가 박스 쪽으로 뛰는 "침투 에피소드"를 세고,
// 그 순간 수비 팀 CDM/CM 이 어디에 있었는지(따라붙을 수 있는지), 침투자가 받는 순간·슛 순간이 얼마나 자유로웠는지 잰다. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/runner-track.ts -- [경기수=40] [포메이션=4-2-3-1] [홈전술=balanced] [원정전술=balanced] [경로=값 ...]
//   에피소드 시작 = 공격 팀 줄 2 선수(소유자 제외)가 (a) 침투 중(runUntil) 이거나 (b) 골 trackZone(20 m, 환경변수 TRACK_ZONE)+3 m 밖에서 목표 지점이 trackZone 안으로 잡혔을 때(edgeZone 22 는 밖).
//   유지 = 침투 중이거나 골 trackZone+3 m 안에 머무는 동안. 끝 = 0.5초 이상 벗어남 / 소유 팀 바뀜 / 리스타트. 받음 = 에피소드 중 또는 끝난 뒤 2초 안에 소유자가 됨. 슛 = 받은 뒤 3초 안.
import { ENGINE, ENGINE_VERSION } from '../../src/engine/config';
import { createMatch } from '../../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { ballRank } from '../../src/engine/offball';
import { tacticsOf, type Level } from '../../src/engine/tactics';
import type { Tendency } from '../../src/engine/types';
import { attackDir, dist, ownGoal } from '../../src/engine/pitch';
import type { Agent } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
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
const N = Number(args[0] ?? 40);
const FORMATION = (args[1] ?? '4-2-3-1') as Formation;
const tacOf = (spec: string) => { const [tn, lv] = spec.split('@') as [Tendency, string | undefined]; const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined; return tacticsOf(tn, levels); };
const HOME = args[2] ?? 'balanced';
const AWAY = args[3] ?? 'balanced';
const TRACK_ZONE = Number(process.env.TRACK_ZONE ?? 20);
const MODE = process.env.MODE ?? 'run';

const mk = (side: string, i: number, spec: string): TeamSetup => {
  const r = createTeamRoster({ id: `v${side}${i}`, rating: 75 }, `diagR-${side}-${i}`, 2018, []);
  r.formation = FORMATION;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `wR${i}`);
  s.tactics = tacOf(spec);
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
};

interface Ep {
  a: Agent; team: 0 | 1; kind: 'run' | 'job'; t0: number; d0: number; pos: string;
  cdm0: number; cdmBusy: boolean; cdmSide0: number; cm0: number; l2n0: number; l2goalSide: boolean; any0: number; l1n0: number;
  pace: number; cdmPace: number;
  entryT: number; entryAny: number; entryL2: number; entryL1: number;
  lastTrue: number; ended: number; recv: number; recvD: number; recvAny: number; recvL2: number; shot: number; shotD: number; shotAny: number; goal: number; minAny: number;
  concurrent: number;
  /** C.77b: 추적 배정(a.trackIdx 읽기) — 에피소드 중 한 번이라도 배정됨, 첫 추적자 포지션, 받는 순간 추적자 거리(없으면 Infinity) */
  tracked: boolean; trackerPos: string | null; recvTrack: number;
}
const eps: Ep[] = [];
const sum = { games: 0, midShots: 0, midGoals: 0, midShotsIn: 0, midGoalsIn: 0, midBoxRecv: 0, midBoxRecvIn: 0, camShots: 0, camGoals: 0, stShots: 0, stGoals: 0 };

function analyze(home: TeamSetup, away: TeamSetup, seed: number): void {
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const active = new Map<Agent, Ep>();
  const recent = new Map<Agent, Ep>(); // 끝난 뒤 2~3초 안 받음·슛 귀속
  const shotsPrev = new Map<Agent, number>();
  const goalsPrev = new Map<Agent, number>();
  const lastShot = new Map<Agent, { t: number; ep: Ep | null }>();
  let prevOwner = -1;
  let prevPoss = -1;
  for (const a of s.agents) { shotsPrev.set(a, a.stats.shots); goalsPrev.set(a, a.stats.goals); }
  const endEp = (ep: Ep, t: number) => { ep.ended = t; active.delete(ep.a); recent.set(ep.a, ep); };
  while (!s.done) {
    m.step();
    const t = s.t;
    const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
    const att = owner ? owner.team : s.possTeam;
    // 소유 팀 바뀜·리스타트 → 모든 에피소드 종료
    if (s.restart || att !== prevPoss) { for (const ep of [...active.values()]) endEp(ep, t); }
    prevPoss = att;
    // 슛·골 귀속
    for (const a of s.agents) {
      const sh = a.stats.shots, gl = a.stats.goals;
      if (sh > (shotsPrev.get(a) ?? 0)) {
        shotsPrev.set(a, sh);
        const isMid = a.pos === 'CDM' || a.pos === 'CM' || a.pos === 'CAM';
        const ep = active.get(a) ?? (recent.get(a) && t - (recent.get(a)!.recv > 0 ? recent.get(a)!.recv : recent.get(a)!.ended) <= 3 ? recent.get(a)! : null);
        const dDir = attackDir((1 - a.team) as 0 | 1, s.half);
        const [gx, gy] = ownGoal(dDir);
        let any = Infinity;
        for (const o of s.agents) if (o.onPitch && o.team !== a.team && o.line !== 0) any = Math.min(any, dist(o.x, o.y, a.x, a.y));
        if (isMid) { sum.midShots++; if (ep) sum.midShotsIn++; }
        if (a.pos === 'CAM') sum.camShots++;
        if (a.pos === 'ST' || a.pos === 'CF') sum.stShots++;
        if (ep && ep.shot === 0) { ep.shot = t; ep.shotD = dist(a.x, a.y, gx, gy); ep.shotAny = any; }
        lastShot.set(a, { t, ep });
      }
      if (gl > (goalsPrev.get(a) ?? 0)) {
        goalsPrev.set(a, gl);
        const isMid = a.pos === 'CDM' || a.pos === 'CM' || a.pos === 'CAM';
        const ls = lastShot.get(a);
        const ep = ls && t - ls.t <= 4 ? ls.ep : null;
        if (isMid) { sum.midGoals++; if (ep) sum.midGoalsIn++; }
        if (a.pos === 'CAM') sum.camGoals++;
        if (a.pos === 'ST' || a.pos === 'CF') sum.stGoals++;
        if (ep) ep.goal++;
      }
    }
    // 받음 귀속 (소유자가 새로 바뀐 틱)
    if (owner && owner.idx !== prevOwner) {
      const ep = active.get(owner) ?? (recent.get(owner) && t - recent.get(owner)!.ended <= 2 ? recent.get(owner)! : null);
      const isMid = owner.pos === 'CDM' || owner.pos === 'CM' || owner.pos === 'CAM';
      const dDir = attackDir((1 - owner.team) as 0 | 1, s.half);
      const [gx, gy] = ownGoal(dDir);
      const inBox = Math.abs(owner.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(owner.y - gy) <= ENGINE.pitch.boxWidth / 2;
      if (isMid && inBox) { sum.midBoxRecv++; if (ep) sum.midBoxRecvIn++; }
      if (ep && ep.recv === 0) {
        let any = Infinity, l2 = Infinity;
        for (const o of s.agents) {
          if (!o.onPitch || o.team === owner.team || o.line === 0) continue;
          const d = dist(o.x, o.y, owner.x, owner.y);
          any = Math.min(any, d);
          if (o.line === 2) l2 = Math.min(l2, d);
        }
        ep.recv = t; ep.recvD = dist(owner.x, owner.y, gx, gy); ep.recvAny = any; ep.recvL2 = l2;
        for (const o of s.agents) if (o.onPitch && o.team !== owner.team && o.trackIdx === owner.idx) ep.recvTrack = Math.min(ep.recvTrack, dist(o.x, o.y, owner.x, owner.y));
        if (active.has(owner)) endEp(ep, t);
      }
    }
    prevOwner = owner ? owner.idx : -1;
    if (s.restart) continue;
    const def = (1 - att) as 0 | 1;
    const dDir = attackDir(def, s.half);
    const [gx, gy] = ownGoal(dDir);
    const D = s.agents.filter((o) => o.onPitch && o.team === def && o.line !== 0);
    const tm = s.teams[def];
    let concurrent = 0;
    for (const o of s.agents) {
      if (!o.onPitch || o.team !== att || o.line !== 2 || (owner && o === owner)) continue;
      const dg = dist(o.x, o.y, gx, gy);
      const tg = dist(o.tx, o.ty, gx, gy);
      const running = t < o.runUntil;
      // 시작: 침투 중이거나, 목표가 골 trackZone 안인데 자신은 그 밖(+3 m)에서 들어가는 중. 유지: 침투 중이거나 골 trackZone + 3 m 안에 머무는 동안
      const ep = active.get(o);
      // MODE=zone: 목표와 무관하게 골 trackZone 안에 들어오면 시작(존 진입), trackZone + 3 m 안이면 유지
      const on = running || (MODE === 'zone' ? (ep ? dg < TRACK_ZONE + 3 : dg < TRACK_ZONE) : ep ? dg < TRACK_ZONE + 3 : tg < TRACK_ZONE && dg > TRACK_ZONE + 3 && dg > tg + 3);
      if (on) {
        concurrent++;
        if (ep) {
          ep.lastTrue = t;
          for (const d of D) if (d.trackIdx === o.idx) { if (!ep.tracked) { ep.tracked = true; ep.trackerPos = d.pos; } break; }
          let any = Infinity, l2 = Infinity, l1 = Infinity;
          for (const d of D) { const dd = dist(d.x, d.y, o.x, o.y); any = Math.min(any, dd); if (d.line === 2) l2 = Math.min(l2, dd); if (d.line === 1) l1 = Math.min(l1, dd); }
          ep.minAny = Math.min(ep.minAny, any);
          if (ep.entryT === 0 && dg <= 20) { ep.entryT = t; ep.entryAny = any; ep.entryL2 = l2; ep.entryL1 = l1; }
        } else if (!(recent.get(o) && t - recent.get(o)!.ended < 1)) {
          // 새 에피소드
          let cdm0 = Infinity, cdmBusy = false, cdmSide0 = Infinity, cm0 = Infinity, l2n0 = Infinity, any0 = Infinity, l1n0 = Infinity, l2near: Agent | null = null, cdmPace = 0;
          const side = Math.sign(o.sy - 0.5) || 1;
          for (const d of D) {
            const dd = dist(d.x, d.y, o.x, o.y);
            any0 = Math.min(any0, dd);
            if (d.line === 1) l1n0 = Math.min(l1n0, dd);
            if (d.line !== 2) continue;
            if (dd < l2n0) { l2n0 = dd; l2near = d; }
            if (d.pos === 'CDM') {
              if (dd < cdm0) {
                cdm0 = dd; cdmPace = d.attrs.pace;
                const rank = ballRank(s, d, s.ball.x, s.ball.y);
                cdmBusy = rank < 2 || (t < tm.counterUntil && tm.counterPressers.includes(d.idx)) || (tm.coverAgent === d.idx && t < tm.coverUntil);
              }
              if ((Math.sign(d.sy - 0.5) || 1) === side) cdmSide0 = Math.min(cdmSide0, dd);
            } else if (d.pos === 'CM') cm0 = Math.min(cm0, dd);
          }
          const l2goalSide = l2near ? dist(l2near.x, l2near.y, gx, gy) < dg : false;
          const e: Ep = { a: o, team: att, kind: running ? 'run' : 'job', t0: t, d0: dg, pos: o.pos, cdm0, cdmBusy, cdmSide0, cm0, l2n0, l2goalSide, any0, l1n0, pace: o.attrs.pace, cdmPace, entryT: 0, entryAny: 0, entryL2: 0, entryL1: 0, lastTrue: t, ended: 0, recv: 0, recvD: 0, recvAny: 0, recvL2: 0, shot: 0, shotD: 0, shotAny: 0, goal: 0, minAny: any0, concurrent: 0, tracked: false, trackerPos: null, recvTrack: Infinity };
          for (const d of D) if (d.trackIdx === o.idx) { e.tracked = true; e.trackerPos = d.pos; break; }
          if (dg <= 20) { e.entryT = t; e.entryAny = any0; e.entryL2 = l2n0; e.entryL1 = l1n0; }
          active.set(o, e); eps.push(e);
        }
      } else if (ep && t - ep.lastTrue >= 0.5) endEp(ep, t);
    }
    for (const ep of active.values()) if (ep.team === att) ep.concurrent = Math.max(ep.concurrent, concurrent);
  }
  for (const ep of [...active.values()]) endEp(ep, s.t);
  sum.games++;
}

for (let i = 0; i < N; i++) analyze(mk('H', i, HOME), mk('A', i, AWAY), 7000 + i);

const f = (x: number, k = 1) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : NaN);
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : '-');
const med = (xs: number[]) => { if (!xs.length) return NaN; const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]!; };
const G = sum.games;
console.log(`runner-track · ${G}경기 ${FORMATION} ${HOME} 대 ${AWAY} · ${MODE} · trackZone ${TRACK_ZONE} m (엔진 ${ENGINE_VERSION})`);
console.log(`줄 2 침투 에피소드 ${eps.length} (경기당 ${f(eps.length / G)}, 팀당 ${f(eps.length / G / 2)}) · 종류 run ${pct(eps.filter((e) => e.kind === 'run').length, eps.length)} / job ${pct(eps.filter((e) => e.kind === 'job').length, eps.length)} · 포지션 ${['CAM', 'CM', 'CDM'].map((p) => `${p} ${pct(eps.filter((e) => e.pos === p).length, eps.length)}`).join(' · ')}`);
console.log(`동시 침투자(팀당, 에피소드 가중): 1명 ${pct(eps.filter((e) => e.concurrent <= 1).length, eps.length)} · 2명 ${pct(eps.filter((e) => e.concurrent === 2).length, eps.length)} · 3+ ${pct(eps.filter((e) => e.concurrent >= 3).length, eps.length)}`);
console.log(`시작: 골 거리 평균 ${f(avg(eps.map((e) => e.d0)))} m (중앙값 ${f(med(eps.map((e) => e.d0)))}) · 지속 ${f(avg(eps.map((e) => e.ended - e.t0)))} s · 20 m 선 도달 ${pct(eps.filter((e) => e.entryT > 0).length, eps.length)}`);
console.log(`시작 때 수비: 가장 가까운 CDM ${f(avg(eps.map((e) => e.cdm0)))} m (중앙값 ${f(med(eps.map((e) => e.cdm0)))}, ≤ 8 m ${pct(eps.filter((e) => e.cdm0 <= 8).length, eps.length)}, ≤ 12 m ${pct(eps.filter((e) => e.cdm0 <= 12).length, eps.length)}) · 그 CDM 이 압박·역압박·커버 중 ${pct(eps.filter((e) => e.cdmBusy).length, eps.length)} · 침투자 쪽 CDM ${f(avg(eps.filter((e) => Number.isFinite(e.cdmSide0)).map((e) => e.cdmSide0)))} m · 가장 가까운 CM ${f(avg(eps.filter((e) => Number.isFinite(e.cm0)).map((e) => e.cm0)))} m · 줄 2 아무나 ${f(avg(eps.map((e) => e.l2n0)))} m (골 쪽에 있음 ${pct(eps.filter((e) => e.l2goalSide).length, eps.length)}) · 수비 줄 ${f(avg(eps.map((e) => e.l1n0)))} m · 아무 수비 ${f(avg(eps.map((e) => e.any0)))} m`);
console.log(`속도: 침투자 pace ${f(avg(eps.map((e) => e.pace)), 0)} · 가장 가까운 CDM pace ${f(avg(eps.filter((e) => e.cdmPace > 0).map((e) => e.cdmPace)), 0)}`);
const en = eps.filter((e) => e.entryT > 0);
console.log(`20 m 선 도달 때(${en.length}): 아무 수비 ${f(avg(en.map((e) => e.entryAny)))} m (≤ 3 m ${pct(en.filter((e) => e.entryAny <= 3).length, en.length)}) · 줄 2 수비 ${f(avg(en.map((e) => e.entryL2)))} m (≤ 3 m ${pct(en.filter((e) => e.entryL2 <= 3).length, en.length)}, ≤ 5 m ${pct(en.filter((e) => e.entryL2 <= 5).length, en.length)}) · 수비 줄 ${f(avg(en.map((e) => e.entryL1)))} m · 에피소드 중 최소 거리 ${f(avg(eps.map((e) => e.minAny)))} m`);
const rc = eps.filter((e) => e.recv > 0);
console.log(`받음 ${rc.length} (${pct(rc.length, eps.length)}, 경기당 ${f(rc.length / G)}): 골 거리 ${f(avg(rc.map((e) => e.recvD)))} m (≤ 16.5 ${pct(rc.filter((e) => e.recvD <= 16.5).length, rc.length)}) · 받는 순간 아무 수비 ${f(avg(rc.map((e) => e.recvAny)))} m (≤ 1.5 ${pct(rc.filter((e) => e.recvAny <= 1.5).length, rc.length)}, ≤ 3 ${pct(rc.filter((e) => e.recvAny <= 3).length, rc.length)}) · 줄 2 수비 ${f(avg(rc.map((e) => e.recvL2)))} m (≤ 3 ${pct(rc.filter((e) => e.recvL2 <= 3).length, rc.length)}) · 시작 → 받음 ${f(avg(rc.map((e) => e.recv - e.t0)))} s`);
console.log(`  시작 → 받음: ≤ 1 s ${pct(rc.filter((e) => e.recv - e.t0 <= 1).length, rc.length)} · ≤ 2 s ${pct(rc.filter((e) => e.recv - e.t0 <= 2).length, rc.length)} · ≤ 4 s ${pct(rc.filter((e) => e.recv - e.t0 <= 4).length, rc.length)} · 받음 중 시작 때 CDM ≤ 6 m ${pct(rc.filter((e) => e.cdm0 <= 6).length, rc.length)} · 줄 2 ≤ 6 m ${pct(rc.filter((e) => e.l2n0 <= 6).length, rc.length)}`);
const tr = eps.filter((e) => e.tracked);
const rt = rc.filter((e) => Number.isFinite(e.recvTrack));
console.log(`추적 배정(C.77b): 에피소드 중 배정 ${pct(tr.length, eps.length)} (CDM ${pct(tr.filter((e) => e.trackerPos === 'CDM').length, tr.length)} · CM ${pct(tr.filter((e) => e.trackerPos === 'CM').length, tr.length)}) · 받음 중 받는 순간 추적자 있음 ${pct(rt.length, rc.length)} · 그 거리 ${f(avg(rt.map((e) => e.recvTrack)))} m (≤ 1.5 ${pct(rt.filter((e) => e.recvTrack <= 1.5).length, rt.length)}, ≤ 3 ${pct(rt.filter((e) => e.recvTrack <= 3).length, rt.length)}) · 배정된 에피소드 받음 ${pct(tr.filter((e) => e.recv > 0).length, tr.length)} / 미배정 ${pct(eps.filter((e) => !e.tracked && e.recv > 0).length, eps.length - tr.length)}`);
const sh = eps.filter((e) => e.shot > 0);
console.log(`슛 ${sh.length} (경기당 ${f(sh.length / G, 2)}, 받은 것의 ${pct(sh.length, rc.length)}) · 골 ${eps.reduce((p, e) => p + e.goal, 0)} (경기당 ${f(eps.reduce((p, e) => p + e.goal, 0) / G, 2)}) · 슛 거리 ${f(avg(sh.map((e) => e.shotD)))} m · 슛 순간 아무 수비 ${f(avg(sh.map((e) => e.shotAny)))} m (≤ 3 ${pct(sh.filter((e) => e.shotAny <= 3).length, sh.length)})`);
for (const k of ['run', 'job'] as const) {
  const E = eps.filter((e) => e.kind === k); const R = E.filter((e) => e.recv > 0); const S = E.filter((e) => e.shot > 0);
  console.log(`  ${k}: ${E.length} · 시작 골 ${f(avg(E.map((e) => e.d0)))} m · CDM ${f(avg(E.map((e) => e.cdm0)))} m · 받음 ${pct(R.length, E.length)}(받는 순간 ${f(avg(R.map((e) => e.recvAny)))} m) · 슛 ${S.length} · 골 ${E.reduce((p, e) => p + e.goal, 0)}`);
}
for (const p of ['CAM', 'CM'] as const) {
  const E = eps.filter((e) => e.pos === p); const R = E.filter((e) => e.recv > 0); const S = E.filter((e) => e.shot > 0);
  console.log(`  ${p}: ${E.length} · 시작 골 ${f(avg(E.map((e) => e.d0)))} m · CDM ${f(avg(E.map((e) => e.cdm0)))} m(바쁨 ${pct(E.filter((e) => e.cdmBusy).length, E.length)}) · 받음 ${pct(R.length, E.length)}(받는 순간 ${f(avg(R.map((e) => e.recvAny)))} m, 골 ${f(avg(R.map((e) => e.recvD)))} m) · 슛 ${S.length} · 골 ${E.reduce((p2, e) => p2 + e.goal, 0)}`);
}
console.log(`커버리지: 미드(CDM/CM/CAM) 슛 ${sum.midShots} 중 에피소드 안·직후 ${sum.midShotsIn} (${pct(sum.midShotsIn, sum.midShots)}) · 미드 골 ${sum.midGoals} 중 ${sum.midGoalsIn} (${pct(sum.midGoalsIn, sum.midGoals)}) · 미드 박스 안 수신 ${sum.midBoxRecv} 중 ${sum.midBoxRecvIn} (${pct(sum.midBoxRecvIn, sum.midBoxRecv)}) · 경기당 CAM 슛/골 ${f(sum.camShots / G, 2)}/${f(sum.camGoals / G, 2)} · ST 슛/골 ${f(sum.stShots / G, 2)}/${f(sum.stGoals / G, 2)} (두 팀 합)`);
