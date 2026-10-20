// C.76k 44h-b: 약팀 내려앉기 · 버스 세우기 · 지고 있을 때 올리기 예외 · 압박 속 슛 구석 (사용자 확정 2026-10-20 ①~③)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createState } from '../src/engine/sim';
import { teamSetupFromRoster, underdogPlan } from '../src/engine/setup';
import { aiAdjust, LEVEL_NAMES_KO, LEVELS, levelOf, recommendedRole, tacticsOf, TENDENCIES, TENDENCY, TENDENCY_DESC_KO, TENDENCY_NAMES_KO, tendencyLevels, validLevel } from '../src/engine/tactics';
import { halftimeSets, tacticsVM } from '../src/ui/viewModels';
import { makeTactics, validTactics } from '../src/myTactics';
import { migrate, serialize } from '../src/save';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { createTeamRoster } from '../src/roster';
import type { EngineInput } from '../src/engine/types';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'real-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'real-a', 2018, []);
const input = (seed: number): EngineInput => ({
  home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75),
  mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true,
});

describe('C.76k 라인 4단 · 버스 세우기', () => {
  it("라인은 4단('매우 낮음' 0.2), 나머지는 3단. 성향 기본값은 값이 그대로", () => {
    expect(LEVELS.lineHeight).toEqual([0.2, 0.35, 0.5, 0.65]);
    expect(LEVEL_NAMES_KO.lineHeight).toEqual(['매우 낮음', '낮음', '보통', '높음']);
    expect(LEVEL_NAMES_KO.pressing).toHaveLength(3);
    expect(tacticsOf('balanced').lineHeight).toBe(0.5);
    expect(tacticsOf('block').lineHeight).toBe(0.35);
    expect(tacticsOf('tikitaka').lineHeight).toBe(0.65);
    expect(tendencyLevels('balanced').lineHeight).toBe(2);
    expect(levelOf('lineHeight', 0.2)).toBe(0);
    expect(validLevel('lineHeight', 3)).toBe(true);
    expect(validLevel('pressing', 3)).toBe(false);
    // 3단 세부 전술에 단계 3 이 와도 마지막 단계
    expect(tacticsOf('balanced', { pressing: 3 }).pressing).toBe(0.8);
  });
  it("새 성향 'bus' = 버스 세우기: 매우 낮음 / 압박 낮음 / 직선 / 좁게, 상수와 설명, 추천 역할은 블록 + 타깃맨", () => {
    expect(TENDENCIES).toContain('bus');
    expect(TENDENCY_NAMES_KO.bus).toBe('버스 세우기');
    expect(TENDENCY_DESC_KO.bus.length).toBeGreaterThan(5);
    expect(tacticsOf('bus')).toEqual({ tendency: 'bus', lineHeight: 0.2, pressing: 0.3, style: 0.2, width: 0.85 });
    expect(TENDENCY.busLineMax).toBeLessThan(TENDENCY.blockLineMax);
    expect(TENDENCY.busGap).toBeLessThan(TENDENCY.blockGap);
    const r = createTeamRoster({ id: 'v1', rating: 70 }, 'w', 2018, []);
    const st = r.players.find((p) => p.position === 'ST')!;
    expect(recommendedRole('bus', 'ST', st.attributes!).id).toBe('targetMan');
  });
  it('약팀 대응: 큰 차이면 버스/블록/역습 중 하나 + 라인 매우 낮음 + 압박 두 단계 아래, 작은 차이는 한 단계', () => {
    const base = tacticsOf('balanced');
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const t = underdogPlan(`t${i}`, 70, 84, base, 'w');
      seen.add(t.tendency);
      expect(t.lineHeight).toBe(LEVELS.lineHeight[0]);
      expect(t.pressing).toBe(LEVELS.pressing[0]);
    }
    expect([...seen].sort()).toEqual(['block', 'bus', 'counter']);
    const small = underdogPlan('t', 70, 76, tacticsOf('tikitaka'), 'w');
    expect(['tikitaka', 'block', 'counter']).toContain(small.tendency);
    if (small.tendency === 'tikitaka') expect(small.lineHeight).toBe(LEVELS.lineHeight[2]);
    expect(underdogPlan('t', 75, 76, base, 'w')).toEqual(base);
  });
  it('경기 중 조정: 약팀(상대 레이팅 +5 이상)은 지고 있어도 라인·압박을 올리지 않는다. 앞설 때 내리기는 그대로', () => {
    const run = (ratingHome: number, ratingAway: number, goals: [number, number], t = 71 * 60) => {
      const s = createState(input(51));
      s.teams[0].setup.tactics = { ...tacticsOf('balanced') };
      s.teams[1].setup.tactics = { ...tacticsOf('balanced') };
      s.teams[0].setup.rating = ratingHome;
      s.teams[1].setup.rating = ratingAway;
      s.t = t;
      s.tick = 600 * 100;
      s.teams[0].stats.goals = goals[0];
      s.teams[1].stats.goals = goals[1];
      aiAdjust(s);
      return s;
    };
    // 비등: 2골 뒤지면 올린다
    let s = run(75, 75, [0, 2]);
    expect(s.teams[0].tactics.lineHeight).toBe(LEVELS.lineHeight[3]);
    // 약팀이 강팀에게 2골 뒤짐: 그대로
    s = run(70, 80, [0, 2]);
    expect(s.teams[0].tactics.lineHeight).toBe(LEVELS.lineHeight[2]);
    expect(s.teams[0].tactics.pressing).toBe(LEVELS.pressing[1]);
    // 강팀(앞선 쪽)은 내린다
    expect(s.teams[1].tactics.lineHeight).toBe(LEVELS.lineHeight[1]);
    // 강팀이 약팀에게 1골 뒤짐(70분 뒤): 올린다
    s = run(80, 70, [0, 1]);
    expect(s.teams[0].tactics.lineHeight).toBe(LEVELS.lineHeight[3]);
    // 약팀이 1골 뒤짐: 그대로
    s = run(70, 80, [0, 1]);
    expect(s.teams[0].tactics.lineHeight).toBe(LEVELS.lineHeight[2]);
  });
  it('압박 속 슛 구석 상수와 하프타임 세트 단계', () => {
    expect(ENGINE.prob.cornerPressure).toBeGreaterThan(0);
    const sets = halftimeSets({ tendency: 'balanced', levels: tendencyLevels('balanced') });
    expect(sets[1]!.levels.lineHeight).toBe(1);
    expect(sets[2]!.levels.lineHeight).toBe(3);
  });
  it('세이브 50 → 51: 저장된 라인 단계 +1 (낮음 0 → 1), 버스 성향은 저장 검사 통과', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76k', difficulty: 'normal' });
    g.tactics = { ...g.tactics, levels: { ...g.tactics.levels, lineHeight: 0 } };
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 50;
    const m = migrate(raw);
    expect(m.tactics.levels.lineHeight).toBe(1);
    expect(SAVE_FORMAT_VERSION).toBe(53);
    const bus = makeTactics('bus', '4-4-2', 'ST');
    expect(validTactics(bus)).toBe(true);
    expect(bus.levels.lineHeight).toBe(0);
    expect(validTactics({ ...bus, levels: { ...bus.levels, pressing: 3 } })).toBe(false);
    // 전술 화면: 성향 7개 + 라인 선택지 4개 + 설명 한 줄
    g.tactics = bus;
    const vm = tacticsVM(g, { draft: structuredClone(g.tactics), pickMe: false, sheet: null, sheetPick: null });
    expect(vm.tendencies).toHaveLength(7);
    expect(vm.tendencies.find((t) => t.id === 'bus')!.name).toBe('버스 세우기');
    expect(vm.tendencyDesc).toBe(TENDENCY_DESC_KO.bus);
    expect(vm.details.find((d) => d.key === 'lineHeight')!.items.map((i) => i.label)).toEqual(['매우 낮음', '낮음', '보통', '높음']);
  });
});
