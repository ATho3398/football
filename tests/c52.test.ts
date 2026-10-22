// C.52 훈련 프리셋 (pending 82 6번, 디자인 159) · 디자이너 버그 5개 · 커스텀 남은 포인트
import { describe, expect, it } from 'vitest';
import { activePreset, choosePreset, dayPlan, endDay, isMatchDay, myMatchDates, newGame, playOthers, playRound, presetWeekPlan, recommendPreset, setPresetAuto, type GameState } from '../src/game';
import { addCustomPreset, BASE_PRESETS, deleteCustomPreset, presetById, updateCustomPreset, weekStart } from '../src/training';
import { addDays, daysBetween } from '../src/calendar';
import { deserialize, serialize } from '../src/save';
import { SAVE_FORMAT_VERSION } from '../src/game';
import { clubKo } from '../src/league';
import { homeVM, presetsVM } from '../src/ui/viewModels';
import { presetEditSheet, presetSection } from '../src/ui/views/training';
import { presetEditVM } from '../src/ui/viewModels';
import { baseAttributes, customBudget, spentPoints } from '../src/custom';

function toSeason(seed: string): GameState {
  const g = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
  while (g.phase !== 'season' || isMatchDay(g)) {
    if (g.phase === 'season') playRound(g, { engine: 'quick' });
    else break;
  }
  return g;
}

/** 다음 월요일 아침까지 하루씩 (경기는 빠른 계산) */
function toMonday(g: GameState): void {
  do {
    if (isMatchDay(g)) playRound(g, { engine: 'quick' });
    else { playOthers(g, 'quick'); endDay(g); }
  } while (daysBetween(weekStart(g.calendar.date), g.calendar.date) !== 0 || isMatchDay(g));
}

