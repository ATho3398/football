// Web Worker 풀 (부록 C.38, C.75b): 코어 수만큼(상한 MAX_WORKERS) 워커를 두고 경기를 병렬로 계산한다.
// 워커를 못 쓰는 환경(테스트, 오래된 브라우저)이나 워커가 거듭 죽으면 메인 스레드에서 차례로 계산한다 (결과는 같다).
//
// C.75b 다듬기 (44b E-1, 결과 불변 — 엔진은 입력만 보는 순수 함수라 어디서 언제 계산해도 같은 값):
// - 첫 워커 데우기: 게임을 연 뒤 유휴 시간에 워커 하나를 띄워 곧 칠 경기 하나를 미리 계산한다 (첫 경기 JIT 비용을 미리 냄)
// - 미리 계산(prefetch): 다음 날 경기 입력으로 미리 계산해 두고, 실제 run 의 입력이 글자 하나까지 같을 때만 그 결과를 쓴다
//   (입력 키 = inputKey, 다르면 버리고 새로 계산). 미리 계산은 실제 작업이 없을 때만 돈다
// - 오류: 워커 오류·시간 초과면 그 작업을 메인 스레드에서 다시 계산하고 워커를 새로 띄운다 (2번 넘게 죽으면 메인 스레드만)
// - 취소: cancelPrefetch 는 아직 시작 안 한 미리 계산을 버린다 (자동 진행이 멈출 때)
//
// C.76m 다른 경기 백그라운드 미리 계산: plan(jobs) = 앞으로 며칠 다른 경기 목록을 통째로 맡긴다 (목록에 없는 보관분은 버림, 가까운 날 먼저).
// 미리 계산에 워커를 specWorkers 개까지 띄운다(하나는 실제 작업용으로 남김). 보관은 입력 키의 요약(digest)으로 해 메모리를 줄인다

import { runJob, type EngineJob } from '../engine/jobs';
import type { NpcMatchResult } from '../engine/npcMatch';
import type { MyMatchOutput } from '../engine/adapter';

/** 워커 상한: 폰 메모리(워커마다 엔진 묶음 약 0.3MB + 힙)와 다른 경기 수(하루 최대 약 10경기)를 같이 본 값 */
export const MAX_WORKERS = 6;
/** 이 시간 안에 답이 없으면 워커가 멈춘 것으로 보고 메인 스레드에서 계산한다 (느린 폰 경기당 약 5초의 10배+) */
export const JOB_TIMEOUT_MS = 60000;
/** 워커가 이만큼 죽으면 더 띄우지 않고 메인 스레드로만 계산한다 */
const MAX_FAILS = 2;
/** 미리 계산 보관 상한 (C.76m): 3일치 — 바쁜 날 14개 리그 약 80 + 내 리그 10경기 × 3 */
export const PREFETCH_KEEP = 300;

