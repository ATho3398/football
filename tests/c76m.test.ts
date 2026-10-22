// C.76m 다른 경기 백그라운드 미리 계산 · 모든 리그 8~5월 통일
import { afterEach, describe, expect, it } from 'vitest';
import { EnginePool, inputKey, PREFETCH_KEEP, specKey } from '../src/ui/enginePool';
import type { EngineJob } from '../src/engine/jobs';
import { runJob } from '../src/engine/jobs';
import type { NpcMatchInput, NpcMatchResult } from '../src/engine/npcMatch';
import { playNpcMatch } from '../src/engine/npcMatch';
import { applyOther, calendarOf, endDay, isMatchDay, newGame, otherJob, playOthers, playRound, todaysOthers, upcomingOthers, type GameState } from '../src/game';
import { applyOtherLeagueJob, calendarKind, otherLeagueCalendar, otherLeagueJobs } from '../src/otherLeagues';
import { createLeague, nextSeasonLeague } from '../src/league';
import { deserialize, restore, SaveFormatError, serialize } from '../src/save';
import { allLeagueData } from '../data/leagues';

/** 가짜 워커: 받은 일을 fn 으로 계산해 다음 마이크로태스크에 돌려준다 */
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault: () => void }) => void) | null = null;
  posted: { id: number; job: EngineJob }[] = [];
  constructor(public fn: (j: EngineJob) => unknown, public hang = false) { FakeWorker.all.push(this); }
  postMessage(m: { id: number; job: EngineJob }): void {
    this.posted.push(m);
    if (this.hang) return;
    queueMicrotask(() => this.onmessage?.({ data: { id: m.id, out: this.fn(m.job) } }));
  }
  terminate(): void {}
}
const posts = () => FakeWorker.all.reduce((t, w) => t + w.posted.length, 0);
const flush = async (n = 3) => { for (let k = 0; k < n; k++) await new Promise((r) => setTimeout(r, 0)); };
const job = (x: number): EngineJob => ({ kind: 'npc', input: { x } as never });
const dbl = (j: EngineJob) => (j.input as unknown as { x: number }).x * 2;

afterEach(() => { FakeWorker.all = []; });

describe('워커 풀 plan (C.76m)', () => {
  it('며칠치 목록을 맡기면 워커를 size − 1 개까지 띄워 계산하고, 같은 입력의 run 은 다시 보내지 않는다', async () => {
    const pool = new EnginePool(4, () => new FakeWorker(dbl) as never, dbl);
    expect(pool.plan([1, 2, 3, 4, 5, 6].map(job))).toBe(6);
    expect(pool.live).toBe(3);
    await flush();
    expect(pool.planned).toEqual({ total: 6, ready: 6 });
    expect(pool.ready(job(4))).toBe(true);
    expect(pool.ready(job(9))).toBe(false);
    const n0 = posts();
    expect(await Promise.all([3, 1, 6].map((x) => pool.run(job(x))))).toEqual([6, 2, 12]);
    expect(posts()).toBe(n0);
    expect(pool.stats.hits).toBe(3);
    expect(pool.planned.total).toBe(3);
  });

  it('다시 맡기면 목록에 없는 보관분(지난 날·입력이 바뀐 경기)은 버리고, 가까운 날 먼저 · 상한 PREFETCH_KEEP', async () => {
    const pool = new EnginePool(2, () => new FakeWorker(dbl, true) as never, dbl);
    pool.plan([1, 2, 3].map(job));
    // 워커 1개(size − 1)가 1 을 계산 중, 2·3 대기
    expect(FakeWorker.all[0]!.posted.map((m) => (m.job.input as never as { x: number }).x)).toEqual([1]);
    pool.plan([5, 3, 4].map(job));
    expect(pool.stats.wasted).toBe(2);
    expect(pool.planned.total).toBe(3);
    const many = Array.from({ length: PREFETCH_KEEP + 50 }, (_, i) => job(100 + i));
    pool.plan(many);
    expect(pool.planned.total).toBe(PREFETCH_KEEP);
    pool.clearPrefetch();
    expect(pool.planned.total).toBe(0);
  });

  it('실제 작업이 미리 계산보다 먼저 돈다 (미리 계산이 워커를 다 쓰지 않음)', async () => {
    const pool = new EnginePool(2, () => new FakeWorker(dbl, true) as never, dbl);
    pool.plan([1, 2, 3].map(job));
    void pool.run(job(9));
    expect(pool.live).toBe(2);
    expect(FakeWorker.all[1]!.posted.map((m) => (m.job.input as never as { x: number }).x)).toEqual([9]);
  });

  it('보관 키는 입력 요약: 글자 하나만 달라도 다른 키, 같으면 같은 키', () => {
    const a: EngineJob = { kind: 'npc', input: { x: 1, s: 'abc' } as never };
    const b: EngineJob = { kind: 'npc', input: { x: 1, s: 'abd' } as never };
    expect(specKey(a)).toBe(specKey({ kind: 'npc', input: { x: 1, s: 'abc' } as never }));
    expect(specKey(a)).not.toBe(specKey(b));
    expect(specKey(a).length).toBeLessThan(40);
    expect(inputKey(a).length).toBeGreaterThan(0);
  });

  it('실제 엔진: 미리 계산한 결과 = 그 자리에서 계산한 결과', async () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76m-e', difficulty: 'normal', leagues: ['pl', 'saudi'] });
    while (!upcomingOthers(g, 1).length) { playOthers(g, 'quick'); endDay(g); }
    const input = upcomingOthers(g, 1)[0]!;
    const pool = new EnginePool(2, () => new FakeWorker(runJob) as never, runJob);
    pool.plan([{ kind: 'npc', input }]);
    await flush();
    expect(pool.ready({ kind: 'npc', input })).toBe(true);
    expect(await pool.npc(input)).toEqual(playNpcMatch(input));
    expect(pool.stats.hits).toBe(1);
  });
});

