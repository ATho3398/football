import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { BALANCE } from '../src/config/balance';
import { dayPlan, endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, startNextSeason } from '../src/game';
import { healDays, injuryChance, rollInjury } from '../src/injury';
import { createRng } from '../src/rng';
import { deserialize, SaveFormatError, serialize } from '../src/save';
import { daysBetween } from '../src/calendar';

const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;

describe('부상 확률 (부록 D.2)', () => {
  const p = { attributes: flat(50), age: 25, fatigue: 0 };

  it('기본 × 출전 비율 × 난이도 × 피로 × 신체 × 나이', () => {
    // C.77n: 기본 0.02 → 0.019, 30세 이상 × 1.3 → 1.1 (balance.ts injury 를 읽는다)
    const I = BALANCE.injury;
    const b = I.base;
    // 신체 보정 = 1.3 - 0.6 × 0.5 = 1.0
    expect(injuryChance(p, 90, 'normal')).toBeCloseTo(b, 6);
    expect(injuryChance(p, 45, 'normal')).toBeCloseTo(b / 2, 6);
    expect(injuryChance(p, 0, 'normal')).toBe(0);
    expect(injuryChance(p, 90, 'easy')).toBeCloseTo(b * BALANCE.difficulty.easy.injury, 6);
    expect(injuryChance(p, 90, 'hard')).toBeCloseTo(b * BALANCE.difficulty.hard.injury, 6);
    // C.77m: 피로 보정 문턱 30 → 60, 기울기 0.02 → 0.01 (피로 80 이면 × 1.2)
    expect(injuryChance({ ...p, fatigue: 60 }, 90, 'normal')).toBeCloseTo(b, 6);
    expect(injuryChance({ ...p, fatigue: 80 }, 90, 'normal')).toBeCloseTo(b * 1.2, 6);
    expect(injuryChance({ ...p, attributes: flat(100) }, 90, 'normal')).toBeCloseTo(b * 0.7, 6);
    expect(injuryChance({ ...p, age: 30 }, 90, 'normal')).toBeCloseTo(b * I.ageMultiplier, 6);
  });
});

describe('부상 등급과 영구 하락', () => {
  function rolls(age: number, n: number) {
    const out = { minor: 0, major: 0, seasonEnding: 0, permanent: 0, weeks: { minor: [99, 0], major: [99, 0] } };
    const pl = newGame({ mode: 'prospect', position: 'CB', seed: 'inj', difficulty: 'normal' }).player;
    for (let i = 0; i < n; i++) {
      pl.age = age;
      pl.attributes = flat(50);
      // 확률을 1로 만들기 위해 피로를 크게
      pl.fatigue = 10000;
      const inj = rollInjury(pl, 90, 'normal', 10, { season: 2018, round: 1 }, createRng(i))!;
      out[inj.grade]++;
      if (inj.grade !== 'seasonEnding') {
        const w = out.weeks[inj.grade];
        w[0] = Math.min(w[0]!, inj.weeksTotal);
        w[1] = Math.max(w[1]!, inj.weeksTotal);
      } else {
        expect(inj.weeksTotal).toBe(BALANCE.injury.grades.seasonEnding.minWeeks);
      }
      const drops = Object.entries(inj.permanent);
      if (drops.length) {
        out.permanent++;
        expect(inj.grade).not.toBe('minor');
        expect(drops.length).toBeLessThanOrEqual(2);
        for (const [, d] of drops) expect(d).toBeGreaterThanOrEqual(-3);
      }
    }
    return out;
  }

  it('경상 70% (1~3주) / 중상 27% (8~16주) / 시즌아웃 3%, 영구 하락은 중상 이상의 20%', () => {
    const n = 4000;
    const r = rolls(25, n);
    expect(r.minor / n).toBeCloseTo(0.7, 1);
    expect(r.major / n).toBeCloseTo(0.27, 1);
    expect(r.seasonEnding / n).toBeCloseTo(0.03, 1);
    expect(r.weeks.minor).toEqual([1, 3]);
    expect(r.weeks.major).toEqual([8, 16]);
    expect(r.permanent / (r.major + r.seasonEnding)).toBeCloseTo(0.2, 1);
  });

  it('30세 이상은 영구 하락 확률 × 1.5', () => {
    const n = 4000;
    const r = rolls(31, n);
    expect(r.permanent / (r.major + r.seasonEnding)).toBeCloseTo(0.3, 1);
  });
});

