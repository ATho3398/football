// C.75m (45a) 다중 리그 뼈대: 리그 등록부 · 팀 수별 일정 · 리그별 달력 · 고른 리그 빠른 시뮬 · 세이브 마이그레이션
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEAGUES, leagueCatalog, leagueData, LEAGUE_CATALOG, PLAYABLE_LEAGUES } from '../data/leagues';
import { buildSchedule, createLeague, gamesPerTeam, initialTeams, teamById } from '../src/league';
import { addDays, daysBetween, leagueCalendar, seasonCalendar } from '../src/calendar';
import { endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, selectableRealPlayers } from '../src/game';
import { calendarKind, normalizeLeagues, otherLeagueCalendar, syncOtherLeagues, type OtherLeague } from '../src/otherLeagues';
import { isForeign } from '../src/life';
import { deserialize, migrate, serialize } from '../src/save';
import { createRng, hashSeed } from '../src/rng';
import { registerFakeLeagues } from '../scripts/diag/c75m-fake-leagues';

registerFakeLeagues();

/** 팀마다 경기 수 · 상대별 경기 수 */
function counts(schedule: { home: string; away: string }[][]) {
  const games = new Map<string, number>();
  const pairs = new Map<string, number>();
  for (const round of schedule) {
    const seen = new Set<string>();
    for (const f of round) {
      for (const t of [f.home, f.away]) {
        expect(seen.has(t)).toBe(false);
        seen.add(t);
        games.set(t, (games.get(t) ?? 0) + 1);
      }
      const k = [f.home, f.away].sort().join('|');
      pairs.set(k, (pairs.get(k) ?? 0) + 1);
    }
  }
  return { games, pairs };
}

