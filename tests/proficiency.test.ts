import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { awardBadges } from '../src/badges';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats, newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { playerOvr } from '../src/growth';
import { positionOvr } from '../src/positions';
import {
  afterTeamMatch, distancePenalty, engineProficiency, gainProficiency, initialProficiency, initialProfLog, positionDistance, positionPenalty, proficiencyPenalty, requestPositionChange,
} from '../src/proficiency';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import type { PlayerState, SeasonRecord } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0,
    fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0, season: emptySeasonStats(), history: [], suspended: 0,
    proficiency: initialProficiency('ST'), profLog: initialProfLog(initialProficiency('ST')), badges: [], formerPositions: [], honors: { ballonDor: 0, trebles: 0, worldCups: 0 }, body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [], ...overrides,
  };
}

describe('포지션 전환 (부록 D.3)', () => {
  it('거리: 인접 관계의 최단 걸음 수, LWB/RWB 는 LB/RB', () => {
    expect(positionDistance('ST', 'ST')).toBe(0);
    expect(positionDistance('ST', 'CF')).toBe(1);
    expect(positionDistance('ST', 'CAM')).toBe(2);
    expect(positionDistance('LW', 'CM')).toBe(2);
    expect(positionDistance('ST', 'CB')).toBe(5);
    expect(positionDistance('LWB', 'CB')).toBe(1);
  });
  it('초기 숙련도 (C.39): 주 100, 서브 포지션 70, 그 외는 거리와 상관없이 0', () => {
    const p = initialProficiency('ST', ['LW']);
    expect(p.ST).toBe(100);
    expect(p.CF).toBe(0);
    expect(p.CAM).toBe(0);
    expect(p.CB).toBe(0);
    expect(p.LW).toBe(70);
  });
  it('페널티 = 거리별 최대(1: 6, 2: 10, 3 이상: 14) × (1 − 숙련도/100)', () => {
    expect(distancePenalty(0, 1)).toBe(6);
    expect(distancePenalty(50, 2)).toBe(5);
    expect(distancePenalty(0, 5)).toBe(14);
    expect(distancePenalty(100, 3)).toBe(0);
    const p = player();
    expect(positionPenalty(p, 'CF')).toBe(6);
    expect(positionPenalty(p, 'CAM')).toBe(10);
    expect(positionPenalty(p, 'CB')).toBe(14);
    // 엔진 입력 환산: (100 − x) × 0.25 = 페널티
    expect(proficiencyPenalty(engineProficiency(p, 'CB'))).toBeCloseTo(14);
    expect(engineProficiency(p, 'ST')).toBe(100);
  });
  it('변경 요청 후에는 새 포지션 OVR 에서 페널티를 뺀다 (주 포지션은 이전 주 포지션에서의 거리). 시즌 중에는 바꿀 수 없다', () => {
    const p = player();
    expect(requestPositionChange(p, 'CAM', false)).toBe(false);
    expect(requestPositionChange(p, 'CAM', true)).toBe(true);
    expect(p.position).toBe('CAM');
    expect(p.formerPosition).toBe('ST');
    expect(playerOvr(p)).toBe(Math.round(positionOvr(p.attributes, 'CAM') - 10));
  });
  it('상승: 적응기 20경기는 2.25 × 0.3, 이후 2.25 (× 출전 비율), 최대 100', () => {
    const p = player();
    requestPositionChange(p, 'CF', true);
    gainProficiency(p, 90);
    expect(p.proficiency.CF).toBe(0.68);
    gainProficiency(p, 45);
    expect(p.proficiency.CF).toBeCloseTo(1.02, 2);
    for (let i = 2; i < 20; i++) gainProficiency(p, 90);
    const after20 = p.proficiency.CF;
    gainProficiency(p, 90);
    expect(p.proficiency.CF).toBeCloseTo(after20 + 2.25, 2);
    p.proficiency.CF = 99.5;
    gainProficiency(p, 90);
    expect(p.proficiency.CF).toBe(100);
    expect(p.profLog!.CF!.peak).toBe(true);
  });
  it('적성 1.0 기준 0 → 100 은 약 55~60경기', () => {
    const p = player();
    requestPositionChange(p, 'CM', true);
    let n = 0;
    while (p.proficiency.CM < 100 && n < 500) {
      gainProficiency(p, 90);
      n++;
    }
    expect(n).toBeGreaterThanOrEqual(55);
    expect(n).toBeLessThanOrEqual(60);
  });
  it('감소: 연속 5경기 미출전부터 경기마다 −1, 100을 찍은 포지션은 10경기부터, 주 포지션은 없음, 하한 0', () => {
    const p = player();
    p.proficiency.CF = 50;
    p.proficiency.LW = 100;
    p.profLog!.LW!.peak = true;
    p.proficiency.CAM = 0.5;
    for (let i = 0; i < 4; i++) afterTeamMatch(p, 90, 'ST');
    expect(p.proficiency.CF).toBe(50);
    afterTeamMatch(p, 90, 'ST');
    expect(p.proficiency.CF).toBe(49);
    expect(p.proficiency.CAM).toBe(0);
    for (let i = 0; i < 4; i++) afterTeamMatch(p, 0);
    expect(p.proficiency.CF).toBe(45);
    expect(p.proficiency.LW).toBe(100);
    afterTeamMatch(p, 0);
    expect(p.proficiency.LW).toBe(99);
    expect(p.proficiency.ST).toBe(100);
    // 그 포지션으로 뛰면 연속 미출전이 끊긴다
    afterTeamMatch(p, 90, 'CF');
    expect(p.profLog!.CF!.idle).toBe(0);
    afterTeamMatch(p, 90, 'ST');
    expect(p.proficiency.CF).toBeCloseTo(44.68, 2);
  });
  it('주 포지션 숙련도 100 이면 OVR 은 예전과 같다 (밸런스 불변)', () => {
    const p = player();
    expect(playerOvr(p)).toBe(positionOvr(p.attributes, 'ST'));
  });
});

