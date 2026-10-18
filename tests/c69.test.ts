// C.69 U7-a: 선택지 접은 한 줄 · 판정 없음 "확정" 칩 · 결과 낮은 판 · 독 v3(PC 11칸 · 상태) · 가로 확대 보기 계산
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ChoiceButton, ResultSplash } from '../src/ui/components';
import { DOCK_MORE, DOCK_PC, DOCK_PHONE, dock, dockPc, type DockVM } from '../src/ui/views/common';
import { clampViewY, viewHeightM } from '../src/ui/pitch/renderer';

const css = readFileSync(new URL('../src/ui/style.css', import.meta.url), 'utf8');
const base = { kind: 'safe' as const, name: '해리 케인에게 전진 패스', success: { text: '패스 연결', rating: '+0.05' }, fail: { text: '공을 뺏김', rating: '-0.02' } };

describe('선택지 접은 한 줄 (189)', () => {
  it('collapsed = po-choice--row, 판정 없음(certain) = 확정 칩 · 실패 줄 없음', () => {
    const row = ChoiceButton({ ...base, chance: 88, collapsed: true });
    expect(row).toContain('po-choice--row');
    expect(row).toContain('po-out--bad');
    const sure = ChoiceButton({ ...base, chance: null, collapsed: true, certain: true });
    expect(sure).toContain('po-choice__sure');
    expect(sure).toContain('is-certain');
    expect(sure).not.toContain('po-out--bad');
    expect(sure).not.toContain('판정 없음');
    // certain 을 안 주면 예전 "판정 없음" 글자
    expect(ChoiceButton({ ...base, chance: null })).toContain('판정 없음');
  });
});

describe('결과 판 (190 · 172)', () => {
  it('compact · 보통 회색 · 실점 도장', () => {
    expect(ResultSplash({ result: 'success', title: '케인에게 연결', compact: true, rating: 5.9, ratingDelta: 0.29 })).toContain('po-splash--compact');
    expect(ResultSplash({ result: 'neutral', title: '공을 지킴' })).toContain('po-splash--mid');
    const c = ResultSplash({ result: 'conceded', title: '역습 실점', compact: true });
    expect(c).toContain('po-splash--concede');
    expect(c).toContain('실점');
  });
});

describe('독 v3 (201)', () => {
  const vm = (p: Partial<DockVM> = {}): DockVM => ({ screen: 'home', prog: { label: '계속', icon: 'chevron-right', act: 'day-continue', kind: 'continue' }, tacticsOpen: true, points: 0, more: false, inbox: 3, ...p });
  it('PC 11칸: 홈 · 선수 · 덱 · 전술 · 인박스 | [다음] | 훈련·일정 · 월드 · 재정 · 설정 · 저장', () => {
    expect(DOCK_PHONE).toEqual(['home', 'player', 'prog', 'schedule', 'more']);
    expect(DOCK_PC).toEqual(['home', 'player', 'deck', 'tactics', 'inbox', 'prog', 'schedule', 'world', 'finance', 'settings', 'saves']);
    expect(dockPc(DOCK_PHONE).indexOf('prog')).toBe(5);
    expect(DOCK_MORE).toEqual(['inbox', 'finance', 'world', 'deck', 'tactics', 'settings', 'saves']);
    const h = dock(vm());
    expect(h).toContain('po-dock--v3');
    expect(h).toContain('data-to="finance"');
  });
  it('[다음] 상태 running · locked, 접힌 더보기 배지 = 인박스 합', () => {
    expect(dock(vm({ prog: { label: '진행 중', icon: 'running', act: 'noop', kind: 'running' } }))).toContain('po-dock__next is-running" data-act="noop" aria-disabled="true"');
    expect(dock(vm({ prog: { label: '잠김', icon: 'lock', act: 'noop', kind: 'locked' } }))).toMatch(/po-dock__next is-locked" data-act="noop" disabled/);
    const phone = (h: string) => h.split('dock-phone')[1]!.split('</div>')[0]!;
    expect(phone(dock(vm()))).toMatch(/data-act="dock-more"[^]*?po-dock__badge po-num">3</);
    // 펼치면 더보기 칸 배지는 없고 줄의 인박스 칸에
    const open = dock(vm({ more: true }));
    expect(phone(open)).not.toMatch(/data-act="dock-more"[^>]*>[^]*?po-dock__badge/);
    expect(open.split('dock-more__scroll')[1]).toContain('po-dock__badge po-num">3<');
  });
  it('결정 순간 화면은 모든 폭에서 독 숨김 (CSS)', () => {
    expect(css).toMatch(/\n\.app-moment > \.dock-bar \{ display: none; \}/);
  });
});

describe('가로 확대 보기 (189 Pitch crop · aspect)', () => {
  it('390×270 칸 · 56% 길이 → 폭 방향 약 40m, 가운데는 피치(+4m) 안', () => {
    const vh = viewHeightM(390, 270, 0.56);
    expect(vh).toBeGreaterThan(39);
    expect(vh).toBeLessThan(42);
    expect(clampViewY(0, vh)).toBeCloseTo(vh / 2 - 4, 5);
    expect(clampViewY(68, vh)).toBeCloseTo(68 - vh / 2 + 4, 5);
    expect(clampViewY(30, 80)).toBe(34);
  });
});
