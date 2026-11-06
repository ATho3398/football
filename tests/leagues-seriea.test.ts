// C.75n (45d1): Serie A 2018-19 데이터 파일 형식 점검 (게임 연결 전)
import { describe, expect, it } from 'vitest';
import { FIELD_ATTRIBUTES } from '../src/attributes';
import { LEAGUE } from '../data/leagues/seriea';
import { PLAYERS } from '../data/players/seriea';
import { A_GRADE_PLAYERS } from '../data/players';
import { messi } from '../data/players/messi';
import { stars } from '../data/players/stars';
import { FUTURE_STARS, LEGENDS, LEGEND_ROWS } from '../data/players/legends';
import { OUTSIDE_CLUBS } from '../data/outsideClubs';

const norm = (n: string) => n.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const HEX = /^#[0-9a-f]{6}$/;

describe('Serie A 리그 데이터 (C.75n)', () => {
  it('리그 정보와 2018-19 실제 참가 팀 수 20', () => {
    expect(LEAGUE.id).toBe('seriea');
    expect(LEAGUE.name).toBe('Serie A');
    expect(LEAGUE.tier).toBe(1);
    expect(LEAGUE.season).toBe('2018-19');
    expect(LEAGUE.calendar).toBe('autumn-spring');
    expect(LEAGUE.teams).toHaveLength(20);
  });

  it('팀 id 형식·중복 없음, 이름·한글 이름·레이팅·색·감독·홈구장', () => {
    const ids = LEAGUE.teams.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEAGUE.teams.map((t) => t.name)).size).toBe(ids.length);
    for (const t of LEAGUE.teams) {
      expect(t.id).toMatch(/^seriea:[a-z]{3}$/);
      expect(t.nameKo.length).toBeGreaterThan(0);
      expect(t.rating).toBeGreaterThanOrEqual(66);
      expect(t.rating).toBeLessThanOrEqual(85);
      expect(t.colors?.primary).toMatch(HEX);
      expect(t.colors?.secondary).toMatch(HEX);
      expect(t.manager && t.managerKo && t.stadium && t.stadiumKo && t.city).toBeTruthy();
    }
  });

  it('리그 밖 표에 있는 같은 클럽은 이름·레이팅이 같다', () => {
    for (const t of LEAGUE.teams) {
      const o = OUTSIDE_CLUBS.find((c) => c.name === t.name);
      if (o) expect([t.name, t.rating, t.nameKo]).toEqual([o.name, o.rating, o.nameKo]);
    }
  });

  it('더비는 리그 팀끼리', () => {
    const ids = new Set(LEAGUE.teams.map((t) => t.id));
    for (const [a, b] of LEAGUE.derbies ?? []) {
      expect(ids.has(a) && ids.has(b) && a !== b).toBe(true);
    }
  });

  it('선수: 인원·id 형식·중복·능력치 25개·소속 팀', () => {
    expect(PLAYERS.length).toBeGreaterThanOrEqual(60);
    expect(PLAYERS.length).toBeLessThanOrEqual(90);
    const ids = PLAYERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    const teamNames = new Set(LEAGUE.teams.map((t) => t.name));
    for (const p of PLAYERS) {
      expect(p.id).toMatch(/^[a-z]+(-[a-z0-9]+)*$/);
      expect(p.league).toBe('Serie A');
      expect(teamNames.has(p.club)).toBe(true);
      expect(Object.keys(p.attributes)).toHaveLength(FIELD_ATTRIBUTES.length);
      for (const a of FIELD_ATTRIBUTES) {
        expect(p.attributes[a]).toBeGreaterThanOrEqual(20);
        expect(p.attributes[a]).toBeLessThanOrEqual(93);
      }
      expect(p.birthYear).toBeGreaterThanOrEqual(1978);
      expect(p.birthYear).toBeLessThanOrEqual(2001);
    }
    // 모든 팀에 2명 이상
    for (const t of LEAGUE.teams) expect(PLAYERS.filter((p) => p.club === t.name).length).toBeGreaterThanOrEqual(2);
  });

  it('이미 있는 실제 선수·레전드·미래 스타와 id·이름이 겹치지 않는다', () => {
    const existing = [messi, ...stars, ...A_GRADE_PLAYERS, ...LEGEND_ROWS, ...LEGENDS, ...FUTURE_STARS];
    const exIds = new Set(existing.map((p) => p.id));
    const exNames = new Set(existing.map((p) => norm(p.name)));
    for (const p of PLAYERS) {
      expect(exIds.has(p.id), p.id).toBe(false);
      expect(exNames.has(norm(p.name)), p.name).toBe(false);
    }
  });
});
