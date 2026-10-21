// C.77n 컵 경기 피로·전술별 누적 부하 (pending 142b): NPC 컵·챔스 간이 경기 피로, 시즌 누적 부하 → 부상 확률·노쇠, 세이브 이전
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { createTeamRoster } from '../src/roster';
import { npcFatigueOn, type NpcFitMap } from '../src/npcFit';
import { npcQuickMatch, quickLines } from '../src/npcQuick';
import { closeNpcLoadSeason, loadInjuryMul, matchLoad, seasonWear, tendencyLoad, wearAging, type NpcLoadMap } from '../src/load';
import { agingRate, agingRateShifted } from '../src/growth';
import { injuryChance } from '../src/injury';
import { growNpc } from '../src/npc';
import { positionOvr } from '../src/positions';
import { ENGINE } from '../src/engine/config';
import { harnessUcl } from '../scripts/engine/job';
import { buildSchedule } from '../src/league';
import { seasonCalendar } from '../src/calendar';
import { createRng, hashSeed } from '../src/rng';
import { newGame, SAVE_FORMAT_VERSION } from '../src/game';
import { migrate, serialize } from '../src/save';

const G = newGame({ mode: 'prospect', position: 'ST', seed: 'c77n-g', difficulty: 'normal' });
const roster = (id: string, seed: string) => createTeamRoster({ id, rating: 80 }, seed, 2018, []);

describe('C.77n NPC 컵 간이 경기 피로', () => {
  it('선발 11명에게 90분 기준 거리 피로(perMatch90)가 쌓이고 부하 1 × 성향 계수', () => {
    const r = roster('t', 'c77n-q');
    const map: NpcFitMap = {};
    const load: NpcLoadMap = {};
    const lines = npcQuickMatch(map, load, [r], 100, 'c77n-q', 1);
    expect(lines).toHaveLength(11);
    for (const l of lines) {
      expect(npcFatigueOn(map[l.id], 100)).toBeCloseTo(BALANCE.fatigue.perMatch90, 1);
      expect(load[l.id]![0]).toBeGreaterThan(0.8);
      expect(load[l.id]![0]).toBeLessThan(1.2);
    }
  });

  it('주 2경기(3·4일 간격)면 주전이 2주 안에 피로 50 을 넘어 다음 간이 경기 선발에서 빠진다(로테이션)', () => {
    const r = roster('t', 'c77n-rot');
    const map: NpcFitMap = {};
    const first = new Set(quickLines(r, map, 0).map((l) => l.id));
    let day = 0;
    let rotated = false;
    for (let k = 0; k < 5 && !rotated; k++) {
      npcQuickMatch(map, undefined, [r], day, 'c77n-rot', k);
      day += k % 2 ? 4 : 3;
      const now = quickLines(r, map, day).map((l) => l.id);
      rotated = now.some((id) => !first.has(id));
    }
    expect(rotated).toBe(true);
  });

  it('npc.cup = false 면 아무것도 쌓지 않는다 (C.77m 경로)', () => {
    const N = BALANCE.fatigue.npc as { cup: boolean };
    N.cup = false;
    try {
      const map: NpcFitMap = {};
      expect(npcQuickMatch(map, {}, [roster('t', 'c77n-off')], 0, 's', 1)).toEqual([]);
      expect(map).toEqual({});
    } finally {
      N.cup = true;
    }
  });

  it('측정 하네스 챔스 일정: 상위 4팀 조별 6 + 녹아웃, 그 팀 리그 경기와 같은 날 없음', () => {
    const ids = ['mci', 'liv', 'tot', 'mun', 'che', 'ars', 'eve', 'lei', 'wol', 'wat', 'whu', 'bou', 'cry', 'new', 'bur', 'sou', 'bha', 'ful', 'car', 'hud'];
    const schedule = buildSchedule(ids, createRng(hashSeed('c77n-h:season-schedule')));
    const cal = seasonCalendar('c77n-h', 2018, schedule);
    const u = harnessUcl('c77n-h', ids, schedule, cal.fixtureDates);
    for (const t of BALANCE.cups.ucl.firstSeason) {
      const mine = u.filter((x) => x.team === t);
      expect(mine.length).toBeGreaterThanOrEqual(6);
      expect(mine.length).toBeLessThanOrEqual(12);
      const league = new Set<string>();
      schedule.forEach((round, ri) => round.forEach((f, i) => { if (f.home === t || f.away === t) league.add(cal.fixtureDates[ri]![i]!); }));
      for (const m of mine) expect(league.has(m.date)).toBe(false);
    }
  });
});

