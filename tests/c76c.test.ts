// C.76c (45b) 타리그 연결·통합: 리그 데이터 연결 · 다른 리그에서 시작 · 리그별 순위·득점 · 이적 시장 = 고른 리그 · 중복 정리 · 도감
import { describe, expect, it } from 'vitest';
import { allLeagueData, leagueData, PLAYABLE_LEAGUES } from '../data/leagues';
import { ALL_REAL_PLAYERS, LEAGUE_PLAYERS, realPlayersFor, REAL_PLAYER_BY_ID } from '../data/players';
import { LEAGUE_TO_OUTSIDE, OUTSIDE_TO_LEAGUE, canonicalClub, leagueOfClub } from '../data/clubAlias';
import { CLUB_BY_ID, OUTSIDE_CLUBS } from '../data/outsideClubs';
import { TEAM_COLORS } from '../data/teamColors';
import { CLUB_KITS } from '../data/kits';
import { managerOf } from '../data/managers';
import { DEX_IDS, DEX_LOCKS } from '../data/players/photoDex';
import { CLUB_TO_TEAM, leagueOfTeam, leagueTeamById, recordResult, simulateScore, teamById } from '../src/league';
import { derbyOf } from '../src/derby';
import {
  acceptMyOffer, calendarOf, endDay, nextFixture, endSeason, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, selectableRealPlayers, startLeagueOf,
  startNextSeason, type GameState,
} from '../src/game';
import { compNameKo, cupNameKo, domesticCupTeams, uclEntrants } from '../src/cups';
import { otherScorers, syncOtherLeagues } from '../src/otherLeagues';
import { movableLeagues, midWindowKo, windowKo, winterOpen } from '../src/transfer';
import { squadRule } from '../src/squad';
import { deserialize, migrate, serialize } from '../src/save';
import { addDays } from '../src/calendar';
import { createRng, hashSeed } from '../src/rng';
import { dexCandidates, dexHash } from '../src/photocards';
import { futureDebut, futureEntry, FUTURE_STARS, upcomingFutureStars } from '../src/legends';
import { leaguePickerVM, newGameVM, otherLeagueVM, seasonLabel, worldVM } from '../src/ui/viewModels';
import { worldView } from '../src/ui/views/screens';
import { leagueMoves } from '../src/leagueMove';
import { BALANCE } from '../src/config/balance';

const ALL = allLeagueData().map((d) => d.id);

/** 남은 리그 경기를 빠른 계산으로 채우고 시즌을 끝낸다 (시험용 지름길) */
function finishSeason(g: GameState): void {
  const lg = g.league;
  lg.schedule.forEach((round, r) => round.forEach((f, i) => {
    if (f.homeGoals !== undefined) return;
    const [hg, ag] = simulateScore(createRng(hashSeed(`t:${r}:${i}`)), teamById(lg, f.home).rating, teamById(lg, f.away).rating);
    recordResult(lg, f, hg, ag);
  }));
  lg.round = lg.schedule.length;
  endSeason(g);
}

/** 로스터 비교 (등번호는 내 번호 자리 비우기라 불러올 때만 바뀐다 — 표시용) */
const noShirts = (g: GameState) => JSON.stringify(g.rosters, (k, v) => (k === 'shirt' ? undefined : v));

