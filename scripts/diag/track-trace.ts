// 진단 (엔진 관리자 9대, 44h-i2 C.77h 재진단): 2선 추적자(trackIdx ≥ 0)가 왜 침투자 5~6 m 뒤에 머무는지 틱 단위로 잰다. 엔진 코드는 건드리지 않는다.
// 실행: npx vite-node scripts/diag/track-trace.ts -- [경기수=20] [포메이션=4-2-3-1] [홈전술=balanced] [원정전술=balanced] [경로=값 ...]
//   배정 구간(spell) = 한 수비수의 trackIdx 가 같은 상대를 가리키는 연속 틱. 해제 이유는 해제 틱의 상황으로 분류(소유 바뀜·침투자가 소유자·비행 중(수신자 압박 인계)·압박 rank·역압박/커버·존 밖·기타).
//   틱 표본 = 배정 중 매 틱: 추적자↔침투자 거리, 추적자 목표(tx,ty)↔침투자 거리(목표가 침투자에 붙어 있는가), 추적자 속도·침투자 속도, 목표까지 거리 구간(walkDist 4.5 안/밖), 진행 방향 앞뒤.
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
const N = Number(args[0] ?? 20);
const FORMATION = (args[1] ?? '4-2-3-1') as Formation;
const tacOf = (spec: string) => { const [tn, lv] = spec.split('@') as [Tendency, string | undefined]; const levels = lv ? { lineHeight: Number(lv[0]) as Level, pressing: Number(lv[1]) as Level, style: Number(lv[2]) as Level, width: Number(lv[3]) as Level } : undefined; return tacticsOf(tn, levels); };
const HOME = args[2] ?? 'balanced';
const AWAY = args[3] ?? 'balanced';
const ZONE = ENGINE.offball.trackZone;
const WALK = ENGINE.physics.walkDist;

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

type Reason = 'poss' | 'ownerRunner' | 'flight' | 'press' | 'counterCover' | 'outZone' | 'sub' | 'other';
interface Spell { t0: number; t1: number; d0: number; goalSide0: boolean; lat0: number; reason: Reason; minD: number; recvD: number }
const spells: Spell[] = [];
// 틱 표본
const S = { n: 0, onRunner: 0, d: [] as number[], dByAge: [[], [], [], [], []] as number[][], band: { near: { n: 0, vt: 0, vr: 0, closing: 0 }, far: { n: 0, vt: 0, vr: 0, closing: 0 } }, runnerMoving: { n: 0, behind: 0, along: 0, vt: 0, vr: 0, d: 0 }, runnerSlow: { n: 0, d: 0, vt: 0 }, urgentN: 0 };
// 받음 순간
const R = { n: 0, assigned: 0, releasedRecently: 0, releasedReason: {} as Record<string, number>, trackD: [] as number[], anyD: [] as number[], anyClose15: 0, trackerPickCD: 0, flightLen: [] as number[] };
const Z = { runnerTicks: 0, assignedTicks: 0 };
// 목표가 침투자에 없는 틱의 분해 (C.77h 재진단): 침투자 존 밖 / 공이 우리 박스 안 / 위험지역(dangerPress) / 추적자 압박 rank ≤ 1 / 목표가 공 3 m 안 / 설명 안 됨
const OFF = { n: 0, runnerOut: 0, ownBox: 0, danger: 0, rank01: 0, tgtBall: 0, unexplained: 0, dOn: [] as number[], dOff: [] as number[] };
// 받는 순간(추적자 있음) 세부
const TS = { n: 0, d: [0, 0, 0, 0, 0], on: [0, 0, 0, 0, 0] }; // 받기 전 -3/-2/-1/-0.5/0 s 추적자↔침투자 거리·목표 침투자 위
const UP = { n: 0, track: 0, ball: 0, land: 0, cover: 0, slot: 0, other: 0, restart: 0 }; // 추적자가 목표를 갱신한 틱의 분기 분류(침투자 존 안일 때만)
const CV = { n: 0, assigned: 0, any3: 0, any5: 0, tr3: 0 }; // 열린 경기(리스타트 아님) 존 안 침투자 틱 커버리지
const RA = { age: [] as number[], dByAge: [[], [], [], []] as number[][] }; // 받는 순간 배정 경과(초)와 그때 거리
const JT = { n: 0, jumpN: 0, jumpSum: 0, revN: 0, spdN: 0, dTgt: 0 }; // 목표 흔들림(틱 간 목표 이동)·방향 반전(속도와 목표 방향 cos < 0)·목표까지 거리
const prevTgt = new WeakMap<Agent, [number, number, boolean]>();
const ID = { n: 0, dev: 0, idealJumpSum: 0, idealJumpN: 0, lagAlong: 0, lagN: 0 }; // 이상 목표(침투자 + 골 쪽 gap, 오차·선읽기·공 쪽 없음)와 실제 목표의 차 · 이상 목표의 틱 간 이동 · 침투자 진행 방향 기준 추적자 지연
const RR = { assignedD: [] as number[], releasedD: [] as number[] };
const RX = { n: 0, dTarget: [] as number[], urgent: 0, vt: [] as number[], runnerMove1s: [] as number[], sinceEntry: [] as number[], flightDur: [] as number[], tgtOnRunner: 0, tgtOnLanding: 0, closeNoTracker: 0 };

