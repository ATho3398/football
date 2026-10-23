// 게겐 상성 분해 (C.78c 1번): 팀마다 ⒜ 공을 뺏는 위치(자기 공격 방향 높이 4칸)·뺏은 뒤 10초 슈팅·15초 골 ⒝ 압박받을 때(자기 진영 절반, 5 m 안 상대) 결정 종류·
// 롱볼(30 m+)·GK 롱킥의 착지 높이·높은 라인 뒤 착지·유지 여부 ⒞ 뺏은 뒤 15초 슈팅·높은 라인 뒤 패스 시도/성공 ⒟ 골 출처(세트피스·높은 탈취·역습·지공).
// MatchJob.gegen 이 켜지면 job.ts 가 경기를 한 틱씩 돌리며 부른다. 엔진 상태는 읽기만 한다(probe.decide 훅만 씀, 지문 불변).

import { attackDir, dist, toNorm } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';
import type { Flight, SimState } from '../../src/engine/state';

export interface GegenTeam {
  /** 오픈 플레이 탈취 수 · 높이 4칸(0~1/3, 1/3~1/2, 1/2~2/3, 2/3~1)별 수 · 10초 안 슈팅 · 15초 안 골 */
  wins: number;
  winZ: number[];
  shot10Z: number[];
  goal15Z: number[];
  /** 탈취 뒤 15초 안 슈팅이 있었던 탈취 수 · 15초 안 높은 라인 뒤 패스 시도 · 받음 */
  shot15: number;
  behindTry: number;
  behindOk: number;
  /** 상대 소유 틱 · 그중 공이 상대 진영 1/3(우리 공격 방향 2/3+)인 틱 · 그 틱의 공 10 m 안 우리 필드 선수 수 합 */
  oppTicks: number;
  oppDeepTicks: number;
  pressNear: number;
  /** 압박받는 결정(자기 진영 절반·5 m 안 상대) 수 · 짧은 패스 · 롱패스(30 m+) · 걷어내기 · 몰기/드리블 · 유지/기타 · 슛 */
  pDec: number;
  pShort: number;
  pLong: number;
  pClear: number;
  pCarry: number;
  pHold: number;
  /** GK 결정(오픈 플레이) 수 · 30 m+ */
  gkDec: number;
  gkLong: number;
  /** 자기 진영 절반에서 찬 30 m+ 패스·걷어내기 수 · 착지 높이 합 · 상대 라인(둘째 수비수) 뒤 착지 · 3초 안 우리 소유 · 그중 공격 줄 받음 · 라인 뒤 착지가 유지된 수 */
  lb: number;
  lbNx: number;
  lbBehind: number;
  lbKeep: number;
  lbFwd: number;
  lbBehindKeep: number;
  /** 골 출처: 세트피스 · 상대 진영 탈취 뒤 15초 · 우리 진영 탈취 뒤 15초 · 15초 넘는 지공 */
  gSet: number;
  gHigh: number;
  gCounter: number;
  gSlow: number;
  /** 높은 탈취(⅔+)의 출처: 우리 역압박 창 안 · 잃은 팀 마지막 결정 종류별 수(짧은·롱·걷기·몰기/드리블·유지·없음) · 잃은 팀 소유 시간 합 */
  hiH: number;
  hiBy: number[];
  hiPossT: number;
  /** 압박받는 결정의 판단 p 합 · 성공(같은 팀 다음 결정) 수 — [짧은, 롱, 걷기, 몰기, 유지] */
  pP: number[];
  pOk: number[];
  pN: number[];
}

export interface GegenOut {
  team: [GegenTeam, GegenTeam];
}

function empty(): GegenTeam {
  return {
    wins: 0, winZ: [0, 0, 0, 0], shot10Z: [0, 0, 0, 0], goal15Z: [0, 0, 0, 0], shot15: 0, behindTry: 0, behindOk: 0,
    oppTicks: 0, oppDeepTicks: 0, pressNear: 0, pDec: 0, pShort: 0, pLong: 0, pClear: 0, pCarry: 0, pHold: 0, gkDec: 0, gkLong: 0,
    lb: 0, lbNx: 0, lbBehind: 0, lbKeep: 0, lbFwd: 0, lbBehindKeep: 0, gSet: 0, gHigh: 0, gCounter: 0, gSlow: 0,
    hiH: 0, hiBy: [0, 0, 0, 0, 0, 0], hiPossT: 0, pP: [0, 0, 0, 0, 0], pOk: [0, 0, 0, 0, 0], pN: [0, 0, 0, 0, 0],
  };
}

