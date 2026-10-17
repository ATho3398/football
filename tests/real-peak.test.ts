import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { emptySeasonStats, newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { playerOvr, realPeakTarget, xpToLevel } from '../src/growth';
import { deserialize, serialize } from '../src/save';
import { initialProficiency } from '../src/proficiency';
import type { PlayerState } from '../src/types';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

describe('실제 선수 정점 목표 (부록 D.7 #1)', () => {
  it('시작 나이별 여지: ≤20 +10, 21~23 +8, 24~26 +7, 27~29 +4, 30+ +2', () => {
    expect(realPeakTarget(70, 18)).toBe(80);
    expect(realPeakTarget(70, 20)).toBe(80);
    expect(realPeakTarget(70, 21)).toBe(78);
    expect(realPeakTarget(70, 25)).toBe(77);
    expect(realPeakTarget(70, 27)).toBe(74);
    expect(realPeakTarget(70, 31)).toBe(72);
  });

  it('실제 선수로 시작하면 정점 목표가 생기고, 가상 유망주는 없다', () => {
    const real = newGame({ mode: 'real', playerId: 'rashford', seed: 'peak', difficulty: 'normal' });
    expect(real.player.peakTarget).toBe(realPeakTarget(playerOvr(real.player), 21));
    const prospect = newGame({ mode: 'prospect', position: 'ST', seed: 'peak', difficulty: 'normal' });
    expect(prospect.player.peakTarget).toBeUndefined();
  });

  it('정점 목표 - softBelow 를 넘으면 필요 XP 가 더 늘어난다', () => {
    const base: PlayerState = {
      name: 't', position: 'ST', age: 25, teamId: 'x', attributes: flat(75), potentialTier: 'normal',
      xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
      fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0, season: emptySeasonStats(), history: [], suspended: 0,
    proficiency: initialProficiency('ST'), badges: [], formerPositions: [], honors: { ballonDor: 0, trebles: 0, worldCups: 0 }, body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, traits: [],
    };
    const R = BALANCE.growth.realPeak;
    expect(xpToLevel({ ...base, peakTarget: 75 + R.softBelow })).toBe(xpToLevel(base));
    expect(xpToLevel({ ...base, peakTarget: 75 })).toBe(Math.round(BALANCE.growth.xpPerLevel * (1 + R.softBelow * R.perOvr)));
  });
});

describe('세이브 변환 3 → 4', () => {
  it('실제 선수 세이브에 정점 목표를 채운다', () => {
    const s = newGame({ mode: 'real', playerId: 'kane', seed: 'mig4', difficulty: 'normal' });
    const expected = s.player.peakTarget;
    playRound(s);
    const old = JSON.parse(serialize(s));
    old.saveFormat = 3;
    delete old.player.peakTarget;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.player.peakTarget).toBe(expected);
  });

  it('가상 유망주 세이브는 그대로 열린다', () => {
    const s = newGame({ mode: 'prospect', position: 'CB', seed: 'mig4', difficulty: 'normal' });
    const old = JSON.parse(serialize(s));
    old.saveFormat = 3;
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.player.peakTarget).toBeUndefined();
    playRound(loaded);
  });
});
