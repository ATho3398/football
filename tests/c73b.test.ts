// C.73b (42단계 5-8 b): 시즌 자동 진행 설정 · 시즌 하이라이트 3 · 은퇴 후(명예의 전당 · 새 게임 보너스)
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, retire, startNextSeason, type GameState } from '../src/game';
import type { MatchLogEntry } from '../src/matchRecord';
import { seasonHighlights3 } from '../src/seasonHighlights';
import { addToHall, claimNewGameBonus, hallEntry, loadLegacy, recordRetirement, type HallEntry } from '../src/legacy';
import { AUTO_PREFS_DEFAULT, loadAutoPrefs, saveAutoPrefs } from '../src/ui/autoPrefs';
import { autoSheetVM, chapterReviewVM, retiredVM, seasonVM } from '../src/ui/viewModels';
import { autoSheet } from '../src/ui/views/progress';
import { retiredView, seasonView } from '../src/ui/views/screens';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';

const prospect = (seed: string) => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
const playSeason = (g: GameState) => { while (g.phase === 'season') playRound(g, { engine: 'quick' }); };

class MemStore {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
}

const e = (o: Partial<MatchLogEntry>): MatchLogEntry => ({
  round: 1, opponentId: 'a', home: true, goalsFor: 0, goalsAgainst: 0, minutes: 90, started: true, goals: 0, assists: 0, rating: 6.5, mom: false, position: 'ST', rec: null, ...o,
});

describe('시즌 하이라이트 3 (22.2 끝)', () => {
  const name = (id: string) => id.toUpperCase();
  it('최고 평점 경기 · 골(승부를 가른 골, 최고 경기와 다른 경기 먼저) · 위기(부상 결장 연속)', () => {
    const log = [
      e({ round: 1, opponentId: 'a', goalsFor: 3, goalsAgainst: 0, goals: 1, rating: 8.9, mom: true }),
      e({ round: 2, opponentId: 'b', goalsFor: 2, goalsAgainst: 1, goals: 2, rating: 8.0 }),
      e({ round: 3, minutes: 0, rating: null, started: false, absent: 'injured', goalsFor: 1, goalsAgainst: 1 }),
      e({ round: 4, minutes: 0, rating: null, started: false, absent: 'injured', goalsFor: 0, goalsAgainst: 2 }),
      e({ round: 5, opponentId: 'c', rating: 6.2 }),
    ];
    const h = seasonHighlights3(log, name);
    expect(h.map((x) => x.kind)).toEqual(['best', 'goal', 'crisis']);
    expect(h[0]!.text).toContain('A전 평점 8.9');
    expect(h[0]!.text).toContain('MOM');
    expect(h[1]!.text).toBe('B전 2골 · 2-1 승 · 승부를 가른 골');
    expect(h[2]!.text).toBe('부상으로 2경기 결장 (3~4R)');
  });

  it('골이 없으면 도움 경기, 위기는 연패 · 최악 평점 중 큰 것, 해당 없으면 빠짐', () => {
    const log = [1, 2, 3, 4].map((r) => e({ round: r, opponentId: 'x', goalsFor: 0, goalsAgainst: 1, assists: r === 2 ? 1 : 0, rating: r === 3 ? 5.1 : 6.4 }));
    const h = seasonHighlights3(log, name);
    expect(h[1]!.text).toContain('X전 1도움');
    expect(h[2]!.kind).toBe('crisis');
    expect(seasonHighlights3([e({ rating: 7 })], name).map((x) => x.kind)).toEqual(['best']);
    expect(seasonHighlights3([], name)).toEqual([]);
  });

  it('시즌 요약 화면 · 챕터 리뷰 후보', () => {
    const g = prospect('c73b-hl');
    g.player.age = 24;
    playSeason(g);
    startNextSeason(g);
    playSeason(g);
    const vm = seasonVM(g)!;
    expect(vm.highlights.length).toBeGreaterThan(0);
    expect(vm.highlights[0]!.label).toBe('최고 평점 경기');
    expect(seasonView(vm)).toContain('시즌 하이라이트');
    const c = chapterReviewVM(g)!;
    expect(c.highlights.length).toBeGreaterThan(0);
    expect(c.highlights.length).toBeLessThanOrEqual(BALANCE.chapters.highlights);
  });
});

