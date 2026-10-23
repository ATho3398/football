// 기준 장면 ㉙ (C.78i, 윙어 수비 면제 비용): 크랙형 윙어가 높이 남음 → 상대 풀백이 그 측면으로 오버래핑 → 그 측면 크로스·침투.
// 팀 0 = 공격(+x, 4-3-3), 팀 1 = 수비(자기 골 x = L, 4-3-3). 팀 1 RW(슬롯 10)는 팀 0 LB 와 같은 측면(y 작은 쪽)이다. 엔진 step 전체, 시드 여러 개 평균.

import { fillRoles, teamSetupFromRoster } from '../../src/engine/setup';
import { createMatch, type MatchSim } from '../../src/engine/sim';
import { tacticsOf } from '../../src/engine/tactics';
import { L, W } from '../../src/engine/pitch';
import type { Agent, SimState } from '../../src/engine/state';
import type { TeamSetup } from '../../src/engine/types';
import { FORMATION_SLOTS } from '../../src/formations';
import { createTeamRoster, rosterRating } from '../../src/roster';
import { place, sane, withEngine } from './harness';
import type { SceneOut } from './scenes';

function team(tag: string, seed: number, roles: Record<number, string>): TeamSetup {
  const r = createTeamRoster({ id: `so-${tag}`, rating: 75 }, `scene-o${tag}${seed}`, 2018, []);
  r.formation = '4-3-3';
  const s = teamSetupFromRoster(r, rosterRating(r), 75, `sow${tag}${seed}`);
  s.tactics = tacticsOf('balanced');
  const slots = FORMATION_SLOTS[s.formation];
  for (const p of s.lineup) delete p.role;
  for (const [sl, rid] of Object.entries(roles)) { const p = s.lineup.find((x) => x.slot === Number(sl)); if (p) p.role = rid; }
  fillRoles(s, (slot) => slots[slot]!.pos);
  return s;
}

function overlapState(seed: number, wing: string): { s: SimState; m: MatchSim } {
  // 팀 0 LB 는 공격형 풀백(오버래핑 성향), 팀 1 RW 만 바꾼다
  const m = createMatch({
    home: team('h', seed, { 1: 'attackingFullback' }), away: team('a', seed, { 10: wing }),
    mode: 'auto', difficulty: 'normal', seed: 7900 + seed, bigMatch: false, neutral: true,
  });
  const s = m.state;
  s.restart = null;
  s.t = 600;
  s.tick = 6000;
  for (const a of s.agents) { a.vx = 0; a.vy = 0; a.cooldown = 0; a.urgent = false; }
  return { s, m };
}

const byPos = (s: SimState, t: 0 | 1, pos: string): Agent => s.agents.find((a) => a.team === t && a.onPitch && a.pos === pos)!;

function shape(s: SimState, team: 0 | 1, xs: number[]): void {
  for (const a of s.agents) if (a.team === team && a.onPitch) place(a, xs[a.line]!, team === 0 ? a.sy * W : (1 - a.sy) * W);
}

/**
 * 팀 0 LW 가 상대 골 42 m 왼쪽 터치라인 근처에서 공을 갖고 1.5초 자리 잡기(판단 안 함), 그 뒤 12초 엔진 판단. 팀 1 RW 는 팀 0 LB 바로 앞(상대 골 58 m)에서 출발.
 * 잰다: 팀 0 LB 오버래핑 시작 · LB 최대 전진(상대 골까지 가장 가까운 m) · LB 가 상대 골 40 m 안에서 공을 받음 · 그 측면(y < 0.3W) 최종 ⅓(상대 골 35 m 안) 팀 0 소유(진입) ·
 * 팀 0 크로스 · 팀 1 RW 평균 깊이(자기 골까지 m, 12초 동안)
 */
function overlapRun(wing: string, N: number) {
  let started = 0, flank = 0, cross = 0, lbX = 0, rwDepth = 0, lbGot = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const { s, m } = overlapState(290 + k, wing);
    shape(s, 0, [8, L - 64, L - 52, L - 40]);
    shape(s, 1, [L - 1, L - 24, L - 36, L - 55]);
    const lb = byPos(s, 0, 'LB');
    const lw = byPos(s, 0, 'LW');
    const rw = byPos(s, 1, 'RW');
    place(rw, L - 58, 0.2 * W);
    place(lw, L - 42, 0.12 * W);
    place(lb, L - 62, 0.1 * W);
    s.ball.owner = lw.idx;
    s.ball.x = lw.x;
    s.ball.y = lw.y;
    s.ball.flight = null;
    s.ball.reserve = null;
    s.possTeam = 0;
    s.possOrigin = 'open';
    s.possSince = s.t;
    s.possStartT = s.t;
    // 1.5초 자리 잡기 (LW 는 공을 지킨 채 판단 안 함): 오버래핑 판단·RW 복귀가 여기서 시작된다
    const ts = s.t;
    while (s.t - ts < 1.5) { lw.cooldown = 1; place(lw, L - 42, 0.12 * W); s.ball.x = lw.x; s.ball.y = lw.y; m.step(); }
    const crosses0 = s.teams[0].stats.crosses;
    let st = false, fl = false, got = false, minGap = L - lb.x, dep = 0, nd = 0;
    const t0 = s.t;
    while (s.t - t0 < 12) {
      m.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      if (lb.overlap && s.t < lb.runUntil) st = true;
      minGap = Math.min(minGap, L - lb.x);
      const o = s.ball.owner >= 0 ? s.agents[s.ball.owner]! : null;
      if (o && o.team === 0 && o.x >= L - 35 && o.y < 0.3 * W) fl = true;
      if (o === lb && lb.x >= L - 40) got = true;
      dep += L - rw.x;
      nd++;
      if (s.restart || (o && o.team === 1)) break;
    }
    rwDepth += dep / Math.max(1, nd);
    if (got) lbGot++;
    if (st) started++;
    if (fl) flank++;
    if (s.teams[0].stats.crosses > crosses0) cross++;
    lbX += minGap;
  }
  return { started: started / N, lbGot: lbGot / N, flank: flank / N, cross: cross / N, lbGap: lbX / N, rwDepth: rwDepth / N, ok };
}

/** ㉙ 크랙형 윙어 높이 남음 → 상대 풀백 오버래핑 → 그 측면 진입·크로스 (정통 윙어·오버래핑 끔과 비교) */
export function sceneWingerOverlap(): SceneOut {
  const N = 40;
  const crack = overlapRun('crackWinger', N);
  const classic = overlapRun('classicWinger', N);
  const off = withEngine({ 'offball.fbOverlap': 0 }, () => overlapRun('crackWinger', N));
  return {
    values: {
      start: crack.started, startClassic: classic.started, startOff: off.started,
      flank: crack.flank, flankClassic: classic.flank, flankOff: off.flank,
      lbGot: crack.lbGot, lbGotClassic: classic.lbGot, lbGotOff: off.lbGot,
      cross: crack.cross, crossClassic: classic.cross, crossOff: off.cross, lbGap: crack.lbGap, lbGapOff: off.lbGap,
      rwDepth: crack.rwDepth, rwDepthClassic: classic.rwDepth,
    },
    sane: crack.ok && classic.ok && off.ok,
  };
}
