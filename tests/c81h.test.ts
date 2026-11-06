// C.81h (53단계, 엔진 묶음 B): 세컨볼 골 — 쳐낸 공 수비 반응 지연(keeper.parryDefHold) · 쳐낸 GK 일어서기(parryDownT) · 리바운드 슛 선호(decide.bias.rebound) · 롱패스 가중 · 먼 포스트 자리
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { reboundBias, shotModel } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';
import { L, W } from '../src/engine/pitch';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c81h-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c81h-a', 2018, []);
function match(seed: number) {
  return createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}

describe('C.81h 세컨볼 골 · 롱패스 · 윙어', () => {
  it('상수: 수비 반응 지연 1.0 s × 0 · GK 일어서기 2.0 s × 0.6 · 리바운드 슛 선호 0.1(5 s) · 롱패스 가중 0.4 · 윙어 마무리 0.92', () => {
    expect(ENGINE.keeper.parryDefHold).toBe(1.0);
    expect(ENGINE.keeper.parryDefControl).toBe(0);
    expect(ENGINE.keeper.parryDownT).toBe(2.0);
    expect(ENGINE.keeper.parryDownSave).toBe(0.6);
    expect(ENGINE.decide.bias.rebound).toBe(0.1);
    expect(ENGINE.decide.bias.reboundT).toBe(5);
    expect(ENGINE.decide.bias.longW).toBe(0.4);
    expect(ENGINE.offball.backPostDepth).toBe(7); // 7.5 · 0.085 는 2400경기 윙어 골 28.3 → 28.0 으로 효과 없어 되돌림
    expect(ENGINE.offball.backPostSpread).toBe(0.07);
    expect(ENGINE.prob.wingFinish).toBe(0.92);
  });

  it('리바운드 슛 선호: 우리 슛 뒤 5 s 안 · 상대 박스 안 · 슛 레인 열림이면 0.1, 박스 밖·시간 지남이면 0', () => {
    const s = match(7).state;
    const st = s.agents.filter((a) => a.team === 0 && a.line === 3)[0]!;
    const gx = s.agents.find((a) => a.team === 1 && a.line === 0)!.x;
    // 페널티 지점 근처 (상대 박스 안), 수비는 킥오프 자리라 슛 길이 비어 있다
    st.x = gx > L / 2 ? L - 11 : 11;
    st.y = W / 2;
    s.ball.owner = st.idx;
    const m = shotModel(s, st);
    s.lastShotT[0] = s.t - 1;
    const inBox = reboundBias(s, st, m);
    expect(inBox).toBeGreaterThan(0);
    expect(inBox).toBeLessThanOrEqual(0.1 + 1e-9);
    expect(inBox).toBeCloseTo(0.1 * Math.max(0, 1 - m.pBlock / ENGINE.decide.bias.shootLaneRef), 9);
    s.lastShotT[0] = s.t - 6;
    expect(reboundBias(s, st, m)).toBe(0);
    s.lastShotT[0] = s.t - 1;
    st.x = gx > L / 2 ? L - 25 : 25;
    expect(reboundBias(s, st, shotModel(s, st))).toBe(0);
  });

  it('경기 중 쳐낸 시각이 기록되고(parryT), 수비 지연은 하프타임·재개에서 비워진다', () => {
    const sim = match(11);
    let sawHold = false;
    while (!sim.state.done) {
      sim.step();
      const h = sim.state.ball.defHold;
      if (h) {
        sawHold = true;
        expect(sim.state.ball.owner).toBe(-1);
        expect(h.until - sim.state.t).toBeLessThanOrEqual(ENGINE.keeper.parryDefHold + 1e-9);
        if (sim.state.restart) expect(sim.state.ball.defHold).toBeNull();
      }
    }
    expect(sawHold).toBe(true);
    expect(Math.max(sim.state.teams[0].parryT, sim.state.teams[1].parryT)).toBeGreaterThan(0);
  });
});
