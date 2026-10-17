import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, rebuildRosters, SAVE_FORMAT_VERSION } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { LEGEND_ROWS, LEGEND_RETIRED_BY, REAL_RETIRED_2018_2020 } from '../data/players/legends';
import { A_GRADE_PLAYERS } from '../data/players';
import { LEGENDS, legendGap, legendPeak, legendRosterPlayer, legendSpawns } from '../src/legends';
import { initialTeams } from '../src/league';
import { naturalOvr } from '../src/roster';
import { withinRules } from '../src/squad';
import { applyAging } from '../src/growth';
import { createRng } from '../src/rng';
import { FIELD_ATTRIBUTES, type FieldAttributes } from '../src/attributes';
import { judgeEvergreen, judgeLateBloomer, judgeNatural, lateBloomerSkip, lateDecisive, tagChangeLine, type NaturalInput } from '../src/careerTags';
import { cardMul, noAdaptation, oneClubLevel, startBonus, storyForm, storyProfMul, storyXpMul, type PlayerTag } from '../src/tags';
import { emptySeasonStats, playRound } from '../src/game';
import type { PlayerState, SeasonRecord } from '../src/types';

const TEAMS = initialTeams().map((t) => ({ id: t.id, rating: t.baseRating }));

describe('레전드 팩 (C.47, pending 63)', () => {
  it('명단 117명, 모두 2020년까지 은퇴 (그 뒤 은퇴자 제외), 2018~2020 은퇴 실제 선수는 일반 로스터에서 빠짐', () => {
    expect(LEGEND_ROWS.length).toBe(117);
    expect(LEGENDS.every((l) => l.retired <= LEGEND_RETIRED_BY)).toBe(true);
    expect(LEGENDS.some((l) => l.id === 'lg-xavi' && l.retired === 2019)).toBe(true);
    expect(A_GRADE_PLAYERS.some((p) => p.id in REAL_RETIRED_2018_2020)).toBe(false);
    expect(new Set(LEGENDS.map((l) => l.id)).size).toBe(LEGENDS.length);
  });

  it('끄면 세계 그대로 (로스터·레이팅 같음), 켜면 117명이 15~22세로 들어오고 인원 규칙 안', () => {
    const off = newGame({ mode: 'prospect', position: 'ST', seed: 'c47-pack', difficulty: 'normal' });
    const base = rebuildRosters('c47-pack', undefined, 0);
    expect(JSON.stringify(off.rosters)).toBe(JSON.stringify(base));
    expect(off.legends).toBeUndefined();
    const on = newGame({ mode: 'prospect', position: 'ST', seed: 'c47-pack', difficulty: 'normal', legends: true });
    const lg = Object.values(on.rosters).flatMap((r) => r.players.filter((p) => p.legend));
    expect(lg.length).toBe(117);
    for (const p of lg) {
      expect(p.age).toBeGreaterThanOrEqual(15);
      expect(p.age).toBeLessThanOrEqual(22);
      expect(p.potentialTier).toBe('legendary');
    }
    for (const r of Object.values(on.rosters)) expect(withinRules(r.players), r.teamId).toBe(true);
    // 유스 구단이 PL 팀이면 그 팀 (긱스 = 맨유, 제라드 = 리버풀)
    expect(Object.values(on.rosters).find((r) => r.players.some((p) => p.id === 'lg-giggs'))?.teamId).toBe('mun');
    expect(Object.values(on.rosters).find((r) => r.players.some((p) => p.id === 'lg-gerrard'))?.teamId).toBe('liv');
    // 세이브 왕복 그대로
    const back = deserialize(serialize(on));
    expect(back.legends).toBe(true);
    expect(JSON.stringify(back.rosters)).toBe(JSON.stringify(on.rosters));
  });

  it('시작 OVR = 전성기 − 나이별 모자람 (전성기 OVR 88~96), 30세 근처에 전성기에 닿는다', () => {
    for (const l of LEGENDS) {
      const peak = legendPeak(l).ovr;
      expect(peak).toBeGreaterThanOrEqual(BALANCE.legends.minPeak);
      expect(peak).toBeLessThanOrEqual(BALANCE.legends.maxPeak);
      const p = legendRosterPlayer(l, 'c47-gap', 2018);
      expect(Math.abs(naturalOvr(p) - (peak - legendGap(p.age)))).toBeLessThanOrEqual(1);
    }
    const ws = 'c47-grow';
    const sp = legendSpawns(ws, 2018, TEAMS).filter((s) => s.player.age === 18).slice(0, 6);
    const diffs: number[] = [];
    const r = rebuildRosters(ws, undefined, 12, undefined, [], { on: true });
    for (const s of sp) {
      const p = Object.values(r).flatMap((x) => x.players).find((x) => x.id === s.player.id);
      if (p) diffs.push(naturalOvr(p) - s.player.peakOvr);
    }
    expect(diffs.length).toBeGreaterThan(0);
    const avg = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    expect(Math.abs(avg)).toBeLessThanOrEqual(3);
  });

  it('레전드로 시작: 그 구단 유스 출신 태그, 로스터에 같은 레전드는 없다', () => {
    const g = newGame({ mode: 'real', playerId: 'lg-zidane', seed: 'c47-zz', difficulty: 'normal' });
    expect(g.legends).toBe(true);
    expect(g.player.legendId).toBe('lg-zidane');
    expect(g.player.age).toBeGreaterThanOrEqual(15);
    expect(g.player.potentialTier).toBe('legendary');
    expect(g.player.tags.some((t) => t.id === 'academy' && t.club === g.player.teamId)).toBe(true);
    expect(Object.values(g.rosters).some((r) => r.players.some((p) => p.id === 'lg-zidane'))).toBe(false);
    const back = deserialize(serialize(g));
    expect(back.player.legendId).toBe('lg-zidane');
  });
});

