// C.73a (42단계 5-8 a): 커리어 챕터 — 나이 경계 · 시즌 목표 섞기 · 이벤트 분류 배율 · 챕터 끝 카드 선택권 · 챕터 리뷰 · 황혼 은퇴 흐름 · 세이브 40 이식
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { cardById } from '../src/config/cards';
import { chapterEventMul, chapterOf, chapterReviewed, chaptersFromHistory, pendingChapterReview } from '../src/chapters';
import { newGame, playRound, retire, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { EVENTS } from '../data/events';
import { deserialize, serialize } from '../src/save';
import { makeGoals } from '../src/seasonGoals';
import { chapterReviewVM, homeVM, playerVM, seasonVM } from '../src/ui/viewModels';
import { chapterView, seasonView } from '../src/ui/views/screens';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const prospect = (seed: string) => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
const playSeason = (g: GameState) => { while (g.phase === 'season') playRound(g, { engine: 'quick' }); };

describe('챕터 경계 (22.1, pending 119 ①)', () => {
  it('유망주 ≤20 · 도약 21~25 · 전성기 26~31 · 황혼 32~ (15·16세 시작은 유망주)', () => {
    expect([15, 17, 20, 21, 25, 26, 31, 32, 38].map(chapterOf)).toEqual(['prospect', 'prospect', 'prospect', 'rise', 'rise', 'prime', 'prime', 'twilight', 'twilight']);
  });

  it('홈·선수 화면 챕터 칩', () => {
    const g = prospect('c73-chip');
    expect(homeVM(g).chapter).toBe(`${{ prospect: '유망주', rise: '도약', prime: '전성기', twilight: '황혼' }[chapterOf(g.player.age)]} 챕터`);
    expect(playerVM(g).chapter).toBe(homeVM(g).chapter);
  });
});

describe('챕터 효과 (pending 119 ②): 목표 섞기 · 이벤트 배율, XP·성장은 그대로', () => {
  it('유망주는 어려움이 보통으로 바뀌는 시즌이 있고, 전성기는 쉬움이 보통으로 바뀌는 시즌이 있다 (나머지는 하나씩)', () => {
    let easier = 0;
    let harder = 0;
    for (let i = 0; i < 12; i++) {
      const g = prospect(`c73-mix-${i}`);
      g.player.age = 18;
      const y = makeGoals(g).map((x) => x.tier);
      if (!y.includes('hard')) easier++;
      expect(y).toContain('easy');
      g.player.age = 28;
      const p = makeGoals(g).map((x) => x.tier);
      if (!p.includes('easy')) harder++;
      expect(p).toContain('hard');
      g.player.age = 23;
      expect([...makeGoals(g).map((x) => x.tier)].sort()).toEqual(['easy', 'hard', 'normal']);
    }
    expect(easier).toBeGreaterThan(0);
    expect(easier).toBeLessThan(12);
    expect(harder).toBeGreaterThan(0);
    expect(harder).toBeLessThan(12);
  });

  it('황혼은 개인 목표가 완화된다 (셈 목표 × personalMul)', () => {
    const g = prospect('c73-twi');
    g.player.age = 31;
    const prime = makeGoals(g).find((x) => x.source === 'personal')!;
    g.player.age = 32;
    const twi = makeGoals(g).find((x) => x.source === 'personal')!;
    expect(twi.target).toBeLessThanOrEqual(prime.target);
  });

  it('이벤트 분류 배율은 0.5~1.5, 황혼 노화·은퇴·멘토 이벤트가 있다', () => {
    const g = prospect('c73-ev');
    g.player.age = 34;
    expect(chapterEventMul(g, ['day', 'aging'])).toBe(1.5);
    expect(chapterEventMul(g, ['slot', 'media', 'star'])).toBe(BALANCE.chapters.eventMul.twilight!.star);
    g.player.age = 18;
    expect(chapterEventMul(g, ['slot', 'media', 'star'])).toBe(0.6);
    expect(chapterEventMul(g, ['slot', 'aging', 'retire', 'mentor'])).toBe(0.5);
    for (const ch of Object.values(BALANCE.chapters.eventMul)) for (const m of Object.values(ch)) expect(m >= 0.5 && m <= 1.5).toBe(true);
    for (const id of ['d_agingBody', 'd_retireTalk', 'd_mentor']) expect(EVENTS.some((e) => e.id === id)).toBe(true);
  });
});

describe('챕터 기록 · 리뷰 · 카드 선택권 (pending 119 ②③)', () => {
  it('20세 시즌이 끝나면 유망주 챕터를 닫고 리뷰 1회 + 희귀 선택권, 리뷰를 보면 다음 시즌 버튼', () => {
    const g = prospect('c73-close');
    g.player.age = 20;
    playSeason(g);
    expect(g.phase).toBe('offseason');
    const rec = pendingChapterReview(g)!;
    expect(rec.id).toBe('prospect');
    expect(rec.done).toBe(true);
    expect(rec.seasons).toBe(1);
    expect(rec.apps).toBe(g.player.history.at(-1)!.apps);
    expect(rec.goals).toBe(g.player.history.at(-1)!.goals);
    expect(rec.highlights.length).toBeGreaterThan(0);
    expect(rec.highlights.length).toBeLessThanOrEqual(3);
    const pick = g.cards.picks.find((p) => p.source === 'chapter')!;
    expect(pick.options.every((id) => cardById(id)!.rarity === 'rare')).toBe(true);
    // 시즌 요약: [다음 시즌] 자리에 챕터 리뷰
    const vm = seasonVM(g)!;
    expect(vm.chapter).toBe('유망주');
    expect(seasonView(vm)).toContain('챕터 리뷰 · 유망주 챕터 끝');
    const cvm = chapterReviewVM(g)!;
    expect(cvm.next).toBe('도약');
    const html = chapterView(cvm);
    expect(html).toContain('다음 챕터 · 도약');
    expect(html).toContain('하이라이트');
    chapterReviewed(g);
    expect(chapterReviewVM(g)).toBeNull();
    expect(seasonView(seasonVM(g)!)).toContain('시즌 시작');
    // 다음 시즌은 도약 챕터에 새로 쌓는다 (리뷰는 다시 안 뜸)
    startNextSeason(g);
    playSeason(g);
    expect(g.chapters!.list.map((c) => c.id)).toEqual(['prospect', 'rise']);
    expect(g.chapters!.list[1]!.done).toBe(false);
    expect(pendingChapterReview(g)).toBeNull();
  });

  it('같은 챕터 안 두 시즌은 한 기록으로 합친다', () => {
    const g = prospect('c73-sum');
    g.player.age = 22;
    playSeason(g);
    startNextSeason(g);
    playSeason(g);
    const rec = g.chapters!.list.at(-1)!;
    expect(rec.id).toBe('rise');
    expect(rec.seasons).toBe(2);
    expect(rec.apps).toBe(g.player.history.slice(-2).reduce((t, r) => t + r.apps, 0));
    expect(rec.startSeason).toBe(g.player.history.at(-2)!.season);
  });

  it('황혼에서 은퇴하면 챕터 리뷰 → 커리어 요약 (30세부터 은퇴 선택)', () => {
    const g = prospect('c73-retire');
    g.player.age = 33;
    playSeason(g);
    expect(g.lastSeasonSummary!.canRetire).toBe(true);
    expect(pendingChapterReview(g)).toBeNull();
    retire(g);
    const cvm = chapterReviewVM(g)!;
    expect(cvm.id).toBe('twilight');
    expect(cvm.retired).toBe(true);
    expect(cvm.pick).toBeNull();
    expect(chapterView(cvm)).toContain('커리어 요약');
    chapterReviewed(g);
    expect(chapterReviewVM(g)).toBeNull();
  });

  it('29세 시즌 끝은 은퇴 선택이 없다', () => {
    const g = prospect('c73-noretire');
    g.player.age = 29;
    playSeason(g);
    expect(g.lastSeasonSummary!.canRetire).toBe(false);
  });
});

describe('세이브 40 (SAVE_FORMAT_VERSION)', () => {
  it('챕터 기록이 세이브 왕복에 남고, 옛 세이브(39)는 지난 시즌 기록으로 채운다', () => {
    expect(SAVE_FORMAT_VERSION).toBe(40);
    const g = prospect('c73-save');
    g.player.age = 20;
    playSeason(g);
    const back = deserialize(serialize(g));
    expect(back.chapters).toEqual(g.chapters);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 39;
    delete raw.chapters;
    const old = deserialize(JSON.stringify(raw));
    expect(old.chapters!.review).toBeNull();
    expect(old.chapters!.list.map((c) => c.id)).toEqual(['prospect']);
    expect(old.chapters!.list[0]!.apps).toBe(g.player.history[0]!.apps);
    expect(chaptersFromHistory(old).list[0]!.done).toBe(true);
  });
});

describe('버전', () => {
  it('버전 라벨', () => {
    expect(PATCH_LABEL).toMatch(/^C\.73/);
    expect(STAGE_LABEL).toBe('42단계');
  });
});
