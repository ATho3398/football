// 기준 장면 5개 (C.77w, 공통 규칙 로드맵 1단계). 각 함수는 지금 엔진 규칙으로 장면을 돌려 수치를 돌려준다 (목표 판정은 targets.ts).
// 팀 0 이 +x 로 공격(전반), 팀 1 골은 x = L.

import { ENGINE } from '../../src/engine/config';
import { keeperOf, saveProb, shotCover, farSide } from '../../src/engine/keeper';
import { keeperTarget, updateOffball } from '../../src/engine/offball';
import { arrivalTime } from '../../src/engine/physics';
import { candidates, choose, type Candidate } from '../../src/engine/onball';
import { L, W } from '../../src/engine/pitch';
import { probe } from '../../src/engine/probe';
import type { Agent, SimState } from '../../src/engine/state';
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
    // 목표 속도 = 따라가는 공격수의 (판단 순간) 속도 — 엔진 offball 추적·마크·압박과 같다 (C.77x)
    d.tvx = a.vx;
    d.tvy = a.vy;
    d.tvIdx = a.idx;
    d.tvwx = 1;
    d.tvwy = 1;
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
      const ax0 = a.x;
      const dx0 = d.x;
      move(a);
      move(d);
      ok &&= sane(a, d);
      // 선을 넘은 시각은 틱 안에서 선형 보간 (C.77x: 0.1초 눈금보다 촘촘하게)
      if (Number.isNaN(ta) && a.x >= goalLine) {
        ta = t + DT * ((goalLine - ax0) / Math.max(1e-9, a.x - ax0));
        behind = a.x - d.x;
      }
      if (Number.isNaN(td) && d.x >= goalLine) td = t + DT * ((goalLine - dx0) / Math.max(1e-9, d.x - dx0));
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
  const run = (blocked: boolean) => {
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
    const res = { back: 0, side: 0, mistake: 0, noFwd: 0, risk: 0, fwd: 0, escape: 0, keep: 0, ok: true };
    const old = probe.decide;
    probe.decide = (_s, p) => {
      const c = p.chosen;
      if (c.type === 'pass' && c.x - p.a.x < -2) {
        res.back++;
        const fwd = p.vis.filter((o) => (o.type === 'pass' || o.type === 'through') && o.x - p.a.x >= 5 && o.p >= 0.6);
        if (c.u < p.maxU - p.gap) res.mistake++;
        else if (!fwd.length) res.noFwd++;
        else res.risk++;
        // 이유 (C.77y 백패스 가치 항): 압박 탈출 대 보존(보존 + 전환) 중 큰 쪽
        if (c.back) {
          if (c.back.escape >= c.back.keep + c.back.sw) res.escape++;
          else res.keep++;
        }
      } else if ((c.type === 'pass' || c.type === 'through') && c.x - p.a.x >= 5) res.fwd++;
      else if (c.type === 'pass') res.side++;
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
      blockedBack: pc(B.back), blockedSide: pc(B.side), blockedFwd: pc(B.fwd), blockedMistake: pc(B.mistake), blockedNoFwd: pc(B.noFwd), blockedRisk: pc(B.risk),
      blockedEscape: pc(B.escape), blockedKeep: pc(B.keep),
      openBack: pc(O.back), openSide: pc(O.side), openFwd: pc(O.fwd), openMistake: pc(O.mistake), openNoFwd: pc(O.noFwd), openRisk: pc(O.risk),
      openEscape: pc(O.escape), openKeep: pc(O.keep),
    },
    sane: B.ok && O.ok,
  };
}