describe('데이터 연결 (C.76c 1번)', () => {
  it('14개 리그 모두 내 리그로 시작 가능, 실제 선수 클럽 = 리그 팀', () => {
    expect([...PLAYABLE_LEAGUES].sort()).toEqual([...ALL].sort());
    expect(ALL).toHaveLength(14);
    for (const p of ALL_REAL_PLAYERS) expect(CLUB_TO_TEAM[p.club], `${p.id} ${p.club}`).toBeDefined();
    const n = Object.values(LEAGUE_PLAYERS).reduce((t, x) => t + x.length, 0);
    expect(n).toBe(506);
    expect(new Set(ALL_REAL_PLAYERS.map((p) => p.id)).size).toBe(ALL_REAL_PLAYERS.length);
    // 리그 데이터 선수는 그 리그를 고른 게임에서만 NPC
    expect(realPlayersFor(['pl']).length).toBe(ALL_REAL_PLAYERS.length - n);
    expect(realPlayersFor(['pl', 'kleague1']).some((p) => p.id === REAL_PLAYER_BY_ID.get(LEAGUE_PLAYERS.kleague1![0]!.id)!.id)).toBe(true);
  });

  it('팀 부가 데이터: 색·유니폼·감독이 리그 데이터 팀에도 (같은 클럽 x: id 와 공유)', () => {
    for (const d of allLeagueData()) for (const t of d.teams) {
      if (t.colors || LEAGUE_TO_OUTSIDE[t.id]) expect(TEAM_COLORS[t.id], t.id).toBeDefined();
      if (t.manager) expect(managerOf(t.id)?.name, t.id).toBe(managerOf(t.id)?.name ?? t.manager);
    }
    expect(TEAM_COLORS['laliga:bar']).toEqual(TEAM_COLORS['x:bar']);
    expect(CLUB_KITS['laliga:bar']).toEqual(CLUB_KITS['x:bar']);
    expect(managerOf('laliga:bar')?.name).toBe(leagueData('laliga')!.teams.find((t) => t.id === 'laliga:bar')!.manager);
    expect(managerOf('x:bar')).toEqual(managerOf('laliga:bar'));
    expect(managerOf('kleague1:jbh')?.style).toBe('neutral');
  });

  it('더비: 리그 데이터 더비 + 같은 클럽 두 id 는 같은 더비, 같은 리그 팀끼리는 표만', () => {
    expect(derbyOf('laliga:bar', 'laliga:rma')?.name).toBe('엘 클라시코');
    expect(derbyOf('x:bar', 'laliga:rma')?.name).toBe('엘 클라시코');
    expect(derbyOf('kleague1:fcs', 'kleague1:ssb')).not.toBeNull();
    // PL 규칙 그대로: 리그 구단끼리 표에 없으면 없음, 다른 리그 같은 지역이면 자동
    expect(derbyOf('cry', 'ful')).toBeNull();
    expect(derbyOf('bur', 'x:wig')?.auto).toBe(true);
  });
});

describe('중복 정리 (C.76c 5번)', () => {
  it('리그 밖 표 35클럽(이적 31 + 컵 전용 4) = 리그 데이터 팀 (이름·레이팅 같음), Bayern Munich 로 맞춤', () => {
    const pairs = Object.entries(OUTSIDE_TO_LEAGUE).filter(([x]) => CLUB_BY_ID[x]);
    expect(pairs.length).toBe(35);
    expect(pairs.filter(([x]) => OUTSIDE_CLUBS.some((c) => c.id === x))).toHaveLength(31);
    for (const [x, l] of pairs) {
      expect(CLUB_BY_ID[x]!.name).toBe(leagueTeamById(l)!.name);
      expect(CLUB_BY_ID[x]!.rating, x).toBe(leagueTeamById(l)!.rating);
    }
    expect(OUTSIDE_TO_LEAGUE['x:bay']).toBe('bundesliga:bay');
    expect(LEAGUE_TO_OUTSIDE['bundesliga:bay']).toBe('x:bay');
    // 미래 스타 데이터의 x: id (리그 밖 표에 없는 클럽)
    expect(OUTSIDE_TO_LEAGUE['x:ren']).toBe('ligue1:ren');
    expect(leagueOfClub('x:bar')).toBe('laliga');
    expect(leagueOfClub('mci')).toBe('pl');
    expect(leagueOfClub('x:zen')).toBeUndefined();
  });

  it('고른 리그 기준 id: 그 리그를 고르면 리그 팀 id, 아니면 x: 그대로', () => {
    expect(canonicalClub('x:bar', ['pl'])).toBe('x:bar');
    expect(canonicalClub('x:bar', ['pl', 'laliga'])).toBe('laliga:bar');
    expect(canonicalClub('x:zen', ['pl', 'laliga'])).toBe('x:zen');
  });

  it('챔스 출전: PL 만 = 옛 32팀 그대로, 라리가를 고르면 라리가 클럽은 리그 id, 내 리그가 라리가면 상위 4 + PL 상위 4 + 외부', () => {
    const pl = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-u1', difficulty: 'normal' });
    expect(uclEntrants(pl)).toContain('x:bar');
    const both = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-u1', difficulty: 'normal', leagues: ['pl', 'laliga'] });
    expect(uclEntrants(both)).toContain('laliga:bar');
    expect(uclEntrants(both)).not.toContain('x:bar');
    const la = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-u2', difficulty: 'normal', leagues: ['laliga', 'pl'] });
    const e = uclEntrants(la);
    expect(e).toHaveLength(32);
    expect(new Set(e).size).toBe(32);
    expect(e.filter((id) => leagueOfTeam(id) === 'laliga' || leagueOfClub(id) === 'laliga')).toHaveLength(4);
    expect(e.slice(4, 8)).toEqual(BALANCE.cups.ucl.firstSeason);
    expect(la.cups?.ucl?.groups.flat()).toHaveLength(32);
  });
});

