import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, seasonCalendar, weekday } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { createLeague } from '../src/league';
import {
  calendarOf, dayPlan, endDay, isMatchDay, newGame, otherJob, playOthers, playRound, SAVE_FORMAT_VERSION, todaysOthers,
} from '../src/game';
import { playNpcMatch, summarize } from '../src/engine/npcMatch';
import { createMatch, frameOf } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { runJob } from '../src/engine/jobs';
import { playMyMatch } from '../src/engine/adapter';
import { roundMatch } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { planFatigue } from '../src/training';

describe('일정 생성 (25.1~25.2 6번, 부록 C.38)', () => {
  it('2018-19 패턴: 38라운드, 8월 둘째 주 개막·5월 중순 일요일 종료, 주중 4~5회, 박싱데이, A매치 휴식기, 팀마다 2일 이상 휴식', () => {
    for (let season = 2018; season <= 2040; season++) {
      for (const seed of ['a', 'b', 'c']) {
        const lg = createLeague(seed, season);
        const cal = seasonCalendar(seed, season, lg.schedule);
        expect(cal.roundDates).toHaveLength(38);
        const open = cal.opening;
        expect(+open.slice(5, 7)).toBe(8);
        expect(+open.slice(8, 10)).toBeGreaterThanOrEqual(7);
        expect(+open.slice(8, 10)).toBeLessThanOrEqual(14);
        expect(cal.final.slice(5, 7)).toBe('05');
        expect(weekday(cal.final)).toBe(0);
        expect(cal.fixtureDates[37]!.every((d) => d === cal.final)).toBe(true);
        const boxing = cal.fixtureDates.findIndex((ds) => ds.every((d) => d.endsWith('12-26')));
        expect(boxing).toBeGreaterThan(15);
        expect(cal.fixtureDates[boxing + 1]!.every((d) => daysBetween(`${season}-12-26`, d) <= 7)).toBe(true);
        // 주중 라운드 (화·수, 박싱데이·새해 제외)
        const midweek = cal.fixtureDates.filter((ds, r) => r !== boxing && r !== boxing + 1 && r !== boxing + 2
          && ds.every((d) => [2, 3].includes(weekday(d)) && !d.endsWith('-01-01') && !d.endsWith('-01-02'))).length;
        expect(midweek).toBeGreaterThanOrEqual(4);
        expect(midweek).toBeLessThanOrEqual(5);
        expect(cal.breaks.filter((b) => b.kind === 'international')).toHaveLength(4);
        // 라운드 순서와 팀별 휴식
        const last: Record<string, string> = {};
        cal.fixtureDates.forEach((ds, r) => {
          if (r > 0) expect(daysBetween(cal.fixtureDates[r - 1]!.reduce((a, b) => (b > a ? b : a)), ds.reduce((a, b) => (b < a ? b : a)))).toBeGreaterThan(0);
          ds.forEach((d, i) => {
            const f = lg.schedule[r]![i]!;
            for (const t of [f.home, f.away]) {
              if (last[t]) expect(daysBetween(last[t]!, d)).toBeGreaterThanOrEqual(2);
              last[t] = d;
            }
          });
        });
      }
    }
  });

  it('같은 시드면 같은 날짜 (세이브에 담지 않고 다시 만든다)', () => {
    const a = createLeague('same', 2019);
    const b = createLeague('same', 2019);
    expect(seasonCalendar('same', 2019, a.schedule)).toEqual(seasonCalendar('same', 2019, b.schedule));
  });
});

describe('하루 단위 진행 (25.1~25.2 5·7번)', () => {
  it('피로는 하루마다 그날 훈련 계획만큼 회복한다 (C.41: 기본 계획 회복 5.5 / 휴식 6 / 기술 3.5 / 영상 4.5)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'day-fat', difficulty: 'normal' });
    playRound(g);
    // 경기 날까지 넘기지 않고 하루씩
    g.player.fatigue = 50;
    let expected = 50;
    let days = 0;
    while (!isMatchDay(g) && days < 7) {
      expected = Math.max(0, expected - planFatigue(dayPlan(g)));
      playOthers(g, 'quick');
      endDay(g);
      days++;
    }
    expect(g.player.fatigue).toBeCloseTo(expected, 6);
    expect(days).toBeGreaterThan(0);
  });

  it('경기 날에는 하루를 넘길 수 없고, 다른 경기가 남아도 넘길 수 없다', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'day-guard', difficulty: 'normal' });
    while (!isMatchDay(g)) {
      playOthers(g, 'quick');
      endDay(g);
    }
    expect(() => endDay(g)).toThrow();
  });

  it('시즌 내내 하루씩: 모든 경기가 그 날짜에 치러지고 시즌이 끝난다', () => {
    const g = newGame({ mode: 'prospect', position: 'CB', seed: 'day-season', difficulty: 'normal' });
    const cal = calendarOf(g);
    let n = 0;
    while (g.phase === 'season') {
      // C.67a: 컵 경기도 playRound 한 번 (리그 경기만 센다)
      if (!playRound(g, { engine: 'quick' }).cup) n++;
    }
    expect(n).toBe(38);
    // 컵 결승에 올랐으면 결승 날에 끝난다
    expect(g.calendar.date).toBe(g.cups!.fa!.rounds[4]!.some((t) => t.h === g.player.teamId || t.a === g.player.teamId) ? g.cups!.fa!.dates[4] : cal.final);
    expect(g.league.schedule.flat().every((f) => f.homeGoals !== undefined)).toBe(true);
    expect(g.league.table.every((r) => r.played === 38)).toBe(true);
  });
});