const attrs = (v: number): FieldAttributes => Object.fromEntries(FIELD_ATTRIBUTES.map((a) => [a, v])) as FieldAttributes;
const sum = (a: FieldAttributes) => FIELD_ATTRIBUTES.reduce((t, k) => t + a[k], 0);

/** 30세부터 to 세까지 노화 하락 합 (평균, 여러 시드) */
function agingLoss(to: number, mul: number, bloomer: boolean): number {
  let total = 0;
  const N = 40;
  for (let k = 0; k < N; k++) {
    const a = attrs(80);
    const rng = createRng(1000 + k);
    const used = { phys: false, other: false };
    for (let age = 30; age <= to; age++) {
      const skip: { phys?: boolean; other?: boolean } = {};
      if (bloomer) {
        // lateBloomerSkip 과 같은 규칙: 그 묶음 노화가 처음 시작되는 시즌에 1회
        if (!used.phys && age >= BALANCE.aging.physical[0]![0]) { skip.phys = true; used.phys = true; }
        if (!used.other && age >= BALANCE.aging.other[0]![0]) { skip.other = true; used.other = true; }
      }
      applyAging(a, age, rng, undefined, mul, skip);
    }
    total += 80 * 25 - sum(a);
  }
  return total / N;
}

describe('노익장·늦게 핀 꽃 (C.47, pending 66·67)', () => {
  it('노익장 ×0.7 이 30~34세에서 늦게 핀 꽃(첫 노화 1회 면제)보다 많이 아낀다', () => {
    expect(BALANCE.tags.effects.evergreenAging).toBe(0.7);
    const base = agingLoss(34, 1, false);
    const ever = base - agingLoss(34, 0.7, false);
    const bloom = base - agingLoss(34, 1, true);
    expect(bloom).toBeGreaterThan(0);
    expect(ever).toBeGreaterThan(bloom);
  });

  function me(o: Partial<PlayerState> = {}): PlayerState {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'c47-me', difficulty: 'normal' });
    return Object.assign(g.player, o);
  }
  const rec = (season: number, position: PlayerState['position'], rating: number, ovr: number): SeasonRecord => ({
    ...emptySeasonStats(), apps: 30, ratingSum: rating * 30, season, age: 25, teamId: 'mun', leaguePosition: 5, achievementXp: 0, ovr, reputation: 0, position,
  });

  it('노익장: 30세 이후 평점 7.0+ 에 붙고 (29세는 안 붙음), 2시즌 연속 6.5 미만이면 떨어진다', () => {
    const p = me();
    p.season = { ...emptySeasonStats(), apps: 30, ratingSum: 7.2 * 30 };
    const ch = { added: [] as PlayerTag[], removed: [] as PlayerTag[] };
    judgeEvergreen(p, 2030, 29, 75, ch);
    expect(ch.added).toHaveLength(0);
    judgeEvergreen(p, 2031, 30, 75, ch);
    expect(p.tags.some((t) => t.id === 'evergreen' && !t.perm)).toBe(true);
    p.history.push(rec(2031, 'CM', 6.3, 75));
    p.season = { ...emptySeasonStats(), apps: 30, ratingSum: 6.2 * 30 };
    judgeEvergreen(p, 2032, 31, 74, ch);
    expect(p.tags.some((t) => t.id === 'evergreen')).toBe(false);
  });

  it('늦게 핀 꽃: 한 포지션군 3시즌 뒤 전환, 새 포지션 첫 시즌 평점 +0.3 이상 → 붙고, 신체·기술멘탈 첫 노화 1회만 면제', () => {
    const p = me({ position: 'RB' });
    p.history = [rec(2020, 'RW', 6.6, 74), rec(2021, 'RW', 6.7, 75), rec(2022, 'RW', 6.5, 75)];
    p.season = { ...emptySeasonStats(), apps: 30, ratingSum: 7.1 * 30 };
    const ch = { added: [] as PlayerTag[], removed: [] as PlayerTag[] };
    judgeLateBloomer(p, 2023, 76, ch);
    expect(p.tags.some((t) => t.id === 'lateBloomer' && t.perm)).toBe(true);
    expect(lateBloomerSkip(p, 29)).toEqual({});
    expect(lateBloomerSkip(p, 30)).toEqual({ phys: true });
    expect(lateBloomerSkip(p, 31)).toEqual({});
    expect(lateBloomerSkip(p, 33)).toEqual({ other: true });
    expect(lateBloomerSkip(p, 34)).toEqual({});
  });
});

