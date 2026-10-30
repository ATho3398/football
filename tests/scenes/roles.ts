// 기준 장면 ㉑㉒㉓ (C.78e, 로드맵 6단계 역할): 반대쪽 측면 크로스 때 LM/RM 먼 포스트 도착 · 펄스 나인 내려옴 → CB 따라감 → 2선 빈자리 침투 패스 ·
// 펄스 나인 내려옴 → CB 안 따라감(중원이 먼저 닿음) → 돌아서 전진. 팀 0 = 공격(+x), 팀 1 = 수비(자기 골 x = L). 엔진 step 전체, 시드 여러 개 평균.

import { execute } from '../../src/engine/actions';
import { candidates } from '../../src/engine/onball';
import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch, type MatchSim } from '../../src/engine/sim';
import { tacticsOf } from '../../src/engine/tactics';
import { dist, L, W } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import { FORMATION_SLOTS, type Formation } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { DT, place, sane, withEngine } from './harness';
import type { SceneOut } from './scenes';

function team(tag: string, seed: number, formation: Formation, roles: Record<number, string>): TeamSetup {
  const r = createTeamRoster({ id: `sr-${tag}`, rating: 75 }, `scene-r${tag}${seed}`, 2018, []);
  r.formation = formation;
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `srw${tag}${seed}`);
  s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  for (const [sl, rid] of Object.entries(roles)) { const p = s.lineup.find((x) => x.slot === Number(sl)); if (p) p.role = rid; }
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
}

/** 열린 플레이 경기 상태 (시각 10분, 팀 0 은 +x 로 공격) */
function rolesState(seed: number, f0: Formation, r0: Record<number, string>, f1: Formation): { s: SimState; m: MatchSim } {
  const m = createMatch({ home: team('h', seed, f0, r0), away: team('a', seed, f1, {}), mode: 'auto', difficulty: 'normal', seed: 7800 + seed, bigMatch: false, neutral: true });
  const s = m.state;
  s.restart = null;
  s.t = 600;
  s.tick = 6000;
  for (const a of s.agents) { a.vx = 0; a.vy = 0; a.cooldown = 0; a.urgent = false; }
  return { s, m };
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

const byPos = (s: SimState, t: 0 | 1, pos: string, k = 0): Agent => s.agents.filter((a) => a.team === t && a.onPitch && a.pos === pos)[k]!;

/** 팀을 줄별 x 로 세운다 (y 는 슬롯) */
function shape(s: SimState, team: 0 | 1, xs: number[]): void {
  for (const a of s.agents) if (a.team === team && a.onPitch) place(a, xs[a.line]!, a.sy * W);
}

/**
 * 측면 운반 → 크로스 자리: 팀 0 의 오른쪽(y 큰 쪽) 측면 선수가 상대 골 52 m 에서 터치라인 따라 6.5 m/s 로 상대 골 16 m 까지 공을 몰고(판단 안 함) 간다.
 * 반대쪽(왼쪽) 측면 선수가 공이 최종 ⅓(골 35 m)에 들어간 뒤 박스 안 먼 포스트 채널(먼 포스트 y ± 6 m)에 처음 닿은 시각(먼 포스트 자체는 오프사이드 라인 뒤라 라인이 내려가야 닿는다) · 공이 크로스 자리(골 16 m)에 닿은 순간 거리.
 * 4-4-2 LM 과 4-3-3 LW 를 같은 출발점(상대 골 45 m, 터치라인 8 m)에서 잰다
 */
function wideRun(formation: Formation, N: number) {
  let tArr = 0, arrived = 0, dEnd = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const { s, m } = rolesState(210 + k, formation, {}, '4-4-2');
    shape(s, 0, [10, L - 62, L - 48, L - 38]);
    shape(s, 1, [L - 1, L - 14, L - 26, L - 45]);
    const carrier = formation === '4-4-2' ? byPos(s, 0, 'RM') : byPos(s, 0, 'RW');
    const far = formation === '4-4-2' ? byPos(s, 0, 'LM') : byPos(s, 0, 'LW');
    place(carrier, L - 52, W - 5);
    giveBall(s, carrier);
    // 3초 자리 잡기 (공 정지, 판단 안 함): 두 팀이 공격·수비 대형을 잡는다 — LM 은 중원 줄, LW 는 공격 줄 깊이에서 출발
    const ts = s.t;
    while (s.t - ts < 3) { carrier.cooldown = 1; place(carrier, L - 52, W - 5); s.ball.x = carrier.x; s.ball.y = carrier.y; m.step(); }
    const fx = L - 8;
    const fy = W / 2 - 0.1 * W;
    let tIn = -1, tHit = -1;
    let ended = false;
    const t0 = s.t;
    while (s.t - t0 < 9) {
      // 공 운반 (판단 안 함): 터치라인 따라 상대 골 16 m 까지
      if (carrier.x < L - 16) { place(carrier, Math.min(L - 16, carrier.x + 6.5 * DT), W - 5, 6.5, 0); s.ball.x = carrier.x; s.ball.y = carrier.y; }
      carrier.cooldown = 1;
      s.ball.owner = carrier.idx;
      s.ball.flight = null;
      m.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      if (tIn < 0 && s.ball.x >= L - 35) tIn = s.t;
      if (tIn >= 0 && tHit < 0 && far.x >= L - 16.5 && Math.abs(far.y - fy) <= 6) tHit = s.t;
      if (!ended && carrier.x >= L - 16 - 1e-6) { ended = true; dEnd += dist(far.x, far.y, fx, fy); }
    }
    if (tHit >= 0) { arrived++; tArr += tHit - tIn; } else tArr += 9 - (tIn - t0);
  }
  return { tArr: tArr / N, arrived: arrived / N, dEnd: dEnd / N, ok };
}

