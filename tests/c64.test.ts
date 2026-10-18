// C.64 (37단계 5-3): 월드 정보·NPC 시즌 통계 — 리그 기록 순위 · 시즌 시상(영플레이어) · NPC 위상 · 리그 스타 묶음 · 기록 소식 · 세이브 상한
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, SAVE_FORMAT_VERSION, type GameState, type SeasonArchive } from '../src/game';
import { inboxList } from '../src/inbox';
import { npcReputation } from '../src/finance';
import { naturalOvr } from '../src/roster';
import { deserialize, serialize } from '../src/save';
import { leaderboard, npcStanding, ratingMinApps, seasonAwards, trimArchive, worldAfterRound, worldSeasonEnd } from '../src/worldStats';
import { worldVM } from '../src/ui/viewModels';
import { worldView } from '../src/ui/views/screens';
import { personDetailVM } from '../src/ui/detailVM';
import { rivalOf } from '../src/rival';

const W = BALANCE.world;

/** 리그 선수 n명에게 가짜 시즌 기록을 준다 (엔진 다른 경기를 돌리지 않고 빠르게) */
function fakeStats(g: GameState, n = 60): string[] {
  const ids = Object.values(g.rosters).flatMap((r) => r.players.filter((p) => p.position !== 'GK').map((p) => p.id)).slice(0, n);
  g.playerStats = {};
  ids.forEach((id, i) => {
    const apps = 5 + (i % 15);
    g.playerStats[id] = [apps, Math.max(0, 20 - i), i % 7, apps * (60 + (i % 25)), apps * 80];
  });
  g.league.round = 19;
  return ids;
}

describe('리그 기록 순위 (18.5)', () => {
  it('득점 · 도움 · 평점(자격 출전) 순위, 내 선수는 순위 밖이면 끝에 자기 순위로', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c64-board', difficulty: 'normal' });
    const ids = fakeStats(g);
    const goals = leaderboard(g, 'goals', 10);
    expect(goals[0]!.id).toBe(ids[0]);
    expect(goals.slice(0, 10).every((r, i, a) => i === 0 || a[i - 1]!.goals >= r.goals)).toBe(true);
    const ast = leaderboard(g, 'assists', 10);
    expect(ast.every((r, i, a) => i === 0 || a[i - 1]!.assists >= r.assists)).toBe(true);
    const min = ratingMinApps(g);
    expect(min).toBe(Math.max(W.ratingMinApps, Math.round(19 * W.ratingMinShare)));
    const rt = leaderboard(g, 'rating', 10);
    expect(rt.every((r) => r.apps >= min)).toBe(true);
    expect(rt.every((r, i, a) => i === 0 || a[i - 1]!.avg >= r.avg)).toBe(true);
    // 내 선수: 1골, 순위 밖 → 끝에 붙음
    Object.assign(g.player.season, { apps: 10, goals: 1, assists: 0, ratingSum: 65 });
    const withMe = leaderboard(g, 'goals', 5);
    expect(withMe.length).toBe(6);
    expect(withMe.at(-1)!.me).toBe(true);
    expect(withMe.at(-1)!.rank).toBeGreaterThan(5);
  });

  it('시즌 시상: 득점왕 · 도움왕 · 최고 평점 · 영플레이어(21세 이하)', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c64-awards', difficulty: 'normal' });
    fakeStats(g);
    // 21세 이하 한 명에게 자격 기록
    const young = Object.values(g.rosters).flatMap((r) => r.players).find((p) => p.age <= 21 && p.position !== 'GK')!;
    g.playerStats[young.id] = [W.youngMinApps, 2, 2, W.youngMinApps * 95, 900];
    const aw = seasonAwards(g);
    expect(aw.map((a) => a.kind)).toEqual(['goals', 'assists', 'rating', 'young']);
    expect(aw.find((a) => a.kind === 'young')!.id).toBe(young.id);
    expect(aw.find((a) => a.kind === 'rating')!.value).toBeGreaterThan(0);
  });
});

describe('NPC 위상 (C.63a 라이벌 OVR → 위상)', () => {
  it('OVR 근사 + 시즌 기록 + 수상, 기록 없으면 OVR 근사 그대로', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c64-rep', difficulty: 'normal' });
    const p = Object.values(g.rosters).flatMap((r) => r.players).find((x) => x.position === 'ST')!;
    const ovr = naturalOvr(p);
    expect(npcStanding(g, p.id, ovr)).toBe(Math.round(npcReputation(ovr)));
    g.playerStats = { [p.id]: [19, 15, 5, 19 * 78, 1700] };
    const hot = npcStanding(g, p.id, ovr);
    expect(hot).toBeGreaterThan(Math.round(npcReputation(ovr)));
    expect(hot - Math.round(npcReputation(ovr))).toBeLessThanOrEqual(W.standing.perfMax + 1);
    g.playerStats = { [p.id]: [19, 0, 0, 19 * 58, 1700] };
    expect(npcStanding(g, p.id, ovr)).toBeLessThan(Math.round(npcReputation(ovr)));
    // 수상: 지난 시즌 득점왕
    g.playerStats = {};
    g.archive = [{ season: 2017, teamId: g.player.teamId, my: [], results: [], players: {}, table: [], aw: [['goals', p.id, 25]] }];
    expect(npcStanding(g, p.id, ovr)).toBe(Math.round(npcReputation(ovr)) + W.standing.honorRep);
  });

  it('라이벌 카드·소개 = 위상 비교, 선수 상세 위상 = NPC 위상', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c64-rival', difficulty: 'normal' });
    const r = rivalOf(g)!;
    expect(r).toBeTruthy();
    expect(r.myRep).toBe(g.player.reputation);
    expect(Math.abs(r.rep - g.player.reputation)).toBeLessThanOrEqual(W.rivalMaxGap + 400);
    expect(inboxList(g).find((x) => x.cat === 'rival')!.body).toContain('위상');
    const d = personDetailVM(g, r.id)!;
    expect(d.repScore).toBe(r.rep);
  });
});

