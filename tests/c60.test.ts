// C.60 U5-f 이적 · 월드 · 시즌 종료 · 덱 · 경기 결과 · 세이브 · 카드 획득 (디자인 85 · 97~99 · 101~112 · 116 · 117 · 119 · 144~149 · 155)
import { describe, expect, it } from 'vitest';
import { endSeason, newGame, playRound, type GameState } from '../src/game';
import type { Replay } from '../src/replay';
import { matchResultVM, savesVM, seasonVM, versionVM, worldVM } from '../src/ui/viewModels';
import { marketVM, type MarketVM, type NewsVM, type OfferVM } from '../src/ui/transferVM';
import { newsSection, offersView, tagKindOf, tagNewsSection } from '../src/ui/views/transfer';
import { savesView, seasonView, worldView } from '../src/ui/views/screens';
import { deckView, deckVM, shortReason } from '../src/ui/views/deck';
import { matchResultView } from '../src/ui/views/matchResult';
import { Modal } from '../src/ui/components';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const son = (seed = 'c60-son') => newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });

function offer(i: number, o: Partial<OfferVM> = {}): OfferVM {
  return {
    i, team: `팀${i}`, teamId: `t${i}`, league: true, rating: 80 + i, rank: i + 1, diff: i - 1, loan: false, years: 3, wage: '1.8억 원', annual: '93.9억 원', start: '주전', startPct: 70,
    tier: '빅클럽', wagePct: 40, repLoss: 0, until: '2021-22', ...o,
  };
}

