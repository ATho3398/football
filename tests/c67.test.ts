// C.67a (39단계 5-6 a): 대회 틀 · FA컵(32팀 단판, 승부차기 간이 판정) · 일정 편입(컵 주말, 팀마다 경기 사이 2일 이상) ·
// 내 팀 없는 경기 레이팅 간이 계산 · 내 컵 경기 전 엔진 · 결승이 남으면 시즌 끝 미룸 · 휴가 예외 · 가족 휴가 결장 · 세이브 36 이식
import { describe, expect, it } from 'vitest';
import { daysBetween, weekday } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { compTeams, faDates, reachLabel, stageName, teamReach } from '../src/cups';
import { applyEffects } from '../src/events';
import {
  calendarOf, dayPlan, endDay, isMatchDay, isVacationDay, myMatchDates, newGame, nextFixture, playOthers, playRound, roundMatch, SAVE_FORMAT_VERSION,
  startNextSeason, type GameState,
} from '../src/game';
import { deserialize, serialize } from '../src/save';
import { autoSheetVM, homeVM, matchResultVM } from '../src/ui/viewModels';

const real = (seed: string): GameState => newGame({ mode: 'real', playerId: 'salah', seed, difficulty: 'normal' });

/** 다음 내 경기 날까지 (그날 다른 경기도 계산) */
function toMatchDay(g: GameState): void {
  while (!isMatchDay(g)) {
    playOthers(g, 'quick');
    endDay(g);
  }
}

describe('FA컵 틀과 일정', () => {
  it('32팀 = 리그 20 + 하부 12, 32강 16경기 추첨, 내 팀 포함, 같은 시드면 같은 대진', () => {
    const g = real('c67-a');
    const fa = g.cups!.fa!;
    expect(compTeams(fa)).toHaveLength(32);
    expect(new Set(compTeams(fa)).size).toBe(32);
    expect(fa.rounds[0]).toHaveLength(16);
    expect(fa.rounds[0]!.some((t) => t.h === g.player.teamId || t.a === g.player.teamId)).toBe(true);
    expect(real('c67-a').cups).toEqual(g.cups);
    expect(stageName(fa, 0)).toBe('32강');
    expect(stageName(fa, 4)).toBe('결승');
  });

  it('날짜: 32강 1월 초 · 16강 1월 말 · 8강 3월 · 4강 4월 · 결승 = 최종 라운드 다음 주 토, 리그 경기와 2일 이상 (추첨 때 남은 팀 기준 3일로 다시 잡음)', () => {
    for (const seed of ['c67-d1', 'c67-d2', 'c67-d3', 'c67-d4']) {
      const g = real(seed);
      const ds = faDates(g);
      expect(ds).toHaveLength(5);
      expect(ds.map((d) => +d.slice(5, 7))).toEqual([1, 1, 3, 4, 5]);
      for (let i = 1; i < ds.length; i++) expect(daysBetween(ds[i - 1]!, ds[i]!)).toBeGreaterThanOrEqual(BALANCE.cups.minGap);
      expect(weekday(ds[4]!)).toBe(6);
      expect(daysBetween(calendarOf(g).final, ds[4]!)).toBe(BALANCE.cups.fa.finalAfter);
      const league = calendarOf(g).fixtureDates.flat();
      for (const d of ds.slice(0, 4)) for (const l of league) expect(Math.abs(daysBetween(d, l))).toBeGreaterThanOrEqual(BALANCE.cups.minGapLoose);
      // 32강(리그 전 팀 출전)은 컵 주말이라 3일
      for (const l of league) expect(Math.abs(daysBetween(ds[0]!, l))).toBeGreaterThanOrEqual(BALANCE.cups.minGap);
    }
  });
});