describe('다른 리그에서 시작 (C.76c 2번)', () => {
  it('실제 선수 = 그 선수 리그가 내 리그 (메시 → 라리가 바르셀로나), 로스터·컵 이름·규칙이 그 리그', () => {
    const opts = { mode: 'real' as const, playerId: 'messi', seed: 'c76c-r', difficulty: 'normal' as const, leagues: ['pl', 'laliga'] };
    expect(startLeagueOf(opts)).toBe('laliga');
    const g = newGame(opts);
    expect(g.league.id).toBe('laliga');
    expect(g.leagueIds).toEqual(['laliga', 'pl']);
    expect(g.player.teamId).toBe('laliga:bar');
    expect(Object.keys(g.rosters).sort()).toEqual(leagueData('laliga')!.teams.map((t) => t.id).sort());
    expect(g.rosters['laliga:bar']!.players.filter((p) => p.real).map((p) => p.id)).toContain('suarez');
    expect(g.otherLeagues!.map((o) => o.id)).toEqual(['pl']);
    expect(cupNameKo(g.league.id)).toBe('코파 델 레이');
    expect(compNameKo('fa', 'laliga')).toBe('코파 델 레이');
    expect(compNameKo('fa', 'pl')).toBe('FA컵');
    expect(g.cups?.fa?.rounds[0]).toHaveLength(8);
    expect(squadRule()).toEqual(BALANCE.squad.leagues.laliga);
    expect(calendarOf(g).opening.startsWith('2018-08')).toBe(true);
  });

  it('K리그1 도 PL 과 같은 8~5월 (C.76m): 7월 소집, 8팀 컵(1~4월 + 결승), 챔스 없음, 시즌 중 이적시장 1월 겨울', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-k', difficulty: 'normal', leagues: ['kleague1', 'pl'] });
    expect(g.league.id).toBe('kleague1');
    expect(g.calendar.date.startsWith('2018-07') || g.calendar.date.startsWith('2018-08')).toBe(true);
    expect(calendarOf(g).opening.startsWith('2018-08')).toBe(true);
    expect(calendarOf(g).final.startsWith('2019-05')).toBe(true);
    expect(g.cups?.fa?.rounds[0]).toHaveLength(4);
    expect(g.cups?.ucl).toBeNull();
    expect(uclEntrants(g)).toEqual([]);
    expect(squadRule()).toEqual(BALANCE.squad.defaultRule);
    expect(midWindowKo(g.league)).toBe('1월 1일 겨울');
    expect(windowKo(g.league, 'summer')).toBe('여름');
    expect(seasonLabel(2018)).toBe('2018-19');
    // 옛 3~12월 규칙은 통일 전 세이브의 진행 중 시즌(legacyCal)에만
    expect(winterOpen(2018, 'spring-autumn')).toBe('2018-07-01');
    expect(windowKo({ legacyCal: 'spring-autumn' }, 'summer')).toBe('겨울');
    expect(seasonLabel(2018, 'spring-autumn')).toBe('2018');
    // 다른 리그(PL)도 같은 날 개막 전
    expect(g.otherLeagues![0]!.round).toBe(0);
    expect(g.otherLeagues![0]!.season).toBe(g.league.season);
    // 몇 경기 진행 (엔진 없이)
    for (let k = 0; k < 3; k++) {
      while (!isMatchDay(g)) { playOthers(g, 'quick'); endDay(g); }
      playRound(g, { engine: 'quick', others: 'quick' });
    }
    expect(g.league.round).toBe(3);
  });

  it('홀수 팀 리그(MLS 23팀)의 쉬는 라운드: 다음 경기는 내 경기가 있는 라운드, 그 라운드를 치를 때 넘어간다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-b', difficulty: 'normal', leagues: ['mls'] });
    const me = g.player.teamId;
    const byes = g.league.schedule.map((r, i) => (r.some((f) => f.home === me || f.away === me) ? -1 : i)).filter((i) => i >= 0);
    expect(byes).toHaveLength(2);
    g.league.round = byes[0]!;
    const nx = nextFixture(g);
    expect(nx).not.toBeNull();
    const want = g.league.schedule[byes[0]! + 1]!.find((f) => f.home === me || f.away === me)!;
    expect(nx!.opponentId).toBe(want.home === me ? want.away : want.home);
  });

  it('국내 컵 참가: 같은 나라 다른 리그 팀까지 32·16·8 (분데스 18 + 2부 → 32), 내 팀은 늘 포함', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-c', difficulty: 'normal', leagues: ['bundesliga'] });
    const teams = domesticCupTeams(g);
    expect(teams).toHaveLength(32);
    expect(teams.filter((id) => id.startsWith('bundesliga:'))).toHaveLength(18);
    expect(teams).toContain(g.player.teamId);
    const ch = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-c', difficulty: 'normal', leagues: ['championship'] });
    expect(domesticCupTeams(ch)).toContain(ch.player.teamId);
    expect(cupNameKo('championship')).toBe('FA컵');
  });

  it('새 게임 화면: 내 리그로 버튼(실제 선수 모드 없음), 실제 선수 고르면 그 리그가 내 리그', () => {
    const rows = leaguePickerVM(['pl', 'laliga', 'mls']);
    // 45b b: [내 리그로] 없앰 — 내 리그는 시작 팀으로 (리그 고르기는 다른 리그 묶음만)
    expect(rows.some((r) => r.canMine)).toBe(false);
    expect(leaguePickerVM(['pl', 'laliga'], true).some((r) => r.canMine)).toBe(false);
    const vm = newGameVM({ mode: 'real', realId: 'messi', leagues: ['pl', 'laliga'], seed: 'x', roll: 'x', position: 'ST', difficulty: 'normal', name: '' } as unknown as Parameters<typeof newGameVM>[0]);
    expect(vm.leagues.find((l) => l.mine)!.id).toBe('laliga');
    expect(vm.reals.find((r) => r.id === 'messi')!.club).toContain('라리가');
    expect(selectableRealPlayers(['kleague1']).every((p) => leagueOfTeam(CLUB_TO_TEAM[p.club]) === 'kleague1')).toBe(true);
  });
});

