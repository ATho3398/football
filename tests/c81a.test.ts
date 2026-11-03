// C.81a (53단계): 크로스 박스 인원 처방(edgeZone 12 · lateRunFromX 0.6 · 판단 crossBox 0.06) · 착지 순간 박스 인원 지표 · 골문 앞 쇄도(끔) · 실험 스위치 정리
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { candidates } from '../src/engine/onball';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createTeamRoster } from '../src/roster';
import { L } from '../src/engine/pitch';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c81a-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c81a-a', 2018, []);
function match(seed: number) {
  return createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}

describe('C.81a 박스 인원 · 리바운드', () => {
  it('상수: edgeZone 12 · lateRunFromX 0.6 · crossBox 0.06(3명) · 쇄도 끔 · 실험 스위치(parryDown·parryFootBlock·shotFollow) 없음', () => {
    expect(ENGINE.offball.edgeZone).toBe(12);
    expect(ENGINE.offball.lateRunFromX).toBe(0.6);
    expect(ENGINE.decide.bias.crossBox).toBe(0.06);
    expect(ENGINE.decide.bias.crossBoxMin).toBe(3);
    expect(ENGINE.offball.shotRush).toBe(0);
    expect('shotFollow' in ENGINE.offball).toBe(false);
    expect('parryDown' in ENGINE.keeper).toBe(false);
    expect('parryFootBlock' in ENGINE.keeper).toBe(false);
  });

  it('착지 순간 박스 인원을 센다 (표본 수 ≤ 크로스·컷백 수, 평균 0~10)', () => {
    const sim = match(3);
    while (!sim.state.done) sim.step();
    for (const t of sim.state.teams) {
      expect(t.stats.boxLandN).toBeLessThanOrEqual(t.stats.boxCrossN);
      if (t.stats.boxLandN) expect(t.stats.boxAtLand / t.stats.boxLandN).toBeLessThanOrEqual(10);
    }
    expect(sim.state.teams[0].stats.boxLandN + sim.state.teams[1].stats.boxLandN).toBeGreaterThan(0);
  });

  it('크로스 효용 감점: 박스 동료가 3명보다 적으면 모자란 1명당 −0.06 (판단만)', () => {
    const s = match(5).state;
    const fw = s.agents.filter((a) => a.team === 0 && a.line === 3);
    const w = fw[0]!;
    const st = fw[1]!;
    // 킥오프 상태(팀 0 다른 선수는 모두 자기 진영 = 상대 박스 0명)에서 상대 박스 옆 측면으로 옮김 · 받을 공격수 1명만 페널티 지점 → 모자람 2명 = 감점 0.12
    const gx = s.agents.find((a) => a.team === 1 && a.line === 0)!.x;
    w.x = gx > L / 2 ? L - 18 : 18;
    w.y = 6;
    st.x = gx > L / 2 ? L - 11 : 11;
    st.y = 34;
    s.ball.owner = w.idx;
    const crossU = (bias: number) => {
      const B = ENGINE.decide.bias as { crossBox: number };
      const was = B.crossBox;
      B.crossBox = bias;
      try {
        return candidates(s, w).filter((c) => c.type === 'cross').map((c) => c.u);
      } finally {
        B.crossBox = was;
      }
    };
    const on = crossU(0.06);
    const off = crossU(0);
    expect(on.length).toBeGreaterThan(0);
    expect(on.length).toBe(off.length);
    for (let i = 0; i < on.length; i++) expect(off[i]! - on[i]!).toBeCloseTo(0.12, 9);
  });
});