/** ㉑ 반대쪽 측면 크로스: LM 이 먼 포스트에 LW 보다 1초 넘게 늦지 않게 도착 (끔은 늦음) */
export function sceneWideArrive(): SceneOut {
  const N = 12;
  const lm = wideRun('4-4-2', N);
  const lw = wideRun('4-3-3', N);
  const lmOff = withEngine({ 'offball.wideArrive': 0 }, () => wideRun('4-4-2', N));
  return {
    values: { lmT: lm.tArr, lmArr: lm.arrived, lmEnd: lm.dEnd, lwT: lw.tArr, lwArr: lw.arrived, lwEnd: lw.dEnd, lmOffT: lmOff.tArr, lmOffArr: lmOff.arrived, lmOffEnd: lmOff.dEnd },
    sane: lm.ok && lw.ok && lmOff.ok,
  };
}

/**
 * 펄스 나인 내려옴: 팀 0 4-3-3(ST 펄스 나인 · 윙 둘 다 윙 포워드 · CM 박스투박스), 팀 1 4-3-3 블록(수비 줄 상대 골 30 m · 중원 줄 44 m).
 * 팀 0 CDM 이 상대 골 48 m 중앙에서 공, ST 는 수비 줄 앞 8 m 줄 사이(골 38 m)로 내려와 있다. midNear = 팀 1 CDM 을 ST 2.5 m 앞에 둠(중원이 먼저 닿음).
 * 0.6초 뒤 CDM → ST 땅볼 패스(성공). 받은 순간: 가장 가까운 CB 가 나머지 수비 줄보다 3 m+ 앞인가(따라감) · 받은 뒤 3초 안 빈자리 채널(그 CB 의 y ± 8 m, 수비 줄 − 3 m 보다 깊은 곳)에
 * 들어온 동료(ST 제외) · 받은 뒤 4초 안 그 채널로 가는 동료 패스 · 8초 안 슛 · ST 가 2.5초 안 공을 갖고 3 m+ 전진하거나 5 m+ 전진 패스(돌아서 전진)
 */
