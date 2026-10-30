// 진단 탐침 (엔진관리자21, c79w): 게겐 대 티키 칸 기제 분해 — 소유 길이·상실 위치·탈취 위치·탈취 뒤 8초 슛/xG·역압박 성공·
// 압박(3 m 안 상대) 속 짧은 패스의 성공과 "압박을 푸는지"(받은 선수가 자유로운가)·판단 선택 구성. 엔진 상태를 바꾸지 않는다(읽기만).
import { attackDir, dist, L } from '../../src/engine/pitch';
import { pressureAt } from '../../src/engine/onball';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';
import type { Flight } from '../../src/engine/state';

export interface C79wOut {
  /** 오픈 플레이 소유: 횟수 · 시간 합(초) · 10초+ 수 · 패스 수 합 · 끝 = 상실(자기 ⅓ · 중간 · 상대 ⅓) · 슛 · 기타(아웃·파울 등) */
  poss: number; possT: number; poss10: number; possPass: number; endLoss: [number, number, number]; endShot: number; endOther: number;
  /** 오픈 플레이 탈취: 자기 ⅓ · 중간 · 상대 ⅓ (탈취 팀 기준 정규화 x) · 탈취 뒤 8초 안 슛 수 · xG 합 · 골 · 상대 ⅓ 탈취 뒤 8초 슛 수 · 상대 ⅓ 탈취 뒤 8초 xG */
  win: [number, number, number]; win8Shots: number; win8Xg: number; win8Goals: number; winOpp8Shots: number; winOpp8Xg: number;
  /** 우리가 잃은 뒤(오픈): 상실 수 · 역압박 가담 있음 · counterUntil 안 되찾음 · 6초 안 · 10초 안 · 뚫림(brokeAt) · 10초 안 되찾기 시간 합 */
  loss: number; cpOn: number; cpWin: number; re6: number; re10: number; broke: number; reT: number;
  /** 패스(크로스·슛 제외): 인덱스 ((거리칸 0=<10 m · 1=10~25 · 2=25+) × 2 + 상대 역압박 창 0/1) × 2 + 패서 압박 0/1, 칸마다 [시도, 받음, 받은 뒤 수신자 자유(압박 0), 수신자 압박 합] */
  pass: number[];
  /** 전환 창(우리 오픈 탈취 뒤 6초 안) 패스: 수 · <10 m 수 · 받음 */
  winPass: [number, number, number];
  /** 상대 역압박 창 안 우리 패스 가로채임 · 그중 가담자가 가로챔 */
  cpInt: number; cpIntPresser: number;
  /** 판단(오픈 플레이 필드 선수): 결정 수 · <10 m 패스 선택 · 압박 속 결정 · 압박 속 <10 m 패스 · 압박 속 유지 · 압박 속 25 m+ · 압박 속 몰기/드리블 */
  dec: number; decShort: number; decP: number; decPShort: number; decPHold: number; decPLong: number; decPCarry: number;
  /** 상대 역압박 창 안 결정: 수 · <10 m 패스 · 유지 · 25 m+ · 몰기 · 선택 p 합 · 선택 효용−2위 효용 합(gap) */
  decCp: number; decCpShort: number; decCpHold: number; decCpLong: number; decCpCarry: number; decCpP: number;
}

const empty = (): C79wOut => ({
  poss: 0, possT: 0, poss10: 0, possPass: 0, endLoss: [0, 0, 0], endShot: 0, endOther: 0,
  win: [0, 0, 0], win8Shots: 0, win8Xg: 0, win8Goals: 0, winOpp8Shots: 0, winOpp8Xg: 0,
  loss: 0, cpOn: 0, cpWin: 0, re6: 0, re10: 0, broke: 0, reT: 0,
  pass: new Array(3 * 2 * 2 * 4).fill(0) as number[],
  winPass: [0, 0, 0], cpInt: 0, cpIntPresser: 0,
  dec: 0, decShort: 0, decP: 0, decPShort: 0, decPHold: 0, decPLong: 0, decPCarry: 0,
  decCp: 0, decCpShort: 0, decCpHold: 0, decCpLong: 0, decCpCarry: 0, decCpP: 0,
});

