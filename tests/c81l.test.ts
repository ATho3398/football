// C.81l (53단계) 대표팀 큰 대회 실제 경기 · 컵 소식 실제 날짜: 대회 일정 생성 · 소집/미소집 흐름 · 도중 저장 이전 · 컵 뉴스 날짜
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { addDays, daysBetween } from '../src/calendar';
import { clubSeasonOver, isVacationDay, newGame, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { cupsPending } from '../src/cups';
import {
  advanceTournament, drawTournament, ensureNational, myNationAlive, natTournamentAlive, settleMyTournamentMatch, tournamentRecord, tournamentState, type NatMatch,
} from '../src/national';
import { MIGRATIONS, needsMigration } from '../src/saveMigrations';
import { deserialize, restoreWithInfo, serialize } from '../src/save';

const N = BALANCE.national;
const son = (seed = 'c81l') => {
  const g = newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });
  g.player.reputation = BALANCE.reputation.tierCuts.worldClass + 1;
  return g;
};
const prospect = (seed = 'c81l-p') => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal', name: '테스트' });

/** 클럽 시즌 끝(리그 최종 + 내 컵 끝)까지 빠른 경기 */
function toClubEnd(g: GameState): void {
  while (g.phase === 'season' && !clubSeasonOver(g)) playRound(g, { engine: 'quick' });
}

describe('대회 일정 생성 (C.81l)', () => {
  it('추첨: 조 편성·날짜 (최종 라운드 + startAfter, 조별 gap 간격, 소집일 = 첫 경기 campDays 전) · 결과 없음', () => {
    const g = son();
    const live = drawTournament(g, 'wc', 2022, '2022-05-22', true);
    expect(live.groups).toHaveLength(8);
    expect(live.groups.flat()).toHaveLength(32);
    expect(live.start).toBe(addDays('2022-05-22', N.startAfter));
    expect(live.camp).toBe(addDays(live.start, -N.campDays));
    expect(live.played).toEqual({});
    const v = tournamentState(g, live);
    // 조별 48경기만 (녹아웃은 조별이 끝나야 생긴다), 차전별 날짜
    expect(v.matches).toHaveLength(48);
    expect(v.matches.every((m) => !m.ko)).toBe(true);
    for (let md = 0; md < 3; md++) expect(v.matches.filter((m) => m.stage === `조별 ${md + 1}차전`).every((m) => m.date === addDays(live.start, md * N.gap))).toBe(true);
    expect(v.alive).toHaveLength(32);
    expect(v.done).toBe(false);
    expect(v.ko).toEqual([]);
  });
  it('결과를 쌓으면 녹아웃 대진이 단계마다 생긴다: 16강(조별 뒤) → 8강 → … → 결승 → 우승. 끝까지 한꺼번에도 같은 대진', () => {
    const g = son();
    const live = drawTournament(g, 'wc', 2022, '2022-05-22', false);
    // 조별 1·2차전까지만
    advanceTournament(g, live, addDays(live.start, N.gap));
    let v = tournamentState(g, live);
    expect(v.matches.filter((m) => m.res)).toHaveLength(32);
    expect(v.ko).toEqual([]);
    // 조별 3차전 날 → 16강 대진 (날짜 = start + 3 gap), 아직 결과 없음 (ga −1)
    advanceTournament(g, live, addDays(live.start, 2 * N.gap));
    v = tournamentState(g, live);
    expect(v.ko).toHaveLength(1);
    expect(v.ko[0]!.name).toBe('16강');
    expect(v.ko[0]!.ties).toHaveLength(8);
    expect(v.ko[0]!.ties.every((t) => t.ga === -1 && t.winner === '')).toBe(true);
    expect(v.matches.filter((m) => m.ko).every((m) => m.date === addDays(live.start, 3 * N.gap))).toBe(true);
    expect(v.alive).toHaveLength(16);
    // 16강 날 → 8강 대진
    advanceTournament(g, live, addDays(live.start, 3 * N.gap));
    v = tournamentState(g, live);
    expect(v.ko.map((k) => k.name)).toEqual(['16강', '8강']);
    expect(v.alive).toHaveLength(8);
    // 끝까지
    const done = advanceTournament(g, live, null);
    expect(done.done).toBe(true);
    expect(done.ko.map((k) => k.ties.length)).toEqual([8, 4, 2, 1]);
    expect(done.champion).toBe(done.ko[3]!.ties[0]!.winner);
    const rec = tournamentRecord(g, live, done);
    expect(rec.champion).toBe(done.champion);
    expect(rec.ko).toHaveLength(4);
    // 같은 시드로 한꺼번에 치른 결과와 같다 (경기 열쇠 시드)
    const once = drawTournament(g, 'wc', 2022, '2022-05-22', false);
    advanceTournament(g, once, null);
    expect(once.played).toEqual(live.played);
  });
  it('내 경기 기록: 조별 무승부는 그대로, 녹아웃 무승부는 승부차기 판정이 m.pens 에 (앞 팀 기준 → 내 쪽 기준)', () => {
    const g = son();
    const live = drawTournament(g, 'wc', 2022, '2022-05-22', true);
    if (!live.qualified) return;
    const m: NatMatch = { key: `t:${live.id}:k0:0`, date: live.start, comp: 'wc', stage: '16강', opp: 'Brazil', home: false, seq: 201, season: 2021 };
    const r = settleMyTournamentMatch(g, live, m, 2, 2);
    expect(r.pens).toBeDefined();
    expect(m.pens).toEqual(r.pens);
    const res = live.played['k0:0']!;
    expect(res[0]).toBe(2);
    expect(res[2]).toEqual([m.pens![1], m.pens![0]]);
    expect(r.won).toBe(m.pens![0] > m.pens![1]);
    const g1: NatMatch = { key: `t:${live.id}:g0:0:0:1`, date: live.start, comp: 'wc', stage: '조별 1차전', opp: 'Brazil', home: true, seq: 202, season: 2021 };
    expect(settleMyTournamentMatch(g, live, g1, 1, 1)).toEqual({ won: false });
    expect(live.played['g0:0:0:1']).toEqual([1, 1]);
  });
});

