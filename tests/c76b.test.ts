// C.76b (46b단계): 유니폼 교환 · 진열실 — 확률 단조성 · 경기당 1번 · jersey 표시 · 진열 칸 수 · 세이브 48
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { MY_ID } from '../src/engine/adapter';
import { newGame, playRound, SAVE_FORMAT_VERSION, selectableRealPlayers, type GameState } from '../src/game';
import {
  chanceFrom, jerseyBlocked, jerseyPool, requestJersey, showcasePut, showcaseTake, showItems, showroomSlots, shownItems, storedItems,
} from '../src/jerseys';
import { photoViews } from '../src/photocards';
import { deserialize, restore, SaveFormatError, serialize } from '../src/save';
import { jerseyPanelVM, showroomVM } from '../src/ui/jerseyVM';
import { photoDexVM } from '../src/ui/photoVM';
import { matchResultView } from '../src/ui/views/matchResult';
import { photoDexView } from '../src/ui/views/photos';
import { showroomView } from '../src/ui/views/showroom';
import { matchResultVM } from '../src/ui/viewModels';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import type { PlayerStats } from '../src/engine/types';
import type { Tier } from '../src/types';

const game = (seed = 'c75w') => newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed, difficulty: 'normal' });
const stat = (id: string, team: 0 | 1, minutes: number) => ({ id, team, minutes } as PlayerStats);
const TIERS: Tier[] = ['normal', 'special', 'topClass', 'worldClass', 'legendary'];

/** 내가 뛴 엔진 경기를 찾을 때까지 진행 (실제 상대 선수가 있는 경기) */
function playUntilPool(g: GameState, max = 12): void {
  for (let i = 0; i < max; i++) {
    playRound(g);
    if (g.lastMatch?.jerseyPool?.length) return;
  }
  throw new Error('상대 실제 선수가 있는 경기를 못 찾음');
}

describe('확률', () => {
  const at = (o: Partial<Parameters<typeof chanceFrom>[0]> = {}) => chanceFrom({ tier: 'topClass', mental: 68, rating: 6.6, relations: [], ...o }).p;

  it('위상 티어가 오를수록 · 평점이 높을수록 · 상대 멘탈이 높을수록 오른다 (단조)', () => {
    for (let i = 1; i < TIERS.length; i++) expect(at({ tier: TIERS[i] })).toBeGreaterThan(at({ tier: TIERS[i - 1] }));
    for (let r = 4; r < 10; r += 0.5) expect(at({ rating: r + 0.5 })).toBeGreaterThanOrEqual(at({ rating: r }));
    expect(at({ rating: 8 })).toBeGreaterThan(at({ rating: 5.5 }));
    expect(at({ mental: 85 })).toBeGreaterThan(at({ mental: 50 }));
    expect(at({ mental: null })).toBe(at({ mental: BALANCE.jerseys.mental.center }));
  });

  it('관계: 더비·라이벌 −, 같은 국적·옛 팀 +, 더비 = −15%p', () => {
    expect(at({ relations: ['derby'] })).toBeCloseTo(at() - 0.15, 9);
    expect(at({ relations: ['derby', 'bigDerby'] })).toBeLessThan(at({ relations: ['derby'] }));
    expect(at({ relations: ['rival'] })).toBeLessThan(at());
    expect(at({ relations: ['sameNation'] })).toBeGreaterThan(at());
    expect(at({ relations: ['formerClub'] })).toBeGreaterThan(at());
  });

  it('범위: [min, max] 안 (무명 최악도 0이 아니고 레전더리 최고도 100%가 아님)', () => {
    const J = BALANCE.jerseys;
    expect(at({ tier: 'normal', rating: 3, mental: 30, relations: ['derby', 'bigDerby', 'rival'] })).toBe(J.min);
    expect(at({ tier: 'legendary', rating: 10, mental: 99, relations: ['sameNation', 'formerClub'] })).toBe(J.max);
  });
});

describe('요청 후보', () => {
  it('내가 뛴 경기의 상대 팀 실제 선수만 (우리 팀·가상·안 뛴 선수·결장·빠른 경기 제외)', () => {
    const p = [stat(MY_ID, 0, 90), stat('salah', 1, 90), stat('kane', 0, 90), stat('gen-123', 1, 90), stat('van-dijk', 1, 0)];
    expect(jerseyPool(p, 0, MY_ID)).toEqual(['salah']);
    expect(jerseyPool(p, 1, MY_ID)).toEqual(['kane']);
    expect(jerseyPool([stat(MY_ID, 0, 0), stat('salah', 1, 90)], 0, MY_ID)).toBeUndefined();
    expect(jerseyPool(undefined, 0, MY_ID)).toBeUndefined();
  });
});

