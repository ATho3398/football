// C.66c: 경기 준비 덱 영역에 지금 고른 덱 세트의 카드 줄 — 덱 편집에 들어가지 않아도 카드가 보인다
import { describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, playOthers } from '../src/game';
import { prepVM } from '../src/ui/prepVM';
import { prepView } from '../src/ui/views/prep';

const cells = (html: string) => (html.match(/class="prep-deck__cell"/g) ?? []).length;

describe('경기 준비 덱 카드 줄 (C.66c)', () => {
  it('고른 덱의 카드 수 = 줄 칸 수, 덱 세트를 바꾸면 줄도 바뀐다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c66c-deck', difficulty: 'normal' });
    for (let i = 0; i < 40 && !isMatchDay(g); i++) { playOthers(g, 'quick'); endDay(g); }
    expect(isMatchDay(g)).toBe(true);
    // 덱 2를 덱 1과 다른 장수로 만든다 (덱 1에서 한 장 뺌)
    g.cards.decks[1] = g.cards.decks[0]!.slice(0, -1);
    g.cards.active = 0;
    const a = prepVM(g)!;
    const htmlA = prepView(a);
    expect(a.deck.cards.length).toBe(g.cards.decks[0]!.length);
    expect(cells(htmlA)).toBe(g.cards.decks[0]!.length);
    expect(htmlA).toContain('data-from="view"');
    g.cards.active = 1;
    const b = prepVM(g)!;
    expect(cells(prepView(b))).toBe(g.cards.decks[1]!.length);
    expect(b.deck.cards.map((c) => c.id)).toEqual(g.cards.decks[1]);
  });
});
