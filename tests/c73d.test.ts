// C.73d (사용자 요청): 초기화면으로 가는 길 — 홈 왼쪽 위 ‹ · 설정 세이브 섹션 "초기화면으로" · 경기 중 숨김
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { homeView } from '../src/ui/views/home';
import { settingsView } from '../src/ui/views/settings';
import { CARD_ART_UI_DEFAULT } from '../src/ui/views/cardArtSettings';
import { homeVM, versionVM } from '../src/ui/viewModels';

const FO = { tab: 'players' as const, q: '', sel: null, crop: null };
const PX = { tab: 'players' as const, q: '', team: '', sel: null, kitSel: null };
const NM = { q: '', team: '', sel: null };
const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c73d', difficulty: 'normal' });
const settings = (g: ReturnType<typeof son> | null, locked: boolean) =>
  settingsView(g, FO, versionVM(g), NM, PX, CARD_ART_UI_DEFAULT, locked, { page: 'main', open: 'saves' });

describe('C.73d 초기화면으로', () => {
  it('홈 머리말 왼쪽 위 ‹ = to-title (경기 중이 아닐 때만)', () => {
    const g = son();
    const on = homeView({ ...homeVM(g), exit: true });
    expect(on).toMatch(/class="po-hero__back"[^>]*data-act="to-title"/);
    const off = homeView({ ...homeVM(g), exit: false });
    expect(off).not.toContain('data-act="to-title"');
    expect(off).toContain('po-hero__noback');
  });

  it('설정 세이브 섹션에 [초기화면으로], 경기 중·게임 밖에는 없음', () => {
    const g = son();
    expect(settings(g, false)).toContain('data-act="to-title"');
    expect(settings(g, false)).toContain('초기화면으로');
    expect(settings(g, true)).not.toContain('data-act="to-title"');
    expect(settings(null, false)).not.toContain('data-act="to-title"');
  });
});