describe('소집 흐름: 클럽 시즌 끝 → 휴가 → 소집일 → 조별 3경기 → 녹아웃 (달력 위, 내 경기는 클럽 경기처럼)', () => {
  it('월드클래스 손흥민 2019 아시안컵: 소집 알림 · 휴가 · 조별 3경기 일정 · 내 경기 보고 · 다른 경기는 그 날짜에 · 탈락/우승 뒤 시즌 끝 · 기록', () => {
    const g = son();
    toClubEnd(g);
    const nat = ensureNational(g);
    expect(g.phase).toBe('season');
    expect(nat.summer).toEqual({ year: 2019, called: true });
    const live = nat.live!;
    expect(live.comp).toBe('asian');
    expect(live.called).toBe(true);
    expect(natTournamentAlive(g)).toBe(true);
    expect(g.inbox!.items.some((x) => x.key === `natcall:t:${live.id}`)).toBe(true);
    // 조별 3경기가 내 일정에 (녹아웃은 아직)
    const mine = nat.fixtures.filter((m) => m.key.startsWith(`t:${live.id}:`));
    expect(mine.map((m) => m.stage)).toEqual(['조별 1차전', '조별 2차전', '조별 3차전']);
    expect(mine.map((m) => m.date)).toEqual([0, 1, 2].map((k) => addDays(live.start, k * N.gap)));
    expect(mine.every((m) => m.season === g.league.season && m.comp === 'asian')).toBe(true);
    // 휴가: 마지막 클럽 경기 afterMatch 일 뒤부터 소집일 전날까지, 소집일부터는 훈련
    const lastClub = addDays(g.calendar.date, -1);
    expect(isVacationDay(g, addDays(lastClub, BALANCE.training.vacation.afterMatch))).toBe(true);
    expect(isVacationDay(g, addDays(live.camp, -1))).toBe(true);
    expect(isVacationDay(g, live.camp)).toBe(false);
    expect(isVacationDay(g, live.start)).toBe(false);
    // 경기: 날짜 순으로 내 경기 보고 (대회 이름 · 단계), 그날까지 다른 나라 경기는 하루 끝에 빠른 계산
    const labels: string[] = [];
    let before = 0;
    while (g.phase === 'season') {
      const r = playRound(g, { engine: 'quick' });
      if (!r.nat) throw new Error(`대표팀 경기가 아님: ${r.round}`);
      labels.push(r.nat.label);
      if (nat.live) {
        const played = Object.keys(nat.live.played).length;
        expect(played).toBeGreaterThan(before);
        before = played;
        // 지난 날짜 경기는 모두 결과가 있다
        const v = tournamentState(g, nat.live);
        expect(v.matches.filter((m) => daysBetween(m.date, g.calendar.date) > 0 && !m.res)).toEqual([]);
      }
      if (labels.length > 8) throw new Error('대회가 안 끝남');
    }
    expect(labels.slice(0, 3)).toEqual(['아시안컵 조별 1차전', '아시안컵 조별 2차전', '아시안컵 조별 3차전']);
    expect(g.phase).toBe('offseason');
    expect(nat.live).toBeUndefined();
    const rec = nat.tournaments.at(-1)!;
    expect(rec.id).toBe(live.id);
    expect(rec.called).toBe(true);
    expect(rec.champion).not.toBe('');
    expect(rec.ko.every((k) => k.ties.every((t) => t.ga >= 0 && t.winner))).toBe(true);
    const played = nat.fixtures.filter((m) => m.key.startsWith(`t:${live.id}:`));
    expect(played.length).toBe(labels.length);
    expect(played.every((m) => m.gf !== undefined)).toBe(true);
    // 성적 = 내 경기 수와 맞는다 (조별 탈락 3 · 16강 4 · 8강 5 · 4강 6 · 결승 7)
    const byReach: Record<string, number> = { '조별 탈락': 3, '16강': 4, '8강': 5, '4강': 6, '준우승': 7, '우승': 7 };
    expect(byReach[rec.reach]).toBe(labels.length);
    expect(g.lastSeasonSummary!.nat).toEqual(expect.objectContaining({ label: '2019 아시안컵', reach: rec.reach, called: true }));
    expect(nat.honors.at(-1)).toEqual(expect.objectContaining({ comp: 'asian', year: 2019, reach: rec.reach }));
    expect(g.inbox!.items.some((x) => x.key === `natcup:${live.id}` && x.title.includes(rec.reach))).toBe(true);
    // 시즌은 내 마지막 대회 경기 날 끝났다 (남은 다른 나라 경기는 한꺼번에)
    expect(g.calendar.date).toBe(played.at(-1)!.date);
  }, 120_000);

  it('대회 도중 저장·불러오기 (SAVE_FORMAT_VERSION 62): 조별 1차전 뒤 왕복해도 같은 대회 결과 · 옛 형식(61) 세이브는 이전 뒤 대회 없음', () => {
    const run = (roundtrip: boolean) => {
      const g0 = son('c81l-save');
      toClubEnd(g0);
      let g = g0;
      playRound(g, { engine: 'quick' });
      if (roundtrip) {
        const json = serialize(g);
        g = deserialize(json);
        expect(g.saveFormat).toBe(SAVE_FORMAT_VERSION);
        expect(g.national!.live).toEqual(g0.national!.live);
        expect(natTournamentAlive(g)).toBe(true);
      }
      while (g.phase === 'season') playRound(g, { engine: 'quick' });
      return g;
    };
    const a = run(false);
    const b = run(true);
    expect(a.national!.tournaments.at(-1)).toEqual(b.national!.tournaments.at(-1));
    expect(a.national!.fixtures.map((m) => [m.key, m.gf, m.ga, m.pens])).toEqual(b.national!.fixtures.map((m) => [m.key, m.gf, m.ga, m.pens]));
    // 옛 형식 61 세이브 → 62: 대표팀 상태 그대로, 진행 중인 대회 없음
    const raw = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'saves', 'v61.json'), 'utf8'));
    expect(needsMigration(raw)).toBe(true);
    expect(MIGRATIONS[61]!(raw)).toEqual(raw);
    const { state, migratedFrom } = restoreWithInfo(raw);
    expect(migratedFrom).toBe(61);
    expect(state.national?.live).toBeUndefined();
    expect(natTournamentAlive(state)).toBe(false);
  }, 180_000);

  it('미소집(나이 미달): 대회는 시즌 끝에 한꺼번에 결과만 (뉴스) · 시즌은 마지막 컵 경기 다음 날 끝', () => {
    const g = prospect();
    g.player.age = 16;
    toClubEnd(g);
    const nat = ensureNational(g);
    expect(nat.summer).toEqual(expect.objectContaining({ year: 2019, called: false }));
    expect(nat.live).toBeUndefined();
    expect(natTournamentAlive(g)).toBe(false);
    const cups = g.cups!;
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    expect(cupsPending(g)).toBe(false);
    expect(cups.fa!.winner).toBeDefined();
    const rec = nat.tournaments.at(-1)!;
    expect(rec.year).toBe(2019);
    expect(rec.called).toBe(false);
    expect(rec.champion).not.toBe('');
    expect(nat.fixtures.filter((m) => m.key.startsWith(`t:${rec.id}:`))).toEqual([]);
    expect(g.inbox!.items.some((x) => x.key === `natcup:${rec.id}`)).toBe(true);
    expect(g.lastSeasonSummary!.nat!.called).toBe(false);
  }, 120_000);
});

