// C.66 (38b단계 화면 패치): 가로 전용(세로 폰 안내) · 독 [다음] 키(홈 = 맨 왼쪽 일반 칸) · 결정 순간 패 = 카드 그림 · 가로 폰 = PC 2열 + 낮은 높이
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { DOCK_PC, DOCK_PHONE, dock, type DockVM } from '../src/ui/views/common';
import { isLandPhone, isWide, LANDPHONE_QUERY, PORTRAIT_PHONE_QUERY, setWideForTest, WIDE_QUERY } from '../src/ui/skin';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const vm = (o: Partial<DockVM> = {}): DockVM => ({ screen: 'player', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' }, tacticsOpen: true, points: 0, more: false, ...o });

afterEach(() => setWideForTest(null));

describe('독 [다음] 키 (C.66)', () => {
  it('홈 = 맨 왼쪽 일반 칸, [다음] = 가운데 강조 키 (폰·PC 공통), 따로 있던 홈 키 없음', () => {
    expect(DOCK_PHONE[0]).toBe('home');
    expect(DOCK_PHONE.indexOf('prog')).toBe(2);
    expect(DOCK_PC[0]).toBe('home');
    expect(DOCK_PC.indexOf('prog')).toBe((DOCK_PC.length - 1) / 2);
    const h = dock(vm({ screen: 'home' }));
    expect(h).not.toContain('po-dock__home');
    expect(h.match(/po-dock__next/g)?.length).toBe(2);
    expect(h).toContain('aria-label="다음 · 계속"');
    expect(h.match(/po-dock__item is-on" data-act="go-tab" data-v="home"/g)?.length).toBe(2);
  });
  it('상태(계속·진행 중·경기·경기 중·답하기)는 [다음] 키 글자로, 진행 중이면 누를 수 없음 표시', () => {
    const busy = dock(vm({ prog: { label: '진행 중', icon: 'clock', act: 'noop', kind: 'busy' } }));
    expect(busy).toContain('po-dock__next is-busy" data-act="noop" aria-disabled="true"');
    const live = dock(vm({ prog: { label: '경기 중', icon: 'match', act: 'live-return', live: true } }));
    expect(live).toContain('po-dock__next is-live');
    expect(live).toContain('po-dock__live');
  });
});

describe('가로 전용 (C.66)', () => {
  it('가로 폰도 2열(PC 규칙), 세로 폰은 안내', () => {
    expect(WIDE_QUERY).toContain(LANDPHONE_QUERY);
    expect(LANDPHONE_QUERY).toBe('(orientation: landscape) and (max-height: 520px)');
    expect(PORTRAIT_PHONE_QUERY).toContain('portrait');
    expect(isWide()).toBe(false);
    expect(isLandPhone()).toBe(false);
    setWideForTest(true, true);
    expect(isWide() && isLandPhone()).toBe(true);
  });
  it('CSS: PC 2열 규칙은 모두 가로 폰도 받고, 폰 세로 규칙은 가로 폰에 안 걸린다', () => {
    expect(css).not.toMatch(/@media \(min-width: 1024px\) \{/);
    expect(css).not.toMatch(/@media \(max-width: 1023px\) \{/);
    expect(css.match(/@media \(min-width: 1024px\), \(orientation: landscape\) and \(max-height: 520px\)/g)!.length).toBeGreaterThanOrEqual(14);
    expect(css).toContain('@media (orientation: portrait) and (max-width: 600px)');
    expect(css).toMatch(/\.rotate-gate \{ position: fixed/);
  });
});
