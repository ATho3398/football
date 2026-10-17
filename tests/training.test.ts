import { beforeEach, describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { addDays, daysBetween } from '../src/calendar';
import {
  calendarOf, campDate, roundMatch, dayPlan, endDay, isRestLocked, isMatchDay, isVacationDay, myMatchDates, newGame, playOthers, playRound, SAVE_FORMAT_VERSION,
  setDayTraining, startNextSeason, type GameState,
} from '../src/game';
import { defaultPlan, gaugeNeed, initTraining, lowestInBundle, takeXp, techDay, weekStart } from '../src/training';
import {
  deserialize, exportSave, importSave, initSaves, listSaves, loadGame, loadReplays, migrate, resetSaveCache, saveGame, saveReplays, serialize,
} from '../src/save';
import { memoryBackend, setStoreBackend } from '../src/saveStore';
import { packReplay, unpackReplay } from '../src/replayCodec';
import { playMyMatch } from '../src/engine/adapter';

const T = BALANCE.training;

/** 내 경기 날까지 하루씩 (다른 경기는 빠른 경기로) */
function toMatchDay(g: GameState): void {
  while (!isMatchDay(g)) {
    playOthers(g, 'quick');
    endDay(g);
  }
}

describe('훈련 (25.3, 부록 C.41)', () => {
  it('기본 주간 계획 (C.44): 경기 다음 날 휴식(고정), 전날 영상, 나머지 기술. 7일 주 체력 회복 합계 26.5, 훈련 XP 3.5 (C.43 과 같게)', () => {
    expect(defaultPlan(1, 6)).toBe('rest');
    expect(defaultPlan(2, 5)).toBe('tech');
    expect(defaultPlan(3, 4)).toBe('tech');
    expect(defaultPlan(6, 1)).toBe('video');
    // 토 → 화 (3일 간격): 휴식 → 영상. 연전(다음 날 또 경기)이어도 휴식이 먼저
    expect(defaultPlan(1, 2)).toBe('rest');
    expect(defaultPlan(2, 1)).toBe('video');
    expect(defaultPlan(1, 1)).toBe('rest');
    const week = [1, 2, 3, 4, 5, 6].map((d) => defaultPlan(d, 7 - d));
    expect(week.reduce((t, k) => t + T.kinds[k].fatigue, 0)).toBeCloseTo(26.5, 6);
    expect(week.reduce((t, k) => t + T.kinds[k].xp, 0)).toBeCloseTo(3.5, 6);
  });

  it('경기 다음 날 휴식은 바꿀 수 없다 (C.44)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'rest-lock', difficulty: 'normal' });
    const first = myMatchDates(g)[0]!;
    const after = addDays(first, 1);
    expect(dayPlan(g, after)).toBe('rest');
    expect(isRestLocked(g, after)).toBe(true);
    expect(setDayTraining(g, after, 'tech')).toBe(false);
    expect(dayPlan(g, after)).toBe('rest');
    // 옛 세이브의 그날 변경도 무시
    g.training.overrides[after] = 'intense';
    expect(dayPlan(g, after)).toBe('rest');
    // 이틀 뒤는 기술 훈련, 바꿀 수 있다
    expect(dayPlan(g, addDays(first, 2))).toBe('tech');
    expect(setDayTraining(g, addDays(first, 2), 'intense')).toBe(true);
  });

  it('새 커리어는 개막 7일 전 소집에서 시작하고, 첫 주는 기술 훈련 + 전날 영상 분석', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'camp', difficulty: 'normal' });
    const cal = calendarOf(g);
    expect(g.calendar.date).toBe(addDays(cal.opening, -T.vacation.campDays));
    expect(g.calendar.date).toBe(campDate(g));
    expect(dayPlan(g)).toBe('tech');
    const first = myMatchDates(g)[0]!;
    expect(dayPlan(g, addDays(first, -1))).toBe('video');
  });

  it('훈련 XP 주간 상한 6, 소수는 모았다가 정수로', () => {
    const t = initTraining('2018-08-06');
    let whole = 0;
    for (let d = 0; d < 7; d++) whole += takeXp(t, addDays('2018-08-06', d), 1.5, 1).whole;
    expect(t.weekXp).toBe(T.weeklyXpCap);
    expect(whole).toBe(6);
    // 다음 주 월요일이면 다시
    expect(weekStart('2018-08-13')).toBe('2018-08-13');
    expect(takeXp(t, '2018-08-13', 1, 0.5).gained).toBeCloseTo(0.5, 6);
  });

  it('기술 훈련 게이지 30 → 그 묶음 가장 낮은 능력치 +1, 묶음당 시즌 +2 상한', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'gauge', difficulty: 'normal' });
    const t = g.training;
    const p = g.player;
    const low = lowestInBundle(p, 'passing');
    const before = p.attributes[low];
    let ups = 0;
    for (let d = 0; d < T.gauge.full * 12; d++) if (techDay(t, p, "passing")) ups++;
    expect(ups).toBe(T.gauge.bundleSeasonMax);
    expect(p.attributes[low]).toBeGreaterThanOrEqual(before + 1);
    expect(t.gauges.passing).toBe(gaugeNeed(p, 'passing'));
  });

  it('[계속]처럼 하루씩 넘기면 계획대로 XP 와 피로가 바뀌고, 결장 경기 XP 는 0', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'train-run', difficulty: 'normal' });
    g.player.fatigue = 40;
    const xp0 = g.player.totalXp;
    toMatchDay(g);
    expect(g.player.fatigue).toBeLessThan(40);
    expect(g.player.totalXp - xp0).toBeGreaterThan(0);
    expect(g.training.season.days.tech).toBeGreaterThan(0);
    g.player.suspended = 1;
    expect(playRound(g, { engine: 'quick' }).result.xp).toBe(0);
  });

  it('그날만 바꾸기: 바꾼 날만 다르고 기본과 같으면 변경을 지운다. 경기 날은 못 바꾼다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'override', difficulty: 'normal' });
    const d = g.calendar.date;
    expect(setDayTraining(g, d, 'intense')).toBe(true);
    expect(dayPlan(g, d)).toBe('intense');
    expect(dayPlan(g, addDays(d, 1))).toBe('tech');
    expect(setDayTraining(g, d, 'tech')).toBe(true);
    expect(g.training.overrides[d]).toBeUndefined();
    expect(setDayTraining(g, myMatchDates(g)[0]!, 'rest')).toBe(false);
  });

  it('A매치 휴식기는 휴가: 훈련 없음, XP 0, 피로 하루 −6', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'vacation', difficulty: 'normal' });
    g.player.tags = []; // 장단점(회복력 등, C.45)이 회복량을 바꾸지 않게
    const cal = calendarOf(g);
    const brk = cal.breaks.find((b) => b.kind === 'international')!;
    const vac: string[] = [];
    for (let k = -10; k <= 10; k++) if (isVacationDay(g, addDays(brk.date, k))) vac.push(addDays(brk.date, k));
    expect(vac.length).toBeGreaterThanOrEqual(5);
    expect(vac.every((d) => !myMatchDates(g).includes(d))).toBe(true);
    // 그날까지 가서 휴가 하루
    while (daysBetween(g.calendar.date, vac[0]!) > 0) {
      if (isMatchDay(g)) playRound(g, { engine: 'quick' });
      else { playOthers(g, 'quick'); endDay(g); }
    }
    expect(dayPlan(g)).toBe('vacation');
    g.player.fatigue = 30;
    const xp = g.player.totalXp;
    playOthers(g, 'quick');
    endDay(g);
    expect(g.player.fatigue).toBeCloseTo(30 - T.vacation.fatigue, 6);
    expect(g.player.totalXp).toBe(xp);
    expect(setDayTraining(g, g.calendar.date, 'tech')).toBe(isVacationDay(g, g.calendar.date) ? false : true);
  });

  it('비시즌 → 다음 시즌은 개막 7일 전 소집, 시즌 기록은 보존 기록(archive)으로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'offseason', difficulty: 'normal' });
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    startNextSeason(g);
    expect(g.calendar.date).toBe(addDays(calendarOf(g).opening, -T.vacation.campDays));
    expect(g.archive).toHaveLength(1);
    const a = g.archive[0]!;
    expect(a.my).toHaveLength(38);
    expect(a.results.length).toBe(38 * 10 - 38);
    expect(a.table).toHaveLength(20);
    expect(g.training.season.xp).toBe(0);
  });
});

