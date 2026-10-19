// Web Worker 풀 (부록 C.38, C.75b): 코어 수만큼(상한 MAX_WORKERS) 워커를 두고 경기를 병렬로 계산한다.
// 워커를 못 쓰는 환경(테스트, 오래된 브라우저)이나 워커가 거듭 죽으면 메인 스레드에서 차례로 계산한다 (결과는 같다).
//
// C.75b 다듬기 (44b E-1, 결과 불변 — 엔진은 입력만 보는 순수 함수라 어디서 언제 계산해도 같은 값):
// - 첫 워커 데우기: 게임을 연 뒤 유휴 시간에 워커 하나를 띄워 곧 칠 경기 하나를 미리 계산한다 (첫 경기 JIT 비용을 미리 냄)
// - 미리 계산(prefetch): 다음 날 경기 입력으로 미리 계산해 두고, 실제 run 의 입력이 글자 하나까지 같을 때만 그 결과를 쓴다
//   (입력 키 = inputKey, 다르면 버리고 새로 계산). 미리 계산은 실제 작업이 없을 때만 돈다
// - 오류: 워커 오류·시간 초과면 그 작업을 메인 스레드에서 다시 계산하고 워커를 새로 띄운다 (2번 넘게 죽으면 메인 스레드만)
// - 취소: cancelPrefetch 는 아직 시작 안 한 미리 계산을 버린다 (자동 진행이 멈출 때)

import { runJob, type EngineJob } from '../engine/jobs';
import type { NpcMatchResult } from '../engine/npcMatch';
import type { MyMatchOutput } from '../engine/adapter';

/** 워커 상한: 폰 메모리(워커마다 엔진 묶음 약 0.3MB + 힙)와 다른 경기 수(하루 최대 약 10경기)를 같이 본 값 */
export const MAX_WORKERS = 6;
/** 이 시간 안에 답이 없으면 워커가 멈춘 것으로 보고 메인 스레드에서 계산한다 (느린 폰 경기당 약 5초의 10배+) */
export const JOB_TIMEOUT_MS = 60000;
/** 워커가 이만큼 죽으면 더 띄우지 않고 메인 스레드로만 계산한다 */
const MAX_FAILS = 2;
/** 미리 계산 결과 보관 수 (하루치 다른 경기 + 내 경기 두 날 분) */
const PREFETCH_KEEP = 24;

type Task = {
  id: number;
  job: EngineJob;
  key: string | null;
  spec: boolean;
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  promise: Promise<unknown>;
  started: boolean;
};

type Slot = { w: Worker; task: Task | null; timer: ReturnType<typeof setTimeout> | null };

export type WorkerFactory = () => Worker;

const defaultFactory: WorkerFactory = () => new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });

/** 풀 측정 (부록 C.75b 보고용) */
export interface PoolStats {
  size: number;
  spawned: number;
  fails: number;
  jobs: number;
  main: number;
  prefetched: number;
  hits: number;
  misses: number;
  wasted: number;
  warmMs: number | null;
  /** 워커가 계산에 쓴 시간 합 (ms) */
  busyMs: number;
}

export class EnginePool {
  readonly size: number;
  private slots: Slot[] = [];
  private queue: Task[] = [];
  private spec = new Map<string, Task>();
  private seq = 0;
  private fails = 0;
  private broken = false;
  private factory: WorkerFactory;
  private runner: (job: EngineJob) => unknown;
  readonly stats: PoolStats;

  /** factory·runner 는 테스트용 (가짜 워커, 메인 스레드 계산) */
  constructor(size = poolSize(), factory: WorkerFactory = defaultFactory, runner: (job: EngineJob) => unknown = runJob) {
    this.size = Math.max(0, size);
    this.factory = factory;
    this.runner = runner;
    this.stats = { size: this.size, spawned: 0, fails: 0, jobs: 0, main: 0, prefetched: 0, hits: 0, misses: 0, wasted: 0, warmMs: null, busyMs: 0 };
    if ((factory === defaultFactory && typeof Worker === 'undefined') || this.size === 0) this.broken = true;
  }

  /** 워커로 계산하는가 (아니면 메인 스레드) */
  get parallel(): boolean {
    return !this.broken;
  }

  /** 지금 띄워 둔 워커 수 */
  get live(): number {
    return this.slots.length;
  }

  private spawn(): Slot | null {
    if (this.broken || this.slots.length >= this.size) return null;
    let w: Worker;
    try {
      w = this.factory();
    } catch {
      this.broken = true;
      this.drainToMain();
      return null;
    }
    const slot: Slot = { w, task: null, timer: null };
    w.onmessage = (e: MessageEvent<{ id: number; out?: unknown; error?: string; ms?: number }>) => this.done(slot, e.data);
    w.onerror = (e) => {
      // 워커가 죽으면 그 일을 메인 스레드에서 다시 계산하고, 워커는 새로 띄운다
      e.preventDefault?.();
      this.kill(slot, e.message || 'worker error');
    };
    this.slots.push(slot);
    this.stats.spawned++;
    return slot;
  }

