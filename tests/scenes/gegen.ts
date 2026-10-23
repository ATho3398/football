// 기준 장면 ⑮⑯⑰ (C.78c, 게겐 상성 실축 방향): 깊은 블록 상대 게겐 압박 · 압박받은 CB 의 롱볼 건너뛰기 · 티키 빌드업 상대 게겐 압박.
// 팀 0 = 게겐(+x 공격, 자기 골 x = 0), 팀 1 = 상대(자기 골 x = L). ⑮⑰ 은 엔진 step 전체(판단·이동·경합이 실제 경기와 같은 길), 시드 20개 비율.

import { turnover } from '../../src/engine/core';
import { candidates, choose, landingShare } from '../../src/engine/onball';
import { arrivalTime } from '../../src/engine/physics';
import { dist, L } from '../../src/engine/pitch';
import { tacticsOf } from '../../src/engine/tactics';
import type { Agent, SimState } from '../../src/engine/state';
import type { Tendency } from '../../src/engine/types';
import { pick, place, sane, sceneSim, sceneState, setBody, withEngine } from './harness';
import type { SceneOut } from './scenes';

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

/**
 * 게겐(팀 0)이 공을 잃은 직후 8초를 엔진 step 으로: 역압박 가담 수 · 상대 첫 공 처리(30 m+ 롱볼·걷어내기 비율) · 6초 안 게겐 되찾음 · 되찾은 높이(상대 골에서 m).
 * 첫 공 처리 = 상대 팀이 처음 공을 차거나(비행) 잃은 순간
 */
function lossRun(opp: Tendency, xs0: number[], xs1: number[], ballAt: [number, number], N: number) {
  let press = 0;
  let long = 0;
  let firsts = 0;
  let regain = 0;
  let regainHigh = 0;
  let hSum = 0;
  let ok = true;
  for (let k = 0; k < N; k++) {
    const s = sceneState(150 + k);
    s.teams[0].tactics = tacticsOf('gegenpress');
    s.teams[0].setup.tactics = s.teams[0].tactics;
    s.teams[1].tactics = tacticsOf(opp);
    s.teams[1].setup.tactics = s.teams[1].tactics;
    layout(s, xs0, xs1);
    // 공 주변: 상대 중원 1명이 공, 게겐 공격 줄·중원이 공 근처(잃은 순간)
    const own = pick(s, 1, 2, 1);
    place(own, ballAt[0], ballAt[1]);
    const g = s.agents.filter((a) => a.team === 0 && a.line >= 2).sort((x, y) => dist(x.x, x.y, own.x, own.y) - dist(y.x, y.y, own.x, own.y));
    g.slice(0, 3).forEach((a, j) => place(a, own.x - 3 - j * 2, own.y + (j - 1) * 4));
    giveBall(s, own);
    turnover(s, 0, true);
    s.possTeam = 1;
    press += s.teams[0].counterPressers.length;
    let first = false;
    let won = false;
    const t0 = s.t;
    while (s.t - t0 < 8) {
      const b = s.ball;
      sceneSim!.step();
      ok &&= sane(...s.agents.filter((a) => a.onPitch));
      if (!first && b.flight && b.flight.passer >= 0 && s.agents[b.flight.passer]!.team === 1) {
        first = true;
        firsts++;
        if (dist(b.flight.fromX, b.flight.fromY, b.flight.toX, b.flight.toY) >= 30 || b.flight.kind === 'clear') long++;
      }
      if (!won && b.owner >= 0 && s.agents[b.owner]!.team === 0 && s.t - t0 <= 6) {
        won = true;
        regain++;
        const h = L - b.x;
        hSum += h;
        if (h <= 35) regainHigh++;
        if (!first) { first = true; firsts++; }
      }
      if (won || s.restart) break;
    }
  }
  return { press: press / N, long: long / Math.max(1, firsts), regain: regain / N, regainHigh: regainHigh / N, h: regain ? hSum / regain : 99, ok };
}

