// C.77k 44h-f3c: 롱패스 비율 (미해결 2) — choose() 의 gap·온도 바닥을 팀 빌드업 성향(tactics.style)에 비례.
// 직선(style ≤ styleDirectAt)은 중원에서도 넓게(절대 gap), 짧게·혼합(≥ styleMixedAt)은 gapFloor 까지 좁혀 고른다
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { choose, type Candidate } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import { attackDir } from '../src/engine/pitch';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c77k-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c77k-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

/** 자기 진영 중원에서 효용 1위(몰고 가기)와 1위 − 0.9 × plausibleGap 의 전진 패스 둘만 있을 때, 빌드업 style 별로 전진 패스를 고른 횟수 */
function altPicks(style: number): number {
  const m = createMatch(input(5));
  const s = m.state;
  for (let i = 0; i < 300; i++) m.step();
  s.teams[0].tactics.style = style;
  const a = s.agents.find((x) => x.onPitch && x.team === 0 && x.line === 2)!;
  const mate = s.agents.find((x) => x.onPitch && x.team === 0 && x !== a && x.line === 3)!;
  const dir = attackDir(0, s.half);
  a.x = 52.5 - dir * 20; a.y = 34; a.vx = 0; a.vy = 0; a.backToGoal = false;
  for (const o of s.agents) if (o.onPitch && o.team !== 0 && Math.abs(o.x - a.x) < 8) o.x = a.x - dir * 12;
  const O = ENGINE.onball;
  const top: Candidate = { type: 'carry', p: 0.9, u: 0.02, x: a.x + dir * 8, y: a.y, receiver: -1, value: 0.02 };
  const alt: Candidate = { type: 'pass', p: 0.9, u: 0.02 - 0.9 * O.plausibleGap, x: a.x + dir * 20, y: a.y, receiver: mate.idx, value: 0.02 };
  let picks = 0;
  for (let t = 0; t < 400; t++) {
    s.tick = 1000 + t;
    if (choose(s, a, [top, alt]) === alt) picks++;
  }
  return picks;
}

describe('C.77k 선택 폭은 빌드업 성향 비례', () => {
  it('상수: styleDirectAt 0.2 · styleMixedAt 0.5 · gapFloor 0.8 · tempFloor 0.4', () => {
    expect(ENGINE.tactics.styleDirectAt).toBe(0.2);
    expect(ENGINE.tactics.styleMixedAt).toBe(0.5);
    expect(ENGINE.onball.gapFloor).toBe(0.8);
    expect(ENGINE.onball.tempFloor).toBe(0.4);
  });
  it('자기 진영 중원: 직선(0.2)은 1위 − 0.9 gap 후보를 가끔 고르고, 혼합(0.5)·짧게(0.85)는 고르지 않는다', () => {
    expect(altPicks(0.2)).toBeGreaterThan(0);
    expect(altPicks(0.5)).toBe(0);
    expect(altPicks(0.85)).toBe(0);
  });
});
