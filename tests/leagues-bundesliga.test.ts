// C.75o (45d2단계): Bundesliga 2018-19 데이터 파일 형식 검사 (게임에는 아직 연결 안 함)
import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/bundesliga';
import { bundesligaPlayers } from '../data/players/bundesliga';
import { stars } from '../data/players/stars';
import { messi } from '../data/players/messi';
import { BVB_LEGENDS, EXT_LEGENDS, FUTURE_STARS, LEGEND_ROWS } from '../data/players/legends';

describe('Bundesliga 데이터 (C.75o)', () => {
  it('리그 정보와 실제 참가 팀 수', () => {
    expect(LEAGUE.id).toBe('bundesliga');
    expect(LEAGUE.name).toBe('Bundesliga');
    expect(LEAGUE.tier).toBe(1);
    expect(LEAGUE.season).toBe('2018-19');
    expect(LEAGUE.calendar).toBe('autumn-spring');
    expect(LEAGUE.teams).toHaveLength(18);
  });

  it('팀 id·이름 형식, 중복 없음, 레이팅 범위', () => {
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^bundesliga:[a-z0-9]{3}$/);
      expect(t.nameKo.length).toBeGreaterThan(0);
      expect(t.rating).toBeGreaterThanOrEqual(60);
      expect(t.rating).toBeLessThanOrEqual(86);
      expect(t.colors?.primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.colors?.secondary).toMatch(/^#[0-9a-f]{6}$/);
      expect(t.manager && t.managerKo && t.stadium && t.stadiumKo && t.city).toBeTruthy();
    }
  });

  it('더비는 리그 팀끼리', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a) && ids.has(b) && a !== b).toBe(true);
    }
  });

  it('선수: 능력치 25개, 소속 팀·리그 일치, 인원', () => {
    const names = new Set(LEAGUE.teams.map((t) => t.name));
    expect(bundesligaPlayers.length).toBeGreaterThanOrEqual(55);
    expect(bundesligaPlayers.length).toBeLessThanOrEqual(90);
    for (const p of bundesligaPlayers) {
      expect(p.league).toBe('Bundesliga');
      expect(names.has(p.club)).toBe(true);
      expect(Object.keys(p.attributes)).toHaveLength(FIELD_ATTRIBUTES.length);
      for (const a of FIELD_ATTRIBUTES) expect(p.attributes[a]).toBeGreaterThanOrEqual(1);
      for (const a of FIELD_ATTRIBUTES) expect(p.attributes[a]).toBeLessThanOrEqual(99);
      expect(p.id).toMatch(/^[a-z0-9-]+$/);
    }
    // 팀마다 2명 이상
    for (const t of LEAGUE.teams) expect(bundesligaPlayers.filter((p) => p.club === t.name).length).toBeGreaterThanOrEqual(2);
  });

  it('선수 id·이름이 기존 표(stars·messi·레전드)와 겹치지 않음', () => {
    const ids = bundesligaPlayers.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const others = [messi, ...stars, ...LEGEND_ROWS, ...BVB_LEGENDS, ...EXT_LEGENDS, ...FUTURE_STARS];
    const otherIds = new Set(others.map((p) => p.id));
    const otherNames = new Set(others.map((p) => p.name));
    for (const p of bundesligaPlayers) {
      expect(otherIds.has(p.id)).toBe(false);
      expect(otherNames.has(p.name)).toBe(false);
    }
  });
});