describe('C.77n 시즌 누적 부하', () => {
  it('경기 부하 = 분 × 거리 × 성향, 게겐 > 균형 > 블록', () => {
    expect(matchLoad(90, ENGINE.match.fatigueRefDistance, 1)).toBeCloseTo(1, 5);
    expect(matchLoad(45, undefined, 1)).toBeCloseTo(0.5, 5);
    expect(matchLoad(0, 9000, 1)).toBe(0);
    expect(tendencyLoad('gegenpress')).toBeGreaterThan(tendencyLoad('balanced'));
    expect(tendencyLoad('balanced')).toBeGreaterThan(tendencyLoad('block'));
    expect(tendencyLoad('unknown')).toBe(1);
  });

  it('부상 확률: 시즌 부하 injuryFrom 이하면 그대로, 넘으면 가산 (내 선수·NPC 같은 injuryChance)', () => {
    const L = BALANCE.load;
    expect(loadInjuryMul(undefined)).toBe(1);
    expect(loadInjuryMul(L.injuryFrom)).toBe(1);
    expect(loadInjuryMul(L.injuryFrom + 30)).toBeCloseTo(1 + 30 * L.injuryPerPoint, 6);
    const p = { attributes: G.player.attributes, age: 25, fatigue: 0 };
    const base = injuryChance(p, 90, 'normal');
    expect(injuryChance({ ...p, load: L.injuryFrom + 30 }, 90, 'normal')).toBeCloseTo(base * (1 + 30 * L.injuryPerPoint), 9);
  });

  it('시즌 끝: 부하 → 마모 (wearFrom 초과분), 마모 0 기록은 지운다', () => {
    const map: NpcLoadMap = { a: [45, 2], b: [20, 0], c: [10, 5] };
    closeNpcLoadSeason(map);
    expect(map.a).toEqual([0, 2 + 45 - BALANCE.load.wearFrom]);
    expect(map.b).toBeUndefined();
    expect(map.c).toEqual([0, 5]);
    expect(seasonWear(BALANCE.load.wearFrom - 1)).toBe(0);
  });

  it('마모 → 노쇠: 나이 앞당김(상한)·속도 배율, 곡선 보간', () => {
    expect(wearAging(0)).toEqual({ shift: 0, mul: 1 });
    expect(wearAging(1e6).shift).toBe(BALANCE.load.maxShift);
    expect(wearAging(1e6).mul).toBeCloseTo(1 + BALANCE.load.maxRate, 9);
    const curve = BALANCE.aging.physical;
    expect(agingRateShifted(curve, 29, 0)).toBe(agingRate(curve, 29));
    expect(agingRateShifted(curve, 29, 1)).toBe(agingRate(curve, 30));
    expect(agingRateShifted(curve, 29, 0.5)).toBeCloseTo((agingRate(curve, 29) + agingRate(curve, 30)) / 2, 9);
  });

  it('같은 NPC 를 29~35세로 키우면 마모가 큰 쪽이 30대 OVR 이 더 낮다 (여러 선수 평균)', () => {
    let lo = 0;
    let hi = 0;
    for (const src of G.npcs.slice(0, 40)) {
      const n0 = { ...src, age: 29, peakAge: 27, retired: false, attributes: { ...src.attributes } };
      let a = n0;
      let b = n0;
      for (let s = 0; s < 6; s++) {
        a = growNpc(a, 'c77n-age', 2018 + s, 0);
        b = growNpc(b, 'c77n-age', 2018 + s, 60);
      }
      lo += positionOvr(a.attributes, n0.position);
      hi += positionOvr(b.attributes, n0.position);
    }
    expect(hi).toBeLessThan(lo);
  });
});

describe('C.77n 세이브', () => {
  it(`세이브 형식 ${SAVE_FORMAT_VERSION}: npcLoad·player.load·wear 저장, 옛 세이브(55) 이전`, () => {
    expect(SAVE_FORMAT_VERSION).toBe(56);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c77n-s', difficulty: 'normal' });
    g.npcLoad = { x: [12.5, 3] };
    g.player.load = 4;
    g.player.wear = 1.5;
    const old = JSON.parse(serialize(g));
    expect(old.npcLoad).toEqual({ x: [12.5, 3] });
    expect(old.player.wear).toBe(1.5);
    old.saveFormat = 55;
    delete old.npcLoad;
    const m = migrate(old);
    expect(m.saveFormat).toBe(56);
    expect(m.npcLoad).toEqual({});
  });
});