/** ⑮ 깊은 블록(버스, 수비 줄 상대 골 9 m · 중원 17 m)에서 상대 박스 앞 20 m 에서 공을 잃은 게겐 */
export function sceneDeepPress(): SceneOut {
  const r = lossRun('bus', [6, 55, 74, 84], [L - 1, L - 9, L - 17, L - 45], [L - 20, 30], 20);
  return { values: { press: r.press, long: r.long, regain: r.regain, regainHigh: r.regainHigh, regainH: r.h }, sane: r.ok };
}

/** ⑰ 티키타카 빌드업(수비 줄 상대 골 20 m · 중원 38 m, 짧게 연결)에서 상대 박스 앞 20 m 에서 공을 잃은 게겐 */
export function sceneBuildPress(): SceneOut {
  const r = lossRun('tikitaka', [6, 50, 70, 82], [L - 1, L - 18, L - 36, L - 55], [L - 20, 30], 20);
  return { values: { press: r.press, long: r.long, regain: r.regain, regainHigh: r.regainHigh, regainH: r.h }, sane: r.ok };
}

/**
 * ⑯ 압박받은 CB 의 건너뛰기: 상대(팀 1, 버스) CB 가 자기 골 12 m 에서 공, 게겐 2명이 2.5·4 m 에서 압박, 게겐 수비 줄은 자기 골 45 m(높은 라인),
 * 상대 빠른 ST(속도 90)는 게겐 라인 바로 앞 47 m. 잰다: 선택 400번 중 30 m+ 롱볼·걷어내기 비율(착지점 몫 켬 대 끔은 테스트가 비교) ·
 * ST 에게 가는 롱볼 후보의 착지점 몫 · 착지점(라인 뒤) 도착 시간 ST 대 가장 가까운 게겐 수비
 */
export function sceneLongEscape(): SceneOut {
  const run = (landShare: number) => withEngine({ 'onball.landShare': landShare }, () => {
    const s = sceneState(16);
    s.teams[0].tactics = tacticsOf('gegenpress');
    s.teams[1].tactics = tacticsOf('bus');
    layout(s, [6, 45, 62, 80], [L - 1, L - 10, L - 18, 47]);
    const cb = pick(s, 1, 1, 1);
    const st = pick(s, 1, 3, 0);
    place(cb, L - 12, 26);
    // ST 는 게겐 라인(45 m) 바로 앞에서 라인 뒤로 뛰기 시작 (침투)
    place(st, 47, 30, -6, 0);
    setBody(st, 90);
    st.runUntil = s.t + 3;
    const pr = s.agents.filter((a) => a.team === 0 && a.line === 3);
    place(pr[0]!, L - 14.5, 26);
    if (pr[1]) place(pr[1], L - 15, 30);
    giveBall(s, cb);
    let long = 0;
    let toSt = 0;
    const N = 400;
    for (let k = 0; k < N; k++) {
      s.tick = 6000 + k;
      const c = choose(s, cb, candidates(s, cb));
      if (c.type === 'clear' || (c.receiver >= 0 && dist(cb.x, cb.y, c.x, c.y) >= 30)) long++;
      if (c.receiver === st.idx) toSt++;
    }
    s.tick = 6000;
    const c = candidates(s, cb).find((x) => x.receiver === st.idx)!;
    const q = landingShare(s, 1, c.x, c.y, dist(cb.x, cb.y, c.x, c.y) / 25, cb);
    const def = s.agents.filter((a) => a.team === 0 && a.line === 1).sort((x, y) => dist(x.x, x.y, c.x, c.y) - dist(y.x, y.y, c.x, c.y))[0]!;
    return { long: long / N, toSt: toSt / N, q, tSt: arrivalTime(st, c.x, c.y), tDef: arrivalTime(def, c.x, c.y), behind: c.x < 45 ? 1 : 0, ok: sane(...s.agents) };
  });
  const on = run(1);
  const off = run(0);
  return {
    values: { longOn: on.long, longOff: off.long, toStOn: on.toSt, toStOff: off.toSt, q: on.q, tSt: on.tSt, tDef: on.tDef, behind: on.behind },
    sane: on.ok && off.ok,
  };
}
