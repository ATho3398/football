import { describe, expect, it } from 'vitest';
import { A_GRADE_PLAYERS } from '../data/players';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, rebuildRosters, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { initialTeams } from '../src/league';
import { PLAYABLE_POSITIONS, positionOvr } from '../src/positions';
import { createRng } from '../src/rng';
import {
  attributesFromOvr, capVirtualAttributes, gkAttributesFromOvr, gkOvr, naturalOvr, pickLineup, posGroup, rosterRating,
} from '../src/roster';
import { deserialize, serialize } from '../src/save';

function playSeason(s: GameState) {
  while (s.phase === 'season') playRound(s, { engine: 'quick' });
}

describe('능력치 자동 생성 (23번)', () => {
  it('포지션 + 목표 OVR 로 만든 능력치는 그 OVR 이 된다', () => {
    const rng = createRng(7);
    for (const pos of PLAYABLE_POSITIONS) {
      for (const ovr of [55, 67, 75, 85, 92]) expect(positionOvr(attributesFromOvr(pos, ovr, rng), pos)).toBe(ovr);
    }
    for (const type of ['classic', 'sweeper'] as const) {
      for (const ovr of [60, 72, 88]) expect(gkOvr(gkAttributesFromOvr(type, ovr, rng), type)).toBe(ovr);
    }
  });
});