const zone = (nx: number) => (nx < 1 / 3 ? 0 : nx < 0.5 ? 1 : nx < 2 / 3 ? 2 : 3);

/** 상대 둘째 수비수(GK 포함) 높이 — team 공격 방향 정규화 */
function oppLine(s: SimState, team: 0 | 1): number {
  const dir = attackDir(team, s.half);
  let first = 0;
  let second = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team) continue;
    const nx = toNorm(o.x, o.y, dir)[0];
    if (nx > first) { second = first; first = nx; } else if (nx > second) second = nx;
  }
  return second;
}

export function gegenRun(sim: MatchSim): GegenOut {
  const s = sim.state;
  const out: GegenOut = { team: [empty(), empty()] };
  /** 팀별 마지막 오픈 플레이 탈취 (시각·높이칸·10초 슛 셈 여부·15초 슛 셈 여부) */
  const lastWin: ({ t: number; z: number; shot10: boolean; shot15: boolean } | null)[] = [null, null];
  let prevPoss = s.possTeam;
  const shotsPrev = [s.teams[0].stats.shots, s.teams[1].stats.shots];
  const goalsPrev = [s.teams[0].stats.goals, s.teams[1].stats.goals];
  let curFl: Flight | null = null;
  let flInfo: { team: 0 | 1; long: boolean; nx: number; behind: boolean; behindPass: boolean } | null = null;
  let landed: { team: 0 | 1; t: number; behind: boolean; behindPass: boolean; long: boolean } | null = null;
  const kindOf = (c: { type: string; receiver: number; x: number; y: number }, ax: number, ay: number) =>
    c.type === 'clear' ? 2 : c.receiver >= 0 ? (dist(ax, ay, c.x, c.y) >= 30 ? 1 : 0) : c.type === 'carry' || c.type === 'dribble' ? 3 : 4;
  /** 팀별 마지막 결정 (종류·시각) · 압박받는 결정 대기 (종류, 판단 p) */
  const lastDec: ({ k: number; t: number } | null)[] = [null, null];
  let pend: { team: 0 | 1; k: number } | null = null;
  const possStart = [0, 0];
  const oldDecide = probe.decide;
  probe.decide = (st, p) => {
    const a = p.a;
    const c = p.chosen;
    if (pend && pend.team === a.team) { out.team[a.team].pOk[pend.k]!++; pend = null; }
    if (c.type !== 'shoot') lastDec[a.team] = { k: kindOf(c, a.x, a.y), t: st.t };
    if (st.possOrigin !== 'open' && st.restart) return;
    const T = out.team[a.team];
    if (a.line === 0) {
      T.gkDec++;
      if (c.receiver >= 0 || c.type === 'clear') if (dist(a.x, a.y, c.x, c.y) >= 30) T.gkLong++;
      return;
    }
    const dir = attackDir(a.team, st.half);
    if (toNorm(a.x, a.y, dir)[0] >= 0.5) return;
    let near = 99;
    for (const o of st.agents) if (o.onPitch && o.team !== a.team) near = Math.min(near, dist(o.x, o.y, a.x, a.y));
    if (near > 5) return;
    T.pDec++;
    if (c.type === 'shoot') return;
    {
      const k = kindOf(c, a.x, a.y);
      T.pN[k]!++;
      T.pP[k]! += c.p;
      pend = { team: a.team, k };
    }
    if (c.type === 'clear') T.pClear++;
    else if (c.receiver >= 0) { if (dist(a.x, a.y, c.x, c.y) >= 30) T.pLong++; else T.pShort++; }
    else if (c.type === 'carry' || c.type === 'dribble') T.pCarry++;
    else T.pHold++;
  };
  try {
    while (!s.done) {
      const prevOrigin = s.possOrigin;
      sim.step();
      const t = s.t;
      const b = s.ball;
      // 비행 시작: 자기 진영 절반에서 찬 30 m+ (롱볼·GK 롱킥·걷어내기) · 높은 라인 뒤로 가는 패스 (탈취 뒤 15초)
      if (b.flight && b.flight !== curFl) {
        curFl = b.flight;
        const fl = b.flight;
        flInfo = null;
        if (fl.kind !== 'shot' && fl.kind !== 'cross' && fl.passer >= 0) {
          const pa = s.agents[fl.passer]!;
          const team = pa.team;
          const dir = attackDir(team, s.half);
          const fx = toNorm(fl.fromX, fl.fromY, dir)[0];
          const tx = toNorm(fl.toX, fl.toY, dir)[0];
          const line = oppLine(s, team);
          const behind = tx > line && tx > 0.5;
          const long = fx < 0.5 && dist(fl.fromX, fl.fromY, fl.toX, fl.toY) >= 30;
          const lw = lastWin[team];
          const behindPass = behind && fx < line && !!lw && t - lw.t <= 15 && fl.kind !== 'clear';
          if (behindPass) out.team[team].behindTry++;
          if (long) {
            const T = out.team[team];
            T.lb++;
            T.lbNx += tx;
            if (behind) T.lbBehind++;
          }
          flInfo = { team, long, nx: tx, behind, behindPass };
        }
      } else if (!b.flight && curFl) {
        curFl = null;
        if (flInfo && (flInfo.long || flInfo.behindPass)) landed = { team: flInfo.team, t, behind: flInfo.behind, behindPass: flInfo.behindPass, long: flInfo.long };
        flInfo = null;
      }
      // 착지 뒤 3초 안 첫 소유
      if (landed && b.owner >= 0) {
        const o = s.agents[b.owner]!;
        if (o.team === landed.team) {
          const T = out.team[landed.team];
          if (landed.long) {
            T.lbKeep++;
            if (o.line === 3) T.lbFwd++;
            if (landed.behind) T.lbBehindKeep++;
          }
          if (landed.behindPass) T.behindOk++;
        }
        landed = null;
      } else if (landed && (t - landed.t > 3 || s.restart)) landed = null;
      // 탈취
      if (s.possTeam !== prevPoss && !s.restart && s.possOrigin === 'open' && (s.possTeam === 0 || s.possTeam === 1)) {
        const win = s.possTeam as 0 | 1;
        const dir = attackDir(win, s.half);
        const z = zone(toNorm(b.x, b.y, dir)[0]);
        const T = out.team[win];
        T.wins++;
        T.winZ[z]!++;
        const pd = pend as { team: 0 | 1; k: number } | null;
        if (pd && pd.team !== win) pend = null;
        if (z === 3) {
          if (t - 0.2 < s.teams[win].counterUntil && s.teams[win].counterPressers.length) T.hiH++;
          const ld = lastDec[1 - win];
          T.hiBy[ld && t - ld.t <= 4 ? ld.k : 5]!++;
          T.hiPossT += t - possStart[1 - win]!;
        }
        possStart[win] = t;
        lastWin[win] = { t, z, shot10: false, shot15: false };
      }
      if (s.possTeam !== prevPoss && s.restart) possStart[s.possTeam] = t;
      prevPoss = s.possTeam;
      // 상대 소유 틱의 압박 기회
      if (b.owner >= 0) {
        const own = s.agents[b.owner]!.team;
        const pr = (1 - own) as 0 | 1;
        const T = out.team[pr];
        T.oppTicks++;
        const nx = toNorm(b.x, b.y, attackDir(pr, s.half))[0];
        if (nx >= 2 / 3) {
          T.oppDeepTicks++;
          for (const a of s.agents) if (a.onPitch && a.team === pr && a.line !== 0 && dist(a.x, a.y, b.x, b.y) <= 10) T.pressNear++;
        }
      }
      for (const k of [0, 1] as const) {
        const T = out.team[k];
        const lw = lastWin[k];
        if (s.teams[k].stats.shots > shotsPrev[k]!) {
          if (lw && !lw.shot10 && t - lw.t <= 10) { lw.shot10 = true; T.shot10Z[lw.z]!++; }
          if (lw && !lw.shot15 && t - lw.t <= 15) { lw.shot15 = true; T.shot15++; }
          shotsPrev[k] = s.teams[k].stats.shots;
        }
        if (s.teams[k].stats.goals > goalsPrev[k]!) {
          goalsPrev[k] = s.teams[k].stats.goals;
          if (prevOrigin !== 'open') T.gSet++;
          else if (lw && t - lw.t <= 15) {
            T.goal15Z[lw.z]!++;
            if (lw.z >= 2) T.gHigh++; else T.gCounter++;
          } else T.gSlow++;
        }
      }
    }
  } finally {
    probe.decide = oldDecide;
  }
  return out;
}
