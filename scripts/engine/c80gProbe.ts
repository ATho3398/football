// 진단 탐침 (엔진관리자24, c80g): 20 m+ 패스 분해(땅볼/공중 · 받는 선수 능력치 · 받는 순간 수비 거리 · 어디로 · 성공/실패 원인) +
// 먼 수신 후보(소유자에서 20~35 m) 커버 표본(가장 가까운 수비 거리 분포, 그 수비의 줄·목표). 엔진 상태는 읽기만(probe.decide 훅만, 난수 안 부름, 지문 불변).
import { attackDir, dist, L, toNorm } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { MatchSim } from '../../src/engine/sim';
import type { Agent, Flight, SimState } from '../../src/engine/state';

/** 20 m+ 패스 1건 (숫자 배열, 인덱스는 PF) */
export const PF = {
  d: 0, air: 1, dir: 2, zone: 3, lane: 4,
  rcBall: 5, rcStr: 6, rcJump: 7, rcHead: 8, rcHeight: 9, rcPace: 10,
  defTgtKick: 11, defRcKick: 12, defRcArr: 13, outcome: 14, p: 15, pFlight: 16, rcLine: 17, passerPress: 18, through: 19,
  defLineArr: 20, defTgtGapArr: 21, rcAgility: 22, rcOtb: 23, passerLine: 24, dxFwd: 25, oneTouch: 26,
  N: 27,
} as const;
/** 결과: 0 의도 수신자 받음 · 1 다른 동료 받음 · 2 가로채임(비행 시작 때 판정) · 3 빗나감 뒤 우리 · 4 빗나감 뒤 상대 · 5 착지 경합 패(공중/박스 수신) · 6 정지(아웃·오프사이드·파울) · 7 3초 미확정 · 8 다음 비행으로 교체 */
export const OUT_NAMES = ['받음', '동료 받음', '가로채임', '빗나감→우리', '빗나감→상대', '착지 경합 패', '정지(아웃·오프사이드·파울)', '3초 미확정', '다음 비행으로 교체'];
/** 방향 0 뒤 · 1 옆 · 2 앞 */
export const DIR_NAMES = ['뒤', '옆', '앞'];
/** 착지 구역(공격 방향 정규화 x): 0 자기 진영 · 1 중원(0.5~0.67) · 2 최종 ⅓(0.67~0.84) · 3 박스 부근(0.84+) */
export const ZONE_NAMES = ['자기진영', '중원', '최종⅓ 밖', '박스 부근'];
/** 받는 자리 분류(상대 줄 기준): 0 상대 중원 줄 앞(빌드업 구역) · 1 줄 사이 중앙 · 2 측면(|y−0.5| > 0.3) · 3 상대 수비 줄 뒤 */
export const LANE_NAMES = ['중원 줄 앞', '줄 사이(중앙)', '측면', '수비 줄 뒤'];

/** 커버 표본 칸: 거리대 3(10~20 · 20~35 · 35+) × 자리 4(LANE) × 수비 거리 6칸(<3 · 3~5 · 5~8 · 8~12 · 12~18 · 18+) */
export const CV_DB = [3, 5, 8, 12, 18];
export const cvIdx = (band: number, lane: number, db: number) => (band * 4 + lane) * 6 + db;
/** 비커버(가장 가까운 수비 ≥ 8 m) 먼 후보(20~35 m)의 가장 가까운 수비: [줄 1 수, 줄 2 수, 줄 3 수, 그 수비 목표점–후보 거리 합, 그 수비–자기 목표점 거리 합, 수, 그 수비가 공에 더 가까운(공 쪽 임무) 수, 그 수비의 슬롯–후보 거리 합] */
export interface C80gOut {
  passes: number[][];
  /** 패스 거리 히스토그램 전체(오픈 플레이·크로스 제외): 0~5·5~10·10~15·15~20·20~25·25~30·30~35·35+ × [시도, 받음(의도 수신자 또는 동료)] */
  hist: number[];
  cover: number[];
  /** 커버 표본 수(소유 1초 표본) · 후보 수 합(거리대별 3) */
  cvSamples: number;
  cvCand: number[];
  uncov: number[];
  /** 수신 압박 표본(20~35 m 후보, 자리별 4): 가장 가까운 수비 거리 합 · 수 */
  cvNear: number[];
  /** 선발 필드 선수 10명 능력치 평균 합(경기 수로 나눔): [볼 컨트롤, 근력(+체격), 점프, 헤더, 키, 속도, 민첩, 공격 위치선정, 경기 수] */
  teamAttr: number[];
}

