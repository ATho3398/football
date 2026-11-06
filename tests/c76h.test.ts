// 45b(b) 다른 리그 풀 엔진 · 새 게임 리그 선택 → 팀 고르기
import { describe, expect, it } from 'vitest';
import { newGame, playOthers, endDay, isMatchDay } from '../src/game';
import { applyOtherLeagueJob, otherLeagueJobs, syncOtherLeagues } from '../src/otherLeagues';
import { playNpcMatch } from '../src/engine/npcMatch';
import { addDays } from '../src/calendar';
import { deserialize, serialize } from '../src/save';

/** 다른 리그 경기가 있는 첫날까지 */
function toFirstOtherDay(g: ReturnType<typeof newGame>): void {
  for (let k = 0; k < 40 && !otherLeagueJobs(g, g.calendar.date).length; k++) {
    if (isMatchDay(g)) return;
    playOthers(g, 'quick');
    endDay(g);
  }
}

describe('다른 리그 풀 엔진 (45b b)', () => {
  it('그날 다른 리그 경기를 엔진으로: 순위표 · 선수 기록(출전·골·도움·평점·분), 순서와 무관하게 같은 결과', () => {
    const a = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-a', difficulty: 'normal', leagues: ['pl', 'mls'] });
    const b = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-a', difficulty: 'normal', leagues: ['pl', 'mls'] });
    toFirstOtherDay(a);
    toFirstOtherDay(b);
    const ja = otherLeagueJobs(a, a.calendar.date);
    expect(ja.length).toBeGreaterThan(0);
    // C.76m: MLS 도 PL 과 같은 8~5월이라 첫 경기 날 전에는 치른 경기가 없다
    const played0 = a.otherLeagues![0]!.table.reduce((t, r) => t + r.played, 0) / 2;
    const goals0 = a.otherLeagues![0]!.table.reduce((t, r) => t + r.gf, 0);
    const before0 = new Set(Object.keys(a.otherLeagues![0]!.stats ?? {}));
    for (const j of ja) applyOtherLeagueJob(a, j, playNpcMatch(j.input));
    const jb = otherLeagueJobs(b, b.calendar.date).reverse();
    const outs = jb.map((j) => playNpcMatch(j.input));
    jb.forEach((j, k) => applyOtherLeagueJob(b, j, outs[k]!));
    const mls = a.otherLeagues![0]!;
    expect(mls.table).toEqual(b.otherLeagues![0]!.table);
    expect(mls.stats).toEqual(b.otherLeagues![0]!.stats);
    const played = mls.table.reduce((t, r) => t + r.played, 0) / 2;
    expect(played - played0).toBe(ja.length);
    const lines = Object.entries(mls.stats!).filter(([id]) => !before0.has(id)).map(([, s]) => s);
    expect(lines.length).toBeGreaterThan(20);
    expect(lines.every((s) => s[2]! >= 1 && s[4]! > 0)).toBe(true);
    expect(Object.values(mls.stats!).reduce((t, s) => t + s[0], 0)).toBe(mls.table.reduce((t, r) => t + r.gf, 0));
    expect(goals0).toBe(0);
    // 하루 끝 빠른 계산은 이미 치른 경기를 건드리지 않는다
    const before = JSON.stringify(mls.table);
    syncOtherLeagues(a, a.calendar.date);
    expect(JSON.stringify(a.otherLeagues![0]!.table)).toBe(before);
    expect(deserialize(serialize(a)).otherLeagues![0]!.stats).toEqual(mls.stats);
  });

  it('playOthers(engine) 이 다른 리그 경기도 엔진으로, quick 은 하루 끝 빠른 계산 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76h-b', difficulty: 'normal', leagues: ['pl', 'kleague1'] });
    // C.76m: K리그1 도 8월 개막 — 다른 리그 경기가 있는 첫날까지
    toFirstOtherDay(g);
    const d = g.calendar.date;
    expect(otherLeagueJobs(g, d).length + otherLeagueJobs(g, addDays(d, 1)).length).toBeGreaterThan(0);
    for (let k = 0; k < 3; k++) {
      if (isMatchDay(g)) break;
      playOthers(g, 'engine');
      endDay(g);
    }
    const k1 = g.otherLeagues![0]!;
    expect(Object.values(k1.stats ?? {}).some((s) => s[2] !== undefined)).toBe(true);
  });
});

