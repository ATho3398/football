// 17단계 (부록 C.27): 위상 티어 하한, 레드카드·출전 시간 부족 감점, 화면 문구
import { ensureEvents } from '../src/events';
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import {
  deductReputation, endSeason, minutesShortPenalty, newGame, playRound, redCardPenalty, SAVE_FORMAT_VERSION, slumpPenalty,
  type GameState,
} from '../src/game';
import { reputationFloor, reputationFloorTier } from '../src/growth';
import type { SeasonRecord } from '../src/types';
import { homeVM, matchResultVM, seasonVM } from '../src/ui/viewModels';
import { seasonView } from '../src/ui/views/screens';

function record(apps: number, avg: number): SeasonRecord {
  return {
    apps, starts: apps, minutes: apps * 90, goals: 0, assists: 0, ratingSum: apps * avg, matchXp: 0, moms: 0, injuries: 0, injuredWeeks: 0,
    yellows: 0, reds: 0, season: 2018, age: 20, teamId: 'x', leaguePosition: 10, achievementXp: 0, ovr: 60, reputation: 0,
  };
}

/** 마지막 라운드 직전까지 진행한 새 게임 */
function lastRound(seed: string): GameState {
  const g = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
  while (g.league.round < g.league.schedule.length - 1) playRound(g, { engine: 'quick' });
  return g;
}

describe('티어 하한 (부록 C.27)', () => {
  it('바닥 = 지금 티어(스페셜 250 / 탑클래스 550 / 월드클래스 900)의 컷', () => {
    expect(reputationFloor(0)).toBe(0);
    expect(reputationFloor(249)).toBe(0);
    expect(reputationFloor(250)).toBe(250);
    expect(reputationFloor(549)).toBe(250);
    expect(reputationFloor(600)).toBe(550);
    expect(reputationFloor(1000)).toBe(900);
    expect(reputationFloorTier(100)).toBeNull();
    expect(reputationFloorTier(560)).toBe('topClass');
  });

  it('감점은 바닥에서 멈추고, 막힌 만큼은 사라진다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'floor-ded', difficulty: 'normal' });
    g.player.reputation = 560;
    expect(deductReputation(g.player, 4)).toEqual({ points: 4, blocked: 0 });
    expect(deductReputation(g.player, 20)).toEqual({ points: 6, blocked: 14 });
    expect(g.player.reputation).toBe(550);
    expect(deductReputation(g.player, 5)).toEqual({ points: 0, blocked: 5 });
    expect(g.player.reputation).toBe(550);
    g.player.reputation = 100; // 스페셜 미만은 0까지
    expect(deductReputation(g.player, 30)).toEqual({ points: 30, blocked: 0 });
  });

  it('부진 감점이 바닥에 막히면 "위상 −n (○○ 티어 유지)", 배너 문구는 기준 평점과 연속 수', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'floor-slump', difficulty: 'normal' });
    g.player.history.push(record(30, 20)); // 기준 19.5: 모든 출전 경기가 미만
    g.player.reputation = 556;
    // 이벤트(C.63)의 위상 효과를 빼고 부진 감점만 잰다
    ensureEvents(g).off = true;
    let blockedSeen = false;
    for (let i = 0; i < 16; i++) {
      const before = g.player.reputation;
      const r = playRound(g, { engine: 'quick' });
      expect(g.player.reputation).toBeGreaterThanOrEqual(550);
      if (!r.slump) continue;
      const want = slumpPenalty(before, r.slump.streak);
      expect(r.slump.points + (r.slump.blocked ?? 0)).toBe(want);
      expect(r.slump.threshold).toBeCloseTo(19.5);
      const title = r.slump.blocked ? `위상 −${r.slump.points} (탑클래스 티어 유지)` : `위상 −${r.slump.points} (부진 ${r.slump.streak}경기 연속)`;
      const body = `최근 경기력이 평소보다 떨어졌어요(평점 19.5 미만 ${r.slump.streak}경기 연속). 다음 경기에서 19.5 이상이면 멈춰요.`;
      expect(matchResultVM(g, null)!.banners.some((b) => b.title === title && b.body === body)).toBe(true);
      expect(homeVM(g).banners.some((b) => b.title === title)).toBe(true);
      if (r.slump.blocked) blockedSeen = true;
    }
    expect(blockedSeen).toBe(true);
    expect(g.player.reputation).toBe(550);
    expect(g.player.season.slumpPenalty).toBe(6);
    expect(g.player.season.slumpBlocked).toBeGreaterThan(0);
  });
});

