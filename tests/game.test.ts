import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { autoAllocate, playerOvr } from '../src/growth';
import { emptySeasonStats, newGame, personalReputation, playRound, ratingRank, seasonAchievements, startNextSeason, type GameState } from '../src/game';
import { buildSchedule } from '../src/league';
import { simulateMatch, type MatchInput } from '../src/match';
import { createNpc, growNpc, npcOvr } from '../src/npc';
import { PLAYABLE_POSITIONS } from '../src/positions';
import { createRng } from '../src/rng';
import { deserialize, serialize } from '../src/save';
import { A_GRADE_PLAYERS } from '../data/players';

function playSeason(s: GameState) {
  while (s.phase === 'season') {
    playRound(s);
    autoAllocate(s.player);
  }
}

describe('경기 시뮬', () => {
  const input: MatchInput = {
    ovr: 70, position: 'ST', fatigue: 0, teamRating: 72, oppRating: 75, home: true, difficulty: 'normal',
  };

  it('같은 시드면 같은 결과', () => {
    for (let s = 0; s < 20; s++) expect(simulateMatch(input, createRng(s))).toEqual(simulateMatch(input, createRng(s)));
  });

  it('평점은 3.0~10.0, 출전하지 않으면 평점 없이 훈련 XP 만', () => {
    for (let s = 0; s < 300; s++) {
      const r = simulateMatch(input, createRng(s));
      if (r.minutes === 0) {
        expect(r).toMatchObject({ rating: null, xp: BALANCE.matchXp.bench, goals: 0, assists: 0 });
      } else {
        expect(r.rating).toBeGreaterThanOrEqual(3);
        expect(r.rating).toBeLessThanOrEqual(10);
        expect(r.goals + r.assists).toBeLessThanOrEqual(r.goalsFor);
        // 지더라도 출전하면 XP 를 받는다
        expect(r.xp).toBeGreaterThan(0);
      }
    }
  });
});

describe('리그 일정', () => {
  it('20팀 38라운드, 모든 팀이 서로 홈/원정 한 번씩', () => {
    const ids = Array.from({ length: 20 }, (_, i) => `t${i}`);
    const sch = buildSchedule(ids, createRng(1));
    expect(sch).toHaveLength(38);
    const pairs = new Set<string>();
    for (const round of sch) {
      expect(round).toHaveLength(10);
      expect(new Set(round.flatMap((f) => [f.home, f.away])).size).toBe(20);
      for (const f of round) pairs.add(`${f.home}>${f.away}`);
    }
    expect(pairs.size).toBe(20 * 19);
  });
});