describe('컵 소식 실제 날짜 (C.81l): 내 팀 없는 단계가 끝나는 그 날짜에 계산·인박스', () => {
  it('유망주 한 시즌: FA컵·챔스 남은 경기(결승 포함)가 그 날짜에 뉴스로, 시즌 끝은 마지막 컵 날짜 뒤', () => {
    const g = prospect('c81l-cups');
    g.player.age = 16;
    const finalDate = (() => { toClubEnd(g); return g.calendar.date; })();
    const cups = g.cups!;
    const fa = cups.fa!;
    const u = cups.ucl!;
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    const me = g.player.teamId;
    const news = g.inbox!.items.filter((x) => x.cat === 'cup');
    expect(news.length).toBeGreaterThan(0);
    // FA컵: 내 팀이 없는 단계마다 그 단계 날짜에 하나씩, 결승은 우승 제목
    fa.rounds.forEach((round, s) => {
      const n = news.find((x) => x.key === `cupnews:fa:${g.league.season}:${s}`);
      if (round.some((t) => t.h === me || t.a === me)) expect(n).toBeUndefined();
      else {
        expect(n, `FA컵 ${s} 단계 소식`).toBeDefined();
        expect(n!.date).toBe(fa.dates[s]);
        if (round.length === 1) expect(n!.title).toContain('우승');
      }
    });
    expect(fa.winner).toBeDefined();
    // 챔스: 조별 끝 → 16강 진출 · 녹아웃 차전별 · 결승 (내 팀이 없을 때). 결승 날짜 = 리그 최종 + finalAfter
    expect(u.winner).toBeDefined();
    const final = u.ko[3]!.l1[0]!;
    const fn = news.find((x) => x.key === `cupnews:ucl:${g.league.season}:3:0`);
    if (final.h !== me && final.a !== me) {
      expect(fn).toBeDefined();
      expect(fn!.date).toBe(final.d);
      expect(fn!.title).toContain('우승');
      expect(daysBetween(finalDate, final.d!)).toBeGreaterThanOrEqual(0);
    }
    if (!u.groups.some((gr) => gr.includes(me))) expect(news.some((x) => x.key === `cupnews:ucl:${g.league.season}:groups`)).toBe(true);
    for (let s = 0; s < 3; s++) for (let k = 0; k < 2; k++) {
      const ties = k === 0 ? u.ko[s]!.l1 : u.ko[s]!.l2;
      const n = news.find((x) => x.key === `cupnews:ucl:${g.league.season}:${s}:${k}`);
      if (ties.some((t) => t.h === me || t.a === me)) expect(n).toBeUndefined();
      else {
        expect(n).toBeDefined();
        expect(ties.every((t) => daysBetween(t.d!, n!.date) >= 0)).toBe(true);
        expect(ties.some((t) => t.d === n!.date)).toBe(true);
      }
    }
    // 시즌 끝 = 마지막 컵 경기 날 (하루 끝에 결과 → 시즌 끝 처리)
    const lastCupDate = [fa.dates.at(-1)!, final.d!].sort()[1]!;
    expect(g.phase).toBe('offseason');
    expect(g.calendar.date).toBe(addDays(lastCupDate, 1));
    expect(cupsPending(g)).toBe(false);
  }, 120_000);
});

describe('안전망', () => {
  it('myNationAlive: 조별이면 모두, 녹아웃은 지금 단계에 남은 팀만, 우승이 정해지면 거짓', () => {
    const g = son();
    const live = drawTournament(g, 'asian', 2019, '2019-05-12', true);
    expect(live.qualified).toBe(true);
    expect(myNationAlive(g, live)).toBe(true);
    const done = advanceTournament(g, live, null, () => ({ gf: 0, ga: 3 }));
    expect(done.done).toBe(true);
    expect(myNationAlive(g, live, done)).toBe(false);
    expect(tournamentRecord(g, live, done).reach).toBe('조별 탈락');
  });
});
