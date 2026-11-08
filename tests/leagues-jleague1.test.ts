// C.75q (45d4): jleague1 2018 리그 데이터 형식 검사. 게임에는 아직 연결하지 않는다 (45a·45b)
import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/jleague1';
import { PLAYERS } from '../data/players/jleague1';
import { stars } from '../data/players/stars';
import { messi } from '../data/players/messi';
import { BVB_LEGENDS, EXT_LEGENDS, FUTURE_STARS, LEGEND_ROWS } from '../data/players/legends';

const norm = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');

describe('jleague1 리그 데이터', () => {
  it('리그 정보와 2018 실제 참가 팀 수 18', () => {
    expect(LEAGUE.id).toBe('jleague1');
    expect(LEAGUE.tier).toBe(1);
    expect(LEAGUE.season).toBe('2018');
    expect(LEAGUE.calendar).toBe('spring-autumn');
    expect(LEAGUE.teams).toHaveLength(18);
  });

  it('팀 id 형식·중복 없음, 이름·한글 이름·레이팅·색·감독·구장', () => {
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^jleague1:[a-z0-9]{3}$/);
      expect(t.nameKo.length).toBeGreaterThan(0);
      expect(t.rating).toBeGreaterThanOrEqual(50);
      expect(t.rating).toBeLessThanOrEqual(85);
      expect(t.colors?.primary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.colors?.secondary).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.manager && t.managerKo && t.stadium && t.stadiumKo && t.city).toBeTruthy();
    }
  });

  it('더비는 리그 팀끼리', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a) && ids.has(b) && a !== b).toBe(true);
    }
  });

  it('선수 15~25명, 능력치 25개, 클럽·리그 이름이 리그 데이터와 맞음', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(15);
    expect(PLAYERS.length).toBeLessThanOrEqual(25);
    const clubs = new Set(LEAGUE.teams.map((t) => t.name));
    for (const p of PLAYERS) {
      expect(p.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(Object.keys(p.attributes)).toHaveLength(FIELD_ATTRIBUTES.length);
      expect(FIELD_ATTRIBUTES.length).toBe(25);
      for (const v of Object.values(p.attributes)) expect(v >= 1 && v <= 99).toBe(true);
      expect(clubs.has(p.club!)).toBe(true);
      expect(p.league).toBe(LEAGUE.name);
      expect(p.birthYear).toBeLessThanOrEqual(2000);
    }
  });

  it('id·이름이 기존 실제 선수·레전드와 겹치지 않음', () => {
    const ids = PLAYERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const existing = [messi, ...stars];
    const legends = [...LEGEND_ROWS, ...BVB_LEGENDS, ...EXT_LEGENDS, ...FUTURE_STARS];
    const takenIds = new Set([...existing.map((p) => p.id), ...legends.map((l) => l.id)]);
    const takenNames = new Set([...existing.map((p) => norm(p.name)), ...legends.map((l) => norm(l.name))]);
    for (const p of PLAYERS) {
      expect(takenIds.has(p.id)).toBe(false);
      expect(takenNames.has(norm(p.name))).toBe(false);
    }
  });
});
