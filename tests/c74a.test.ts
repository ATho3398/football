// C.74a (43단계 a): 날씨 5종 · 연고지 월별 기후 · 예보 · 엔진 실행 배율 · 심판 성향 · 경기 화면 입자 · 결과 한 줄
import { afterEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { NEUTRAL_ENV, resolveEnv } from '../src/engine/env';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import type { EngineInput } from '../src/engine/types';
import { calendarOf, myMatchConditions, newGame, otherJob, playRound, roundMatch, selectableRealPlayers, type GameState } from '../src/game';
import { teamById } from '../src/league';
import { matchConditions } from '../src/matchEnv';
import { NEUTRAL_REFEREE, refereeFor, refereeLabel, refereePool, refereeTraits } from '../src/referees';
import { pitchWeather, setPitchWeather } from '../src/ui/pitch/renderer';
import { envVM, homeVM, matchResultVM } from '../src/ui/viewModels';
import { homeView } from '../src/ui/views/home';
import { PATCH_LABEL, STAGE_LABEL } from '../src/version';
import { climate, normalsWeights, regionOf, setEnvironmentFixed, weatherEnv, weatherFor, WEATHER_KINDS, type WeatherKind } from '../src/weather';
import { addDays, daysBetween } from '../src/calendar';

afterEach(() => setEnvironmentFixed(false));

const game = (seed = 'c74a') => newGame({ mode: 'real', playerId: selectableRealPlayers()[0]!.id, seed, difficulty: 'normal' });

function engineInput(g: GameState, seed: number, env?: EngineInput['env']): EngineInput {
  const [h, a] = ['mci', 'liv'];
  const hr = teamById(g.league, h).rating;
  const ar = teamById(g.league, a).rating;
  return {
    home: teamSetupFromRoster(g.rosters[h]!, hr, ar, g.worldSeed), away: teamSetupFromRoster(g.rosters[a]!, ar, hr, g.worldSeed),
    mode: 'auto', difficulty: 'normal', seed, bigMatch: false, ...(env ? { env } : {}),
  };
}

describe('엔진 실행 배율 (판단 무수정)', () => {
  it('env 없음 = 빈 env = 모두 1 인 env: 같은 시드 같은 경기 (맑음·보통 심판 지문)', () => {
    const g = game();
    const a = createMatch(engineInput(g, 11)).runToEnd();
    const b = createMatch(engineInput(g, 11, {})).runToEnd();
    const c = createMatch(engineInput(g, 11, { ...NEUTRAL_ENV })).runToEnd();
    for (const x of [b, c]) {
      expect(x.homeGoals).toBe(a.homeGoals);
      expect(x.awayGoals).toBe(a.awayGoals);
      expect(x.teamStats).toEqual(a.teamStats);
      expect(x.events.length).toBe(a.events.length);
    }
  });

  it('비 경기는 결정적이고 맑음과 다르다', () => {
    const g = game();
    const rain = weatherEnv('rain');
    const a = createMatch(engineInput(g, 12, rain)).runToEnd();
    const b = createMatch(engineInput(g, 12, rain)).runToEnd();
    const c = createMatch(engineInput(g, 12)).runToEnd();
    expect(b.teamStats).toEqual(a.teamStats);
    expect(a.teamStats).not.toEqual(c.teamStats);
  });

  it('resolveEnv 는 빠진 키를 1 로 채운다', () => {
    const e = resolveEnv({ card: 1.2 });
    expect(e.card).toBe(1.2);
    expect(e.touch).toBe(1);
    expect(Object.keys(e).sort()).toEqual(Object.keys(NEUTRAL_ENV).sort());
  });

  it('효과 크기는 실행 성공률 ±3~10% 안 (BALANCE.weather.effects)', () => {
    for (const [kind, eff] of Object.entries(BALANCE.weather.effects)) {
      for (const [k, v] of Object.entries(eff)) {
        expect(k in NEUTRAL_ENV, `${kind}.${k}`).toBe(true);
        // 감속·오차·스태미나는 물리량이라 범위를 넓게
        const wide = ['ballDecel', 'longError', 'drain', 'recover', 'gkCatch'].includes(k);
        expect(Math.abs(v - 1), `${kind}.${k}`).toBeLessThanOrEqual(wide ? 0.31 : 0.1);
      }
    }
  });
});

describe('날씨 (연고지 월별 기후, 결정적)', () => {
  it('확률 합 1 · 폭염은 여름만 · 눈은 겨울 북부가 남부보다 많다', () => {
    for (const t of ['tot', 'new', 'car', 'zzz']) for (let m = 1; m <= 12; m++) {
      const p = climate(t, m);
      expect(WEATHER_KINDS.reduce((s, k) => s + p[k], 0)).toBeCloseTo(1, 9);
    }
    expect(climate('tot', 1).heat).toBe(0);
    expect(climate('tot', 7).heat).toBeGreaterThan(0);
    expect(climate('new', 1).snow).toBeGreaterThan(climate('bou', 1).snow);
    expect(climate('car', 11).rain).toBeGreaterThan(climate('tot', 11).rain);
  });

  it('나라별 기후 (C.79p): 잉글랜드는 옛 공식 그대로, 다른 나라는 평년값 지역, 남반구는 계절 반대', () => {
    // 잉글랜드·웨일스 (리그 밖 잉글랜드 클럽 포함) = 잉글랜드 월 표 × 지역 배율 그대로
    const W = BALANCE.weather;
    for (const t of ['tot', 'mci', 'car', 'championship:bla', 'x:lee', 'x:swa', 'zzz']) for (let m = 1; m <= 12; m++) {
      const base = W.month[m]!;
      const [r, wi, h, sn] = W.region[regionOf(t)]!;
      const w = [base[0]!, base[1]!, base[2]! * r, base[3]! * wi, base[4]! * h, base[5]! * sn];
      const tot = w.reduce((a, b) => a + b, 0);
      WEATHER_KINDS.forEach((k, i) => expect(climate(t, m)[k]).toBeCloseTo(w[i]! / tot, 12));
    }
    expect(regionOf('x:lee')).toBe('europe');
    // 리그 팀·챔스 외부 클럽 → 나라·도시 지역 (x: 는 같은 클럽의 리그 팀 도시로)
    expect(regionOf('laliga:rma')).toBe('spain');
    expect(regionOf('laliga:ath')).toBe('spain_n');
    expect(regionOf('x:bar')).toBe('spain');
    expect(regionOf('seriea:juv')).toBe('italy_n');
    expect(regionOf('x:asm')).toBe('france_s');
    expect(regionOf('x:zen')).toBe('russia');
    expect(regionOf('brasileirao:fla')).toBe('brazil_n');
    expect(regionOf('kleague1:fcs')).toBe('korea');
    for (const t of ['laliga:sev', 'kleague1:fcs', 'brasileirao:pal', 'saudi:hil', 'x:gal']) for (let m = 1; m <= 12; m++) {
      expect(WEATHER_KINDS.reduce((s, k) => s + climate(t, m)[k], 0)).toBeCloseTo(1, 9);
    }
    // 남반구: 1월이 여름
    expect(climate('brasileirao:pal', 1).heat).toBeGreaterThan(climate('brasileirao:pal', 7).heat);
    expect(climate('brasileirao:pal', 1).snow).toBe(0);
    // 서울 1월 한파 > 런던, 리야드 여름 폭염 > 마드리드 > 런던, 리야드 비 거의 없음
    expect(climate('kleague1:fcs', 1).snow).toBeGreaterThan(climate('tot', 1).snow * 2);
    expect(climate('saudi:hil', 8).heat).toBeGreaterThan(climate('laliga:rma', 8).heat);
    expect(climate('laliga:rma', 8).heat).toBeGreaterThan(climate('tot', 8).heat);
    expect(climate('saudi:hil', 10).rain).toBeLessThan(0.02);
  });

  it('평년값 환산식 보정: 런던 히스로 평년값 → 잉글랜드 월 표와 각 칸 7%p 안', () => {
    for (let m = 1; m <= 12; m++) {
      const a = BALANCE.weather.month[m]!;
      const b = normalsWeights('calLondon', m);
      const ta = a.reduce((x, y) => x + y, 0);
      const tb = b.reduce((x, y) => x + y, 0);
      a.forEach((x, i) => expect(Math.abs(x / ta - b[i]! / tb)).toBeLessThan(0.07));
    }
  });

  it('같은 (세계 시드, 날짜, 홈팀) = 같은 날씨, 시즌에 여러 날씨가 나온다', () => {
    const seen = new Set<WeatherKind>();
    for (let d = 0; d < 200; d++) {
      const date = addDays('2018-08-11', d);
      const w = weatherFor('s', date, 'mci');
      expect(weatherFor('s', date, 'mci')).toBe(w);
      seen.add(w);
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });

  it('측정 고정이면 늘 맑음·보통 심판', () => {
    setEnvironmentFixed(true);
    const c = matchConditions('s', '2019-01-12', 'new');
    expect(c.weather).toBe('clear');
    expect(c.referee).toBe(NEUTRAL_REFEREE);
    expect(c.env).toEqual({});
  });
});

describe('심판 성향', () => {
  it('명단 18명, 카드 0.8~1.25 · 어드밴티지 0.8~1.2, 세계마다 같고 배정도 결정적', () => {
    const pool = refereePool('w1');
    expect(pool).toHaveLength(BALANCE.referee.pool);
    expect(new Set(pool.map((r) => r.nameKo)).size).toBe(pool.length);
    for (const r of pool) {
      expect(r.card).toBeGreaterThanOrEqual(0.8);
      expect(r.card).toBeLessThanOrEqual(1.25);
      expect(r.advantage).toBeGreaterThanOrEqual(0.8);
      expect(r.advantage).toBeLessThanOrEqual(1.2);
    }
    expect(refereePool('w1')).toEqual(pool);
    expect(refereeFor('w1', '2018-09-01', 'ars')).toEqual(refereeFor('w1', '2018-09-01', 'ars'));
  });

  it('이름표: 엄격·관대·흐름 중시·자주 끊음', () => {
    expect(refereeTraits({ id: 0, nameKo: 'a', card: 1.2, advantage: 1.15 })).toEqual({ card: '카드 엄격', flow: '흐름 중시' });
    expect(refereeTraits({ id: 0, nameKo: 'a', card: 0.85, advantage: 0.85 })).toEqual({ card: '카드 관대', flow: '자주 끊음' });
    expect(refereeLabel({ id: 0, nameKo: '가', card: 1, advantage: 1 })).toBe('가 · 카드 보통');
  });
});

describe('게임 연결: 내 경기 · NPC 경기 · 예보 · 결과', () => {
  it('roundMatch 와 otherJob 이 같은 규칙의 env 를 넣는다', () => {
    const g = game();
    const rm = roundMatch(g);
    const c = myMatchConditions(g)!;
    expect(rm.cond.weather).toBe(c.weather);
    expect(rm.input.env ?? {}).toEqual(c.env);
    const cal = calendarOf(g);
    const f = g.league.schedule[0]![1]!;
    const job = otherJob(g, 0, 1);
    expect(job.input.env ?? {}).toEqual(matchConditions(g.worldSeed, cal.fixtureDates[0]![1]!, f.home).env);
  });

  it('예보는 경기 forecastDays 일 전부터 공개', () => {
    const g = game();
    const date = calendarOf(g).fixtureDates[0]![0]!;
    const days = daysBetween(g.calendar.date, date);
    const vm = envVM(g);
    if (days > BALANCE.weather.forecastDays) {
      expect(vm.open).toBe(false);
      expect(vm.opensIn).toBe(days - BALANCE.weather.forecastDays);
      expect(homeView(homeVM(g))).toContain('공개돼요');
    }
    g.calendar.date = addDays(date, -2);
    const open = envVM(g);
    expect(open.open).toBe(true);
    expect(open.referee).toBeTruthy();
    const html = homeView(homeVM(g));
    expect(html).toContain('hm-env');
    expect(html).toContain(open.weatherKo!);
  });

  it('경기 보고에 날씨·심판, 결과 화면 한 줄', () => {
    const g = game('c74a-report');
    playRound(g, { engine: 'quick' });
    const m = g.lastMatch!;
    expect(m.cond).toBeTruthy();
    const vm = matchResultVM(g, null)!;
    expect(vm.env!.referee).toBe(m.cond!.referee);
    if (m.cond!.weather === 'rain') expect(vm.env!.line).toBe('빗속 경기');
  });
});

describe('경기 화면 · 버전', () => {
  it('피치 날씨 설정', () => {
    setPitchWeather('rain');
    expect(pitchWeather()).toBe('rain');
    setPitchWeather(null);
    expect(pitchWeather()).toBe('clear');
  });

  it('버전 라벨', () => {
    expect(PATCH_LABEL).toMatch(/^C\.([7-9]\d|7[4-9])/);
    expect(STAGE_LABEL).toMatch(/^\d+[a-z]?단계$/);
  });
});
