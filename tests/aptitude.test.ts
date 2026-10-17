import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import {
  adviceOpen, aptGroupOf, checkAdviceTaken, evaluateAdvice, rollProspect, talentAttrMean, talentById, type Aptitude,
} from '../src/aptitude';
import { BALANCE } from '../src/config/balance';
import { APT_GROUPS, TALENT_TYPES } from '../src/config/aptitude';
import { canChangePosition, emptySeasonStats, newGame, SAVE_FORMAT_VERSION, selectableRealPlayers } from '../src/game';
import { positionOvr } from '../src/positions';
import { gainProficiency, initialProficiency, requestPositionChange } from '../src/proficiency';
import { deserialize, serialize } from '../src/save';
import type { PlayerState, SeasonRecord } from '../src/types';

const A = BALANCE.aptitude;
const flat = (v: number) => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;
const apt = (mult: Partial<Aptitude['mult']>, base = 1): Aptitude => ({
  talent: 'speed', hidden: null, mult: { ...Object.fromEntries(APT_GROUPS.map((g) => [g, base])) as Aptitude['mult'], ...mult },
});

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    name: 't', position: 'ST', age: 20, teamId: 'x', attributes: flat(60), potentialTier: 'normal',
    xp: 0, totalXp: 0, level: 0, unspentPoints: 0, allocation: { levels: 0, raised: {} },
    fatigue: 0, reputation: 0, coachWarned: false, injury: null, recentRatings: [], slumpStreak: 0, season: emptySeasonStats(), history: [], suspended: 0,
    proficiency: initialProficiency('ST'), badges: [], formerPositions: [], honors: { ballonDor: 0, trebles: 0, worldCups: 0 }, body: { height: 180, weight: 75, foot: 'right', weakFoot: 3 }, tags: [],
    aptitude: apt({ ST: 1.0, CB: 1.5 }), advice: null, adviceLog: [], aptBoost: null, ...overrides,
  };
}

let seasonNo = 2000;
const season = (avg: number, apps = 30, position: PlayerState['position'] = 'ST'): SeasonRecord => ({
  ...emptySeasonStats(), apps, starts: apps, ratingSum: avg * apps, season: seasonNo++, age: 20, teamId: 'x', leaguePosition: 10, achievementXp: 0, ovr: 60, reputation: 0, position,
});

