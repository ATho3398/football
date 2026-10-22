// 기준 장면 ⑫⑬⑭ (C.78b, 공통 규칙 로드맵 5단계 2차 수신·첫 터치): 2:1 원터치 리턴 · 침투 수신 뒤 슛까지 · 등지고 압박 속 수신.
// 팀 0 이 +x 로 공격(전반). 장면 선수와 두 GK 만 경기장에 남기고(나머지 onPitch false) 엔진 step 전체로 돌린다 — 수신·결정·이동이 실제 경기와 같은 길.
// 시행마다 경기 시드가 달라 결정 난수가 다르다 (비율로 본다).

import { execute } from '../../src/engine/actions';
import { candidates, type Candidate } from '../../src/engine/onball';
import type { Agent, SimState } from '../../src/engine/state';
import { probe } from '../../src/engine/probe';
import { DT, pick, place, sane, sceneSim, sceneState, setBody } from './harness';
import type { SceneOut } from './scenes';

/** 장면 선수와 GK 만 남긴다 */
function only(s: SimState, keep: Agent[]): void {
  for (const o of s.agents) if (!keep.includes(o) && o.line !== 0) o.onPitch = false;
}

function own(s: SimState, o: Agent): void {
  s.ball.owner = o.idx;
  s.ball.x = o.x;
  s.ball.y = o.y;
  s.ball.flight = null;
  s.ball.reserve = null;
  s.possTeam = o.team;
  s.possOrigin = 'open';
  s.possSince = s.t - 30;
  s.possStartT = s.t - 30;
}

/** from → to 패스를 성공으로 찬다 (판정 확률 1, 날아가는 길·속도·받기는 엔진 그대로) */
function kick(s: SimState, from: Agent, to: Agent, type: Candidate['type']): boolean {
  const c = candidates(s, from).find((x) => x.receiver === to.idx && x.type === type);
  if (!c) return false;
  execute(s, from, { ...c, p: 1, pFlight: 1 });
  return true;
}

/** 소유자가 바뀌거나 공을 차기까지 엔진 step. 받는 순간 시각·그 뒤 첫 행동(공이 떠난 시각·종류) */
function runUntil(s: SimState, recv: Agent, maxT: number, each?: () => void, onGot?: () => void): { gotAt: number; actAt: number; act: string; ok: boolean; vGot: number } {
  const t0 = s.t;
  let gotAt = NaN;
  let vGot = NaN;
  let actAt = NaN;
  let act = '';
  let ok = true;
  while (s.t - t0 < maxT) {
    const shots = s.teams[recv.team].stats.shots;
    each?.();
    sceneSim!.step();
    ok &&= sane(...s.agents.filter((a) => a.onPitch));
    if (Number.isNaN(gotAt) && s.ball.owner === recv.idx) {
      gotAt = s.t;
      vGot = Math.hypot(recv.vx, recv.vy);
      onGot?.();
    }
    if (!Number.isNaN(gotAt) && s.ball.owner !== recv.idx) {
      actAt = s.t;
      const fl = s.ball.flight;
      act = s.teams[recv.team].stats.shots > shots ? 'shoot' : fl && fl.passer === recv.idx ? (fl.through ? 'through' : 'pass') : 'lost';
      break;
    }
  }
  return { gotAt, actAt, act, ok, vGot };
}

/**
 * ⑫ 2:1 원터치 리턴: 상대 진영 CM(75, 29, 속도 85) → ST(77, 34) 패스(패서는 마커보다 3.5 m 뒤), ST 마커(속도 70)는 골 쪽 1.5 m. 패서는 주고 달리기(마커 뒤 공간). 24회.
 * 잰다: ST 가 받는 순간 패서에게 원터치로 돌려준 비율 · 받은 뒤 리턴까지 시간 · 리턴을 받은 패서가 마커보다 골 쪽(뒤)에서 받은 비율
 */