const empty = (): C80gOut => ({
  passes: [], hist: new Array(16).fill(0) as number[], cover: new Array(3 * 4 * 6).fill(0) as number[], cvSamples: 0, cvCand: [0, 0, 0],
  uncov: [0, 0, 0, 0, 0, 0, 0, 0], cvNear: new Array(8).fill(0) as number[], teamAttr: new Array(9).fill(0) as number[],
});

export function c80gAdd(a: C80gOut, b: C80gOut): void {
  for (const p of b.passes) a.passes.push(p);
  for (let i = 0; i < a.hist.length; i++) a.hist[i] = a.hist[i]! + b.hist[i]!;
  for (let i = 0; i < a.cover.length; i++) a.cover[i] = a.cover[i]! + b.cover[i]!;
  a.cvSamples += b.cvSamples;
  for (let i = 0; i < 3; i++) a.cvCand[i] = a.cvCand[i]! + b.cvCand[i]!;
  for (let i = 0; i < a.uncov.length; i++) a.uncov[i] = a.uncov[i]! + b.uncov[i]!;
  for (let i = 0; i < a.cvNear.length; i++) a.cvNear[i] = a.cvNear[i]! + b.cvNear[i]!;
  for (let i = 0; i < a.teamAttr.length; i++) a.teamAttr[i] = a.teamAttr[i]! + b.teamAttr[i]!;
}

function nearestOpp(s: SimState, team: 0 | 1, x: number, y: number): [Agent | null, number] {
  let best: Agent | null = null;
  let bd = Infinity;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team || o.line === 0) continue;
    const d = dist(o.x, o.y, x, y);
    if (d < bd) { bd = d; best = o; }
  }
  return [best, bd];
}

/** 상대 줄 1(수비)·줄 2(중원) 평균 x — team 공격 방향 정규화 */
function oppLines(s: SimState, team: 0 | 1): [number, number] {
  const dir = attackDir(team, s.half);
  let d = 0, dn = 0, m = 0, mn = 0;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === team) continue;
    const nx = toNorm(o.x, o.y, dir)[0];
    if (o.line === 1) { d += nx; dn++; } else if (o.line === 2) { m += nx; mn++; }
  }
  return [dn ? d / dn : 0.9, mn ? m / mn : 0.6];
}

function laneOf(nx: number, ny: number, lines: [number, number]): number {
  if (Math.abs(ny - 0.5) > 0.3) return 2;
  if (nx > lines[0]) return 3;
  if (nx > lines[1]) return 1;
  return 0;
}

const zoneOf = (nx: number) => (nx < 0.5 ? 0 : nx < 0.67 ? 1 : nx < 0.84 ? 2 : 3);

