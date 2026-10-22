// 기준 장면 ⑨⑩⑪ (C.78a, 공통 규칙 로드맵 5단계 전환 수비): 역압박이 뚫린 뒤 · 높은 라인 + 느린 CB · 몰빵 대형이 잃은 직후.
// 팀 0 이 +x 로 공격(자기 골 x = 0), 팀 1 골은 x = L. 수비 판단·이동은 엔진(updateOffball·transitionTick·moveAgent), ⑪ 은 엔진 step 전체.

import { turnover } from '../../src/engine/core';
import { candidates } from '../../src/engine/onball';
import { offsideLine, transitionTick, updateOffball } from '../../src/engine/offball';
import { L } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import type { Agent, SimState } from '../../src/engine/state';
import { DT, move, pick, place, REFRESH, sane, sceneState, setBody } from './harness';
import type { SceneOut } from './scenes';

/** 22명 배치: 팀별 줄마다 x, y 는 고르게. 팀 0 공격 중(높은 라인), 팀 1 은 자기 진영 */
function layout(s: SimState, xs0: [number, number, number, number], xs1: [number, number, number, number]): void {
  for (const team of [0, 1] as const) {
    const xs = team === 0 ? xs0 : xs1;
    for (const line of [0, 1, 2, 3] as const) {
      const g = s.agents.filter((a) => a.team === team && a.line === line);
      g.forEach((a, k) => place(a, xs[line], g.length === 1 ? 34 : 8 + (52 * k) / (g.length - 1)));
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

/** 엔진처럼: 전환 틱 → 판단 주기가 된 선수 오프더볼 판단 → 모두 이동 (소유자는 장면이 움직인다) */
function tick(s: SimState, owner: Agent): void {
  transitionTick(s);
  for (const a of s.agents) {
    if (!a.onPitch || a === owner) continue;
    if (s.t >= a.nextOffball) {
      updateOffball(s, a);
      a.nextOffball = s.t + REFRESH;
    }
  }
  for (const a of s.agents) if (a.onPitch && a !== owner) move(a);
  s.t += DT;
  s.tick++;
}

/**
 * ⑨ 역압박 3명(또는 1명) 가담 뒤 뚫림: 팀 0(게겐, 라인 50 m)이 상대 진영 70 m 에서 공을 잃고 가담자가 소유자를 둘러싼다. 0.8초 뒤 상대가 가담자 뒤(58 m)로
 * 패스를 통과시켜(수신자 소유로 바꿈) 우리 골 쪽으로 4 m/s 로 몰고 간다. 잰다: 뚫림 감지까지 시간 · 가담자가 우리 골 쪽으로 2 m/s 이상 돌아서기까지 · 둘이 공과 나란히(3 m 안)·공 뒤로 오기까지 ·
 * 뚫린 1초 뒤 수신자 앞 공간(가장 가까운 팀 0 필드 선수 거리) · 상대 오프사이드 라인(우리 골에서 m)
 */
export function scenePressBreak(): SceneOut {
  const run = (n: number) => {
    const s = sceneState(9);
    s.teams[0].tactics = tacticsOf('gegenpress');
    layout(s, [6, 50, 66, 74], [100, 86, 70, 52]);
    const owner = pick(s, 1, 2, 1);
    const recv = pick(s, 1, 2, 2);
    place(owner, 70, 34);
    place(recv, 64, 22);
    giveBall(s, owner);
    // 가담자: 팀 0 중원 줄에서 공에 가까운 3명(공격 줄은 원래 공 앞에 남는다). n = 1 이면 나머지 둘은 중원 자리(62 m)
    const near = s.agents.filter((a) => a.team === 0 && a.line === 2).sort((x, y) => Math.hypot(x.x - 70, x.y - 34) - Math.hypot(y.x - 70, y.y - 34)).slice(0, 3);
    const spots: [number, number][] = [[72, 33], [71, 37], [68, 30]];
    near.forEach((a, k) => place(a, k < n ? spots[k]![0] : 60, k < n ? spots[k]![1] : 26 + k * 8));
    const press = near.slice(0, n);
    const tm = s.teams[0];
    tm.counterPressers = press.map((a) => a.idx);
    tm.counterUntil = s.t + 9;
    tm.lostAt = s.t;
    tm.lineAtLoss = -1;
    tm.brokeAt = -100;
    s.teams[1].wonAt = s.t;
    for (const a of s.agents) a.nextOffball = s.t;
    let ok = true;
    const tPass = 0.8;
    let passed = false;
    let detect = NaN;
    let turn = NaN;
    let back = NaN;
    let room = NaN;
    let space = NaN;
    let cur = owner;
    for (let t = 0; t < 7 - 1e-9; t += DT) {
      if (!passed && t + 1e-9 >= tPass) {
        passed = true;
        giveBall(s, recv);
        cur = recv;
      }
      if (passed) {
        // 수신자는 우리 골 쪽으로 4 m/s 로 몬다
        cur.vx = -4;
        cur.vy = 0;
        cur.x += cur.vx * DT;
        s.ball.x = cur.x;
        s.ball.y = cur.y;
        const dt = t - tPass;
        if (Number.isNaN(detect) && s.t >= tm.counterUntil) detect = dt;
        const vBack = press.reduce((v, a) => v - a.vx, 0) / press.length;
        if (Number.isNaN(turn) && vBack >= 2) turn = dt;
        if (Number.isNaN(back) && press.filter((a) => a.x <= cur.x + 3).length >= 2) back = dt;
        if (Number.isNaN(room) && dt >= 1 - 1e-9) {
          room = Math.min(...s.agents.filter((a) => a.team === 0 && a.line !== 0 && a.x < cur.x).map((a) => Math.hypot(a.x - cur.x, a.y - cur.y)), 60);
          space = (1 - offsideLine(s, 1)) * L;
        }
      }
      tick(s, cur);
      ok &&= sane(...s.agents);
    }
    return { detect: Number.isNaN(detect) ? 9 : detect, turn: Number.isNaN(turn) ? 9 : turn, back: Number.isNaN(back) ? 9 : back, room, space, ok };
  };
  const r3 = run(3);
  const r1 = run(1);
  return {
    values: { detect3: r3.detect, turn3: r3.turn, back3: r3.back, room3: r3.room, space3: r3.space, detect1: r1.detect, room1: r1.room, space1: r1.space },
    sane: r3.ok && r1.ok,
  };
}

/**
 * ⑩ 높은 라인(수비 줄 60 m = 우리 골에서 45 m) + 느린 CB(60) 대 빠른 ST(90): 팀 0 CM 이 하프라인에서 공을 갖고 ST 가 라인에서 침투 시작.
 * 침투 패스 후보 성공 확률(판단)과 실제 달리기(ST·CB 둘 다 목표점으로 urgent, 엔진 이동)의 도착 차를 같은 장면 CB 85 와 비교한다
 */
export function sceneSlowLine(): SceneOut {
  const run = (cbPace: number) => {
    const s = sceneState(10);
    layout(s, [6, 30, 48, 58], [100, 60, 50, 42]);
    const passer = pick(s, 0, 2, 1);
    const st = pick(s, 0, 3, 0);
    const cb = pick(s, 1, 1, 1);
    const cb2 = pick(s, 1, 1, 2);
    place(passer, 46, 34);
    place(st, 59, 25, 4, 0);
    place(cb, 60.5, 28);
    place(cb2, 61, 40);
    setBody(st, 90);
    setBody(cb, cbPace);
    setBody(cb2, cbPace);
    giveBall(s, passer);
    st.runUntil = s.t + 3;
    const c = candidates(s, passer).find((x) => x.receiver === st.idx && x.type === 'through');
    const tx = c?.x ?? 80;
    const ty = c?.y ?? 34;
    let ok = true;
    let ta = NaN;
    let td = NaN;
    for (let t = 0; t < 6 - 1e-9; t += DT) {
      st.tx = tx; st.ty = ty; st.urgent = true;
      cb.tx = tx; cb.ty = ty; cb.urgent = true;
      move(st);
      move(cb);
      ok &&= sane(st, cb);
      if (Number.isNaN(ta) && Math.hypot(st.x - tx, st.y - ty) <= 1) ta = t;
      if (Number.isNaN(td) && Math.hypot(cb.x - tx, cb.y - ty) <= 1) td = t;
    }
    return { p: c?.p ?? 0, has: c ? 1 : 0, margin: (Number.isNaN(td) ? 6 : td) - (Number.isNaN(ta) ? 6 : ta), ok };
  };
  const slow = run(60);
  const fast = run(85);
  return { values: { pSlow: slow.p, pFast: fast.p, hasThrough: slow.has * fast.has, marginSlow: slow.margin, marginFast: fast.margin }, sane: slow.ok && fast.ok };
}

/**
 * ⑪ 몰빵 대형이 잃은 직후: 팀 0 이 상대 진영 70 m 에서 공을 잃는다. 수비 줄 2명(나머지 둘은 공격 줄로 바꿈 = 몰빵) 대 4명(4-4-2 그대로).
 * 팀 1(역습 성향) 탈취 선수 70 m(중원), 상대 공격 줄은 52 m. 잃은 순간(turnover) 뒤 1초 동안 양 팀 오프더볼은 엔진 판단·이동(소유자는 그대로),
 * 그 뒤 탈취 선수의 10 m 이상 전진 패스·침투 패스 후보의 성공 확률 × 받는 자리 가치 합(역습 기회)과,
 * 공보다 우리 골 쪽에서 5 m 안에 팀 0 필드 선수가 없는 팀 1 선수 수(자유로운 공격수). 시드 6개 평균
 */
export function sceneAllIn(): SceneOut {
  const run = (allIn: boolean) => {
    let chance = 0;
    let free = 0;
    let ok = true;
    for (let k = 0; k < 6; k++) {
      const s = sceneState(20 + k);
      layout(s, [6, 50, 62, 72], [100, 84, 70, 52]);
      if (allIn) {
        // 수비 줄 중 둘을 공격 줄(최전방 슬롯)로: 자리·줄·포지션 모두 공격수 — 잃은 뒤에도 수비로 돌아가지 않는다
        const defs = s.agents.filter((a) => a.team === 0 && a.line === 1);
        for (const a of defs.slice(1, 3)) {
          a.line = 3;
          a.pos = 'ST';
          a.sx = 0.85;
          place(a, 76, a.y);
        }
        for (const a of defs.filter((a) => a.line === 1)) place(a, 50, a.y < 34 ? 26 : 42);
      }
      s.teams[1].tactics = tacticsOf('counter');
      const owner = pick(s, 1, 2, 1);
      place(owner, 70, 30);
      giveBall(s, owner);
      turnover(s, 0, true);
      for (const a of s.agents) a.nextOffball = s.t;
      for (let t = 0; t < 1 - 1e-9; t += DT) {
        tick(s, owner);
        ok &&= sane(...s.agents);
      }
      // 10 m 이상 전진하는 패스·침투 패스 선택지의 성공 확률 × 받는 자리 가치 합 (역습 선택지)
      for (const c of candidates(s, owner)) if ((c.type === 'pass' || c.type === 'through') && c.x <= owner.x - 10) chance += c.p * c.value;
      free += s.agents.filter((o) => o.team === 1 && o.line !== 0 && o.x < owner.x
        && !s.agents.some((d) => d.team === 0 && d.line !== 0 && Math.hypot(d.x - o.x, d.y - o.y) <= 5)).length;
    }
    return { chance: chance / 6, free: free / 6, ok };
  };
  const a = run(true);
  const b = run(false);
  return { values: { chanceAllIn: a.chance, freeAllIn: a.free, chanceFour: b.chance, freeFour: b.free }, sane: a.ok && b.ok };
}