describe('새 게임', () => {
  it('가상 유망주: 포지션 OVR 52~60, 17세, 하위~중위권 팀', () => {
    for (const [i, position] of PLAYABLE_POSITIONS.entries()) {
      for (let k = 0; k < 5; k++) {
        const s = newGame({ mode: 'prospect', position, seed: `p${i}-${k}`, difficulty: 'normal' });
        const ovr = playerOvr(s.player);
        expect(ovr).toBeGreaterThanOrEqual(52);
        expect(ovr).toBeLessThanOrEqual(60);
        expect(s.player.age).toBe(17);
        const rank = [...s.league.teams].sort((a, b) => b.rating - a.rating).findIndex((t) => t.id === s.player.teamId) + 1;
        expect(rank).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('실제 선수: 그 선수의 팀과 나이로 시작하고 NPC 목록에서 빠짐', () => {
    const s = newGame({ mode: 'real', playerId: 'kane', seed: 'r', difficulty: 'normal' });
    expect(s.player).toMatchObject({ teamId: 'tot', age: 25, position: 'ST', realPlayerId: 'kane' });
    expect(s.npcs.find((n) => n.id === 'kane')).toBeUndefined();
    expect(s.npcs).toHaveLength(A_GRADE_PLAYERS.length - 1);
  });
});

describe('시즌 진행', () => {
  it('38라운드 → 시즌 종료 → 다음 시즌 진행', () => {
    const s = newGame({ mode: 'prospect', position: 'CM', seed: 'loop', difficulty: 'normal' });
    playSeason(s);
    expect(s.phase).toBe('offseason');
    expect(s.league.table.every((r) => r.played === 38)).toBe(true);
    expect(s.player.age).toBe(18);
    expect(s.player.history).toHaveLength(1);
    startNextSeason(s);
    expect(s).toMatchObject({ phase: 'season', league: { season: 2019, round: 0 } });
    playSeason(s);
    expect(s.player.history.map((h) => h.season)).toEqual([2018, 2019]);
  });

  it('38세에 강제 은퇴', () => {
    const s = newGame({ mode: 'real', playerId: 'aguero', seed: 'old', difficulty: 'normal' });
    s.player.age = 37;
    playSeason(s);
    expect(s.phase).toBe('retired');
    expect(s.lastSeasonSummary?.forcedRetire).toBe(true);
  });

  it('결정성: 같은 시드와 같은 선택이면 같은 결과 (세이브 왕복 포함)', () => {
    const run = (viaSave: boolean) => {
      let s = newGame({ mode: 'prospect', position: 'LW', name: 'A', seed: 'det', difficulty: 'hard' });
      for (let season = 0; season < 2; season++) {
        for (let r = 0; r < 38; r++) {
          playRound(s);
          autoAllocate(s.player);
          if (viaSave && r % 10 === 0) s = deserialize(serialize(s));
        }
        if (season === 0) startNextSeason(s);
      }
      return s;
    };
    expect(serialize(run(false))).toEqual(serialize(run(true)));
    const other = newGame({ mode: 'prospect', position: 'LW', name: 'A', seed: 'det2', difficulty: 'hard' });
    expect(serialize(run(false))).not.toEqual(serialize(other));
  });
});

describe('팀 내 활약 업적 (5.3)', () => {
  /** 시즌을 끝까지 돌리지 않고 기록과 순위표만 꾸민 상태 */
  function staged(): GameState {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'ach', difficulty: 'normal' });
    const myRow = g.league.table.find((r) => r.teamId === g.player.teamId)!;
    myRow.gf = 40;
    return g;
  }
  const labels = (g: GameState) => seasonAchievements(g.player, g.league).map((a) => a.label.split(' (')[0]);

  it('팀 공격 기여: 15경기 이상, 골+어시가 팀 득점의 25% 이상', () => {
    const g = staged();
    Object.assign(g.player.season, { apps: 15, goals: 6, assists: 4, ratingSum: 15 * 6.5 });
    expect(labels(g)).toContain('팀 공격 기여');
    g.player.season.assists = 3;
    expect(labels(g)).not.toContain('팀 공격 기여');
  });

  it('안정적인 활약: 평균 7.0 이상 7.5 미만만. 7.5 이상은 기존 업적', () => {
    const g = staged();
    Object.assign(g.player.season, { apps: 10, ratingSum: 72 });
    expect(labels(g)).toContain('안정적인 활약');
    g.player.season.ratingSum = 76;
    expect(labels(g)).not.toContain('안정적인 활약');
    expect(labels(g)).toContain(`시즌 평균 평점 ${BALANCE.achievements.highAvgRating.minAvg} 이상`);
  });

  it('언더독 돌풍: 최종 순위가 시즌 전 레이팅 순위보다 3계단 이상 위', () => {
    const g = staged();
    const expected = ratingRank(g.league, g.player.teamId);
    // 내 팀만 승점을 주어 1위로 만든다
    g.league.table.find((r) => r.teamId === g.player.teamId)!.points = 100;
    expect(expected).toBeGreaterThanOrEqual(4);
    expect(labels(g)).toContain('언더독 돌풍');
  });
});

describe('위상 개인 기록 가산 (8.1, 부록 D.6 #3)', () => {
  it('MOM 1회당, 골+어시 10개당 가산, 시즌 상한', () => {
    const P = BALANCE.reputation.personal;
    const s = (goals: number, assists: number, moms: number) => ({ ...emptySeasonStats(), goals, assists, moms });
    expect(personalReputation(s(5, 4, 0))).toBe(0);
    expect(personalReputation(s(12, 9, 2))).toBe(2 * P.perMom + 2 * P.goalInvolvements.points);
    expect(personalReputation(s(60, 40, 30))).toBe(P.max);
  });
});

describe('NPC 성장', () => {
  it('어린 선수는 전성기 OVR 을 향해 오르고, 결과는 시드로 재현된다', () => {
    const young = A_GRADE_PLAYERS.find((p) => p.id === 'foden')!;
    let n = createNpc(young, 'npc', 2018);
    const start = npcOvr(n);
    const years = n.peakAge - n.age;
    for (let y = 2018; y < 2018 + years; y++) n = growNpc(n, 'npc', y);
    expect(npcOvr(n)).toBeGreaterThan(start + 8);
    expect(Math.abs(npcOvr(n) - n.peakOvr)).toBeLessThanOrEqual(6);

    const again = growNpc(createNpc(young, 'npc', 2018), 'npc', 2018);
    expect(again).toEqual(growNpc(createNpc(young, 'npc', 2018), 'npc', 2018));
  });

  it('30대 선수는 하락한다 (노련함 능력치가 있어 미드필더는 완만하게)', () => {
    let n = createNpc(A_GRADE_PLAYERS.find((p) => p.id === 'modric')!, 'npc', 2018);
    const start = npcOvr(n);
    for (let y = 2018; y < 2023; y++) n = growNpc(n, 'npc', y);
    expect(npcOvr(n)).toBeLessThan(start - 3);
  });
});