describe('숨은 재능 타입과 적성 (pending 31·36, C.37)', () => {
  it('적성 범위: 맞는 군 1.2~1.5, 숨은 재능 1.4~1.6(엇갈린 군), 나머지 0.7~1.0', () => {
    let hidden = 0;
    for (let i = 0; i < 300; i++) {
      const r = rollProspect(`apt-${i}`);
      const t = talentById(r.aptitude.talent)!;
      for (const g of APT_GROUPS) {
        const m = r.aptitude.mult[g];
        if (t.groups.includes(g)) expect(m).toBeGreaterThanOrEqual(A.matched.min), expect(m).toBeLessThanOrEqual(A.matched.max);
        else if (g === r.aptitude.hidden) expect(m).toBeGreaterThanOrEqual(A.hidden.min), expect(m).toBeLessThanOrEqual(A.hidden.max);
        else expect(m).toBeGreaterThanOrEqual(A.other.min), expect(m).toBeLessThanOrEqual(A.other.max);
      }
      if (r.aptitude.hidden) {
        hidden++;
        expect(t.groups).not.toContain(r.aptitude.hidden);
      }
    }
    expect(hidden / 300).toBeGreaterThan(0.2);
    expect(hidden / 300).toBeLessThan(0.4);
  });

  it('능력치는 재능 타입 쪽으로 기운다', () => {
    let diff = 0;
    for (let i = 0; i < 100; i++) {
      const r = rollProspect(`tilt-${i}`);
      const m = talentAttrMean(r.attributes, r.talent);
      diff += m.talent - m.rest;
    }
    expect(diff / 100).toBeGreaterThan(5);
  });

  it('기준 자리를 주면 그 자리 OVR = 시작 OVR, 맞는 재능 타입', () => {
    for (const pos of ['ST', 'CB', 'CM', 'LW', 'RB'] as const) {
      const r = rollProspect(`anchor-${pos}`, pos);
      expect(r.anchor).toBe(pos);
      expect(r.talent.anchors).toContain(pos);
      expect(positionOvr(r.attributes, pos)).toBe(r.ovr);
    }
    expect(TALENT_TYPES.every((t) => t.anchors.every((p) => t.groups.includes(aptGroupOf(p)!)))).toBe(true);
  });

  it('시작 후보 4자리: 서로 다른 포지션군, 상위 3은 적합도 순, 마지막은 와일드카드, 코치 한 줄 평', () => {
    for (let i = 0; i < 50; i++) {
      const r = rollProspect(`cand-${i}`);
      const c = r.candidates;
      expect(c).toHaveLength(4);
      expect(new Set(c.map((x) => x.group)).size).toBe(4);
      expect(c.map((x) => x.kind)).toEqual(['top', 'good', 'good', 'wild']);
      expect(c[0]!.ovr).toBeGreaterThanOrEqual(c[1]!.ovr);
      expect(c[1]!.ovr).toBeGreaterThanOrEqual(c[2]!.ovr);
      expect(c[2]!.ovr).toBeGreaterThanOrEqual(c[3]!.ovr);
      for (const x of c) expect(x.line.length).toBeGreaterThan(5);
    }
  });

  it('결정성: 같은 시드 = 같은 유망주·후보, 화면 새 게임은 그 유망주에 고른 자리', () => {
    const a = rollProspect('same');
    const b = rollProspect('same');
    expect(b.attributes).toEqual(a.attributes);
    expect(b.candidates).toEqual(a.candidates);
    const wild = a.candidates[3]!.pos;
    const g = newGame({ mode: 'prospect', position: wild, seed: 'same', difficulty: 'normal', rolled: true });
    expect(g.player.position).toBe(wild);
    expect(g.player.attributes).toEqual(a.attributes);
    expect(g.player.aptitude).toEqual(a.aptitude);
    expect(g.player.proficiency[wild]).toBe(100);
  });

  it('실제 선수: 주 포지션군 1.2~1.4, 나머지 0.7~1.0, 엇갈림 없음', () => {
    const data = selectableRealPlayers()[0]!;
    const g = newGame({ mode: 'real', playerId: data.id, seed: 'real-apt', difficulty: 'normal' });
    const a = g.player.aptitude!;
    expect(a.hidden).toBeNull();
    const mg = aptGroupOf(data.position)!;
    expect(a.mult[mg]).toBeGreaterThanOrEqual(1.2);
    expect(a.mult[mg]).toBeLessThanOrEqual(1.4);
    for (const gr of APT_GROUPS) if (gr !== mg) expect(a.mult[gr]).toBeLessThanOrEqual(1.0);
  });
});

describe('숙련도 상승 배수 (D.3 × 적성)', () => {
  it('적성 배수를 상승량에 곱한다, 슬롯 출전도', () => {
    const hi = player({ aptitude: apt({ CB: 1.5 }) });
    const lo = player({ aptitude: apt({ CB: 0.7 }) });
    gainProficiency(hi, 90, 'CB');
    gainProficiency(lo, 90, 'CB');
    // 0에서 시작, 적응기 상승 2.25 × 0.3 / 경기 (C.39)
    const base = BALANCE.proficiency.gain * BALANCE.proficiency.adaptMult;
    expect(hi.proficiency.CB).toBeCloseTo(base * 1.5, 2);
    expect(lo.proficiency.CB).toBeCloseTo(base * 0.7, 2);
  });

  it('조언 뒤 포변 보너스: 그 포지션군 10경기 ×2, 다 쓰면 사라진다', () => {
    const p = player({ aptitude: apt({ CB: 1.0 }), aptBoost: { group: 'CB', games: A.advice.boostGames } });
    gainProficiency(p, 90, 'CB');
    expect(p.proficiency.CB).toBeCloseTo(BALANCE.proficiency.gain * BALANCE.proficiency.adaptMult * A.advice.boostMult, 2);
    gainProficiency(p, 90, 'CM');
    expect(p.aptBoost!.games).toBe(A.advice.boostGames - 1);
    for (let i = 0; i < A.advice.boostGames; i++) gainProficiency(p, 90, 'CB');
    expect(p.aptBoost).toBeNull();
  });
});