describe('레드카드·출전 시간 부족 감점 (부록 C.27)', () => {
  it('레드카드: 퇴장 1회당 위상의 1%, 최대 3%', () => {
    expect(redCardPenalty(600, 0)).toBe(0);
    expect(redCardPenalty(600, 1)).toBe(6);
    expect(redCardPenalty(600, 2)).toBe(12);
    expect(redCardPenalty(600, 5)).toBe(18);
  });

  it('출전 시간 부족: 50% 미만이면 모자란 10%p마다(조금이라도 모자라면 1계단) 1%, 최대 4%', () => {
    expect(minutesShortPenalty(600, 0.5)).toBe(0);
    expect(minutesShortPenalty(600, 0.8)).toBe(0);
    expect(minutesShortPenalty(600, 0.49)).toBe(6);
    expect(minutesShortPenalty(600, 0.4)).toBe(6);
    expect(minutesShortPenalty(600, 0.39)).toBe(12);
    expect(minutesShortPenalty(600, 0.25)).toBe(18);
    expect(minutesShortPenalty(600, 0.1)).toBe(24);
    expect(minutesShortPenalty(600, 0)).toBe(24);
  });

  it('시즌 끝: 레드·출전 부족 감점 줄, 바닥에 막히면 (○○ 티어 유지)', () => {
    const g = lastRound('floor-season');
    g.player.reputation = 900;
    g.player.age = 25;
    g.player.season.reds = 2;
    g.player.season.minutes = 0;
    const sum = endSeason(g);
    expect(sum.reputationAfter).toBeGreaterThanOrEqual(900);
    expect(sum.redPenalty!.reds).toBe(2);
    expect(sum.minutesPenalty!.share).toBe(0);
    const base = sum.reputationAfter + sum.rankPenalty!.points + sum.redPenalty!.points + sum.minutesPenalty!.points;
    expect(sum.redPenalty!.points + sum.redPenalty!.blocked).toBe(redCardPenalty(base, 2));
    expect(sum.minutesPenalty!.points + sum.minutesPenalty!.blocked).toBe(minutesShortPenalty(base, 0));
    const vm = seasonVM(g)!;
    const red = vm.repLines.find((l) => l.label === '레드카드 감점 (퇴장 2회)')!;
    const short = vm.repLines.find((l) => l.label === '출전 시간 부족 감점 (출전 0%)')!;
    expect(red.points).toBe(sum.redPenalty!.points);
    expect(short.points).toBe(sum.minutesPenalty!.points);
    // 증가가 감점보다 작으면 바닥에 막힌다
    if (sum.minutesPenalty!.blocked > 0) expect(short.note).toBe('(월드클래스 티어 유지)');
    const html = seasonView(vm, '', false, 'growth');
    expect(html).toContain('레드카드 감점 (퇴장 2회)');
    expect(html).toContain('출전 시간 부족 감점 (출전 0%)');
  });

  it('시즌 감소 2%도 바닥을 따른다 (증가 0이면 막힌 감소가 한 줄)', () => {
    const L = BALANCE.reputation.lateSeasonGainMax as { max: number };
    const keep = L.max;
    L.max = 0;
    try {
      const g = lastRound('floor-decay');
      g.player.reputation = 552;
      g.player.age = 31;
      g.player.season.minutes = g.league.schedule.length * 90;
      const sum = endSeason(g);
      expect(sum.reputationAfter).toBe(550);
      expect(sum.decayBlocked).toBe(550 - Math.round(552 * (1 - BALANCE.reputation.seasonDecay)));
      const line = seasonVM(g)!.repLines.find((l) => l.label.startsWith('시즌 감소'))!;
      expect(line).toEqual({ label: '시즌 감소 2%', points: 0, note: '(탑클래스 티어 유지)' });
    } finally {
      L.max = keep;
    }
  });
});

describe('티어 달성 (부록 C.27)', () => {
  it('처음 닿은 티어는 "○○ 달성 · 이 티어는 내려가지 않아요"', () => {
    const g = lastRound('floor-reach');
    g.player.reputation = 540;
    g.player.age = 25;
    g.player.season.moms = 30; // 개인 기록 가산 최대
    g.player.season.minutes = g.league.schedule.length * 90;
    const sum = endSeason(g);
    expect(sum.reputationAfter).toBeGreaterThanOrEqual(550);
    expect(sum.tierReached).toBe('topClass');
    const vm = seasonVM(g)!;
    expect(vm.tierReached).toBe('탑클래스');
    expect(seasonView(vm)).toContain('탑클래스 달성 · 이 티어는 내려가지 않아요');

    // 이미 있던 티어 안에서 오르면 없다
    const h = lastRound('floor-reach-2');
    h.player.reputation = 600;
    expect(endSeason(h).tierReached).toBeUndefined();
  });

  it('세이브 형식은 그대로 (티어는 점수로 판정)', () => {
    expect(SAVE_FORMAT_VERSION).toBe(58);
  });
});