export function sceneOneTwo(): SceneOut {
  let ret = 0;
  let behind = 0;
  let ot = 0;
  let otBehind = 0;
  const delay: number[] = [];
  const gapGot: number[] = [];
  let ok = true;
  const N = 24;
  for (let k = 0; k < N; k++) {
    const s = sceneState(40 + k);
    const passer = pick(s, 0, 2, 1);
    const recv = pick(s, 0, 3, 0);
    const marker = pick(s, 1, 1, 1);
    const cover = pick(s, 1, 1, 2);
    only(s, [passer, recv, marker, cover]);
    setBody(passer, 85);
    setBody(marker, 70);
    passer.attrs = { ...passer.attrs, offTheBall: 80 };
    recv.attrs = { ...recv.attrs, ballControl: 75, shortPassing: 75 };
    place(passer, 75, 29);
    place(recv, 77, 34);
    place(marker, 78.5, 34.5);
    place(cover, 92, 44);
    own(s, passer);
    if (!kick(s, passer, recv, 'pass')) continue;
    passer.giveGo = true;
    passer.giveGoT = s.t;
    passer.runUntil = s.t + 3;
    passer.nextOffball = s.t;
    const r = runUntil(s, recv, 4);
    ok &&= r.ok;
    const fl = s.ball.flight;
    if (fl && fl.passer === recv.idx && fl.receiver === passer.idx) {
      ret++;
      delay.push(r.actAt - r.gotAt);
      // 패서가 받는 순간 마커보다 골 쪽인가
      const one = r.actAt - r.gotAt <= 0.2 + 1e-9;
      if (one) ot++;
      const r2 = runUntil(s, passer, 3, undefined, () => {
        if (passer.x > marker.x) {
          behind++;
          if (one) otBehind++;
        }
        gapGot.push(Math.hypot(passer.x - marker.x, passer.y - marker.y));
      });
      ok &&= r2.ok;
    }
  }
  return {
    values: { returnRate: ret / N, returnDelay: delay.length ? delay.reduce((a, b) => a + b, 0) / delay.length : NaN, behindRate: ret ? behind / ret : 0, oneTouch: ot / N, otBehind: ot ? otBehind / ot : 0, gapGot: gapGot.length ? gapGot.reduce((a, b) => a + b, 0) / gapGot.length : NaN },
    sane: ok,
  };
}

/**
 * ⑬ 뒤 공간 침투 수신 → 슛: ST(70, 34) 가 8 m/s 로 골 쪽 침투, CB 는 ST 뒤 3 m 에서 같은 쪽으로 6 m/s(쫓아옴). CM(55, 30) 이 침투 패스. 10회.
 * 잰다: 받은 뒤 슛까지 시간 · 슛 비율 · 슛 순간 CB 거리 · 받을 때 ST 속도
 */
export function sceneRunIn(): SceneOut {
  let shots = 0;
  const tShot: number[] = [];
  const gapShot: number[] = [];
  const vRecv: number[] = [];
  let ok = true;
  const N = 10;
  for (let k = 0; k < N; k++) {
    const s = sceneState(60 + k);
    const passer = pick(s, 0, 2, 1);
    const st = pick(s, 0, 3, 0);
    const cb = pick(s, 1, 1, 1);
    only(s, [passer, st, cb]);
    setBody(st, 85);
    setBody(cb, 75);
    st.attrs = { ...st.attrs, ballControl: 75, shooting: 75 };
    place(passer, 55, 30);
    place(st, 70, 34, 8, 0);
    place(cb, 71, 36, 5, 0);
    st.runUntil = s.t + 4;
    st.tx = 92;
    st.ty = 34;
    st.urgent = true;
    own(s, passer);
    if (!kick(s, passer, st, 'through')) continue;
    const r = runUntil(s, st, 6);
    ok &&= r.ok;
    if (!Number.isNaN(r.gotAt)) vRecv.push(r.vGot);
    if (r.act === 'shoot') {
      shots++;
      tShot.push(r.actAt - r.gotAt);
      gapShot.push(Math.hypot(cb.x - st.x, cb.y - st.y));
    }
  }
  const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
  return { values: { shotRate: shots / N, shotTime: avg(tShot), shotGap: avg(gapShot), recvSpeed: avg(vRecv) }, sane: ok };
}

