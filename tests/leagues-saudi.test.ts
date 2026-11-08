// C.75s (45d6): saudi 리그·선수 데이터 파일 형식 확인 (게임 연결은 45b)
import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/saudi';
import { PLAYERS } from '../data/players/saudi';
import { stars } from '../data/players/stars';
import { messi } from '../data/players/messi';
import { FUTURE_STARS, LEGENDS } from '../src/legends';

describe('리그 데이터 saudi', () => {
  it('실제 참가 팀 수 16, id 형식·중복 없음', () => {
    expect(LEAGUE.id).toBe('saudi');
    expect(LEAGUE.teams).toHaveLength(16);
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^saudi:[a-z]{3}$/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.nameKo.length).toBeGreaterThan(0);
      expect(t.rating).toBeGreaterThanOrEqual(50);
      expect(t.rating).toBeLessThanOrEqual(85);
    }
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(16);
  });

  it('더비는 리그 팀끼리', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a)).toBe(true);
      expect(ids.has(b)).toBe(true);
      expect(a).not.toBe(b);
    }
  });

  it('선수 15~25명, 능력치 25개(1~99), 클럽·리그 이름 일치, id 중복 없음', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(15);
    expect(PLAYERS.length).toBeLessThanOrEqual(25);
    const clubs = new Set(LEAGUE.teams.map((t) => t.name));
    const existing = new Set([messi, ...stars, ...LEGENDS, ...FUTURE_STARS].map((p) => p.id));
    const existingNames = new Set([messi, ...stars, ...LEGENDS, ...FUTURE_STARS].map((p) => p.name));
    const ids = PLAYERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of PLAYERS) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(existing.has(p.id)).toBe(false);
      expect(existingNames.has(p.name)).toBe(false);
      expect(clubs.has(p.club ?? '')).toBe(true);
      expect(p.league).toBe(LEAGUE.name);
      expect(Object.keys(p.attributes)).toHaveLength(FIELD_ATTRIBUTES.length);
      expect(FIELD_ATTRIBUTES.length).toBe(25);
      for (const a of FIELD_ATTRIBUTES) {
        expect(p.attributes[a]).toBeGreaterThanOrEqual(1);
        expect(p.attributes[a]).toBeLessThanOrEqual(99);
      }
    }
  });
});
