// C.81q: 다른 리그 챔스 진출 = 지난 시즌 실제 순위 상위 (첫 시즌 = 지금 명단) · 내 리그 자리 수 = 같은 리그 자리 수 · 다른 리그 득점자 추첨
import { describe, expect, it } from 'vitest';
import { newGame } from '../src/game';
import { uclEntrants, uclSlots } from '../src/cups';
import { finishOtherSeason, otherScorers } from '../src/otherLeagues';
import { leagueOfClub } from '../data/clubAlias';
import { leagueOfTeam } from '../src/league';
import { BALANCE } from '../src/config/balance';

const inLg = (id: string, lg: string) => leagueOfTeam(id) === lg || leagueOfClub(id) === lg;

describe('챔스 진출 구조 (C.81q)', () => {
  it('리그 자리 수 = 외부 명단 클럽 수 (PL 4 · 라리가 6 · 세리에 5 · 분데스 5 · 리그앙 3)', () => {
    expect([uclSlots('pl'), uclSlots('laliga'), uclSlots('seriea'), uclSlots('bundesliga'), uclSlots('ligue1')]).toEqual([4, 6, 5, 5, 3]);
  });

  it('첫 시즌: 다른 리그는 지금 명단 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c81q-u1', difficulty: 'normal', leagues: ['pl', 'laliga'] });
    const e = uclEntrants(g);
    expect(e.slice(0, 4)).toEqual([...BALANCE.cups.ucl.firstSeason]);
    expect(e).toContain('laliga:bar');
    expect(e.filter((id) => inLg(id, 'laliga'))).toHaveLength(6);
  });

  it('지난 시즌 기록이 있으면 다른 리그도 실제 순위 상위 자리 수만큼 (빅클럽이 빠질 수 있다)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c81q-u1', difficulty: 'normal', leagues: ['pl', 'laliga', 'seriea'] });
    const la = g.otherLeagues!.find((o) => o.id === 'laliga')!;
    // 레이팅 낮은 순 = 실제 순위로 가정
    const top = [...la.teams].sort((a, b) => a.rating - b.rating).map((t) => t.id);
    la.past = [{ season: g.league.season - 1, top }];
    const e = uclEntrants(g);
    expect(e).toHaveLength(32);
    expect(new Set(e).size).toBe(32);
    expect(e.filter((id) => inLg(id, 'laliga')).sort()).toEqual(top.slice(0, 6).sort());
    // 기록 없는 세리에는 지금 명단
    expect(e).toContain('seriea:juv');
    // 시즌이 안 맞는 옛 기록은 쓰지 않는다
    la.past = [{ season: g.league.season - 3, top }];
    expect(uclEntrants(g)).toContain('laliga:bar');
  });

  it('내 리그가 라리가면 지난 시즌 상위 6 · PL 은 다른 리그 PL 지난 시즌 상위 4', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c81q-u2', difficulty: 'normal', leagues: ['laliga', 'pl'] });
    const pl = g.otherLeagues!.find((o) => o.id === 'pl')!;
    const top = [...pl.teams].sort((a, b) => a.rating - b.rating).map((t) => t.id);
    pl.past = [{ season: g.league.season - 1, top }];
    const e = uclEntrants(g);
    expect(e.filter((id) => inLg(id, 'laliga'))).toHaveLength(6);
    expect(e.slice(6, 10)).toEqual(top.slice(0, 4));
  });
});

describe('다른 리그 득점자 추첨 (C.81q)', () => {
  it('시즌 골 = 리그 총 골, 득점 상위는 공격수 위주', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c81q-u3', difficulty: 'normal', leagues: ['pl', 'laliga'] });
    const la = g.otherLeagues![0]!;
    finishOtherSeason(g.worldSeed, la, g.npcs);
    const total = la.schedule.flat().reduce((t, f) => t + (f.homeGoals ?? 0) + (f.awayGoals ?? 0), 0);
    const goals = Object.values(la.stats ?? {}).reduce((t, x) => t + x[0], 0);
    expect(goals).toBe(total);
    expect(otherScorers(la, 1)[0]![3]).toBeGreaterThanOrEqual(12);
  });
});