/**
 * ⑭ 등지고 압박 속 수신: CB(40, 34) → ST(70, 34) 빠른 패스(30 m), ST 뒤 골 쪽 1.2 m 에 수비가 붙어 있다. 같은 ST 가 앞쪽 측면(78, 18)에서 오는 패스를 앞을 보고·수비 14 m 밖에서 받는 장면과 비교. 12회씩.
 * 잰다: 원터치가 아니면 받은 정지 시간(등지고 압박 · 앞 보고 자유) · 받은 뒤 첫 결정까지 시간 · 등지고 압박의 첫 행동이 공 지키기(유지·버티기)·짧은 내주기(레이오프)·백패스인 비율 · 그중 백패스의 가치 항 1위가 압박 탈출인 비율
 */
export function sceneBackPress(): SceneOut {
  const N = 12;
  const tBack: number[] = [];
  const tFree: number[] = [];
  const stopBack: number[] = [];
  const stopFree: number[] = [];
  let safe = 0;
  let n = 0;
  let backs = 0;
  let escape = 0;
  let ok = true;
  const old = probe.decide;
  try {
    for (let k = 0; k < N; k++) {
      for (const free of [false, true]) {
        const s = sceneState(80 + k);
        const cb0 = pick(s, 0, 1, 1);
        const mid = pick(s, 0, 2, 1);
        const st = pick(s, 0, 3, 0);
        const def = pick(s, 1, 1, 1);
        only(s, [cb0, mid, st, def]);
        st.attrs = { ...st.attrs, ballControl: 70 };
        place(cb0, free ? 78 : 52, free ? 18 : 34);
        place(st, 70, 34);
        place(mid, 60, 28);
        place(def, free ? 84 : 71.2, 34);
        own(s, cb0);
        // 붙은 수비는 ST 골 쪽 1.2 m 를 계속 따라간다 (마크 판단을 장면이 고정: 오프더볼 갱신 없음, 목표 속도 = ST 속도)
        if (!free) def.nextOffball = s.t + 60;
        const glue = () => {
          if (free) return;
          def.tx = st.x + 1.2;
          def.ty = st.y;
          def.tvx = st.vx;
          def.tvy = st.vy;
          def.urgent = true;
        };
        let dec: { t: number; c: Candidate } | null = null;
        probe.decide = (ss, { a, chosen }) => {
          if (a === st && !dec) dec = { t: ss.t, c: chosen };
        };
        if (!kick(s, cb0, st, 'pass')) continue;
        const r = runUntil(s, st, 4, glue, () => {
          if (!st.pre) (free ? stopFree : stopBack).push(st.cooldown);
        });
        ok &&= r.ok;
        const d = dec as { t: number; c: Candidate } | null;
        if (Number.isNaN(r.gotAt) || !d) continue;
        // 받은 틱(gotAt − dt)부터 결정까지
        (free ? tFree : tBack).push(Math.max(0, d.t - (r.gotAt - DT)));
        if (free) continue;
        n++;
        const c = d.c;
        const backward = c.receiver >= 0 && c.x < st.x - 2;
        if (c.type === 'hold' || c.type === 'holdup' || c.type === 'layoff' || backward) safe++;
        if (backward && c.back) {
          backs++;
          if (c.back.escape >= c.back.keep && c.back.escape >= c.back.sw) escape++;
        }
      }
    }
  } finally {
    probe.decide = old;
  }
  const avg = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : NaN);
  return { values: { stopBack: avg(stopBack), stopFree: avg(stopFree), timeBack: avg(tBack), timeFree: avg(tFree), safeRate: n ? safe / n : 0, backs, escapeShare: backs ? escape / backs : 0 }, sane: ok };
}
