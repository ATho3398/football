import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/championship';
import { PLAYERS } from '../data/players/championship';
import { stars } from '../data/players/stars';
import { messi } from '../data/players/messi';
import { LEGEND_ROWS, BVB_LEGENDS, EXT_LEGENDS, FUTURE_STARS } from '../data/players/legends';
import { CLUB_BY_ID } from '../data/outsideClubs';

// C.75p (45d3): EFL Championship 2018-19 데이터 파일 형식 검사 (게임에는 아직 연결하지 않는다)
const HEX = /^#[0-9a-f]{6}$/;

describe('리그 데이터 championship', () => {
  it('리그 형식·실제 참가 팀 수 24', () => {
    expect(LEAGUE.id).toBe('championship');
    expect(LEAGUE.name).toBe('EFL Championship');
    expect(LEAGUE.country).toBe('England');
    expect(LEAGUE.tier).toBe(2);
    expect(LEAGUE.season).toBe('2018-19');
    expect(LEAGUE.calendar).toBe('autumn-spring');
    expect(LEAGUE.teams).toHaveLength(24);
  });

  it('팀 id·이름 중복 없음, 필드 형식', () => {
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.nameKo)).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^championship:[a-z0-9]{3}$/);
      expect(t.rating).toBeGreaterThanOrEqual(50);
      expect(t.rating).toBeLessThanOrEqual(85);
      expect(t.city && t.manager && t.managerKo && t.stadium && t.stadiumKo).toBeTruthy();
      expect(t.colors?.primary).toMatch(HEX);
      expect(t.colors?.secondary).toMatch(HEX);
    }
  });

  it('리그 밖 표에 있는 같은 클럽은 이름·레이팅이 같다', () => {
    const outside = new Map(Object.values(CLUB_BY_ID).map((c) => [c.name, c]));
    for (const t of LEAGUE.teams) {
      const o = outside.get(t.name);
      if (o) {
        expect(t.nameKo, t.name).toBe(o.nameKo);
        expect(t.rating, t.name).toBe(o.rating);
      }
    }
  });

  it('더비 두 팀은 이 리그 팀', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a), a).toBe(true);
      expect(ids.has(b), b).toBe(true);
      expect(a).not.toBe(b);
    }
  });

  it('선수 10~20명, 능력치 25개 1~99, 소속 팀·리그 이름 일치', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(10);
    expect(PLAYERS.length).toBeLessThanOrEqual(20);
    const names = new Set(LEAGUE.teams.map((t) => t.name));
    for (const p of PLAYERS) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Object.keys(p.attributes)).toHaveLength(FIELD_ATTRIBUTES.length);
      expect(FIELD_ATTRIBUTES.length).toBe(25);
      for (const a of FIELD_ATTRIBUTES) {
        expect(p.attributes[a], `${p.id} ${a}`).toBeGreaterThanOrEqual(1);
        expect(p.attributes[a], `${p.id} ${a}`).toBeLessThanOrEqual(99);
      }
      expect(names.has(p.club), p.club).toBe(true);
      expect(p.league).toBe('EFL Championship');
      expect(p.birthYear).toBeGreaterThan(1975);
      expect(p.birthYear).toBeLessThan(2004);
    }
  });

  it('선수 id·이름이 기존 선수(스타·메시·레전드·미래 스타)와 겹치지 않음', () => {
    const existing = [messi, ...stars, ...LEGEND_ROWS, ...BVB_LEGENDS, ...EXT_LEGENDS, ...FUTURE_STARS];
    const ids = new Set(existing.map((p) => p.id));
    const nameSet = new Set(existing.map((p) => p.name));
    const mine = PLAYERS.map((p) => p.id);
    expect(new Set(mine).size).toBe(mine.length);
    for (const p of PLAYERS) {
      expect(ids.has(p.id), p.id).toBe(false);
      expect(nameSet.has(p.name), p.name).toBe(false);
    }
  });
});
