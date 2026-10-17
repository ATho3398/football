// Web Worker 풀 (부록 C.38): navigator.hardwareConcurrency 만큼 워커를 띄워 경기를 병렬로 계산한다.
// 워커를 못 쓰는 환경(테스트, 오래된 브라우저)에서는 메인 스레드에서 차례로 계산한다 (결과는 같다)

import { runJob, type EngineJob } from '../engine/jobs';
import type { NpcMatchResult } from '../engine/npcMatch';
import type { MyMatchOutput } from '../engine/adapter';

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void };

export class EnginePool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: { id: number; job: EngineJob }[] = [];
  private pending = new Map<number, Pending>();
  private seq = 0;
  readonly size: number;

  constructor(size = poolSize()) {
    this.size = size;
    try {
      for (let i = 0; i < size; i++) {
        const w = new Worker(new URL('../engine/worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (e: MessageEvent<{ id: number; out?: unknown; error?: string }>) => this.done(w, e.data);
        w.onerror = (e) => {
          // 워커가 죽으면 그 워커의 일을 메인 스레드로 넘긴다
          e.preventDefault();
          this.workers = this.workers.filter((x) => x !== w);
          this.idle = this.idle.filter((x) => x !== w);
          for (const [id, p] of this.pending) {
            if ((w as unknown as { job?: number }).job === id) {
              this.pending.delete(id);
              p.reject(new Error(e.message || 'worker error'));
            }
          }
        };
        this.workers.push(w);
        this.idle.push(w);
      }
    } catch {
      this.workers = [];
      this.idle = [];
    }
  }

  get parallel(): boolean {
    return this.workers.length > 0;
  }

  private done(w: Worker, msg: { id: number; out?: unknown; error?: string }): void {
    const p = this.pending.get(msg.id);
    this.pending.delete(msg.id);
    this.idle.push(w);
    this.pump();
    if (!p) return;
    if (msg.error !== undefined) p.reject(new Error(msg.error));
    else p.resolve(msg.out);
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const q = this.queue.shift()!;
      (w as unknown as { job?: number }).job = q.id;
      w.postMessage(q);
    }
  }

  run(job: EngineJob): Promise<unknown> {
    if (!this.parallel) {
      // 메인 스레드: 한 경기씩, 화면이 숨 쉴 틈을 준다
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          try { resolve(runJob(job)); } catch (e) { reject(e as Error); }
        }, 0);
      });
    }
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.queue.push({ id, job });
      this.pump();
    });
  }

  npc(input: Extract<EngineJob, { kind: 'npc' }>['input']): Promise<NpcMatchResult> {
    return this.run({ kind: 'npc', input }) as Promise<NpcMatchResult>;
  }

  my(input: Extract<EngineJob, { kind: 'my' }>['input']): Promise<MyMatchOutput> {
    return this.run({ kind: 'my', input }) as Promise<MyMatchOutput>;
  }
}

export function poolSize(): number {
  const n = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 2 : 2;
  return Math.max(1, Math.min(8, n));
}
