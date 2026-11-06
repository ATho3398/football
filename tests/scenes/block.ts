// 기준 장면 ⑱⑲⑳ (C.78d, 깊은 블록 밀집·역습 지원): 블록 대 지공 허용 슛 · 블록 탈취 뒤 역습 지원 · 줄 사이 수신자에게 튀어나감·옆 메움.
// 팀 0 = 공격(+x 공격, 자기 골 x = 0), 팀 1 = 수비 블록(자기 골 x = L). 엔진 step 전체(판단·이동·경합이 실제 경기와 같은 길), 시드 여러 개 평균.

import { turnover } from '../../src/engine/core';
import { execute } from '../../src/engine/actions';
import { candidates } from '../../src/engine/onball';
import { probe } from '../../src/engine/probe';
import { dist, L } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import type { Agent, SimState } from '../../src/engine/state';
import type { Tendency } from '../../src/engine/types';
import { pick, place, sane, sceneSim, sceneState, withEngine } from './harness';
import type { SceneOut } from './scenes';

/** 버스 세우기 = 수비 블록 + 라인 매우 낮음 (C.78s H1) */
type Tend = Tendency | 'bus';
const tacOf = (t: Tend) => (t === 'bus' ? tacticsOf('block', { lineHeight: 0 }) : tacticsOf(t));

/** 줄마다 x, y 는 고르게 (팀별 [GK, 수비, 중원, 공격] x) */
function layout(s: SimState, xs0: number[], xs1: number[]): void {
  for (const team of [0, 1] as const) {
    const xs = team === 0 ? xs0 : xs1;
    for (const line of [0, 1, 2, 3] as const) {
      const g = s.agents.filter((a) => a.team === team && a.line === line);
      g.forEach((a, k) => place(a, xs[line]!, g.length === 1 ? 34 : 10 + (48 * k) / (g.length - 1)));
    }
  }
}

function giveBall(s: SimState, o: Agent): void {
  s.ball.owner = o.idx;
  s.ball.x = o.x;
  s.ball.y = o.y;
  s.ball.flight = null;
  s.ball.reserve = null;
  s.possTeam = o.team;
  s.possOrigin = 'open';
  s.possSince = s.t;
  s.possStartT = s.t;
}

function setTactics(s: SimState, t0: Tend, t1: Tend): void {
  s.teams[0].tactics = tacOf(t0);
  s.teams[0].setup.tactics = s.teams[0].tactics;
  s.teams[1].tactics = tacOf(t1);
  s.teams[1].setup.tactics = s.teams[1].tactics;
}

/**
 * 지공(팀 0 균형)이 상대 진영 40 m 에서 공을 갖고 120초(그 뒤 흐름 그대로): 팀 0 의 슛 수 · 박스 밖 비율 · 블록 비율 · xG 합. 팀 1 = def 성향(시드마다 같은 배치에서 시작)
 */
function buildRun(def: Tend, N: number) {
  let shots = 0, out = 0, blocked = 0, xg = 0;
  let ok = true;
  const old = probe.shot;
  probe.shot = (_st, p) => {
    if (p.team !== 0 || p.kind === 'pk' || p.kind === 'fk') return;
    shots++;
    xg += p.xg ?? 0;
    if (p.outcome === 'block') blocked++;
    if (L - p.x > 16.5 || Math.abs(p.y - 34) > 20.15) out++;
  };
  try {
    for (let k = 0; k < N; k++) {
      const s = sceneState(180 + k);
      setTactics(s, 'balanced', def);
      layout(s, [8, 45, 62, 80], [L - 1, L - 16, L - 27, L - 48]);
      const cm = pick(s, 0, 2, 1);
      place(cm, L - 40, 30);
      giveBall(s, cm);
      const t0 = s.t;
      while (s.t - t0 < 120) {
        sceneSim!.step();
        ok &&= sane(...s.agents.filter((a) => a.onPitch));
        if (s.done) break;
      }
    }
  } finally {
    probe.shot = old;
  }
  return { shots: shots / N, out: shots ? out / shots : 0, blocked: shots ? blocked / shots : 0, xg: xg / N, xgShot: shots ? xg / shots : 0, ok };
}

/** ⑱ 블록 대 지공: 버스가 허용하는 슛이 균형 수비보다 적고(xG 도) 박스 밖 비율이 높다 */
export function sceneBlockBuild(): SceneOut {
  // C.78e: 40 → 120 시드 (경기당 슛 0.4~0.6 이라 40 시드는 슛 수 차이 잡음 ±0.16, 120 시드 xG/슛 차이 잡음 약 ±0.02)
  const N = 120;
  const bus = buildRun('bus', N);
  const bal = buildRun('balanced', N);
  return {
    values: {
      busShots: bus.shots, busOut: bus.out, busBlocked: bus.blocked, busXg: bus.xg, busXgShot: bus.xgShot,
      balShots: bal.shots, balOut: bal.out, balBlocked: bal.blocked, balXg: bal.xg, balXgShot: bal.xgShot,
    },
    sane: bus.ok && bal.ok,
  };
}