describe('새 게임 시작 팀 고르기 (45b b)', () => {
  it('유망주: 리그 탭 → 팀 목록, 순위 범위 밖 팀은 흐리게 + 이유, 고른 팀 리그가 내 리그', async () => {
    const { prospectTeamPick, prospectTeamOk, pickLeagueOf } = await import('../src/ui/teamPickVM');
    const p = prospectTeamPick('laliga', '');
    expect(p.leagues).toHaveLength(14);
    expect(p.teams).toHaveLength(20);
    expect(p.teams.slice(0, 7).every((t) => !t.ok && t.why.includes('8~20위'))).toBe(true);
    expect(p.teams.slice(7).every((t) => t.ok)).toBe(true);
    expect(p.random?.on).toBe(true);
    expect(prospectTeamPick('kleague1', '').teams.filter((t) => t.ok)).toHaveLength(5);
    expect(prospectTeamOk('laliga:bar')).toBe(false);
    expect(pickLeagueOf('laliga:ath', 'pl', 'pl')).toBe('laliga');
    expect(pickLeagueOf('', 'mls', 'pl')).toBe('mls');
    const { newGame, startLeagueOf } = await import('../src/game');
    const { rolledSpec } = await import('../src/ui/customRandom');
    const opts = { mode: 'custom' as const, custom: rolledSpec('c76h-t', 'ST', ''), seed: 'c76h-t', difficulty: 'normal' as const, leagues: ['pl'], teamId: 'laliga:ath' };
    expect(startLeagueOf(opts)).toBe('laliga');
    const g = newGame(opts);
    expect(g.league.id).toBe('laliga');
    expect(g.player.teamId).toBe('laliga:ath');
    expect(g.leagueIds).toEqual(['laliga', 'pl']);
    // 순위 범위 밖 팀이면 랜덤 (같은 시드의 랜덤 결과)
    const top = newGame({ ...opts, teamId: 'laliga:bar' });
    const rnd = newGame({ ...opts, teamId: undefined, leagues: ['laliga', 'pl'] });
    expect(top.player.teamId).toBe(rnd.player.teamId);
  });

  it('커스텀 소속팀: 고른 리그 탭에서 스탯에 맞는 팀만 고를 수 있고, 고른 팀 리그로 시작', async () => {
    const { customVM, initialCustomForm, startChoice } = await import('../src/ui/customVM');
    const f = { ...initialCustomForm(), age: 21, startKind: 'club' as const, startClub: '' };
    const vm = customVM(f, '', 'pl', 'seriea');
    expect(vm.start.pick.league).toBe('seriea');
    const ok = vm.start.pick.teams.filter((t) => t.ok);
    expect(ok.length).toBe((await import('../src/config/balance')).BALANCE.startClub.fitTeams);
    expect(vm.start.pick.teams.filter((t) => !t.ok).every((t) => t.why === '스탯에 맞지 않아요')).toBe(true);
    const chosen = { ...f, startClub: ok[0]!.id };
    const vm2 = customVM(chosen, '', 'pl', 'pl');
    expect(vm2.start.ready).toBe(true);
    expect(vm2.start.pick.league).toBe('seriea');
    const { newGame, startLeagueOf } = await import('../src/game');
    const { customSpec } = await import('../src/ui/customVM');
    const opts = { mode: 'custom' as const, custom: customSpec(chosen, 'X'), seed: 'c76h-c', difficulty: 'normal' as const, leagues: ['pl'] };
    expect(startLeagueOf(opts)).toBe('seriea');
    expect(newGame(opts).player.teamId).toBe(ok[0]!.id);
    void startChoice;
  });
});