const rec = (season: number, o: Partial<SeasonRecord> = {}): SeasonRecord => ({
  ...emptySeasonStats(), season, age: 20, teamId: 'x', leaguePosition: 5, achievementXp: 0, ovr: 70, reputation: 0, ...o,
});

describe('레전드 배지 (부록 D.4)', () => {
  it('통산 500골, 리그 우승 5회를 한 번만 주고 위상 +100. 한 팀 10시즌은 이적이 생길 때까지 꺼 둔다 (C.22)', () => {
    const p = player({ reputation: 300 });
    p.history = Array.from({ length: 10 }, (_, i) => rec(2018 + i, { goals: 50, leaguePosition: i < 5 ? 1 : 3 }));
    const got = awardBadges(p, 2027);
    expect(got.map((b) => b.id).sort()).toEqual(BALANCE.badges.oneClubEnabled ? ['goals500', 'oneClub10', 'titles5'] : ['goals500', 'titles5']);
    expect(p.reputation).toBe(300 + got.length * BALANCE.badges.reputation);
    expect(awardBadges(p, 2028)).toEqual([]);
  });
  it('한 팀 10시즌 판정 자체: 켜면 10시즌 같은 팀일 때 준다', () => {
    const B = BALANCE.badges as { oneClubEnabled: boolean };
    const was = B.oneClubEnabled;
    B.oneClubEnabled = true;
    try {
      const p = player();
      p.history = Array.from({ length: 10 }, (_, i) => rec(2018 + i));
      expect(awardBadges(p, 2027).map((b) => b.id)).toEqual(['oneClub10']);
    } finally {
      B.oneClubEnabled = was;
    }
  });
  it('조건 미달이면 없음 (팀이 바뀌면 연속이 끊긴다)', () => {
    const p = player();
    p.history = Array.from({ length: 10 }, (_, i) => rec(2018 + i, { teamId: i === 4 ? 'y' : 'x', goals: 10 }));
    expect(awardBadges(p, 2027)).toEqual([]);
  });
});

describe('옛 세이브 (7)', () => {
  it('옛 세이브(7)는 이어 할 수 없음', () => {
    const s = newGame({ mode: 'real', playerId: 'kane', seed: 'mig8', difficulty: 'normal' });
    const old = JSON.parse(serialize(s));
    old.saveFormat = 7;
    expect(() => deserialize(JSON.stringify(old))).toThrow(SaveFormatError);
  });
});

describe('세이브 (C.39)', () => {
  it('숙련도·진행 기록은 왕복 그대로, 옛 세이브(18)는 이어 할 수 없음', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig19', difficulty: 'normal' });
    s.player.proficiency.CF = 63.5;
    s.matchLog = [{ round: 1, opponentId: 'x', home: true, goalsFor: 0, goalsAgainst: 0, minutes: 90, started: true, goals: 0, assists: 0, rating: 6, mom: false, position: 'CF', rec: null }];
    const loaded = deserialize(serialize(s));
    expect(loaded.player.proficiency.CF).toBe(63.5);
    expect(loaded.player.profLog).toEqual(s.player.profLog);
    const old = JSON.parse(serialize(s));
    old.saveFormat = 18;
    expect(() => deserialize(JSON.stringify(old))).toThrow(SaveFormatError);
  });
});
