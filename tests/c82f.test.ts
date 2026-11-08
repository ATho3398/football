// C.82f (53단계, 엔진 묶음 E 마무리 보정 5): 득점 총량(saveBase + 1대1 보정) · 리바운드(parryDownSave·catchSkill) · 이동 거리(fatigueIntensity) ·
// 정통 윙어 전용 크로스 가산(roles.classicWingerCross — 직접 고른 역할 rolePicked 에만) · 세트피스 대상 ST 가중 분리(setPieceTargetWst)
import { describe, expect, it } from 'vitest';
import { ENGINE, ENGINE_VERSION } from '../src/engine/config';
import { crossingOf } from '../src/engine/onball';
import { ROLES } from '../src/engine/roles';
import { createMatch } from '../src/engine/sim';
import { fillRoles, teamSetupFromRoster } from '../src/engine/setup';
import { FORMATION_SLOTS } from '../src/formations';
import { createTeamRoster } from '../src/roster';
import { chosenRole, makeTactics } from '../src/myTactics';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c82f-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c82f-a', 2018, []);
function setups() {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  return { h, w };
}
const fp = (r: ReturnType<ReturnType<typeof createMatch>['runToEnd']>) => `${r.homeGoals}:${r.awayGoals}|${r.players.map((p) => p.distance.toFixed(3)).join(',')}`;

describe('C.82f 묶음 E 마무리 보정 5', () => {
  it('상수: 엔진 103 · 리바운드 parryDownSave 0.4 · catchSkill 0.4 · 지친 감속 0.45 · 정통 윙어 크로스 가산 · 세트피스 ST 가중 3(효과 없음, CB 와 같은 값)', () => {
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(104);
    expect(ENGINE.keeper.parryDownSave).toBe(0.4);
    expect(ENGINE.keeper.catchSkill).toBe(0.4);
    expect(ENGINE.physics.fatigueIntensity).toBe(0.45);
    expect(ENGINE.roles.classicWingerCross).toBe(20);
    expect(ENGINE.prob.stFinish).toBe(1.2); // 병합 전 1.3 → C.82g 병합 뒤 1.2
    expect(ENGINE.prob.setPieceTargetWst).toBe(3);
    expect(ENGINE.prob.setPieceTargetW).toBe(3);
    expect(ENGINE.matchup.tikitaka!.direct).toEqual({ air: 5, short: 2, keep: 2, tackle: 4 }); // 960 티키>직선 −0.01 → +0.055
    expect(ENGINE.matchup.tikitaka!.counter).toEqual({ tackle: 3, air: 2 }); // 960 티키>역습 −0.29 → −0.12
    // 총량: 1대1 보정 ↑ + 슛 쪽 레버(shotFree·거리 보정) (부록 C.82f 표)
    expect(ENGINE.keeper.saveBase).toBe(2.11); // C.82g 2.11 유지 (C.82f 는 1대1·ST 배수로 총량)
    expect(ENGINE.prob.shotFree).toBe(0.30); // 총량 레버로 0.15 까지 재 봤으나 freeR 4 뒤 되돌림
    expect(ENGINE.keeper.distAdjV).toEqual([0.03, -0.13, -0.13, 0.02, 0.02, 0]);
    expect(ENGINE.keeper.oneOnOne.drop).toBe(0.55);
    expect(ENGINE.keeper.oneOnOne.freeR).toBe(4); // 3.5 m 앞 수비는 1대1 아님 (장면 ㉘)
  });

  it('직접 고른 역할 표시: 진단·시트에서 준 역할만 rolePicked, 성향 추천(fillRoles)은 아님', () => {
    const { h } = setups();
    const slots = FORMATION_SLOTS[h.formation];
    for (const p of h.lineup) delete p.role;
    fillRoles(h, (slot) => slots[slot]!.pos);
    expect(h.lineup.every((p) => !!p.role && !p.rolePicked)).toBe(true);
    const wing = h.lineup.find((p) => ['LM', 'RM', 'LW', 'RW'].includes(slots[p.slot]!.pos))!;
    wing.role = 'classicWinger';
    wing.rolePicked = true;
    const { w } = setups();
    const sim = createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 1, bigMatch: false, neutral: true });
    const picked = sim.state.agents.filter((a) => a.rolePicked);
    expect(picked.map((a) => a.id)).toEqual([wing.id]);
    expect(sim.state.agents.filter((a) => a.team === 1).every((a) => !a.rolePicked)).toBe(true);
  });

  it('정통 윙어 크로스 가산: 직접 고른 정통 윙어만 +classicWingerCross, 기본 역할 정통 윙어·직접 고른 다른 역할은 0', () => {
    const { h, w } = setups();
    const sim = createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 2, bigMatch: false, neutral: true });
    const a = sim.state.agents.find((x) => x.team === 0 && x.line === 2)!;
    const base = a.attrs.crossing;
    a.role = ROLES.classicWinger!;
    a.rolePicked = false;
    expect(crossingOf(a)).toBe(base);
    a.rolePicked = true;
    expect(crossingOf(a)).toBe(base + ENGINE.roles.classicWingerCross);
    a.role = ROLES.wideMid!;
    expect(crossingOf(a)).toBe(base);
  });

  it('기본 역할 경기는 가산 상수를 켜고 꺼도 비트 단위로 같다 (기본 역할 경로와 분리) · 직접 고른 정통 윙어 경기는 달라진다 · 결정성', () => {
    const R = ENGINE.roles as { classicWingerCross: number };
    const was = R.classicWingerCross;
    const play = (pick: boolean, seed: number) => {
      const { h, w } = setups();
      if (pick) {
        const slots = FORMATION_SLOTS[h.formation];
        const wing = h.lineup.find((p) => ['LM', 'RM', 'LW', 'RW'].includes(slots[p.slot]!.pos))!;
        wing.role = 'classicWinger';
        wing.rolePicked = true;
      }
      return fp(createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true }).runToEnd());
    };
    try {
      const seeds = [1, 2, 3];
      const on = seeds.map((k) => play(false, k));
      const onPick = seeds.map((k) => play(true, k));
      expect(seeds.map((k) => play(true, k))).toEqual(onPick); // 결정성
      R.classicWingerCross = 0;
      expect(seeds.map((k) => play(false, k))).toEqual(on);
      expect(seeds.map((k) => play(true, k)).some((v, i) => v !== onPick[i])).toBe(true);
    } finally {
      R.classicWingerCross = was;
    }
  });

  it('전술 시트: 직접 고른 역할만 chosenRole, 추천 자리는 null', () => {
    const t = makeTactics('balanced', '4-3-3', 'ST');
    expect(t.roles.every((_: string | null, i: number) => chosenRole(t, i) === null)).toBe(true);
    t.roles[8] = 'classicWinger';
    expect(chosenRole(t, 8)).toBe('classicWinger');
  });
});