  private kill(slot: Slot, why: string): void {
    if (slot.timer) clearTimeout(slot.timer);
    try { slot.w.terminate(); } catch { /* 이미 죽음 */ }
    this.slots = this.slots.filter((s) => s !== slot);
    this.fails++;
    this.stats.fails = this.fails;
    if (this.fails > MAX_FAILS) this.broken = true;
    const t = slot.task;
    slot.task = null;
    if (t) {
      if (t.spec) this.dropSpec(t, new Error(why));
      else this.onMain(t);
    }
    if (this.broken) this.drainToMain();
    else this.pump();
  }

  private done(slot: Slot, msg: { id: number; out?: unknown; error?: string; ms?: number }): void {
    if (slot.timer) clearTimeout(slot.timer);
    this.stats.busyMs += Math.round(msg.ms ?? 0);
    slot.timer = null;
    const t = slot.task;
    slot.task = null;
    this.pump();
    if (!t || t.id !== msg.id) return;
    if (msg.error !== undefined) t.reject(new Error(msg.error));
    else t.resolve(msg.out);
  }

  /** 다음 작업: 실제 작업이 먼저, 미리 계산은 그다음 */
  private next(): Task | undefined {
    const k = this.queue.findIndex((t) => !t.spec);
    return k >= 0 ? this.queue.splice(k, 1)[0] : this.queue.shift();
  }

  private pump(): void {
    if (this.broken) return this.drainToMain();
    for (;;) {
      if (!this.queue.length) return;
      let slot = this.slots.find((s) => !s.task);
      if (!slot) {
        // 실제 작업이 밀려 있을 때만 워커를 더 띄운다 (미리 계산만으로는 데운 워커 하나로)
        if (!this.queue.some((t) => !t.spec) && this.slots.length > 0) return;
        slot = this.spawn() ?? undefined;
        if (!slot) return this.broken ? this.drainToMain() : undefined;
      }
      const t = this.next()!;
      t.started = true;
      slot.task = t;
      const s = slot;
      s.timer = setTimeout(() => this.kill(s, 'worker timeout'), JOB_TIMEOUT_MS);
      try {
        s.w.postMessage({ id: t.id, job: t.job });
      } catch {
        // 보낼 수 없는 입력(복제 오류): 이 작업만 메인 스레드에서
        clearTimeout(s.timer);
        s.timer = null;
        s.task = null;
        if (t.spec) this.dropSpec(t, new Error('clone'));
        else this.onMain(t);
      }
    }
  }

  /** 메인 스레드에서 계산: 한 경기씩, 화면이 숨 쉴 틈을 준다 */
  private onMain(t: Task): void {
    t.started = true;
    this.stats.main++;
    setTimeout(() => {
      try { t.resolve(this.runner(t.job)); } catch (e) { t.reject(e as Error); }
    }, 0);
  }

  private drainToMain(): void {
    const q = this.queue;
    this.queue = [];
    for (const t of q) {
      if (t.spec) this.dropSpec(t, new Error('cancelled'));
      else this.onMain(t);
    }
  }

  private task(job: EngineJob, key: string | null, spec: boolean): Task {
    let resolve!: (v: unknown) => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<unknown>((a, b) => { resolve = a; reject = b; });
    // 미리 계산이 버려져도 처리 안 된 거부로 남지 않게
    if (spec) promise.catch(() => {});
    return { id: ++this.seq, job, key, spec, resolve, reject, promise, started: false };
  }

  private dropSpec(t: Task, e: Error): void {
    if (t.key && this.spec.get(t.key) === t) this.spec.delete(t.key);
    t.reject(e);
  }

  /** 경기를 계산한다. 같은 입력으로 미리 계산해 둔 것이 있으면 그 결과 (입력이 같으면 결과도 같다) */
  run(job: EngineJob): Promise<unknown> {
    this.stats.jobs++;
    let key: string | null = null;
    if (this.spec.size) try { key = inputKey(job); } catch { key = null; }
    const hit = key ? this.spec.get(key) : undefined;
    if (hit) {
      this.spec.delete(key!);
      this.stats.hits++;
      hit.spec = false;
      if (!hit.started) {
        // 아직 대기 중이면 실제 작업으로 앞으로
        this.queue = [hit, ...this.queue.filter((t) => t !== hit)];
        this.pump();
      }
      // 미리 계산이 실패했으면(워커 오류) 다시 계산
      return hit.promise.catch(() => this.run(job));
    }
    if (key) this.stats.misses++;
    const t = this.task(job, null, false);
    if (this.broken) this.onMain(t);
    else {
      this.queue.push(t);
      this.pump();
    }
    return t.promise;
  }

