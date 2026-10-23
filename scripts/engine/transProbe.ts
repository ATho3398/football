// 전환 측정 (C.78a, 공통 규칙 로드맵 5단계 0번 분해): 열린 경기에서 공을 잃은 순간 잃은 팀의 배치와 그 뒤 WIN(15)초 결과(C.78b: 8 → 15초, 사용자 2026-10-23 "8초는 너무 타이트"), 2선 추적 배정 시점을 잰다.
// MatchJob.trans 가 켜지면 job.ts 가 경기를 한 틱씩 돌리며 부른다. 엔진 상태는 읽기만 한다(probe.shot 훅만 씀, 지문 불변).

import { offsideLine } from '../../src/engine/offball';
import { arrivalTime } from '../../src/engine/physics';
import { attackDir, dist, L, ownGoal, toNorm } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';

/** 잃은 팀 기준 합계 (팀마다) */
/** 상실 뒤 상대 슈팅·xG·골·오프사이드를 세는 창 (초). C.78a 8 → C.78b 15 (사용자 2026-10-23) */
export const TRANS_WIN = 15;

export interface TransTeam {
  /** 오픈 플레이 소유 상실 수 */
  n: number;
  /** 잃는 순간 역압박 가담 수 합 · 가담 수별 상실 수 [0,1,2,3+] */
  pressers: number;
  byP: number[];
  /** 잃는 순간 공보다 앞(상대 골 쪽) 자기 필드 선수 · 공보다 뒤(자기 골 쪽) */
  ahead: number;
  behind: number;
  /** 수비 줄(line 1) 평균 자기 골 거리 t = 0 / 2 / 4 s */
  line: number[];
  /** 뒤 공간 = 상대 오프사이드 라인(둘째 수비수, GK 포함)의 자기 골 거리 t = 0 / 2 / 4 s */
  space: number[];
  /** 가담 수별 2초 뒤 뒤 공간 합 [0,1,2,3+] */
  spaceByP: number[];
  /** 역압박 뚫림(4초 안, 상대 소유자가 가담자 모두보다 2 m 이상 자기 골 쪽) · 뚫린 순간까지 시간 합 · 뚫린 뒤 가담자 모두 공 뒤로 돌아오기까지 시간 합(최대 8초) */
  beaten: number;
  beatT: number;
  recov: number;
  /** 4초 안 상대 침투 패스 시도 · WIN 초 안 상대 슈팅 · xG · 골 */
  thr4: number;
  shot8: number;
  xg8: number;
  goal8: number;
  /** 가담 수별 WIN 초 안 상대 슈팅 [0,1,2,3+] */
  shotByP: number[];
  /** 4초 안 상대 침투 패스를 받은 에피소드 · WIN 초 안 상대 오프사이드 */
  thrRecv: number;
  off8: number;
  /** 받은 침투 패스: 받는 순간 우리 골 거리 합 · 그 뒤(WIN 초 창 안) 슈팅 · 받는 순간 가장 가까운 우리 필드 선수 거리 합 */
  thrRecvD: number;
  thrShot: number;
  thrRecvNear: number;
}

/** 2선 추적 배정 (trackIdx) 시점 분해 — 배정한 팀 기준 */
export interface TransAssign {
  n: number;
  /** 배정 순간 침투자가 이미 달리고 있었음(≥ 4 m/s) · 그때 추적자는 서 있었음(< 2 m/s) */
  runnerRunning: number;
  standOnRunning: number;
  /** 달리기 시작 → 배정 지연 합(달리고 있던 경우) */
  delay: number;
  /** 배정 순간 거리 합 */
  d0: number;
  /** 닿을 수 없음: 추적자 도착 시간(침투자 목표점) > 침투자 도착 + 0.5초 */
  unreachable: number;
  /** 2초 뒤 거리 합(배정 유지 중일 때) · 표본 */
  d2: number;
  n2: number;
}

export interface TransOut {
  team: [TransTeam, TransTeam];
  assign: [TransAssign, TransAssign];
}

const OFFS = [0, 2, 4];
const pb = (k: number) => Math.min(3, k);

function emptyTeam(): TransTeam {
  return {
    n: 0, pressers: 0, byP: [0, 0, 0, 0], ahead: 0, behind: 0, line: [0, 0, 0], space: [0, 0, 0], spaceByP: [0, 0, 0, 0],
    beaten: 0, beatT: 0, recov: 0, thr4: 0, shot8: 0, xg8: 0, goal8: 0, shotByP: [0, 0, 0, 0], thrRecv: 0, off8: 0, thrRecvD: 0, thrShot: 0, thrRecvNear: 0,
  };
}
function emptyAssign(): TransAssign {
  return { n: 0, runnerRunning: 0, standOnRunning: 0, delay: 0, d0: 0, unreachable: 0, d2: 0, n2: 0 };
}