describe('전 경기 엔진 (25.1~25.2 4번)', () => {
  it('다른 경기는 같은 입력이면 같은 결과이고, 위치 프레임을 기록해도 결과가 같다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'npc-det', difficulty: 'normal' });
    const [r, i] = todaysOthers(g)[0] ?? [0, 1];
    const job = otherJob(g, r, i);
    const a = playNpcMatch(job.input);
    const b = runJob({ kind: 'npc', input: structuredClone(job.input) });
    expect(b).toEqual(a);
    // 프레임을 매 틱 기록하며 돌린다
    const m = job.input;
    const sim = createMatch({
      home: teamSetupFromRoster(m.home, m.homeRating, m.awayRating, m.worldSeed, undefined, m.leagueAvg),
      away: teamSetupFromRoster(m.away, m.awayRating, m.homeRating, m.worldSeed, undefined, m.leagueAvg),
      mode: 'auto', difficulty: 'normal', seed: m.seed, bigMatch: false,
    });
    const frames = [];
    while (!sim.state.done) {
      sim.step();
      frames.push(frameOf(sim.state));
    }
    expect(frames.length).toBeGreaterThan(1000);
    const res = summarize(sim.runToEnd());
    expect(res).toEqual(a);
    expect(a.goals.length).toBe(a.hg + a.ag);
    expect(a.players.length).toBeGreaterThanOrEqual(22);
  }, 30_000);

  it('워커 작업(내 경기)과 메인 스레드 계산이 같다', () => {
    const g = newGame({ mode: 'real', playerId: 'kane', seed: 'my-worker', difficulty: 'normal' });
    while (!isMatchDay(g)) {
      playOthers(g, 'quick');
      endDay(g);
    }
    const rm = roundMatch(g);
    const a = playMyMatch(rm.input);
    const b = runJob({ kind: 'my', input: structuredClone(rm.input) }) as typeof a;
    expect(b.result).toEqual(a.result);
    expect(b.engine.events).toEqual(a.engine.events);
  }, 30_000);

  it('엔진으로 계산한 다른 경기는 스코어·득점자·도움과 선수 시즌 합계를 남긴다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'npc-rec', difficulty: 'normal' });
    playRound(g, { others: 'engine' });
    const played = g.league.schedule.flat().filter((f) => f.homeGoals !== undefined);
    expect(played.length).toBeGreaterThan(1);
    for (const f of played) expect((f.g ?? []).length).toBe(f.homeGoals! + f.awayGoals!);
    const totals = Object.values(g.playerStats);
    expect(totals.length).toBeGreaterThan(22 * (played.length - 1));
    const goals = totals.reduce((t, x) => t + x[1], 0);
    const scored = played.reduce((t, f) => t + f.homeGoals! + f.awayGoals!, 0);
    // 내 선수 골은 player.season 에 따로
    expect(goals + g.player.season.goals).toBe(scored);
  }, 60_000);
});

describe('세이브 17 → 18 (부록 C.38)', () => {
  it('라운드 기반 세이브: 이번 라운드 첫 경기 날로, 부상 주 → 일, 선수 기록·설정 추가', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'mig18', difficulty: 'normal' });
    for (let k = 0; k < 5; k++) playRound(g, { engine: 'quick' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 17;
    delete raw.calendar;
    delete raw.playerStats;
    delete raw.options;
    // 옛 라운드 방식: 이번 라운드의 다른 경기는 아직 없다
    for (const f of raw.league.schedule[raw.league.round]) { delete f.homeGoals; delete f.awayGoals; }
    raw.player.injury = { grade: 'minor', weeksTotal: 3, weeksLeft: 2, season: 2018, round: 5, permanent: {} };
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(SAVE_FORMAT_VERSION).toBe(37);
    const cal = calendarOf(back);
    expect(back.calendar.date).toBe(cal.roundDates[back.league.round]);
    expect(back.player.injury).toMatchObject({ daysLeft: 14, daysTotal: 21 });
    expect(back.playerStats).toEqual({});
    expect(back.options).toEqual({ quickOthers: false });
    // 이어서 진행할 수 있다
    playRound(back, { engine: 'quick' });
    expect(back.league.round).toBe(6);
    expect(daysBetween(cal.roundDates[5]!, back.calendar.date)).toBeGreaterThan(0);
    expect(addDays(back.calendar.date, 0)).toBe(back.calendar.date);
  });
});
