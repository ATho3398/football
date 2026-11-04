// C.81d (53단계): 다른 경기 계산 3단계 — 내 리그만 엔진(기본) · 전부 엔진 · 전부 빠른 진행. 세이브 60 → 61 이전.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_LEAGUES } from '../data/leagues';
import {
  endDay, isMatchDay, myLeagueQuick, newGame, otherJob, otherLeaguesEngine, othersHow, playOthers, todaysOthers, upcomingOthers, type GameState,
} from '../src/game';
import { otherLeagueJobs } from '../src/otherLeagues';
import { restoreWithInfo, serialize } from '../src/save';
import { MIGRATIONS, validateSave } from '../src/saveMigrations';
import { specKey } from '../src/ui/enginePool';
import { settingsView } from '../src/ui/views/settings';
import { CARD_ART_UI_DEFAULT } from '../src/ui/views/cardArtSettings';
import { versionVM } from '../src/ui/viewModels';

const multi = (seed: string): GameState => newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal', leagues: [...DEFAULT_LEAGUES] } as never);
const fixture = (v: number): Record<string, any> => JSON.parse(readFileSync(join(__dirname, 'fixtures', 'saves', `v${v}.json`), 'utf8'));

describe('C.81d 다른 경기 계산 3단계', () => {
  it('새 게임 기본값 = 내 리그만 엔진', () => {
    const g = multi('c81d-def');
    expect(g.options.others).toBe('mine');
    expect(myLeagueQuick(g)).toBe(false);
    expect(otherLeaguesEngine(g)).toBe(false);
    expect(othersHow(g)).toBe('mine');
    expect(othersHow({ options: { others: 'all' } })).toBe('engine');
    expect(othersHow({ options: { others: 'quick' } })).toBe('quick');
  });

  it('미리 계산 목록: 내 리그만 엔진이면 다른 리그 경기를 넣지 않고, 전부 엔진이면 넣는다', () => {
    const g = multi('c81d-up');
    // 내 리그·다른 리그 경기가 다 있는 날 앞까지 (개막 전 소집 7일)
    for (let k = 0; k < 40 && !todaysOthers(g).length; k++) { playOthers(g, 'quick'); endDay(g); }
    const lgKeys = new Set<string>();
    for (let d = 0; d <= 7; d++) {
      const date = new Date(Date.parse(g.calendar.date) + d * 864e5).toISOString().slice(0, 10);
      for (const j of otherLeagueJobs(g, date)) lgKeys.add(specKey({ kind: 'npc', input: j.input }));
    }
    expect(lgKeys.size).toBeGreaterThan(0);
    g.options = { others: 'mine' };
    const mine = upcomingOthers(g, 3, 7).map((input) => specKey({ kind: 'npc', input }));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.some((k) => lgKeys.has(k))).toBe(false);
    g.options = { others: 'all' };
    const all = upcomingOthers(g, 3, 7).map((input) => specKey({ kind: 'npc', input }));
    expect(all.some((k) => lgKeys.has(k))).toBe(true);
    // 내 리그 몫은 같다 (같은 날짜 범위면)
    const own = new Set(mine);
    for (const k of all.filter((x) => !lgKeys.has(x))) expect(own.has(k)).toBe(true);
  });

  it('내 리그 결과는 전부 엔진과 같은 시드에서 동일 · 다른 리그는 빠른 계산(득점자 추첨, 출전 기록 없음)', () => {
    const a = multi('c81d-same');
    const b = multi('c81d-same');
    a.options = { others: 'all' };
    b.options = { others: 'mine' };
    // 다른 리그 경기가 엔진으로 치러지는 날까지 한 번 (내 리그 다른 경기 + 다른 리그 경기 같은 날)
    let lgDone = 0;
    for (let k = 0; k < 20 && (lgDone === 0 || !todaysOthers(a).length); k++) {
      if (isMatchDay(a)) break;
      lgDone += otherLeagueJobs(a, a.calendar.date).length;
      const today = todaysOthers(a).length;
      playOthers(a, othersHow(a));
      playOthers(b, othersHow(b));
      endDay(a);
      endDay(b);
      if (today && lgDone) break;
    }
    const res = (g: GameState) => JSON.stringify(g.league.schedule.flat().map((f) => [f.home, f.away, f.homeGoals ?? null, f.awayGoals ?? null]));
    expect(a.league.schedule.flat().some((f) => f.homeGoals !== undefined)).toBe(true);
    expect(res(b)).toBe(res(a));
    expect(JSON.stringify(b.league.table)).toBe(JSON.stringify(a.league.table));
    // 내 리그 선수 기록도 같다 (다른 리그 선수 id 는 빼고 비교)
    const mineIds = new Set(Object.values(a.rosters).flatMap((r) => r.players.map((p) => p.id)));
    const stats = (g: GameState) => JSON.stringify(Object.entries(g.playerStats).filter(([id]) => mineIds.has(id)).sort());
    expect(stats(b)).toBe(stats(a));
    // 다른 리그: 둘 다 같은 날까지 결과가 있다. 'all' 은 엔진 기록(출전 칸), 'mine' 은 빠른 계산(골·도움만)
    expect(lgDone).toBeGreaterThan(0);
    {
      const played = (g: GameState) => (g.otherLeagues ?? []).reduce((t, l) => t + l.schedule.flat().filter((f) => f.homeGoals !== undefined).length, 0);
      expect(played(a)).toBeGreaterThan(0);
      expect(played(b)).toBe(played(a));
      const eng = (g: GameState) => (g.otherLeagues ?? []).some((l) => Object.values(l.stats ?? {}).some((x) => x[2] !== undefined));
      expect(eng(a)).toBe(true);
      expect(eng(b)).toBe(false);
    }
  });

  it('내 리그 다른 경기 엔진 입력은 다른 리그 계산과 무관 (같은 키)', () => {
    const a = multi('c81d-in');
    for (let k = 0; k < 40 && !todaysOthers(a).length; k++) { playOthers(a, 'quick'); endDay(a); }
    const keys = (g: GameState) => todaysOthers(g).map(([r, i]) => specKey({ kind: 'npc', input: otherJob(g, r, i).input })).join();
    const before = keys(a);
    a.options = { others: 'all' };
    expect(keys(a)).toBe(before);
  });
});