describe('세이브 (25.4, 부록 C.41)', () => {
  beforeEach(() => {
    setStoreBackend(memoryBackend());
    resetSaveCache();
  });

  it('19 → 20: 훈련 상태·보존 기록 추가, 조언 기간 라운드 → 30일', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'mig20', difficulty: 'normal' });
    for (let k = 0; k < 3; k++) playRound(g, { engine: 'quick' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 19;
    delete raw.training;
    delete raw.archive;
    raw.player.advice = { kind: 'coach', group: 'CB', pos: 'CB', from: 'ST', season: 2017, untilSeason: 2018, untilRound: 4 };
    const back = deserialize(JSON.stringify(raw));
    expect(back.saveFormat).toBe(SAVE_FORMAT_VERSION);
    expect(SAVE_FORMAT_VERSION).toBe(30);
    expect(back.training.focus).toBe('auto');
    expect(back.archive).toEqual([]);
    expect(back.player.advice).toMatchObject({ untilDays: BALANCE.aptitude.advice.windowDays });
    expect((back.player.advice as unknown as Record<string, unknown>).untilRound).toBeUndefined();
    playRound(back, { engine: 'quick' });
    expect(back.league.round).toBe(4);
  });

  it('18 → 20 연속 변환', () => {
    const g = newGame({ mode: 'prospect', position: 'CM', seed: 'mig18-20', difficulty: 'normal' });
    for (let k = 0; k < 2; k++) playRound(g, { engine: 'quick' });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 18;
    delete raw.training;
    delete raw.archive;
    delete raw.player.profLog;
    const back = migrate(raw);
    expect(back.saveFormat).toBe(30);
    expect(back.player.profLog).toBeDefined();
    expect(back.training).toBeDefined();
  });

  it('IndexedDB(메모리 대역) 저장·불러오기, 압축, 옛 localStorage 세이브는 처음 한 번 옮긴다', async () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'store', difficulty: 'normal' });
    playRound(g, { engine: 'quick' });
    // 옛 세이브 (localStorage)
    const ls = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v), removeItem: (k: string) => void ls.delete(k),
    };
    const old = JSON.parse(serialize(g));
    old.saveFormat = 19;
    delete old.training;
    delete old.archive;
    ls.set('football-career:2', JSON.stringify({ meta: { slot: '2', savedAt: '2026-10-01T00:00:00Z', name: 'old', season: 2018, round: 1, age: 17 }, state: old }));
    await initSaves();
    expect(ls.size).toBe(0);
    expect(listSaves()[2]?.name).toBe('old');
    const loadedOld = await loadGame('2');
    expect(loadedOld?.saveFormat).toBe(30);
    expect(await saveGame('1', g)).toBe(true);
    const meta = listSaves()[1]!;
    expect(meta.size).toBeLessThan(serialize(g).length / 3);
    const back = await loadGame('1');
    expect(serialize(back!)).toBe(serialize(g));
    await saveReplays('1', [{ season: 2018, round: 1, label: 'x', data: new Uint8Array([1, 2, 3]) }]);
    expect((await loadReplays('1'))[0]?.label).toBe('x');
    await saveReplays('1', [2, 3, 4, 5, 6, 7].map((r) => ({ season: 2018, round: r, label: `r${r}`, data: new Uint8Array([r]) })));
    const kept = await loadReplays('1');
    expect(kept.map((x) => x.round)).toEqual([3, 4, 5, 6, 7]);
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });

  it('파일 내보내기/가져오기 (gzip JSON)', async () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'export', difficulty: 'normal' });
    playRound(g, { engine: 'quick' });
    const bytes = await exportSave(g);
    expect(bytes[0]).toBe(0x1f);
    const back = await importSave(bytes);
    expect(serialize(back)).toBe(serialize(g));
    await expect(importSave(new TextEncoder().encode('{"x":1}'))).rejects.toThrow();
  });
});

describe('리플레이 압축 (25.4 2번, C.41)', () => {
  it('위치 0.1 m·시간 0.01 초 안에서 그대로 돌아오고, 이벤트·선수는 같다', async () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'codec', difficulty: 'normal' });
    const rm = roundMatch(g);
    const r = playMyMatch(rm.input, { teams: rm.teams }).replay!;
    const back = unpackReplay(JSON.parse(JSON.stringify(packReplay(r))));
    expect(back.frames).toHaveLength(r.frames.length);
    expect(back.events).toEqual(r.events);
    expect(back.players).toEqual(r.players);
    let err = 0;
    back.frames.forEach((f, i) => {
      const o = r.frames[i]!;
      expect(f.carrier).toBe(o.carrier);
      expect(f.restart).toBe(o.restart);
      err = Math.max(err, Math.abs(f.e - o.e), Math.abs(f.ball.z - o.ball.z), ...f.players.map((p, k) => Math.abs(p.x - o.players[k]!.x) + Math.abs(p.y - o.players[k]!.y)));
    });
    expect(err).toBeLessThanOrEqual(0.1 + 1e-9);
  });
});