describe('리그별 순위·기록 (C.76c 3번)', () => {
  it('다른 리그 빠른 시뮬 득점자: 시드 로스터에서 (실제 선수 포함), 점수·순위는 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-s', difficulty: 'normal', leagues: ['pl', 'laliga'] });
    const la = g.otherLeagues![0]!;
    syncOtherLeagues(g, addDays(g.calendar.date, 120));
    const played = la.table.reduce((t, r) => t + r.played, 0) / 2;
    expect(played).toBeGreaterThan(100);
    const goals = la.table.reduce((t, r) => t + r.gf, 0);
    const scored = Object.values(la.stats ?? {}).reduce((t, [gl]) => t + gl, 0);
    expect(scored).toBe(goals);
    const top = otherScorers(la, 10);
    expect(top).toHaveLength(10);
    for (let i = 1; i < top.length; i++) expect(top[i - 1]![3]).toBeGreaterThanOrEqual(top[i]![3]);
    expect(top.some(([id]) => REAL_PLAYER_BY_ID.has(id))).toBe(true);
    // 세이브 왕복
    expect(deserialize(serialize(g)).otherLeagues![0]!.stats).toEqual(la.stats);
  });

  it('월드 화면: 리그 고르기 탭 · 다른 리그 순위표·득점 · MLS 동·서부 컨퍼런스', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-w', difficulty: 'normal', leagues: ['pl', 'mls'] });
    syncOtherLeagues(g, addDays(g.calendar.date, 30));
    const mine = worldVM(g);
    expect(mine.leagueTabs.map((t) => t.id)).toEqual(['', 'mls']);
    expect(mine.other).toBeNull();
    const vm = worldVM(g, 'mls');
    expect(vm.other!.groups!.map((x) => [x.title, x.rows.length])).toEqual([['동부 컨퍼런스', 11], ['서부 컨퍼런스', 12]]);
    expect(vm.other!.scorers.length).toBeGreaterThan(0);
    const html = worldView(vm, 'table');
    expect(html).toContain('동부 컨퍼런스');
    expect(html).toContain('world-league');
    expect(worldView(vm, 'scorers')).toContain('골');
    // MLS 가 내 리그면 내 순위표도 컨퍼런스별
    const m = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-w', difficulty: 'normal', leagues: ['mls'] });
    expect(worldVM(m).groups).toHaveLength(2);
    expect(worldVM(m).leagueTabs).toEqual([]);
    expect(otherLeagueVM(g, g.otherLeagues![0]!).sub).toContain('미국');
  });

  it('리그가 끝나면 지난 시즌 우승·득점왕을 남기고 다음 시즌 기록은 비운다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-p', difficulty: 'normal', leagues: ['pl', 'kleague1'] });
    syncOtherLeagues(g, '2019-07-25');
    const k = g.otherLeagues![0]!;
    expect(k.season).toBe(2019);
    expect(k.past?.at(-1)?.season).toBe(2018);
    expect(k.past?.at(-1)?.scorer?.[2]).toBeGreaterThan(5);
    expect(k.stats).toBeUndefined();
  });
});

