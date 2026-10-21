// C.77m NPC 피로·피로 수치 상향 (pending 142a): 경기당 피로↑·훈련날 회복↓, NPC 피로 누적·회복·로테이션·피로 부상, 세이브 이전
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { npcTeamSetup, teamSetupFromRoster } from '../src/engine/setup';
import { playNpcMatch } from '../src/engine/npcMatch';
import { ENGINE } from '../src/engine/config';
import { createTeamRoster, pickLineup } from '../src/roster';
import { dayNum, npcAfterMatch, npcConditions, npcFatigueOn, npcInjuredOn, npcLines, npcSelectPenalty, type NpcFitMap } from '../src/npcFit';
import { planFatigue } from '../src/training';
import { newGame, otherJob, SAVE_FORMAT_VERSION, todaysOthers } from '../src/game';
import { migrate, serialize } from '../src/save';

const roster = (id: string, seed: string) => createTeamRoster({ id, rating: 80 }, seed, 2018, []);
const REF = ENGINE.match.fatigueRefDistance;

describe('C.77m 피로 수치', () => {
  it('경기당 30 · 주간 회복 21 = 기본 훈련 주(휴식 + 기술 4일 + 영상) 합계', () => {
    expect(BALANCE.fatigue.perMatch90).toBe(30);
    expect(BALANCE.fatigue.weeklyRecovery).toBe(21);
    expect(planFatigue('rest') + 4 * planFatigue('tech') + planFatigue('video')).toBeCloseTo(BALANCE.fatigue.weeklyRecovery, 5);
  });

  it('주 1경기 90분(기준 거리)이면 주전 아침 피로가 몇 주 뒤 penaltyFrom 을 넘고, 주 2경기면 2주 안에 넘는다', () => {
    const weeksTo = (perWeek: number, gaps: number[]) => {
      const map: NpcFitMap = {};
      const r = roster('t', 'c77m-w');
      const id = r.players[0]!.id;
      let day = 0;
      for (let w = 1; w <= 20; w++) {
        for (let k = 0; k < perWeek; k++) {
          if (npcFatigueOn(map[id], day) > BALANCE.fatigue.penaltyFrom) return w;
          map[id] = [Math.round((npcFatigueOn(map[id], day) + BALANCE.fatigue.perMatch90) * 10) / 10, day];
          day += gaps[k]!;
        }
      }
      return 99;
    };
    const one = weeksTo(1, [7]);
    expect(one).toBeGreaterThanOrEqual(4);
    expect(one).toBeLessThanOrEqual(9);
    expect(weeksTo(2, [3, 4])).toBeLessThanOrEqual(2);
  });
});