describe('C.81d 세이브 이전 60 → 61', () => {
  it('quickOthers 참 → 전부 빠른 진행, 거짓(옛 기본값·전체 엔진) → 내 리그만 엔진', () => {
    expect(MIGRATIONS[60]!({ options: { quickOthers: true } }).options).toEqual({ others: 'quick' });
    expect(MIGRATIONS[60]!({ options: { quickOthers: false } }).options).toEqual({ others: 'mine' });
    expect(MIGRATIONS[60]!({}).options).toEqual({ others: 'mine' });
    // 이미 새 값이 있으면 그대로
    expect(MIGRATIONS[60]!({ options: { others: 'all' } }).options).toEqual({ others: 'all' });
  });

  it('v60 fixture (quickOthers false) → 61 내 리그만 엔진 · v60 을 빠른 진행으로 바꾼 것 → quick', () => {
    const raw = fixture(60);
    expect(raw.options).toEqual({ quickOthers: false });
    const { state, migratedFrom } = restoreWithInfo(raw);
    expect(migratedFrom).toBe(60);
    expect(state.options).toEqual({ others: 'mine' });
    expect(validateSave(JSON.parse(serialize(state)))).toEqual([]);
    const q = restoreWithInfo({ ...fixture(60), options: { quickOthers: true } });
    expect(q.state.options).toEqual({ others: 'quick' });
  });

  it('v61 fixture 는 3단계 값, 잘못된 값은 검증 실패', () => {
    const raw = fixture(61);
    expect(raw.options).toEqual({ others: 'mine' });
    expect(validateSave({ ...raw, options: { quickOthers: false } })).toContain('options.others');
  });
});

describe('C.81d 설정 화면', () => {
  it('세 단계 탭 + 단계마다 설명 한 줄, 지금 단계 표시', () => {
    const g = multi('c81d-set');
    const view = () => settingsView(g, { tab: 'players', q: '', sel: null, crop: null }, versionVM(g), { q: '', team: '', sel: null },
      { tab: 'players', q: '', team: '', sel: null, kitSel: null }, { ...CARD_ART_UI_DEFAULT }, false, { page: 'main', open: 'play' });
    const h = view();
    for (const v of ['mine', 'all', 'quick']) expect(h).toContain(`data-act="opt-quick" data-v="${v}"`);
    for (const t of ['내 리그만 엔진', '전부 엔진', '전부 빠른 진행']) expect(h).toContain(t);
    expect(h).toContain('다른 리그 5개');
    expect(h.match(/<li class="is-on"><b>내 리그만 엔진<\/b>/)).not.toBeNull();
    g.options = { others: 'quick' };
    expect(view().match(/<li class="is-on"><b>전부 빠른 진행<\/b>/)).not.toBeNull();
  });
});