describe('훈련 프리셋 (C.52)', () => {
  it('기본 4개, 균형 = 예전 기본 계획(자유일 모두 기술)', () => {
    expect(BASE_PRESETS.map((p) => p.name)).toEqual(['균형', '회복 중심', '기술 집중', '경기 많은 주']);
    expect(presetById(undefined, 'balance').slots.every((k) => k === 'tech')).toBe(true);
    const g = toSeason('c52-a');
    for (const id of ['balance', 'recovery', 'focus', 'busy']) {
      const w = presetWeekPlan(g, id);
      expect(w).toHaveLength(7);
      // 경기 날·경기 다음 날 휴식·경기 전날 영상은 프리셋과 상관없이 같다
      const fixed = presetWeekPlan(g, 'balance').map((d) => (d.fixed ? d.kind : null));
      expect(w.map((d) => (d.fixed ? d.kind : null))).toEqual(fixed);
    }
  });

  it('주가 바뀌면 자동 추천을 적용하고, 직접 고른 주는 그 주만 유지', () => {
    const g = toSeason('c52-b');
    toMonday(g);
    playOthers(g, 'quick');
    const rec = recommendPreset(g);
    expect(activePreset(g)).toBe(rec.id);
    choosePreset(g, 'recovery');
    expect(activePreset(g)).toBe('recovery');
    // 같은 주 자유일은 회복 중심 칸
    const free = presetWeekPlan(g, 'recovery').filter((d) => !d.fixed && daysBetween(g.calendar.date, d.date) >= 0);
    if (free.length) expect(dayPlan(g, free[0]!.date)).toBe('recovery');
    toMonday(g);
    playOthers(g, 'quick');
    expect(activePreset(g)).toBe(recommendPreset(g).id);
  });

  it('자동을 끄면 고른 프리셋이 다음 주에도 이어진다', () => {
    const g = toSeason('c52-c');
    setPresetAuto(g, false);
    choosePreset(g, 'focus');
    toMonday(g);
    if (isMatchDay(g)) playRound(g, { engine: 'quick' }); else { playOthers(g, 'quick'); endDay(g); }
    expect(activePreset(g)).toBe('focus');
  });

  it('추천: 경기 2번인 주 = 경기 많은 주, 부상 = 회복 중심, 체력 낮음 = 회복 중심', () => {
    const g = toSeason('c52-d');
    const dates = myMatchDates(g);
    const busyWeek = dates.find((d, i) => i > 0 && weekStart(d) === weekStart(dates[i - 1]!));
    if (busyWeek) expect(recommendPreset(g, busyWeek).id).toBe('busy');
    const quiet = dates.find((d, i) => i > 0 && daysBetween(dates[i - 1]!, d) >= 7 && weekStart(d) !== weekStart(dates[i - 1]!) && weekStart(d) !== weekStart(dates[i + 1] ?? addDays(d, 30)));
    if (quiet) {
      // C.77m: 문턱 체력 65·85 → 50·75 (피로 50 초과 = 회복 중심, 25 이하 = 기술 집중)
      g.player.fatigue = 60;
      expect(recommendPreset(g, quiet).id).toBe('recovery');
      g.player.fatigue = 0;
      expect(recommendPreset(g, quiet).id).toBe('focus');
      g.player.fatigue = 40;
      expect(recommendPreset(g, quiet).id).toBe('balance');
    }
    g.player.injury = { grade: 'minor', weeksTotal: 1, daysTotal: 5, daysLeft: 5, date: g.calendar.date, season: g.league.season, round: 1, permanent: {} };
    expect(recommendPreset(g).id).toBe('recovery');
  });

  it('커스텀 프리셋: 개수 제한 없이 만들기·이름 바꾸기·지우기, 세이브에 남는다', () => {
    const g = toSeason('c52-e');
    const ids = Array.from({ length: 12 }, (_, i) => addCustomPreset(g.training, `약발 ${i}`, ['weakFoot', 'weakFoot', 'tech']));
    expect(new Set(ids).size).toBe(12);
    expect(g.training.customPresets).toHaveLength(12);
    expect(presetById(g.training, ids[0]!).slots).toEqual(['weakFoot', 'weakFoot', 'tech', 'tech', 'tech', 'tech', 'tech']);
    updateCustomPreset(g.training, ids[0]!, '  약발 집중  ', ['weakFoot', 'tech']);
    expect(presetById(g.training, ids[0]!).name).toBe('약발 집중');
    choosePreset(g, ids[1]!);
    expect(activePreset(g)).toBe(ids[1]);
    deleteCustomPreset(g.training, ids[1]!);
    expect(activePreset(g)).toBe('balance');
    const back = deserialize(serialize(g));
    expect(back.training.customPresets).toHaveLength(11);
    expect(back.training.customPresets[0]!.name).toBe('약발 집중');
    // 화면
    const vm = presetsVM(g);
    expect(vm.base).toHaveLength(4);
    expect(vm.custom).toHaveLength(11);
    const html = presetSection(vm);
    expect(html).toContain('이번 주 추천');
    expect(html).toContain('새 프리셋 만들기');
    expect(presetEditSheet(presetEditVM(g, ids[0]!))).toContain('data-act="preset-slot" data-v="6"');
  });

  it('세이브 30 → 31: 프리셋 기본값(균형·자동)', () => {
    const g = toSeason('c52-f');
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 30;
    for (const k of ['preset', 'presetWeek', 'presetAuto', 'presetManual', 'customPresets', 'presetSeq']) delete raw.training[k];
    const back = deserialize(JSON.stringify(raw));
    expect(SAVE_FORMAT_VERSION).toBe(57);
    expect(back.training).toMatchObject({ preset: 'balance', presetAuto: true, customPresets: [] });
    playRound(back, { engine: 'quick' });
  });
});

describe('디자이너 버그 (C.52)', () => {
  it('홈 날짜 = "8월 24일 (금)" 꼴', () => {
    const g = toSeason('c52-g');
    expect(homeVM(g).day!.full).toMatch(/^\d{1,2}월 \d{1,2}일 \([일월화수목금토]\)$/);
  });
  it('영문 클럽 이름 → 한글', () => {
    expect(clubKo('Liverpool')).toBe('리버풀');
    expect(clubKo('FC Barcelona')).toBe('바르셀로나');
    expect(clubKo('없는 팀')).toBe('없는 팀');
  });
  it('커스텀: 남은 포인트는 시작 뒤 성장 포인트로', () => {
    const attrs = baseAttributes();
    const budget = customBudget(17, [], 3);
    const g = newGame({ mode: 'custom', difficulty: 'normal', seed: 'c52-h', custom: { name: 'x', age: 17, position: 'ST', body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [], attributes: attrs, nationality: 'KOR', appearance: g0().appearance } as never });
    expect(g.player.unspentPoints).toBe(budget - spentPoints(attrs));
    expect(g.player.unspentPoints).toBeGreaterThan(0);
  });
});

function g0() {
  return newGame({ mode: 'prospect', position: 'ST', seed: 'c52-face', difficulty: 'normal' }).player;
}
