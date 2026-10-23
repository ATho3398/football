// 깊은 블록 분해 (C.78d 0번): 팀마다 수비 쪽 ⒜ 허용 슛의 위치(박스 안/밖·박스 앞 중앙 존)·xG·압박·블록 ⒝ 수비 모양(줄 높이·줄 간격·박스 앞 16.5~25 m 존 인원)
// ⒞ 상대가 뚫는 경로(슛 전 마지막 수신: 크로스·줄 사이·침투·그 밖) · 줄 사이 수신 때 가장 가까운 수비와 1초 뒤 거리 ⒟ 자기 ⅓ 탈취 뒤 첫 패스·지원 인원·15초 결과.
// MatchJob.block 이 켜지면 job.ts 가 경기를 한 틱씩 돌리며 부른다. 엔진 상태는 읽기만 한다(probe.shot·decide 훅만 씀, 지문 불변).

import { attackDir, dist, L, toNorm, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';
import type { Flight, SimState } from '../../src/engine/state';

export interface BlockTeam {
  /** 수비 쪽 — 허용 오픈 플레이 슛(발·머리) · 박스 안 · 박스 앞 중앙 존(박스 밖 25 m 안, 중앙 ±20 m) · 그 밖 박스 밖 · 머리 · xG 합 · 블록 판정 수 · pBlock 합 · 3 m 안 수비 합 · 거리 합 */
  sa: number;
  saBox: number;
  saZ14: number;
  saFar: number;
  saHead: number;
  saXg: number;
  saBlocked: number;
  saPBlock: number;
  saPress3: number;
  saD: number;
  saGoals: number;
  /** 그중 세트피스로 시작한 소유의 슛 */
  saSetPoss: number;
  /** 경로별 xG 합 · 머리 슛 xG 합 · 박스 안 슛 xG 합 */
  viaXg: number[];
  headXg: number;
  /** 슛 순간 슈터 6 m 안 골 쪽 수비 수 합 · 그 슛 순간 슈터가 공을 받은 뒤 지난 시간 합(받은 공 있을 때) · 수 */
  saDense6: number;
  saRecvT: number;
  saRecvN: number;
  boxXg: number;
  /** 허용 슛 직전 경로(슈터가 4초 안 받은 공): 크로스 · 줄 사이 수신 · 침투 패스 · 그 밖 패스 · 받은 공 없음(몰기·루즈볼) · 그중 같은 팀 6초 안 앞 슛(리바운드·블록 뒤) */
  via: number[];
  /** 수비 모양 표본(상대 소유·오픈 플레이·공이 우리 절반·탈취 뒤 5초 지남, 0.5초마다): 수 · 수비 줄 높이(골에서 m) · 중원 줄 높이 · 줄 간격 · 박스 앞 존 우리/상대 · 박스 안 우리/상대 · 공보다 골 쪽 우리 */
  sh: number;
  shDef: number;
  shMid: number;
  shGap: number;
  shZoneUs: number;
  shZoneThem: number;
  shBoxUs: number;
  shBoxThem: number;
  shBehind: number;
  /** 상대 줄 사이 수신(우리 수비 줄과 중원 줄 사이 깊이, 골에서 35 m 안, 중앙 ±20 m): 수 · 가장 가까운 수비 거리 · 1초 뒤 거리 · 6초 안 슛 */
  btw: number;
  btwNear: number;
  btwNear1: number;
  btwShot6: number;
  /** 상대 크로스 시도 · 박스 밖 슛 결정 수(판단) */
  crossFaced: number;
  /** 공격 쪽 — 자기 ⅓ 탈취 수 · 첫 결정까지 s · 첫 패스 전진 m 합 · 전진 패스(10 m+) 수 · 첫 결정 수 · 3초 뒤 공보다 앞 동료 · 그중 4 m/s 넘게 달리는 동료 · 15초 슛 · 15초 골 · 15초 안 상대 ⅓ 도달 */
  low: number;
  lowT1: number;
  lowFwd: number;
  lowFwdN: number;
  lowDec: number;
  lowAhead3: number;
  lowRun3: number;
  lowShot15: number;
  lowGoal15: number;
  lowF3: number;
  /** 자기 ⅓ 탈취 뒤 5초·10초에도 계속 소유(중간에 안 잃음) · 첫 패스가 롱(30 m+)인 수 · 그 롱패스 뒤 3초 안 우리 소유 */
  lowKeep5: number;
  lowKeep10: number;
  lowLong: number;
  lowLongKeep: number;
  /** 모든 오픈 플레이 탈취 · 15초 슛 */
  wins: number;
  winShot15: number;
}

export interface BlockOut {
  team: [BlockTeam, BlockTeam];
}

function empty(): BlockTeam {
  return {
    sa: 0, saBox: 0, saZ14: 0, saFar: 0, saHead: 0, saXg: 0, saBlocked: 0, saPBlock: 0, saPress3: 0, saD: 0, saGoals: 0, saSetPoss: 0, viaXg: [0, 0, 0, 0, 0, 0], headXg: 0, boxXg: 0, saDense6: 0, saRecvT: 0, saRecvN: 0, via: [0, 0, 0, 0, 0, 0],
    sh: 0, shDef: 0, shMid: 0, shGap: 0, shZoneUs: 0, shZoneThem: 0, shBoxUs: 0, shBoxThem: 0, shBehind: 0,
    btw: 0, btwNear: 0, btwNear1: 0, btwShot6: 0, crossFaced: 0,
    low: 0, lowT1: 0, lowFwd: 0, lowFwdN: 0, lowDec: 0, lowAhead3: 0, lowRun3: 0, lowShot15: 0, lowGoal15: 0, lowF3: 0, lowKeep5: 0, lowKeep10: 0, lowLong: 0, lowLongKeep: 0, wins: 0, winShot15: 0,
  };
}

const BOX_D = 16.5;
const BOX_HW = 20.15;

/** def 팀 기준 자기 골에서 깊이(m)·중앙에서 |y| */
function depth(s: SimState, def: 0 | 1, x: number, y: number): [number, number] {
  const nx = toNorm(x, y, attackDir(def, s.half))[0];
  return [nx * L, Math.abs(y - W / 2)];
}

/** def 팀 수비 줄(line 1)·중원 줄(line 2) 평균 깊이 */
function lines(s: SimState, def: 0 | 1): [number, number] {
  let d = 0, dn = 0, m = 0, mn = 0;
  for (const a of s.agents) {
    if (!a.onPitch || a.team !== def) continue;
    const [z] = depth(s, def, a.x, a.y);
    if (a.line === 1) { d += z; dn++; } else if (a.line === 2) { m += z; mn++; }
  }
  return [dn ? d / dn : 0, mn ? m / mn : 0];
}

export function blockRun(sim: MatchSim): BlockOut {
  const s = sim.state;
  const out: BlockOut = { team: [empty(), empty()] };
  /** 선수별 마지막 수신 (시각·경로 종류) */
  const lastRecv = new Map<number, { t: number; via: number }>();
  let curFl: Flight | null = null;
  let endedFl: Flight | null = null;
  let prevOwner = s.ball.owner;
  let prevPoss = s.possTeam;
  const wonAt = [-100, -100];
  let nextShape = 0;
  const btwWatch: { def: 0 | 1; t: number; rcv: number; shots: number; n1: boolean; done: boolean }[] = [];
  const lowWatch: { team: 0 | 1; t: number; shots: number; goals: number; dec: boolean; a3: boolean; f3: boolean; shot: boolean; goal: boolean; lost: boolean; k5: boolean; k10: boolean; longT: number }[] = [];
  const winWatch: { team: 0 | 1; t: number; shots: number; shot: boolean }[] = [];
  const lastShotT = [-100, -100];
  const shots: { def: 0 | 1; p: { outcome: string } }[] = [];
  const oldShot = probe.shot;
  const oldDecide = probe.decide;
  probe.shot = (st, p) => {
    if (p.kind === 'fk' || p.kind === 'pk') return;
    if (st.possOrigin !== 'open') out.team[(1 - p.team) as 0 | 1].saSetPoss++;
    const def = (1 - p.team) as 0 | 1;
    const T = out.team[def];
    T.sa++;
    const [z, ay] = depth(st, def, p.x, p.y);
    if (z <= BOX_D && ay <= BOX_HW) T.saBox++;
    else if (z <= 25 && ay <= 20) T.saZ14++;
    else T.saFar++;
    if (p.kind === 'header') T.saHead++;
    T.saXg += p.xg ?? 0;
    T.saPBlock += p.pBlock;
    T.saPress3 += p.press3;
    T.saD += p.d;
    if (p.outcome === 'block') T.saBlocked++;
    const lr = lastRecv.get(p.shooter);
    const vk = lr && st.t - lr.t <= 4 ? lr.via : 4;
    T.via[vk]!++;
    T.viaXg[vk]! += p.xg ?? 0;
    if (lr && st.t - lr.t <= 4) { T.saRecvT += st.t - lr.t; T.saRecvN++; }
    {
      const gx = attackDir(p.team, st.half) > 0 ? L : 0;
      const dg = dist(p.x, p.y, gx, W / 2);
      for (const o of st.agents) if (o.onPitch && o.team === def && o.line !== 0 && dist(o.x, o.y, p.x, p.y) <= 6 && dist(o.x, o.y, gx, W / 2) < dg) T.saDense6++;
    }
    if (p.kind === 'header') T.headXg += p.xg ?? 0;
    if (z <= BOX_D && ay <= BOX_HW) T.boxXg += p.xg ?? 0;
    if (st.t - lastShotT[p.team]! <= 6) T.via[5]!++;
    lastShotT[p.team] = st.t;
    shots.push({ def, p });
  };
  probe.decide = (st, p) => {
    const a = p.a;
    for (const w of lowWatch) if (!w.dec && w.team === a.team && st.t - w.t <= 15) {
      w.dec = true;
      const T = out.team[w.team];
      T.lowDec++;
      T.lowT1 += st.t - w.t;
      const c = p.chosen;
      if (c.receiver >= 0) {
        const dir = attackDir(a.team, st.half);
        const fwd = (toNorm(c.x, c.y, dir)[0] - toNorm(a.x, a.y, dir)[0]) * L;
        T.lowFwd += fwd;
        if (fwd >= 10) T.lowFwdN++;
        if (dist(a.x, a.y, c.x, c.y) >= 30) { T.lowLong++; w.longT = st.t; }
      }
    }
    if (p.chosen.type === 'cross') out.team[(1 - a.team) as 0 | 1].crossFaced++;
  };
  try {
    while (!s.done) {
      sim.step();
      const t = s.t;
      const b = s.ball;
      if (b.flight && b.flight !== curFl) curFl = b.flight;
      else if (!b.flight && curFl) { endedFl = curFl; curFl = null; }
      // 수신
      if (b.owner >= 0 && b.owner !== prevOwner) {
        const o = s.agents[b.owner]!;
        const fl = endedFl;
        if (fl && fl.passer >= 0 && s.agents[fl.passer]!.team === o.team && fl.kind !== 'shot' && fl.kind !== 'clear') {
          const def = (1 - o.team) as 0 | 1;
          const [z, ay] = depth(s, def, o.x, o.y);
          const [dl, ml] = lines(s, def);
          const between = z > dl + 1 && z < ml + 2 && z < 35 && ay <= 20;
          const via = fl.fromCross || fl.kind === 'cross' ? 0 : between ? 1 : fl.through ? 2 : 3;
          lastRecv.set(o.idx, { t, via });
          if (between && !s.restart) {
            const T = out.team[def];
            T.btw++;
            let nd = 99;
            for (const q of s.agents) if (q.onPitch && q.team === def && q.line !== 0) nd = Math.min(nd, dist(q.x, q.y, o.x, o.y));
            T.btwNear += nd;
            btwWatch.push({ def, t, rcv: o.idx, shots: s.teams[o.team].stats.shots, n1: false, done: false });
          }
        }
        endedFl = null;
      }
      prevOwner = b.owner;
      for (const w of btwWatch) {
        if (w.done) continue;
        const T = out.team[w.def];
        const r = s.agents[w.rcv]!;
        if (!w.n1 && t - w.t >= 1) {
          w.n1 = true;
          let nd = 99;
          for (const q of s.agents) if (q.onPitch && q.team === w.def && q.line !== 0) nd = Math.min(nd, dist(q.x, q.y, r.x, r.y));
          T.btwNear1 += nd;
        }
        if (s.teams[r.team].stats.shots > w.shots) { T.btwShot6++; w.done = true; }
        else if (t - w.t > 6) w.done = w.n1;
      }
      // 탈취
      if (s.possTeam !== prevPoss && !s.restart && s.possOrigin === 'open' && (s.possTeam === 0 || s.possTeam === 1)) {
        const win = s.possTeam as 0 | 1;
        wonAt[win] = t;
        const T = out.team[win];
        T.wins++;
        winWatch.push({ team: win, t, shots: s.teams[win].stats.shots, shot: false });
        const [z] = depth(s, win, b.x, b.y);
        if (z < L / 3) {
          T.low++;
          lowWatch.push({ team: win, t, shots: s.teams[win].stats.shots, goals: s.teams[win].stats.goals, dec: false, a3: false, f3: false, shot: false, goal: false, lost: false, k5: false, k10: false, longT: -1 });
        }
      }
      prevPoss = s.possTeam;
      for (const w of winWatch) if (!w.shot && t - w.t <= 15 && s.teams[w.team].stats.shots > w.shots) { w.shot = true; out.team[w.team].winShot15++; }
      for (const w of lowWatch) {
        if (t - w.t > 15) continue;
        const T = out.team[w.team];
        if (!w.shot && s.teams[w.team].stats.shots > w.shots) { w.shot = true; T.lowShot15++; }
        if (!w.goal && s.teams[w.team].stats.goals > w.goals) { w.goal = true; T.lowGoal15++; }
        if (!w.lost && s.possTeam !== w.team && !s.restart) w.lost = true;
        if (!w.k5 && t - w.t >= 5) { w.k5 = true; if (!w.lost) T.lowKeep5++; }
        if (!w.k10 && t - w.t >= 10) { w.k10 = true; if (!w.lost) T.lowKeep10++; }
        if (w.longT > 0 && t - w.longT <= 3 && b.owner >= 0 && !b.flight) {
          if (s.agents[b.owner]!.team === w.team && t - w.longT > 0.3) { T.lowLongKeep++; w.longT = -2; }
          else if (s.agents[b.owner]!.team !== w.team) w.longT = -2;
        }
        if (!w.f3 && s.possTeam === w.team && depth(s, w.team, b.x, b.y)[0] > (2 * L) / 3) { w.f3 = true; T.lowF3++; }
        if (!w.a3 && t - w.t >= 3) {
          w.a3 = true;
          if (s.possTeam === w.team) {
            const [bz] = depth(s, w.team, b.x, b.y);
            for (const q of s.agents) {
              if (!q.onPitch || q.team !== w.team || q.line === 0 || q.idx === b.owner) continue;
              if (depth(s, w.team, q.x, q.y)[0] > bz + 2) {
                T.lowAhead3++;
                if (Math.hypot(q.vx, q.vy) > 4) T.lowRun3++;
              }
            }
          }
        }
      }
      if (lowWatch.length > 50) lowWatch.splice(0, lowWatch.length - 20);
      if (winWatch.length > 50) winWatch.splice(0, winWatch.length - 20);
      if (btwWatch.length > 50) btwWatch.splice(0, btwWatch.findIndex((w) => !w.done) >>> 0);
      // 수비 모양 표본
      if (t >= nextShape && b.owner >= 0 && !s.restart) {
        nextShape = t + 0.5;
        const att = s.agents[b.owner]!.team;
        const def = (1 - att) as 0 | 1;
        const [bz] = depth(s, def, b.x, b.y);
        if (bz < L / 2 && t - wonAt[att]! > 5) {
          const T = out.team[def];
          const [dl, ml] = lines(s, def);
          T.sh++;
          T.shDef += dl;
          T.shMid += ml;
          T.shGap += ml - dl;
          for (const q of s.agents) {
            if (!q.onPitch || q.line === 0) continue;
            const [z, ay] = depth(s, def, q.x, q.y);
            const box = z <= BOX_D && ay <= BOX_HW;
            const zone = !box && z <= 25 && ay <= 20;
            if (q.team === def) {
              if (box) T.shBoxUs++;
              if (zone) T.shZoneUs++;
              if (z < bz) T.shBehind++;
            } else {
              if (box) T.shBoxThem++;
              if (zone) T.shZoneThem++;
            }
          }
        }
      }
    }
    for (const x of shots) if (x.p.outcome === 'goal') out.team[x.def].saGoals++;
  } finally {
    probe.shot = oldShot;
    probe.decide = oldDecide;
  }
  return out;
}