function nineRun(midNear: boolean, N: number) {
  let follow = 0, run = 0, passRun = 0, shot = 0, turn = 0, got = 0, faced = 0, fwd1 = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const { s, m } = rolesState(230 + k, '4-3-3', { 9: 'falseNine', 8: 'wingForward', 10: 'wingForward', 6: 'boxToBox' }, '4-3-3');
    shape(s, 0, [12, L - 60, L - 50, L - 32]);
    shape(s, 1, [L - 1, L - 30, L - 44, L - 58]);
    const cdm = byPos(s, 0, 'CDM');
    const st = byPos(s, 0, 'ST');
    place(cdm, L - 50, W / 2);
    place(st, L - 38, W / 2 + 1);
    const oc = byPos(s, 1, 'CDM');
    if (midNear) place(oc, L - 40.5, W / 2 + 1); else place(oc, L - 50, W / 2 + 14);
    giveBall(s, cdm);
    cdm.cooldown = 0.6;
    const t0 = s.t;
    while (s.t - t0 < 0.6) { m.step(); st.cooldown = 0; }
    place(st, L - 38, W / 2 + 1);
    const c = candidates(s, cdm).find((x) => x.receiver === st.idx && x.type === 'pass');
    if (c) execute(s, cdm, { ...c, p: 1, pFlight: 1 });
    else giveBall(s, st);
    let tr = -1;
    let px = 0, py = 0, x0 = 0;
    let fol = false, didRun = false, didPass = false, didShot = false, didTurn = false, didFace = false, first = 0;
    let runner: Agent | null = null;
    const shots0 = s.teams[0].stats.shots;
    let seen: unknown = null;
    const t1 = s.t;
    while (s.t - t1 < 10) {
      m.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      if (tr < 0) {
        if (s.ball.owner === st.idx) {
          tr = s.t;
          x0 = st.x;
          const cbs = s.agents.filter((a) => a.team === 1 && a.onPitch && a.pos === 'CB');
          const cb = cbs.sort((a, b) => dist(a.x, a.y, st.x, st.y) - dist(b.x, b.y, st.x, st.y))[0]!;
          const rest = s.agents.filter((a) => a.team === 1 && a.onPitch && a.line === 1 && a !== cb);
          const lx = rest.reduce((acc, a) => acc + a.x, 0) / rest.length;
          fol = lx - cb.x >= 3;
          px = lx;
          py = cb.y;
        } else if (s.ball.owner >= 0 && s.ball.owner !== cdm.idx || s.t - t1 > 3) break;
        continue;
      }
      const el = s.t - tr;
      // 앞을 봄: 받은 0.3초 뒤 아직 소유 중이면 등짐 아님 · 첫 행동(ST 의 첫 패스/슛 또는 3 m+ 몰기)이 앞으로(+1)/뒤·옆(−1)
      if (el >= 0.3 && el < 0.3 + DT && s.ball.owner === st.idx && !st.backToGoal) didFace = true;
      if (first === 0 && s.ball.owner === st.idx && st.x - x0 >= 3) first = 1;
      if (!didRun && el <= 3) for (const a of s.agents) if (a.team === 0 && a.onPitch && a !== st && a.line >= 2 && Math.abs(a.y - py) <= 8 && a.x >= px - 3) { didRun = true; runner = a; break; }
      const fl = s.ball.flight;
      if (fl && fl !== seen) {
        seen = fl;
        if (el <= 4 && fl.kind !== 'shot' && s.agents[fl.passer]!.team === 0) {
          // 빈자리 채널(그 CB 의 y ± 8 m, 수비 줄 깊이 − 3 m 보다 깊은 곳)로 가는 동료 패스
          if (fl.receiver !== st.idx && Math.abs(fl.toY - py) <= 8 && fl.toX >= px - 3) didPass = true;
        }
        if (fl.passer === st.idx && el <= 2.5 && fl.toX - x0 >= 5) didTurn = true;
        if (fl.passer === st.idx && first === 0) first = fl.kind === 'shot' || fl.toX - x0 >= 5 ? 1 : -1;
      }
      if (!didTurn && s.ball.owner === st.idx && el <= 2.5 && st.x - x0 >= 3) didTurn = true;
      if (s.teams[0].stats.shots > shots0 && el <= 8) didShot = true;
      if (s.ball.owner >= 0 && s.agents[s.ball.owner]!.team === 1) break;
      if (s.restart || el > 8) break;
    }
    if (tr < 0) continue;
    got++;
    if (fol) follow++;
    if (didRun) run++;
    if (didPass) passRun++;
    if (didShot) shot++;
    if (didTurn) turn++;
    if (didFace) faced++;
    if (first > 0) fwd1++;
  }
  const g = Math.max(1, got);
  return { got: got / N, follow: follow / g, run: run / g, pass: passRun / g, shot: shot / g, turn: turn / g, faced: faced / g, fwd1: fwd1 / g, ok };
}