describe('리그 등록부 (C.75m)', () => {
  it('PL 은 data/leagues/pl.ts 에서 그대로 (팀 id·레이팅·순서)', () => {
    const pl = leagueData('pl')!;
    expect(pl.teams.map((t) => t.id).slice(0, 3)).toEqual(['mci', 'liv', 'che']);
    expect(initialTeams().map((t) => t.id)).toEqual(pl.teams.map((t) => t.id));
    expect(pl.teams).toHaveLength(20);
    expect(pl.country).toBe('England');
  });

  it('카탈로그: 기본 묶음 = PL + 5대 리그 + 챔피언십, 내 리그로 시작 = PL', () => {
    expect(DEFAULT_LEAGUES).toEqual(['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship']);
    for (const id of DEFAULT_LEAGUES) expect(LEAGUE_CATALOG.some((e) => e.id === id)).toBe(true);
    expect(PLAYABLE_LEAGUES).toEqual(['pl']);
    expect(new Set(leagueCatalog().map((e) => e.id)).size).toBe(leagueCatalog().length);
  });

  it('등록된 리그끼리 팀 id 가 겹치지 않는다', () => {
    const ids = leagueCatalog().flatMap((e) => leagueData(e.id)?.teams.map((t) => t.id) ?? []);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('고른 리그 정리: 내 리그 맨 앞, 데이터 없는 리그(준비 중)는 빠진다', () => {
    expect(normalizeLeagues(undefined)).toEqual(['pl']);
    expect(normalizeLeagues(['laliga', 'pl', 'nope', 'laliga'])).toEqual(['pl', 'laliga']);
  });
});

describe('팀 수별 일정 (C.75m)', () => {
  const rng = () => createRng(hashSeed('c75m-sched'));
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
  it.each([[20, 38], [18, 34], [24, 46], [16, 30]])('%i팀 더블 라운드로빈 = %i라운드, 상대마다 2경기', (n, rounds) => {
    const s = buildSchedule(ids(n), rng());
    expect(s).toHaveLength(rounds);
    const { games, pairs } = counts(s);
    expect([...games.values()].every((g) => g === rounds)).toBe(true);
    expect([...pairs.values()].every((p) => p === 2)).toBe(true);
  });

  it('12팀 K리그 = 3번 라운드로빈 33라운드 (상대마다 3경기, 홈 15~18)', () => {
    const lg = createLeague('c75m', 2018, 'kleague1');
    expect(lg.schedule).toHaveLength(33);
    expect(gamesPerTeam(lg)).toBe(33);
    const { games, pairs } = counts(lg.schedule);
    expect([...games.values()].every((g) => g === 33)).toBe(true);
    expect([...pairs.values()].every((p) => p === 3)).toBe(true);
    for (const t of lg.teams) {
      const home = lg.schedule.flat().filter((f) => f.home === t.id).length;
      expect(home).toBeGreaterThanOrEqual(15);
      expect(home).toBeLessThanOrEqual(18);
    }
  });

  it('홀수 팀(23)은 쉬는 팀이 생기고 팀마다 44경기', () => {
    const lg = createLeague('c75m', 2018, 'mls');
    expect(lg.schedule).toHaveLength(46);
    const { games } = counts(lg.schedule);
    expect([...games.values()].every((g) => g === 44)).toBe(true);
    expect(gamesPerTeam(lg)).toBe(44);
  });

  it('PL 일정·달력은 C.75m 전과 같은 시드 문자열', () => {
    const lg = createLeague('same', 2019);
    expect(lg.id).toBe('pl');
    expect(lg.schedule).toEqual(buildSchedule(initialTeams().map((t) => t.id), createRng(hashSeed('same:schedule:2019'))));
    expect(leagueCalendar('same', lg, 'autumn-spring')).toBe(seasonCalendar('same', 2019, lg.schedule));
    expect(gamesPerTeam(lg)).toBe(38);
  });
});

describe('리그별 달력 (C.75m)', () => {
  const cases: [string, number, number][] = [['laliga', 8, 5], ['bundesliga', 8, 5], ['championship', 8, 5], ['kleague1', 3, 12], ['jleague1', 3, 12], ['mls', 3, 12]];
  it.each(cases)('%s: 개막 %i월 ~ 최종 %i월, 라운드 날짜 오름차순, 팀마다 2일 이상 쉰다', (id, m0, m1) => {
    for (const season of [2018, 2021]) {
      const lg = createLeague('c75m-cal', season, id);
      const cal = otherLeagueCalendar('c75m-cal', lg);
      expect(cal.fixtureDates).toHaveLength(lg.schedule.length);
      expect(+cal.opening.slice(5, 7)).toBe(m0);
      expect(+cal.final.slice(5, 7)).toBe(m1);
      const spring = calendarKind(id) === 'spring-autumn';
      expect(+cal.final.slice(0, 4)).toBe(spring ? season : season + 1);
      for (let r = 1; r < cal.roundDates.length; r++) expect(daysBetween(cal.roundDates[r - 1]!, cal.roundDates[r]!)).toBeGreaterThan(0);
      const last = new Map<string, string>();
      lg.schedule.forEach((round, r) => round.forEach((f, i) => {
        const d = cal.fixtureDates[r]![i]!;
        for (const t of [f.home, f.away]) {
          const prev = last.get(t);
          if (prev) expect(daysBetween(prev, d)).toBeGreaterThanOrEqual(2);
          last.set(t, d);
        }
      }));
    }
  });
});

describe('고른 리그 빠른 시뮬 (C.75m)', () => {
  const leagues = ['pl', 'laliga', 'kleague1'];
  const game = (seed: string) => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal', leagues });

  it('새 게임: 고른 리그 보관, 춘추제가 아닌 리그는 소집일 전까지 2018 시즌 전반기를 치렀다', () => {
    const g = game('c75m-a');
    expect(g.leagueIds).toEqual(leagues);
    expect(g.otherLeagues!.map((l) => l.id)).toEqual(['laliga', 'kleague1']);
    const [la, k] = g.otherLeagues!;
    expect(la!.round).toBe(0);
    expect(k!.season).toBe(2018);
    expect(k!.round).toBeGreaterThan(10);
    expect(k!.round).toBeLessThan(33);
    expect(k!.country).toBe('Korea Republic');
  });

  it('PL 만 고른 게임은 다른 리그가 없다 (지금과 같은 상태)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75m-pl', difficulty: 'normal' });
    expect(g.otherLeagues).toBeUndefined();
    expect(g.leagueIds).toEqual(['pl']);
  });

  it('하루 진행마다 그날 경기를 치르고, 순위표 경기 수 = 치른 경기', () => {
    const g = game('c75m-b');
    for (let k = 0; k < 40; k++) {
      if (isMatchDay(g)) playRound(g, { others: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
    }
    for (const lg of g.otherLeagues!) {
      const cal = otherLeagueCalendar(g.worldSeed, lg);
      lg.schedule.forEach((round, r) => round.forEach((f, i) => {
        expect(f.homeGoals !== undefined).toBe(daysBetween(cal.fixtureDates[r]![i]!, g.calendar.date) > 0);
      }));
      const played = lg.table.reduce((t, row) => t + row.played, 0);
      expect(played).toBe(lg.schedule.flat().filter((f) => f.homeGoals !== undefined).length * 2);
    }
  });

  it('끝난 리그는 지난 시즌 최종 순위를 남기고 다음 시즌으로 (날짜만 같으면 같은 결과)', () => {
    const st = { worldSeed: 'c75m-c', otherLeagues: [createLeague('c75m-c', 2018, 'kleague1')] as OtherLeague[] };
    syncOtherLeagues(st, '2019-02-20');
    const k = st.otherLeagues[0]!;
    expect(k.season).toBe(2019);
    expect(k.round).toBe(0);
    expect(k.past).toHaveLength(1);
    expect(k.past![0]!.top).toHaveLength(12);
    const again = { worldSeed: 'c75m-c', otherLeagues: [createLeague('c75m-c', 2018, 'kleague1')] as OtherLeague[] };
    syncOtherLeagues(again, '2018-07-01');
    syncOtherLeagues(again, '2019-02-20');
    expect(again.otherLeagues).toEqual(st.otherLeagues);
    // 다음 해 개막 뒤
    syncOtherLeagues(st, '2019-05-01');
    expect(st.otherLeagues[0]!.round).toBeGreaterThan(3);
  });

  it('안 고른 리그 팀은 리그 밖 클럽처럼 레이팅만 (teamById)', () => {
    const g = game('c75m-d');
    const t = teamById(g.league, 'seriea-0');
    expect(t.rating).toBeGreaterThan(0);
  });

  it('외국인 판정 = 내 리그 국가', () => {
    const g = game('c75m-e');
    g.player.nationality = 'England';
    expect(isForeign(g)).toBe(false);
    g.league = { ...g.league, country: 'Spain' };
    expect(isForeign(g)).toBe(true);
  });

  it('실제 선수 목록 = 고른 리그 중 내 리그로 시작할 수 있는 리그 선수', () => {
    expect(selectableRealPlayers(['pl', 'laliga']).length).toBe(selectableRealPlayers().length);
    expect(selectableRealPlayers(['laliga'])).toEqual([]);
  });
});

describe('세이브 (C.75m)', () => {
  it('다른 리그 상태가 저장·불러오기에 남는다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75m-s', difficulty: 'normal', leagues: ['pl', 'kleague1'] });
    const back = deserialize(serialize(g));
    expect(back.otherLeagues).toEqual(g.otherLeagues);
    expect(back.leagueIds).toEqual(['pl', 'kleague1']);
  });

  it('옛 세이브(45) = PL 하나로 마이그레이션', () => {
    expect(SAVE_FORMAT_VERSION).toBe(46);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c75m-m', difficulty: 'normal' });
    const old = JSON.parse(serialize(g));
    old.saveFormat = 45;
    delete old.leagueIds;
    delete old.league.id;
    delete old.league.country;
    delete old.league.tier;
    const m = migrate(old);
    expect(m.saveFormat).toBe(46);
    expect(m.leagueIds).toEqual(['pl']);
    expect(m.league.id).toBe('pl');
    expect(m.league.country).toBe('England');
    expect(m.otherLeagues).toBeUndefined();
    // 하루 진행 (다른 리그 없음)
    endDay(m);
    expect(addDays(g.calendar.date, 1)).toBe(m.calendar.date);
  });
});
