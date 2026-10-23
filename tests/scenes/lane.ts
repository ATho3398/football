// 기준 장면 ㉖㉗㉘ (C.78h, 슛 레인 막기): 박스 앞 정면 공격수의 주발로 수비가 찰 만한 구석 쪽 슛 길에 서는지 · 레인이 막히면 공격수가 옆으로 치고 각도를 만드는지.
// 팀 0 = 공격(+x, 상대 골 x = L, 가운데 y = 34), 팀 1 = 수비. 나머지 선수는 멀리 둔다.

import { candidates, choose, shotModel } from '../../src/engine/onball';
import { updateOffball } from '../../src/engine/offball';
import { L } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import type { Agent, SimState } from '../../src/engine/state';
import { pick, place, sane, sceneState, withEngine } from './harness';
import type { SceneOut } from './scenes';

const GY = 34;

/** 공격수 a(팀 0 공격 줄)·수비 d(팀 1 수비 줄) 만 공 근처, 나머지는 멀리. a 가 공을 갖는다 */
function setup(seed: number, ax: number, ay: number): { s: SimState; a: Agent; d: Agent; d2: Agent } {
  const s = sceneState(seed);
  for (const t of [0, 1] as const) {
    s.teams[t].tactics = tacticsOf('balanced');
    s.teams[t].setup.tactics = s.teams[t].tactics;
  }
  const a = pick(s, 0, 3, 0);
  const d = pick(s, 1, 1, 1);
  const d2 = pick(s, 1, 1, 2);
  let k = 0;
  for (const o of s.agents) {
    if (o === a || o === d || o === d2) continue;
    if (o.line === 0) place(o, o.team === 0 ? 2 : L - 1, GY);
    else place(o, o.team === 0 ? 35 : L - 45, 6 + (k++ % 10) * 6);
  }
  place(a, ax, ay, 0, 0);
  s.ball.owner = a.idx;
  s.ball.x = a.x;
  s.ball.y = a.y;
  s.ball.flight = null;
  s.ball.reserve = null;
  s.possTeam = 0;
  s.possOrigin = 'open';
  s.possSince = s.t;
  s.possStartT = s.t;
  return { s, a, d, d2 };
}

/** 점 (x, y) 의 공-골 중앙 선 가로 부호 거리 (+ = y 큰 쪽) */
function lat(ax: number, ay: number, x: number, y: number): number {
  const ux = L - ax, uy = GY - ay, ul = Math.hypot(ux, uy);
  return -((x - ax) * uy - (y - ay) * ux) / ul;
}

/**
 * 수비 1명(공에 가장 가까움)의 판단 목표: 슛 길 위 어느 쪽에 서는가. foot = 공격수 주발, judge = 수비 위치 선정·가로채기
 * 반환: 찰 만한 쪽(주발 쪽: 오른발 → y 작은 쪽)에 선 비율 · 가로 거리(m) 평균 · 슈터 앞 거리(m) 평균 · 기대 구석 쪽 길에서 벗어난 거리
 */
function standRun(foot: 'right' | 'left', judge: number, N: number) {
  let same = 0, latSum = 0, gapSum = 0, offLane = 0;
  let ok = true;
  const want = foot === 'right' ? -1 : 1;
  for (let k = 0; k < N; k++) {
    const { s, a, d } = setup(260 + k, L - 20, GY);
    a.body = { ...a.body, foot, weakFoot: 1 };
    d.attrs = { ...d.attrs, defensivePositioning: judge, interception: judge };
    place(d, L - 11, GY + (k % 2 ? 3 : -3));
    updateOffball(s, d);
    ok &&= sane(d) && Number.isFinite(d.tx) && Number.isFinite(d.ty);
    const l = lat(a.x, a.y, d.tx, d.ty);
    if (Math.sign(l) === want) same++;
    latSum += Math.abs(l);
    gapSum += Math.hypot(d.tx - a.x, d.ty - a.y);
    // 기대 구석(가운데 ± 1.68 m) 쪽 길에서 벗어남 — 고른 쪽 길까지
    const sd = Math.sign(l) || 1;
    const ty = GY + sd * 0.5 * (7.32 / 2 - 0.3);
    const ux = L - a.x, uy = ty - a.y, ul = Math.hypot(ux, uy);
    offLane += Math.abs(((d.tx - a.x) * uy - (d.ty - a.y) * ux) / ul);
  }
  return { same: same / N, lat: latSum / N, gap: gapSum / N, off: offLane / N, ok };
}