export function c80gRun(sim: MatchSim): [C80gOut, C80gOut] {
  const s = sim.state;
  const out: [C80gOut, C80gOut] = [empty(), empty()];
  for (const team of [0, 1] as const) {
    const xs = s.agents.filter((o) => o.onPitch && o.team === team && o.line !== 0);
    const T = out[team].teamAttr;
    for (const o of xs) {
      T[0]! += o.attrs.ballControl / xs.length; T[1]! += (o.attrs.strength + o.body.strength) / xs.length; T[2]! += o.attrs.jumping / xs.length; T[3]! += o.attrs.heading / xs.length;
      T[4]! += (o.spec.body?.height ?? 0) / xs.length; T[5]! += o.attrs.pace / xs.length; T[6]! += o.attrs.agility / xs.length; T[7]! += o.attrs.offTheBall / xs.length;
    }
    T[8] = 1;
  }
  let lastFl: Flight | null = null;
  /** 마지막 결정 (패서 idx → 선택 후보 p·pFlight·tick) */
  const lastDec = new Map<number, { p: number; pFlight: number; receiver: number; tick: number; ot: boolean }>();
  const oldDecide = probe.decide;
  probe.decide = (st, p) => {
    const c = p.chosen;
    if (c.receiver >= 0) lastDec.set(p.a.idx, { p: c.p, pFlight: c.pFlight ?? c.p, receiver: c.receiver, tick: st.tick, ot: !!c.ot });
    oldDecide?.(st, p);
  };
  type Pend = { rec: number[]; team: 0 | 1; passer: number; receiver: number; t0: number; fl: Flight; startOutcome: Flight['outcome']; d: number; tEnd: number; arrDone: boolean };
  let pend: Pend | null = null;
  const finish = (pd: Pend, outcome: number) => {
    pd.rec[PF.outcome] = outcome;
    const hb = Math.min(7, Math.floor(pd.d / 5));
    out[pd.team].hist[hb * 2]!++;
    if (outcome <= 1) out[pd.team].hist[hb * 2 + 1]!++;
    if (pd.d >= 20) out[pd.team].passes.push(pd.rec);
  };
  while (!s.done) {
    if (s.moments.pending) sim.resolve('delegate');
    else sim.step();
    const b = s.ball;
    const fl = b.flight;
    if (pend) {
      const pd = pend;
      // 도착 순간(비행 끝 틱): 수신자와 가장 가까운 수비 거리
      if (!pd.arrDone && (b.flight !== pd.fl || pd.fl.t0 + pd.fl.dur <= s.t)) {
        pd.arrDone = true;
        pd.tEnd = s.t;
        const rc = pd.receiver >= 0 ? s.agents[pd.receiver] : undefined;
        if (rc && rc.onPitch) {
          const [def, dd] = nearestOpp(s, pd.team, rc.x, rc.y);
          pd.rec[PF.defRcArr] = dd;
          if (def) {
            pd.rec[PF.defLineArr] = def.line;
            pd.rec[PF.defTgtGapArr] = dist(def.tx, def.ty, rc.x, rc.y);
          }
        }
      }
      if (pd.arrDone) {
        let done = -1;
        const who = b.owner >= 0 ? b.owner : b.reserve ? b.reserve.idx : -1;
        if (who >= 0) {
          const a = s.agents[who]!;
          if (a.team === pd.team) done = who === pd.receiver ? 0 : pd.startOutcome === 'loose' ? 3 : 1;
          else done = pd.startOutcome === 'intercept' ? 2 : pd.startOutcome === 'loose' ? 4 : 5;
        } else if (b.flight && b.flight !== pd.fl) {
          // 소유 없이 바로 찼다(원터치) — 찬 선수가 받은 셈
          const a = s.agents[b.flight.passer]!;
          if (a.team === pd.team) done = b.flight.passer === pd.receiver ? 0 : pd.startOutcome === 'loose' ? 3 : 1;
          else done = pd.startOutcome === 'intercept' ? 2 : pd.startOutcome === 'loose' ? 4 : 5;
        } else if (s.restart) done = 6;
        else if (s.t - pd.tEnd > 3) done = 7;
        if (done >= 0) { finish(pd, done); pend = null; }
      }
    }
    // 새 비행: 오픈 플레이 패스(크로스·슛 제외)
    if (fl && fl !== lastFl) {
      lastFl = fl;
      if ((fl.kind === 'pass' || fl.kind === 'long') && fl.passer >= 0 && !fl.fromCross && fl.aimD !== undefined && s.possOrigin === 'open' && !s.restart) {
        if (pend) finish(pend, 8);
        const passer = s.agents[fl.passer]!;
        const team = passer.team;
        const dir = attackDir(team, s.half);
        const rc = fl.receiver >= 0 ? s.agents[fl.receiver] : undefined;
        const d = fl.aimD;
        const rec = new Array(PF.N).fill(0) as number[];
        rec[PF.d] = d;
        rec[PF.air] = fl.air ? 1 : 0;
        // 노린 지점(실패 비행은 toX 가 바뀌므로 수신자 자리 + 리드로 어림: 성공 비행이면 toX 그대로)
        const tx = fl.outcome === 'receive' ? fl.toX : rc ? rc.x + rc.vx * 0.6 : fl.toX;
        const ty = fl.outcome === 'receive' ? fl.toY : rc ? rc.y + rc.vy * 0.6 : fl.toY;
        const [fnx] = toNorm(fl.fromX, fl.fromY, dir);
        const [tnx, tny] = toNorm(tx, ty, dir);
        const dx = (tnx - fnx) * L;
        rec[PF.dxFwd] = dx;
        rec[PF.dir] = dx > 5 ? 2 : dx < -5 ? 0 : 1;
        rec[PF.zone] = zoneOf(tnx);
        rec[PF.lane] = laneOf(tnx, tny, oppLines(s, team));
        rec[PF.passerLine] = passer.line;
        rec[PF.passerPress] = nearestOpp(s, team, passer.x, passer.y)[1];
        rec[PF.defTgtKick] = nearestOpp(s, team, tx, ty)[1];
        rec[PF.through] = fl.through ? 1 : 0;
        if (rc) {
          rec[PF.rcBall] = rc.attrs.ballControl;
          rec[PF.rcStr] = rc.attrs.strength + rc.body.strength;
          rec[PF.rcJump] = rc.attrs.jumping;
          rec[PF.rcHead] = rc.attrs.heading;
          rec[PF.rcHeight] = rc.spec.body?.height ?? 0;
          rec[PF.rcPace] = rc.attrs.pace;
          rec[PF.rcAgility] = rc.attrs.agility;
          rec[PF.rcOtb] = rc.attrs.offTheBall;
          rec[PF.rcLine] = rc.line;
          rec[PF.defRcKick] = nearestOpp(s, team, rc.x, rc.y)[1];
        }
        const dec = lastDec.get(fl.passer);
        if (dec && dec.receiver === fl.receiver && s.tick - dec.tick <= 2) { rec[PF.p] = dec.p; rec[PF.pFlight] = dec.pFlight; rec[PF.oneTouch] = dec.ot ? 1 : 0; } else { rec[PF.p] = -1; rec[PF.pFlight] = -1; }
        rec[PF.defRcArr] = -1;
        rec[PF.defLineArr] = -1;
        rec[PF.defTgtGapArr] = -1;
        pend = { rec, team, passer: fl.passer, receiver: fl.receiver, t0: fl.t0, fl, startOutcome: fl.outcome, d, tEnd: -1, arrDone: false };
      }
    }
    // 커버 표본 (1초마다, 오픈 플레이 · 필드 선수 소유 · 비행 없음)
    if (s.tick % 10 === 0 && !s.restart && b.owner >= 0 && !b.flight && s.possOrigin === 'open') {
      const owner = s.agents[b.owner]!;
      if (owner.line !== 0) {
        const team = owner.team;
        const T = out[team];
        T.cvSamples++;
        const dir = attackDir(team, s.half);
        const lines = oppLines(s, team);
        for (const r of s.agents) {
          if (!r.onPitch || r.team !== team || r === owner || r.line === 0) continue;
          const d0 = dist(r.x, r.y, owner.x, owner.y);
          if (d0 < 10) continue;
          const band = d0 < 20 ? 0 : d0 < 35 ? 1 : 2;
          T.cvCand[band]!++;
          const [rnx, rny] = toNorm(r.x, r.y, dir);
          const lane = laneOf(rnx, rny, lines);
          const [def, dd] = nearestOpp(s, team, r.x, r.y);
          let db = 0;
          while (db < 5 && dd >= CV_DB[db]!) db++;
          T.cover[cvIdx(band, lane, db)]!++;
          if (band === 1) {
            T.cvNear[lane * 2]! += Math.min(dd, 40);
            T.cvNear[lane * 2 + 1]!++;
            if (def && dd >= 8) {
              T.uncov[def.line - 1]!++;
              T.uncov[3]! += Math.min(40, dist(def.tx, def.ty, r.x, r.y));
              T.uncov[4]! += Math.min(40, dist(def.tx, def.ty, def.x, def.y));
              T.uncov[5]!++;
              if (dist(def.x, def.y, b.x, b.y) < dd) T.uncov[6]!++;
              const ddir = attackDir(def.team, s.half);
              const [sx, sy] = [def.sx, def.sy];
              // 슬롯 자리(정규화)를 경기장 좌표로: toNorm 의 역은 pitch 의 toPitch — 여기서는 x 만 정규화 비교
              const [dnx, dny] = toNorm(r.x, r.y, ddir);
              T.uncov[7]! += Math.min(40, Math.hypot((dnx - sx) * L, (dny - sy) * 68));
            }
          }
        }
      }
    }
  }
  if (pend) finish(pend, 6);
  probe.decide = oldDecide;
  return out;
}