describe('이적 시장 = 고른 리그 (C.76c 4번)', () => {
  it('NPC 이적 목적지에 다른 고른 리그 팀, 빈자리 보충에 다른 리그 실제 선수 (강팀에서 약팀으로는 안 옴)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-t', difficulty: 'normal', leagues: ['pl', 'laliga', 'bundesliga', 'mls', 'kleague1'] });
    finishSeason(g);
    const recs = g.transfers ?? [];
    const others = new Set(g.otherLeagues!.flatMap((o) => o.teams.map((t) => t.id)));
    expect(recs.some((r) => others.has(r.to))).toBe(true);
    // 고른 리그의 같은 클럽은 x: 로 가지 않는다
    expect(recs.some((r) => r.to === 'x:bar' || r.to === 'x:bay')).toBe(false);
    const real = recs.filter((r) => r.fill?.real);
    expect(real.length).toBeGreaterThan(0);
    for (const r of real) {
      const n = g.npcs.find((x) => x.id === r.fill!.id)!;
      expect(leagueOfTeam(CLUB_TO_TEAM[n.club])).toBe('pl');
      expect(g.rosters[r.from]!.players.some((p) => p.id === n.id && p.real)).toBe(true);
    }
    // 다시 만든 로스터도 같은 실제 선수
    expect(noShirts(deserialize(serialize(g)))).toBe(noShirts(g));
  });

  it('PL 만 고르면 다른 리그 목적지·실제 선수 보충 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-t', difficulty: 'normal' });
    finishSeason(g);
    const recs = g.transfers ?? [];
    expect(recs.every((r) => r.to.startsWith('x:') || g.league.teams.some((t) => t.id === r.to))).toBe(true);
    expect(recs.some((r) => r.fill?.real)).toBe(false);
  });

  it('내 선수 다른 리그 제안: 같은 달력 리그만, 받아들이면 다음 시즌 그 리그가 내 리그 · 세이브 왕복 로스터 같음', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c76c-m', difficulty: 'normal', leagues: ['pl', 'laliga', 'kleague1'] });
    // C.76m: 모든 리그 같은 8~5월이라 K리그1 도 옮길 수 있다. 통일 전 세이브의 진행 중 3~12월 시즌만 빠진다
    expect(movableLeagues(g)).toEqual(['laliga', 'kleague1']);
    g.otherLeagues![1]!.legacyCal = 'spring-autumn';
    expect(movableLeagues(g)).toEqual(['laliga']);
    delete g.otherLeagues![1]!.legacyCal;
    finishSeason(g);
    const offers = g.market.offers ?? [];
    let i = offers.findIndex((o) => leagueOfTeam(o.teamId) === 'laliga');
    if (i < 0) { g.market.offers = [...offers, { teamId: 'laliga:rma', kind: 'transfer', years: 3, wage: 2000, start: 0.6, interest: 1 }]; i = g.market.offers.length - 1; }
    const to = g.market.offers![i]!.teamId;
    acceptMyOffer(g, i);
    expect(g.player.teamId).toBe(to);
    expect(g.myLeagues).toEqual([{ at: 0, id: 'pl' }, { at: 1, id: 'laliga' }]);
    expect(Object.keys(g.rosters)).toHaveLength(40);
    expect(noShirts(deserialize(serialize(g)))).toBe(noShirts(g));
    startNextSeason(g);
    expect(g.league.id).toBe('laliga');
    expect(g.league.season).toBe(2019);
    expect(g.leagueIds![0]).toBe('laliga');
    expect(g.otherLeagues!.map((o) => o.id).sort()).toEqual(['kleague1', 'pl']);
    expect(Object.keys(g.rosters)).toHaveLength(20);
    expect(leagueMoves(g)).toHaveLength(2);
    expect(squadRule()).toEqual(BALANCE.squad.leagues.laliga);
    const back = deserialize(serialize(g));
    expect(back.league.id).toBe('laliga');
    expect(noShirts(back)).toBe(noShirts(g));
    // 다음 시즌 끝까지 (로스터 재생성 일치)
    finishSeason(g);
    expect(noShirts(deserialize(serialize(g)))).toBe(noShirts(g));
  });
});

