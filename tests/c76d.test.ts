// C.76d (45c) 대표팀 · 국제 대회: 소집 확률 · A매치 주간 · 대표팀 경기 · 월드컵/대륙컵 · 업적 · 배지 · 세이브
import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { NATIONS, nationOf } from '../data/nations';
import { endDay, isVacationDay, playOthers, myMatchDates, newGame, nextMatch, playRound, roundMatch, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { teamById } from '../src/league';
import { daysBetween } from '../src/calendar';
import {
  callChance, ensureNational, myTournament, nationalSeasonEnd, participants, runTournament, tournamentAchievement, tournamentsIn, type NatMatch,
} from '../src/national';
import { awardBadges } from '../src/badges';
import { restore, SaveFormatError, serialize, deserialize } from '../src/save';

const game = (seed = 'c76d') => newGame({ mode: 'real', playerId: 'son', seed, difficulty: 'normal' });

/** 위상을 티어 컷에 맞춘다 */
function atTier(g: GameState, tier: 'normal' | 'special' | 'topClass' | 'worldClass'): GameState {
  g.player.reputation = BALANCE.reputation.tierCuts[tier] + (tier === 'normal' ? 0 : 1);
  return g;
}

describe('국가 레이팅 표 (C.76d)', () => {
  it('이름 겹침 없음, 대륙마다 대회 참가 수 이상(OFC 제외 초청)', () => {
    expect(new Set(NATIONS.map((n) => n.name)).size).toBe(NATIONS.length);
    const count = (c: string) => NATIONS.filter((n) => n.confed === c).length;
    expect(count('UEFA')).toBeGreaterThanOrEqual(24);
    expect(count('AFC')).toBeGreaterThanOrEqual(24);
    expect(count('CAF')).toBeGreaterThanOrEqual(24);
    expect(count('CONCACAF')).toBeGreaterThanOrEqual(16);
    expect(count('CONMEBOL')).toBe(10);
  });
  it('표에 없는 국적은 UEFA 기본값 · 대표팀 id 는 teamById 로 찾는다', () => {
    expect(nationOf('Atlantis').rating).toBe(62);
    expect(nationOf('Korea Republic').nameKo).toBe('대한민국');
    const g = game();
    expect(teamById(g.league, 'n:France').rating).toBe(nationOf('France').rating);
  });
});

describe('소집 확률 (18.12)', () => {
  it('위상 티어별: 일반 낮게 · 스페셜 30% · 탑클래스 70% · 월드클래스 95% (내 OVR 이 대표팀보다 낮을 때)', () => {
    const g = game();
    // OVR 가산을 없애려고 대표팀 레이팅보다 낮은 OVR 의 나라로
    ensureNational(g).nation = 'France';
    g.player.attributes = Object.fromEntries(Object.keys(g.player.attributes).map((k) => [k, 60])) as typeof g.player.attributes;
    const C = BALANCE.national.callup;
    expect(callChance(atTier(g, 'normal'))).toBeCloseTo(C.normal);
    expect(callChance(atTier(g, 'special'))).toBeCloseTo(0.3);
    expect(callChance(atTier(g, 'topClass'))).toBeCloseTo(0.7);
    expect(callChance(atTier(g, 'worldClass'))).toBeCloseTo(0.95);
  });
  it('약한 나라는 대표팀보다 잘하는 선수를 더 부른다 (OVR 가산, 최대 max)', () => {
    const g = atTier(game(), 'special');
    ensureNational(g).nation = 'San Marino';
    expect(callChance(g)).toBeGreaterThan(0.3);
    expect(callChance(g)).toBeLessThanOrEqual(BALANCE.national.callup.max);
  });
  it('나이 미달이면 0', () => {
    const g = game();
    g.player.age = 16;
    expect(callChance(g)).toBe(0);
  });
});

/** 첫 A매치 주간 발표 다음 날까지 하루씩 (경기는 빠른 계산) */
function toFirstWindow(g: GameState, healthy = true): void {
  const nat = ensureNational(g);
  for (let k = 0; k < 120 && !Object.keys(nat.calls).length; k++) {
    // 부상이면 소집되지 않으므로 (규칙) 소집 흐름을 보는 테스트는 부상을 지운다
    if (healthy) g.player.injury = null;
    if (nextMatch(g)?.date === g.calendar.date) playRound(g, { engine: 'quick' });
    else { playOthers(g, 'quick'); endDay(g); }
  }
}

describe('A매치 주간 소집 · 평가전', () => {
  it('월드클래스면 휴식기 5일 전에 소집 → 금·화 평가전이 내 경기 일정에, 인박스 알림, 소집 기간은 휴가 아님', () => {
    const g = atTier(game(), 'worldClass');
    toFirstWindow(g);
    const nat = ensureNational(g);
    const [key, called] = Object.entries(nat.calls)[0]!;
    expect(key).toBe(`${g.league.season}:0`);
    expect(called).toBe(true);
    const fx = nat.fixtures.filter((m) => m.key.startsWith(`w:${key}`));
    expect(fx.length).toBe(2);
    expect(daysBetween(fx[0]!.date, fx[1]!.date)).toBe(4);
    for (const m of fx) expect(myMatchDates(g)).toContain(m.date);
    expect(g.inbox!.items.some((x) => x.cat === 'national' && x.key === `natcall:${key}`)).toBe(true);
    // 두 평가전 사이 날은 휴가가 아니다
    const mid = fx[0]!.date.slice(0, 8) + String(+fx[0]!.date.slice(8) + 2).padStart(2, '0');
    expect(isVacationDay(g, mid)).toBe(false);
    // 다음 내 경기 = 대표팀 평가전, 엔진 입력은 대표팀 로스터
    const nx = nextMatch(g)!;
    expect(nx.nat?.key).toBe(fx[0]!.key);
    expect(nx.opponentId).toBe(`n:${fx[0]!.opp}`);
    const rm = roundMatch(g);
    expect(rm.input.myRoster.teamId).toBe('n:Korea Republic');
    expect(rm.input.oppRoster.teamId).toBe(`n:${fx[0]!.opp}`);
    expect(rm.input.myTactics).toBeUndefined();
    // 손흥민 대표팀 로스터에 다른 한국 실제 선수가 있으면 들어간다 (가상 선수는 한국 이름)
    expect(rm.input.myRoster.players.some((p) => !p.real && /^[가-힣]/.test(p.nameKo))).toBe(true);
  });

  it('평가전을 치르면 대표팀 기록에만 쌓이고 리그 경기 기록·순위는 그대로', () => {
    const g = atTier(game(), 'worldClass');
    toFirstWindow(g);
    const nat = ensureNational(g);
    const logBefore = g.matchLog.length;
    const appsBefore = g.player.season.apps;
    const round = g.league.round;
    const rep = playRound(g, { engine: 'quick' });
    expect(rep.nat?.comp).toBe('friendly');
    expect(rep.opponentId.startsWith('n:')).toBe(true);
    expect(g.matchLog.length).toBe(logBefore);
    expect(g.player.season.apps).toBe(appsBefore);
    expect(g.league.round).toBe(round);
    const played = nat.fixtures.filter((m) => m.gf !== undefined);
    expect(played.length).toBe(1);
    if ((played[0]!.min ?? 0) > 0) expect(nat.career.apps).toBe(1);
  });

  it('엔진 대표팀 경기 (결정성): 같은 시드 같은 결과', () => {
    const run = () => {
      const g = atTier(game('c76d-eng'), 'worldClass');
      toFirstWindow(g);
      const rep = playRound(g, { engine: 'agent', cards: false });
      return [rep.result.goalsFor, rep.result.goalsAgainst, rep.result.minutes, rep.result.rating];
    };
    expect(run()).toEqual(run());
  }, 60_000);

  it('일반 티어 유망주는 대체로 소집되지 않는다 (같은 시드 10개 중 소집 2개 이하)', () => {
    let calls = 0;
    for (let k = 0; k < 10; k++) {
      const g = newGame({ mode: 'prospect', position: 'ST', seed: `c76d-p${k}`, difficulty: 'normal' });
      toFirstWindow(g, false);
      calls += Object.values(ensureNational(g).calls).filter(Boolean).length;
    }
    expect(calls).toBeLessThanOrEqual(2);
  });
});

describe('대회 (월드컵 4년 · 대륙컵)', () => {
  it('주기: 2022 월드컵(2018 은 끝난 상태), 2019 아시안컵·코파·네이션스컵·골드컵, 2020 유로', () => {
    expect(tournamentsIn(2018)).not.toContain('wc');
    expect(tournamentsIn(2022)).toContain('wc');
    expect(tournamentsIn(2026)).toContain('wc');
    expect(tournamentsIn(2019)).toEqual(expect.arrayContaining(['copa', 'asian', 'afcon', 'gold']));
    expect(tournamentsIn(2020)).toContain('euro');
    expect(tournamentsIn(2021)).toContain('copa');
    expect(myTournament(nationOf('Korea Republic'), 2019)).toBe('asian');
    expect(myTournament(nationOf('Korea Republic'), 2020)).toBeNull();
    expect(myTournament(nationOf('France'), 2022)).toBe('wc');
  });
  it('참가국: 월드컵 32 (대륙 quota), 유로 24, 코파 12 (남미 10 + 초청 2)', () => {
    const wc = participants('s', 'wc', 2022);
    expect(new Set(wc).size).toBe(32);
    const Q = BALANCE.national.wcQuota;
    expect(wc.filter((n) => nationOf(n).confed === 'UEFA').length).toBe(Q.UEFA);
    expect(participants('s', 'euro', 2020)).toHaveLength(24);
    const copa = participants('s', 'copa', 2019);
    expect(copa).toHaveLength(12);
    expect(copa.filter((n) => nationOf(n).confed === 'CONMEBOL')).toHaveLength(10);
  });
  it('조별(4팀 1회전) → 16강 → 결승, 내 경기는 콜백으로 (소집됐을 때만)', () => {
    const g = game();
    const mine: NatMatch[] = [];
    const run = runTournament(g, 'wc', 2022, '2022-05-22', true, (m) => { mine.push(m); return { gf: 1, ga: 0 }; });
    const r = run.rec;
    expect(r.groups).toHaveLength(8);
    for (const gr of r.groups) expect(gr.table.reduce((t, x) => t + x.p, 0)).toBe(12);
    expect(r.ko.map((k) => k.ties.length)).toEqual([8, 4, 2, 1]);
    expect(r.ko.map((k) => k.name)).toEqual(['16강', '8강', '4강', '결승']);
    if (r.qualified) {
      // 내 나라가 늘 1-0 으로 이기면 우승
      expect(r.reach).toBe('우승');
      expect(r.champion).toBe('Korea Republic');
      expect(mine.length).toBe(7);
      expect(mine.map((m) => m.stage)).toEqual(['조별 1차전', '조별 2차전', '조별 3차전', '16강', '8강', '4강', '결승']);
    }
    // 소집 안 됨: 콜백 없음
    const none = runTournament(g, 'wc', 2022, '2022-05-22', false, () => { throw new Error('불림'); });
    expect(none.mine).toHaveLength(0);
  });
  it('유로 24팀 = 6개 조 → 16강 (성적 좋은 3위 4팀), OFC 4팀 = 1개 조 → 결승', () => {
    const g = game();
    const euro = runTournament(g, 'euro', 2020, '2020-05-17', false, () => ({ gf: 0, ga: 0 })).rec;
    expect(euro.groups).toHaveLength(6);
    expect(euro.ko[0]!.ties).toHaveLength(8);
    const third = euro.groups.map((x) => x.table[2]!.team).filter((t) => euro.ko[0]!.ties.some((k) => k.a === t || k.b === t));
    expect(third).toHaveLength(4);
    const ofc = runTournament(g, 'ofc', 2024, '2024-05-19', false, () => ({ gf: 0, ga: 0 })).rec;
    expect(ofc.ko.map((k) => k.name)).toEqual(['결승']);
  });
  it('업적 XP (18.12): 월드컵 우승 600 / 준우승 350 / 4강 200 / 8강 100, 대륙컵 우승 250, 16강 없음', () => {
    expect(tournamentAchievement('wc', '우승')!.xp).toBe(600);
    expect(tournamentAchievement('wc', '준우승')!.xp).toBe(350);
    expect(tournamentAchievement('wc', '4강')!.xp).toBe(200);
    expect(tournamentAchievement('wc', '8강')!.xp).toBe(100);
    expect(tournamentAchievement('wc', '16강')).toBeNull();
    expect(tournamentAchievement('asian', '우승')!.xp).toBe(250);
    expect(tournamentAchievement('asian', '준우승')).toBeNull();
  });
  it('시즌 끝 여름: 대회가 없는 해는 6월 평가전, 있는 해는 대회 기록·인박스', () => {
    const g = atTier(game(), 'worldClass');
    // 2018-19 시즌 끝 = 2019 아시안컵
    const out = nationalSeasonEnd(g, '2019-05-12', (m) => ({ gf: m.stage === '결승' ? 0 : 2, ga: m.stage === '결승' ? 1 : 0 }));
    expect(out.tournament?.comp).toBe('asian');
    const nat = ensureNational(g);
    expect(nat.tournaments).toHaveLength(1);
    expect(g.inbox!.items.some((x) => x.key === `natcup:asian2019`)).toBe(true);
    // 2019-20 시즌 끝 (2020, 아시아 대회 없음) = 평가전
    g.league.season = 2019;
    const june = nationalSeasonEnd(g, '2020-05-17', () => ({ gf: 1, ga: 1 }));
    expect(june.tournament).toBeNull();
    if (june.matches.length) expect(june.matches.every((m) => m.comp === 'friendly' && m.key.startsWith('j:2020'))).toBe(true);
  });
  it('월드컵 우승 기록 → 레전드 배지 (8.2)', () => {
    const g = game();
    const p = g.player;
    expect(awardBadges(p, 2021).some((b) => b.id === 'worldCup')).toBe(false);
    p.honors = { ...p.honors, worldCups: 1 };
    const rep = p.reputation;
    const got = awardBadges(p, 2021);
    expect(got.map((b) => b.id)).toContain('worldCup');
    expect(p.reputation).toBe(Math.min(BALANCE.reputation.max, rep + BALANCE.badges.reputation));
  });
});

describe('시즌 진행 · 세이브', () => {
  it('한 시즌 (빠른 경기): 월드클래스 손흥민은 A매치 주간 대부분 소집, 시즌 요약에 여름 대표팀', () => {
    const g = atTier(game('c76d-season'), 'worldClass');
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    const nat = ensureNational(g);
    const calls = Object.values(nat.calls);
    expect(calls.length).toBe(4);
    // 부상 기간에는 소집되지 않는다
    expect(calls.filter(Boolean).length).toBeGreaterThanOrEqual(2);
    expect(nat.fixtures.filter((m) => m.key.startsWith('w:')).every((m) => m.gf !== undefined)).toBe(true);
    expect(g.lastSeasonSummary!.nat).toBeDefined();
  }, 120_000);

  it(`세이브 ${SAVE_FORMAT_VERSION}: 왕복 · 옛 세이브(47)는 이어 할 수 없음`, () => {
    const g = atTier(game(), 'worldClass');
    toFirstWindow(g);
    const back = deserialize(serialize(g));
    expect(back.national).toEqual(g.national);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 47;
    expect(() => restore(raw)).toThrow(SaveFormatError);
  });
});
