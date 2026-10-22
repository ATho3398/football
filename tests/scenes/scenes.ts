// 기준 장면 5개 (C.77w, 공통 규칙 로드맵 1단계). 각 함수는 지금 엔진 규칙으로 장면을 돌려 수치를 돌려준다 (목표 판정은 targets.ts).
// 팀 0 이 +x 로 공격(전반), 팀 1 골은 x = L.

import { ENGINE } from '../../src/engine/config';
import { keeperOf, saveProb, shotCover, farSide } from '../../src/engine/keeper';
import { keeperTarget } from '../../src/engine/offball';
import { candidates, choose } from '../../src/engine/onball';
import { L, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { Agent } from '../../src/engine/state';
import { DT, gap, move, pick, place, REFRESH, sane, sceneState, setBody } from './harness';

export interface SceneOut {
  values: Record<string, number>;
  /** 기본 불변식 (NaN 없음, 경기장 안) */
  sane: boolean;
}

/** 수비 목표 = 공격수 위치 + 골 쪽 오프셋 (REFRESH 초마다 갱신, 그사이 고정 — 엔진 오프더볼 판단 주기와 같다) */
function track(d: Agent, a: Agent, t: number, next: { at: number }, ox: number, oy: number): void {
  if (t + 1e-9 >= next.at) {
    d.tx = a.x + ox;
    d.ty = a.y + oy;
    d.urgent = true;
    next.at = t + REFRESH;
  }
}

/** ① 같은 속도로 달리는 공격수·수비수: 추적 간격이 일정한가 (4초) */
export function sceneChase(): SceneOut {
  const s = sceneState(1);
  const a = pick(s, 0, 3);
  const d = pick(s, 1, 1);
  setBody(a, 80);
  setBody(d, 80);
  place(a, 40, 34, a.maxSpeed, 0);
  place(d, 41, 36, d.maxSpeed, 0);
  a.urgent = true;
  const next = { at: 0 };
  const gaps: number[] = [];
  let ok = true;
  for (let t = 0; t < 4 - 1e-9; t += DT) {
    a.tx = a.x + 30;
    a.ty = 34;
    track(d, a, t, next, 1, 2);
    move(a);
    move(d);
    gaps.push(gap(a, d));
    ok &&= sane(a, d);
  }
  return {
    values: { gap0: gaps[0]!, gapMean: gaps.reduce((x, y) => x + y, 0) / gaps.length, gapMax: Math.max(...gaps), gapMin: Math.min(...gaps), gapEnd: gaps.at(-1)!, gapSwing: Math.max(...gaps) - Math.min(...gaps) },
    sane: ok,
  };
}

/** ② 공격수 급정지·방향 전환: 수비가 붙어 있는 1초 뒤 공격수가 되돌아 뛸 때 수비 반응 시간(되돌아서기까지)·공격수 뒤로 지나친 거리·1초 뒤 간격 */
export function sceneStop(): SceneOut {
  const s = sceneState(1);
  const a = pick(s, 0, 3);
  const d = pick(s, 1, 1);
  setBody(a, 80);
  setBody(d, 80);
  place(a, 40, 34, a.maxSpeed, 0);
  place(d, 41, 36, d.maxSpeed, 0);
  a.urgent = true;
  const next = { at: 0 };
  let ok = true;
  const turnAt = 1;
  let react = NaN;
  let maxPast = 0;
  let gapTurn = NaN;
  let gap1 = NaN;
  for (let t = 0; t < 3.5 - 1e-9; t += DT) {
    // 1초까지 +x 로 전력, 그다음 반대로 (급정지 후 되돌아 뜀)
    a.tx = t < turnAt ? a.x + 30 : a.x - 30;
    a.ty = 34;
    track(d, a, t, next, 1, 2);
    if (Number.isNaN(gapTurn) && t + 1e-9 >= turnAt) gapTurn = gap(a, d);
    move(a);
    move(d);
    ok &&= sane(a, d);
    if (t + 1e-9 >= turnAt) {
      if (Number.isNaN(react) && d.vx < 0) react = t + DT - turnAt;
      maxPast = Math.max(maxPast, d.x - a.x);
      if (Number.isNaN(gap1) && t + DT - turnAt >= 1 - 1e-9) gap1 = gap(a, d);
    }
  }
  return { values: { gapAtTurn: gapTurn, reactTime: react, maxPast, gapAfter1s: gap1 }, sane: ok };
}

/** ③ 높은 라인 뒤로 빠른 공격수 출발 + 느린 CB: 골 앞 10 m 선 도착 시각 차 (CB − 공격수, 양수면 공격수가 먼저). 같은 속도 비교 포함 */
export function sceneHighLine(): SceneOut {
  const run = (attPace: number, cbPace: number): { arriveGap: number; distBehind: number; ok: boolean } => {
    const s = sceneState(1);
    const a = pick(s, 0, 3);
    const d = pick(s, 1, 1);
    setBody(a, attPace);
    setBody(d, cbPace);
    // 라인 x = 70, CB 는 공 쪽(−x)을 보고 서 있다. 공격수는 라인 2 m 앞에서 조깅하다 공이 뒤로 넘어가는 순간(t = 0) 출발
    place(d, 70, 34, 0, 0);
    place(a, 68, 31, 3, 0);
    a.urgent = true;
    const next = { at: 0 };
    const goalLine = L - 10;
    let ta = NaN;
    let td = NaN;
    let behind = NaN;
    let ok = true;
    for (let t = 0; t < 8 - 1e-9; t += DT) {
      a.tx = L - 5;
      a.ty = 34;
      // CB 는 공격수와 골 사이 (공격수 앞 2 m)로
      track(d, a, t, next, 2, 0);
      move(a);
      move(d);
      ok &&= sane(a, d);
      if (Number.isNaN(ta) && a.x >= goalLine) {
        ta = t + DT;
        behind = a.x - d.x;
      }
      if (Number.isNaN(td) && d.x >= goalLine) td = t + DT;
    }
    return { arriveGap: (Number.isNaN(td) ? 8 : td) - ta, distBehind: behind, ok };
  };
  const slow = run(90, 60);
  const even = run(80, 80);
  return {
    values: { slowArriveGap: slow.arriveGap, slowDistBehind: slow.distBehind, evenArriveGap: even.arriveGap, evenDistBehind: even.distBehind },
    sane: slow.ok && even.ok,
  };
}

/** ④ GK 반대편으로 내준 패스 뒤 슛: 패스 속도(느린 횡패스 10 m/s · 빠른 컷백 18 m/s)별 GK 이동·도달 항·선방 확률, 자리 잡은 GK 기준값 */
export function sceneKeeper(): SceneOut {
  const shotSpeed = 29;
  const corner = 0.7;
  const run = (passSpeed: number, preset: boolean): { cover: number; pSave: number; off: number; moved: number; ok: boolean } => {
    const s = sceneState(1);
    const gk = keeperOf(s, 1)!;
    const passer = pick(s, 0, 3, 0);
    const shooter = pick(s, 0, 3, 1);
    const [px, py] = [L - 12, W / 2 + 14];
    const [sx, sy] = [L - 11, W / 2 - 3];
    place(passer, px, py);
    place(shooter, sx, sy);
    const b = s.ball;
    const at = (x: number, y: number, owner: number): void => {
      b.x = x;
      b.y = y;
      b.owner = owner;
      b.flight = null;
      b.reserve = null;
    };
    // 시작: 패서가 공을 가짐, GK 는 그때 자리 (preset 이면 슈터가 공을 가졌을 때 자리)
    at(preset ? sx : px, preset ? sy : py, preset ? shooter.idx : passer.idx);
    keeperTarget(s, gk);
    place(gk, gk.tx, gk.ty);
    const x0 = gk.x;
    const y0 = gk.y;
    const pd = Math.hypot(sx - px, sy - py);
    const dur = pd / passSpeed;
    let next = 0;
    let ok = true;
    const settle = 0.3;
    for (let t = 0; t < dur + settle - 1e-9; t += DT) {
      const k = Math.min(1, t / dur);
      if (!preset) at(px + (sx - px) * k, py + (sy - py) * k, k >= 1 ? shooter.idx : -1);
      if (t + 1e-9 >= next) {
        keeperTarget(s, gk);
        next = t + REFRESH;
      }
      move(gk);
      ok &&= sane(gk);
    }
    // 슛: GK 반대편 구석 (엔진 shoot 과 같은 farSide 규칙)
    const side = farSide(gk, W / 2) ?? -1;
    const ty = W / 2 + side * corner * (ENGINE.pitch.goalWidth / 2 - 0.3);
    const d = Math.hypot(L - sx, W / 2 - sy);
    const cover = shotCover(gk, sx, sy, L, ty, shotSpeed);
    at(sx, sy, shooter.idx);
    keeperTarget(s, gk);
    return { cover, pSave: saveProb(gk, shotSpeed, corner, d) * cover, off: Math.hypot(gk.x - gk.tx, gk.y - gk.ty), moved: Math.hypot(gk.x - x0, gk.y - y0), ok };
  };
  const slow = run(10, false);
  const fast = run(18, false);
  const set = run(18, true);
  return {
    values: {
      slowCover: slow.cover, slowSave: slow.pSave, slowOff: slow.off, slowMoved: slow.moved,
      fastCover: fast.cover, fastSave: fast.pSave, fastOff: fast.off, fastMoved: fast.moved,
      setCover: set.cover, setSave: set.pSave,
    },
    sane: slow.ok && fast.ok && set.ok,
  };
}

/** ⑤ 전방 막힘 대 열림: 같은 자리 소유자(CM, 하프라인 2.5 m 앞)의 선택 400번 중 백패스 비율과 이유 */
export function sceneBackpass(): SceneOut {
  const run = (blocked: boolean): { back: number; mistake: number; noFwd: number; risk: number; fwd: number; ok: boolean } => {
    const s = sceneState(2);
    const mine = s.agents.filter((a) => a.team === 0);
    const opp = s.agents.filter((a) => a.team === 1 && a.line !== 0);
    const own: [number, number][] = [[5, 34], [35, 24], [35, 44], [45, 6], [45, 62], [55, 34], [50, 44], [62, 8], [62, 60], [76, 26], [76, 42]];
    const gk0 = mine.find((a) => a.line === 0)!;
    const field = mine.filter((a) => a.line !== 0).sort((x, y) => x.line - y.line || x.idx - y.idx);
    place(gk0, ...own[0]!);
    field.forEach((a, i) => place(a, ...own[1 + i]!));
    const owner = field[5]!; // (55, 34)
    // 막힘: 소유자보다 앞의 동료마다 골 쪽 1.2 m 에 수비 1명 + 소유자 앞 4 m 압박. 열림: 상대 필드 선수는 깊은 줄(x 95)
    const ahead = field.filter((a) => a !== owner && a.x > owner.x);
    opp.forEach((o, i) => {
      if (blocked && i < ahead.length) place(o, ahead[i]!.x + 1.2, ahead[i]!.y + (ahead[i]!.y < owner.y ? 0.8 : -0.8));
      else if (blocked && i === ahead.length) place(o, owner.x + 4, owner.y);
      else place(o, 95, 6 + (i * 56) / Math.max(1, opp.length - 1));
    });
    s.ball.owner = owner.idx;
    s.ball.x = owner.x;
    s.ball.y = owner.y;
    s.ball.flight = null;
    s.ball.reserve = null;
    s.possTeam = 0;
    s.possOrigin = 'open';
    s.possStartT = s.t - 30;
    const res = { back: 0, mistake: 0, noFwd: 0, risk: 0, fwd: 0, ok: true };
    const old = probe.decide;
    probe.decide = (_s, p) => {
      const c = p.chosen;
      if (c.type === 'pass' && c.x - p.a.x < -2) {
        res.back++;
        const fwd = p.vis.filter((o) => (o.type === 'pass' || o.type === 'through') && o.x - p.a.x >= 5 && o.p >= 0.6);
        if (c.u < p.maxU - p.gap) res.mistake++;
        else if (!fwd.length) res.noFwd++;
        else res.risk++;
      } else if ((c.type === 'pass' || c.type === 'through') && c.x - p.a.x >= 5) res.fwd++;
    };
    const tick0 = s.tick;
    for (let k = 0; k < 400; k++) {
      s.tick = tick0 + k;
      choose(s, owner, candidates(s, owner));
    }
    probe.decide = old;
    res.ok = sane(...s.agents);
    return res;
  };
  const B = run(true);
  const O = run(false);
  const pc = (n: number) => n / 400;
  return {
    values: {
      blockedBack: pc(B.back), blockedFwd: pc(B.fwd), blockedMistake: pc(B.mistake), blockedNoFwd: pc(B.noFwd), blockedRisk: pc(B.risk),
      openBack: pc(O.back), openFwd: pc(O.fwd), openMistake: pc(O.mistake), openNoFwd: pc(O.noFwd), openRisk: pc(O.risk),
    },
    sane: B.ok && O.ok,
  };
}

export const SCENES = { chase: sceneChase, stop: sceneStop, highLine: sceneHighLine, keeper: sceneKeeper, backpass: sceneBackpass } as const;
export type SceneId = keyof typeof SCENES;
