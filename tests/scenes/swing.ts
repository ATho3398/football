// 기준 장면 ㉔㉕ (C.78g, 전환 순간): 뺏긴 팀 혼란 · 뺏은 팀 즉시 전진 · 뒤 공간 가치.
// 팀 0 = 공을 잃는 팀(+x 공격, 자기 골 x = 0), 팀 1 = 자기 진영에서 뺏는 팀(−x 공격, 자기 골 x = L). 엔진 step 전체, 시드 여러 개 평균.

import { setOwner } from '../../src/engine/core';
import { dist, L } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import type { Agent, SimState } from '../../src/engine/state';
import type { Tendency } from '../../src/engine/types';
import { pick, place, sane, sceneSim, sceneState, withEngine } from './harness';
import type { SceneOut } from './scenes';

/** 전환 순간 규칙 끔 (C.78g) */
export const SWING_OFF = { 'transition.lossDelay': 0, 'transition.winPre': 0, 'transition.startRun': 0, 'transition.space': 0 };

function layout(s: SimState, xs0: number[], xs1: number[]): void {
  for (const team of [0, 1] as const) {
    const xs = team === 0 ? xs0 : xs1;
    for (const line of [0, 1, 2, 3] as const) {
      const g = s.agents.filter((a) => a.team === team && a.line === line);
      g.forEach((a, k) => place(a, xs[line]!, g.length === 1 ? 34 : 10 + (48 * k) / (g.length - 1)));
    }
  }
}

function setTactics(s: SimState, t0: Tendency, t1: Tendency): void {
  s.teams[0].tactics = tacticsOf(t0);
  s.teams[0].setup.tactics = s.teams[0].tactics;
  s.teams[1].tactics = tacticsOf(t1);
  s.teams[1].setup.tactics = s.teams[1].tactics;
}

/**
 * 팀 0 이 1.5초 공을 갖고(판단 안 함, 공격 대형으로 움직임) 공 근처 팀 1 중원이 그 공을 뺏는다(setOwner — 실제 탈취와 같은 길).
 * 뺏은 뒤 4초: 공 전진 거리 m(팀 1 공격 방향, 공을 가진 채 — 그 전에 잃으면 마지막으로 가진 자리) · 4초 유지 비율 · 8초 안 공을 가진 채 상대 진영(하프라인 넘음) 비율 · 첫 패스 전진 m(4초 안 패스가 없으면 0) · 첫 결정까지 초 ·
 * 1초 뒤 공에서 10 m 안 팀 0 수: 뺏긴 팀이 다시 모이는 속도
 */
export function swingRun(t0: Tendency, t1: Tendency, xs0: number[], xs1: number[], wx: number, N: number) {
  let adv = 0, fwd = 0, first = 0, near1 = 0, keep = 0, half = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const s = sceneState(240 + k);
    setTactics(s, t0, t1);
    layout(s, xs0, xs1);
    // 잃을 팀 0 공격수가 상대 진영에서 공을 쥔다
    const h = pick(s, 0, 2, 1);
    place(h, wx - 2, 30);
    s.ball.owner = h.idx;
    s.ball.x = h.x;
    s.ball.y = h.y;
    s.possTeam = 0;
    s.possOrigin = 'open';
    s.possSince = s.possStartT = s.t;
    s.lastOwner = h.idx;
    h.cooldown = 1.6;
    const ts = s.t;
    while (s.t - ts < 1.5) {
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
    }
    // 공 근처 팀 1 중원이 뺏는다
    const w = s.agents.filter((a) => a.onPitch && a.team === 1 && a.line === 2).sort((x, y) => dist(x.x, x.y, h.x, h.y) - dist(y.x, y.y, h.x, h.y) || x.idx - y.idx)[0] as Agent;
    place(w, h.x + 1, h.y);
    s.ball.x = w.x;
    s.ball.y = w.y;
    setOwner(s, w);
    const x0 = s.ball.x;
    const tw = s.t;
    let lostX: number | null = null, ownX = x0, fwd0: number | null = null, dec: number | null = null, n1: number | null = null;
    let fl0 = s.ball.flight;
    let adv4: number | null = null, inHalf = false;
    while (s.t - tw < 8) {
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      const b = s.ball;
      if (dec === null && b.owner !== w.idx) dec = s.t - tw;
      if (fwd0 === null && b.flight && b.flight !== fl0 && s.agents[b.flight.passer]?.team === 1) fwd0 = b.flight.fromX - b.flight.toX;
      fl0 = b.flight;
      if (n1 === null && s.t - tw >= 1) n1 = s.agents.filter((a) => a.onPitch && a.team === 0 && a.line !== 0 && dist(a.x, a.y, b.x, b.y) <= 10).length;
      if (lostX === null && (s.possTeam as number) !== 1) lostX = ownX;
      if (lostX === null && b.owner >= 0) ownX = b.x;
      if (lostX === null && b.owner >= 0 && b.x < L / 2) inHalf = true;
      if (adv4 === null && s.t - tw >= 4) {
        adv4 = x0 - (lostX ?? ownX);
        if (lostX === null) keep++;
      }
      if (s.done) break;
    }
    adv += adv4 ?? 0;
    if (inHalf) half++;
    fwd += fwd0 ?? 0;
    first += dec ?? 4;
    near1 += n1 ?? 0;
  }
  return { adv: adv / N, fwd: fwd / N, first: first / N, near1: near1 / N, keep: keep / N, half: half / N, ok };
}

/** ㉔ 게겐(높이 올라온 팀 0) 대 버스: 버스가 자기 ⅓(자기 골 20 m)에서 뺏음 — 켬이 끔보다 4초 전진이 크고 첫 패스가 더 앞으로 */
export function sceneGegenBus(): SceneOut {
  const N = 80;
  const xs0 = [30, 62, 78, 88];
  const xs1 = [L - 1, L - 10, L - 18, L - 40];
  const on = swingRun('gegenpress', 'bus', xs0, xs1, L - 20, N);
  const off = withEngine(SWING_OFF, () => swingRun('gegenpress', 'bus', xs0, xs1, L - 20, N));
  return {
    values: { adv: on.adv, advOff: off.adv, fwd: on.fwd, fwdOff: off.fwd, first: on.first, firstOff: off.first, near1: on.near1, near1Off: off.near1, keep: on.keep, keepOff: off.keep, half: on.half, halfOff: off.half },
    sane: on.ok && off.ok,
  };
}

/** ㉕ 균형 대 균형: 잃은 팀이 덜 올라와 있음(중원 줄 하프라인 근처) · 하프라인 근처에서 뺏음 — 전환 순간 효과가 ㉔ 보다 작다 */
export function sceneBalancedSwing(): SceneOut {
  const N = 80;
  const xs0 = [8, 38, 52, 64];
  const xs1 = [L - 1, L - 25, L - 40, L - 52];
  const on = swingRun('balanced', 'balanced', xs0, xs1, 58, N);
  const off = withEngine(SWING_OFF, () => swingRun('balanced', 'balanced', xs0, xs1, 58, N));
  return {
    values: { adv: on.adv, advOff: off.adv, fwd: on.fwd, fwdOff: off.fwd, first: on.first, firstOff: off.first, keep: on.keep, keepOff: off.keep, half: on.half, halfOff: off.half },
    sane: on.ok && off.ok,
  };
}