/** ㉒ 펄스 나인 내려옴 → CB 따라감 → 2선이 빈자리로 침투 → 그 선수에게 패스 (빈자리 침투 끔과 비교) */
export function sceneNineFollow(): SceneOut {
  const N = 30;
  const on = nineRun(false, N);
  const off = withEngine({ 'offball.gapRun': 0 }, () => nineRun(false, N));
  return {
    values: { got: on.got, follow: on.follow, run: on.run, pass: on.pass, shot: on.shot, turn: on.turn, runOff: off.run, passOff: off.pass, shotOff: off.shot },
    sane: on.ok && off.ok,
  };
}

/**
 * ㉓ 펄스 나인 내려옴 → CB 안 따라감 → 돌아서 전진: CB 가 라인을 지키면(따라나옴 끔) 받은 0.3초 뒤 앞을 봄(돌아서기)·첫 행동 전진이 돌아서기 끔보다 많다
 * (따라 나갈 때(p 상한 고정)와의 비교는 기록 — 따라 나가면 빈자리 침투가 생겨 전진 패스가 오히려 많다).
 * 판단: 상대 중원이 ST 에게 먼저 닿으면(midNear) CB 따라감이 그렇지 않을 때보다 적다 (CB 판단 끔과 비교)
 */
export function sceneNineHold(): SceneOut {
  // C.79m(점유 가치): 30 → 60 — fwdHold 대 fwdNoTurn 차가 30표본 1건(0.233 대 0.267)으로 갈려 표본을 늘림(60: 0.267 대 0.25)
  const N = 60;
  const hold = withEngine({ 'offball.stepOutMax': 0 }, () => nineRun(false, N));
  const holdNoTurn = withEngine({ 'offball.stepOutMax': 0, 'receive.turnFree': 0 }, () => nineRun(false, N));
  const go = withEngine({ 'offball.stepOutBase': 1, 'offball.stepOutJudge': 0, 'offball.stepOutDecoy': 0, 'offball.stepOutAlone': 0 }, () => nineRun(false, N));
  const near = nineRun(true, N);
  const far = nineRun(false, N);
  const nearOff = withEngine({ 'offball.stepOutMidCut': 0 }, () => nineRun(true, N));
  return {
    values: { turnHold: hold.turn, faceHold: hold.faced, fwdHold: hold.fwd1, followHold: hold.follow, faceNoTurn: holdNoTurn.faced, fwdNoTurn: holdNoTurn.fwd1, turnGo: go.turn, faceGo: go.faced, fwdGo: go.fwd1, followGo: go.follow, followNear: near.follow, followFar: far.follow, followNearOff: nearOff.follow },
    sane: hold.ok && holdNoTurn.ok && go.ok && near.ok && far.ok && nearOff.ok,
  };
}