interface Ep {
  team: 0 | 1;
  t0: number;
  p: number;
  presser: number[];
  done: boolean[];
  thr: boolean;
  thrTo: number;
  thrGot: boolean;
  off: boolean;
  shot: boolean;
  goal: boolean;
  beatAt: number;
  recovered: boolean;
}

/** 경기를 끝까지 돌리며 전환을 잰다 (sim.runToEnd 대신 부른다) */
export function transRun(sim: MatchSim): TransOut {
  const s = sim.state;
  const out: TransOut = { team: [emptyTeam(), emptyTeam()], assign: [emptyAssign(), emptyAssign()] };
  const eps: Ep[] = [];
  let prevPoss = s.possTeam;
  const shotsPrev = [s.teams[0].stats.shots, s.teams[1].stats.shots];
  const goalsPrev = [s.teams[0].stats.goals, s.teams[1].stats.goals];
  let thrPrev = -1;
  let evN = s.events.length;
  // 달리기 시작 시각 (속도 4 m/s 넘은 순간, 아래로 떨어지면 지움)
  const runStart = new Map<number, number>();
  const trackPrev = new Map<number, number>();
  const pending: { team: 0 | 1; a: number; r: number; at: number }[] = [];
  const oldShot = probe.shot;
  probe.shot = (st, p) => {
    // 그 팀이 공을 빼앗은 직후의 슈팅이면 마지막 에피소드에 xG
    for (let i = eps.length - 1; i >= 0; i--) {
      const ep = eps[i]!;
      if (ep.team !== p.team && st.t - ep.t0 <= TRANS_WIN) {
        out.team[ep.team].xg8 += p.xg ?? 0;
        break;
      }
    }
  };
  try {
    while (!s.done) {
      sim.step();
      const t = s.t;
      for (const a of s.agents) {
        const sp = Math.hypot(a.vx, a.vy);
        if (sp >= 4) { if (!runStart.has(a.idx)) runStart.set(a.idx, t); } else runStart.delete(a.idx);
      }
      const fl = s.ball.flight;
      const thr = fl && fl.through ? fl.receiver : -1;
      const newOff: number[] = [];
      for (; evN < s.events.length; evN++) if (s.events[evN]!.type === 'offside') newOff.push(s.events[evN]!.team);
      if (s.possTeam !== prevPoss) {
        if (!s.restart && s.possOrigin === 'open') {
          const loser = prevPoss as 0 | 1;
          const tm = s.teams[loser];
          const p = s.t < tm.counterUntil ? tm.counterPressers.length : 0;
          const T = out.team[loser];
          T.n++;
          T.pressers += p;
          T.byP[pb(p)]!++;
          const dir = attackDir(loser, s.half);
          const [bnx] = toNorm(s.ball.x, s.ball.y, dir);
          for (const a of s.agents) {
            if (!a.onPitch || a.team !== loser || a.line === 0) continue;
            if (toNorm(a.x, a.y, dir)[0] > bnx + 0.02) T.ahead++;
            else T.behind++;
          }
          eps.push({ team: loser, t0: t, p, presser: [...tm.counterPressers], done: OFFS.map(() => false), thr: false, thrTo: -1, thrGot: false, off: false, shot: false, goal: false, beatAt: -1, recovered: false });
        }
        prevPoss = s.possTeam;
      }
      for (const ep of eps) {
        const dt = t - ep.t0;
        if (dt > TRANS_WIN + 0.5) continue;
        const opp = (1 - ep.team) as 0 | 1;
        const T = out.team[ep.team];
        const dir = attackDir(ep.team, s.half);
        const [gx, gy] = ownGoal(dir);
        OFFS.forEach((o, k) => {
          if (ep.done[k] || dt < o - 1e-9) return;
          ep.done[k] = true;
          let sum = 0;
          let n = 0;
          for (const a of s.agents) if (a.onPitch && a.team === ep.team && a.line === 1) { sum += dist(a.x, a.y, gx, gy); n++; }
          T.line[k]! += n ? sum / n : 0;
          const sp = (1 - offsideLine(s, opp)) * L;
          T.space[k]! += sp;
          if (k === 1) T.spaceByP[pb(ep.p)]! += sp;
        });
        // 역압박 뚫림: 상대 소유자가 가담자 모두보다 2 m 이상 우리 골 쪽
        const owner = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
        if (ep.p > 0 && ep.beatAt < 0 && dt <= 4 && owner && owner.team === opp) {
          const ox = toNorm(owner.x, owner.y, dir)[0] * L;
          if (ep.presser.every((i) => toNorm(s.agents[i]!.x, s.agents[i]!.y, dir)[0] * L > ox + 2)) {
            ep.beatAt = t;
            T.beaten++;
            T.beatT += dt;
          }
        }
        if (ep.beatAt >= 0 && !ep.recovered) {
          const bx = toNorm(s.ball.x, s.ball.y, dir)[0] * L;
          const back = ep.presser.every((i) => toNorm(s.agents[i]!.x, s.agents[i]!.y, dir)[0] * L <= bx);
          if (back || t - ep.beatAt >= 8) {
            ep.recovered = true;
            T.recov += Math.min(8, t - ep.beatAt);
          }
        }
        if (dt <= 4 && thr >= 0 && thr !== thrPrev && s.agents[thr]!.team === opp && !ep.thr) { ep.thr = true; ep.thrTo = thr; T.thr4++; }
        if (ep.thr && !ep.thrGot && dt <= 6 && s.ball.owner === ep.thrTo) {
          ep.thrGot = true;
          T.thrRecv++;
          const r = s.agents[ep.thrTo]!;
          T.thrRecvD += dist(r.x, r.y, gx, gy);
          let nd = 60;
          for (const a of s.agents) if (a.onPitch && a.team === ep.team && a.line !== 0) nd = Math.min(nd, dist(a.x, a.y, r.x, r.y));
          T.thrRecvNear += nd;
        }
        if (dt <= TRANS_WIN && !ep.off && newOff.includes(opp)) { ep.off = true; T.off8++; }
        if (dt <= TRANS_WIN && !ep.shot && s.teams[opp].stats.shots > shotsPrev[opp]!) { ep.shot = true; T.shot8++; T.shotByP[pb(ep.p)]!++; if (ep.thrGot) T.thrShot++; }
        if (dt <= TRANS_WIN && !ep.goal && s.teams[opp].stats.goals > goalsPrev[opp]!) { ep.goal = true; T.goal8++; }
      }
      thrPrev = thr;
      for (const k of [0, 1] as const) { shotsPrev[k] = s.teams[k].stats.shots; goalsPrev[k] = s.teams[k].stats.goals; }
      while (eps.length && t - eps[0]!.t0 > TRANS_WIN + 1) {
        const ep = eps.shift()!;
        if (ep.beatAt >= 0 && !ep.recovered) out.team[ep.team].recov += Math.min(8, t - ep.beatAt);
      }
      // ⒝ 추적 배정 시점
      for (const a of s.agents) {
        if (!a.onPitch || a.line !== 2) continue;
        const prev = trackPrev.get(a.idx) ?? -1;
        if (a.trackIdx >= 0 && a.trackIdx !== prev) {
          const r = s.agents[a.trackIdx]!;
          const A = out.assign[a.team];
          A.n++;
          const rs = Math.hypot(r.vx, r.vy);
          const as = Math.hypot(a.vx, a.vy);
          A.d0 += dist(a.x, a.y, r.x, r.y);
          if (rs >= 4) {
            A.runnerRunning++;
            if (as < 2) A.standOnRunning++;
            A.delay += t - (runStart.get(r.idx) ?? t);
          }
          // 침투자 목표점(목표가 1 m 넘게 떨어져 있으면 목표, 아니면 지금 속도로 1초 뒤 자리)
          const far = dist(r.tx, r.ty, r.x, r.y) > 1;
          const px = far ? r.tx : r.x + r.vx;
          const py = far ? r.ty : r.y + r.vy;
          if (arrivalTime(a, px, py, 1) > arrivalTime(r, px, py) + 0.5) A.unreachable++;
          pending.push({ team: a.team, a: a.idx, r: r.idx, at: t });
        }
        trackPrev.set(a.idx, a.trackIdx);
      }
      while (pending.length && t - pending[0]!.at >= 2) {
        const q = pending.shift()!;
        const a = s.agents[q.a]!;
        if (a.trackIdx === q.r) {
          const r = s.agents[q.r]!;
          out.assign[q.team].d2 += dist(a.x, a.y, r.x, r.y);
          out.assign[q.team].n2++;
        }
      }
    }
  } finally {
    probe.shot = oldShot;
  }
  return out;
}