export function c79wAdd(a: C79wOut, b: C79wOut): void {
  for (const k of Object.keys(a) as (keyof C79wOut)[]) {
    const x = a[k] as unknown, y = b[k] as unknown;
    if (typeof x === 'number') (a as unknown as Record<string, number>)[k] = x + (y as number);
    else { const xs = x as number[], ys = y as number[]; for (let i = 0; i < xs.length; i++) xs[i] = (xs[i] ?? 0) + (ys[i] ?? 0); }
  }
}

export const C79W_PI = (dk: number, cp: number, pr: number) => ((dk * 2 + cp) * 2 + pr) * 4;

/** 경기를 끝까지 돌리며(순간은 위임) 팀별 기제 지표를 모은다 */
export function c79wRun(sim: MatchSim): C79wOut[] {
  const s = sim.state;
  const out = [empty(), empty()];
  const oppCp = (team: 0 | 1) => { const o = s.teams[team === 0 ? 1 : 0]; return s.t < o.counterUntil && o.counterPressers.length > 0; };
  let prevPoss = s.possTeam, prevOrigin = s.possOrigin, prevStart = s.possStartT;
  let spellPass = 0;
  let lastShotT = -99; // 마지막 슛 시각 (소유 끝 분류용)
  const pendLoss: ({ t: number; until: number; broke: boolean; done: boolean } | null)[] = [null, null];
  const lastWinZone: number[] = [-1, -1];
  let evI = s.events.length;
  let curFl: Flight | null = null;
  const pending: { fl: Flight; team: 0 | 1; dk: number; cp: number; pr: number; win: boolean }[] = [];
  const flush = (cur: Flight | null) => {
    for (let i = pending.length - 1; i >= 0; i--) {
      const q = pending[i]!;
      if (q.fl === cur) continue;
      const T = out[q.team]!;
      const pi = C79W_PI(q.dk, q.cp, q.pr);
      const recv = q.fl.outcome === 'receive' && q.fl.receiver >= 0;
      T.pass[pi]!++;
      if (recv) {
        T.pass[pi + 1]!++;
        const r = s.agents[q.fl.receiver]!;
        const p1 = pressureAt(s, r);
        if (p1 <= 0) T.pass[pi + 2]!++;
        T.pass[pi + 3]! += p1;
        if (q.win) T.winPass[2]++;
      } else if (q.fl.outcome === 'intercept' && q.cp) {
        T.cpInt++;
        const o = s.teams[q.team === 0 ? 1 : 0];
        if (q.fl.interceptor >= 0 && o.counterPressers.includes(q.fl.interceptor)) T.cpIntPresser++;
      }
      pending.splice(i, 1);
    }
  };
  const oldDecide = probe.decide;
  probe.decide = (st, p) => {
    oldDecide?.(st, p);
    const a = p.a;
    if (a.line === 0 || st.possOrigin !== 'open' || st.restart) return;
    const T = out[a.team]!;
    const c = p.chosen;
    const isPass = c.receiver >= 0 && c.type !== 'cross';
    const d = isPass ? dist(a.x, a.y, c.x, c.y) : 0;
    const short = isPass && d < 10, long = isPass && d >= 25;
    const hold = c.type === 'hold', carry = c.type === 'carry' || c.type === 'dribble';
    T.dec++;
    if (short) T.decShort++;
    if (pressureAt(st, a) > 0) {
      T.decP++;
      if (short) T.decPShort++;
      if (hold) T.decPHold++;
      if (long) T.decPLong++;
      if (carry) T.decPCarry++;
    }
    if (oppCp(a.team)) {
      T.decCp++;
      if (short) T.decCpShort++;
      if (hold) T.decCpHold++;
      if (long) T.decCpLong++;
      if (carry) T.decCpCarry++;
      T.decCpP += c.p;
    }
  };
  try {
    while (!s.done) {
      if (s.moments.pending) sim.resolve('delegate');
      else sim.step();
      const t = s.t;
      // 이벤트: 슛(xG)·골 → 탈취 뒤 8초
      for (; evI < s.events.length; evI++) {
        const e = s.events[evI]!;
        if (e.type === 'shot' || e.type === 'goal') {
          const tm = s.teams[e.team];
          if (e.type === 'shot') lastShotT = e.t;
          if (s.possOrigin === 'open' && e.t - tm.wonAt <= 8 && tm.wonAt >= 0) {
            const T = out[e.team]!;
            if (e.type === 'goal') T.win8Goals++;
            else {
              const xg = Number(e.params?.xg ?? 0);
              T.win8Shots++; T.win8Xg += xg;
              if (lastWinZone[e.team] === 2) { T.winOpp8Shots++; T.winOpp8Xg += xg; }
            }
          }
        }
      }
      // 소유 변화
      if (s.possTeam !== prevPoss || s.possStartT !== prevStart) {
        if (prevOrigin === 'open') {
          const T = out[prevPoss]!;
          const len = t - prevStart;
          T.poss++; T.possT += len; if (len >= 10) T.poss10++; T.possPass += spellPass;
          if (s.possOrigin === 'open' && s.possTeam !== prevPoss) {
            const nx = attackDir(prevPoss, s.half) > 0 ? s.ball.x / L : 1 - s.ball.x / L;
            T.endLoss[nx < 1 / 3 ? 0 : nx < 2 / 3 ? 1 : 2]++;
          } else if (t - lastShotT <= 1.5) T.endShot++;
          else T.endOther++;
        }
        spellPass = 0;
        if (s.possOrigin === 'open' && s.possTeam !== prevPoss) {
          const w = s.possTeam, l = prevPoss;
          const nx = attackDir(w, s.half) > 0 ? s.ball.x / L : 1 - s.ball.x / L;
          const z = nx < 1 / 3 ? 0 : nx < 2 / 3 ? 1 : 2;
          out[w]!.win[z]++; lastWinZone[w] = z;
          // 잃은 팀의 역압박 추적 (prevOrigin 이 open 이 아니어도 상실은 상실 — turnover(open) 는 오픈 플레이 상실에만 불리므로 같은 조건으로)
          if (prevOrigin === 'open') {
            const tmL = s.teams[l];
            const T = out[l]!;
            T.loss++;
            const on = tmL.counterPressers.length > 0;
            if (on) T.cpOn++;
            pendLoss[l] = { t, until: on ? tmL.counterUntil : t, broke: false, done: false };
          }
          // 되찾은 쪽: 대기 중이면 닫는다
          const pw = pendLoss[w];
          if (pw && !pw.done) {
            const dt = t - pw.t;
            const T = out[w]!;
            if (dt <= 10) { T.re10++; T.reT += dt; if (dt <= 6) T.re6++; if (t <= pw.until) T.cpWin++; }
            pw.done = true;
          }
        }
        prevPoss = s.possTeam; prevOrigin = s.possOrigin; prevStart = s.possStartT;
      }
      for (const team of [0, 1] as const) {
        const pl = pendLoss[team];
        if (pl && !pl.done) {
          if (!pl.broke && s.teams[team].brokeAt >= pl.t) { pl.broke = true; out[team]!.broke++; }
          if (t - pl.t > 10) pl.done = true;
        }
      }
      // 비행
      const fl = s.ball.flight;
      flush(fl);
      if (fl && fl !== curFl) {
        curFl = fl;
        if (fl.kind !== 'shot' && fl.kind !== 'cross' && fl.kind !== 'clear' && fl.passer >= 0 && !fl.fromCross && s.possOrigin === 'open') {
          const pa = s.agents[fl.passer]!;
          const team = pa.team;
          const d = fl.aimD ?? dist(fl.fromX, fl.fromY, fl.toX, fl.toY);
          const dk = d < 10 ? 0 : d < 25 ? 1 : 2;
          const cp = oppCp(team) ? 1 : 0;
          const pr = pressureAt(s, pa) > 0 ? 1 : 0;
          const win = t - s.teams[team].wonAt <= 6;
          if (win) { out[team]!.winPass[0]++; if (dk === 0) out[team]!.winPass[1]++; }
          spellPass++;
          pending.push({ fl, team, dk, cp, pr, win });
        }
      } else if (!fl) curFl = null;
    }
    flush(null);
  } finally {
    probe.decide = oldDecide;
  }
  return out;
}
