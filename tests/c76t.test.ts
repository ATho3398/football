// C.76t (47b) 리그 · 시즌 중 개인상: 리그 올해의 선수(PFA · FWA · 리그 공식) · 영플레이어 · 올해의 팀(4-3-3) · FIFPRO 월드 11 ·
// 이달의 선수 · 챔스 최우수 · 대륙컵 상 · 최고 개인상 묶음 · 시상식 화면 · 홈 발롱도르 레이스 칩 · 세이브 54
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { awardKo, awardsDayEnd, computeAwards, myAwardCounts, potmRun, raceRank, wcResumes } from '../src/awards';
import { awardsVM, ceremonyVM } from '../src/ui/awardsVM';
import { awardsView } from '../src/ui/views/awards';
import { MY_ID } from '../src/engine/adapter';
import { uclReach } from '../src/cups';
import { deserialize, restore, SaveFormatError, serialize } from '../src/save';

let cached: GameState | null = null;
/** 한 시즌을 빠른 진행으로 끝낸 게임 (비시즌, 2018-19 · 손흥민 · 기본 6개 리그) */
function seasonDone(): GameState {
  if (cached) return structuredClone(cached);
  const g = newGame({ mode: 'real', playerId: 'son', seed: 'c76t', difficulty: 'normal', leagues: ['pl', 'laliga', 'seriea', 'bundesliga', 'ligue1', 'championship'] });
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
  cached = g;
  return structuredClone(g);
}

describe('47b 상 정의', () => {
  it('리그 상 · 올해의 팀 · 챔스 · 대륙컵 · 이달의 선수가 표에 있다', () => {
    const D = BALANCE.awards.defs;
    for (const id of ['pfa', 'fwa', 'lgPoty', 'lgYoung', 'toty', 'fifpro', 'uclBest', 'contBall', 'contBoot', 'contGlove', 'potm']) expect(D[id], id).toBeDefined();
    expect(D.pfa!.topKey).toBe(D.fwa!.topKey);
    expect(D.lgPoty!.top).toBe(true);
    expect(BALANCE.awards.xiSlots.reduce((t, s) => t + s[2], 0)).toBe(11);
    expect(awardKo('pfa@pl')).toBe('PFA 올해의 선수');
    expect(awardKo('lgPoty@laliga')).toBe('라리가 올해의 선수');
    expect(awardKo('lgYoung@pl')).toBe('PFA 영플레이어');
    expect(awardKo('toty@seriea')).toBe('세리에 A 올해의 팀');
    expect(awardKo('contBall', 'asian')).toBe('아시안컵 골든볼');
  });
});

