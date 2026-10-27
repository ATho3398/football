// C.75b 44b E-1 속도: 워커 풀 — 코어 수 상한 · 늦게 띄우기 · 첫 워커 데우기 · 미리 계산(입력이 같을 때만) · 오류/시간 초과 메인 대체 · 취소
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnginePool, inputKey, JOB_TIMEOUT_MS, MAX_WORKERS, poolSize } from '../src/ui/enginePool';
import type { EngineJob } from '../src/engine/jobs';

/** 가짜 워커: 받은 입력의 x 를 두 배로 돌려준다. mode 로 죽거나 답하지 않게 할 수 있다 */
class FakeWorker {
  static all: FakeWorker[] = [];
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: ((e: { message: string; preventDefault: () => void }) => void) | null = null;
  posted: { id: number; job: EngineJob }[] = [];
  terminated = false;
  constructor(public mode: 'ok' | 'crash' | 'hang' = 'ok') { FakeWorker.all.push(this); }
  postMessage(m: { id: number; job: EngineJob }): void {
    this.posted.push(m);
    if (this.mode === 'hang') return;
    queueMicrotask(() => {
      if (this.terminated) return;
      if (this.mode === 'crash') this.onerror?.({ message: 'boom', preventDefault: () => {} });
      else this.onmessage?.({ data: { id: m.id, out: `w${val(m.job) * 2}` } });
    });
  }
  terminate(): void { this.terminated = true; }
}

const val = (j: EngineJob) => (j.input as unknown as { x: number }).x;
const job = (x: number, extra: Record<string, unknown> = {}): EngineJob => ({ kind: 'npc', input: { x, ...extra } as never });
const mainRun = (j: EngineJob) => `m${val(j) * 2}`;
const flush = () => new Promise((r) => setTimeout(r, 0));
const posts = () => FakeWorker.all.reduce((t, w) => t + w.posted.length, 0);

afterEach(() => { FakeWorker.all = []; vi.useRealTimers(); });