describe('월드 화면 (147 리그 스타 묶음 · 득점 탭 거르기)', () => {
  it('리그 스타 리그 안/세계/21세 이하, 리그 기록 득점/도움/평점', () => {
    const g = newGame({ mode: 'real', playerId: 'son', seed: 'c64-world', difficulty: 'normal' });
    fakeStats(g);
    const vm = worldVM(g);
    expect(vm.stars.length).toBeGreaterThan(5);
    expect(vm.stars.every((s, i, a) => i === 0 || a[i - 1]!.standing >= s.standing)).toBe(true);
    expect(vm.starsWorld.every((s) => !vm.stars.some((x) => x.id === s.id))).toBe(true);
    expect(vm.starsYoung.every((s) => s.age <= BALANCE.squad.u21Age)).toBe(true);
    const html = worldView(vm, 'stars', '', {}, 'young');
    expect(html).toContain('21세 이하');
    expect(html).toContain('data-act="world-stars"');
    expect(worldView(vm, 'stars', '', {}, 'world')).toContain('리그 밖 클럽');
    const sc = worldView(vm, 'scorers', '', {}, 'league', 'rating');
    expect(sc).toContain('data-act="world-board"');
    expect(sc).toContain(`${vm.ratingMin}경기 이상`);
    expect(vm.boards.assists.length).toBeGreaterThan(0);
  });
});

describe('기록 소식 (인박스)', () => {
  it('raceRounds 라운드 뒤 득점 경쟁 기사, 시즌 끝 시상 기사, 기록 없으면 안 냄', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'c64-news', difficulty: 'normal' });
    g.league.round = W.raceRounds[0]!;
    worldAfterRound(g);
    expect(inboxList(g).some((x) => x.key?.startsWith('race:'))).toBe(false);
    fakeStats(g);
    g.league.round = W.raceRounds[0]!;
    worldAfterRound(g);
    const race = inboxList(g).find((x) => x.key?.startsWith('race:'))!;
    expect(race.body).toContain('1위');
    expect(race.link?.act).toBe('world-tab');
    worldSeasonEnd(g);
    expect(inboxList(g).find((x) => x.key?.startsWith('awards:'))!.body).toContain('득점왕');
  });
});

describe('세이브 상한 (지난 시즌 요약)', () => {
  it('최근 fullSeasons 시즌은 그대로, 그 앞은 상위·내 팀·수상자만 + 득점 기록 삭제', () => {
    const players: SeasonArchive['players'] = {};
    for (let i = 0; i < 400; i++) players[`p${i}`] = [20, i % 13, i % 9, 20 * (55 + (i % 30)), 1500];
    const mk = (season: number): SeasonArchive => ({
      season, teamId: 'tot', my: [], results: [[1, 'mci', 'liv', 2, 1, [[10, 0, 'p1', 'p2']]]], players: { ...players }, table: [],
      names: { p399: ['내 팀 동료', 'tot'], p398: ['다른 팀', 'mci'] },
    });
    const arch = [mk(2018), mk(2019), mk(2020), mk(2021), mk(2022)];
    trimArchive(arch);
    const slim = arch.slice(0, arch.length - W.archive.fullSeasons);
    for (const s of slim) {
      expect(s.slim).toBe(true);
      expect(Object.keys(s.players).length).toBeLessThanOrEqual(W.archive.keepTop * 3 + 5);
      expect(s.players.p399).toBeTruthy();
      expect(s.results[0]!.length).toBe(5);
      expect(s.aw?.length).toBeGreaterThan(0);
    }
    for (const s of arch.slice(-W.archive.fullSeasons)) {
      expect(s.slim).toBeUndefined();
      expect(Object.keys(s.players).length).toBe(400);
    }
  });

  it('세이브 34: 왕복, 33 세이브 이식(시상 줄 만들고 상한대로 줄임)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c64-save', difficulty: 'normal' });
    playRound(g, { engine: 'quick' });
    expect(SAVE_FORMAT_VERSION).toBe(36);
    const players: SeasonArchive['players'] = {};
    for (let i = 0; i < 200; i++) players[`p${i}`] = [20, i % 11, i % 5, 20 * 66, 1500];
    g.archive = [2014, 2015, 2016, 2017].map((season) => ({ season, teamId: g.player.teamId, my: [], results: [], players: { ...players }, table: [] }));
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 33;
    const o = deserialize(JSON.stringify(raw));
    expect(o.archive.every((a) => a.aw && a.aw.length > 0)).toBe(true);
    expect(o.archive[0]!.slim).toBe(true);
    expect(o.archive.at(-1)!.slim).toBeUndefined();
    const back = deserialize(serialize(o));
    expect(back.archive.length).toBe(4);
  });
});
