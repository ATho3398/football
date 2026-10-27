// C.76k 44h-b: 약팀 내려앉기 · 버스 세우기 · 지고 있을 때 올리기 예외 · 압박 속 슛 구석 (사용자 확정 2026-10-20 ①~③)
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { createState } from '../src/engine/sim';
import { teamSetupFromRoster, underdogPlan } from '../src/engine/setup';
import { aiAdjust, blockRow, LEVEL_NAMES_KO, LEVELS, levelOf, recommendedRole, tacticsOf, TENDENCIES, TENDENCY, TENDENCY_DESC_KO, TENDENCY_NAMES_KO, tendencyLevels, validLevel } from '../src/engine/tactics';
import { halftimeSets, tacticsVM } from '../src/ui/viewModels';
import { makeTactics, validTactics } from '../src/myTactics';
import { restore, SaveFormatError, serialize } from '../src/save';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { createTeamRoster } from '../src/roster';
import type { EngineInput } from '../src/engine/types';

/** 큰 차 약팀이 고르는 성향@라인 단계 (C.78s H1) */
const UNDERDOG_SEEN = ['block@0', 'block@1'];

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
  it("버스 세우기 = 수비 블록 + 라인 매우 낮음 (C.78s H1): 성향 목록에 없고, 블록 라인 단계표 0 이 옛 버스 수치", () => {
    expect(TENDENCIES).not.toContain('bus');
    expect(TENDENCY_DESC_KO.block).toContain('버스');
    const bus = tacticsOf('block', { lineHeight: 0 });
    expect(bus).toEqual({ tendency: 'block', lineHeight: 0.2, pressing: 0.3, style: 0.2, width: 0.85 });
    expect(blockRow(bus)).toEqual({ lineMax: 14, gap: 8, stay: 1, compactW: 0.5, fbOverlap: 0.3 });
    expect(blockRow(tacticsOf('block'))).toEqual({ lineMax: 16.5, gap: 12, stay: 0, compactW: 0.55, fbOverlap: 0.5 });
    expect(blockRow(tacticsOf('balanced'))).toBeNull();
    const r = createTeamRoster({ id: 'v1', rating: 70 }, 'w', 2018, []);
    const st = r.players.find((p) => p.position === 'ST')!;
    expect(recommendedRole('block', 'ST', st.attributes!).id).toBe('targetMan');
  });
  it('약팀 대응: 큰 차이면 블록@매우 낮음(버스)/블록@낮음 중 하나 + 압박 두 단계 아래, 작은 차이는 한 단계', () => {
    const base = tacticsOf('balanced');
    const seen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const t = underdogPlan(`t${i}`, 70, 84, base, 'w');
      seen.add(`${t.tendency}@${levelOf('lineHeight', t.lineHeight)}`);
      expect(t.pressing).toBe(LEVELS.pressing[0]);
    }
    expect([...seen].sort()).toEqual(UNDERDOG_SEEN);
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
  it('옛 세이브(50)는 이어 할 수 없음, 버스 성향은 저장 검사 통과', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76k', difficulty: 'normal' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 50;
    expect(() => restore(raw)).toThrow(SaveFormatError);
    expect(SAVE_FORMAT_VERSION).toBe(57);
    const bus = { ...makeTactics('block', '4-4-2', 'ST'), levels: { ...tendencyLevels('block'), lineHeight: 0 as const } };
    expect(validTactics(bus)).toBe(true);
    // 옛 세이브의 'bus' 성향은 검사에서 걸러져 기본 전술로 (C.78s H1, 세이브 형식 그대로)
    expect(validTactics({ ...bus, tendency: 'bus' as never })).toBe(false);
    expect(validTactics({ ...bus, levels: { ...bus.levels, pressing: 3 } })).toBe(false);
    // 전술 화면: 성향 6개 + 라인 선택지 4개 + 설명 한 줄
    g.tactics = bus;
    const vm = tacticsVM(g, { draft: structuredClone(g.tactics), pickMe: false, sheet: null, sheetPick: null });
    expect(vm.tendencies).toHaveLength(6);
    expect(vm.tendencies.some((t) => (t.id as string) === 'bus')).toBe(false);
    expect(vm.tendencyDesc).toBe(TENDENCY_DESC_KO.block);
    expect(vm.details.find((d) => d.key === 'lineHeight')!.items.map((i) => i.label)).toEqual(['매우 낮음', '낮음', '보통', '높음']);
  });
});