describe('C.75b 워커 풀', () => {
  it('풀 크기 = 코어 수, 상한 MAX_WORKERS · 워커는 일이 밀릴 때만 띄운다', async () => {
    expect(MAX_WORKERS).toBe(6);
    expect(poolSize()).toBeGreaterThanOrEqual(1);
    expect(poolSize()).toBeLessThanOrEqual(MAX_WORKERS);
    const pool = new EnginePool(3, () => new FakeWorker() as never, mainRun);
    expect(pool.live).toBe(0);
    const one = await pool.run(job(1));
    expect(one).toBe('w2');
    expect(pool.live).toBe(1);
    const outs = await Promise.all([1, 2, 3, 4, 5].map((x) => pool.run(job(x))));
    expect(outs).toEqual(['w2', 'w4', 'w6', 'w8', 'w10']);
    expect(pool.live).toBe(3);
    expect(pool.stats.main).toBe(0);
  });

  it('첫 워커 데우기: 워커 하나만 띄우고 곧 칠 경기를 미리 계산 → 같은 입력이면 다시 보내지 않고 그 결과', async () => {
    const pool = new EnginePool(4, () => new FakeWorker() as never, mainRun);
    pool.warm(job(7));
    expect(pool.live).toBe(1);
    await flush();
    expect(posts()).toBe(1);
    expect(await pool.run(job(7))).toBe('w14');
    expect(posts()).toBe(1);
    expect(pool.stats).toMatchObject({ prefetched: 1, hits: 1, misses: 0, spawned: 1 });
    expect(pool.stats.warmMs).not.toBeNull();
  });

  it('미리 계산은 입력이 글자 하나까지 같을 때만 쓴다 (다르면 새로 계산)', async () => {
    const pool = new EnginePool(2, () => new FakeWorker() as never, mainRun);
    pool.prefetch(job(3, { fatigue: 10 }));
    await flush();
    expect(await pool.run(job(3, { fatigue: 11 }))).toBe('w6');
    expect(posts()).toBe(2);
    expect(pool.stats.misses).toBe(1);
    expect(pool.stats.hits).toBe(0);
  });

  it('실제 작업이 미리 계산보다 먼저 돈다 · 미리 계산만으로는 워커를 더 띄우지 않는다', async () => {
    const pool = new EnginePool(2, () => new FakeWorker('hang') as never, mainRun);
    pool.prefetch(job(1));
    pool.prefetch(job(2));
    expect(pool.live).toBe(1);
    void pool.run(job(9));
    // 첫 워커는 미리 계산(1) 중 → 실제 작업(9)은 새 워커로, 2는 대기
    expect(pool.live).toBe(2);
    expect(FakeWorker.all[1]!.posted.map((m) => val(m.job))).toEqual([9]);
  });

  it('취소: 시작 안 한 미리 계산은 버려지고, 그 입력의 run 은 새로 계산', async () => {
    const pool = new EnginePool(1, () => new FakeWorker('ok') as never, mainRun);
    pool.prefetch(job(1));
    pool.prefetch(job(2));
    pool.cancelPrefetch();
    expect(pool.stats.wasted).toBe(1);
    await flush();
    expect(await pool.run(job(2))).toBe('w4');
    expect(pool.stats.hits).toBe(0);
    expect(await pool.run(job(1))).toBe('w2');
    expect(pool.stats.hits).toBe(1);
  });

  it('워커 오류 → 그 작업은 메인 스레드에서 다시 계산, 워커는 새로 · 2번 넘게 죽으면 메인 스레드만', async () => {
    const pool = new EnginePool(2, () => new FakeWorker('crash') as never, mainRun);
    expect(await pool.run(job(5))).toBe('m10');
    expect(pool.stats.fails).toBe(1);
    expect(pool.parallel).toBe(true);
    await Promise.all([pool.run(job(1)), pool.run(job(2))]);
    expect(pool.stats.fails).toBeGreaterThan(2);
    expect(pool.parallel).toBe(false);
    const n = FakeWorker.all.length;
    expect(await pool.run(job(4))).toBe('m8');
    expect(FakeWorker.all.length).toBe(n);
    // 메인 스레드 모드에서는 미리 계산하지 않는다
    pool.prefetch(job(6));
    expect(pool.stats.prefetched).toBe(0);
  });

  it('시간 초과 → 메인 스레드에서 계산하고 그 워커는 내린다', async () => {
    vi.useFakeTimers();
    const pool = new EnginePool(1, () => new FakeWorker('hang') as never, mainRun);
    const p = pool.run(job(21));
    vi.advanceTimersByTime(JOB_TIMEOUT_MS + 1);
    await vi.runAllTimersAsync();
    expect(await p).toBe('m42');
    expect(FakeWorker.all[0]!.terminated).toBe(true);
  });

  it('워커를 못 만들면 메인 스레드로 (결과는 같다)', async () => {
    const pool = new EnginePool(2, () => { throw new Error('no worker'); }, mainRun);
    expect(await pool.run(job(3))).toBe('m6');
    expect(pool.parallel).toBe(false);
  });

  it('입력 키: undefined · -0 · NaN · Infinity 를 구분하고, 일반 객체가 아니면 던진다', () => {
    const k = (v: unknown) => inputKey(job(1, { v }));
    const keys = [k(undefined), k(null), k(0), k(-0), k(NaN), k(Infinity), k(-Infinity), k('\u0000u')];
    expect(new Set(keys).size).toBe(keys.length);
    expect(inputKey(job(1, { a: 1, b: 2 }))).toBe(inputKey(job(1, { a: 1, b: 2 })));
    expect(() => inputKey(job(1, { m: new Map() }))).toThrow();
    // 키를 못 만드는 입력은 미리 계산하지 않고, run 은 그대로 계산
    const pool = new EnginePool(1, () => new FakeWorker() as never, mainRun);
    pool.prefetch(job(1, { m: new Map() }));
    expect(pool.stats.prefetched).toBe(0);
  });

  it('버전: C.75b · 44단계 · 엔진 23 그대로', async () => {
    const { PATCH_LABEL, STAGE_LABEL } = await import('../src/version');
    expect(PATCH_LABEL).toMatch(/^C\.7[5-9]/);
    expect(STAGE_LABEL).toMatch(/^(4[4-9]|5\d)단계$/);
    const { ENGINE_VERSION } = await import('../src/engine/config');
    expect(ENGINE_VERSION).toBeGreaterThanOrEqual(23);
  });
});
