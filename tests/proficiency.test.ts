import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { awardBadges } from '../src/badges';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats, newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { playerOvr } from '../src/growth';
import { positionOvr } from '../src/positions';
import {
  decayFormerPosition, gainProficiency, initialProficiency, positionDistance, proficiencyPenalty, requestPositionChange,
} from '../src/proficiency';
import { deserialize, serialize } from '../src/save';
import type { PlayerState, SeasonRecord } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], season: emptySeasonStats(), history: [], suspended: 0,
    proficiency: initialProficiency('ST'), badges: [], formerPositions: [], honors: { ballonDor: 0, trebles: 0, worldCups: 0 }, ...overrides,
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
  it('초기 숙련도: 주 100, 거리 1 → 70, 2 → 50, 3 → 30, 4 이상 → 15, 서브 포지션 70', () => {
    const p = initialProficiency('ST', ['LW']);
    expect(p.ST).toBe(100);
    expect(p.CF).toBe(70);
    expect(p.CAM).toBe(50);
    expect(p.CM).toBe(30);
    expect(p.CB).toBe(15);
    expect(p.LW).toBe(70);
  });
  it('페널티 = (100 − 숙련도) × 0.25: 60 → −10, 80 → −5', () => {
    expect(proficiencyPenalty(60)).toBe(10);
    expect(proficiencyPenalty(80)).toBe(5);
  });
  it('변경 요청 후에는 새 포지션 OVR 에서 페널티를 뺀다. 시즌 중에는 바꿀 수 없다', () => {
    const p = player();
    expect(requestPositionChange(p, 'CAM', false)).toBe(false);
    expect(requestPositionChange(p, 'CAM', true)).toBe(true);
    expect(p.position).toBe('CAM');
    expect(p.formerPosition).toBe('ST');
    expect(playerOvr(p)).toBe(Math.round(positionOvr(p.attributes, 'CAM') - 12.5));
  });
  it('출전하면 거리에 따라 오른다 (90분 기준 거리 1 → 4, 2 → 2), 최대 100', () => {
    const near = player();
    requestPositionChange(near, 'CF', true);
    gainProficiency(near, 90);
    expect(near.proficiency.CF).toBe(74);
    const far = player();
    requestPositionChange(far, 'CAM', true);
    gainProficiency(far, 45);
    expect(far.proficiency.CAM).toBe(51);
    far.proficiency.CAM = 99.5;
    gainProficiency(far, 90);
    expect(far.proficiency.CAM).toBe(100);
  });
  it('이전 주 포지션은 시즌마다 2씩 줄고 30 아래로는 내려가지 않는다', () => {
    const p = player();
    requestPositionChange(p, 'CF', true);
    decayFormerPosition(p);
    expect(p.proficiency.ST).toBe(98);
    p.proficiency.ST = 31;
    decayFormerPosition(p);
    expect(p.proficiency.ST).toBe(30);
    decayFormerPosition(p);
    expect(p.proficiency.ST).toBe(30);
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

describe('세이브 변환 7 → 8', () => {
  it('숙련도를 채우고 배지는 빈 목록 (실제 선수는 서브 포지션 70)', () => {
    const s = newGame({ mode: 'real', playerId: 'kane', seed: 'mig8', difficulty: 'normal' });
    const expected = s.player.proficiency;
    const old = JSON.parse(serialize(s));
    old.saveFormat = 7;
    delete old.player.proficiency;
    delete old.player.badges;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.player.proficiency).toEqual(expected);
    expect(loaded.player.proficiency[loaded.player.position as 'ST']).toBe(100);
    expect(loaded.player.badges).toEqual([]);
  });
});