/**
 * 블록 팀(팀 1)이 자기 골 18 m 에서 공을 뺏은 직후 15초 (팀 0 은 공격 대형으로 올라와 있음): 지원 달리기 인원 · 지원 대상(공에 가장 가까운 2선) 3초 전진 m ·
 * 15초 안 슛 비율 · 15초 안 상대 ⅓ 도달
 */
function counterRun(t1: Tend, N: number) {
  let sup = 0, exit = 0, run3 = 0, shot = 0, f3 = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const s = sceneState(190 + k);
    setTactics(s, 'balanced', t1);
    layout(s, [8, 50, 66, 80], [L - 1, L - 13, L - 23, L - 50]);
    const w = pick(s, 1, 2, 1);
    place(w, L - 18, 30);
    // 팀 0 공격 줄·중원 몇 명이 공 근처(잃은 순간)
    const near = s.agents.filter((a) => a.team === 0 && a.line >= 2).sort((x, y) => dist(x.x, x.y, w.x, w.y) - dist(y.x, y.y, w.x, w.y));
    near.slice(0, 2).forEach((a, j) => place(a, w.x - 4 - j * 3, w.y + (j ? 5 : -3)));
    giveBall(s, w);
    s.teams[1].wonAt = s.t;
    turnover(s, 0, true);
    sup += s.agents.filter((a) => a.team === 1 && a.supportRun).length;
    exit += s.agents.filter((a) => a.team === 1 && a.exitRun).length;
    // 지원 대상(규칙과 같은 고르기: 공에 가장 가까운 2선·측면, 소유자·출구 침투 제외) — 끔에서도 같은 선수를 본다
    const cand = s.agents.filter((a) => a.onPitch && a.team === 1 && a.idx !== w.idx && !a.exitRun && a.line === 2)
      .sort((x, y) => dist(x.x, x.y, w.x, w.y) - dist(y.x, y.y, w.x, w.y) || x.idx - y.idx).slice(0, t1 === 'counter' ? 2 : 1);
    const x0 = cand.map((a) => a.x);
    const shots0 = s.teams[1].stats.shots;
    const t0 = s.t;
    let did3 = false, didShot = false, didF3 = false;
    while (s.t - t0 < 15) {
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      const b = s.ball;
      if (!did3 && s.t - t0 >= 3) {
        did3 = true;
        run3 += cand.reduce((acc, a, j) => acc + (x0[j]! - a.x), 0) / Math.max(1, cand.length);
      }
      if (!didShot && s.teams[1].stats.shots > shots0) didShot = true;
      if (!didF3 && s.possTeam === 1 && b.x < L / 3) didF3 = true;
      if (s.done) break;
    }
    if (didShot) shot++;
    if (didF3) f3++;
  }
  return { sup: sup / N, exit: exit / N, run3: run3 / N, shot: shot / N, f3: f3 / N, ok };
}

/** ⑲ 블록 탈취 뒤 역습: 버스 지원 1명 · 역습 2명, 지원 켬이 끔보다 지원 대상의 3초 전진이 크다 · 15초 안 슛 */
export function sceneBlockCounter(): SceneOut {
  const N = 30;
  const bus = counterRun('bus', N);
  const ctr = counterRun('counter', N);
  const busOff = withEngine({ 'offball.supportRun': 0 }, () => counterRun('bus', N));
  const ctrOff = withEngine({ 'offball.supportRun': 0 }, () => counterRun('counter', N));
  return {
    values: {
      busSup: bus.sup, busExit: bus.exit, busRun3: bus.run3, busShot: bus.shot, busF3: bus.f3,
      ctrSup: ctr.sup, ctrRun3: ctr.run3, ctrShot: ctr.shot, ctrF3: ctr.f3,
      busRun3Off: busOff.run3, busShotOff: busOff.shot, ctrRun3Off: ctrOff.run3, ctrShotOff: ctrOff.shot,
    },
    sane: bus.ok && ctr.ok && busOff.ok && ctrOff.ok,
  };
}