/** ⑥ 판단용 도착 시간(arrivalTime) 대 실제 이동(moveAgent): 서 있음(앞·뒤 보고)·앞으로 달림·반대로 달림·옆으로 달림 × 거리 10·25 m × 속도 60·90 의 최대 오차 (C.77x) */
export function sceneArrival(): SceneOut {
  const s = sceneState(3);
  const a = pick(s, 1, 1);
  const reach = 0.5;
  let maxErr = 0;
  let sumErr = 0;
  let n = 0;
  let ok = true;
  // [시작 속도 (+x = 목표 쪽), 몸 방향 (서 있을 때)]
  const starts: [number, number, number][] = [[0, 0, 1], [0, 0, -1], [6, 0, 1], [-8, 0, -1], [0, 6, 1]];
  for (const pace of [60, 90]) {
    for (const dist of [10, 25]) {
      for (const [vx, vy, h] of starts) {
        setBody(a, pace);
        place(a, 30, 34, vx, vy);
        if (vx === 0 && vy === 0) a.hx = h;
        a.urgent = true;
        const px = 30 + dist;
        const pred = arrivalTime(a, px, 34, reach);
        let act = NaN;
        for (let t = 0; t < 10 - 1e-9 && Number.isNaN(act); t += DT) {
          a.tx = px + 20;
          a.ty = 34;
          const x0 = a.x;
          move(a);
          ok &&= sane(a);
          if (a.x >= px - reach) act = t + DT * ((px - reach - x0) / Math.max(1e-9, a.x - x0));
        }
        const e = Math.abs(pred - act);
        if (process.env.ARRDBG) console.log(`arr pace ${pace} d ${dist} v ${vx},${vy} h ${h} pred ${pred.toFixed(2)} act ${act.toFixed(2)}`);
        maxErr = Math.max(maxErr, e);
        sumErr += e;
        n++;
      }
    }
  }
  return { values: { maxErr, meanErr: sumErr / n }, sane: ok };
}

/** 열린 플레이 소유: 팀 0 이 공을 가진 채 (owner) 30초째 소유 */
function own(s: SimState, owner: Agent): void {
  s.ball.owner = owner.idx;
  s.ball.x = owner.x;
  s.ball.y = owner.y;
  s.ball.flight = null;
  s.ball.reserve = null;
  s.possTeam = 0;
  s.possOrigin = 'open';
  s.possStartT = s.t - 30;
}

/** 나머지 선수는 경기에서 비켜 둔다 (팀 0 은 자기 진영 뒤, 팀 1 은 깊은 줄) — 장면 선수만 남긴다 */
function clearOthers(s: SimState, keep: Agent[]): void {
  let i = 0;
  for (const o of s.agents) {
    if (keep.includes(o)) continue;
    if (o.line === 0) place(o, o.team === 0 ? 3 : L - 3, 34);
    else if (o.team === 0) place(o, 30, 4 + (i++ % 10) * 6.5);
    else place(o, 101, 4 + (i++ % 10) * 6.5);
  }
}

/**
 * ⑦ 2:1 (C.77y): 상대 진영에서 CM 이 ST 에게 패스한 직후. 패서가 침투를 고르는 비율(200 틱)·달리는 목표가 받은 선수 마커 뒤인가·
 * 1초 뒤 받은 선수의 리턴(침투) 패스 후보가 생기는가 · 그 성공 확률. 마커·나머지 수비는 엔진 오프더볼 판단(반응 주기·이동 능력)으로 움직인다
 */