describe('커리어 태그 효과 (C.47, pending 64): 그 구단에 있을 때만', () => {
  const tags = (...t: PlayerTag[]) => ({ tags: t });
  it('원클럽맨·영원한·아카데미: 그 구단에서만 켜지고 다른 구단이면 0', () => {
    const one = tags({ id: 'oneClubMan', perm: false, season: 2018, club: 'mun' });
    expect(startBonus(one, 'mun')).toBe(BALANCE.tags.story.oneClubStart);
    expect(startBonus(one, 'liv')).toBe(0);
    expect(storyProfMul(one, 'mun')).toBeCloseTo(1.15);
    expect(storyProfMul(one, 'liv')).toBe(1);
    const et = tags({ id: 'eternal', perm: false, season: 2018, club: 'liv' }, { id: 'academy', perm: true, season: 2018, club: 'liv' });
    expect(oneClubLevel(et, 'liv')).toBe(1.5);
    expect(startBonus(et, 'liv')).toBe(3 + 1);
    expect(noAdaptation(et, 'liv', 2019)).toBe(true);
    expect(noAdaptation(et, 'mun', 2019)).toBe(false);
  });

  it('무한한 충성심 첫 시즌 첫 10경기 폼 +, 방출의 설움: 방출 구단 상대 폼 +, 첫 2시즌 XP ×1.05', () => {
    const p = { ...tags({ id: 'loyalReturn', perm: true, season: 2020, club: 'ars' }, { id: 'releasedPain', perm: true, season: 2018, club: 'ars', from: 'che' }), clubRun: { club: 'ars', since: 2021 } };
    expect(storyForm(p, 'ars', 'liv', 2021, 3)).toBeCloseTo(0.1);
    expect(storyForm(p, 'ars', 'che', 2021, 3)).toBeCloseTo(0.2);
    expect(storyForm(p, 'ars', 'liv', 2021, 12)).toBe(0);
    expect(storyForm(p, 'ars', 'liv', 2022, 3)).toBe(0);
    expect(storyXpMul(p, 'ars', 2022)).toBe(1.05);
    expect(storyXpMul(p, 'ars', 2023)).toBe(1);
    expect(storyXpMul(p, 'che', 2021)).toBe(1);
  });
});

describe('세이브 26 → 27 (C.47)', () => {
  it('레전드 팩 끔으로 변환, 왕복 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c47-mig', difficulty: 'normal' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 26;
    delete raw.legends;
    const back = deserialize(JSON.stringify(raw));
    expect(SAVE_FORMAT_VERSION).toBe(29);
    expect(back.saveFormat).toBe(29);
    expect(back.legends).toBe(false);
    expect(JSON.stringify(back.rosters)).toBe(JSON.stringify(g.rosters));
  });
});