describe('미래 스타 = 고른 리그 기준 (C.76c 4번)', () => {
  it('등장 예정은 고른 리그 중 가장 이른 첫 시즌, 로스터는 내 리그 첫 시즌', () => {
    const haaland = FUTURE_STARS.find((l) => l.id === 'fs-haaland')!;
    expect(futureDebut(haaland, ['pl'])).toBe(2022);
    expect(futureDebut(haaland, ['pl', 'bundesliga'])).toBe(2019);
    expect(futureEntry(haaland, ['bundesliga'])!.team).toBe('bundesliga:bvb');
    expect(upcomingFutureStars(2018, ['laliga']).length).toBeGreaterThan(upcomingFutureStars(2018, ['pl']).length - 4);
    // 라리가로 시작하면 야말이 바르셀로나에 (2022-23), PL 등장 선수는 로스터에 없음
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-f', difficulty: 'normal', leagues: ['laliga'], futureStars: true });
    expect(Object.values(g.rosters).flatMap((r) => r.players).some((p) => p.id === 'fs-garnacho')).toBe(false);
    expect(futureDebut(FUTURE_STARS.find((l) => l.id === 'fs-yamal')!, ['laliga'])).toBe(2022);
  });
});

describe('도감 번호 (C.76c 6번)', () => {
  it('리그 데이터 선수 506명이 뒤에 붙고 앞 238명은 그대로', () => {
    expect(DEX_IDS).toHaveLength(744);
    expect(DEX_LOCKS.map(([n]) => n)).toEqual([238, 744]);
    for (const [n, h] of DEX_LOCKS) expect(dexHash(DEX_IDS.slice(0, n))).toBe(h);
    const ids = new Set(DEX_IDS);
    for (const ps of Object.values(LEAGUE_PLAYERS)) for (const p of ps) expect(ids.has(p.id), p.id).toBe(true);
    expect(dexCandidates().length).toBe(744);
    // 리그 순서: 챔피언십(노리치)부터
    expect(DEX_IDS[238]).toBe('aarons');
  });
});

describe('세이브 49 (C.76c)', () => {
  it('옛 세이브(48) = 그대로 (PL 만 고른 상태), 다른 리그 득점 기록 없음', () => {
    expect(SAVE_FORMAT_VERSION).toBe(53);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76c-v', difficulty: 'normal' });
    const old = JSON.parse(serialize(g));
    old.saveFormat = 48;
    const back = migrate(old);
    expect(back.saveFormat).toBe(53);
    expect(back.league.id).toBe('pl');
    expect(back.leagueIds).toEqual(['pl']);
    expect(back.myLeagues).toBeUndefined();
    expect(leagueMoves(back)).toEqual([{ at: 0, id: 'pl' }]);
    expect(Object.keys(back.rosters)).toHaveLength(20);
    expect(OUTSIDE_CLUBS.find((c) => c.id === 'x:bay')!.name).toBe('Bayern Munich');
  });
});
