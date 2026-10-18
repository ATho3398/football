// C.72 U7-d: 178 카드 획득 나중에·덱 배너 · 179 소속팀 없음 · 180 이적 소식 빈 상태 · 181 시즌 요약 포인트 줄 + 1부 후속
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import type { MarketVM, OfferVM } from '../src/ui/transferVM';
import type { SeasonVM } from '../src/ui/viewModels';
import { newsSection, offersView } from '../src/ui/views/transfer';
import { seasonView } from '../src/ui/views/screens';
import { deckView, deckVM } from '../src/ui/views/deck';
import { attrGrid } from '../src/ui/views/attrGrid';
import { momentCrop } from '../src/ui/views/moment';
import { MOMENT_ZOOM_LEN } from '../src/ui/pitch/renderer';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const son = () => newGame({ mode: 'real', playerId: 'son', seed: 'c72', difficulty: 'normal' });

describe('178 카드 획득 나중에 · 덱 배너', () => {
  it('획득 화면 아래 [나중에] 묶음, 덱 맨 위 "카드 선택 n개" 줄 (선택이 0이면 사라짐)', () => {
    const g = son();
    g.cards.picks.push({ source: 'level', label: '레벨 5 보상', options: ['elastico', 'sig-targetMan', 'sig-anchor'] });
    const vm = deckVM(g, g.cards.active, undefined);
    const pick = deckView(vm, null, 'home', { sel: 0, later: false });
    expect(pick).toContain('pick-later');
    expect(pick).toContain('나중에 고르고 덱 먼저 보기');
    expect(pick).toContain('선택은 덱 화면 위에 남아요');
    const deck = deckView(vm, null, 'home', { sel: 0, later: true });
    expect(deck).toContain('dk-pickbar');
    expect(deck).toContain('레벨 5 보상 · 3장 중 1장');
    expect(deck).toContain('data-act="more" data-v="pickLater"');
    g.cards.picks = [];
    expect(deckView(deckVM(g, g.cards.active, undefined), null, 'home', { sel: 0, later: true })).not.toContain('dk-pickbar');
  });
});

const offer = (i: number, fee?: string): OfferVM => ({
  i, team: `팀${i}`, teamId: 'cardiff', league: true, rating: 72, rank: 18, diff: -3, loan: false, years: 2, wage: '0.3억 원', annual: '15억 원', start: '로테이션', startPct: 60, tier: '하위', wagePct: 0, repLoss: 0, until: '2020-21', ...(fee ? { fee } : {}),
});
const market = (state: MarketVM['state'], offers: OfferVM[]): MarketVM => ({
  team: '토트넘 홋스퍼', rating: 80, ovr: 64, tier: '빅클럽', value: '12억 원',
  contract: { team: '토트넘 홋스퍼', until: '2020-21', yearsLeft: 2, wage: '', annual: '', loan: null, buyout: '100억 원' },
  refused: [], refusedOffers: [], tierNote: '계약이 2년 이상', window: '여름 이적시장', pending: true, renewal: null,
  request: { ok: false, reason: '', chance: null, status: null }, notice: null, moves: [], free: state === 'free', state, curWage: '', winter: false, offers,
});

describe('179 이적 제안 소속팀 없음', () => {
  it('칩 "소속팀 없음 · 자유계약", 안내 = 이적료 없이, 카드 이적료 자리 = 자유계약, 목록 머리 "모두 이적료 없음"', () => {
    const html = offersView(market('free', [offer(0), offer(1)]));
    expect(html).toContain('소속팀 없음 · 자유계약');
    expect(html).toContain('이적료 없이 바로 옮겨요(자유계약)');
    expect(html.match(/이적료 자유계약/g)?.length).toBe(2);
    expect(html).toContain('모두 이적료 없음');
    expect(html).not.toContain('지금 토트넘 홋스퍼 · 전력');
  });
  it('계약 남음은 그대로 (이적료 있는 카드, 지금 팀 칩)', () => {
    const html = offersView(market('remain', [offer(0, '30억 원')]));
    expect(html).toContain('지금 토트넘 홋스퍼');
    expect(html).toContain('이적료 30억 원');
    expect(html).not.toContain('자유계약</small>');
  });
});

describe('180 이적 소식 빈 상태', () => {
  it('아이콘 칸 · 다음 이적시장 칩 · [일정에서 보기]', () => {
    const html = newsSection(null);
    expect(html).toContain('tr-empty__icon');
    expect(html).toContain('다음 이적시장 · 1월 1일');
    expect(html).toContain('data-act="news-cal"');
  });
});

describe('181 시즌 요약 포인트 줄', () => {
  it('"포인트 찍기 nP" 라임 줄 · 다음 할 일 n개', () => {
    const vm = {
      season: '2018-19', nextSeason: '2019-20', team: '토트넘', pos: 1, apps: 36, goals: 21, assists: 14, avg: '7.88', injuries: 0, injuredWeeks: 0,
      achievements: [], achievementXp: 0, levelsGained: 8, seasonGoals: null, cardPicks: 0, repBefore: 500, repAfter: 630, tierName: '탑클래스', tier: 'top',
      slumpPenalty: 0, rankPenalty: null, badgeRep: 0, repLines: [], tierReached: null, next: null, position: 'LW', ovrBefore: 86, ovrAfter: 86,
      autoGrowth: [], veteran: [], aging: [], growthAges: '', ageFrom: 26, ageTo: 27, retired: false, forcedRetire: false, canRetire: false, points: 8, injury: null, badges: [],
      matches: { rows: [], total: null, recApps: 0 }, moms: 14, levelFrom: 0, levelTo: 8, months: [], positions: [], awards: [],
    } as unknown as SeasonVM;
    const html = seasonView(vm);
    expect(html).toContain('season-todo is-hi');
    expect(html).toContain('<em class="season-todo__num po-num">8P</em>');
    expect(html).toContain('선수 → 능력치');
    expect(html).toContain('다음 할 일');
    expect(html).toContain('1개');
  });
});

describe('1부 후속', () => {
  it('163 고른 칸 = 비용 줄 + [−][+] 큰 단추 줄', () => {
    const html = attrGrid([{ name: '마무리', cells: [{ attr: 'finishing', label: '슈팅', value: 16, key: false, edit: { cost: 2, steps: 1, reach: 1, ovrDelta: 0.4, maxed: false, blocked: false, canLower: true } }] }], 'finishing');
    expect(html).toContain('ag-steps');
    expect(html).toContain('OVR +0.4');
    expect(html).toContain('data-act="raise"');
    expect(html).toContain('data-act="lower"');
  });
  it('189 확대 창 = 장면별 crop (공격 44~100%, 수비 0~58%)', () => {
    expect(momentCrop({ scene: 'shot' })).toEqual({ len: MOMENT_ZOOM_LEN, pref: 1 - MOMENT_ZOOM_LEN / 2 });
    const d = momentCrop({ scene: 'oppShot' });
    expect(d.len).toBeCloseTo(0.58);
    expect(d.pref).toBeCloseTo(0.29);
  });
  it('버전 라벨', () => {
    expect(PATCH_LABEL).toBe('C.72');
    expect(STAGE_LABEL).toBe('41d단계');
  });
});