/** 가짜 엔진 (결정성 비교용, 빠름): 입력 요약으로 정한 점수 + 선발 11명 출전 줄 */
function fakeMatch(input: NpcMatchInput): NpcMatchResult {
  const k = specKey({ kind: 'npc', input });
  const h = parseInt(k.slice(0, 6), 36);
  const line = (p: { id: string }, i: number) => [p.id, 90, i === 9 && h % 3 === 0 ? 1 : 0, 0, 65 + (h % 20)] as [string, number, number, number, number];
  return { hg: h % 4, ag: (h >> 3) % 3, goals: [], players: [...input.home.players.slice(0, 11).map(line), ...input.away.players.slice(0, 11).map(line)] };
}

const legs = ['saudi', 'kleague1', 'eredivisie'];
const snap = (g: GameState) => JSON.stringify([g.league.table, g.league.schedule, g.otherLeagues, g.playerStats, g.calendar.date]);

/** 그날 다른 경기 (내 리그 다른 팀 + 고른 다른 리그) 를 pool(있으면) 또는 바로 계산해 기록 */
async function dayOthers(g: GameState, pool: EnginePool | null): Promise<number> {
  const own = todaysOthers(g).map(([r, i]) => otherJob(g, r, i));
  const lg = otherLeagueJobs(g, g.calendar.date);
  const run = (input: NpcMatchInput) => (pool ? (pool.run({ kind: 'npc', input }) as Promise<NpcMatchResult>) : Promise.resolve(fakeMatch(input)));
  const a = await Promise.all(own.map((j) => run(j.input)));
  own.forEach((j, k) => applyOther(g, j.r, j.i, a[k]!));
  const b = await Promise.all(lg.map((j) => run(j.input)));
  lg.forEach((j, k) => applyOtherLeagueJob(g, j, b[k]!));
  return own.length + lg.length;
}