export function sceneGiveGo(): SceneOut {
  const s = sceneState(4);
  const passer = pick(s, 0, 2, 1);
  const recv = pick(s, 0, 3, 0);
  const marker = pick(s, 1, 1, 1);
  const cover = pick(s, 1, 1, 2);
  clearOthers(s, [passer, recv, marker, cover]);
  passer.role = { ...passer.role, run: 0.6 };
  passer.attrs = { ...passer.attrs, offTheBall: 80 };
  setBody(passer, 80);
  place(passer, 66, 26);
  place(recv, 76, 34);
  place(marker, 78, 34.5);
  place(cover, 90, 42);
  own(s, recv);
  s.lastPass = { passer: passer.idx, receiver: recv.idx, t: s.t };
  const tick0 = s.tick;
  let runs = 0;
  let first = -1;
  for (let k = 0; k < 200; k++) {
    s.tick = tick0 + k;
    passer.giveGoT = -1;
    passer.giveGo = false;
    passer.runUntil = 0;
    updateOffball(s, passer);
    if (s.t < passer.runUntil) {
      runs++;
      if (first < 0) first = k;
    }
  }
  let ok = sane(...s.agents);
  // 첫 침투 틱에서 1초 진행: 패서·마커·덮는 수비 모두 엔진 오프더볼 판단 (REFRESH 마다)
  s.tick = tick0 + Math.max(0, first);
  passer.giveGoT = -1;
  passer.runUntil = 0;
  updateOffball(s, passer);
  const behind = (passer.tx - marker.x) * 1;
  const movers = [passer, marker, cover];
  let next = 0;
  for (let t = 0; t < 1.0 - 1e-9; t += DT) {
    if (t + 1e-9 >= next) {
      for (const m of movers) if (m !== passer || t > 0) updateOffball(s, m);
      next = t + REFRESH;
    }
    for (const m of movers) move(m);
    s.t += DT;
    s.tick++;
    ok &&= sane(...movers);
  }
  const ret = candidates(s, recv).filter((c: Candidate) => c.receiver === passer.idx);
  const thr = ret.find((c) => c.type === 'through');
  if (process.env.GGDBG) console.log(JSON.stringify({ thr, passer: [passer.x, passer.y, passer.tx, passer.ty, passer.vx], marker: [marker.x, marker.y], cover: [cover.x, cover.y], recv: [recv.x, recv.y] }));
  return {
    values: { runRate: runs / 200, targetBehind: behind, passerAdvance: passer.x - 66, returnThrough: thr ? 1 : 0, returnP: thr?.p ?? 0 },
    sane: ok,
  };
}

/**
 * ⑧ 받으러 나오기 (C.77y): 공을 가진 CB 에게서 15 m 앞 CM 에 마커가 1.2 m 붙어 있다. 1.5초 뒤 수신 각도(마커와 거리·CB → CM 패스 성공 확률).
 * 마커는 엔진 오프더볼 판단 대신 반응 주기(REFRESH)마다 CM 의 골 쪽 1.2 m 를 쫓는다 (자기 이동 능력·C.77x 목표 속도)
 */
export function sceneCheck(): SceneOut {
  const s = sceneState(5);
  const owner = pick(s, 0, 1, 1);
  const recv = pick(s, 0, 2, 1);
  const marker = pick(s, 1, 2, 1);
  clearOthers(s, [owner, recv, marker]);
  setBody(recv, 75);
  setBody(marker, 75);
  place(owner, 40, 30);
  place(recv, 55, 36);
  place(marker, 56.2, 36);
  own(s, owner);
  const passP = () => candidates(s, owner).find((c) => c.receiver === recv.idx && (c.type === 'pass' || c.type === 'through'))?.p ?? 0;
  const p0 = passP();
  const sep0 = gap(recv, marker);
  const nextD = { at: 0 };
  let next = 0;
  let ok = true;
  for (let t = 0; t < 1.5 - 1e-9; t += DT) {
    if (t + 1e-9 >= next) {
      updateOffball(s, recv);
      next = t + REFRESH;
    }
    track(marker, recv, t, nextD, 1.2, 0);
    move(recv);
    move(marker);
    s.t += DT;
    s.tick++;
    ok &&= sane(recv, marker);
  }
  // 받는 선수에서 본 소유자와 마커 사이 각도 (도): 180 에 가까울수록 마커가 등 뒤 (공과 사이에 없다)
  const ang = (Math.acos(((owner.x - recv.x) * (marker.x - recv.x) + (owner.y - recv.y) * (marker.y - recv.y)) / (gap(owner, recv) * gap(marker, recv) || 1)) * 180) / Math.PI;
  return { values: { sep0, sepEnd: gap(recv, marker), p0, pEnd: passP(), moved: Math.hypot(recv.x - 55, recv.y - 36), angle: ang }, sane: ok };
}

export const SCENES = { chase: sceneChase, stop: sceneStop, highLine: sceneHighLine, keeper: sceneKeeper, backpass: sceneBackpass, arrival: sceneArrival, giveGo: sceneGiveGo, check: sceneCheck } as const;
export type SceneId = keyof typeof SCENES;