describe('부상 진행', () => {
  it('부상 중에는 출전하지 않고 재활(하루 단위 XP, C.41)만 하며, 기간이 지나면 복귀한다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'heal', difficulty: 'normal' });
    // 소집 첫 주를 넘긴 뒤 개막전 날에 다친 것으로
    while (!isMatchDay(s)) { playOthers(s, 'quick'); endDay(s); }
    s.player.injury = { grade: 'minor', weeksTotal: 2, daysTotal: 14, daysLeft: 14, season: 2018, round: 0, permanent: {} };
    expect(dayPlan(s)).toBe('rehab');
    const a = playRound(s);
    expect(a).toMatchObject({ injured: true, recovered: false, result: { minutes: 0, xp: 0 } });
    const b = playRound(s);
    expect(b).toMatchObject({ injured: true, recovered: true });
    // 하루 단위 회복 (C.38): 다음 내 경기 날 전에 낫는다
    const c = playRound(s);
    expect(c.injured).toBeUndefined();
    expect(s.player.season.injuredWeeks).toBe(2);
  });

  it('시즌아웃은 남은 시즌 전체, 비시즌에 offseasonWeeks 만큼 회복', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'out', difficulty: 'normal' });
    for (let r = 0; r < 30; r++) playRound(s, { engine: 'quick' });
    s.player.injury = { grade: 'seasonEnding', weeksTotal: 20, daysTotal: 140, daysLeft: 140, season: 2018, round: 30, permanent: {} };
    const from = s.calendar.date;
    while (s.phase === 'season') expect(playRound(s, { engine: 'quick' }).result.minutes).toBe(0);
    // 하루 단위 회복 (C.38): 남은 날 = 140 − 지난 날 (최종 라운드 날은 시즌 종료로 끝나 하루를 넘기지 않는다)
    const left = 140 - daysBetween(from, s.calendar.date);
    expect(s.player.injury?.daysLeft).toBe(left);
    startNextSeason(s);
    expect(s.player.injury?.daysLeft).toBe(left - BALANCE.injury.offseasonWeeks * 7);
    expect(healDays(s.player, left)).toBe(true);
  });

  it('부상 기록과 결정성: 세이브 왕복 후에도 같은 결과', () => {
    const run = (viaSave: boolean) => {
      let s = newGame({ mode: 'real', playerId: 'kane', seed: 'inj-det', difficulty: 'hard' });
      for (let r = 0; r < 38; r++) {
        playRound(s, { engine: 'quick' });
        if (viaSave && r % 7 === 0) s = deserialize(serialize(s));
      }
      return s;
    };
    expect(serialize(run(false))).toEqual(serialize(run(true)));
  });
});

describe('세이브 변환 2 → 3', () => {
  it('부상 필드를 채운다', () => {
    const s = newGame({ mode: 'prospect', position: 'ST', seed: 'mig3', difficulty: 'normal' });
    while (s.phase === 'season') playRound(s, { engine: 'quick' });
    const old = JSON.parse(serialize(s));
    old.saveFormat = 2;
    delete old.player.injury;
    for (const st of [old.player.season, ...old.player.history]) {
      delete st.injuries;
      delete st.injuredWeeks;
    }
    const loaded = deserialize(JSON.stringify(old));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.player.injury).toBeNull();
    expect(loaded.player.history[0]).toMatchObject({ injuries: 0, injuredWeeks: 0 });
    startNextSeason(loaded);
    playRound(loaded);
  });
});