describe('이적 제안 (디자인 97 · 98 · 99 · 145)', () => {
  const base = (): MarketVM => marketVM(son());
  it('제안 둘 이하 = 모두 OfferCard, 셋 이상 = 고른 것만 펼치고 나머지는 접힌 줄', () => {
    const two = offersView({ ...base(), offers: [offer(0), offer(1, { youth: true })] });
    expect(two.match(/<article class="po-offer/g)?.length).toBe(2);
    expect(two).toContain('친정 · 유스 구단');
    expect(two).toContain('data-act="team-open" data-v="t0"');
    expect(two).toContain('지금보다 주급 +40%');
    expect(two).toContain('모두 거절하고');
    const four = offersView({ ...base(), offers: [0, 1, 2, 3].map((i) => offer(i)) }, 2);
    expect(four.match(/<article class="po-offer/g)?.length).toBe(1);
    expect(four.match(/data-act="offer-sel"/g)?.length).toBe(3);
    expect(four).toMatch(/data-act="offer-accept" data-i="2"/);
    // 주급이 모두 같으면 목록 위 한 줄
    expect(four).toContain('주급은 모두 1.8억 원');
  });
  it('상태 줄: 겨울 = 진행 멈춤, 자유계약 마지막 제안은 거절 못 함', () => {
    expect(offersView({ ...base(), winter: true, offers: [offer(0)] })).toContain('진행을 멈췄어요.');
    const free = offersView({ ...base(), free: true, state: 'free', offers: [offer(0, { lastFree: true })] });
    expect(free).toContain('소속팀이 없어요');
    expect(free).toMatch(/data-act="offer-decline" data-i="0" disabled/);
  });
  it('수락 확인 모달 표 (98)', () => {
    const html = Modal({ title: '맨체스터 시티로 갈까요?', rows: [['계약', '5년'], ['주급', '1.2억 → 1.8억 원']], children: '되돌릴 수 없어요.' });
    expect(html).toContain('po-modal__rows');
    expect(html).toContain('<dt>주급</dt>');
  });
});

describe('월드 (디자인 101~105 · 146~148)', () => {
  it('compact 머리말 · 탭 4 · 재 열 막대 + 재정 등급 범례, 리그 스타 5명 + 더 보기', () => {
    const g = son();
    const vm = worldVM(g);
    const t = worldView(vm, 'table');
    expect(t).toContain('po-hero--compact');
    expect(t).toContain('>득점<');
    expect(t.match(/po-fin--bars/g)?.length).toBe(vm.table.length);
    expect(t.match(/fin-legend__cell/g)?.length).toBe(4);
    const st = worldView(vm, 'stars');
    if (vm.stars.length > 5) {
      expect(st.match(/class="star-row"/g)!.length).toBeLessThan(vm.stars.length + vm.legends.length);
      expect(st).toContain('data-act="more" data-v="stars"');
      expect(worldView(vm, 'stars', '', { stars: true })).toContain('접기');
    }
  });
  it('이적 소식: 빈 상태, TransferRow(누르면 선수 상세) · 리그 안/밖 묶음 · 5명 + 더 보기 · 빈자리 보충 줄', () => {
    expect(newsSection(null)).toContain('아직 이적시장이 열리지 않았어요');
    const row = (k: number, into: boolean) => ({ id: `p${k}`, name: `선수${k}`, pos: 'ST', age: 24, ovr: 80 - k, from: 'A', to: 'B', why: '출전 시간', real: false, into, out: !into, fill: k === 0 ? { name: '보충', pos: 'ST', age: 28, ovr: 75, club: '세비야' } : null, mine: false, fee: '37억 원', toTier: '빅클럽', open: into ? `p${k}` : null });
    const vm: NewsVM = { title: '2019-20 여름 이적시장', count: 8, inLeague: 7, rows: [...[0, 1, 2, 3, 4, 5, 6].map((k) => row(k, true)), row(7, false)] };
    const html = newsSection(vm);
    expect(html.match(/<button type="button" class="po-xfer/g)?.length).toBe(5);
    expect(html).toContain('po-xfer--fill');
    expect(html).toContain('리그 밖');
    expect(html).toContain('data-act="more" data-v="xin"');
    expect(newsSection(vm, { xin: true }).match(/<button type="button" class="po-xfer/g)?.length).toBe(7);
  });
  it('태그 소식: 종류 칩 = 코드의 실제 태그 종류', () => {
    expect(tagKindOf('원클럽맨').kind).toBe('career');
    expect(tagKindOf('영원한 리버풀').kind).toBe('career');
    expect(tagKindOf('득점 기계').kind).toBe('story');
    expect(tagKindOf('노익장')).toEqual({ kind: 'play', polarity: 'pro' });
    const rows = Array.from({ length: 9 }, (_, k) => ({ season: '2019-20', name: `N${k}`, team: '첼시', tag: '원더키드' }));
    const html = tagNewsSection(rows);
    expect(html.match(/tag-news__row/g)?.length).toBe(7);
    expect(html).toContain('2건 더 보기');
  });
});

describe('시즌 종료 (디자인 106~112)', () => {
  let g: GameState;
  it('요약 = 큰 머리말(순위) + 다음 할 일 + [시즌 상세 보기], 상세 = compact(골) + 6탭 3열 + 뒤로', () => {
    g = newGame({ mode: 'prospect', position: 'ST', seed: 'c60-season', difficulty: 'normal' });
    while (g.league.round < g.league.schedule.length) playRound(g, { engine: 'quick' });
    endSeason(g);
    const vm = seasonVM(g)!;
    const todo = { title: '계약 만료 · 응답 필요', sub: '답하기 전에는 다음 시즌으로 안 넘어가요', act: 'go', data: { to: 'contract' }, cta: '답하기', warn: true, icon: 'chat' as const };
    const sum = seasonView(vm, '', true, null, '', todo);
    expect(sum).toContain(`${vm.pos}위`);
    expect(sum).not.toContain('po-hero--compact');
    expect(sum).toContain('다음 할 일');
    expect(sum).toContain('season-todo is-warn');
    expect(sum).toContain('시즌 상세 보기');
    expect(sum).not.toContain('시즌 시작'); // 답하기 전에는 시작 단추 없음
    expect(seasonView(vm)).toContain('시즌 시작');
    const det = seasonView(vm, '', false, 'awards');
    expect(det).toContain('po-hero--compact');
    expect(det).toContain(`${vm.goals}골`);
    expect(det).toContain('repeat(3, minmax(0, 1fr))');
    expect(det.match(/role="tab"/g)?.length).toBe(6);
    expect(det).toContain('data-act="season-tab" data-v="close"');
  });
});

describe('덱 · 카드 획득 (디자인 85 · 116 · 144)', () => {
  it('보상이 있으면 먼저 3택1 화면, [나중에] 뒤 덱 = compact 머리말 · 이유 칩 짧게', () => {
    const g = son('c60-deck');
    g.cards.picks.push({ source: 'level', label: '레벨 5 보상', options: ['elastico', 'sig-targetMan', 'sig-anchor'] });
    const vm = deckVM(g, g.cards.active, undefined);
    const pick = deckView(vm, null, 'home', { sel: 0, later: false });
    expect(pick).toContain('카드 획득');
    expect(pick).toContain('3택1');
    expect(pick).toContain('data-act="pick-take" data-v="0:0"');
    expect(pick).toContain('이 카드 받기');
    const deck = deckView(vm, null, 'home', { sel: 0, later: true });
    expect(deck).toContain('po-hero--compact');
    expect(deck).toContain('기본 장면');
    expect(deck).toContain('카드 선택 <em class="po-num">1</em>개를 받을 수 있어요'); // C.72 디자인 178 덱 배너
    expect(shortReason('ST/CF 포지션 카드')).toBe('포지션');
    expect(shortReason('능력치 요건 미달')).toBe('능력치');
    expect(shortReason('그 역할일 때만')).toBe('역할');
  });
});

describe('경기 결과 (디자인 117 · 155)', () => {
  it('머리 아래 하이라이트 패널 · 득점 줄 · 결정 기록 3줄 + 더 보기', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c60-mr', difficulty: 'normal' });
    let rp: Replay | null = null;
    let tries = 0;
    do playRound(g, { onReplay: (r) => { rp = r; } }); while (!rp && ++tries < 6);
    const vm = matchResultVM(g, rp)!;
    const html = matchResultView(vm);
    expect(html).toContain('mr-rewatch');
    expect(html.indexOf('mr-rewatch')).toBeLessThan(html.indexOf('보상'));
    expect(html).toContain(`하이라이트 ${vm.highlights.length}장면`);
    const fake = { ...vm, decisions: Array.from({ length: 5 }, () => vm.decisions[0] ?? { minute: "16'", scene: '슈팅 찬스', choice: '안전', label: '백패스', p: '88%', result: 'success' as const, delta: '+0.02', flow: '' }) };
    expect(matchResultView(fake).match(/dec-row/g)?.length).toBe(3);
    expect(matchResultView(fake)).toContain('2개 더 보기');
    expect(matchResultView(fake, { dec: true }).match(/dec-row/g)?.length).toBe(5);
  });
});

describe('세이브 (디자인 119 · 149)', () => {
  it('자동 → 수동 3칸(빈 칸 [여기에 저장]) → 파일: 카드 이미지 포함 스위치', () => {
    const vm = savesVM([null, null, null, null], ['auto', '1', '2', '3']);
    const html = savesView(vm, true, versionVM(), true);
    expect(html.indexOf('자동 저장')).toBeLessThan(html.indexOf('수동 저장'));
    expect(html.match(/<span>여기에 저장<\/span>/g)?.length).toBe(3);
    expect(html).toContain('role="switch" aria-checked="true"');
    expect(html).toContain('.zip');
  });
});

describe('버전', () => {
  it('PATCH_LABEL · STAGE_LABEL 형식', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]*단계$/);
  });
});
