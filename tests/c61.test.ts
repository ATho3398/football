// C.61 (34q, U5-g): PC 2열 (디자인 120~123 · 151~153, B 120). 1024px 이상만 바뀌고 폰은 C.54~C.60 그대로
import { afterEach, describe, expect, it } from 'vitest';
import { endSeason, newGame, playRound } from '../src/game';
import { homeVM, playerVM, seasonVM, versionVM } from '../src/ui/viewModels';
import { marketVM } from '../src/ui/transferVM';
import { customVM, initialCustomForm } from '../src/ui/customVM';
import { DOCK_PC, DOCK_PHONE, dock, dockPc, type DockVM } from '../src/ui/views/common';
import { homeView } from '../src/ui/views/home';
import { playerView, type PlayerTab } from '../src/ui/views/player';
import { seasonView } from '../src/ui/views/screens';
import { customBody } from '../src/ui/views/custom';
import { settingsView, type SetUI } from '../src/ui/views/settings';
import { CARD_ART_UI_DEFAULT } from '../src/ui/views/cardArtSettings';
import { isWide, setWideForTest } from '../src/ui/skin';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c61-son', difficulty: 'normal' });
const FO = { tab: 'players' as const, q: '', sel: null, crop: null };
const PX = { tab: 'players' as const, q: '', team: '', sel: null, kitSel: null };
const NM = { q: '', team: '', sel: null };
const settings = (set: SetUI, ca: object = {}) => settingsView(son(), FO, versionVM(null), NM, PX, { ...CARD_ART_UI_DEFAULT, ...ca }, false, set);

afterEach(() => setWideForTest(null));

describe('독 칸 배열 하나 (C.61)', () => {
  it('PC 9칸은 폰 독 순서에서 만든다: 홈 · 덱 · 전술 + 폰 나머지 ([다음] 5번째 가운데) + 더보기 자리에 월드 · 설정 · 저장 (C.66)', () => {
    expect(DOCK_PHONE).toEqual(['home', 'player', 'prog', 'schedule', 'more']);
    expect(DOCK_PC).toEqual(['home', 'deck', 'tactics', 'player', 'prog', 'schedule', 'world', 'settings', 'saves']);
    expect(DOCK_PC.indexOf('prog')).toBe(4);
    // 폰을 6칸(월드 추가)으로 바꿔도 PC는 같은 9칸
    expect(dockPc(['home', 'player', 'prog', 'schedule', 'world', 'more'])).toEqual(DOCK_PC);
    const vm: DockVM = { screen: 'home', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue' }, tacticsOpen: true, points: 0, more: false };
    const html = dock(vm);
    expect(html.match(/po-dock--pc/g)?.length).toBe(1);
    expect(html.match(/dock-phone/g)?.length).toBe(1);
  });
});

describe('폭 판정', () => {
  it('테스트(창 없음) 기본은 폰 = 2열 아님', () => {
    expect(isWide()).toBe(false);
    setWideForTest(true);
    expect(isWide()).toBe(true);
  });
});

describe('PC 2열 화면 (디자인 120 · 121 · 153 · 123)', () => {
  it('홈 120: 폰은 1열 그대로, PC는 왼쪽 다음 경기 · 오른쪽 선수 카드 · 4칸 · 내 상태', () => {
    const g = son();
    const phone = homeView(homeVM(g));
    expect(phone).not.toContain('pc2');
    setWideForTest(true);
    const pc = homeView(homeVM(g));
    expect(pc).toContain('pc2 hm-pc');
    const r = pc.slice(pc.indexOf('pc2__r'));
    expect(r).toContain('po-pcard');
    expect(r).toContain('내 상태');
    expect(pc.slice(0, pc.indexOf('pc2__r'))).toContain('next-card');
    expect(pc).not.toContain('po-hero--face'); // PC 홈 = 일반 B 머리말
  });
  it('선수 121 · 153: PC는 왼쪽 능력치 늘 + 오른쪽 탭 4개(능력치 탭이면 몸·태그)', () => {
    const g = son();
    const vm = playerVM(g);
    const html = (tab: PlayerTab) => playerView(vm, { tab, body: '<i id="body-tab"></i>', market: marketVM(g), points: 3, retired: false });
    expect((html('pos').match(/role="tab"/g) ?? []).length).toBe(5);
    expect(html('pos')).not.toContain('ag--4');
    setWideForTest(true);
    const a = html('attrs');
    expect((a.match(/role="tab"/g) ?? []).length).toBe(4);
    expect(a).toContain('ag--4');
    expect(a).toContain('id="body-tab"');
    const p = html('pos');
    expect(p).toContain('ag--4');
    expect(p).toContain('포지션별 OVR');
    expect(p).not.toContain('id="body-tab"');
  });
  it('시즌 종료 123: PC는 요약 + 상세 6탭 한 줄(3열 아님), [시즌 상세 보기] 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c61-season', difficulty: 'normal' });
    while (g.league.round < g.league.schedule.length) playRound(g, { engine: 'quick' });
    endSeason(g);
    const vm = seasonVM(g)!;
    expect(seasonView(vm)).toContain('시즌 상세 보기');
    setWideForTest(true);
    const pc = seasonView(vm);
    expect(pc).toContain('season-pc');
    expect(pc).not.toContain('시즌 상세 보기');
    expect(pc.match(/role="tab"/g)?.length).toBe(6);
    expect(pc).not.toContain('repeat(3, minmax(0, 1fr))');
    expect(pc).toContain(`${vm.pos}위`);
    expect(seasonView(vm, '', false, 'months')).toContain('season-pc');
  });
});

describe('PC 설정 152 · 새 게임 커스텀 151', () => {
  it('설정: 왼쪽 목록(섹션 5 + 꾸미기 하위 4) | 오른쪽 고른 섹션 하나', () => {
    setWideForTest(true);
    const html = settings({ page: 'main', open: 'view' });
    expect(html).toContain('set-nav');
    expect(html.match(/set-nav__item/g)?.length).toBe(9);
    expect(html).toContain('id="set-view"');
    expect(html).not.toContain('id="set-play"');
    expect(html).toContain('data-act="set-nav" data-v="play"');
    const cards = settings({ page: 'cardart', open: null });
    expect(cards).toContain('ca-pc');
    expect(cards).toContain('카드를 고르면 여기서 편집해요');
    expect(cards).toMatch(/set-nav__item is-sub is-on" data-act="set-page" data-v="cardart"/);
  });
  it('설정: 폰은 접는 섹션 5개 + 이동 칩 그대로', () => {
    const html = settings({ page: 'main', open: 'play' });
    expect(html).not.toContain('set-nav');
    expect(html.match(/class="set-sec[ "]/g)?.length).toBe(5);
  });
  it('커스텀: PC는 단계 목록 6줄(요약) | 본문 | 미리보기 + [이전][다음], 태그 단계는 장점 | 단점 두 열', () => {
    const vm = customVM(initialCustomForm(), '이도윤');
    expect(customBody(vm, 4, '', '')).toContain('cu-nav');
    setWideForTest(true);
    const html = customBody(vm, 4, '<i id="mode"></i>', '');
    expect(html).toContain('cu-pc');
    expect(html.match(/cu-steprow/g)?.length).toBe(6);
    expect(html).toContain('id="mode"');
    expect(html).toContain('cu-preview');
    expect(html).toContain('cu-tags2');
    expect(html).toContain('이도윤 · ');
    expect(html).not.toContain('dock cu-nav');
  });
});

describe('버전', () => {
  it('PATCH_LABEL · STAGE_LABEL 형식 (C.61 뒤에는 다음 패치 값)', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
  });
});
