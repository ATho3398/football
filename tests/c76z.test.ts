// C.76z 44h-f3: 롱패스 비율 (미해결 2) — 압박이 없을 때 30 m 넘게 뒤로 보내는 롱볼은 "안전한 백패스 실수 후보"가 아니다 (효용 1위 gap 안에 들어야 고를 수 있다)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { choose, type Candidate } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import { attackDir } from '../src/engine/pitch';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c76z-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c76z-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 효용 1위(앞으로 몰고 가기) 와 gap 바로 밖의 백패스(뒤로 backM m) 둘만 있을 때, 틱을 바꿔 가며 choose 가 백패스를 고른 횟수 */
function backPicks(backM: number, pressed = false): number {
  const m = createMatch(input(5));
  const s = m.state;
  for (let i = 0; i < 300; i++) m.step();
  const a = s.agents.find((x) => x.onPitch && x.team === 0 && x.line === 2)!;
  const mate = s.agents.find((x) => x.onPitch && x.team === 0 && x !== a && x.line === 1)!;
  const dir = attackDir(0, s.half);
  a.x = 55; a.y = 34; a.vx = 0; a.vy = 0; a.backToGoal = false;
  // 압박: 상대를 모두 5 m 밖으로 치우고, pressed 면 한 명만 1 m 옆에 둔다
  let first = true;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === 0) continue;
    if (pressed && first) { o.x = a.x + 1; o.y = a.y; first = false; continue; }
    if (Math.abs(o.x - a.x) < 6) o.x = a.x - dir * 12;
  }
  const O = ENGINE.onball;
  const top: Candidate = { type: 'carry', p: 0.9, u: 0.03, x: a.x + dir * 8, y: a.y, receiver: -1, value: 0.03 };
  const back: Candidate = { type: 'pass', p: 0.95, u: 0.03 - O.plausibleGap - 0.004, x: a.x - dir * backM, y: a.y, receiver: mate.idx, value: 0.02 };
  let picks = 0;
  for (let t = 0; t < 400; t++) {
    s.tick = 1000 + t;
    if (choose(s, a, [top, back]) === back) picks++;
  }
  return picks;
}

describe('C.76z 롱 백패스는 실수 후보가 아니다', () => {
  it('상수: 롱볼 기준 30 m, plausibleGap 0.015 그대로 (판단식만 바꿈)', () => {
    expect(ENGINE.tactics.longBall).toBe(30);
    expect(ENGINE.onball.plausibleGap).toBe(0.015);
  });
  it('압박 없음: gap 밖의 짧은 백패스(12 m)는 실수 후보로 가끔 고르지만, 같은 효용의 롱 백패스(36 m)는 한 번도 고르지 않는다', () => {
    expect(backPicks(12)).toBeGreaterThan(0);
    expect(backPicks(36)).toBe(0);
  });
  it('압박 있음(상대 1 m): 롱 백패스(36 m)도 실수 후보로 가끔 고른다', () => {
    expect(backPicks(36, true)).toBeGreaterThan(0);
  });
  it('결정성: 같은 시드 두 번 돌리면 같은 결과', () => {
    const a = createMatch(input(9)); const b = createMatch(input(9));
    while (!a.state.done) a.step();
    while (!b.state.done) b.step();
    expect(a.state.teams.map((t) => t.stats.goals)).toEqual(b.state.teams.map((t) => t.stats.goals));
    expect(a.state.teams.map((t) => t.stats.longPasses)).toEqual(b.state.teams.map((t) => t.stats.longPasses));
  });
});