describe('시즌 자동 진행 설정 (22.2)', () => {
  it('기본값 · 저장/불러오기 · 깨진 값은 기본값', () => {
    const s = new MemStore();
    expect(loadAutoPrefs(s)).toEqual(AUTO_PREFS_DEFAULT);
    saveAutoPrefs({ alloc: false, event: true, injury: false }, s);
    expect(loadAutoPrefs(s)).toEqual({ alloc: false, event: true, injury: false });
    s.setItem('po-auto-prefs', '{oops');
    expect(loadAutoPrefs(s)).toEqual(AUTO_PREFS_DEFAULT);
    expect(loadAutoPrefs(null)).toEqual(AUTO_PREFS_DEFAULT);
  });

  it('시트: 설정 스위치 3개 + [시즌 요약으로 바로 이동]', () => {
    const g = prospect('c73b-sheet');
    const h = autoSheet(autoSheetVM(g), 5, { alloc: true, event: true, injury: false });
    expect(h).toContain('data-act="auto-end"');
    expect(h).toContain('시즌 요약으로 바로 이동');
    expect((h.match(/data-act="auto-pref"/g) ?? []).length).toBe(3);
    expect(h).toContain('포인트는 추천 배분으로 바로 찍고');
  });
});

describe('은퇴 후 (18.11): 명예의 전당 · 새 게임 보너스', () => {
  const retiredGame = (seed: string) => {
    const g = prospect(seed);
    g.player.age = 33;
    playSeason(g);
    retire(g);
    return g;
  };

  it('은퇴 기록 → 명예의 전당 1위 · 보너스 예약(배지 없으면 일반, 있으면 희귀) · 한 번만', () => {
    const s = new MemStore();
    const g = retiredGame('c73b-ret');
    const r = recordRetirement(g, s);
    expect(r.rank).toBe(1);
    expect(r.legacy.bonus?.rarity).toBe(g.player.badges.length ? 'rare' : 'common');
    // 다시 들어와도 보너스는 한 번만 (받은 뒤 다시 기록해도 새로 생기지 않음)
    const ng = prospect('c73b-new');
    const picks0 = ng.cards!.picks.length;
    expect(claimNewGameBonus(ng, s)).not.toBeNull();
    expect(ng.cards!.picks.length).toBe(picks0 + 1);
    expect(ng.cards!.picks.at(-1)!.source).toBe('legacy');
    expect(loadLegacy(s).bonus).toBeNull();
    recordRetirement(g, s);
    expect(loadLegacy(s).bonus).toBeNull();
    expect(loadLegacy(s).hall.length).toBe(1);
    expect(claimNewGameBonus(prospect('c73b-new2'), s)).toBeNull();
  });

  it('레전드 배지 커리어면 희귀 카드 선택권', () => {
    const s = new MemStore();
    const g = retiredGame('c73b-legend');
    g.player.badges.push({ id: 'goals500', season: g.league.season } as never);
    const r = recordRetirement(g, s);
    expect(r.legacy.bonus).toMatchObject({ rarity: 'rare', legend: true });
  });

  it('상위 3개만 점수순으로, 같은 커리어는 바꿔 넣기', () => {
    const mk = (key: string, score: number): HallEntry => ({ key, score, name: key, position: 'ST', age: 35, lastSeason: 2030, seasons: 10, apps: 0, goals: 0, assists: 0, peakOvr: 80, reputation: 0, tier: 'normal' as never, asset: 0, badges: 0, trophies: 0 });
    let h: HallEntry[] = [];
    for (const [k, v] of [['a', 10], ['b', 30], ['c', 20], ['d', 5]] as const) h = addToHall(h, mk(k, v));
    expect(h.map((x) => x.key)).toEqual(['b', 'c', 'a']);
    h = addToHall(h, mk('a', 40));
    expect(h.map((x) => x.key)).toEqual(['a', 'b', 'c']);
  });

  it('커리어 요약 화면: 업적·배지 · 명예의 전당 · 보너스', () => {
    const s = new MemStore();
    const g = retiredGame('c73b-view');
    const vm = retiredVM(g, recordRetirement(g, s));
    expect(vm.hall!.rank).toBe(1);
    expect(vm.hall!.list[0]!.me).toBe(true);
    expect(vm.hall!.list[0]!.score).toBe(hallEntry(g).score);
    const html = retiredView(vm);
    expect(html).toContain('명예의 전당');
    expect(html).toContain('새 게임 보너스');
    expect(retiredView(retiredVM(g))).not.toContain('명예의 전당');
  });
});

describe('버전', () => {
  it('버전 라벨', () => {
    expect(PATCH_LABEL).toMatch(/^C\.7[3-9]/);
    expect(STAGE_LABEL).toMatch(/^4[2-9]단계/);
  });
});
