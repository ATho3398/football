// U17-e (C.83e): 17차 S12 훈련 · S13 선수 — 탭 이름 = 내용 · 프리셋 훈련일 순서 · 생활 4수치 기준선 50 · 부상 칩 · 프로필 판 · 잠재력 범위 · 개발 문구 삭제 · 은퇴 단추
import { afterEach, describe, expect, it } from 'vitest';
import { newGame, playRound, retire, type GameState } from '../src/game';
import { addCustomPreset } from '../src/training';
import { lifeStatsVM, playerVM, presetsVM, trainingOptionsVM, trainingVM } from '../src/ui/viewModels';
import { growthSection, presetSection, trainingSection, trainingSheet } from '../src/ui/views/training';
import { contractSection, playerView } from '../src/ui/views/player';
import { staffSection } from '../src/ui/views/finance';
import { staffVM } from '../src/ui/financeVM';
import { marketVM } from '../src/ui/transferVM';
import { setWideForTest } from '../src/ui/skin';
import { calendarSection } from '../src/ui/views/home';
import { homeVM } from '../src/ui/viewModels';

afterEach(() => setWideForTest(null));
const fresh = (seed = 'u17e-test'): GameState => newGame({ mode: 'prospect', position: 'RW', seed, difficulty: 'normal' });

describe('U17-e S12 훈련', () => {
  it('프리셋 줄 = 훈련일 순서 7칸(요일 없음), 내 프리셋은 [고치기][삭제]', () => {
    const g = fresh();
    addCustomPreset(g.training!, '슈팅 집중', ['tech', 'intense', 'recovery', 'tech', 'video', 'tech', 'rest']);
    const vm = presetsVM(g);
    for (const r of [...vm.base, ...vm.custom]) expect(r.slots).toHaveLength(7);
    const html = presetSection(vm);
    const row = html.slice(html.indexOf('슈팅 집중'));
    expect(row).toContain('title="1번째 훈련일"');
    expect(row).toContain('title="7번째 훈련일"');
    expect(html).not.toMatch(/class="pr-day[^"]*" title="[일월화수목금토]"/);
    expect(row).toContain('data-act="preset-edit"');
    expect(row).toContain('data-act="preset-del-ask"');
  });
  it('이번 주 탭: 오늘 카드 + "이번 주 계획"(요일 칸) · 성장 탭: 주간 XP 한도 + 게이지', () => {
    const g = fresh();
    const tv = trainingVM(g)!;
    const week = trainingSection(tv, false);
    expect(week).toContain('이번 주 계획');
    expect(week).toContain('tr-week');
    const grow = growthSection(tv);
    expect(grow).toContain('이번 주 훈련 XP');
    expect(grow).toContain('기술 훈련 게이지');
  });
  it('하루 훈련 시트 생활 4칸: 저장값 하나(멘탈 = 100 − 멘탈 피로), 기준선 50 표시', () => {
    const g = fresh();
    g.life = { ...g.life!, home: 72, adapt: 64, team: 58, mental: 59 };
    const l = lifeStatsVM(g)!;
    expect(l.stats.map((x) => [x.label, x.value])).toEqual([['가정', 72], ['적응', 64], ['팀 관계', 58], ['멘탈', 41]]);
    const day = g.calendar.date;
    let opts = null;
    for (let k = 1; k < 8 && !opts?.life; k++) opts = trainingOptionsVM(g, new Date(Date.parse(day) + k * 864e5).toISOString().slice(0, 10));
    expect(opts?.life).toBeTruthy();
    const html = trainingSheet(opts!, day);
    expect(html).toContain('tr-life__tile is-low');
    expect(html).toContain('기준선 50');
  });
  it('부상 중 추천 칩 = 부상색(injury), 다음 경기까지 못 나으면 "다음 경기 결장"', () => {
    const g = fresh();
    g.player.injury = { grade: 'moderate', weeksTotal: 3, daysTotal: 21, daysLeft: 21, date: g.calendar.date, season: g.league.season, round: 1, permanent: {}, ret: 'full' } as GameState['player']['injury'];
    const chip = presetsVM(g).rec.chips[2]!;
    expect(chip.tone).toBe('injury');
    expect(chip.label).toContain('다음 경기 결장');
    expect(presetSection(presetsVM(g))).toContain('pr-chip--injury');
  });
  it('스태프 [고용]·[해지] = K1 보통 크기(sm 아님)', () => {
    const html = staffSection(staffVM(fresh()));
    expect(html).not.toMatch(/po-btn--sm[^>]*data-act="fn-(hire|leave)"/);
  });
  it('달력 월요일 시작', () => {
    const d = homeVM(fresh()).day!;
    const html = calendarSection(d);
    expect(html.indexOf('<span class="cal-wd">월</span>')).toBeLessThan(html.indexOf('<span class="cal-wd">일</span>'));
  });
});

describe('U17-e S13 선수', () => {
  const base = { body: '', market: null, points: 0, retired: false };
  it('프로필 판: 위상 · Lv 막대 2칸, 레벨 뜻 한 줄, 잠재력 범위(B6), [꾸미기] 링크', () => {
    const g = fresh();
    const vm = playerVM(g);
    expect(vm.potential).toMatch(/^\d+~\d+$/);
    const html = playerView(vm, { ...base, tab: 'attrs' });
    expect(html).toContain('pl-prof17');
    expect(html).toContain('레벨</b> = 이 게임에서 쌓은 성장(XP)');
    expect(html).toContain(`잠재력 <b class="po-num">${vm.potential}</b>`);
    expect(html).toMatch(/po-btn--link[^>]*data-act="player-tab" data-v="body" data-look="1"/);
    expect(html).toContain('능력치 1~20');
    expect(html).toContain('17+ 최상');
  });
  it('계약 탭: 개발 문구("보여 주기만 해요", "재정 단계") 없음', () => {
    const html = contractSection(marketVM(fresh()));
    expect(html).not.toContain('보여 주기만');
    expect(html).not.toContain('재정 단계');
  });
  it('은퇴: [커리어 요약] · [새 게임] 단추, PC 오른쪽 = 커리어 요약 요약', () => {
    const g = fresh('u17e-ret');
    g.player.age = 34;
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    retire(g);
    const vm = playerVM(g);
    const html = playerView(vm, { ...base, tab: 'attrs', retired: true });
    expect(html).toContain('data-to="retired"');
    expect(html).toContain('data-to="new"');
    setWideForTest(true);
    const pc = playerView(vm, { ...base, tab: 'attrs', retired: true });
    expect(pc).toContain('pl-retsum');
  });
});
