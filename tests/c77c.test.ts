// C.77c NPC 출전율·결장 (엔진관리자8 §9.15.9 권장 A): 경기당 결장 확률 npcAbsentP 의 결정적 추첨, 인원 보장, 측정·본편 공통 경로
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { npcAbsences, npcTeamSetup, teamSetupFromRoster } from '../src/engine/setup';
import { playNpcMatch } from '../src/engine/npcMatch';
import { createTeamRoster } from '../src/roster';

const roster = (id: string, seed: string) => createTeamRoster({ id, rating: 80 }, seed, 2018, []);

describe('C.77c NPC 결장 추첨', () => {
  it('상수: absentP 0.08 (부상 0.04 + 로테이션 0.04), 최소 인원 14', () => {
    expect(BALANCE.roster.npcAbsentP).toBe(0.08);
    expect(BALANCE.roster.npcAbsentMin).toBe(14);
  });

  it('같은 (worldSeed, 경기 시드) 면 같은 결장, 시드가 다르면 다른 결장', () => {
    const r = roster('t1', 'c77c-a');
    const a = npcAbsences(r, 'w1', 5);
    expect([...npcAbsences(r, 'w1', 5)]).toEqual([...a]);
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => [...npcAbsences(r, 'w1', s)].join(','));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it('결장률은 경기당 약 8% (선수 24명 × 경기 400 표본), 0 이면 결장 없음', () => {
    const r = roster('t2', 'c77c-b');
    let n = 0;
    for (let s = 0; s < 400; s++) n += npcAbsences(r, 'w2', s).size;
    const rate = n / (400 * r.players.length);
    expect(rate).toBeGreaterThan(0.06);
    expect(rate).toBeLessThan(0.10);
    expect(npcAbsences(r, 'w2', 1, 0).size).toBe(0);
  });

  it('인원 보장: 남는 인원 ≥ npcAbsentMin, 마지막 GK 는 결장하지 않는다 (확률 1 로 극단 검사)', () => {
    const r = roster('t3', 'c77c-c');
    const abs = npcAbsences(r, 'w3', 9, 1);
    expect(r.players.length - abs.size).toBe(BALANCE.roster.npcAbsentMin);
    const gkLeft = r.players.filter((p) => p.position === 'GK' && !abs.has(p.id)).length;
    expect(gkLeft).toBeGreaterThanOrEqual(1);
    const lu = teamSetupFromRoster(r, 80, 80, 'w3', abs);
    expect(lu.lineup.length).toBe(11);
    expect(lu.lineup.every((p) => !abs.has(p.id))).toBe(true);
  });

  it('npcTeamSetup: 결장 선수는 선발·벤치에서 빠지고 11명이 채워진다', () => {
    const r = roster('t4', 'c77c-d');
    let seed = 0;
    let abs = npcAbsences(r, 'w4', seed);
    while (!abs.size && seed < 200) abs = npcAbsences(r, 'w4', ++seed);
    expect(abs.size).toBeGreaterThan(0);
    const s = npcTeamSetup(r, 80, 80, 'w4', seed, 75);
    expect(s.lineup.length).toBe(11);
    for (const p of [...s.lineup, ...s.bench]) expect(abs.has(p.id)).toBe(false);
    // 결장이 없는 선발(기존 경로)과는 다르다
    const base = teamSetupFromRoster(r, 80, 80, 'w4', undefined, 75);
    expect(s.lineup.map((p) => p.id).sort()).not.toEqual(base.lineup.map((p) => p.id).sort());
  });

  it('playNpcMatch: 같은 입력이면 같은 결과 (결정성 유지)', () => {
    const input = { home: roster('h', 'c77c-h'), away: roster('a', 'c77c-aw'), homeRating: 80, awayRating: 78, seed: 123, worldSeed: 'w5', leagueAvg: 75 };
    expect(playNpcMatch(input)).toEqual(playNpcMatch(input));
  });
});