describe('요청 (경기당 1번)', () => {
  it('playRound → 결과 화면 패널 → 요청 1번, 두 번째는 막힘, 결과 한 줄, 기록·세이브 왕복', () => {
    const g = game('c75w-a');
    playUntilPool(g);
    const m = g.lastMatch!;
    const pool = m.jerseyPool!;
    const vm = jerseyPanelVM(g)!;
    expect(vm.done).toBeNull();
    expect(vm.picks.map((p) => p.id).sort()).toEqual([...pool].sort());
    for (const p of vm.picks) expect(p.pct).toBeGreaterThan(0);
    const html = matchResultView(matchResultVM(g, null)!, {}, null, vm);
    expect(html).toContain('유니폼 교환');
    expect(html).toContain('data-act="jersey-ask"');
    const r = requestJersey(g, pool[0]!)!;
    expect(r).not.toBeNull();
    expect(r.line.length).toBeGreaterThan(0);
    expect(m.jersey).toEqual({ id: pool[0], ok: r.ok, line: r.line });
    // 두 번째: 같은 경기에서는 막힘 (다른 선수도)
    for (const id of pool) expect(requestJersey(g, id)).toBeNull();
    expect(jerseyBlocked(g, pool.at(-1)!)).toBe('이 경기에서 이미 요청했어요');
    expect(g.showcase!.swaps).toHaveLength(1);
    expect(g.showcase!.swaps[0]).toMatchObject({ id: pool[0], vs: m.opponentId, s: m.season, ok: r.ok });
    const done = jerseyPanelVM(g)!.done!;
    expect(done.ok).toBe(r.ok);
    expect(matchResultView(matchResultVM(g, null)!, {}, null, jerseyPanelVM(g))).toContain(r.ok ? '유니폼을 받았어요' : '거절했어요');
    const back = deserialize(serialize(g));
    expect(back.showcase).toEqual(g.showcase);
    expect(back.lastMatch?.jersey).toEqual(m.jersey);
  });

  it('결정적: 같은 세이브·같은 선수면 같은 결과', () => {
    // C.76s(엔진 32): c75w-d 는 12라운드 안에 실제 상대 선수가 있는 엔진 경기(유니폼 풀)가 없어져(14라운드부터) c76s-d 로 (1·2·9라운드)
    const a = game('c76s-d');
    playUntilPool(a);
    const b = deserialize(serialize(a));
    const id = a.lastMatch!.jerseyPool![0]!;
    expect(requestJersey(a, id)!.ok).toBe(requestJersey(b, id)!.ok);
  });

  it('성공하면 포토카드 jersey = true → 도감에 유니폼 표시, 진열실에 바로 진열 (칸이 있으면)', () => {
    // 성공할 때까지 여러 세계에서 시도 (확률 판정)
    for (let k = 0; k < 30; k++) {
      const g = game(`c75w-ok-${k}`);
      playUntilPool(g);
      const id = g.lastMatch!.jerseyPool![0]!;
      if (!requestJersey(g, id)!.ok) continue;
      const card = g.photos!.cards.find((c) => c.id === id)!;
      expect(card.jersey).toBe(true);
      expect(photoViews(g).find((v) => v.id === id)!.jersey).toBe(true);
      const dex = photoDexView(photoDexVM(g, 'got'));
      expect(dex).toContain('pc-jersey');
      expect(shownItems(g).map((x) => x.key)).toContain(`j:${id}`);
      expect(showroomView(showroomVM(g))).toContain('받음');
      // 이미 받은 선수는 다음 경기에서도 다시 받을 수 없음
      g.lastMatch!.jersey = undefined;
      expect(jerseyBlocked(g, id)).toBe('이미 받은 유니폼이에요');
      return;
    }
    throw new Error('30번 모두 거절');
  });

  it('카드가 없던 선수면 성공할 때 카드도 같이 얻음', () => {
    for (let k = 0; k < 30; k++) {
      const g = game(`c75w-new-${k}`);
      playUntilPool(g);
      const id = g.lastMatch!.jerseyPool![0]!;
      g.photos!.cards = g.photos!.cards.filter((c) => c.id !== id);
      if (!requestJersey(g, id)!.ok) continue;
      const card = g.photos!.cards.find((c) => c.id === id)!;
      expect(card).toBeDefined();
      expect(card.jersey).toBe(true);
      return;
    }
    throw new Error('30번 모두 거절');
  });

  it('빠른 경기(엔진 없음)는 요청 불가', () => {
    const g = game('c75w-q');
    playRound(g, { engine: 'quick' });
    expect(g.lastMatch!.jerseyPool).toBeUndefined();
    expect(jerseyPanelVM(g)).toBeNull();
    expect(jerseyBlocked(g, 'salah')).toBe('자동 경기에서는 요청할 수 없어요');
  });
});

