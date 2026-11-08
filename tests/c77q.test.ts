// C.77q (50단계 메뉴 구조 정리 UI-A): 상점 화면 분리 · 카드 상세 · 코치·스태프 → 훈련 · 에이전트 → 선수 계약 · 독 재배치 · 중복 정리
import { afterEach, describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { pushInbox } from '../src/inbox';
import { financeVM, staffVM, agentVM } from '../src/ui/financeVM';
import { inboxVM } from '../src/ui/inboxVM';
import { agentSection, financeView, shopView, staffSection } from '../src/ui/views/finance';
import { cardDetailVM } from '../src/ui/views/deck';
import { DOCK_MORE, DOCK_PC, DOCK_PHONE, dock, routeOf, type DockVM } from '../src/ui/views/common';
import { calendarSection, homeView, recordsLinkRow } from '../src/ui/views/home';
import { dayVM, homeVM } from '../src/ui/viewModels';
import { setWideForTest } from '../src/ui/skin';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c77q-son', difficulty: 'normal' });
const dvm = (screen: string, o: Partial<DockVM> = {}): DockVM => ({ screen, prog: { label: '계속', icon: 'chevron-right', act: 'day-continue' }, tacticsOpen: true, points: 0, more: false, ...o });

afterEach(() => setWideForTest(null));

describe('C.77q 독 재배치', () => {
  it('폰 = 홈 · 훈련 · [다음] · 선수 · 상점 · 더보기, 더보기 줄 = 인박스 · 재정 · 월드 · 덱 · 전술 · 설정 · 저장', () => {
    expect(DOCK_PHONE).toEqual(['home', 'schedule', 'prog', 'player', 'shop', 'more']);
    expect(DOCK_MORE).toEqual(['inbox', 'finance', 'world', 'deck', 'tactics', 'settings', 'saves']);
  });
  it('PC = 폰 순서 + 더보기 칸 펼침 (더보기 없음)', () => {
    expect(DOCK_PC).toEqual(['home', 'schedule', 'inbox', 'finance', 'world', 'prog', 'player', 'shop', 'deck', 'tactics', 'settings', 'saves']);
    expect(DOCK_PC).not.toContain('more');
  });
  it('상점 칸 → 상점 화면, 상점 화면에서 켜짐 · 더보기는 안 켜짐', () => {
    const html = dock(dvm('shop'));
    expect(html).toContain('data-to="shop"');
    expect(html).toMatch(/is-on"[^>]*data-act="go" data-to="shop"/);
    expect(html).not.toMatch(/is-on"[^>]*data-act="dock-more"/);
  });
  it('코치 후보 배지는 훈련 칸', () => {
    const html = dock(dvm('home', { coach: 2 }));
    expect(html).toMatch(/data-v="schedule"[^>]*>.*?<b class="po-dock__badge po-num">2<\/b>/);
  });
});

describe('C.77q 옛 진입점 → 새 위치', () => {
  it('staff → 훈련 코치·스태프 탭, 재정 shop 탭 → 상점, 선수 탭', () => {
    expect(routeOf('staff')).toEqual({ screen: 'schedule', trainTab: 'staff' });
    expect(routeOf('finance', 'shop')).toEqual({ screen: 'shop' });
    expect(routeOf('finance')).toEqual({ screen: 'finance' });
    expect(routeOf('player', 'record')).toEqual({ screen: 'player', playerTab: 'record' });
    expect(routeOf('schedule', 'staff')).toEqual({ screen: 'schedule', trainTab: 'staff' });
  });
  it('옛 세이브 인박스의 코치 후보·스태프 재정 링크는 staff 로', () => {
    const g = son();
    pushInbox(g, { cat: 'money', title: '코치 후보 2명 도착', key: 'cand:9', body: 'x', link: { to: 'finance', label: '후보 보기' } });
    pushInbox(g, { cat: 'money', title: '투자 정산', key: 'invest:2018', body: 'x', link: { to: 'finance', label: '재정 보기' } });
    const rows = inboxVM(g, 'all').rows;
    expect(rows.find((r) => r.title === '코치 후보 2명 도착')!.link!.to).toBe('staff');
    expect(rows.find((r) => r.title === '투자 정산')!.link!.to).toBe('finance');
  });
});

describe('C.77q 상점 · 카드 상세', () => {
  it('재정은 돈 · 생활·투자 두 탭(상점·스태프·에이전트 없음)', () => {
    const vm = financeVM(son());
    const money = financeView(vm, 'money');
    expect(money).toContain('재정 탭');
    expect(money).not.toContain('카드 상점');
    expect(money).not.toContain('코치 모집');
    expect(financeView(vm, 'life')).not.toContain('에이전트</');
  });
  it('상점 화면: 이번 주 카드 · 카드팩 · 카드를 누르면 card-open(view)', () => {
    const g = son();
    const vm = financeVM(g);
    const html = shopView(vm);
    expect(html).toContain('이번 주 카드');
    expect(html).toContain('카드팩 사기');
    expect(html).toContain('data-act="card-open"');
    expect(html).toContain('data-from="view"');
  });
  it('카드 상세 시트가 열린다 (덱과 같은 cardSheet, 닫기만)', () => {
    const g = son();
    const vm = financeVM(g);
    const id = vm.shop![0]!.id;
    const c = cardDetailVM(g, id, undefined)!;
    expect(c.id).toBe(id);
    const html = shopView(vm, { sheet: c });
    expect(html).toContain('gc-detail');
    expect(html).toContain('data-act="card-close"');
    expect(html).not.toContain('data-act="deck-add"');
    expect(cardDetailVM(g, 'nope', undefined)).toBeNull();
  });
  it('방금 연 카드팩 줄 (mini · 누르면 상세)', () => {
    const g = son();
    const vm = financeVM(g);
    const ids = vm.shop!.slice(0, 2).map((s) => s.id);
    const html = shopView(vm, { lastPack: ids });
    expect(html).toContain('방금 연 카드팩');
    expect(html.split('data-act="card-open"').length - 1).toBeGreaterThanOrEqual(vm.shop!.length + 2);
  });
});

describe('C.77q 코치·스태프 → 훈련, 에이전트 → 선수 계약', () => {
  it('훈련 탭 스태프 섹션: 스태프 · 코치 모집', () => {
    const html = staffSection(staffVM(son()));
    expect(html).toContain('코치 모집');
    expect(html).toContain('data-act="fn-scout"');
  });
  it('staffVM 은 상점을 만들지 않는다 (상점 주간 생성 시점 그대로)', () => {
    const g = son();
    staffVM(g);
    agentVM(g);
    expect(g.money?.shop).toBeUndefined();
  });
  it('에이전트 섹션', () => {
    const html = agentSection(agentVM(son()));
    expect(html).toContain('고급 에이전트');
    expect(html).toContain('data-act="fn-agent"');
  });
});

describe('C.77q 중복 정리', () => {
  it('홈: 직접/자동 · 재정 동전 없음, 코치 후보는 호루라기 → staff', () => {
    const g = son();
    const vm = homeVM(g);
    vm.money = 2;
    const html = homeView(vm);
    expect(html).not.toContain('data-act="ctl-mode"');
    expect(html).not.toContain('data-to="finance"');
    expect(html).toContain('data-to="staff"');
  });
  it('일정: 다른 경기 계산 고르기 없음(설정 안내 한 줄)', () => {
    const html = calendarSection(dayVM(son())!);
    expect(html).not.toContain('data-act="opt-quick"');
    expect(html).toContain('설정 › 경기 진행');
  });
  it('홈 기록 도전은 링크 한 줄 → 선수 › 기록', () => {
    expect(recordsLinkRow(0)).toBe('');
    const r = recordsLinkRow(3);
    expect(r).toContain('data-to="player"');
    expect(r).toContain('data-tab="record"');
  });
});
