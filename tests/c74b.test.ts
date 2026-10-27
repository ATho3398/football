// C.74b (43b단계, pending 76·77-5·77-10): 원정 전날 이동일 · 부상 복귀 선택 · 기록 추적·도전 과제
import { describe, expect, it } from 'vitest';
import {
  awayOn, chooseInjuryReturn, dayPlan, endDay, isMatchDay, isTravelDay, myMatchDates, newGame, playOthers, playRound, setDayTraining,
  todaysOthers, type GameState,
} from '../src/game';
import { addDays, daysBetween } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { returnOfferDays } from '../src/injury';
import { initRecords, recordTracks, recordsAfterMatch, shownTracks, takeFreshRecords } from '../src/records';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import { injuryReturnVM, recordRowsVM, trainingOptionsVM, trainingVM } from '../src/ui/viewModels';
import { injuryReturnSheet, recordsSection } from '../src/ui/views/home';
import { trainingSheet } from '../src/ui/views/training';

const game = (seed = 'c74b'): GameState => newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });

/** 다음 날까지 (경기 날이면 경기를 치른다) */
function stepDay(g: GameState): void {
  if (isMatchDay(g)) playRound(g);
  else {
    if (todaysOthers(g).length) playOthers(g, 'quick');
    endDay(g);
  }
}

/** 전날이 이동일 후보(앞 경기 다음 날이 아님)인 원정·홈 경기 날짜 */
function eves(g: GameState): { away: string | null; home: string | null } {
  const dates = myMatchDates(g);
  let away: string | null = null;
  let home: string | null = null;
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i]!;
    if (daysBetween(dates[i - 1]!, d) < 3 || daysBetween(g.calendar.date, d) < 2) continue;
    const a = awayOn(g, d);
    if (a && !away) away = d;
    if (a === false && !home) home = d;
  }
  return { away, home };
}

describe('C.74b 원정 전날 이동일', () => {
  it('원정 전날은 영상 분석 고정 · 회복만 바꿀 수 있다, 홈 전날은 그대로', () => {
    const g = game();
    const { away, home } = eves(g);
    expect(away).not.toBeNull();
    expect(home).not.toBeNull();
    const ae = addDays(away!, -1);
    const he = addDays(home!, -1);
    expect(isTravelDay(g, ae)).toBe(true);
    expect(isTravelDay(g, he)).toBe(false);
    expect(dayPlan(g, ae)).toBe('video');
    expect(setDayTraining(g, ae, 'tech')).toBe(false);
    expect(setDayTraining(g, ae, 'intense')).toBe(false);
    expect(setDayTraining(g, ae, 'family')).toBe(false);
    expect(setDayTraining(g, ae, 'recovery')).toBe(true);
    expect(dayPlan(g, ae)).toBe('recovery');
    // 홈 전날은 기존처럼 아무 훈련이나
    expect(setDayTraining(g, he, 'tech')).toBe(true);
    expect(dayPlan(g, he)).toBe('tech');
  });

  it('이동일 시트는 영상 분석·회복 2개, 주간 칸에 이동일 표시', () => {
    const g = game();
    const ae = addDays(eves(g).away!, -1);
    const opt = trainingOptionsVM(g, ae)!;
    expect(opt.travel).toBe(true);
    expect(opt.options.map((o) => o.kind)).toEqual(['video', 'recovery']);
    const html = trainingSheet(opt, ae);
    expect(html).toContain('원정 이동일');
    // 주간 7칸은 오늘부터: 이동일까지 날을 넘긴다
    while (daysBetween(g.calendar.date, ae) > 3) stepDay(g);
    const vm = trainingVM(g)!;
    expect(vm.week.find((d) => d.date === ae)?.travel).toBe(true);
  });
});

