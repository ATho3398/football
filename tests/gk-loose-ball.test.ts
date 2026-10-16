import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { keeperZone, sweepRange } from '../src/engine/keeper';
import { updateOffball } from '../src/engine/offball';
import { attackDir, ownGoal } from '../src/engine/pitch';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState, step } from '../src/engine/sim';
import type { Agent, SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 76 }, 'gk-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 74 }, 'gk-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 76, 74),
  away: teamSetupFromRoster(away, 74, 76),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false,
});

/** 오픈 플레이 루즈볼 상황: 팀 0 GK 를 골 앞 dx m 에 두고, 다른 선수는 모두 하프라인 근처로 */
function looseScene(seed: number, ballDx: number, ballDy: number, vx = 0, vy = 0): { s: SimState; gk: Agent; dir: 1 | -1 } {
  const s = createState(input(seed));
  s.restart = null;
  const dir = attackDir(0, 1);
  const [gx, gy] = ownGoal(dir);
  const gk = s.agents.find((a) => a.onPitch && a.team === 0 && a.line === 0)!;
  for (const a of s.agents) {
    if (!a.onPitch) continue;
    a.vx = a.vy = 0;
    a.x = a === gk ? gx + dir * 4 : gx + dir * 50;
    a.y = a === gk ? gy : 10 + (a.idx % 11) * 4;
    a.nextOffball = 0;
  }
  const b = s.ball;
  Object.assign(b, { owner: -1, flight: null, reserve: null, kick: null, handBlock: null, x: gx + dir * ballDx, y: gy + ballDy, vx: vx * dir, vy, lastTeam: 1, lastTouch: -1 });
  return { s, gk, dir };
}

describe('GK 루즈볼 처리 (C.28)', () => {
  it('박스 안에서 아무도 없는 루즈볼은 GK 가 나가서 손으로 잡는다 (배급까지 holdTime)', () => {
    const { s, gk } = looseScene(1, 12, 3);
    updateOffball(s, gk);
    expect(s.teams[0].gkChase).toBe(true);
    expect(gk.urgent).toBe(true);
    for (let k = 0; k < 40 && s.ball.owner !== gk.idx; k++) step(s);
    expect(s.ball.owner).toBe(gk.idx);
    expect(gk.cooldown).toBeGreaterThan(ENGINE.keeper.holdTime - 0.5);
  });

  it('상대가 먼저 닿는 공에는 나가지 않는다', () => {
    const { s, gk, dir } = looseScene(2, 12, 3);
    const opp = s.agents.find((a) => a.onPitch && a.team === 1 && a.line === 3)!;
    opp.x = s.ball.x + dir * 1.5;
    opp.y = s.ball.y;
    updateOffball(s, gk);
    expect(s.teams[0].gkChase).toBe(false);
  });

  it('같은 팀이 발로 준 공(백패스)은 손을 쓰지 않는다: 발 컨트롤이라 배급 대기가 짧다', () => {
    const { s, gk } = looseScene(3, 4.5, 0.5);
    s.ball.lastTeam = 0;
    s.ball.kick = { kind: 'pass', team: 0, receiver: gk.idx };
    for (let k = 0; k < 40 && s.ball.owner !== gk.idx; k++) step(s);
    expect(s.ball.owner).toBe(gk.idx);
    expect(gk.cooldown).toBeLessThan(ENGINE.keeper.holdTime - 1);
  });

  it('처리 구역: 클래식은 자기 박스만, 스위퍼는 박스 밖 sweepRange 안까지', () => {
    const { s, gk, dir } = looseScene(4, 10, 0);
    const [gx, gy] = ownGoal(dir);
    const out = (m: number) => gx + dir * (ENGINE.pitch.boxDepth + m);
    gk.gk = { ...gk.gk!, type: 'classic' };
    expect(sweepRange(gk)).toBe(0);
    expect(keeperZone(s, gk, gx + dir * 10, gy)).toBe(true);
    expect(keeperZone(s, gk, out(3), gy)).toBe(false);
    gk.gk = { ...gk.gk!, type: 'sweeper' };
    const r = sweepRange(gk);
    expect(r).toBeGreaterThanOrEqual(ENGINE.keeper.sweepRange[0]);
    expect(r).toBeLessThanOrEqual(ENGINE.keeper.sweepRange[1]);
    expect(keeperZone(s, gk, out(r - 0.5), gy)).toBe(true);
    expect(keeperZone(s, gk, out(r + 0.5), gy)).toBe(false);
  });
});