/**
 * ⑳ 줄 사이 수신: 수비 블록(줄 간격 12 m — 버스는 8 m 라 줄 사이가 거의 없다)이 2초 자리를 잡은 뒤 상대 골 35 m 의 팀 0 CM 이 수비 줄과 중원 줄 사이 가운데의 동료에게 땅볼 패스(비행 중 수신자 압박이 작동하는 길),
 * 받은 선수는 1.2초 판단하지 않음(첫 터치). 패스를 찬 순간부터 받은 뒤 1초까지 잰다(그 전에 잃으면 그때).
 * 받은 1초 뒤: 이동 목표가 소유자 2 m 안인 팀 1 선수 수(튀어나감 — 한 번에 1명이면 1 안팎, 둘 이상 비율 multi) · 받는 순간·1초 뒤 가장 가까운 수비 거리 ·
 * 압박자를 뺀 중원 줄의 가로 간격 최댓값(옆이 메우면 구멍이 작다). 밀집 끔(offball.compact 0)과 비교
 */
function betweenRun(t1: Tend, N: number) {
  let steppers = 0, multi = 0, near1 = 0, received = 0, near0 = 0, gapMax = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const s = sceneState(200 + k);
    setTactics(s, 'balanced', t1);
    layout(s, [8, 45, 60, 80], [L - 1, L - 15, L - 27, L - 48]);
    // 2초 자리 잡기: 팀 0 CM 이 상대 골 35 m 에서 공을 쥐고(판단 안 함) 블록이 자리를 잡는다
    const h = pick(s, 0, 2, 2);
    place(h, L - 35, 34);
    giveBall(s, h);
    h.cooldown = 2.5;
    const ts = s.t;
    while (s.t - ts < 2) {
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
    }
    // 줄 사이 수신: 수비 줄과 중원 줄 사이 가운데로 공이 온다
    const def = s.agents.filter((a) => a.team === 1 && a.line === 1);
    const mid = s.agents.filter((a) => a.team === 1 && a.line === 2);
    const dx = def.reduce((acc, a) => acc + a.x, 0) / def.length;
    const mx = mid.reduce((acc, a) => acc + a.x, 0) / mid.length;
    const r = pick(s, 0, 2, 1);
    place(r, (dx + mx) / 2, 34);
    let d0 = new Map<number, number>();
    // h → r 땅볼 패스(성공, 날아가는 길·받기는 엔진 그대로). 받은 뒤 1.2초 판단 안 함
    const c = candidates(s, h).find((x) => x.receiver === r.idx && x.type === 'pass');
    if (c) execute(s, h, { ...c, p: 1, pFlight: 1 });
    else giveBall(s, r);
    const t0 = s.t;
    let got = -1;
    while (s.t - t0 < 4) {
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      if (got < 0 && s.ball.owner === r.idx) {
        got = s.t;
        r.cooldown = 1.2;
        d0 = new Map(s.agents.filter((a) => a.onPitch && a.team === 1 && a.line !== 0).map((a) => [a.idx, dist(a.x, a.y, r.x, r.y)]));
      }
      if (got >= 0 && (s.ball.owner !== r.idx || s.t - got >= 1)) break;
    }
    if (got < 0) continue;
    received++;
    let nd = 99;
    for (const a of s.agents) if (a.onPitch && a.team === 1 && a.line !== 0) nd = Math.min(nd, dist(a.x, a.y, r.x, r.y));
    near0 += Math.min(...d0.values());
    near1 += nd;
    // 튀어나감 = 이동 목표가 소유자 2 m 안인 수비(압박) · 메움 = 압박자 뺀 중원 줄의 가로 간격 최댓값(구멍)
    const pressers = s.agents.filter((a) => a.onPitch && a.team === 1 && a.line !== 0 && dist(a.tx, a.ty, r.x, r.y) <= 2);
    steppers += pressers.length;
    if (pressers.length >= 2) multi++;
    const ys = s.agents.filter((a) => a.onPitch && a.team === 1 && a.line === 2 && !pressers.includes(a)).map((a) => a.y).sort((x, y) => x - y);
    let gmax = 0;
    for (let j = 1; j < ys.length; j++) gmax = Math.max(gmax, ys[j]! - ys[j - 1]!);
    gapMax += gmax;
  }
  const n = Math.max(1, received);
  return { received: received / N, pressers: steppers / n, multi: multi / n, near0: near0 / n, near1: near1 / n, gapMax: gapMax / n, ok };
}

export function sceneBetweenLines(): SceneOut {
  const N = 20;
  const on = betweenRun('block', N);
  const off = withEngine({ 'offball.compact': 0 }, () => betweenRun('block', N));
  return {
    values: {
      received: on.received, pressers: on.pressers, multi: on.multi, near0: on.near0, near1: on.near1, gapMax: on.gapMax,
      pressersOff: off.pressers, multiOff: off.multi, near1Off: off.near1, gapMaxOff: off.gapMax,
    },
    sane: on.ok && off.ok,
  };
}