describe('한 시즌 진행', () => {
  it('내 컵 경기는 전 엔진으로 치르고, 다른 경기는 간이 계산 · 우승 팀이 정해지고 기록이 남는다 · 새 간격 3일 미만 없음', () => {
    const g = real('c67-s');
    const cups: string[] = [];
    while (g.phase === 'season') {
      const r = playRound(g, { engine: 'quick' });
      if (r.cup?.comp === 'fa') cups.push(r.cup.stage);
    }
    const fa = g.cups!.fa!;
    expect(cups[0]).toBe('32강');
    expect(fa.winner).toBeTruthy();
    expect(fa.rounds.map((r) => r.length)).toEqual([16, 8, 4, 2, 1]);
    // 모든 경기에 승자, 무승부는 승부차기
    for (const r of fa.rounds) for (const t of r) {
      expect(t.w).toBeTruthy();
      if (t.hg === t.ag) expect(t.p![0]).not.toBe(t.p![1]);
    }
    // 내 팀 없는 경기는 득점자 기록
    const others = fa.rounds.flat().filter((t) => t.h !== g.player.teamId && t.a !== g.player.teamId && (t.hg ?? 0) + (t.ag ?? 0) > 0);
    expect(others.every((t) => (t.g?.length ?? 0) === t.hg! + t.ag!)).toBe(true);
    expect(cups.length).toBe(teamReach(fa, g.player.teamId) >= fa.rounds.length ? 5 : teamReach(fa, g.player.teamId) + 1);
    // 남은 팀의 리그 경기와 3일 이상 (추첨 때 다시 잡은 날짜)
    const cal = calendarOf(g);
    fa.rounds.slice(0, 4).forEach((r, st) => {
      const ids = new Set(r.flatMap((t) => [t.h, t.a]));
      g.league.schedule.forEach((round, ri) => round.forEach((f, i) => {
        if (ids.has(f.home) || ids.has(f.away)) expect(Math.abs(daysBetween(fa.dates[st]!, cal.fixtureDates[ri]![i]!))).toBeGreaterThanOrEqual(BALANCE.cups.minGap);
      }));
    });
    // 컵 기록은 리그 기록과 따로
    expect(g.player.season.apps).toBeLessThanOrEqual(38);
    startNextSeason(g);
    expect(g.archive.at(-1)!.cups!.fa![0]).toBe(fa.winner);
    expect(g.archive.at(-1)!.cups!.fa![1]).toBe(reachLabel(fa, g.archive.at(-1)!.teamId));
    expect(g.cups!.season).toBe(g.league.season);
    expect(g.cups!.fa!.rounds).toHaveLength(1);
  });

  it('결승에 오르면 리그가 끝나도 시즌이 이어지고 결승 날 뒤에 끝난다', () => {
    let found = false;
    for (const seed of ['c67-f1', 'c67-f2', 'c67-f3', 'c67-f4', 'c67-f5', 'c67-f6', 'c67-f7', 'c67-f8']) {
      const g = real(seed);
      while (g.phase === 'season') playRound(g, { engine: 'quick' });
      const fa = g.cups!.fa!;
      const final = fa.rounds[4]![0]!;
      // 챔스 경기가 리그 뒤에 남은 시즌(C.67b)은 날짜가 달라 뺀다
      const late = g.cups!.ucl?.ko.some((st) => [...st.l1, ...st.l2].some((t) => (t.h === g.player.teamId || t.a === g.player.teamId) && t.d! > calendarOf(g).final));
      if (late || (final.h !== g.player.teamId && final.a !== g.player.teamId)) continue;
      found = true;
      expect(g.calendar.date).toBe(fa.dates[4]);
      expect(g.lastMatch!.cup!.stage).toBe('결승');
      break;
    }
    expect(found).toBe(true);
  });

  it('같은 시드면 같은 컵 결과 (결정성)', () => {
    const run = () => {
      const g = real('c67-det');
      while (g.phase === 'season') playRound(g, { engine: 'quick' });
      return JSON.stringify(g.cups);
    };
    expect(run()).toBe(run());
  });
});

