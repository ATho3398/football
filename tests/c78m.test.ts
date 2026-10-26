// C.78m: 침투 패스를 달리며 받기(C.78b runOn, runSnap m 안 바로 받기) — 받는 틱에 공이 받은 선수 발밑에 있다 (비행 끝점에 남으면 다음 틱 3 m 넘게 튐, 순간이동 가드)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { caught } from '../src/engine/actions';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createState, step } from '../src/engine/sim';
import type { SimState } from '../src/engine/state';
import type { EngineInput } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 76 }, 'c78m-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 76 }, 'c78m-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 76, 76),
  away: teamSetupFromRoster(away, 76, 76),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false,
});

function live(s: SimState): void {
  for (let i = 0; i < 3000 && (s.restart || s.ball.owner < 0); i++) step(s);
}

describe('C.78m 달리며 받기 — 공이 받은 선수 발밑으로', () => {
  it('runSnap 안(2.2 m)에서 침투 패스를 바로 받으면 받는 틱에 공이 선수 위치, 다음 틱 공 이동 ≤ 3 m', () => {
    const s = createState(input(3));
    live(s);
    const b = s.ball;
    const passer = s.agents[b.owner]!;
    const a = s.agents.find((x) => x.onPitch && x.team === passer.team && x.line === 3)!;
    const [tx, ty] = [a.x + 2.2, a.y];
    expect(2.2).toBeLessThanOrEqual(ENGINE.receive.runSnap);
    a.vx = 6;
    a.vy = 0;
    const fl = { kind: 'pass' as const, fromX: passer.x, fromY: passer.y, toX: tx, toY: ty, t0: s.t - 1, dur: 1, air: false, passer: passer.idx, receiver: a.idx, outcome: 'receive' as const, interceptor: -1, through: true };
    b.owner = -1;
    b.x = tx;
    b.y = ty;
    caught(s, a, { idx: a.idx, until: s.t + 1, kind: 'receive', from: -1, fl });
    expect(b.owner).toBe(a.idx);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.01);
    const [px, py] = [b.x, b.y];
    step(s);
    expect(Math.hypot(b.x - px, b.y - py)).toBeLessThanOrEqual(3);
  });
});
