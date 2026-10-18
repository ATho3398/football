// C.65 (38단계 5-5): 시즌 목표와 카드 해금 — 목표 3개(감독·구단·개인, 쉬움/보통/어려움) · 진행 · 시즌 끝 판정(XP · 카드 3택 1 · 신뢰도) · 업적 선택권 · 세이브 35
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { cardById } from '../src/config/cards';
import { newGame, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { inboxList } from '../src/inbox';
import { ensureManager } from '../src/manager';
import { deserialize, serialize } from '../src/save';
import { ensureGoals, goalLabel, goalProgress, goalsSeasonEnd, hasLeagueStats, makeGoals, type SeasonGoal } from '../src/seasonGoals';
import { goalsCardVM } from '../src/ui/inboxVM';
import { goalsResultPanel, goalsSection } from '../src/ui/views/inbox';
import { seasonVM } from '../src/ui/viewModels';
import { seasonView } from '../src/ui/views/screens';

const prospect = (position: 'ST' | 'CB' | 'CM', seed: string) => newGame({ mode: 'prospect', position, seed, difficulty: 'normal' });
const rarities = (g: GameState, source: string) => g.cards.picks.filter((p) => p.source === source).map((p) => p.options.map((id) => cardById(id)!.rarity));

describe('시즌 목표 만들기 (18.9)', () => {
  it('3개 = 감독 · 구단 · 개인, 쉬움/보통/어려움 하나씩, 같은 시드면 같은 목표', () => {
    for (const seed of ['c65-a', 'c65-b', 'c65-c', 'c65-d']) {
      const g = prospect('ST', seed);
      const list = g.goals!.list;
      expect(list.map((x) => x.source)).toEqual(['manager', 'club', 'personal']);
      expect([...list.map((x) => x.tier)].sort()).toEqual(['easy', 'hard', 'normal']);
      expect(makeGoals(g)).toEqual(list);
      expect(list[1]!.kind).toBe('teamPos');
      expect(['goals', 'goalRank']).toContain(list[2]!.kind);
    }
  });

  it('포지션: 수비수 = 클린시트, 미드 = 도움/골+도움', () => {
    expect(prospect('CB', 'c65-cb').goals!.list[2]!.kind).toBe('cleanSheets');
    expect(['assists', 'ga', 'assistRank']).toContain(prospect('CM', 'c65-cm').goals!.list[2]!.kind);
  });

  it('팀 수준: 최강 팀이면 구단 목표 순위가 높고, 최약 팀이면 낮다 (강등권 위 상한)', () => {
    const g = prospect('ST', 'c65-team');
    const me = g.league.teams.find((t) => t.id === g.player.teamId)!;
    const club = () => makeGoals(g).find((x) => x.source === 'club')!;
    me.rating = 99;
    const top = club();
    me.rating = 1;
    const low = club();
    expect(top.target).toBeLessThan(low.target);
    expect(top.target).toBeLessThanOrEqual(1 + BALANCE.goals.posAdd.easy);
    expect(low.target).toBeLessThanOrEqual(g.league.teams.length - 3);
  });

  it('시즌 시작 인박스 · 진행: 셈 목표는 채우면 달성, 페이스면 순항, 모자라면 모자람', () => {
    const g = prospect('ST', 'c65-prog');
    expect(inboxList(g).some((x) => x.cat === 'goal' && x.title.includes('시즌 목표'))).toBe(true);
    const goal: SeasonGoal = { source: 'personal', tier: 'normal', kind: 'goals', target: 10 };
    g.league.round = 19;
    g.player.season.goals = 10;
    expect(goalProgress(g, goal).status).toBe('done');
    g.player.season.goals = 6;
    expect(goalProgress(g, goal).status).toBe('track');
    g.player.season.goals = 2;
    expect(goalProgress(g, goal).status).toBe('behind');
    expect(goalLabel({ kind: 'teamPos', target: 1 })).toBe('리그 우승');
    const vm = goalsCardVM(g)!;
    expect(vm.rows).toHaveLength(3);
    const html = goalsSection(vm);
    expect(html).toContain('시즌 목표');
    expect(html.match(/gl-row/g)).toHaveLength(3);
  });
});

describe('시즌 끝 판정과 보상', () => {
  it('달성: XP + 카드 3택 1(쉬움 일반 · 보통 희귀 · 어려움 희귀/에픽) + 신뢰도, 한 번만', () => {
    const g = prospect('ST', 'c65-end');
    const gs = ensureGoals(g)!;
    gs.list = [
      { source: 'manager', tier: 'easy', kind: 'apps', target: 1 },
      { source: 'club', tier: 'normal', kind: 'teamPos', target: 20 },
      { source: 'personal', tier: 'hard', kind: 'goals', target: 1 },
    ];
    g.player.season.apps = 5;
    g.player.season.goals = 3;
    const trust = ensureManager(g).trust;
    const xp = g.player.xp;
    const lv = g.player.level;
    const r = goalsSeasonEnd(g);
    expect(r.results.every((x) => x.met)).toBe(true);
    const X = BALANCE.goals.xp;
    expect(r.xp).toBe(X.easy + X.normal + X.hard);
    expect(g.player.level > lv || g.player.xp > xp).toBe(true);
    expect(ensureManager(g).trust).toBeCloseTo(trust + BALANCE.goals.trust.manager![0] + BALANCE.goals.trust.club![0] + BALANCE.goals.trust.personal![0], 5);
    const picks = rarities(g, 'goal');
    expect(picks).toHaveLength(3);
    expect(picks[0]!.every((x) => x === 'common')).toBe(true);
    expect(picks[1]!.every((x) => x === 'rare')).toBe(true);
    expect(picks[2]!.every((x) => x === 'rare' || x === 'epic')).toBe(true);
    expect(inboxList(g).some((x) => x.title.includes('3/3 달성'))).toBe(true);
    const n = g.cards.picks.length;
    goalsSeasonEnd(g);
    expect(g.cards.picks.length).toBe(n);
  });

  it('실패: 보상 없음 · 감독 목표 신뢰도 −, 평점 목표는 출전 자격이 있어야', () => {
    const g = prospect('ST', 'c65-fail');
    const gs = ensureGoals(g)!;
    gs.list = [
      { source: 'manager', tier: 'hard', kind: 'rating', target: 6 },
      { source: 'club', tier: 'normal', kind: 'teamPos', target: 1 },
      { source: 'personal', tier: 'easy', kind: 'goals', target: 30 },
    ];
    g.player.season.apps = 3;
    g.player.season.ratingSum = 24;
    ensureManager(g).trust = 50;
    g.league.table.sort((a, b) => (a.teamId === g.player.teamId ? 1 : b.teamId === g.player.teamId ? -1 : 0));
    const r = goalsSeasonEnd(g);
    expect(r.results.map((x) => x.met)).toEqual([false, false, false]);
    expect(g.cards.picks.filter((p) => p.source === 'goal')).toHaveLength(0);
    expect(ensureManager(g).trust).toBeLessThan(50);
  });

  it('업적: 리그 우승 = 에픽, 새 레전드 배지 = 전설(없으면 에픽), 시상은 리그 기록이 있을 때만', () => {
    const g = prospect('ST', 'c65-award');
    ensureGoals(g)!.list = [];
    g.player.season.goals = 30;
    const row = g.league.table.find((t) => t.teamId === g.player.teamId)!;
    row.points = 999;
    expect(hasLeagueStats(g)).toBe(false);
    const r = goalsSeasonEnd(g, [{ id: 'goals500', season: g.league.season }]);
    expect(r.awards).toHaveLength(2);
    const aw = rarities(g, 'award');
    expect(aw[0]!.every((x) => x === 'epic')).toBe(true);
    expect(aw[1]!.every((x) => x === 'legendary' || x === 'epic')).toBe(true);
    expect(aw[1]).toContain('legendary');
  });

  it('한 시즌을 끝까지: 요약에 목표 결과, 옛 시즌 희귀·에픽 경로는 없음 · 시즌 요약 화면', () => {
    const g = prospect('ST', 'c65-season');
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    const s = g.lastSeasonSummary!;
    expect(s.goals!.results).toHaveLength(3);
    expect(g.cards.picks.every((p) => p.source !== 'season')).toBe(true);
    expect(g.cards.picks.filter((p) => p.source === 'goal')).toHaveLength(s.goals!.results.filter((x) => x.met).length);
    expect(inboxList(g).some((x) => x.title.includes('중간 점검'))).toBe(true);
    const vm = seasonVM(g)!;
    expect(vm.seasonGoals!.rows).toHaveLength(3);
    expect(seasonView(vm)).toContain('시즌 목표');
    expect(goalsResultPanel(vm.seasonGoals!)).toContain('gl-result');
    expect(goalsCardVM(g)).toBeNull();
  });
});

describe('세이브 35 (C.65)', () => {
  it('왕복, 34 세이브(목표 없음) → 불러온 뒤 이번 시즌 목표를 만든다', () => {
    const g = prospect('ST', 'c65-save');
    playRound(g, { engine: 'quick' });
    expect(SAVE_FORMAT_VERSION).toBe(36);
    const back = deserialize(serialize(g));
    expect(back.goals).toEqual(g.goals);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 34;
    delete raw.goals;
    const old = deserialize(JSON.stringify(raw));
    expect(old.goals).toBeUndefined();
    expect(ensureGoals(old)!.list).toHaveLength(3);
  });
});

describe('버전 (C.65)', () => {
  it('부록 C 소절 · 단계 형식 (C.66부터는 그 패치 테스트에서 값)', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]?$/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
  });
});