function analyze(home: TeamSetup, away: TeamSetup, seed: number): void {
  const m = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
  const s = m.state;
  const dt = ENGINE.time.dt;
  const live = new Map<Agent, { runner: number; sp: Spell; lastD: number }>();
  const lastRelease = new Map<number, { t: number; reason: Reason; tracker: Agent }>(); // runner idx → 최근 해제
  let prevOwner = -1;
  let prevPoss = -1;
  const hist = new Map<Agent, [number, number]>(); // 1초 전 위치 (10틱 지연 링)
  const ring: Map<Agent, [number, number]>[] = [];
  const entryT = new Map<Agent, number>(); // 침투자 존 진입 시각
  const lastFlight = { receiver: -1, dur: 0, x: 0, y: 0 };
  const ring30: Map<Agent, [number, number, number, number]>[] = [];
  while (!s.done) {
    if (s.ball.flight && s.ball.flight.outcome === 'receive') { lastFlight.receiver = s.ball.flight.receiver; lastFlight.dur = s.ball.flight.dur; lastFlight.x = s.ball.flight.toX; lastFlight.y = s.ball.flight.toY; }
    const snap = new Map<Agent, [number, number]>();
    const snap4 = new Map<Agent, [number, number, number, number]>();
    for (const a of s.agents) if (a.onPitch) { snap.set(a, [a.x, a.y]); snap4.set(a, [a.x, a.y, a.tx, a.ty]); }
    ring.push(snap); if (ring.length > 10) { const old = ring.shift()!; for (const [a, v] of old) hist.set(a, v); }
    ring30.push(snap4); if (ring30.length > 31) ring30.shift();
    const nextBefore = new Map<Agent, number>();
    for (const a of s.agents) if (a.onPitch) nextBefore.set(a, a.nextOffball);
    const prevPos = new Map<Agent, [number, number]>();
    for (const a of s.agents) if (a.onPitch) prevPos.set(a, [a.x, a.y]);
    m.step();
    const t = s.t;
    const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
    const att = owner ? owner.team : s.possTeam;
    const possChanged = s.restart || att !== prevPoss;
    prevPoss = att;
    const fl = s.ball.flight;
    const inFlight = !owner && !!fl && fl.outcome === 'receive';
    // 받음 순간: 줄 2 공격수가 상대 골 ZONE+3 안에서 새로 소유자
    if (owner && owner.idx !== prevOwner && owner.line === 2) {
      const dDir = attackDir((1 - owner.team) as 0 | 1, s.half);
      const [gx, gy] = ownGoal(dDir);
      if (dist(owner.x, owner.y, gx, gy) < ZONE + 3) {
        R.n++;
        let any = Infinity;
        for (const o of s.agents) if (o.onPitch && o.team !== owner.team && o.line !== 0) any = Math.min(any, dist(o.x, o.y, owner.x, owner.y));
        R.anyD.push(any);
        if (any <= 1.5) R.anyClose15++;
        let tr: Agent | null = null;
        for (const [a, v] of live) if (v.runner === owner.idx) tr = a;
        const lr = lastRelease.get(owner.idx);
        if (tr) {
          R.assigned++; R.trackD.push(dist(tr.x, tr.y, owner.x, owner.y)); RR.assignedD.push(dist(tr.x, tr.y, owner.x, owner.y));
          TS.n++;
          const lags = [30, 20, 10, 5, 0];
          for (let k = 0; k < 5; k++) { const sn = ring30[ring30.length - 1 - lags[k]!]; if (!sn) continue; const pa = sn.get(tr), pr = sn.get(owner); if (pa && pr) { TS.d[k]! += dist(pa[0], pa[1], pr[0], pr[1]); if (dist(pa[2], pa[3], pr[0], pr[1]) <= 5) TS.on[k]!++; } }
          const lv = live.get(tr)!; const age = t - lv.sp.t0; RA.age.push(age); RA.dByAge[age < 1 ? 0 : age < 2 ? 1 : age < 4 ? 2 : 3]!.push(dist(tr.x, tr.y, owner.x, owner.y));
          RX.n++; RX.dTarget.push(dist(tr.tx, tr.ty, tr.x, tr.y)); if (tr.urgent) RX.urgent++;
          const pa = prevPos.get(tr); RX.vt.push(pa ? dist(tr.x, tr.y, pa[0], pa[1]) / dt : 0);
          const h = hist.get(owner); RX.runnerMove1s.push(h ? dist(owner.x, owner.y, h[0], h[1]) : 0);
          const e = entryT.get(owner); RX.sinceEntry.push(e !== undefined ? t - e : -1);
          RX.flightDur.push(lastFlight.receiver === owner.idx ? lastFlight.dur : 0);
          if (dist(tr.tx, tr.ty, owner.x, owner.y) <= 5) RX.tgtOnRunner++;
          if (lastFlight.receiver === owner.idx && dist(tr.tx, tr.ty, lastFlight.x, lastFlight.y) <= 3) RX.tgtOnLanding++;
        }
        else if (lr && t - lr.t <= 1.5) { R.releasedRecently++; RR.releasedD.push(dist(lr.tracker.x, lr.tracker.y, owner.x, owner.y)); R.releasedReason[lr.reason] = (R.releasedReason[lr.reason] ?? 0) + 1; R.trackD.push(dist(lr.tracker.x, lr.tracker.y, owner.x, owner.y)); }
      }
    }
    prevOwner = owner ? owner.idx : -1;
    // 배정 상태 갱신
    for (const a of s.agents) {
      if (!a.onPitch || a.line !== 2) continue;
      const cur = live.get(a);
      if (a.trackIdx >= 0 && (!cur || cur.runner !== a.trackIdx)) {
        if (cur) endSpell(a, cur, 'other');
        const r = s.agents[a.trackIdx]!;
        const dDir = attackDir(a.team, s.half);
        const [gx, gy] = ownGoal(dDir);
        const d0 = dist(a.x, a.y, r.x, r.y);
        const goalSide0 = dist(a.x, a.y, gx, gy) < dist(r.x, r.y, gx, gy);
        // 침투자→골 방향에 수직인 성분(측면 오프셋)
        const gd = dist(r.x, r.y, gx, gy) || 1;
        const ux = (gx - r.x) / gd, uy = (gy - r.y) / gd;
        const lat0 = Math.abs((a.x - r.x) * -uy + (a.y - r.y) * ux);
        live.set(a, { runner: a.trackIdx, sp: { t0: t, t1: 0, d0, goalSide0, lat0, reason: 'other', minD: d0, recvD: -1 }, lastD: d0 });
      } else if (a.trackIdx < 0 && cur) {
        const r = s.agents[cur.runner]!;
        let reason: Reason = 'other';
        if (!r.onPitch || !a.onPitch) reason = 'sub';
        else if (possChanged) reason = 'poss';
        else if (owner && owner.idx === cur.runner) reason = 'ownerRunner';
        else if (inFlight) reason = 'flight';
        else if (owner && ballRank(s, a, s.ball.x, s.ball.y) <= 1) reason = 'press';
        else if ((t < s.teams[a.team].counterUntil && s.teams[a.team].counterPressers.includes(a.idx)) || (s.teams[a.team].coverAgent === a.idx && t < s.teams[a.team].coverUntil)) reason = 'counterCover';
        else {
          const dDir = attackDir(a.team, s.half);
          const [gx, gy] = ownGoal(dDir);
          if (dist(r.x, r.y, gx, gy) >= ZONE + 3) reason = 'outZone';
        }
        endSpell(a, cur, reason);
        lastRelease.set(cur.runner, { t, reason, tracker: a });
      }
    }
    // 틱 표본 (배정 중)
    for (const [a, v] of live) {
      const r = s.agents[v.runner]!;
      if (!r.onPitch || s.restart) continue;
      const d = dist(a.x, a.y, r.x, r.y);
      v.sp.minD = Math.min(v.sp.minD, d);
      S.n++;
      S.d.push(d);
      const age = t - v.sp.t0;
      S.dByAge[age < 0.5 ? 0 : age < 1 ? 1 : age < 2 ? 2 : age < 4 ? 3 : 4]!.push(d);
      const dTarget = dist(a.tx, a.ty, a.x, a.y);
      const tgtOnRunner = dist(a.tx, a.ty, r.x, r.y) <= 5;
      if (tgtOnRunner) { S.onRunner++; OFF.dOn.push(d); }
      else {
        OFF.n++; OFF.dOff.push(d);
        const dDir = attackDir(a.team, s.half);
        const [gx, gy] = ownGoal(dDir);
        const rOut = dist(r.x, r.y, gx, gy) >= ZONE + 3;
        const ownBox = Math.abs(s.ball.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(s.ball.y - gy) <= ENGINE.pitch.boxWidth / 2;
        const danger = dist(s.ball.x, s.ball.y, gx, gy) < ENGINE.offball.dangerPress;
        const rk = owner ? ballRank(s, a, s.ball.x, s.ball.y) : 9;
        const tb = dist(a.tx, a.ty, s.ball.x, s.ball.y) <= 3;
        if (rOut) OFF.runnerOut++;
        else if (ownBox) OFF.ownBox++;
        else if (danger) OFF.danger++;
        else if (rk <= 1) OFF.rank01++;
        else if (tb) OFF.tgtBall++;
        else OFF.unexplained++;
      }
      if (a.urgent) S.urgentN++;
      if (nextBefore.get(a) !== a.nextOffball) {
        const dDir = attackDir(a.team, s.half);
        const [gx, gy] = ownGoal(dDir);
        if (dist(r.x, r.y, gx, gy) < ZONE + 3) {
          UP.n++;
          const tr2 = dist(a.tx, a.ty, r.x, r.y);
          const bl = dist(a.tx, a.ty, s.ball.x, s.ball.y);
          const ld = s.ball.flight ? dist(a.tx, a.ty, s.ball.flight.toX, s.ball.flight.toY) : Infinity;
          // 커버 자리: 공과 골 사이(목표가 공보다 골 쪽, 공↔골 선 3 m 안)
          const bg = dist(s.ball.x, s.ball.y, gx, gy) || 1;
          const px = ((a.tx - s.ball.x) * (gx - s.ball.x) + (a.ty - s.ball.y) * (gy - s.ball.y)) / bg;
          const perp = Math.abs((a.tx - s.ball.x) * -(gy - s.ball.y) + (a.ty - s.ball.y) * (gx - s.ball.x)) / bg;
          if (s.restart) UP.restart++;
          else if (tr2 <= 5) UP.track++;
          else if (bl <= 3) UP.ball++;
          else if (ld <= 3) UP.land++;
          else if (px > 0 && px < bg && perp <= 3) UP.cover++;
          else if (dist(a.tx, a.ty, a.sx * 0 + a.x, a.y) < 0 ) UP.slot++;
          else UP.other++;
        }
      }
      if (tgtOnRunner) {
        JT.n++; JT.dTgt += dTarget;
        const pt = prevTgt.get(a);
        if (pt && pt[2]) { const j = dist(a.tx, a.ty, pt[0], pt[1]); if (j > 0.05) { JT.jumpN++; JT.jumpSum += j; } }
        {
          const dDir = attackDir(a.team, s.half);
          const [gx, gy] = ownGoal(dDir);
          const gd = dist(r.x, r.y, gx, gy) || 1;
          const inBox = Math.abs(r.x - gx) <= ENGINE.pitch.boxDepth && Math.abs(r.y - gy) <= ENGINE.pitch.boxWidth / 2;
          const gap = inBox ? ENGINE.offball.trackGap : ENGINE.offball.trackGapOut;
          const ix = r.x + ((gx - r.x) / gd) * gap, iy = r.y + ((gy - r.y) / gd) * gap;
          ID.n++; ID.dev += dist(a.tx, a.ty, ix, iy);
          const pr0 = prevPos.get(r);
          if (pr0) { const gd0 = dist(pr0[0], pr0[1], gx, gy) || 1; const ix0 = pr0[0] + ((gx - pr0[0]) / gd0) * gap, iy0 = pr0[1] + ((gy - pr0[1]) / gd0) * gap; ID.idealJumpN++; ID.idealJumpSum += dist(ix, iy, ix0, iy0); }
        }
        const sp = Math.hypot(a.vx, a.vy);
        if (sp > 1) { JT.spdN++; const cx = ((a.tx - a.x) * a.vx + (a.ty - a.y) * a.vy) / ((dTarget || 1) * sp); if (cx < 0) JT.revN++; }
      }
      prevTgt.set(a, [a.tx, a.ty, tgtOnRunner]);
      const pa = prevPos.get(a), pr = prevPos.get(r);
      const vt = pa ? dist(a.x, a.y, pa[0], pa[1]) / dt : 0;
      const vr = pr ? dist(r.x, r.y, pr[0], pr[1]) / dt : 0;
      const closing = (v.lastD - d) / dt;
      v.lastD = d;
      const b = dTarget < WALK ? S.band.near : S.band.far;
      b.n++; b.vt += vt; b.vr += vr; b.closing += closing;
      if (vr >= 2) {
        S.runnerMoving.n++; S.runnerMoving.vt += vt; S.runnerMoving.vr += vr; S.runnerMoving.d += d;
        const rvx = r.vx, rvy = r.vy; const rn = Math.sqrt(rvx * rvx + rvy * rvy) || 1;
        const along = ((a.x - r.x) * rvx + (a.y - r.y) * rvy) / rn; // 양수 = 침투자 진행 방향 앞
        S.runnerMoving.along += along;
        if (along < -1) S.runnerMoving.behind++;
      } else { S.runnerSlow.n++; S.runnerSlow.d += d; S.runnerSlow.vt += vt; }
    }
    // 존 안 침투자 틱(배정 유무)
    if (owner || s.possTeam >= 0) {
      const def = (1 - att) as 0 | 1;
      const dDir = attackDir(def, s.half);
      const [gx, gy] = ownGoal(dDir);
      for (const o of s.agents) {
        if (!o.onPitch || o.team !== att || o.line !== 2 || o === owner) continue;
        if (dist(o.x, o.y, gx, gy) >= ZONE) { entryT.delete(o); continue; }
        if (!entryT.has(o)) entryT.set(o, t);
        Z.runnerTicks++;
        if (!s.restart) {
          CV.n++;
          let any = Infinity, tr3 = false;
          for (const d of s.agents) { if (!d.onPitch || d.team === att || d.line === 0) continue; const dd = dist(d.x, d.y, o.x, o.y); any = Math.min(any, dd); if (d.trackIdx === o.idx) { CV.assigned++; if (dd <= 3) tr3 = true; } }
          if (any <= 3) CV.any3++; if (any <= 5) CV.any5++; if (tr3) CV.tr3++;
        }
        for (const [, v] of live) if (v.runner === o.idx) { Z.assignedTicks++; break; }
      }
    }
  }
  for (const [a, v] of [...live]) endSpell(a, v, 'other');
  function endSpell(a: Agent, cur: { runner: number; sp: Spell }, reason: Reason): void {
    cur.sp.t1 = s.t; cur.sp.reason = reason; spells.push(cur.sp); live.delete(a);
  }
}

for (let i = 0; i < N; i++) analyze(mk('H', i, HOME), mk('A', i, AWAY), 7000 + i);

const f = (x: number, k = 1) => (Number.isFinite(x) ? x.toFixed(k) : '-');
const avg = (xs: number[]) => (xs.length ? xs.reduce((p, q) => p + q, 0) / xs.length : NaN);
const med = (xs: number[]) => { if (!xs.length) return NaN; const t = xs.slice().sort((a, b) => a - b); return t[Math.floor(t.length / 2)]!; };
const pct = (n: number, d: number) => (d ? `${((n / d) * 100).toFixed(0)}%` : '-');
console.log(`track-trace · ${N}경기 ${FORMATION} ${HOME} 대 ${AWAY} · trackZone ${ZONE} · walkDist ${WALK} · trackLead ${ENGINE.offball.trackLead} · trackGap ${ENGINE.offball.trackGap}/${ENGINE.offball.trackGapOut} (엔진 ${ENGINE_VERSION})`);
console.log(`배정 구간 ${spells.length} (경기당 ${f(spells.length / N)}) · 길이 평균 ${f(avg(spells.map((x) => x.t1 - x.t0)), 2)} s (중앙값 ${f(med(spells.map((x) => x.t1 - x.t0)), 2)}; ≤ 0.5 s ${pct(spells.filter((x) => x.t1 - x.t0 <= 0.5).length, spells.length)} · ≤ 1 s ${pct(spells.filter((x) => x.t1 - x.t0 <= 1).length, spells.length)} · ≥ 3 s ${pct(spells.filter((x) => x.t1 - x.t0 >= 3).length, spells.length)})`);
const reasons = ['poss', 'ownerRunner', 'flight', 'press', 'counterCover', 'outZone', 'sub', 'other'] as const;
console.log(`해제 이유: ${reasons.map((r) => `${r} ${pct(spells.filter((x) => x.reason === r).length, spells.length)}`).join(' · ')}`);
console.log(`배정 때: 거리 ${f(avg(spells.map((x) => x.d0)))} m (중앙값 ${f(med(spells.map((x) => x.d0)))}) · 추적자가 침투자보다 골 쪽 ${pct(spells.filter((x) => x.goalSide0).length, spells.length)} · 측면 오프셋 ${f(avg(spells.map((x) => x.lat0)))} m · 구간 중 최소 거리 ${f(avg(spells.map((x) => x.minD)))} m (≤ 1.5 ${pct(spells.filter((x) => x.minD <= 1.5).length, spells.length)}, ≤ 3 ${pct(spells.filter((x) => x.minD <= 3).length, spells.length)})`);
console.log(`존 안 침투자 틱 중 배정됨 ${pct(Z.assignedTicks, Z.runnerTicks)}`);
console.log(`틱 표본 ${S.n}: 추적자↔침투자 ${f(avg(S.d))} m (중앙값 ${f(med(S.d))}; ≤ 1.5 ${pct(S.d.filter((x) => x <= 1.5).length, S.n)} · ≤ 3 ${pct(S.d.filter((x) => x <= 3).length, S.n)} · ≤ 5 ${pct(S.d.filter((x) => x <= 5).length, S.n)}) · 목표가 침투자 5 m 안(추적 분기가 목표를 쥠) ${pct(S.onRunner, S.n)} · urgent ${pct(S.urgentN, S.n)}`);
console.log(`  배정 뒤 경과별 거리: <0.5 s ${f(avg(S.dByAge[0]!))} · 0.5~1 ${f(avg(S.dByAge[1]!))} · 1~2 ${f(avg(S.dByAge[2]!))} · 2~4 ${f(avg(S.dByAge[3]!))} · 4+ ${f(avg(S.dByAge[4]!))} m (표본 ${S.dByAge.map((x) => x.length).join('/')})`);
const bn = S.band.near, bf = S.band.far;
console.log(`  목표까지 < walkDist(${WALK}) 틱 ${pct(bn.n, S.n)}: 추적자 속도 ${f(bn.vt / bn.n)} · 침투자 속도 ${f(bn.vr / bn.n)} m/s · 접근률 ${f(bn.closing / bn.n, 2)} m/s | ≥ walkDist: 추적자 ${f(bf.vt / bf.n)} · 침투자 ${f(bf.vr / bf.n)} · 접근률 ${f(bf.closing / bf.n, 2)}`);
const rm = S.runnerMoving, rs = S.runnerSlow;
console.log(`  침투자 움직임(≥ 2 m/s) 틱 ${pct(rm.n, S.n)}: 거리 ${f(rm.d / rm.n)} m · 추적자 ${f(rm.vt / rm.n)} 대 침투자 ${f(rm.vr / rm.n)} m/s · 진행 방향 기준 추적자 위치 평균 ${f(rm.along / rm.n)} m(음수 = 뒤) · 1 m+ 뒤 ${pct(rm.behind, rm.n)} | 침투자 느림 틱: 거리 ${f(rs.d / rs.n)} m · 추적자 속도 ${f(rs.vt / rs.n)}`);
console.log(`받음(존 ${ZONE}+3 안 줄 2 수신) ${R.n} (경기당 ${f(R.n / N)}): 그 틱 추적자 있음 ${pct(R.assigned, R.n)} · 1.5 s 안 해제됨 ${pct(R.releasedRecently, R.n)} (${Object.entries(R.releasedReason).map(([k, v]) => `${k} ${v}`).join(', ')}) · (전)추적자 거리 ${f(avg(R.trackD))} m (≤ 1.5 ${pct(R.trackD.filter((x) => x <= 1.5).length, R.trackD.length)}, ≤ 3 ${pct(R.trackD.filter((x) => x <= 3).length, R.trackD.length)}) · 아무 수비 ${f(avg(R.anyD))} m (≤ 1.5 ${pct(R.anyClose15, R.n)})`);
console.log(`  목표가 침투자에 없는 틱 ${pct(OFF.n, S.n)} 분해: 침투자 존 밖 ${pct(OFF.runnerOut, OFF.n)} · 공이 우리 박스 안 ${pct(OFF.ownBox, OFF.n)} · 위험지역 ${pct(OFF.danger, OFF.n)} · 추적자 압박 rank ≤ 1 ${pct(OFF.rank01, OFF.n)} · 목표가 공 3 m 안 ${pct(OFF.tgtBall, OFF.n)} · 설명 안 됨 ${pct(OFF.unexplained, OFF.n)} | 거리: 목표 있음 ${f(avg(OFF.dOn))} m (≤ 1.5 ${pct(OFF.dOn.filter((x) => x <= 1.5).length, OFF.dOn.length)}, ≤ 3 ${pct(OFF.dOn.filter((x) => x <= 3).length, OFF.dOn.length)}) / 없음 ${f(avg(OFF.dOff))} m`);
console.log(`받는 순간(추적자 있음 ${RX.n}): 추적자 목표까지 ${f(avg(RX.dTarget))} m · urgent ${pct(RX.urgent, RX.n)} · 추적자 속도 ${f(avg(RX.vt))} m/s · 목표가 침투자 5 m 안 ${pct(RX.tgtOnRunner, RX.n)} · 착지점 3 m 안 ${pct(RX.tgtOnLanding, RX.n)} · 침투자 직전 1 s 이동 ${f(avg(RX.runnerMove1s))} m (≥ 3 m ${pct(RX.runnerMove1s.filter((x) => x >= 3).length, RX.n)}) · 존 진입 뒤 ${f(avg(RX.sinceEntry.filter((x) => x >= 0)))} s (≤ 2 s ${pct(RX.sinceEntry.filter((x) => x >= 0 && x <= 2).length, RX.n)}) · 직전 비행 ${f(avg(RX.flightDur), 2)} s`);
console.log(`  (전)추적자 거리: 배정 중 ${f(avg(RR.assignedD))} m (≤ 1.5 ${pct(RR.assignedD.filter((x) => x <= 1.5).length, RR.assignedD.length)}, ≤ 3 ${pct(RR.assignedD.filter((x) => x <= 3).length, RR.assignedD.length)}) / 1.5 s 안 해제(수신자 압박 인계 등) ${f(avg(RR.releasedD))} m (≤ 1.5 ${pct(RR.releasedD.filter((x) => x <= 1.5).length, RR.releasedD.length)}, ≤ 3 ${pct(RR.releasedD.filter((x) => x <= 3).length, RR.releasedD.length)})`);
console.log(`  받기 전 시계열(추적자 있음 ${TS.n}): −3 s ${f(TS.d[0]! / TS.n)} · −2 s ${f(TS.d[1]! / TS.n)} · −1 s ${f(TS.d[2]! / TS.n)} · −0.5 s ${f(TS.d[3]! / TS.n)} · 0 s ${f(TS.d[4]! / TS.n)} m | 그때 목표가 침투자 위 ${[0, 1, 2, 3, 4].map((k) => pct(TS.on[k]!, TS.n)).join(' / ')}`);
console.log(`  추적자 목표 갱신 틱(침투자 존 안) ${UP.n}: 추적 분기 ${pct(UP.track, UP.n)} · 공 3 m(압박) ${pct(UP.ball, UP.n)} · 착지점(수신자 압박) ${pct(UP.land, UP.n)} · 공↔골 커버 ${pct(UP.cover, UP.n)} · 리스타트 ${pct(UP.restart, UP.n)} · 기타 ${pct(UP.other, UP.n)}`);
console.log(`열린 경기 존 안 침투자 틱 ${CV.n}: 추적자 배정 ${pct(CV.assigned, CV.n)} · 추적자 ≤ 3 m ${pct(CV.tr3, CV.n)} · 아무 수비 ≤ 3 m ${pct(CV.any3, CV.n)} · ≤ 5 m ${pct(CV.any5, CV.n)}`);
console.log(`받는 순간 배정 경과: 중앙값 ${f(med(RA.age))} s · <1 s ${pct(RA.age.filter((x) => x < 1).length, RA.age.length)} · 1~2 ${pct(RA.age.filter((x) => x >= 1 && x < 2).length, RA.age.length)} · 2~4 ${pct(RA.age.filter((x) => x >= 2 && x < 4).length, RA.age.length)} · 4+ ${pct(RA.age.filter((x) => x >= 4).length, RA.age.length)} | 그때 거리 ${RA.dByAge.map((x) => f(avg(x))).join(' / ')} m (≤ 1.5: ${RA.dByAge.map((x) => pct(x.filter((y) => y <= 1.5).length, x.length)).join(' / ')})`);
console.log(`  목표 쥔 틱 ${JT.n}: 목표까지 ${f(JT.dTgt / JT.n)} m · 목표 이동(틱 간 > 0.05 m) 초당 ${f((JT.jumpN / JT.n) * 10)}회 · 평균 ${f(JT.jumpSum / Math.max(1, JT.jumpN))} m · 방향 반전(속도 > 1 m/s 중 목표가 뒤) ${pct(JT.revN, JT.spdN)}`);
console.log(`  실제 목표 ↔ 이상 목표(침투자 + 골 쪽 gap 만) 차 ${f(ID.dev / ID.n)} m · 이상 목표의 틱 간 이동 ${f((ID.idealJumpSum / Math.max(1, ID.idealJumpN)) * 10)} m/s`);