/** ㉖ 오른발 공격수 정면 20 m — 수비가 오른발로 감아 찰 구석(공격 방향 왼쪽) 쪽 슛 길 위 슈터 앞에 선다 */
export function sceneLaneRight(): SceneOut {
  const N = 60;
  const hi = standRun('right', 85, N);
  const lo = standRun('right', 35, N);
  const off = withEngine({ 'offball.laneBlock': 0 }, () => standRun('right', 85, N));
  return {
    values: { same: hi.same, sameLow: lo.same, lat: hi.lat, gap: hi.gap, off: hi.off, sameOff: off.same, gapOff: off.gap },
    sane: hi.ok && lo.ok && off.ok,
  };
}

/** ㉗ 왼발 공격수 같은 자리 — 수비가 반대쪽 길에 선다 */
export function sceneLaneLeft(): SceneOut {
  const N = 60;
  const l = standRun('left', 85, N);
  const r = standRun('right', 85, N);
  return { values: { same: l.same, sameRight: r.same, lat: l.lat, gap: l.gap, off: l.off }, sane: l.ok && r.ok };
}

/**
 * ㉘ 레인 막힘: 박스 안 12 m 정면 공격수 앞 3.5 m 슛 길 위에 수비(두 구석 길 모두 콘 안, 압박 거리 밖). 공격수 판단: 슛 · 옆으로 친 몰기(가로 2 m+, 앞 2 m 이하) 비율,
 * 옆 몰기를 골랐을 때 도착점 블록 확률(지금 자리보다 낮아야). 비교 = 같은 거리지만 길 밖(옆 1.6 m)에 선 수비 · 각도 만들기 끔
 */
function angleRun(blocked: boolean, N: number) {
  let shoot = 0, side = 0, pbHere = 0, pbThere = 0, nSide = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const { s, a, d, d2 } = setup(280 + k, L - 12, GY);
    a.body = { ...a.body, foot: 'right', weakFoot: 3 };
    if (blocked) place(d, L - 8.5, GY + 0.2, 0, 0);
    else place(d, L - 8.5, GY + 1.6, 0, 0);
    place(d2, L - 30, GY + (k % 2 ? 20 : -20));
    const c = choose(s, a, candidates(s, a));
    ok &&= Number.isFinite(c.u);
    if (c.type === 'shoot') shoot++;
    // 옆으로 친 몰기: 가로 2 m+ · 앞으로 2 m 이하 (앞으로 가는 비스듬한 몰기 6 m 와 구분)
    if ((c.type === 'carry' || c.type === 'dribble') && Math.abs(c.y - a.y) >= 2 && Math.abs(c.x - a.x) <= 2) {
      side++;
      nSide++;
      pbHere += shotModel(s, a).pBlock;
      pbThere += shotModel(s, a, false, { x: c.x, y: c.y }).pBlock;
    }
  }
  return { shoot: shoot / N, side: side / N, pbHere: nSide ? pbHere / nSide : 0, pbThere: nSide ? pbThere / nSide : 0, ok };
}

export function sceneLaneAngle(): SceneOut {
  const N = 80;
  const b = angleRun(true, N);
  const o = angleRun(false, N);
  const off = withEngine({ 'onball.laneCarry': 0 }, () => angleRun(true, N));
  return {
    values: { shoot: b.shoot, side: b.side, pbHere: b.pbHere, pbThere: b.pbThere, shootOpen: o.shoot, sideOpen: o.side, sideOff: off.side, shootOff: off.shoot },
    sane: b.ok && o.ok && off.ok,
  };
}