describe('시즌 끝 리그 상', () => {
  it('PL = PFA · FWA, 다른 리그 = 리그 공식 1개 · 리그 선수만 · 시즌 끝 바로 발표', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    expect(y.res['pfa@pl']!.length).toBeGreaterThan(2);
    expect(y.res['fwa@pl']!.length).toBeGreaterThan(2);
    expect(y.res['lgPoty@pl']).toBeUndefined();
    expect(y.res['pfa@laliga']).toBeUndefined();
    expect(y.res['lgPoty@laliga']!.length).toBeGreaterThan(2);
    for (const k of ['pfa@pl', 'fwa@pl', 'lgYoung@pl', 'toty@pl', 'lgPoty@laliga', 'uclBest']) expect(y.shown, k).toContain(k);
    expect(y.due.fifpro).toBe('2019-12-16');
    expect(y.shown).not.toContain('fifpro');
    // 리그 선수만: 라리가 상 수상 팀은 라리가 팀
    const laliga = new Set(g.otherLeagues!.find((l) => l.id === 'laliga')!.teams.map((t) => t.id));
    for (const r of y.res['lgPoty@laliga']!) expect(laliga.has(r.t)).toBe(true);
    // 결정적
    expect(computeAwards(g).res['pfa@pl']).toEqual(computeAwards(g).res['pfa@pl']);
  });
  it('올해의 팀: 4-3-3 자리 순 11명 (GK · 풀백 2 · 센터백 2 · 미드 3 · 공격 3), 득표 = 투표자 수 이하', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    for (const k of ['toty@pl', 'fifpro']) {
      const rows = y.res[k]!;
      expect(rows.map((r) => r.p === 'CDM' || r.p === 'CM' || r.p === 'CAM' ? 'MID' : r.p === 'WING' || r.p === 'ST' ? 'FWD' : r.p), k)
        .toEqual(['GK', 'FB', 'FB', 'CB', 'CB', 'MID', 'MID', 'MID', 'FWD', 'FWD', 'FWD']);
      expect(new Set(rows.map((r) => r.id)).size).toBe(11);
      for (const r of rows) expect(r.v).toBeLessThanOrEqual(BALANCE.awards.defs[k.split('@')[0]!]!.voters!);
    }
  });
  it('챔스 최우수 선수: 챔스에 나간 팀 선수만', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    for (const r of y.res.uclBest!) expect(uclReach(g.cups!.ucl!, r.t)).toBeGreaterThanOrEqual(0);
  });
  it('대륙컵 상: 2019 아시안컵(내 나라 대륙 대회) — 골든볼 · 골든부트 · 골든글러브', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    const rec = g.national?.tournaments.find((t) => t.year === 2019);
    if (!rec || rec.comp === 'wc') return;
    expect(y.cont).toBe(rec.comp);
    expect(y.res.contBall!.length).toBeGreaterThan(0);
    expect(y.res.contGlove![0]!.p).toBe('GK');
    expect(y.res.contBoot![0]!.g).toBeGreaterThan(0);
    expect(y.res.wcBall).toBeUndefined();
    expect(wcResumes(g, rec).every((r) => r.lg === rec.comp)).toBe(true);
  });
});

describe('이달의 선수', () => {
  it('리그마다 매달 한 명 · 같은 달 두 번 뽑지 않음 · 기록 = 그 리그 선수', () => {
    const g = seasonDone();
    const ms = g.globalAwards!.months!;
    const pl = ms.filter((m) => m.lg === 'pl' && m.s === 2018);
    expect(pl.length).toBeGreaterThanOrEqual(8);
    expect(new Set(pl.map((m) => m.m)).size).toBe(pl.length);
    expect(pl.map((m) => m.m)).toContain('2019-05');
    const n = ms.length;
    potmRun(g, '2018-10');
    expect(g.globalAwards!.months!.length).toBe(n);
    const plTeams = new Set(g.league.teams.map((t) => t.id));
    for (const m of pl) expect(plTeams.has(m.t)).toBe(true);
    // 한 명이 매달 독식하지 않는다
    const most = Math.max(...[...new Set(pl.map((m) => m.id))].map((id) => pl.filter((m) => m.id === id).length));
    expect(most).toBeLessThan(pl.length);
  });
  it('내가 받으면 XP · 통산 (위상은 그대로)', () => {
    const g = seasonDone();
    const months = g.globalAwards!.months!;
    // 2019-04 PL 기록을 지우고 내가 꼭 이기게: 다른 선수 출전을 막을 수 없으니 결과만 확인 — 수상자가 나면 기록 +1
    const before = months.filter((m) => m.lg === 'pl').length;
    g.globalAwards!.months = months.filter((m) => !(m.lg === 'pl' && m.m === '2019-04'));
    const xp = g.player.totalXp;
    const rep = g.player.reputation;
    const mine = g.globalAwards!.potm ?? 0;
    potmRun(g, '2019-04');
    const rec = g.globalAwards!.months!.find((m) => m.lg === 'pl' && m.m === '2019-04')!;
    expect(g.globalAwards!.months!.filter((m) => m.lg === 'pl').length).toBe(before);
    expect(g.player.reputation).toBe(rep);
    if (rec.me) { expect(g.globalAwards!.potm).toBe(mine + 1); expect(g.player.totalXp).toBeGreaterThan(xp); } else expect(g.player.totalXp).toBe(xp);
  });
});

