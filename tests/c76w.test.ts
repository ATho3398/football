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

/** 공이 수비 팀 골 25 m 안일 때, 그 팀 박스 안의 상대 2선(줄 ≥ 2, ST/CF 아님, 위협 1위 아님) 선수에게 2.5 m 안 수비수가 있는 비율 */
function secondLineMarked(seed: number, maxMan: number): number {
  const O = ENGINE.offball as { boxManMax: number };
  const was = O.boxManMax;
  O.boxManMax = maxMan;
  try {
    const m = createMatch(input(seed));
    const s = m.state;
    let n = 0;
    let marked = 0;
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
        if (s.agents.some((d: Agent) => d.onPitch && d.team === def && d.line !== 0 && dist(d.x, d.y, o.x, o.y) <= 2.5)) marked++;
      }
    }
    return n ? marked / n : 0;
  } finally {
    O.boxManMax = was;
  }
}

describe('C.76w 박스 안 2선 마크', () => {
  it('상수: boxManMax 는 1~3, boxManSlack 은 0 이상, 마크 거리 stMark 그대로', () => {
    const O = ENGINE.offball;
    expect(O.boxManMax).toBeGreaterThanOrEqual(1);
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
  it('박스 안 2선(비ST) 선수 2.5 m 안에 수비수가 있는 비율이 boxManMax 0 보다 높다', () => {
    const on = secondLineMarked(77, ENGINE.offball.boxManMax);
    const off = secondLineMarked(77, 0);
    expect(on).toBeGreaterThan(off);
  });
});
