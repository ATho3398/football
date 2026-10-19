// C.59 (34o, U5-e): 설정 접기·이동 칩 · 꾸미기 하위 화면 4개(선수 이름 · 경기 아이콘 · 페이스온 · 카드 이미지)
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { CARDS } from '../src/config/cards';
import { settingsView, SET_PAGES, type SetUI } from '../src/ui/views/settings';
import { CARD_ART_PAGE, CARD_ART_UI_DEFAULT, caRangeText } from '../src/ui/views/cardArtSettings';
import { versionVM } from '../src/ui/viewModels';

const FO = { tab: 'players' as const, q: '', sel: null, crop: null };
const PX = { tab: 'players' as const, q: '', team: '', sel: null, kitSel: null };
const NM = { q: '', team: '', sel: null };
const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c59-son', difficulty: 'normal' });
const view = (g: ReturnType<typeof son> | null, set: SetUI, o: { px?: object; nm?: object; ca?: object; locked?: boolean } = {}) =>
  settingsView(g, FO, versionVM(g), { ...NM, ...o.nm }, { ...PX, ...o.px }, { ...CARD_ART_UI_DEFAULT, ...o.ca }, !!o.locked, set);

describe('C.59 설정 첫 화면 (66·67)', () => {
  it('섹션 5개, 펼친 것 하나만 보임 + 이동 칩', () => {
    const h = view(son(), { page: 'main', open: 'play' });
    expect(h.match(/class="set-sec[ "]/g)).toHaveLength(5);
    expect(h.match(/class="set-sec__body"(?! hidden)/g)).toHaveLength(1);
    expect(h).toContain('data-act="set-open"');
    expect(h).toContain('po-tabs--scroll');
    // 하위 화면 목록은 첫 화면에 없다 (꾸미기 줄만)
    for (const p of SET_PAGES) expect(h).toContain(`data-act="set-page" data-v="${p.id}"`);
    expect(h).not.toContain('nm-row');
    expect(h).not.toContain('ca-row');
  });
  it('경기 중이면 경기 진행 섹션 잠김 + 안내', () => {
    const h = view(son(), { page: 'main', open: 'play' }, { locked: true });
    expect(h).toContain('경기 중 잠김');
    expect(h).toMatch(/id="set-play"[\s\S]*?disabled/);
    expect(h).not.toContain('data-act="ctl-mode"');
  });
});

describe('C.59 꾸미기 하위 화면', () => {
  it('공통: 뒤로 가기 = set-back, 이동 칩 4', () => {
    for (const p of SET_PAGES) {
      const h = view(son(), { page: p.id, open: null });
      expect(h).toContain('data-act="set-back"');
      expect(h.match(/data-act="set-page"/g)).toHaveLength(4);
    }
  });
  it('경기 아이콘: 인물 14 · 유니폼 32 PixelTile, 고름 ✓ 하나 · 기본 꼬리표', () => {
    const g = son();
    const ppl = view(g, { page: 'pixel', open: null }, { px: { sel: 'son' } });
    expect(ppl).toContain('인물 14종');
    const kits = view(g, { page: 'pixel', open: null }, { px: { tab: 'kits' } });
    expect(kits.match(/class="po-pixel[ "]/g)).toHaveLength(32);
    expect(kits.match(/po-pixel__check/g)).toHaveLength(1);
    expect(kits).toContain('po-pixel__def');
  });
  it('선수 이름: TextField 검색 + 팀 거르기, 편집 칸 TextField', () => {
    const h = view(son(), { page: 'names', open: null }, { nm: { sel: 'son' } });
    expect(h).toContain('id="nm-q"');
    expect(h).toContain('id="nm-team"');
    expect(h).toContain('id="nm-nick"');
    expect(h).toContain('po-field');
  });
  it('카드 이미지: 처음 8장 + 더 보기, 편집은 버튼 3, 경기 중 잠금', () => {
    const list = view(null, { page: 'cardart', open: null });
    expect(list.match(/class="real-row ca-row/g)).toHaveLength(CARD_ART_PAGE);
    expect(list).toContain(`${CARDS.length - CARD_ART_PAGE}장 더 보기`);
    const ed = view(null, { page: 'cardart', open: null }, { ca: { sel: CARDS[0]!.id }, locked: true });
    expect(ed).toContain('경기가 끝나면 바꿀 수 있어요');
    expect(ed.match(/data-act="ca-(upload|adjust|clear)"[^>]*disabled/g)).toHaveLength(3);
    expect(caRangeText('ca-x', 8)).toBe('오른쪽 8%');
    expect(caRangeText('ca-zoom', 140)).toBe('1.4배');
  });
  it('페이스온: 게임 밖에서도 목록', () => {
    const h = view(null, { page: 'faceon', open: null });
    expect(h).toContain('id="fo-q"');
    expect(h).toContain('id="fo-file"');
  });
});
