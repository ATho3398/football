// 15단계 (부록 C.25): 위상 하락 규칙. 부진 연속 감점, 순위 감점, 31세부터 시즌 상한 축소, 세이브 변환 9 → 10
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import {
  endSeason, newGame, playRound, rankPenalty, ratingRank, SAVE_FORMAT_VERSION, seasonGainCap, slumpPenalty, slumpThreshold,
} from '../src/game';
import { leaguePosition } from '../src/league';
import { deserialize, serialize } from '../src/save';
import type { SeasonRecord } from '../src/types';
import { matchResultVM, homeVM, seasonVM } from '../src/ui/viewModels';

const S = BALANCE.reputation.slump;

function record(apps: number, avg: number): SeasonRecord {
  return {
    apps, starts: apps, minutes: apps * 90, goals: 0, assists: 0, ratingSum: apps * avg, matchXp: 0, moms: 0, injuries: 0, injuredWeeks: 0,
    yellows: 0, reds: 0, season: 2018, age: 20, teamId: 'x', leaguePosition: 10, achievementXp: 0, ovr: 60, reputation: 0,
  };
}

describe('부진 감점 (부록 C.25)', () => {
  it('기준 평점 = 가장 최근 10경기 이상 뛴 시즌의 내 평균 − 0.5. 그런 시즌이 없으면 6.0', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'slump-thr', difficulty: 'normal' });
    expect(slumpThreshold(g.player)).toBeCloseTo(S.fallbackAvg - S.belowAvg);
    g.player.history.push(record(20, 7.2));
    expect(slumpThreshold(g.player)).toBeCloseTo(6.7);
    g.player.history.push(record(S.minApps - 1, 9)); // 출전이 적은 시즌은 건너뛴다
    expect(slumpThreshold(g.player)).toBeCloseTo(6.7);
  });

  it('연속 2번째부터 위상 × 0.2% × (연속 − 1), 최대 1%', () => {
    expect(slumpPenalty(500, 1)).toBe(0);
    expect(slumpPenalty(500, 2)).toBe(1);
    expect(slumpPenalty(500, 3)).toBe(2);
    expect(slumpPenalty(500, 6)).toBe(5);
    expect(slumpPenalty(500, 20)).toBe(5); // 상한 1%
    expect(slumpPenalty(900, 2)).toBe(2);
    expect(slumpPenalty(100, 2)).toBe(0); // 위상이 낮으면 반올림해서 0
  });

  it('경기마다 바로 깎이고, 기준 이상이면 연속이 끊긴다. 경기 후·홈 화면에 한 줄', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'slump-play', difficulty: 'normal' });
    g.player.history.push(record(30, 20)); // 기준 19.5: 모든 경기가 미만
    g.player.reputation = 800;
    let hits = 0;
    let lastStreak = 0;
    for (let i = 0; i < 12; i++) {
      const before = g.player.reputation;
      const r = playRound(g, { engine: 'quick' });
      if (r.result.minutes === 0) continue;
      if (r.slump) {
        hits++;
        expect(r.slump.streak).toBe(lastStreak + 1);
        expect(g.player.reputation).toBe(before - r.slump.points);
        expect(r.slump.points).toBe(slumpPenalty(before, r.slump.streak));
        const title = `위상 −${r.slump.points} (부진 ${r.slump.streak}경기 연속)`;
        expect(matchResultVM(g, null)!.banners.some((b) => b.title === title)).toBe(true);
        expect(homeVM(g).banners.some((b) => b.title === title)).toBe(true);
      }
      lastStreak = g.player.slumpStreak;
    }
    expect(hits).toBeGreaterThan(0);
    expect(g.player.season.slumpPenalty).toBe(800 - g.player.reputation);

    // 기준을 아주 낮추면 다음 출전에서 연속이 끊긴다
    g.player.history.push(record(30, 0.4));
    for (let i = 0; i < 6 && g.player.slumpStreak > 0; i++) {
      const before = g.player.reputation;
      const r = playRound(g, { engine: 'quick' });
      if (r.result.minutes > 0) {
        expect(r.slump).toBeUndefined();
        expect(g.player.reputation).toBe(before);
      }
    }
    expect(g.player.slumpStreak).toBe(0);
  });
});

describe('순위 감점과 시즌 상한 (부록 C.25)', () => {
  it('예상 순위보다 낮게 마친 계단마다 위상 × 0.5%, 최대 3%. 같거나 높으면 0', () => {
    expect(rankPenalty(600, 10, 8)).toBe(6);
    expect(rankPenalty(600, 20, 8)).toBe(18);
    expect(rankPenalty(600, 8, 8)).toBe(0);
    expect(rankPenalty(600, 3, 8)).toBe(0);
  });

  it('시즌 증가 상한: 29세까지 140, 30세부터 40 (부록 C.27, C.25는 31세부터)', () => {
    expect(seasonGainCap(29)).toBe(140);
    expect(seasonGainCap(30)).toBe(40);
    expect(seasonGainCap(31)).toBe(40);
  });

  it('시즌 끝: 시즌 시작 위상은 부진 감점 전 값, 순위 감점은 위상 내역에 한 줄', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'rank-pen', difficulty: 'normal' });
    while (g.league.round < g.league.schedule.length - 1) playRound(g, { engine: 'quick' });
    g.player.reputation = 700;
    g.player.season.slumpPenalty = 12;
    g.player.season.minutes = g.league.schedule.length * 90; // 출전 시간 부족 감점(부록 C.27)은 빼고 본다
    // 순위 감점이 생기도록 시즌 전 예상 순위를 1위로 만든다
    const me = g.league.teams.find((t) => t.id === g.player.teamId)!;
    me.rating = 999;
    const pos = leaguePosition(g.league, g.player.teamId);
    const sum = endSeason(g);
    expect(sum.reputationBefore).toBe(712);
    expect(ratingRank(g.league, g.player.teamId)).toBe(1);
    expect(sum.rankPenalty).toEqual({ expected: 1, pos, points: pos > 1 ? rankPenalty(sum.reputationAfter + sum.rankPenalty!.points, pos, 1) : 0, blocked: 0 });
    const vm = seasonVM(g)!;
    expect(vm.slumpPenalty).toBe(12);
    if (pos > 1) expect(vm.rankPenalty).toEqual(sum.rankPenalty);
    expect(vm.repLines[0]).toEqual({ label: '시즌 중 부진 감점', points: 12, note: '' });
  });
});

describe('세이브 변환 9 → 10 (부록 C.25)', () => {
  it('부진 연속 0, 시즌 부진 감점 0에서 시작', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig10', difficulty: 'normal' });
    for (let i = 0; i < 3; i++) playRound(s, { engine: 'quick' });
    const old = JSON.parse(serialize(s));
    old.saveFormat = 9;
    delete old.player.slumpStreak;
    delete old.player.season.slumpPenalty;
    const loaded = deserialize(JSON.stringify(old));
    expect(SAVE_FORMAT_VERSION).toBe(27);
    expect(loaded.saveFormat).toBe(27);
    expect(loaded.player.slumpStreak).toBe(0);
    expect(loaded.player.season.slumpPenalty).toBe(0);
  });
});
