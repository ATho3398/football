// C.67b (39단계 5-6 b): 챔스(32팀 = 지난 시즌 상위 4 + 외부 28, 조별 8조 · 홈·원정 녹아웃 · 단판 결승) · 보상(5.3 업적 XP · 트레블 · 큰 경기 ×1.5 ·
// honors · 챔스 우승 에픽 선택권) · 화면(홈 배지 · 월드 컵·챔스 탭 · 자동 진행 시트)
import { describe, expect, it } from 'vitest';
import { daysBetween, weekday } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { cupAchievements, groupTable, myCupMatches, uclEntrants, uclMatches, uclReachLabel } from '../src/cups';
import { calendarOf, endSeason, newGame, playRound, SAVE_FORMAT_VERSION, startNextSeason, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import { autoSheetVM, cupsWorldVM, homeVM } from '../src/ui/viewModels';
import { cupsSection } from '../src/ui/views/screens';

const real = (seed: string): GameState => newGame({ mode: 'real', playerId: 'salah', seed, difficulty: 'normal' });
const isLeague = (g: GameState, id: string) => g.league.teams.some((t) => t.id === id);

describe('챔스 틀', () => {
  it('32팀 = 2017-18 상위 4 + 외부 28, 8조 × 4, 같은 리그 두 팀은 한 조에 없음, 조별 6차전 화·수', () => {
    const g = real('c67b-a');
    const u = g.cups!.ucl!;
    expect(uclEntrants(g).slice(0, 4)).toEqual([...BALANCE.cups.ucl.firstSeason]);
    expect(new Set(u.groups.flat()).size).toBe(32);
    expect(u.groups.every((x) => x.length === 4)).toBe(true);
    expect(u.groups.every((x) => x.filter((id) => isLeague(g, id)).length <= 1)).toBe(true);
    expect(u.gs).toHaveLength(6);
    expect(u.gs.every((r) => r.length === 16)).toBe(true);
    for (const t of u.gs.flat()) {
      expect([2, 3]).toContain(weekday(t.d!));
      expect(+t.d!.slice(5, 7)).toBeGreaterThanOrEqual(9);
    }
    // 조 안에서 모두 두 번씩 (홈·원정)
    for (const [k, grp] of u.groups.entries()) {
      const ms = u.gs.flat().filter((t) => grp.includes(t.h));
      expect(ms).toHaveLength(12);
      expect(new Set(ms.map((t) => `${t.h}>${t.a}`)).size).toBe(12);
      expect(groupTable(g, u, k)).toHaveLength(4);
    }
  });

  it('리그 팀의 챔스 경기는 그 팀 리그 경기와 2일 이상 (대부분 3일)', () => {
    const g = real('c67b-gap');
    const cal = calendarOf(g);
    let tight = 0;
    for (const t of g.cups!.ucl!.gs.flat()) for (const id of [t.h, t.a]) {
      if (!isLeague(g, id)) continue;
      g.league.schedule.forEach((round, r) => round.forEach((f, i) => {
        if (f.home !== id && f.away !== id) return;
        const gap = Math.abs(daysBetween(t.d!, cal.fixtureDates[r]![i]!));
        expect(gap).toBeGreaterThanOrEqual(BALANCE.cups.minGapLoose);
        if (gap < BALANCE.cups.minGap) tight++;
      }));
    }
    expect(tight).toBeLessThanOrEqual(2);
  });
});

describe('챔스 한 시즌', () => {
  it('조별 → 16강(조 1위 vs 다른 조 2위) → 8강 → 4강 → 결승, 2차전 합계·승부차기, 우승 팀 · 다음 시즌 = 지난 시즌 상위 4', () => {
    const g = real('u1');
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    const u = g.cups!.ucl!;
    expect(u.ko.map((s) => s.l1.length)).toEqual([8, 4, 2, 1]);
    expect(u.winner).toBeTruthy();
    for (const st of u.ko.slice(0, 3)) for (const [i, t2] of st.l2.entries()) {
      const t1 = st.l1[i]!;
      expect([t2.h, t2.a]).toEqual([t1.a, t1.h]);
      const a = t1.hg! + t2.ag!;
      const b = t1.ag! + t2.hg!;
      if (a !== b) expect(t2.w).toBe(a > b ? t1.h : t1.a);
      else expect(t2.p).toBeTruthy();
      expect(daysBetween(t1.d!, t2.d!)).toBeGreaterThanOrEqual(6);
    }
    // 16강: 2차전 홈 = 조 1위, 같은 조끼리 안 만남
    const firsts = u.groups.map((_, k) => groupTable(g, u, k)[0]!.id);
    const seconds = u.groups.map((_, k) => groupTable(g, u, k)[1]!.id);
    for (const t of u.ko[0]!.l1) {
      expect(firsts).toContain(t.a);
      expect(seconds).toContain(t.h);
      expect(u.groups.some((x) => x.includes(t.h) && x.includes(t.a))).toBe(false);
    }
    expect(daysBetween(calendarOf(g).final, u.ko[3]!.l1[0]!.d!)).toBe(BALANCE.cups.ucl.finalAfter);
    // 내 경기 플래그: 조별 = 큰 경기 아님, 녹아웃 = 큰 경기 (5.2 ×1.5)
    const mine = myCupMatches(g).filter((m) => m.comp === 'ucl');
    expect(mine.filter((m) => m.stage.startsWith('조별')).every((m) => !m.big && !m.decisive)).toBe(true);
    expect(mine.filter((m) => !m.stage.startsWith('조별')).every((m) => m.big)).toBe(true);
    expect(uclReachLabel(g, u, g.player.teamId)).not.toBe('출전 안 함');
    startNextSeason(g);
    expect(uclEntrants(g).slice(0, 4)).toEqual(g.archive.at(-1)!.table.slice(0, 4).map((r) => r[0]));
    expect(g.archive.at(-1)!.cups!.ucl![0]).toBe(u.winner);
  });

  it('챔스 결승에 오르면 리그가 끝나도 시즌이 이어지고, 결승을 치른 뒤 끝난다', () => {
    let found = false;
    for (const seed of ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8']) {
      const g = real(seed);
      for (let s = 0; s < 2 && !found; s++) {
        while (g.phase === 'season') playRound(g, { engine: 'quick' });
        const fin = g.cups!.ucl!.ko[3]?.l1[0];
        if (fin && (fin.h === g.player.teamId || fin.a === g.player.teamId)) {
          found = true;
          expect(fin.hg).toBeDefined();
          expect(g.calendar.date).toBe(fin.d);
          expect(g.lastMatch!.cup!.stage).toBe('결승');
        }
        if (!found) startNextSeason(g);
      }
      if (found) break;
    }
    expect(found).toBe(true);
  });

  it('결정성: 같은 시드면 같은 챔스', () => {
    const run = () => {
      const g = real('c67b-det');
      while (g.phase === 'season') playRound(g, { engine: 'quick' });
      return JSON.stringify(g.cups!.ucl);
    };
    expect(run()).toBe(run());
  });
});

describe('보상 (5.3 · 8.1 · 18.9)', () => {
  it('챔스 우승 400 + FA컵 150 + 트레블 500, honors 트레블·챔스, 에픽 선택권', () => {
    const g = real('c67b-reward');
    const me = g.player.teamId;
    g.cups!.ucl!.winner = me;
    g.cups!.fa!.winner = me;
    const X = BALANCE.cups.xp;
    expect(cupAchievements(g, 1).map((a) => a.xp)).toEqual([X.uclWin, X.faWin, X.treble]);
    expect(cupAchievements(g, 2).map((a) => a.key)).toEqual(['ucl', 'fa']);
    // 리그 1위로 만들고 시즌 끝
    g.league.table.find((r) => r.teamId === me)!.points = 200;
    const picks = g.cards.picks.length;
    const sum = endSeason(g);
    expect(sum.achievements.map((a) => a.label)).toEqual(expect.arrayContaining(['챔스 우승', 'FA컵 우승', '트레블 (리그 · FA컵 · 챔스)']));
    expect(g.player.honors.trebles).toBe(1);
    expect(g.player.honors.ucl).toBe(1);
    expect(g.cards.picks.length).toBeGreaterThan(picks);
    expect(g.cards.picks.some((p) => p.source === 'award')).toBe(true);
  });

  it('챔스 4강 150 · 8강 80 · 출전 안 하면 없음', () => {
    const g = real('c67b-reach');
    const u = g.cups!.ucl!;
    const me = g.player.teamId;
    u.ko = [{ l1: [], l2: [] }, { l1: [{ h: me, a: 'x:bar' }], l2: [] }];
    expect(cupAchievements(g, 5).find((a) => a.key === 'ucl')!.xp).toBe(BALANCE.cups.xp.uclQuarter);
    u.ko.push({ l1: [{ h: 'x:bar', a: me }], l2: [] });
    expect(cupAchievements(g, 5).find((a) => a.key === 'ucl')!.xp).toBe(BALANCE.cups.xp.uclSemi);
    u.groups = u.groups.map((x) => x.map((id) => (id === me ? 'x:wig' : id)));
    expect(cupAchievements(g, 5).some((a) => a.key === 'ucl')).toBe(false);
  });
});

describe('화면 (디자인 없음)', () => {
  it('홈 다음 경기 챔스 배지 · 자동 진행 시트 챔스 대상 · 월드 컵·챔스 탭', () => {
    const g = real('c67b-ui');
    while (!homeVM(g).next?.cup) playRound(g, { engine: 'quick' });
    const h = homeVM(g);
    expect(h.next!.cup!.label).toContain('챔피언스리그');
    expect(h.comp).toContain('챔스 조별');
    const ucl = autoSheetVM(g).targets.find((t) => t.id === 'ucl')!;
    expect(ucl.available).toBe(true);
    expect(ucl.next!.text).toContain('챔스 조별');
    const vm = cupsWorldVM(g);
    expect(vm.ucl!.groups).toHaveLength(8);
    expect(vm.ucl!.groups.filter((x) => x.mine)).toHaveLength(1);
    const html = cupsSection(vm);
    expect(html).toContain('조별리그');
    expect(html).toContain('A조');
    expect(html).toContain('FA컵');
  });

  it('챔스에 안 나가는 팀: 시트 한 줄 · 탭은 대진만', () => {
    // 가상 유망주 = 하위~중위권 팀 (상위 4 아님)
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c67b-none', difficulty: 'normal' });
    expect(uclMatches(g.cups!.ucl!).some((m) => m.t.h === g.player.teamId || m.t.a === g.player.teamId)).toBe(false);
    const ucl = autoSheetVM(g).targets.find((t) => t.id === 'ucl')!;
    expect(ucl.next).toBeNull();
    expect(ucl.note).toContain('나가지 않아요');
  });
});

describe('세이브 37', () => {
  it('왕복 그대로 · 36 세이브(챔스 없음)는 이번 시즌 챔스 없이 진행', () => {
    const g = real('c67b-save');
    expect(SAVE_FORMAT_VERSION).toBe(48);
    expect(deserialize(serialize(g)).cups).toEqual(g.cups);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 36;
    delete raw.cups.ucl;
    const old = deserialize(JSON.stringify(raw));
    for (let k = 0; k < 6; k++) playRound(old, { engine: 'quick' });
    expect(old.cups!.ucl ?? null).toBeNull();
  });
});
