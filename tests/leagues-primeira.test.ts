import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES, GK_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/primeira';
import { GOALKEEPERS, PLAYERS } from '../data/players/primeira';
import { stars } from '../data/players/stars';
import { messi } from '../data/players/messi';
import { LEGENDS, FUTURE_STARS } from '../data/players/legends';

// 45d5 리그 데이터 (부록 C.75r): 형식·id 중복·능력치 25개·팀 수 = 실제 참가 팀 수
describe('리그 데이터 primeira', () => {
  it('리그 정보와 실제 참가 팀 수 18', () => {
    expect(LEAGUE.id).toBe('primeira');
    expect(LEAGUE.country).toBe('Portugal');
    expect(LEAGUE.tier).toBe(1);
    expect(LEAGUE.teams).toHaveLength(18);
  });

  it('팀 id·이름 중복 없음, id 형식 <리그>:<3글자>, 레이팅 PL 척도 안', () => {
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^primeira:[a-z]{3}$/);
      expect(t.nameKo.length).toBeGreaterThan(0);
      expect(t.rating).toBeGreaterThanOrEqual(55);
      expect(t.rating).toBeLessThanOrEqual(86);
      expect(t.colors?.primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.colors?.secondary).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.manager && t.stadium && t.city).toBeTruthy();
    }
  });

  it('더비는 리그 팀끼리', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a) && ids.has(b) && a !== b).toBe(true);
    }
  });

  it('선수: id 중복 없음, 기존 선수와 겹치지 않음, 소속은 리그 팀', () => {
    const all = [...PLAYERS, ...GOALKEEPERS];
    expect(all.length).toBeGreaterThanOrEqual(25);
    expect(all.length).toBeLessThanOrEqual(40);
    const ids = all.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    const existingIds = new Set([messi, ...stars, ...LEGENDS, ...FUTURE_STARS].map((p) => p.id));
    const existingNames = new Set([messi, ...stars, ...LEGENDS, ...FUTURE_STARS].map((p) => p.name));
    const clubs = new Set(LEAGUE.teams.map((t) => t.name));
    for (const p of all) {
      expect(existingIds.has(p.id), p.id).toBe(false);
      expect(existingNames.has(p.name), p.name).toBe(false);
      expect(clubs.has(p.club), p.club).toBe(true);
      expect(p.league).toBe(LEAGUE.name);
    }
  });

  it('필드 선수 능력치 25개(1~99), GK 4개', () => {
    expect(FIELD_ATTRIBUTES).toHaveLength(25);
    for (const p of PLAYERS) {
      expect(Object.keys(p.attributes)).toHaveLength(25);
      for (const a of FIELD_ATTRIBUTES) {
        const v = p.attributes[a];
        expect(Number.isFinite(v) && v >= 1 && v <= 99, `${p.id} ${a}`).toBe(true);
      }
    }
    for (const g of GOALKEEPERS) {
      for (const a of GK_ATTRIBUTES) expect(g.gkAttributes[a]).toBeGreaterThan(0);
    }
  });
});