describe('내가 받으면 (리그 상 · 올해의 팀)', () => {
  it('PFA · FWA 둘 다 받아도 최고 개인상은 그 시즌 1 · 희귀 선택권 · 올해의 팀 배지', () => {
    const g = seasonDone();
    const y = g.globalAwards!.years.at(-1)!;
    const me = { id: MY_ID, n: g.player.name, t: g.player.teamId, p: 'WING' as const, v: 400, f: 60, me: 1 as const };
    for (const k of ['pfa@pl', 'fwa@pl']) {
      y.res[k] = [me, ...y.res[k]!.filter((r) => !r.me)];
      y.shown = y.shown.filter((x) => x !== k);
      y.due[k] = '2019-06-01';
    }
    y.res.fifpro = [...y.res.fifpro!.slice(0, 8), { ...me, v: 70 }, ...y.res.fifpro!.slice(9)];
    const top = g.player.honors.top?.[2018] ?? 0;
    const picks = g.cards.picks.length;
    awardsDayEnd(g, '2019-12-16');
    expect(g.player.honors.top?.[2018]).toBe(top + 1);
    expect(g.cards.picks.length).toBe(picks + 2);
    expect(myAwardCounts(g)['pfa@pl']).toBe(1);
    expect(myAwardCounts(g).fifpro).toBe(1);
    const vm = awardsVM(g, null, null);
    expect(vm.badges.some((b) => b.name === 'FIFPRO 월드 11')).toBe(true);
    expect(awardsView(vm, 'year')).toContain('배지');
    expect(g.inbox!.items.some((m) => m.key === 'aw:2018:fifpro' && m.title.includes('선정'))).toBe(true);
  });
});

describe('화면', () => {
  it('부문 탭(세계 · 리그) · 올해의 팀 자리 표 · 시상식 3단계 · 이달의 선수 탭', () => {
    const g = seasonDone();
    const vm = awardsVM(g, null, null, 'pl');
    expect(vm.groups.map((x) => x.id)).toEqual(expect.arrayContaining(['world', 'pl', 'laliga']));
    expect(vm.cards.map((c) => c.id)).toEqual(expect.arrayContaining(['pfa@pl', 'fwa@pl', 'lgYoung@pl', 'toty@pl']));
    const html = awardsView(vm, 'year');
    expect(html).toContain('PFA 올해의 선수');
    expect(html).toContain('시상식 보기');
    expect(html).toContain('센터백');
    const y = g.globalAwards!.years.at(-1)!;
    const steps = [0, 1, 2].map((s) => ceremonyVM(g, y, 'pfa@pl', s)!);
    expect(steps[0]!.lines.length).toBe(y.res['pfa@pl']!.length);
    expect(steps[1]!.lines.length).toBe(3);
    expect(steps[2]!.winner!.name).toBe(y.res['pfa@pl']![0]!.me ? g.player.name : y.res['pfa@pl']![0]!.n);
    expect(awardsView(awardsVM(g, null, null, 'pl', { id: 'pfa@pl', step: 2 }), 'year')).toContain('수상자 발표');
    const month = awardsView(awardsVM(g, null, null, 'pl'), 'month');
    expect(month).toContain('5월');
    const hist = awardsVM(g, null, 'toty@pl');
    expect(hist.histRows.length).toBe(1);
    expect(hist.hist.some((h) => h.id === 'lgPoty@laliga')).toBe(true);
  });
  it('홈 발롱도르 레이스: 시즌 중 8라운드 뒤만', () => {
    const g = seasonDone();
    expect(raceRank(g)).toBeNull();
    const h = newGame({ mode: 'real', playerId: 'son', seed: 'c76t-race', difficulty: 'normal' });
    expect(raceRank(h)).toBeNull();
    while (h.league.round < BALANCE.awards.powerFromRound) playRound(h, { engine: 'quick' });
    const r = raceRank(h);
    expect(r === null || r >= 1).toBe(true);
  });
});

describe('세이브', () => {
  it('세이브 왕복 · 53 은 이어 할 수 없음', () => {
    const g = seasonDone();
    expect(SAVE_FORMAT_VERSION).toBe(58);
    const back = deserialize(serialize(g));
    expect(back.globalAwards!.months!.length).toBe(g.globalAwards!.months!.length);
    expect(back.globalAwards!.years.at(-1)!.res['toty@pl']!.length).toBe(11);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 53;
    expect(() => restore(raw)).toThrow(SaveFormatError);
  });
});