describe('내 컵 경기 (화면 연결)', () => {
  it('32강 날: 다음 경기가 컵 · 홈·준비 대회 이름 · 리그 밖 상대 로스터 · 경기 결과 배너', () => {
    const g = real('c67-ui');
    // 32강 날까지
    while (nextFixture(g)?.cup?.comp !== 'fa' || !isMatchDay(g)) {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
    }
    const fx = nextFixture(g)!;
    expect(fx.cup!.stage).toBe('32강');
    expect(homeVM(g).comp).toBe('FA컵 32강');
    expect(dayPlan(g)).toBe('match');
    expect(isVacationDay(g, g.calendar.date)).toBe(false);
    const rm = roundMatch(g);
    expect(rm.input.oppRoster.players.length).toBeGreaterThanOrEqual(18);
    const before = g.league.round;
    const rep = playRound(g);
    expect(g.league.round).toBe(before);
    expect(rep.cup!.stage).toBe('32강');
    const vm = matchResultVM(g, null)!;
    expect(vm.comp).toBe('FA컵 32강');
    // C.76j (디자인 214): 컵 결과는 일반 배너가 아니라 대회 배너 하나
    expect(vm.cupBanner!.kicker).toContain('FA컵');
    expect(vm.banners.some((b) => b.title.includes('FA컵'))).toBe(false);
    // 다음 날 휴식 고정 (경기 다음 날 규칙이 컵 경기에도)
    expect(dayPlan(g)).toBe('rest');
    expect(myMatchDates(g)).toContain(g.cups!.fa!.dates[0]);
  });

  it('자동 진행 시트: FA컵 대상이 열리고 32강 직전까지 멈출 수 있다', () => {
    const g = real('c67-auto');
    const vm = autoSheetVM(g);
    const cup = vm.targets.find((t) => t.id === 'cup')!;
    expect(cup.available).toBe(true);
    expect(cup.next!.text).toContain('FA컵 32강');
    expect(cup.next!.iso).toBe(g.cups!.fa!.dates[0]);
    // 리그 38 + FA컵 32강 1 + 챔스 조별 6 (C.67b)
    expect(vm.remaining).toBe(39 + 6);
    expect(cup.next!.before).toBe(myMatchDates(g).filter((d) => d < g.cups!.fa!.dates[0]!).length);
  });
});

describe('가족 휴가 결장 (pending 102 ⑨)', () => {
  it('"가족 곁으로" = 휴가 일수 동안 훈련 대신 휴가, 그 기간 경기 결장', () => {
    const g = real('c67-leave');
    toMatchDay(g);
    playRound(g, { engine: 'quick' });
    toMatchDay(g);
    // 경기 전날로 돌아갈 수 없으니 경기 날 아침에 휴가를 받는다
    const out = applyEffects(g, [{ leave: true }], 'test');
    expect(out.join(' ')).toContain('경기 결장');
    expect(roundMatch(g).plan.minutes).toBeNull();
    const rep = playRound(g, { engine: 'quick' });
    expect(rep.leave).toBe(true);
    expect(rep.result.minutes).toBe(0);
    expect(g.matchLog.at(-1)!.absent).toBe('leave');
    // 다음 날은 휴가 (경기 다음 날 휴식보다 앞)
    expect(dayPlan(g)).toBe('vacation');
    // 휴가가 끝나면 다시 훈련
    for (let k = 0; k < BALANCE.events.familyLeaveDays + 1 && !isMatchDay(g); k++) { playOthers(g, 'quick'); endDay(g); }
    if (!isMatchDay(g)) expect(dayPlan(g)).not.toBe('vacation');
  });
});

describe('세이브 36', () => {
  it('왕복 그대로 · 옛 세이브(35)는 컵 없이 불러와 32강 전이면 다음 하루 진행 때 만든다', () => {
    const g = real('c67-save');
    expect(SAVE_FORMAT_VERSION).toBe(57);
    expect(deserialize(serialize(g)).cups).toEqual(g.cups);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 35;
    delete raw.cups;
    const old = deserialize(JSON.stringify(raw));
    expect(old.cups).toBeUndefined();
    playOthers(old, 'quick');
    if (!isMatchDay(old)) endDay(old);
    else playRound(old, { engine: 'quick' });
    expect(old.cups!.fa!.rounds[0]).toHaveLength(16);
  });

  it('32강 날짜가 지난 옛 세이브는 이번 시즌 컵 없음, 다음 시즌부터', () => {
    const g = real('c67-late');
    while (g.calendar.date < '2019-01-10') {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
    }
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 35;
    delete raw.cups;
    const old = deserialize(JSON.stringify(raw));
    if (isMatchDay(old)) playRound(old, { engine: 'quick' });
    else { playOthers(old, 'quick'); endDay(old); }
    expect(old.cups!.fa).toBeNull();
    expect(nextFixture(old)!.cup).toBeUndefined();
    while (old.phase === 'season') playRound(old, { engine: 'quick' });
    startNextSeason(old);
    expect(old.cups!.fa).not.toBeNull();
  });
});
