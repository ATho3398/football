// C.76j (U8-e 디자인 적용 · 시즌·월드·기록): 205 컵·챔스 묶음 · 207 우승 축하 · 208 대회별 · 210 목표 결과 · 211 홈 할 일·대회 칸 · 212 대회 배지 · 214 대회 배너 · 224 하이라이트 카드
import { describe, expect, it } from 'vitest';
import { newGame, playRound, type GameState } from '../src/game';
import { seasonHighlights3 } from '../src/seasonHighlights';
import { PATCH_LABEL } from '../src/version';
import { celebrateVM, compRecordVM, cupBannerVM, seasonCompsVM } from '../src/ui/seasonVM';
import { cupsWorldVM, matchResultVM, seasonVM } from '../src/ui/viewModels';
import { prepVM } from '../src/ui/prepVM';
import { cupsSection, cupSubDefault, seasonView } from '../src/ui/views/screens';
import { compRecordSection, homeTodoRow, seasonCompsSection, seasonHighlightCards } from '../src/ui/views/season';
import { celebrateView, cupBanner, matchResultView } from '../src/ui/views/matchResult';
import { prepView } from '../src/ui/views/prep';

const real = (seed: string): GameState => newGame({ mode: 'real', playerId: 'salah', seed, difficulty: 'normal' } as never);
const until = (g: GameState, date: string) => { while (g.phase === 'season' && g.calendar.date < date) playRound(g, { engine: 'quick' }); };

describe('205 월드 컵·챔스 묶음', () => {
  it('조별 중엔 조별 기본 · 묶음 3개 · 순위 칸 · 16강 진출권 범례', () => {
    const g = real('c76j-a');
    until(g, '2018-09-20');
    const vm = cupsWorldVM(g);
    expect(cupSubDefault(vm)).toBe('groups');
    const html = cupsSection(vm);
    expect(html).toContain('data-act="cup-sub"');
    expect(html).toContain('챔스 녹아웃');
    expect(html).toContain('16강 진출권');
    expect(html).toContain('우리 조');
    expect(html).toContain('승-무-패');
  });

  it('녹아웃: 1·2차전·합계 칸 · 국내 컵 라운드 칩', () => {
    const g = real('c76j-b');
    until(g, '2019-03-20');
    const vm = cupsWorldVM(g);
    expect(cupSubDefault(vm)).toBe('ko');
    const st = vm.ucl!.ko[0]!;
    expect(st.ties.every((t) => t.legs?.agg)).toBe(true);
    const ko = cupsSection(vm, 'ko');
    expect(ko).toContain('ko-tie');
    expect(ko).toContain('합계');
    expect(ko).toContain('결승');
    const fa = cupsSection(vm, 'fa', 0);
    expect(fa).toContain('data-act="cup-round"');
    expect(fa).toContain('fa-tie');
  });
});

describe('214 대회 배너 · 207 우승 축하', () => {
  it('컵 경기 결과 = 대회 배너 하나(일반 배너 아님), 우승이면 축하 한 장', () => {
    const g = real('c76j-c');
    let rep = playRound(g, { engine: 'quick' });
    while (!rep.cup && g.phase === 'season') rep = playRound(g, { engine: 'quick' });
    const b = cupBannerVM(g)!;
    expect(b).not.toBeNull();
    expect(b.kicker).toMatch(/챔피언스리그|FA컵/);
    expect(cupBanner(b)).toContain('cup-banner');
    expect(matchResultView(matchResultVM(g, null)!)).toContain('cup-banner');
    expect(celebrateVM(g)).toBeNull();
    g.lastMatch!.cup = { comp: 'fa', stage: '결승', through: true, won: true };
    const c = celebrateVM(g)!;
    expect(c.title).toBe('FA컵 우승');
    expect(c.rows.at(-1)!.value).toContain('FA컵 1');
    expect(celebrateView(c)).toContain('data-act="celebrate-close"');
    expect(cupBannerVM(g)!.tone).toBe('won');
  });
});

describe('208 · 210 · 211 · 212 · 224', () => {
  it('대회별 표 · 홈 할 일 · 이번 시즌 대회 칸 · 경기 준비 대회 배지', () => {
    const g = real('c76j-d');
    until(g, '2018-09-20');
    const cr = compRecordVM(g);
    expect(cr.rows.map((r) => r.name)).toEqual(['리그', 'FA컵·챔스', '합계']);
    expect(cr.rows[2]!.apps).toBe(cr.rows[0]!.apps + cr.rows[1]!.apps);
    expect(compRecordSection(cr)).toContain('우승 횟수');
    expect(homeTodoRow(0)).toBe('');
    expect(homeTodoRow(2)).toContain('선택권 <em class="po-num">2</em>장');
    const comps = seasonCompsVM(g);
    expect(comps.map((c) => c.kind)).toEqual(['league', 'ucl', 'fa']);
    expect(seasonCompsSection(comps)).toContain('이번 시즌 대회');
    while (g.phase === 'season' && !prepVM(g)?.cupBadge) playRound(g, { engine: 'quick' });
    const p = prepVM(g)!;
    expect(p.cupBadge).toMatch(/ · /);
    expect(prepView(p)).toContain('prep-cup');
  });

  it('시즌 하이라이트 카드 · 시즌 목표 결과 패널', () => {
    const g = real('c76j-e');
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    const h = seasonHighlights3(g.matchLog, (id) => id);
    expect(h.every((x) => !!x.card)).toBe(true);
    const vm = seasonVM(g)!;
    expect(seasonHighlightCards(vm.highlights)).toContain('shl__big');
    const html = seasonView(vm);
    expect(html).toContain('시즌 하이라이트');
    if (vm.seasonGoals) expect(html).toContain('시즌 목표 결과');
  });

  it('PATCH_LABEL', () => {
    expect(PATCH_LABEL).toMatch(/^C\.([7-9]\d|7[4-9])/);
  });
});
