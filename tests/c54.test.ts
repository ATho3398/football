// C.54 (34j, U5-a 기반): 디자인 154 독 · 새 컴포넌트 4종 · GameCard 기본 장면 · HeroPanel 글자 머리말 · Tabs scroll/cols · kitClash
import { describe, expect, it } from 'vitest';
import { FinChip, GameCard, HeroPanel, OfferCard, PixelTile, PointBar, Stepper, Tabs, TagChip, TextField, TransferRow, heroIsText, pointBarState } from '../src/ui/components';
import { ICON_PATHS } from '../src/ui/components/iconPaths';
import { DOCK_PHONE, dock, dockColumns, dockMoreSheet } from '../src/ui/views/common';
import { kitClash } from '../src/pixel';

const prog = { label: '답하기', icon: 'chat' as const, act: 'day-continue', kind: 'answer' as const, badge: 2 };

describe('C.54 독 (디자인 154)', () => {
  it('홈 원은 양쪽 열 합이 같아 정확히 가운데 (5칸·6칸 모두)', () => {
    const fr = (cols: string) => [...cols.matchAll(/minmax\(0, ([\d.]+)fr\)|(\d+)px/g)].map((m) => (m[2] ? -1 : parseFloat(m[1]!)));
    for (const ids of [DOCK_PHONE, ['prog', 'player', 'home', 'schedule', 'world', 'more'] as const]) {
      const f = fr(dockColumns([...ids], 72));
      const h = f.indexOf(-1);
      const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
      expect(sum(f.slice(0, h))).toBeCloseTo(sum(f.slice(h + 1)), 2);
    }
    expect(dockColumns(['prog', 'player', 'home', 'schedule', 'world', 'more'], 72)).toBe('minmax(0, 4fr) minmax(0, 2fr) 72px minmax(0, 2fr) minmax(0, 2fr) minmax(0, 2fr)');
  });
  it('진행 칸 상태·배지, 홈 화면이면 라임 면(is-on), 다른 화면이면 테두리', () => {
    const h = dock({ screen: 'player', prog, tacticsOpen: true, points: 35, more: false });
    expect(h).toContain('po-dock__go is-answer');
    expect(h).toMatch(/po-dock__golabel">답하기<\/span><b class="po-dock__badge po-num">2</);
    expect(h).not.toContain('po-dock__home is-on');
    expect(h).toContain('<b class="po-dock__badge po-num">35</b>');
    const home = dock({ screen: 'home', prog: { label: '경기 중', icon: 'match', act: 'live-return', live: true }, tacticsOpen: true, points: 0, more: false });
    expect(home).toContain('po-dock__home is-on');
    expect(home).toContain('po-dock__go is-live');
    expect(home).toContain('po-dock__live');
  });
  it('더보기 시트에는 모바일 독에 없는 칸만 (월드 포함)', () => {
    const s = dockMoreSheet(true);
    expect(s).toContain('월드');
    expect(DOCK_PHONE.includes('world')).toBe(false);
  });
});

describe('C.54 컴포넌트', () => {
  it('아이콘 12종 추가', () => {
    for (const n of ['menu', 'deck', 'chat', 'trophy', 'swap', 'edit', 'eye', 'grid', 'face', 'sliders', 'pin', 'collapse']) expect(ICON_PATHS).toHaveProperty(n);
  });
  it('HeroPanel 글자 값 자동 판별·compact', () => {
    expect(heroIsText('계약 만료')).toBe(true);
    expect(heroIsText('8.19')).toBe(false);
    expect(heroIsText('3위')).toBe(false);
    expect(HeroPanel({ title: '재계약', value: '계약 만료', compact: true, pad: false })).toContain('po-hero--compact po-hero--text');
  });
  it('Tabs scroll / cols', () => {
    const items = [1, 2, 3, 4, 5, 6].map((i) => ({ id: String(i), label: `탭${i}` }));
    expect(Tabs({ items, value: '1', scroll: true })).toContain('po-tabs--scroll');
    expect(Tabs({ items, value: '1', cols: 3 })).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });
  it('TextField · Stepper · PointBar', () => {
    expect(TextField({ label: '이름', value: '', placeholder: '검색' })).toContain('is-ph');
    const st = Stepper({ label: '나이', value: 15, min: 15, max: 23, unit: '세', sub: '+3P', subTone: 'gain' });
    expect(st).toContain('15~23세');
    expect(st.match(/disabled/g)?.length).toBe(1);
    expect(pointBarState(-3)).toBe('over');
    expect(PointBar({ left: -3, total: 40 })).toContain('3P 넘쳤어요');
    expect(PointBar({ left: 0, total: 40 })).toContain('is-zero');
  });
  it('TagChip 규칙: 색·기호·해제형·스토리', () => {
    expect(TagChip({ name: '유리몸', polarity: 'con' })).toContain('po-tag--gen po-tag--con');
    expect(TagChip({ name: '프리킥', kind: 'career', release: '시즌 10골' })).toContain('is-release');
    const story = TagChip({ name: '원더키드', kind: 'story', polarity: 'con' });
    expect(story).toContain('po-tag--none');
    expect(story).toContain('효과 없음');
  });
  it('PixelTile 정수배·선택·기본', () => {
    const t = PixelTile({ sprite: { kind: 'kit', kit: '#c8102e', pattern: 'stripe' }, scale: 7 as never, label: '빨강', selected: true, isDefault: true, act: 'px' });
    expect(t).toContain('--px-size:96px');
    expect(t).toContain('po-pixel__check');
    expect(t).toContain('po-pixel__def');
  });
  it('GameCard 그림 없음 = 종류 장면(기본), scene = 옛 장면, 이유 칩', () => {
    const card = { name: '중거리', type: 'play' as const, rarity: 'rare' as const, level: 1, effect: { pre: '슈팅' }, condition: { text: '없음', met: true } };
    const mini = GameCard({ card, size: 'mini', state: 'disabled', reason: '역할 불일치' });
    expect(mini).toContain('viewBox="0 0 280 210"');
    expect(mini).toContain('M0 150H280');
    expect(mini).toContain('po-card__reason');
    expect(GameCard({ card: { ...card, placeholder: 'scene' }, size: 'mini' })).toContain('viewBox="20 90 240 300"');
  });
  it('OfferCard · TransferRow 새 props (재정 등급·이적료·친정·몸값)', () => {
    expect(FinChip('상위')).toContain('po-fin');
    expect(FinChip('없음')).toBe('');
    const o = OfferCard({ offer: { club: '첼시', league: '프리미어리그', strength: 80, apps: 60, starts: 40, years: '4년', weekly: '1억', yearly: '52억', tier: '빅클럽', fee: '118억', homeClub: '유스 출신' } });
    expect(o).toContain('이적료 118억');
    expect(o).toContain('po-offer__home');
    const r = TransferRow({ name: '김', pos: 'ST', age: 22, ovr: 70, from: '풀럼', to: '첼시', fee: '50억', toTier: '빅클럽' });
    expect(r).toContain('몸값');
    expect(r).toContain('po-fin--sm');
  });
});

describe('C.54 kitClash', () => {
  it('흑백 줄무늬 vs 검정은 겹침, 빨강 vs 하양은 아님', () => {
    expect(kitClash('S01', 'C05')).toBe(true);
    expect(kitClash('C01', 'C02')).toBe(false);
  });
});