describe('C.74b 부상 복귀 선택', () => {
  const injure = (g: GameState, days: number) => {
    g.player.injury = { grade: 'major', weeksTotal: Math.ceil(days / 7), daysTotal: days, daysLeft: days, season: g.league.season, round: 1, permanent: {} };
  };

  it('짧은 부상·시즌아웃은 선택 없음, 묻는 날 = clamp(전체 × 0.15, 4, 10)', () => {
    const R = BALANCE.injuryReturn;
    const inj = (grade: 'minor' | 'major' | 'seasonEnding', d: number) => ({ grade, weeksTotal: 1, daysTotal: d, daysLeft: d, season: 2018, round: 1, permanent: {} });
    expect(returnOfferDays(inj('minor', R.minDays - 1))).toBeNull();
    expect(returnOfferDays(inj('seasonEnding', 200))).toBeNull();
    expect(returnOfferDays(inj('minor', 14))).toBe(4);
    expect(returnOfferDays(inj('major', 60))).toBe(9);
    expect(returnOfferDays(inj('major', 112))).toBe(10);
  });

  it('회복 막바지에 묻고, 조기 복귀 = 바로 복귀 + 재부상 창, 완전 회복 = 그대로', () => {
    const g = game();
    injure(g, 30);
    g.player.injury!.daysLeft = 6;
    let guard = 0;
    while (g.player.injury?.ret !== 'ask' && guard++ < 5) stepDay(g);
    expect(g.player.injury?.ret).toBe('ask');
    expect(g.player.injury!.daysLeft).toBeLessThanOrEqual(5);
    const vm = injuryReturnVM(g)!;
    expect(injuryReturnSheet(vm)).toContain('조기 복귀');
    const h = structuredClone(g);
    expect(chooseInjuryReturn(h, 'full')).toBe(true);
    expect(h.player.injury?.ret).toBe('full');
    expect(chooseInjuryReturn(h, 'early')).toBe(false);
    expect(chooseInjuryReturn(g, 'early')).toBe(true);
    expect(g.player.injury).toBeNull();
    expect(g.player.reinjury).toEqual({ until: addDays(g.calendar.date, BALANCE.injuryReturn.reinjuryDays), mul: BALANCE.injuryReturn.reinjuryMul });
  });
});

describe('C.74b 기록 추적·도전 과제', () => {
  it('통산 이정표: 남은 수를 보이고 넘으면 한 번만 보상 (XP·위상 소량, 카드 선택권 없음)', () => {
    const g = game();
    g.records = initRecords(g);
    const t = recordTracks(g).find((x) => x.id.startsWith('cg:'))!;
    expect(t.target).toBe(BALANCE.records.goals[0]);
    expect(shownTracks(g).length).toBeLessThanOrEqual(BALANCE.records.show);
    const xp0 = g.player.totalXp;
    const rep0 = g.player.reputation;
    const picks0 = g.cards?.picks.length ?? 0;
    g.player.season.goals = 26;
    const hits = recordsAfterMatch(g);
    expect(hits.map((x) => x.id)).toEqual(expect.arrayContaining(['cg:10', 'cg:25']));
    expect(g.player.totalXp - xp0).toBe(hits.reduce((s, x) => s + x.xp, 0));
    expect(g.player.reputation - rep0).toBe(hits.reduce((s, x) => s + x.rep, 0));
    expect(g.cards?.picks.length ?? 0).toBe(picks0);
    expect(recordsAfterMatch(g)).toEqual([]);
    expect(takeFreshRecords(g).length).toBe(hits.length);
    expect(takeFreshRecords(g)).toEqual([]);
  });

  it('구단 최다 골 (지난 시즌 기록) · 리그 시즌 최다 골 · 화면 줄', () => {
    const g = game();
    g.archive = [{
      season: 2017, teamId: g.player.teamId, my: [], results: [], table: [],
      players: { npc1: [38, 20, 3, 2600], npc2: [30, 31, 1, 2100] }, names: { npc1: ['선배', g.player.teamId], npc2: ['득점왕', 'xxx'] },
    }];
    g.records = initRecords(g);
    const tr = recordTracks(g);
    const club = tr.find((x) => x.kind === 'club')!;
    expect(club.target).toBe(21);
    expect(club.holder).toBe('선배 20골');
    const lg = tr.find((x) => x.kind === 'league')!;
    expect(lg.target).toBe(32);
    const html = recordsSection(recordRowsVM(g));
    expect(html).toContain('기록 도전');
    g.player.season.goals = 21;
    const hits = recordsAfterMatch(g);
    expect(hits.some((x) => x.id === `club:${g.player.teamId}`)).toBe(true);
    expect(recordTracks(g).some((x) => x.kind === 'club')).toBe(false);
  });

  it('왕복 그대로, 옛 세이브(41)는 이어 할 수 없음', () => {
    const g = game('mig42');
    g.player.history.push({ ...g.player.season, goals: 60, assists: 12, apps: 120, season: 2017, age: 25, teamId: g.player.teamId, leaguePosition: 5, achievementXp: 0, ovr: 80, reputation: 300 });
    const back = deserialize(serialize(g));
    expect(back.saveFormat).toBe(58);
    expect(back.records).toEqual(g.records);
    expect(serialize(deserialize(serialize(back)))).toBe(serialize(back));
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 41;
    expect(() => deserialize(JSON.stringify(raw))).toThrow(SaveFormatError);
  });
});

describe('C.74b 버전', () => {
  it('버전 라벨 · 밸런스 블록', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.7[4-9]/);
    expect(STAGE_LABEL).toMatch(/^4[3-9]단계$/);
    expect(BALANCE.travelDay.allowed).toEqual(['video', 'recovery']);
  });
});