describe('진열실', () => {
  it('칸 수 = 집 단계 표 (BALANCE.jerseys.showroomSlots), 단계가 클수록 많다', () => {
    const g = game();
    const t = BALANCE.jerseys.showroomSlots;
    expect(t).toHaveLength(BALANCE.wealth.houses.length);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThan(t[i - 1]!);
    for (let lvl = 0; lvl < t.length; lvl++) {
      g.money = { ...(g.money ?? ({} as NonNullable<GameState['money']>)), house: lvl };
      expect(showroomSlots(g)).toBe(t[lvl]);
    }
  });

  it('트로피 + 유니폼: 진열 · 빼기, 칸이 차면 진열 못 함(보관함), 집을 줄이면 넘친 것은 보관함', () => {
    const g = game();
    g.money = { ...(g.money ?? ({} as NonNullable<GameState['money']>)), house: 0 }; // 2칸
    g.chapters = { list: [{ trophies: ['2018 리그 우승', '2019 리그 우승', '2019 FA컵 우승'] } as never], review: null };
    g.showcase = { swaps: [{ d: g.calendar.date, s: 2018, vs: 'liverpool', id: 'salah', ok: true }, { d: g.calendar.date, s: 2018, vs: 'chelsea', id: 'hazard', ok: false }], shown: [] };
    const items = showItems(g);
    expect(items.map((x) => x.kind)).toEqual(['trophy', 'trophy', 'trophy', 'jersey']);
    expect(storedItems(g)).toHaveLength(4);
    expect(showcasePut(g, items[0]!.key)).toBe(true);
    expect(showcasePut(g, items[0]!.key)).toBe(false); // 이미 진열
    expect(showcasePut(g, 'j:salah')).toBe(true);
    expect(showcasePut(g, items[1]!.key)).toBe(false); // 2칸 다 참
    expect(showcasePut(g, 'j:hazard')).toBe(false); // 거절당한 유니폼은 없음
    expect(shownItems(g).map((x) => x.key)).toEqual([items[0]!.key, 'j:salah']);
    expect(storedItems(g)).toHaveLength(2);
    expect(showroomView(showroomVM(g))).toContain('진열 칸이 다 찼어요');
    expect(showcaseTake(g, 'j:salah')).toBe(true);
    expect(storedItems(g).map((x) => x.key)).toContain('j:salah');
    // 집을 넓혔다가 줄이면: 진열 순서대로 칸 수까지만
    g.money!.house = 2;
    for (const x of storedItems(g)) showcasePut(g, x.key);
    expect(shownItems(g)).toHaveLength(4);
    g.money!.house = 0;
    expect(shownItems(g)).toHaveLength(2);
    expect(storedItems(g)).toHaveLength(2);
    const html = showroomView(showroomVM(g));
    expect(html).toContain('진열실');
    expect(html).toContain('2019 리그 우승');
    expect(html).toContain('거절');
  });
});

describe('세이브 48', () => {
  it('옛 세이브(47)는 이어 할 수 없다 (C.77r), 같은 형식은 진열 그대로', () => {
    expect(SAVE_FORMAT_VERSION).toBe(59);
    const g = game();
    const raw = JSON.parse(serialize(g));
    expect(showroomVM(restore(JSON.parse(serialize(g)))).shown).toEqual(showroomVM(g).shown);
    raw.saveFormat = 47;
    delete raw.showcase;
    expect(() => restore(raw)).toThrow(SaveFormatError);
  });

  it('버전 표시', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/);
    expect(STAGE_LABEL).toMatch(/^\d+단계$/);
  });
});
