import { describe, expect, it } from 'vitest';
import { formBonus, formLevel, pushRating } from '../src/form';
import { newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { simulateMatch, type MatchInput } from '../src/match';
import { createRng } from '../src/rng';
import { deserialize, SaveFormatError, serialize } from '../src/save';

describe('폼 (부록 D.1)', () => {
  it('5경기 미만이면 보정 없음, 최근 5경기만 남긴다', () => {
    let r: number[] = [];
    for (let i = 0; i < 4; i++) r = pushRating(r, 9);
    expect(formBonus(r)).toBe(0);
    expect(formLevel(r)).toBe('normal');
    for (let i = 0; i < 3; i++) r = pushRating(r, 6.5);
    expect(r).toEqual([9, 9, 6.5, 6.5, 6.5]);
  });

  it('보정 = clamp((평균 - 6.5) × 0.3, ±0.3)', () => {
    expect(formBonus([7, 7, 7, 7, 7])).toBeCloseTo(0.15);
    expect(formBonus([6, 6, 6, 6, 6])).toBeCloseTo(-0.15);
    expect(formBonus([9, 9, 9, 9, 9])).toBe(0.3);
    expect(formBonus([4, 4, 4, 4, 4])).toBe(-0.3);
    expect(formLevel([9, 9, 9, 9, 9])).toBe('veryGood');
    expect(formLevel([7, 7, 7, 7, 7])).toBe('good');
    expect(formLevel([6.5, 6.5, 6.5, 6.5, 6.5])).toBe('normal');
    expect(formLevel([6, 6, 6, 6, 6])).toBe('bad');
    expect(formLevel([4, 4, 4, 4, 4])).toBe('veryBad');
  });

  it('폼 보정은 같은 시드의 평점에 그대로 더해진다', () => {
    const input: MatchInput = {
      ovr: 75, position: 'CM', fatigue: 0, teamRating: 70, oppRating: 75, home: true, difficulty: 'normal',
    };
    for (let seed = 0; seed < 20; seed++) {
      const a = simulateMatch(input, createRng(seed));
      const b = simulateMatch({ ...input, formBonus: 0.3 }, createRng(seed));
      if (a.rating === null || a.rating >= 9.7 || a.rating <= 3) continue;
      expect(b.rating! - a.rating).toBeCloseTo(0.3, 5);
    }
  });

  it('경기를 치르면 출전 경기 평점이 쌓인다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'form', difficulty: 'normal' });
    let apps = 0;
    for (let i = 0; i < 10; i++) if (playRound(s, { engine: 'quick' }).result.minutes > 0) apps++;
    expect(s.player.recentRatings).toHaveLength(Math.min(5, apps));
  });
});

describe('세이브 형식', () => {
  it('옛 세이브(1)는 이어 할 수 없음, 지금 형식은 불러와 이어 한다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig', difficulty: 'normal' });
    playRound(s);
    const old = JSON.parse(serialize(s));
    old.saveFormat = 1;
    expect(() => deserialize(JSON.stringify(old))).toThrow(SaveFormatError);
    const loaded = deserialize(serialize(s));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.player.recentRatings).toEqual(s.player.recentRatings);
    playRound(loaded);
  });

  it('게임보다 새 형식이면 거부한다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig', difficulty: 'normal' });
    const raw = JSON.parse(serialize(s));
    raw.saveFormat = SAVE_FORMAT_VERSION + 1;
    expect(() => deserialize(JSON.stringify(raw))).toThrow();
  });
});