describe('미리 계산 결정성 (C.76m): 미리 계산 여부·세이브 왕복·입력 변경과 무관하게 같은 결과', () => {
  it('3일치 미리 계산 + 중간 세이브 왕복 + 다른 팀 레이팅 변경 = 미리 계산 없이 진행한 결과', async () => {
    const opts = { mode: 'prospect' as const, position: 'ST' as const, seed: 'c76m-d', difficulty: 'normal' as const, leagues: legs };
    let a = newGame(opts);
    const b = newGame(opts);
    expect(snap(a)).toBe(snap(b));
    const pool = new EnginePool(4, () => new FakeWorker((j) => fakeMatch(j.input as NpcMatchInput)) as never, (j) => fakeMatch(j.input as NpcMatchInput));
    let total = 0;
    let changed = false;
    for (let day = 0; day < 45; day++) {
      // 미리 계산 (A 만): 홈에 있는 동안 3일치
      pool.plan(upcomingOthers(a, 3).map((input): EngineJob => ({ kind: 'npc', input })));
      await flush(2);
      if (day === 20) a = deserialize(serialize(a));
      const today = otherLeagueJobs(a, a.calendar.date);
      if (day >= 25 && !changed && today.length) {
        // 미리 계산한 뒤 입력이 바뀌는 일 (오늘 경기 팀 레이팅 변경): 그 보관분은 쓰지 않고 다시 계산해야 같은 결과
        changed = true;
        const lg = a.otherLeagues!.find((o) => o.id === today[0]!.lg)!;
        const t = lg.schedule[today[0]!.r]![today[0]!.i]!.home;
        lg.teams.find((x) => x.id === t)!.rating += 3;
        b.otherLeagues!.find((o) => o.id === lg.id)!.teams.find((x) => x.id === t)!.rating += 3;
      }
      if (isMatchDay(a)) {
        total += await dayOthers(a, pool);
        await dayOthers(b, null);
        playRound(a, { engine: 'quick', others: 'quick' });
        playRound(b, { engine: 'quick', others: 'quick' });
      } else {
        total += await dayOthers(a, pool);
        await dayOthers(b, null);
        endDay(a);
        endDay(b);
      }
      expect(snap(a)).toBe(snap(b));
    }
    expect(changed).toBe(true);
    expect(total).toBeGreaterThan(60);
    // 대부분 미리 계산분을 썼고, 입력이 바뀐 경기는 다시 계산했다
    expect(pool.stats.hits).toBeGreaterThan(total * 0.5);
    expect(pool.stats.misses).toBeGreaterThan(0);
  });

  it('upcomingOthers 는 상태를 바꾸지 않고, 내 팀 경기는 넣지 않는다', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76m-u', difficulty: 'normal', leagues: legs });
    for (let k = 0; k < 20; k++) { playOthers(g, 'quick'); if (isMatchDay(g)) break; endDay(g); }
    const before = serialize(g);
    const list = upcomingOthers(g, 3);
    expect(list.length).toBeGreaterThan(0);
    expect(serialize(g)).toBe(before);
    expect(list.every((x) => x.home.teamId !== g.player.teamId && x.away.teamId !== g.player.teamId)).toBe(true);
  });
});

describe('모든 리그 8~5월 (C.76m)', () => {
  it('등록된 리그 모두 PL 과 같은 달력 종류 · 같은 시즌 번호, 8월 개막 ~ 다음 해 5월', () => {
    for (const d of allLeagueData()) {
      const lg = createLeague('c76m-cal', 2018, d.id);
      expect(calendarKind(lg)).toBe('autumn-spring');
      const cal = otherLeagueCalendar('c76m-cal', lg);
      expect(cal.opening.slice(0, 7)).toBe('2018-08');
      expect(cal.final.slice(0, 7)).toBe('2019-05');
    }
  });

  it('K리그1 · MLS 로 시작해도 7~8월 소집, 다른 리그와 같은 시즌', () => {
    for (const id of ['kleague1', 'mls', 'brasileirao', 'jleague1']) {
      const g = newGame({ mode: 'prospect', position: 'ST', seed: `c76m-${id}`, difficulty: 'normal', leagues: [id, 'pl'] });
      expect(g.league.id).toBe(id);
      expect(calendarOf(g).opening.slice(0, 7)).toBe('2018-08');
      expect(g.otherLeagues![0]!.season).toBe(g.league.season);
      expect(g.otherLeagues![0]!.round).toBe(0);
    }
  });

  it('옛 달력 표시(legacyCal) 시즌은 3~12월로 끝내고 다음 시즌부터 8~5월, 옛 세이브(51)는 이어 할 수 없다 (C.77r)', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c76m-m', difficulty: 'normal', leagues: ['kleague1', 'pl', 'mls', 'jleague1'] });
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 51;
    expect(() => restore(raw)).toThrow(SaveFormatError);
    const m = g;
    m.league.legacyCal = 'spring-autumn';
    // 옛 달력: 3월 개막 ~ 그해 12월
    expect(calendarOf(m).opening.slice(5, 7)).toBe('03');
    expect(calendarOf(m).final.slice(0, 7)).toBe(`${m.league.season}-12`);
    // 다음 시즌은 8~5월, 표시 없음
    const next = nextSeasonLeague(m.league, m.worldSeed);
    expect(next.legacyCal).toBeUndefined();
    expect(otherLeagueCalendar(m.worldSeed, next).opening.slice(0, 7)).toBe(`${m.league.season + 1}-08`);
  });
});
