// C.80i (53단계): 직선 성향 반대 전환 보임 확률 가산 · 반대 전환 판단 보너스(코드만, 끔)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { settledDeep, visible, type Candidate } from '../src/engine/onball';
import { W } from '../src/engine/pitch';
import { createTeamRoster } from '../src/roster';
import { PATCH_LABEL } from '../src/version';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80i-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80i-a', 2018, []);
const state = () => createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed: 5, bigMatch: false }).state;

/** 공 반대 측면으로 40 m 옆 패스 후보를 ticks 번 보인 비율 */
function seenShare(tendency: 'direct' | 'balanced', deep = true): number {
  const s = state();
  // 내려앉은 블록: 상대 필드 선수 전부 패서보다 골 쪽(x 80) — deep = false 면 하프라인 뒤(x 40)
  for (const o of s.agents) if (o.team === 1 && o.line > 0) o.x = deep ? 80 : 40;
  const a = s.agents.find((x) => x.team === 0 && x.line === 2)!;
  const r = s.agents.find((x) => x.team === 0 && x.line === 3 && x !== a)!;
  s.teams[0].tactics = { ...s.teams[0].tactics, tendency };
  a.x = 60; a.y = 10; a.vx = 0; a.vy = 0; a.backToGoal = false;
  a.attrs = { ...a.attrs, vision: 60 };
  const c: Candidate = { type: 'pass', p: 0.7, u: 0, x: 60, y: W - 10, receiver: r.idx, value: 0 };
  let seen = 0;
  for (let k = 0; k < 400; k++) {
    s.tick = k;
    if (visible(s, a, c, 0)) seen++;
  }
  return seen / 400;
}

describe('C.80i 직선 반대 전환', () => {
  it('스위치 기본값: 보임 가산 0.45 켬(C.80o 0.3 → 0.45) · 전환 판단 보너스 끔(코드만)', () => {
    const B = ENGINE.decide.bias;
    expect(B.directSwitchScan).toBe(0.45);
    expect(B.directSwitch).toBe(0);
    expect(B.directSwitchDy).toBe(25);
    expect(PATCH_LABEL).toMatch(/^C\.8/);
  });

  it('직선 성향은 내려앉은 상대 앞에서 반대 전환 패스를 균형보다 더 자주 본다(시야 60: 약 38% → C.80o 0.45 에서 약 84%) · C.80p: 상대가 안 내려앉았으면(평균 x < 0.6) 가산 없음', () => {
    const b = seenShare('balanced');
    expect(b).toBeGreaterThan(0.25);
    expect(b).toBeLessThan(0.5);
    const d = seenShare('direct', true);
    expect(d).toBeGreaterThan(0.7);
    expect(d).toBeLessThan(0.92);
    const open = seenShare('direct', false);
    expect(Math.abs(open - b)).toBeLessThan(0.08);
    expect(ENGINE.decide.bias.directScanOpen).toBe(0);
    expect(ENGINE.decide.bias.directScanDeepX).toBe(0.6);
  });

  it('반대 전환 판단 보너스(끔)의 상황 조건: 패서 x ≥ directSwitchFromX · 상대 8명 이상 공 뒤', () => {
    const s = state();
    const a = s.agents.find((x) => x.team === 0 && x.line === 2)!;
    a.x = 30;
    for (const o of s.agents) if (o.team === 1 && o.line > 0) o.x = 80;
    expect(settledDeep(s, a)).toBe(false); // 패서가 자기 진영 깊숙이(x < directSwitchFromX)
    a.x = 60;
    expect(settledDeep(s, a)).toBe(true);
  });
});
