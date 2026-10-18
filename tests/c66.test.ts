// C.66 (38b단계 화면 패치): 가로 전용(세로 폰 안내) · 독 [다음] 키(홈 = 맨 왼쪽 일반 칸) · 결정 순간 패 = 카드 그림 · 가로 폰 = PC 2열 + 낮은 높이
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { DOCK_PC, DOCK_PHONE, dock, type DockVM } from '../src/ui/views/common';
import { isLandPhone, isWide, LANDPHONE_QUERY, setWideForTest, WIDE_QUERY } from '../src/ui/skin';
import { isPortraitPitch, pitchOrient, setPitchOrient } from '../src/ui/pitch/renderer';

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

describe('가로 폰 보너스 배치 (C.66) · 세로 폰 기본 (C.66b)', () => {
  it('가로 폰도 2열(PC 규칙), 세로 폰 안내는 없음 (C.66b)', () => {
    expect(WIDE_QUERY).toContain(LANDPHONE_QUERY);
    expect(LANDPHONE_QUERY).toBe('(orientation: landscape) and (max-height: 520px)');
    expect(isWide()).toBe(false);
    expect(isLandPhone()).toBe(false);
    setWideForTest(true, true);
    expect(isWide() && isLandPhone()).toBe(true);
  });
  it('CSS: PC 2열 규칙은 모두 가로 폰도 받고, 폰 세로 규칙은 가로 폰에 안 걸린다', () => {
    expect(css).not.toMatch(/@media \(min-width: 1024px\) \{/);
    expect(css).not.toMatch(/@media \(max-width: 1023px\) \{/);
    expect(css.match(/@media \(min-width: 1024px\), \(orientation: landscape\) and \(max-height: 520px\)/g)!.length).toBeGreaterThanOrEqual(14);
    expect(css).not.toContain('rotate-gate');
    expect(css).not.toContain('@media (orientation: portrait) and (max-width: 600px)');
  });
});

describe('경기장 가로 고정 (C.66b, C.44a 세로 피치 롤백)', () => {
  afterEach(() => setPitchOrient('landscape'));
  it('기본은 가로, 예전에 저장된 auto 도 가로, 항상 세로를 고른 때만 세로', () => {
    expect(pitchOrient()).toBe('landscape');
    expect(isPortraitPitch()).toBe(false);
    setPitchOrient('auto');
    expect(isPortraitPitch()).toBe(false);
    expect(pitchOrient()).toBe('landscape');
    setPitchOrient('portrait');
    expect(isPortraitPitch()).toBe(true);
  });
  it('결정 순간: 가로 피치면 피치 칸 높이 = 피치 높이 (42% 고정 칸 해제)', () => {
    expect(css).toContain('html:not(.is-pitch-portrait) .mo-fold .mo-stage { height: auto; }');
  });
});
