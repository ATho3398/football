// C.70 U7-b: 161 홈 v3 · 162 레벨업 · 163 포인트 v2 · 166 경기 준비 v2 · 170/160 경기 결과
import { describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, playOthers, type GameState } from '../src/game';
import { prepVM } from '../src/ui/prepVM';
import { allocateVM, homeVM } from '../src/ui/viewModels';
import { homeView } from '../src/ui/views/home';
import { prepView } from '../src/ui/views/prep';
import { allocateView } from '../src/ui/views/screens';
import { todayRow } from '../src/ui/views/training';
import { deckHomeSection } from '../src/ui/views/deck';
import { dock, type DockVM } from '../src/ui/views/common';

function toMatchDay(g: GameState): void {
  for (let i = 0; i < 40 && !isMatchDay(g); i++) { playOthers(g, 'quick'); endDay(g); }
}
const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c70', difficulty: 'normal' });

describe('홈 v3 (161)', () => {
  it('머리말 = 저장·설정만, 칩 n/38R · 찍을 포인트 (C.77q: 직접/자동 줄은 설정 · 경기 준비로)', () => {
    const g = son();
    g.player.unspentPoints = 12;
    g.guide.unlocked.push('growth');
    const html = homeView(homeVM(g));
    expect(html).toContain('data-to="saves"');
    expect(html).not.toContain('data-to="inbox"');
    expect(html).not.toContain('data-to="finance"');
    expect(html).toMatch(/>1\/38R</);
    expect(html).toContain('찍을 포인트 12P');
    expect(html).not.toContain('hm-ctl');
    expect(html).not.toContain('data-act="ctl-mode"');
  });
  it('오늘 훈련 = 날짜 머리 + 이번 주 프리셋 줄, 카드 덱 한 줄', () => {
    const g = son();
    const vm = homeVM(g);
    const r = todayRow(vm.training!, vm.day!.full);
    expect(r).toContain(`오늘 훈련 · ${vm.day!.full}`);
    expect(r).toContain('이번 주 프리셋');
    expect(r).toContain('프리셋 바꾸기');
    expect(deckHomeSection({ active: 0, count: 8, unusable: 0, picks: 0 })).toContain('hm-deck');
  });
  it('코치 후보는 독 훈련 칸 배지(C.77q), 접힌 더보기 배지 = 인박스', () => {
    const vm: DockVM = { screen: 'home', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue' }, tacticsOpen: true, points: 0, more: false, inbox: 1, coach: 2 };
    const html = dock(vm);
    expect(html).toContain('<b class="po-dock__badge po-num">2</b>');
    expect(html).toContain('<b class="po-dock__badge po-num">1</b>');
    expect(html).not.toContain('<b class="po-dock__badge po-num">3</b>');
  });
});

describe('포인트 찍기 v2 (163)', () => {
  it('구간 칩 "1칸 nP", 규칙 상자, 못 올리는 칸 = 회색 "nP 부족"', () => {
    const g = son();
    g.player.unspentPoints = 1;
    const vm = allocateVM(g, 83, false, g.player.attributes, []);
    const html = allocateView(vm, null, 0, true);
    expect(html).toContain('1칸 <b>2P</b>');
    expect(html).toContain('포인트 찍는 규칙');
    expect(html).toContain('is-short');
    expect(html).toMatch(/[23]P 부족/);
    expect(html).toContain('포인트 부족');
  });
});

describe('경기 준비 v2 (166)', () => {
  it('선발 가능성 판 · 평점 보정 줄 · 정지 빈도 머리 (직접일 때)', () => {
    const g = son();
    toMatchDay(g);
    g.control.mode = 'direct';
    const vm = prepVM(g)!;
    const html = prepView(vm);
    expect(html).toContain('prep-chance');
    expect(html).toContain('선발 가능성');
    expect(html).toContain(vm.condition.formLabel);
    expect(html).toContain('정지 빈도 · 직접일 때');
    g.control.mode = 'auto';
    expect(prepView(prepVM(g)!)).not.toContain('정지 빈도 · 직접일 때');
  });
  it('체력이 낮으면 결장 사유 줄', () => {
    const g = son();
    toMatchDay(g);
    g.player.fatigue = 70;
    const html = prepView(prepVM(g)!);
    expect(html).toContain('결장 사유');
    expect(html).toContain('벤치로 밀릴 수 있어요');
  });
});

describe('경기 결과 (170 · 160)', () => {
  it('머리 한 줄 · 득점 그때 점수 · "나" 칩 · 쓴 카드 분 칸 · 판 안 [더 보기]', async () => {
    const { matchResultView } = await import('../src/ui/views/matchResult');
    const base = {
      myTeam: '토트넘 홋스퍼', myTeamId: 'tot', opp: '첼시', oppId: 'che', face: { id: 'son', age: 26 }, scoreLine: '2-1', outcome: 'win', outcomeKo: '승', comp: '리그 1R', round: 1,
      rating: 7.5, chips: ['도움 1', '선발 90분'], hasAvgMap: false, highlights: [], banners: [], report: null, my: [], myMore: [], formBonus: 0, appearance: '선발 90분',
      decisions: [], decisionReplay: false, points: 0, seasonOver: false, xp: { value: 6, gained: 52, max: 272, level: 0, levelsGained: 0 },
      goals: [
        { minute: "8'", name: '해리 케인', id: 'kane', assist: null, mine: true },
        { minute: "13'", name: '손흥민', id: 'me', assist: null, mine: true },
        { minute: "70'", name: '바디', id: null, assist: null, mine: false },
      ],
      cardUses: [1, 2, 3, 4, 5].map((k) => ({ text: `${k}' 집중 (자동)`, result: 'success' as const, minute: `${k}'`, name: '집중', auto: true })),
    };
    const html = matchResultView(base as never);
    expect(html).toContain('mr-head--row');
    expect(html).toContain('2 - 1');
    expect(html).toContain('>1-0<');
    expect(html).toContain('>2-1<');
    expect(html).toContain('mr-goal__me');
    expect(html).toContain('cu-min');
    expect(html).toContain('2장 더 보기');
  });
});