type Task = {
  id: number;
  job: EngineJob | null;
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
  /** 미리 계산에 쓰는 워커 수 (C.75b 데우기 = 1, C.76m plan 이 정한다) */
  private specWorkers = 1;
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
    // 끝난 미리 계산은 결과만 보관 (입력은 놓는다)
    if (t?.spec) t.job = null;
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
        // 실제 작업이 밀려 있으면 워커를 더 띄운다. 미리 계산만이면 specWorkers 개까지 (C.75b 기본 1 = 데운 워커 하나)
        if (!this.queue.some((t) => !t.spec) && this.slots.length >= Math.max(1, Math.min(this.specWorkers, this.size - 1))) return;
        slot = this.spawn() ?? undefined;
        if (!slot) return this.broken ? this.drainToMain() : undefined;
      }
      const t = this.next()!;
      t.started = true;
      slot.task = t;
      const s = slot;
      s.timer = setTimeout(() => this.kill(s, 'worker timeout'), JOB_TIMEOUT_MS);
      try {
        s.w.postMessage({ id: t.id, job: t.job! });
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
      try { t.resolve(this.runner(t.job!)); } catch (e) { t.reject(e as Error); }
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
    if (this.spec.size) try { key = specKey(job); } catch { key = null; }
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
    try { key = specKey(job); } catch { return; }
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
      try { t = this.spec.get(specKey(job)); } catch { t = undefined; }
      t?.promise.then(() => { this.stats.warmMs ??= Math.round(performance.now() - t0); }, () => {});
    }
  }

  /**
   * 며칠치 미리 계산 (C.76m): jobs(가까운 날 먼저) 를 보관 목표로 삼는다. 목록에 없는 보관분·대기분은 버리고(입력이 바뀐 경기·지난 날),
   * 새 것은 순서대로 맡긴다 (PREFETCH_KEEP 까지). 미리 계산에 워커를 workers 개까지 띄운다. 맡긴 새 작업 수
   */
  plan(jobs: readonly EngineJob[], workers = this.size - 1): number {
    if (this.broken) return 0;
    const want = new Map<string, EngineJob>();
    for (const j of jobs) {
      if (want.size >= PREFETCH_KEEP) break;
      try { const k = specKey(j); if (!want.has(k)) want.set(k, j); } catch { /* 키를 못 만드는 입력은 미리 계산 안 함 */ }
    }
    for (const [k, t] of [...this.spec]) {
      if (want.has(k)) continue;
      this.spec.delete(k);
      this.queue = this.queue.filter((x) => x !== t);
      this.stats.wasted++;
      t.reject(new Error('dropped'));
    }
    let added = 0;
    for (const [k, j] of want) {
      if (this.spec.has(k)) continue;
      const t = this.task(j, k, true);
      this.spec.set(k, t);
      this.queue.push(t);
      this.stats.prefetched++;
      added++;
    }
    // 대기 중 미리 계산을 목록 순서(가까운 날 먼저)로
    const order = new Map([...want.keys()].map((k, i) => [k, i]));
    const real = this.queue.filter((t) => !t.spec);
    const specs = this.queue.filter((t) => t.spec).sort((a, b) => (order.get(a.key!) ?? 1e9) - (order.get(b.key!) ?? 1e9));
    this.queue = [...real, ...specs];
    this.specWorkers = Math.max(1, workers);
    this.pump();
    return added;
  }

  /** 이 입력의 미리 계산이 끝나 보관돼 있는가 (C.76m, 진행 표시용) */
  ready(job: EngineJob): boolean {
    if (!this.spec.size) return false;
    let t: Task | undefined;
    try { t = this.spec.get(specKey(job)); } catch { return false; }
    return !!t && t.started && !this.slots.some((s) => s.task === t);
  }

  /** 보관 중인 미리 계산 수 · 그중 끝난 수 (진행 표시용, C.76m) */
  get planned(): { total: number; ready: number } {
    let ready = 0;
    for (const t of this.spec.values()) if (t.started && !this.slots.some((s) => s.task === t)) ready++;
    return { total: this.spec.size, ready };
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

  /** 미리 계산 결과를 모두 버린다 (게임을 바꿀 때, 빠른 진행으로 바꿀 때) */
  clearPrefetch(): void {
    this.cancelPrefetch();
    this.stats.wasted += this.spec.size;
    this.spec.clear();
    this.specWorkers = 1;
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

/**
 * 보관 키 (C.76m): inputKey(약 35KB) 의 요약 — 53비트 해시 2개 + 길이. 3일치 수백 경기를 보관해도 키 메모리가 작다
 * (서로 다른 입력이 같은 요약일 확률은 2^-100 수준)
 */
export function specKey(job: EngineJob): string {
  const s = inputKey(job);
  return `${cyrb53(s, 0x9e37)}.${cyrb53(s, 0x85eb)}.${s.length}`;
}

function cyrb53(s: string, seed: number): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function poolSize(): number {
  const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(MAX_WORKERS, n));
}