describe('팀 로스터 생성 (23번)', () => {
  const g = newGame({ mode: 'prospect', position: 'CM', seed: 'roster', difficulty: 'normal' });
  const init = Object.fromEntries(initialTeams().map((t) => [t.id, t.rating]));

  it('팀당 24명, 포지션 구성 GK3 CB4 풀백4 CDM2 CM3 CAM2 윙3 ST3 (실제 선수가 넘치지 않는 팀)', () => {
    expect(Object.keys(g.rosters)).toHaveLength(20);
    for (const r of Object.values(g.rosters)) {
      expect(r.players).toHaveLength(24);
      expect(new Set(r.players.map((p) => p.id)).size).toBe(24);
      expect(r.players.filter((p) => p.position === 'GK')).toHaveLength(3);
    }
    const counts: Record<string, number> = {};
    for (const p of g.rosters.hud!.players) counts[posGroup(p.position)] = (counts[posGroup(p.position)] ?? 0) + 1;
    expect(counts).toEqual(BALANCE.roster.squad);
  });

  it('팀 레이팅(라인업 11명 평균)이 기존 팀 레이팅 ±0.5 이내 (여러 시드, 실제 선수 모드 포함). 가상 선수 상한(E.24) 때문에 실제 선수가 있는 팀만 더 낮을 수 있다', () => {
    const games = [
      g,
      newGame({ mode: 'prospect', position: 'ST', seed: 'r2', difficulty: 'normal' }),
      newGame({ mode: 'real', playerId: 'kane', seed: 'r3', difficulty: 'normal' }),
      newGame({ mode: 'real', playerId: 'salah', seed: 'r4', difficulty: 'normal' }),
    ];
    for (const s of games) {
      for (const t of s.league.teams) {
        const r = s.rosters[t.id]!;
        const diff = rosterRating(r) - init[t.id]!;
        expect(diff).toBeLessThanOrEqual(0.5);
        if (diff < -0.5) {
          const reals = r.players.filter((p) => p.real).map(naturalOvr);
          expect(reals.length).toBeGreaterThan(0);
          for (const p of r.players.filter((x) => !x.real)) expect(naturalOvr(p)).toBeLessThanOrEqual(Math.max(...reals));
        }
        expect(t.rating).toBe(rosterRating(r));
      }
    }
  });

  it('가상 선수는 그 팀 실제 주전 평균 OVR 을 넘지 않는다 (E.24 3번)', () => {
    for (const t of g.league.teams) {
      const r = g.rosters[t.id]!;
      const starters = r.players.filter((p) => p.real).map(naturalOvr).filter((v) => v >= init[t.id]! - BALANCE.roster.virtualCapStarterGap);
      if (!starters.length) continue;
      const cap = Math.floor(starters.reduce((a, b) => a + b, 0) / starters.length);
      for (const p of r.players.filter((x) => !x.real)) expect(naturalOvr(p)).toBeLessThanOrEqual(cap);
    }
  });

  it('가상 선수 각 능력치 ≤ 자기 OVR + virtualAttrOverOvr, 실제 주전이 있는 팀은 ≤ max(실제 선수 같은 능력치 최대값, OVR 상한) (E.25 1번, C.21)', () => {
    const over = BALANCE.roster.virtualAttrOverOvr;
    const games = [g, newGame({ mode: 'real', playerId: 'salah', seed: 'r4', difficulty: 'normal' })];
    let capped = 0;
    for (const s of games) {
      for (const t of s.league.teams) {
        const r = s.rosters[t.id]!;
        const reals = r.players.filter((p) => p.real);
        const hasStarter = reals.some((p) => naturalOvr(p) >= init[t.id]! - BALANCE.roster.virtualCapStarterGap);
        for (const p of r.players.filter((x) => !x.real)) {
          const lim = naturalOvr(p) + over;
          const vals = p.gk ? Object.values(p.gk.attrs) : Object.values(p.attributes!);
          for (const v of vals) expect(v).toBeLessThanOrEqual(lim);
          if (!p.attributes || !hasStarter) continue;
          const starters = reals.map(naturalOvr).filter((v) => v >= init[t.id]! - BALANCE.roster.virtualCapStarterGap);
          const floor = Math.floor(starters.reduce((a, b) => a + b, 0) / starters.length);
          for (const [a, v] of Object.entries(p.attributes)) {
            const max = Math.max(floor, ...reals.map((x) => x.attributes![a as keyof typeof p.attributes]));
            expect(v).toBeLessThanOrEqual(max);
          }
          capped++;
        }
      }
    }
    expect(capped).toBeGreaterThan(0);
    // 리버풀 생성 ST: 슈팅이 살라·피르미누·마네 최고치를 넘지 않는다 (C.20 v:liv:17 슈팅 91)
    const liv = g.rosters.liv!.players;
    const realShot = Math.max(...liv.filter((p) => p.real).map((p) => p.attributes!.shooting));
    for (const p of liv.filter((x) => !x.real && x.attributes)) expect(p.attributes!.shooting).toBeLessThanOrEqual(realShot);
  });

  it('capVirtualAttributes: 깎기만 하고 다른 능력치로 옮기지 않는다', () => {
    const p = g.rosters.bur!.players.find((x) => !x.real && x.position === 'ST')!;
    const copy = { ...p, attributes: { ...p.attributes! } };
    copy.attributes.shooting = 99;
    const before = { ...copy.attributes };
    capVirtualAttributes(copy, { pace: 10 });
    // 최종 OVR 기준으로 상한이 지켜지고, 슈팅은 정확히 그 상한에 걸린다
    const lim = positionOvr(copy.attributes, 'ST') + BALANCE.roster.virtualAttrOverOvr;
    expect(copy.attributes.shooting).toBe(lim);
    for (const v of Object.values(copy.attributes)) expect(v).toBeLessThanOrEqual(lim);
    expect(copy.attributes.pace).toBe(Math.min(10, before.pace));
    for (const [a, v] of Object.entries(copy.attributes)) expect(v).toBeLessThanOrEqual(before[a as keyof typeof before]);
  });

  it('실제 A등급 선수는 소속팀 로스터에 있고, 내 선수(실제 선수)는 빠진다', () => {
    expect(g.rosters.liv!.players.filter((p) => p.real).map((p) => p.id).sort())
      .toEqual(['alexander-arnold', 'firmino', 'mane', 'salah', 'van-dijk']);
    const k = newGame({ mode: 'real', playerId: 'kane', seed: 'r3', difficulty: 'normal' });
    expect(k.rosters.tot!.players.find((p) => p.id === 'kane')).toBeUndefined();
    expect(g.rosters.tot!.players.find((p) => p.id === 'kane')?.real).toBe(true);
    // 리그 밖 클럽 선수는 로스터에 없다
    expect(Object.values(g.rosters).flatMap((r) => r.players).find((p) => p.id === 'messi')).toBeUndefined();
  });

  it('라인업 11명은 포메이션 슬롯을 채우고 GK 슬롯은 GK, 벤치 7명(GK 1 포함)은 겹치지 않는다', () => {
    for (const r of Object.values(g.rosters)) {
      const lu = pickLineup(r);
      expect(lu.slots).toHaveLength(11);
      expect(lu.bench).toHaveLength(7);
      const ids = [...lu.slots.map((s) => s.playerId), ...lu.bench];
      expect(new Set(ids).size).toBe(18);
      const gk = r.players.find((p) => p.id === lu.slots.find((s) => s.pos === 'GK')!.playerId)!;
      expect(gk.position).toBe('GK');
      expect(lu.bench.filter((id) => r.players.find((p) => p.id === id)!.position === 'GK')).toHaveLength(1);
    }
  });

  it('가상 선수: 나이 18~36, 충성도 0~100, 계약 만료 1~5년 후, 전성기 OVR ≥ 현재 OVR', () => {
    for (const p of Object.values(g.rosters).flatMap((r) => r.players).filter((x) => !x.real)) {
      expect(p.age).toBeGreaterThanOrEqual(18);
      expect(p.age).toBeLessThanOrEqual(36);
      expect(p.loyalty).toBeGreaterThanOrEqual(0);
      expect(p.loyalty).toBeLessThanOrEqual(100);
      expect(p.contractEnd - 2018).toBeGreaterThanOrEqual(1);
      expect(p.contractEnd - 2018).toBeLessThanOrEqual(5);
      expect(p.peakOvr).toBeGreaterThanOrEqual(naturalOvr(p));
      expect(p.nameKo.length).toBeGreaterThan(0);
    }
  });

  it('같은 시드면 같은 로스터', () => {
    const again = newGame({ mode: 'prospect', position: 'CM', seed: 'roster', difficulty: 'normal' });
    expect(again.rosters).toEqual(g.rosters);
    const other = newGame({ mode: 'prospect', position: 'CM', seed: 'roster-x', difficulty: 'normal' });
    expect(other.rosters).not.toEqual(g.rosters);
  });
});

