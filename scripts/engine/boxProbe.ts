// 박스 수신 분해 (C.78p 엔진관리자11 질문 1): 공격 팀마다 ⒜ 상대 박스로 가는 패스(땅볼·롱·크로스)의 결과 ⒝ 박스 안 수신 순간의 수비 거리·1초 뒤 거리·
// 수신 경합 · 받은 뒤 3초 결과(슛·잃음·패스) · 받고 첫 결정/슛까지 시간 ⒞ 12 m 안 발 슛의 앞 장면 — 모두 "그 순간 상대 박스 안 수비 인원"(0~3 / 4~5 / 6+)별로 센다.
// MatchJob.box 가 켜지면 job.ts 가 경기를 한 틱씩 돌리며 부른다. 엔진 상태는 읽기만 한다(probe.shot·decide 훅만 씀, 지문 불변).

import { attackDir, dist, inOppBox, L, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';
import type { Agent, Flight, SimState } from '../../src/engine/state';

/** 구간별 칸 (0~3 · 4~5 · 6+) */
export type B3 = [number, number, number];
const z3 = (): B3 => [0, 0, 0];

export interface BoxTeam {
  /** 박스로 가는 패스: 수 · 계획 결과 받기 · 공격 팀이 1.5초 안 소유(성공) · 땅볼 · 크로스 */
  pIn: B3;
  pRecvPlan: B3;
  pOk: B3;
  pGround: B3;
  pCross: B3;
  /** 땅볼로 받기 계획인데 수신 경합에서 진 수 */
  pContestLost: B3;
  /** 박스 안 수신(같은 편 패스를 받아 소유): 수 · 가장 가까운 수비 거리 합 · 3 m 안 수비 수 합 · 2 m 안(경합 거리) 수 · 1초 뒤 가장 가까운 거리 합(여전히 소유) · 1초 뒤 소유 수 */
  r: B3;
  rNear: B3;
  r3: B3;
  r2: B3;
  rNear1: B3;
  rHeld1: B3;
  /** 받은 뒤 3초: 그 선수 슛 · 팀 슛 · 잃음 · 그 선수 슛까지 시간 합 · 원터치(0.25초 안) 슛 · 슛 xG 합 · 골 · 첫 결정 시간 합 · 첫 결정 수 */
  rShot: B3;
  rTeamShot: B3;
  rLost: B3;
  rShotT: B3;
  rOneT: B3;
  rXg: B3;
  rGoal: B3;
  rDecT: B3;
  rDec: B3;
  /** 받는 순간 슈팅 각(골 가운데 → 수신자 선분) 위 2 m 안 수비 수 합 */
  rLane: B3;
  /** 12 m 안 오픈 플레이 발 슛: 수 · 골 · xG · 앞 장면 [박스 수신 3초 안, 박스 밖 수신 뒤 몰고 들어옴, 루즈볼·리바운드·탈취, 그 밖] · 슛 순간 3 m 안 수비 합 */
  s12: B3;
  s12Goal: B3;
  s12Xg: B3;
  s12Via: number[][];
  s12P3: B3;
  /** 박스 안 수비 인원 표본(공격 팀 소유·공이 상대 진영 25 m 안, 0.5초마다): 구간별 수 · 박스 안 공격수 합 · 박스 안 미마크(2.5 m 안 수비 없음) 공격수 합 */
  smp: B3;
  smpAtt: B3;
  smpFree: B3;
  /** 경기 득점 · 슛(오픈 발) */
  goals: number;
}

/** 박스 수신 원자료: [박스 안 수비, 가장 가까운 수비 m, 3 m 안 수비, 골까지 m, 3초 안 그 선수 슛 0/1, 슛 xG, 골 0/1, 3초 안 잃음 0/1, 슛까지 s, 1초 뒤 가장 가까운 m(−1 = 소유 아님), 4 m 안 수비, 공격 팀] */
export type RecvRow = number[];
export interface BoxOut {
  team: [BoxTeam, BoxTeam];
  rows: RecvRow[];
  /** 박스 안 소유 틱(공격 팀 기준) · 그동안 2 m 안 수비 수 합 · 그동안 수비 태클 시도 · 그중 이긴 태클 · 파울 */
  boxTicks: [number, number];
  boxNear2: [number, number];
  boxTk: [number, number];
  boxTkWon: [number, number];
  boxFoul: [number, number];
}

const empty = (): BoxTeam => ({
  pIn: z3(), pRecvPlan: z3(), pOk: z3(), pGround: z3(), pCross: z3(), pContestLost: z3(),
  r: z3(), rNear: z3(), r3: z3(), r2: z3(), rNear1: z3(), rHeld1: z3(),
  rShot: z3(), rTeamShot: z3(), rLost: z3(), rShotT: z3(), rOneT: z3(), rXg: z3(), rGoal: z3(), rDecT: z3(), rDec: z3(), rLane: z3(),
  s12: z3(), s12Goal: z3(), s12Xg: z3(), s12Via: [z3(), z3(), z3(), z3()], s12P3: z3(),
  smp: z3(), smpAtt: z3(), smpFree: z3(), goals: 0,
});

const bucket = (n: number) => (n <= 3 ? 0 : n <= 5 ? 1 : 2);

/** 공격 팀 att 기준 상대 박스 안 수비(필드) 수 */
function boxDef(s: SimState, att: 0 | 1): number {
  const dir = attackDir(att, s.half);
  let n = 0;
  for (const o of s.agents) if (o.onPitch && o.team !== att && o.line !== 0 && inOppBox(o.x, o.y, dir)) n++;
  return n;
}
function nearestDef(s: SimState, a: Agent): [number, number] {
  let nd = 99, n3 = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const d = dist(o.x, o.y, a.x, a.y);
    if (d < nd) nd = d;
    if (d <= 3) n3++;
  }
  return [nd, n3];
}
function laneDef(s: SimState, a: Agent): number {
  const gx = attackDir(a.team, s.half) > 0 ? L : 0;
  const gy = W / 2;
  let n = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    const ux = gx - a.x, uy = gy - a.y, ul = Math.hypot(ux, uy) || 1;
    const t = ((o.x - a.x) * ux + (o.y - a.y) * uy) / (ul * ul);
    if (t <= 0 || t >= 1) continue;
    const e = Math.abs((o.x - a.x) * uy - (o.y - a.y) * ux) / ul;
    if (e <= 2) n++;
  }
  return n;
}