describe('C.77m NPC 피로·부상', () => {
  it('경기 뒤 거리 비례 피로, 하루 weeklyRecovery ÷ 7 회복, 같은 입력이면 같은 결과', () => {
    const r = roster('t1', 'c77m-a');
    const [a, b] = r.players;
    const run = () => {
      const map: NpcFitMap = {};
      npcAfterMatch(map, [r], [{ id: a!.id, minutes: 90, distance: REF }, { id: b!.id, minutes: 45, distance: REF / 2 }, { id: 'me', minutes: 90, distance: REF }], 100, 'w', 7);
      return map;
    };
    const m = run();
    expect(m[a!.id]![0]).toBeCloseTo(BALANCE.fatigue.perMatch90, 1);
    expect(m[b!.id]![0]).toBeCloseTo(BALANCE.fatigue.perMatch90 / 2, 1);
    expect(m.me).toBeUndefined();
    expect(run()).toEqual(m);
    expect(npcFatigueOn(m[a!.id], 107)).toBeCloseTo(BALANCE.fatigue.perMatch90 - BALANCE.fatigue.weeklyRecovery, 1);
    expect(npcFatigueOn(m[a!.id], 200)).toBe(0);
    // 이어 뛰면 쌓인다 (회복이 다 안 된 상태에서 + 경기 피로)
    npcAfterMatch(m, [r], [{ id: a!.id, minutes: 90, distance: REF }], 103, 'w', 8);
    expect(m[a!.id]![0]).toBeGreaterThan(BALANCE.fatigue.perMatch90 * 1.4);
  });

  it('피로 부상: 피로가 높을수록 부상이 잦고, 부상 선수는 복귀 날까지 결장 표시', () => {
    const r = roster('t2', 'c77m-b');
    const count = (start: number) => {
      let n = 0;
      for (let s = 0; s < 300; s++) {
        const map: NpcFitMap = Object.fromEntries(r.players.map((p) => [p.id, [start, 0]]));
        npcAfterMatch(map, [r], r.players.map((p) => ({ id: p.id, minutes: 90, distance: REF })), 0, 'w', s);
        n += r.players.filter((p) => npcInjuredOn(map[p.id], 1)).length;
      }
      return n;
    };
    const fresh = count(0);
    const tired = count(100);
    expect(fresh).toBeGreaterThan(0);
    // 피로 100 = × 1.4 (문턱 60, 기울기 0.01)
    expect(tired).toBeGreaterThan(fresh * 1.15);
  });

  it('로테이션: 지친 주전은 선발 점수가 깎여 벤치가 대신 나오고, 시작 스태미나가 낮다. 부상 선수는 빠진다', () => {
    const r = roster('t3', 'c77m-c');
    const base = pickLineup(r);
    const st = base.slots.find((s) => s.pos === 'ST')!;
    expect(npcSelectPenalty(BALANCE.fatigue.penaltyFrom)).toBe(0);
    expect(npcSelectPenalty(100)).toBeGreaterThan(10);
    const tired = teamSetupFromRoster(r, 80, 80, 'w', undefined, 75, true, { [st.playerId]: [100, 0] });
    expect(tired.lineup.some((p) => p.id === st.playerId)).toBe(false);
    const benchSpec = tired.bench.find((p) => p.id === st.playerId);
    if (benchSpec) expect(benchSpec.stamina).toBeLessThan(100);
    const mild = teamSetupFromRoster(r, 80, 80, 'w', undefined, 75, true, { [st.playerId]: [40, 0] });
    const spec = mild.lineup.find((p) => p.id === st.playerId)!;
    expect(spec.stamina).toBeCloseTo(100 - 40 * ENGINE.match.staminaPerFatigue, 5);
    const inj = npcTeamSetup(r, 80, 80, 'w', 1, 75, { [st.playerId]: [0, 1] });
    expect([...inj.lineup, ...inj.bench].some((p) => p.id === st.playerId)).toBe(false);
    expect(inj.lineup.length).toBe(11);
  });

  it('npcConditions: 피로 0·부상 없는 선수는 넣지 않고(쉬던 팀은 undefined), 그날 값으로 계산', () => {
    const r = roster('t4', 'c77m-d');
    const id = r.players[3]!.id;
    expect(npcConditions({}, [r], 10)).toBeUndefined();
    const map: NpcFitMap = { [id]: [30, 10] };
    expect(npcConditions(map, [r], 10)).toEqual({ [id]: [30, 0] });
    expect(npcConditions(map, [r], 30)).toBeUndefined();
  });

  it('playNpcMatch: 선수 기록에 이동 거리가 붙고(npcLines), cond 가 있으면 결과가 달라질 수 있지만 같은 입력이면 같다', () => {
    const input = { home: roster('h', 'c77m-h'), away: roster('a', 'c77m-aw'), homeRating: 80, awayRating: 78, seed: 321, worldSeed: 'w6', leagueAvg: 75 };
    const a = playNpcMatch(input);
    const lines = npcLines(a);
    expect(lines.every((l) => l.distance > 0)).toBe(true);
    const cond = Object.fromEntries(input.home.players.map((p) => [p.id, [80, 0] as [number, 0 | 1]]));
    expect(playNpcMatch({ ...input, cond })).toEqual(playNpcMatch({ ...input, cond }));
  });
});

describe('C.77m 본편 연결·세이브', () => {
  it('다른 경기 입력에 그날 아침 NPC 컨디션이 들어간다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c77m-g', difficulty: 'normal' });
    let others = todaysOthers(g);
    for (let k = 0; k < 30 && !others.length; k++) {
      g.calendar.date = new Date(Date.parse(g.calendar.date) + 86400000).toISOString().slice(0, 10);
      others = todaysOthers(g);
    }
    const [r, i] = others[0]!;
    const f = g.league.schedule[r]![i]!;
    const pid = g.rosters[f.home]!.players[0]!.id;
    expect(otherJob(g, r, i).input.cond).toBeUndefined();
    g.npcFit = { [pid]: [60, dayNum(g.calendar.date)] };
    expect(otherJob(g, r, i).input.cond?.[pid]?.[0]).toBeGreaterThan(0);
  });

  it(`세이브 형식 ${SAVE_FORMAT_VERSION}: npcFit 저장·옛 세이브(54) 이전`, () => {
    expect(SAVE_FORMAT_VERSION).toBe(55);
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c77m-s', difficulty: 'normal' });
    g.npcFit = { x: [12.5, 9000, 9010] };
    const old = JSON.parse(serialize(g));
    expect(old.npcFit).toEqual({ x: [12.5, 9000, 9010] });
    old.saveFormat = 54;
    delete old.npcFit;
    const m = migrate(old);
    expect(m.saveFormat).toBe(55);
    expect(m.npcFit).toEqual({});
  });
});