describe('자연 발생 태그 (C.47, pending 65)', () => {
  const input = (o: Partial<NaturalInput> = {}): NaturalInput => ({
    season: 2020, age: 24, ovr: 75, log: [], myId: 'me', rounds: 38,
    goals: () => null, isDerby: () => false, rank: () => 10, formerClubs: [], clubs: 1, maxGoals: 99, maxAssists: 99, ...o,
  });
  const ch = () => ({ added: [] as PlayerTag[], removed: [] as PlayerTag[] });
  function me(): PlayerState {
    return newGame({ mode: 'prospect', position: 'ST', seed: 'c47-nat', difficulty: 'normal' }).player;
  }
  const game = (n: number, o: Partial<NaturalInput['log'][number]> = {}) => Array.from({ length: n }, (_, i) => ({
    opponentId: 'liv', minutes: 90, started: true, goals: 0, goalsAgainst: 1, rating: 7, round: i + 1, ...o,
  }));

  it('80분 이후 결승골·동점골 판정', () => {
    // 1-0 (85분 내 결승골)
    expect(lateDecisive([[85, 0, 'me', null]], 0, 'me', 80)).toBe(1);
    // 0-1 뒤 88분 동점
    expect(lateDecisive([[10, 1, 'x', null], [88, 0, 'me', null]], 0, 'me', 80)).toBe(1);
    // 3-0 의 세 번째 골은 아님
    expect(lateDecisive([[10, 0, 'a', null], [20, 0, 'b', null], [85, 0, 'me', null]], 0, 'me', 80)).toBe(0);
    // 70분 골은 아님
    expect(lateDecisive([[70, 0, 'me', null]], 0, 'me', 80)).toBe(0);
  });

  it('원더키드(20세 이하 10골) → 21세에 원더키드 출신, 득점 1위 = 득점 기계 ×2 와 위상 +10', () => {
    const p = me();
    p.season = { ...emptySeasonStats(), apps: 30, goals: 12, ratingSum: 30 * 6.9 };
    const c = ch();
    judgeNatural(p, input({ age: 19, maxGoals: 12, log: game(30) }), c);
    expect(p.tags.some((t) => t.id === 'wonderkid')).toBe(true);
    expect(p.tags.find((t) => t.id === 'goalMachine')).toBeTruthy();
    const rep = p.reputation;
    judgeNatural(p, input({ age: 21, maxGoals: 12, log: game(30) }), c);
    expect(p.tags.some((t) => t.id === 'wonderkid')).toBe(false);
    expect(p.tags.some((t) => t.id === 'wonderkidFormer')).toBe(true);
    expect(p.tags.find((t) => t.id === 'goalMachine')?.name).toBe('득점 기계 ×2');
    expect(p.reputation).toBe(rep + BALANCE.tags.natural.recordRep);
  });

  it('더비 통산 5골 = 더비 영웅(기록형), 교체 5골 = 슈퍼 서브(유지형, 다음 시즌 2골 미만이면 해제), 시즌 경고 10장 = 문제아', () => {
    const p = me();
    p.season = { ...emptySeasonStats(), apps: 25, yellows: 10, ratingSum: 25 * 6.8 };
    const c = ch();
    const log = [...game(5, { goals: 1, started: false, minutes: 25 }), ...game(20)];
    judgeNatural(p, input({ log, isDerby: (o) => o === 'liv' }), c);
    expect(p.tags.map((t) => t.id)).toEqual(expect.arrayContaining(['derbyHero', 'superSub', 'troublemaker']));
    judgeNatural(p, input({ log: game(20, { opponentId: 'bur' }) }), c);
    expect(p.tags.some((t) => t.id === 'superSub')).toBe(false);
    expect(p.tags.some((t) => t.id === 'derbyHero')).toBe(true);
    expect(tagChangeLine(c)).toContain('−슈퍼 서브');
  });

  it('5개 구단 = 저니맨 → 적응기 ×0.7, 신사 = 경고 ×0.8', () => {
    const p = me();
    p.season = { ...emptySeasonStats(), apps: 30, ratingSum: 30 * 6.8 };
    judgeNatural(p, input({ clubs: 5, log: game(30) }), ch());
    expect(p.tags.some((t) => t.id === 'journeyman')).toBe(true);
    expect(cardMul({ tags: [{ id: 'gentleman', perm: false, season: 2020 }] })).toBeCloseTo(0.8);
  });

  it('시즌을 돌리면 태그 판정이 돌아가고 세이브 왕복 그대로 (자연 발생 누적 포함)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c47-season', difficulty: 'normal', legends: true });
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    expect(g.player.tagStats).toBeTruthy();
    const back = deserialize(serialize(g));
    expect(back.player.tagStats).toEqual(g.player.tagStats);
    expect(back.player.tags).toEqual(g.player.tags);
  });
});
