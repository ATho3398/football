// C.81t (53단계, 엔진 묶음 D): 세컨볼 구조 — 리바운드 대비 런(offball.reboundRun): 우리 슛이 날아가는 동안·슛 뒤 루즈볼 때 골 앞 자리로 전력
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';
import { attackDir, L, W } from '../src/engine/pitch';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c81t-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c81t-a', 2018, []);
function match(seed: number) {
  return createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}

describe('C.81t 세컨볼 구조: 리바운드 대비 런', () => {
  it('상수: 리바운드 대비 런 켬 (명수·반경·깊이·옆 폭·루즈 창·오프사이드 제한·마중) · GK 일어서기 3.0 s', () => {
    const O = ENGINE.offball;
    expect(ENGINE.keeper.parryDownT).toBe(3.0);
    expect(O.reboundRun).toBe(3);
    expect(O.reboundRunR).toBe(24);
    expect(O.reboundRunDepth).toBe(7);
    expect(O.reboundRunSpread).toBe(4.5);
    expect(O.reboundRunT).toBe(2.5);
    expect(O.reboundRunOffside).toBe(1);
    expect(O.reboundRunIntercept).toBe(1);
  });

  it('우리 유효 슈팅이 날아가는 동안 골 24 m 안 2선·공격수(슈터 제외) 중 가까운 n명은 골 앞 자리로 전력(urgent)', () => {
    // 슛 비행이 처음 나오는 시드까지 돌려 그 틱의 offball 목표를 본다
    let found = false;
    for (let seed = 1; seed <= 12 && !found; seed++) {
      const sim = match(seed);
      const s = sim.state;
      while (!s.done && !found) {
        sim.step();
        const fl = s.ball.flight;
        if (!fl || fl.kind !== 'shot' || fl.outcome !== 'shot' || s.restart) continue;
        const shooter = s.agents[fl.passer]!;
        const dir = attackDir(shooter.team, s.half);
        const gx = dir > 0 ? L : 0;
        const sx = gx - dir * ENGINE.offball.reboundRunDepth;
        const near = s.agents.filter((o) => o.onPitch && o.team === shooter.team && o.line >= 2 && o.idx !== shooter.idx && Math.hypot(o.x - gx, o.y - W / 2) < ENGINE.offball.reboundRunR)
          .sort((p, q) => Math.hypot(p.x - sx, p.y - W / 2) - Math.hypot(q.x - sx, q.y - W / 2) || p.idx - q.idx);
        if (!near.length) continue;
        // 같은 틱에 step 이 offball 을 이미 돌렸으므로 목표가 잡혀 있다
        for (const o of near.slice(0, ENGINE.offball.reboundRun)) {
          expect(o.urgent).toBe(true);
          expect(Math.abs(o.ty - W / 2)).toBeLessThanOrEqual(ENGINE.offball.reboundRunSpread + 1e-9);
          expect(dir > 0 ? o.tx : L - o.tx).toBeGreaterThanOrEqual(L - ENGINE.offball.reboundRunDepth - 30);
        }
        found = true;
      }
    }
    expect(found).toBe(true);
  });

  it('끄면(reboundRun 0) 같은 시드 경기가 켠 것과 달라진다(움직임이 실제로 작동)', () => {
    const on = match(3).runToEnd();
    const O = ENGINE.offball as { reboundRun: number };
    const prev = O.reboundRun;
    O.reboundRun = 0;
    try {
      const off = match(3).runToEnd();
      const sig = (r: typeof on) => r.players.map((p) => p.distance).join(',');
      expect(sig(off)).not.toBe(sig(on));
    } finally {
      O.reboundRun = prev;
    }
  });
});