describe('로스터 시즌 갱신과 저장 (23번)', () => {
  it('시즌 종료 후 나이 +1, 은퇴 자리는 신인으로 보충, 24명 유지, 다음 시즌 레이팅은 로스터에서', () => {
    const s = newGame({ mode: 'prospect', position: 'CB', seed: 'season', difficulty: 'normal' });
    const before = structuredClone(s.rosters);
    playSeason(s);
    expect(s.roster.updates).toBe(1);
    let rookies = 0;
    for (const [id, r] of Object.entries(s.rosters)) {
      expect(r.players).toHaveLength(24);
      for (const p of r.players) {
        const old = before[id]!.players.find((x) => x.id === p.id);
        if (old) expect(p.age).toBe(old.age + 1);
        else rookies++;
      }
    }
    expect(rookies).toBeGreaterThan(0);
    startNextSeason(s);
    for (const t of s.league.teams) expect(Math.abs(t.rating - rosterRating(s.rosters[t.id]!))).toBeLessThan(BALANCE.roster.seasonFormSd * 4);
  });

  it('세이브에는 로스터를 담지 않고, 불러오면 시드로 같은 로스터를 다시 만든다', () => {
    const s = newGame({ mode: 'real', playerId: 'rashford', seed: 'save', difficulty: 'normal' });
    playSeason(s);
    startNextSeason(s);
    for (let i = 0; i < 5; i++) playRound(s);
    const json = serialize(s);
    expect(json).not.toContain('"rosters"');
    const loaded = deserialize(json);
    expect(loaded.rosters).toEqual(s.rosters);
    // 세이브 크기: 로스터 480명을 담지 않으므로 작다 (C.30: 이번 시즌 경기 목록이 한 시즌 최대 약 15KB 더해진다)
    expect(json.length).toBeLessThan(60_000);
  });

  it('형식 4 세이브를 열면 지난 시즌 수만큼 갱신한 로스터가 생긴다', () => {
    const s = newGame({ mode: 'prospect', position: 'LW', seed: 'mig', difficulty: 'normal' });
    playSeason(s);
    const raw = JSON.parse(serialize(s));
    delete raw.roster;
    raw.saveFormat = 4;
    const loaded = deserialize(JSON.stringify(raw));
    expect(loaded.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(loaded.roster.updates).toBe(1);
    expect(loaded.rosters).toEqual(rebuildRosters('mig', undefined, 1, s.npcs));
    expect(loaded.rosters).toEqual(s.rosters);
  });

  it('20시즌 뒤에도 팀 레이팅이 장기 평균에서 크게 벗어나지 않는다', () => {
    const r = rebuildRosters('long', undefined, 20);
    const base = initialTeams();
    const drift = base.map((t) => rosterRating(r[t.id]!) - t.baseRating);
    const mean = drift.reduce((a, b) => a + b, 0) / drift.length;
    expect(Math.abs(mean)).toBeLessThan(2.5);
    for (const d of drift) expect(Math.abs(d)).toBeLessThan(7);
    expect(A_GRADE_PLAYERS.length).toBeGreaterThan(0);
  });
});
