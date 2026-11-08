// U17-a (17차 1단계 적용 · S00 컴포넌트 + S03 독 v4 · 더보기 격자 · 도구 줄 · 위 띠 · 토스트 자리)
import { afterEach, describe, expect, it } from 'vitest';
import {
  BottomSheet, Button, Chip, DataTable, EmptyState, HeroPanel, Meter, Panel, PlayerRow, Toast, ToolBar, TopStrip, TOOLBAR_MAX, TOP_STRIP_ORDER, playerInitial,
} from '../src/ui/components';
import { CAREER_LINKS, DOCK_MORE, DOCK_MORE_COLS, DOCK_PC, DOCK_PHONE, careerLinks, collectSheet, dock, dockLabelLong, moreBadge, type DockVM } from '../src/ui/views/common';
import { setWideForTest } from '../src/ui/skin';

const vm = (o: Partial<DockVM> = {}): DockVM => ({ screen: 'home', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' }, tacticsOpen: true, points: 0, more: false, ...o });

afterEach(() => setWideForTest(null));

describe('독 v4 (S03)', () => {
  it('폰 5칸: 홈 · 훈련 · [다음] · 선수 · 더보기 — [다음] 정가운데', () => {
    expect(DOCK_PHONE).toEqual(['home', 'schedule', 'prog', 'player', 'more']);
    expect(DOCK_PHONE.indexOf('prog')).toBe(2);
    const h = dock(vm());
    expect(h).toContain('po-dock--v4');
    // 열 1 · 1 · 1.9 · 1 · 1
    expect(h).toContain('grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.9fr) minmax(0, 1fr) minmax(0, 1fr)');
  });
  it('더보기 격자 11칸(2줄 6 · 5): 상점 첫 칸 · 대표팀 · 시상 · 수집 · 저장 포함', () => {
    expect(DOCK_MORE).toHaveLength(11);
    expect(DOCK_MORE[0]).toBe('shop');
    expect(DOCK_MORE).toEqual(expect.arrayContaining(['national', 'awards', 'collection', 'saves']));
    expect(DOCK_MORE_COLS).toBe(6);
    const h = dock(vm({ more: true }));
    const grid = h.slice(h.indexOf('dock-more__grid'), h.indexOf('dock-phone'));
    expect(grid.match(/dock-more__item/g)).toHaveLength(11);
    expect(grid).toContain('data-act="collect-open"');
    expect(grid).toContain('data-to="national"');
    expect(grid).toContain('data-to="awards"');
    expect(grid).toContain('data-v="saves"');
    // 끌기 없음 (옛 가로 스크롤 줄 at-start 흐림 없음)
    expect(h).not.toContain('at-start');
  });
  it('PC 12칸: 홈 · 훈련 · 인박스 · 재정 · 월드 | [다음] | 선수 · 상점 · 덱 · 전술 · 설정 · 저장, 더보기 · 커리어 칸 없음', () => {
    expect(DOCK_PC).toEqual(['home', 'schedule', 'inbox', 'finance', 'world', 'prog', 'player', 'shop', 'deck', 'tactics', 'settings', 'saves']);
    for (const id of [...CAREER_LINKS, 'more' as const]) expect(DOCK_PC).not.toContain(id);
    // PC [다음] 176px
    expect(dock(vm())).toMatch(/po-dock--pc dock-wide" style="grid-template-columns:[^"]*176px/);
  });
  it('더보기 배지 = 격자 안 칸 배지 합 (2절 22번), 펼치면 칸마다', () => {
    expect(moreBadge(vm({ inbox: 3, shop: 2 }))).toBe(5);
    const h = dock(vm({ inbox: 3, shop: 2 }));
    expect(h).toMatch(/data-act="dock-more"[^>]*aria-label="더보기 5"/);
    const open = dock(vm({ inbox: 3, shop: 2, more: true }));
    expect(open).not.toMatch(/data-act="dock-more"[^>]*aria-label="더보기/);
    // PC 인박스 칸에도 배지 (2절 22번)
    const pc = open.slice(open.indexOf('po-dock--pc'));
    expect(pc).toMatch(/data-to="inbox"[^>]*>.*?po-dock__badge po-num">3</);
  });
  it('[다음] 7상태 클래스 · 4자 이상 is-long · 진행 중 누를 수 없음 · 잠김 disabled · 답하기 배지', () => {
    const kinds = ['continue', 'running', 'match', 'live', 'answer', 'season', 'locked'] as const;
    for (const k of kinds) expect(dock(vm({ prog: { label: 'x', icon: 'match', act: 'noop', kind: k } }))).toContain(`is-${k}`);
    expect(dockLabelLong('시즌 요약')).toBe(true);
    expect(dockLabelLong('경기 중')).toBe(false);
    expect(dock(vm({ prog: { label: '시즌 요약', icon: 'trophy', act: 'go-tab', kind: 'season' } }))).toContain('is-season is-long');
    expect(dock(vm({ prog: { label: '진행 중', icon: 'running', act: 'noop', kind: 'running' } }))).toContain('aria-disabled="true"');
    expect(dock(vm({ prog: { label: '잠김', icon: 'lock', act: 'noop', kind: 'locked' } }))).toMatch(/is-locked" data-act="noop" disabled/);
    expect(dock(vm({ prog: { label: '답하기', icon: 'chat', act: 'day-continue', kind: 'answer', badge: 2 } }))).toMatch(/is-answer[^>]*>.*?po-dock__badge po-num">2</);
  });
  it('수집 → 도감 · 진열실 고르는 시트 (2절 28번), 도감·진열실 화면에서 더보기 켜짐', () => {
    const s = collectSheet();
    expect(s).toContain('data-to="dex"');
    expect(s).toContain('data-to="showroom"');
    expect(s).toContain('po-sheet__x');
    expect(dock(vm({ screen: 'dex' }))).toMatch(/is-on"[^>]*data-act="dock-more"/);
    expect(dock(vm({ screen: 'showroom', more: true }))).toMatch(/is-on"[^>]*data-act="collect-open"/);
  });
  it('PC 커리어 바로가기: 대표팀 · 시상 · 도감 · 진열실', () => {
    const h = careerLinks();
    for (const to of ['national', 'awards', 'dex', 'showroom']) expect(h).toContain(`data-to="${to}"`);
  });
});

describe('S00 새 컴포넌트', () => {
  it('Chip 3종: info(값) · filter(button, aria-pressed) · status(톤)', () => {
    expect(Chip({ label: '경기까지', value: '7일' })).toMatch(/^<span class="po-xchip po-xchip--info po-xchip--neutral">/);
    const f = Chip({ kind: 'filter', label: '공격', selected: true, act: 'f', data: { v: 'att' } });
    expect(f).toMatch(/^<button type="button" class="po-xchip po-xchip--filter po-xchip--neutral is-on" aria-pressed="true" data-act="f" data-v="att">/);
    expect(Chip({ kind: 'status', tone: 'injury', label: '부상 8일' })).toContain('po-xchip--status po-xchip--injury');
  });
  it('Panel: task 왼쪽 막대 · alert 닫기 · 접으면 요약 한 줄만(행동 없음)', () => {
    expect(Panel({ kind: 'task', title: '포인트 6P를 찍어요', action: Button({ children: '찍기' }), children: '<p>본문</p>' })).toContain('po-panel--task');
    expect(Panel({ kind: 'alert', title: '언론의 비난', onClose: { act: 'x' } })).toContain('po-panel__close');
    const f = Panel({ title: '주전 경쟁', foldable: true, folded: true, onFold: { act: 'fold' }, summary: '감독 신뢰도 60/100', children: '<p>숨김</p>', action: 'ACT' });
    expect(f).toContain('is-folded');
    expect(f).toContain('aria-expanded="false"');
    expect(f).toContain('감독 신뢰도 60/100');
    expect(f).not.toContain('숨김');
    expect(f).not.toContain('ACT');
  });
  it('DataTable: 머리 · 내 줄(is-mine) · 구간 줄 · 더 보기', () => {
    const h = DataTable({ columns: [{ key: 'r', label: '#', width: '24px' }, { key: 't', label: '팀', grow: true }, { key: 'p', label: '승점', num: true }], rows: [{ r: 1, t: '맨시티', p: 26 }, { r: 6, t: '리버풀', p: 17 }], mine: 1, marks: { 0: 'up' }, more: '14팀 더 보기' });
    expect(h).toContain('grid-template-columns:24px minmax(0, 1fr) auto');
    expect(h).toMatch(/po-table__row is-up/);
    expect(h).toMatch(/po-table__row is-mine/);
    expect(h).toContain('po-table__cell is-right po-num');
    expect(h).toContain('14팀 더 보기');
  });
  it('TopStrip: 종류 6 · 우선순위 경기 중 > 자동 진행 > 면담 > 1군 테스트 > 새 버전 > 안내 · live 는 빨간 점', () => {
    expect(TOP_STRIP_ORDER).toEqual(['live', 'running', 'interview', 'test', 'update', 'guide']);
    const live = TopStrip({ kind: 'live', title: "경기 중 · 63' 리버풀 1 : 0 본머스", action: '경기로', onAction: { act: 'live-return' }, onTap: { act: 'live-return' } });
    expect(live).toContain('po-strip__dot');
    expect(live).toContain('data-act="live-return"');
    expect(TopStrip({ kind: 'running', title: '진행 중', action: '중단', onAction: { act: 'sim-stop' } })).toContain('po-strip--running');
    expect(TopStrip({ kind: 'update', title: '새 버전', secondary: { label: '나중에', act: 'sw-later' } })).toContain('data-act="sw-later"');
  });
  it('EmptyState · ToolBar(아이콘 최대 4) · PlayerRow(사진 없음 = 첫 글자)', () => {
    expect(EmptyState({ icon: 'inbox', title: '답할 것이 없어요', text: '새 알림이 오면 여기 쌓여요.' })).toContain('po-empty__title');
    const tb = ToolBar({ back: { act: 'to-title' }, date: '10.28 (일)', items: Array.from({ length: 6 }, (_, i) => ({ icon: 'bell' as const, label: `a${i}`, act: 'go' })) });
    expect(tb.match(/po-toolbar__btn"/g)).toHaveLength(TOOLBAR_MAX);
    expect(tb).toContain('po-toolbar__back');
    expect(ToolBar({ items: [{ icon: 'bell', label: '알림', badge: 120, act: 'go' }] })).toContain('99+');
    expect(playerInitial('카림 벤제마')).toBe('카');
    const r = PlayerRow({ name: '카림 벤제마', meta: '레알 마드리드 · 30세 · ST', value: 87, unit: 'OVR', badge: '사진 없음' });
    expect(r).toContain('po-prow__ini">카<');
    expect(PlayerRow({ name: '모하메드 살라', photo: 'x.webp', mine: true, act: 'go' })).toContain('po-prow__me');
  });
  it('Button link · Toast 성공/오류 · Meter 단위 · BottomSheet ✕ · HeroPanel 도구 줄', () => {
    expect(Button({ variant: 'link', children: '20명 더 보기' })).toContain('po-btn--link');
    expect(Toast({ kind: 'success', title: '저장했어요' })).toContain('po-toast--success');
    expect(Toast({ kind: 'error', title: '가져오지 못했어요' })).toContain('role="alert"');
    const m = Meter({ value: 88, unit: '/ 100', legend: '30 이하면 평점·선발 확률이 떨어져요' });
    expect(m).toContain('po-meter__side');
    expect(m).toContain('po-meter__legend');
    expect(BottomSheet({ title: '시트', onClose: { act: 'sheet-close' } })).toContain('po-sheet__x');
    expect(BottomSheet({ title: '시트', onClose: { act: 'sheet-close' }, closable: false })).not.toContain('po-sheet__x');
    const tb = ToolBar({ date: '8.3 (금)', items: [] });
    const hero = HeroPanel({ title: '홈', toolbar: tb, value: '8.3', compact: true });
    expect(hero).toContain('po-hero__bar--tools');
    expect(hero).not.toContain('po-hero__title');
    const face = HeroPanel({ title: '홈', toolbar: tb, face: 'a.webp', cutout: true, name: '손흥민', value: 87 });
    expect(face).toContain('has-toolbar');
    expect(face).toContain('po-toolbar__date');
  });
});
