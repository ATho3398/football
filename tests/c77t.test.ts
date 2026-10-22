// C.77t (44h-k, 진단 §9.17): GK 위치 선방 — 도달 항 cover, 판단용 xG 도 실제 GK 위치를 본다
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { farSide, keeperCover, keeperOf } from '../src/engine/keeper';
import { shotModel } from '../src/engine/onball';
import { attackDir, oppGoal } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import { createTeamRoster } from '../src/roster';

const K = ENGINE.keeper;

function match(seed = 1000) {
  const home = createTeamRoster({ id: 'h', rating: 75 }, 'c77t-h', 2018, []);
  const away = createTeamRoster({ id: 'a', rating: 75 }, 'c77t-a', 2018, []);
  return createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false });
}

describe('C.77t GK 도달 항', () => {
  it('GK 가 슛 선 위에 있으면 cover 1, 멀리 비켜 있으면 0', () => {
    // 슛 선: (10, 30) → (0, 34)
    expect(keeperCover(4, 31.6, 10, 30, 0, 34, 28, 76)).toBe(1);
    expect(keeperCover(2, 26, 10, 30, 0, 34, 28, 76)).toBe(0);
  });

  it('공이 GK 에 늦게 닿을수록·선방이 높을수록 도달 반경이 넓다', () => {
    const near = keeperCover(1, 32.5, 6, 34, 0, 36, 28, 76);
    const far = keeperCover(1, 32.5, 20, 34, 0, 36, 28, 76);
    expect(far).toBeGreaterThan(near);
    expect(keeperCover(1, 32.5, 6, 34, 0, 36, 28, 90)).toBeGreaterThanOrEqual(keeperCover(1, 32.5, 6, 34, 0, 36, 28, 40));
    expect(K.reachBase).toBeGreaterThan(0);
  });

  it('GK 반대편 구석: 가운데에서 비켜 있으면 반대쪽, 가운데면 null', () => {
    const s = match().state;
    const gk = keeperOf(s, 1)!;
    gk.y = 34 + 1;
    expect(farSide(gk, 34)).toBe(-1);
    gk.y = 34 - 1;
    expect(farSide(gk, 34)).toBe(1);
    gk.y = 34;
    expect(farSide(gk, 34)).toBeNull();
  });

  it('판단용 xG: 같은 자리 슛이라도 GK 가 쏠려 있으면 pGoal·xG 가 오른다 (빈 골 = 빅찬스)', () => {
    const s = match().state;
    const a = s.agents.find((o) => o.team === 0 && o.line === 3)!;
    const dir = attackDir(0, s.half);
    const [gx, gy] = oppGoal(dir);
    for (const o of s.agents) if (o.team === 1 && o.line !== 0) { o.x = gx - dir * 40; o.y = 5; }
    a.x = gx - dir * 9;
    a.y = gy + 2;
    const gk = keeperOf(s, 1)!;
    gk.x = gx - dir * 2;
    gk.y = gy + 0.5;
    const centred = shotModel(s, a);
    gk.x = gx - dir * 5;
    gk.y = gy + 7;
    const open = shotModel(s, a);
    expect(open.pGoal).toBeGreaterThan(centred.pGoal + 0.2);
    expect(open.xg).toBeGreaterThan(0.4);
  });

  it('같은 시드 경기는 결정적이다', () => {
    const run = () => {
      const m = match(4242);
      while (!m.state.done) m.step();
      return [m.state.teams[0].stats.goals, m.state.teams[1].stats.goals, m.state.teams[0].stats.saves, m.state.teams[1].stats.saves].join('-');
    };
    expect(run()).toBe(run());
  });
});