  /**
   * 미리 계산 (C.75b): 결과를 기다리지 않는다. 실제 작업이 없을 때 워커가 계산해 두고, 나중에 같은 입력의 run 이 그 결과를 가져간다.
   * 메인 스레드 모드에서는 하지 않는다 (화면을 막지 않게)
   */
  prefetch(job: EngineJob): void {
    if (this.broken) return;
    let key: string;
    try { key = inputKey(job); } catch { return; }
    if (this.spec.has(key)) return;
    const t = this.task(job, key, true);
    this.spec.set(key, t);
    this.stats.prefetched++;
    // 오래된 것부터 버린다
    while (this.spec.size > PREFETCH_KEEP) {
      const [k0, old] = this.spec.entries().next().value as [string, Task];
      this.spec.delete(k0);
      this.queue = this.queue.filter((x) => x !== old);
      this.stats.wasted++;
      old.reject(new Error('dropped'));
    }
    this.queue.push(t);
    this.pump();
  }

  /** 첫 워커 데우기: 워커 하나를 띄우고, 곧 칠 경기가 있으면 그것을 미리 계산한다 */
  warm(job?: EngineJob): void {
    if (this.broken) return;
    const t0 = performance.now();
    if (!this.slots.length) this.spawn();
    if (job) {
      this.prefetch(job);
      let t: Task | undefined;
      try { t = this.spec.get(inputKey(job)); } catch { t = undefined; }
      t?.promise.then(() => { this.stats.warmMs ??= Math.round(performance.now() - t0); }, () => {});
    }
  }

  /** 아직 시작 안 한 미리 계산을 버린다 (계산 중인 것은 끝나면 보관만, 다음 run 이 쓰지 않으면 버려짐) */
  cancelPrefetch(): void {
    const drop = this.queue.filter((t) => t.spec);
    this.queue = this.queue.filter((t) => !t.spec);
    for (const t of drop) {
      this.stats.wasted++;
      this.dropSpec(t, new Error('cancelled'));
    }
  }

  /** 미리 계산 결과를 모두 버린다 (게임을 바꿀 때) */
  clearPrefetch(): void {
    this.cancelPrefetch();
    this.stats.wasted += this.spec.size;
    this.spec.clear();
  }

  npc(input: Extract<EngineJob, { kind: 'npc' }>['input']): Promise<NpcMatchResult> {
    return this.run({ kind: 'npc', input }) as Promise<NpcMatchResult>;
  }

  my(input: Extract<EngineJob, { kind: 'my' }>['input']): Promise<MyMatchOutput> {
    return this.run({ kind: 'my', input }) as Promise<MyMatchOutput>;
  }

  /** 워커를 모두 내린다 */
  close(): void {
    this.clearPrefetch();
    for (const s of this.slots) {
      if (s.timer) clearTimeout(s.timer);
      try { s.w.terminate(); } catch { /* 이미 죽음 */ }
      if (s.task && !s.task.spec) this.onMain(s.task);
    }
    this.slots = [];
  }
}

/**
 * 입력 키: 미리 계산 결과를 쓸지 정하는 엄격한 비교용 문자열. JSON 이 같게 쓰는 값(undefined·NaN·±Infinity·-0)도 구분하고,
 * 일반 객체·배열이 아닌 값(Map·Set·Date 등)이 있으면 던진다(그런 입력은 미리 계산하지 않음)
 */
export function inputKey(job: EngineJob): string {
  return JSON.stringify(job, function (this: unknown, k: string, v: unknown) {
    if (v === undefined) return '\u0000u';
    if (typeof v === 'number') {
      if (Number.isNaN(v)) return '\u0000nan';
      if (!Number.isFinite(v)) return v > 0 ? '\u0000inf' : '\u0000-inf';
      if (Object.is(v, -0)) return '\u0000-0';
      return v;
    }
    if (typeof v === 'string') return v.startsWith('\u0000') ? `\u0000s${v}` : v;
    if (typeof v === 'bigint' || typeof v === 'function' || typeof v === 'symbol') throw new Error(`inputKey: ${typeof v} at ${k}`);
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const proto = Object.getPrototypeOf(v);
      if (proto !== Object.prototype && proto !== null) throw new Error(`inputKey: non-plain object at ${k}`);
    }
    return v;
  });
}

export function poolSize(): number {
  const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(MAX_WORKERS, n));
}