describe('포변 조언 (pending 31 3번, 36 ①②)', () => {
  it('2시즌 연속 6.2 이하 + 적성이 더 높은 군 → 감독 한마디, 다음엔 뉴스', () => {
    const p = player({ history: [season(6.1), season(6.2)] });
    const a = evaluateAdvice(p, p.history[1]!.season)!;
    expect(a.kind).toBe('coach');
    expect(a.group).toBe('CB');
    expect(a.pos).toBe('CB');
    expect(a.untilSeason).toBe(p.history[1]!.season + 1);
    // 다음 조언은 겹치지 않는 2시즌으로만: 한 시즌 더 부진해도 아직 없음
    p.history.push(season(6.0));
    expect(evaluateAdvice(p, p.history.at(-1)!.season)).toBeNull();
    p.history.push(season(6.0));
    expect(evaluateAdvice(p, p.history.at(-1)!.season)!.kind).toBe('news');
    expect(p.adviceLog).toHaveLength(2);
    // 같은 포지션에서 최대 2번
    p.history.push(season(6.0), season(6.0));
    expect(evaluateAdvice(p, p.history.at(-1)!.season)).toBeNull();
  });

  it('조건이 안 되면 조언 없음: 평점 6.3, 한 시즌만, 출전 부족, 다른 포지션 시즌, 더 높은 적성 없음', () => {
    expect(evaluateAdvice(player({ history: [season(6.1), season(6.3)] }), 2019)).toBeNull();
    expect(evaluateAdvice(player({ history: [season(6.0)] }), 2018)).toBeNull();
    expect(evaluateAdvice(player({ history: [season(6.0), season(6.0, 5)] }), 2019)).toBeNull();
    expect(evaluateAdvice(player({ history: [season(6.0, 30, 'CM'), season(6.0)] }), 2019)).toBeNull();
    expect(evaluateAdvice(player({ history: [season(6.0), season(6.0)], aptitude: apt({ ST: 1.5 }, 0.8) }), 2019)).toBeNull();
  });

  it('조언 기간(소집 뒤 30일) 안에 그 포지션군으로 뛰면 보너스, 지나면 사라진다', () => {
    const p = player({ history: [season(6.0), season(6.0)] });
    evaluateAdvice(p, 2019);
    expect(adviceOpen(p, 2019, 38)).toBe(true);
    expect(checkAdviceTaken(p, 'ST', 2020, 0)).toBe(false);
    expect(checkAdviceTaken(p, 'CB', 2020, 29)).toBe(true);
    expect(p.aptBoost).toEqual({ group: 'CB', games: A.advice.boostGames });
    expect(p.advice).toBeNull();
    const q = player({ history: [season(6.0), season(6.0)] });
    evaluateAdvice(q, 2019);
    expect(checkAdviceTaken(q, 'CB', 2020, A.advice.windowDays)).toBe(false);
    expect(q.advice).toBeNull();
    expect(q.aptBoost).toBeNull();
  });

  it('조언이 살아 있으면 시즌 중에도 주 포지션 변경 요청이 된다 (D.3 비시즌 제한은 조언 없을 때 그대로)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'adv-season', difficulty: 'normal' });
    expect(canChangePosition(g)).toBe(false);
    expect(requestPositionChange(g.player, 'CB', canChangePosition(g))).toBe(false);
    g.player.advice = { kind: 'coach', group: 'CB', pos: 'CB', from: 'ST', season: 2017, untilSeason: g.league.season, untilDays: 30 };
    expect(canChangePosition(g)).toBe(true);
    expect(requestPositionChange(g.player, 'CB', canChangePosition(g))).toBe(true);
    expect(checkAdviceTaken(g.player, 'CB', g.league.season, g.league.round)).toBe(true);
  });
});

describe('세이브 16 → 17 (C.37)', () => {
  it('옛 세이브: 지금 주 포지션 기준 적성(엇갈림 없음), 재능 타입은 능력치에서 추정, 조언 없음', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'mig16', difficulty: 'normal' });
    const raw = JSON.parse(serialize(g));
    delete raw.player.aptitude;
    delete raw.player.advice;
    delete raw.player.adviceLog;
    delete raw.player.aptBoost;
    raw.saveFormat = 16;
    const back = deserialize(JSON.stringify(raw));
    expect(SAVE_FORMAT_VERSION).toBe(27);
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    const a = back.player.aptitude!;
    expect(a.hidden).toBeNull();
    expect(a.mult.CM).toBeGreaterThanOrEqual(1.2);
    expect(talentById(a.talent)).toBeDefined();
    expect(back.player.advice).toBeNull();
    expect(back.player.adviceLog).toEqual([]);
    expect(deserialize(serialize(back)).player.aptitude).toEqual(a);
  });
});