export function boxRun(sim: MatchSim): BoxOut {
  const s = sim.state;
  const out: BoxOut = { team: [empty(), empty()], rows: [], boxTicks: [0, 0], boxNear2: [0, 0], boxTk: [0, 0], boxTkWon: [0, 0], boxFoul: [0, 0] };
  let tkPrev = [0, 0], tkwPrev = [0, 0], flPrev = [0, 0], boxOwnPrev = -1;
  let curFl: Flight | null = null;
  let endedFl: { fl: Flight; t: number } | null = null;
  let prevOwner = s.ball.owner;
  let prevKick: { kind: string; team: 0 | 1 } | null = null;
  /** 박스로 가는 패스 지켜보기 */
  const pw: { fl: Flight; team: 0 | 1; b: number; end: number; plan: string; ground: boolean }[] = [];
  /** 박스 수신 지켜보기 */
  const rw: { team: 0 | 1; who: number; t: number; b: number; done: boolean; one: boolean; dec: boolean }[] = [];
  /** 선수별 마지막 소유 시작 · 어떻게(0 박스 수신 · 1 박스 밖 수신 · 2 탈취·루즈 · 3 그 밖) */
  const own = new Map<number, { t: number; how: number }>();
  let nextSmp = 0;
  const oldShot = probe.shot;
  const oldDecide = probe.decide;
  probe.shot = (st, p) => {
    if (p.kind !== 'foot' || st.possOrigin !== 'open') return;
    for (const w of rw) {
      if (w.done || w.team !== p.team || st.t - w.t > 3) continue;
      const T = out.team[w.team];
      T.rTeamShot[w.b]!++;
      if (p.shooter === w.who) {
        T.rShot[w.b]!++;
        T.rShotT[w.b]! += st.t - w.t;
        if (st.t - w.t <= 0.25) T.rOneT[w.b]!++;
        T.rXg[w.b]! += p.xg ?? 0;
        (w as { key?: object }).key = p;
        const row = (w as unknown as { row: RecvRow }).row;
        row[4] = 1; row[5] = p.xg ?? 0; row[8] = st.t - w.t;
      }
      w.done = true;
    }
    if (p.d > 12) return;
    const T = out.team[p.team];
    const b = bucket(boxDef(st, p.team));
    T.s12[b]!++;
    T.s12Xg[b]! += p.xg ?? 0;
    T.s12P3[b]! += p.press3;
    const o = own.get(p.shooter);
    const via = o ? (o.how === 0 && st.t - o.t <= 3 ? 0 : o.how === 1 ? 1 : o.how === 2 ? 2 : 3) : 3;
    T.s12Via[via]![b]!++;
    shotRecs.push({ p, team: p.team, b });
  };
  const shotRecs: { p: { outcome: string }; team: 0 | 1; b: number }[] = [];
  probe.decide = (st, p) => {
    for (const w of rw) if (!w.dec && w.who === p.a.idx && st.t - w.t <= 3) {
      w.dec = true;
      const T = out.team[w.team];
      T.rDec[w.b]!++;
      T.rDecT[w.b]! += st.t - w.t;
    }
  };
  const recvWatch1: { team: 0 | 1; who: number; t: number; b: number }[] = [];
  try {
    while (!s.done) {
      sim.step();
      const t = s.t;
      const b = s.ball;
      if (b.flight && b.flight !== curFl) {
        if (curFl) endedFl = { fl: curFl, t };
        curFl = b.flight;
        const fl = curFl;
        if (fl.kind === 'pass' || fl.kind === 'long' || fl.kind === 'cross') {
          const pa = s.agents[fl.passer]!;
          const dir = attackDir(pa.team, s.half);
          if (s.possOrigin === 'open' && inOppBox(fl.toX, fl.toY, dir)) {
            const bb = bucket(boxDef(s, pa.team));
            const T = out.team[pa.team];
            T.pIn[bb]!++;
            if (fl.outcome === 'receive') T.pRecvPlan[bb]!++;
            const ground = !fl.air && fl.kind !== 'cross';
            if (ground) T.pGround[bb]!++;
            if (fl.kind === 'cross') T.pCross[bb]!++;
            pw.push({ fl, team: pa.team, b: bb, end: -1, plan: fl.outcome, ground });
          }
        }
      } else if (!b.flight && curFl) { endedFl = { fl: curFl, t }; curFl = null; }
      for (const w of pw) {
        if (w.end < 0 && b.flight !== w.fl) w.end = t;
        if (w.end >= 0) {
          const ow = b.owner >= 0 ? s.agents[b.owner]!.team : -1;
          if (ow === w.team || ow === 1 - w.team || t - w.end > 1.5 || s.restart) {
            const T = out.team[w.team];
            if (ow === w.team) T.pOk[w.b]!++;
            else if (w.plan === 'receive' && w.ground && ow === 1 - w.team) T.pContestLost[w.b]!++;
            w.end = -2;
          }
        }
      }
      for (let i = pw.length - 1; i >= 0; i--) if (pw[i]!.end === -2) pw.splice(i, 1);
      if (b.owner >= 0 && b.owner !== prevOwner) {
        const o = s.agents[b.owner]!;
        const dir = attackDir(o.team, s.half);
        // 직전 틱의 마지막 킥(소유·루즈볼이 되면 엔진이 null 로 지운다): 같은 편 패스·롱·크로스를 받았나
        const k = prevKick;
        const fromMate = !!k && (k.kind === 'pass' || k.kind === 'long' || k.kind === 'cross') && k.team === o.team && prevOwner < 0;
        const inBox = inOppBox(o.x, o.y, dir);
        own.set(o.idx, { t, how: fromMate ? (inBox ? 0 : 1) : prevOwner >= 0 && s.agents[prevOwner]!.team === o.team ? 3 : 2 });
        if (fromMate && inBox && s.possOrigin === 'open' && o.line !== 0) {
          const bb = bucket(boxDef(s, o.team));
          const T = out.team[o.team];
          const [nd, n3] = nearestDef(s, o);
          T.r[bb]!++;
          T.rNear[bb]! += Math.min(nd, 20);
          T.r3[bb]! += n3;
          if (nd < 2) T.r2[bb]!++;
          T.rLane[bb]! += laneDef(s, o);
          const gx = dir > 0 ? L : 0;
          let n4 = 0;
          for (const q of s.agents) if (q.onPitch && q.team !== o.team && q.line !== 0 && dist(q.x, q.y, o.x, o.y) <= 4) n4++;
          const row: RecvRow = [boxDef(s, o.team), Math.min(nd, 20), n3, dist(o.x, o.y, gx, W / 2), 0, 0, 0, 0, -1, -1, n4, o.team];
          out.rows.push(row);
          rw.push({ team: o.team, who: o.idx, t, b: bb, done: false, one: false, dec: false, row } as never);
          recvWatch1.push({ team: o.team, who: o.idx, t, b: bb, row } as never);
        }
      }
      prevOwner = b.owner;
      prevKick = b.kick ? { kind: b.kick.kind, team: b.kick.team } : null;
      for (let i = recvWatch1.length - 1; i >= 0; i--) {
        const w = recvWatch1[i]!;
        if (t - w.t >= 1) {
          if (b.owner === w.who) {
            const T = out.team[w.team];
            T.rHeld1[w.b]!++;
            T.rNear1[w.b]! += Math.min(nearestDef(s, s.agents[w.who]!)[0], 20);
            (w as unknown as { row: RecvRow }).row[9] = Math.min(nearestDef(s, s.agents[w.who]!)[0], 20);
          }
          recvWatch1.splice(i, 1);
        }
      }
      for (const w of rw) {
        if (w.done) continue;
        const ow = b.owner >= 0 ? s.agents[b.owner]!.team : b.flight ? -1 : -1;
        if (ow === 1 - w.team) { out.team[w.team].rLost[w.b]!++; w.done = true; (w as unknown as { row: RecvRow }).row[7] = 1; }
        else if (t - w.t > 3) w.done = true;
      }
      for (let i = rw.length - 1; i >= 0; i--) {
        const w = rw[i]! as { key?: { outcome: string }; done: boolean; team: 0 | 1; b: number };
        if (w.done && !w.key) rw.splice(i, 1);
      }
      {
        const tk = [s.teams[0].stats.tackleAttempts, s.teams[1].stats.tackleAttempts];
        const tkw = [s.teams[0].stats.tacklesWon, s.teams[1].stats.tacklesWon];
        const fl = [s.teams[0].stats.fouls, s.teams[1].stats.fouls];
        if (boxOwnPrev >= 0) {
          const def = 1 - boxOwnPrev;
          out.boxTk[boxOwnPrev as 0 | 1] += tk[def]! - tkPrev[def]!;
          out.boxTkWon[boxOwnPrev as 0 | 1] += tkw[def]! - tkwPrev[def]!;
          out.boxFoul[boxOwnPrev as 0 | 1] += fl[def]! - flPrev[def]!;
        }
        tkPrev = tk; tkwPrev = tkw; flPrev = fl;
        boxOwnPrev = -1;
        if (b.owner >= 0 && s.possOrigin === 'open') {
          const o = s.agents[b.owner]!;
          if (o.line !== 0 && inOppBox(o.x, o.y, attackDir(o.team, s.half))) {
            boxOwnPrev = o.team;
            out.boxTicks[o.team]++;
            let n2 = 0;
            for (const q of s.agents) if (q.onPitch && q.team !== o.team && q.line !== 0 && dist(q.x, q.y, o.x, o.y) <= 2) n2++;
            out.boxNear2[o.team] += n2;
          }
        }
      }
      if (t >= nextSmp) {
        nextSmp = t + 0.5;
        if (b.owner >= 0 && s.possOrigin === 'open') {
          const o = s.agents[b.owner]!;
          const dir = attackDir(o.team, s.half);
          const gx = dir > 0 ? L : 0;
          if (Math.abs(b.x - gx) <= 25) {
            const bb = bucket(boxDef(s, o.team));
            const T = out.team[o.team];
            T.smp[bb]!++;
            for (const q of s.agents) {
              if (!q.onPitch || q.team !== o.team || q.line === 0 || q === o || !inOppBox(q.x, q.y, dir)) continue;
              T.smpAtt[bb]!++;
              if (nearestDef(s, q)[0] > 2.5) T.smpFree[bb]!++;
            }
          }
        }
      }
    }
  } finally {
    probe.shot = oldShot;
    probe.decide = oldDecide;
  }
  // 박스 수신 뒤 슛의 결과 (판정 뒤 save·goal 로 고쳐진 기록)
  for (const w of rw as unknown as { key?: { outcome: string }; team: 0 | 1; b: number; row: RecvRow }[]) if (w.key?.outcome === 'goal') { out.team[w.team].rGoal[w.b]!++; w.row[6] = 1; }
  for (const r of shotRecs) if (r.p.outcome === 'goal') out.team[r.team].s12Goal[r.b]!++;
  out.team[0].goals = s.teams[0].stats.goals;
  out.team[1].goals = s.teams[1].stats.goals;
  return out;
}
