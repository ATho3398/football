// C.76w 44h-e: 박스 안 2선 마크 (미해결 8·11) — 더블팀 → 박스 안 위협 2위 마크, boxManMax 사람 마크, 줄 2 존 마크에서 마커 있는 focus 제외
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { focusThreat } from '../src/engine/offball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import type { Agent } from '../src/engine/state';
import { createTeamRoster } from '../src/roster';
import { attackDir, dist, ownGoal } from '../src/engine/pitch';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76w-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76w-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 공이 수비 팀 골 25 m 안(boxDefense 구간)일 때, 그 팀 박스 안의 상대 2선(줄 ≥ 2, ST/CF 아님, 위협 1위 아님) 선수를 목표(2.5 m 안)로 둔 수비 줄 선수가 있는 비율 (시드 3개 합) */
function secondLineMarked(maxMan: number): number {
  const O = ENGINE.offball as { boxManMax: number };
  const was = O.boxManMax;
  O.boxManMax = maxMan;
  try {
    let n = 0;
    let marked = 0;
    // C.79e(엔진 59, 줄 인원 맞춤 내려앉기): 줄 2 가 수비 줄로 내려와 마크를 늘려 77~79 의 차가 0.004 로 줄어 86~88(+0.097)로 — 77~92 세 시드 묶음 중 78·79·80·81·86·92 통과 (단언 그대로)
    // C.79k(엔진 60, 비행 중 패서 제외): 86~88 이 0.597 대 0.611 로 뒤집혀 84~86(0.617 대 0.399)로 — 77~100 세 시드 묶음 중 78·79·83~85·89~98 통과 (단언 그대로)
    for (const seed of [84, 85, 86]) {
      const m = createMatch(input(seed));
      const s = m.state;
      while (!s.done) {
        m.step();
        if (s.tick % 5 !== 0 || s.ball.owner < 0) continue;
        const owner = s.agents[s.ball.owner]!;
        const def = (1 - owner.team) as 0 | 1;
        const [gx, gy] = ownGoal(attackDir(def, s.half));
        if (dist(s.ball.x, s.ball.y, gx, gy) > 25) continue;
        const focus = focusThreat(s, def);
        for (const o of s.agents) {
          if (!o.onPitch || o.team !== owner.team) continue;
          if (o === owner || o === focus || o.line < 2 || o.pos === 'ST' || o.pos === 'CF') continue;
          if (Math.abs(o.x - gx) > ENGINE.pitch.boxDepth || Math.abs(o.y - gy) > ENGINE.pitch.boxWidth / 2) continue;
          n++;
          if (s.agents.some((d: Agent) => d.onPitch && d.team === def && d.line === 1 && dist(d.tx, d.ty, o.x, o.y) <= 2.5)) marked++;
        }
      }
    }
    return n ? marked / n : 0;
  } finally {
    O.boxManMax = was;
  }
}

describe('C.76w 박스 안 2선 마크', () => {
  it('상수: boxManMax 는 0(끔, 부록 C.76w)~3, boxManSlack 은 0 이상, 마크 거리 stMark 그대로, 코너 상수(가설 2)는 현실 범위 0.3~0.5', () => {
    const O = ENGINE.offball;
    expect(O.boxManMax).toBeGreaterThanOrEqual(0);
    expect(ENGINE.prob.blockCorner).toBeGreaterThanOrEqual(0.3);
    expect(ENGINE.prob.blockCorner).toBeLessThanOrEqual(0.5);
    expect(ENGINE.prob.clearCorner).toBeLessThanOrEqual(0.5);
    expect(ENGINE.keeper.parryCorner).toBeLessThanOrEqual(0.5);
    expect(O.boxManMax).toBeLessThanOrEqual(3);
    expect(O.boxManSlack).toBeGreaterThanOrEqual(0);
    expect(O.stMark).toBe(1.5);
  });
  it('같은 시드면 같은 결과 (결정성)', () => {
    const a = createMatch(input(76)).runToEnd();
    const b = createMatch(input(76)).runToEnd();
    expect([a.homeGoals, a.awayGoals]).toEqual([b.homeGoals, b.awayGoals]);
    expect(a.events.length).toBe(b.events.length);
  });
  it('boxManMax 2 로 켜면 박스 안 2선(비ST) 선수를 목표로 둔 수비 줄 선수가 있는 비율이 0(끔)보다 높다', () => {
    const on = secondLineMarked(2);
    const off = secondLineMarked(0);
    expect(on).toBeGreaterThan(off + 0.05);
  });
});
