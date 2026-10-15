// 병렬 실행 (E.18 0번): 워커 코드를 esbuild 로 한 파일로 묶고 코어 수만큼 worker_threads 로 나눠 돌린다.
// 결과는 작업 순서대로 돌려준다. 작업마다 시드가 정해져 있으므로 워커 수와 상관없이 결과가 같다.

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { runJob, type Job, type JobOut } from './job';

const here = dirname(fileURLToPath(import.meta.url));
let bundled: Promise<string> | null = null;

function bundle(): Promise<string> {
  bundled ??= (async () => {
    const out = resolve(here, '../../node_modules/.cache/engine-harness/worker.mjs');
    mkdirSync(dirname(out), { recursive: true });
    await build({
      entryPoints: [join(here, 'worker.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out,
      logLevel: 'warning', target: 'node20',
    });
    return out;
  })();
  return bundled;
}

export function defaultWorkers(): number {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  return Math.max(1, Number(env.WORKERS ?? cpus().length));
}

/** 작업들을 병렬로 돌린다. workers = 0 이면 메인 스레드에서 차례로 */
export async function runJobs<T extends JobOut = JobOut>(jobs: Job[], opts: { workers?: number; label?: string } = {}): Promise<T[]> {
  const n = Math.min(opts.workers ?? defaultWorkers(), jobs.length);
  const out: JobOut[] = new Array(jobs.length);
  if (n <= 0) {
    jobs.forEach((j, i) => (out[i] = runJob(j)));
    return out as T[];
  }
  const file = await bundle();
  const label = opts.label;
  let next = 0;
  let done = 0;
  const t0 = Date.now();
  // 시즌 작업처럼 긴 작업을 먼저 보낸다 (순서는 결과 배열에서 복원)
  const order = jobs.map((_, i) => i).sort((a, b) => (jobs[b]!.kind === 'season' ? 1 : 0) - (jobs[a]!.kind === 'season' ? 1 : 0) || a - b);
  await new Promise<void>((resolveAll, reject) => {
    const pool: Worker[] = [];
    const finish = (err?: Error) => {
      for (const w of pool) void w.terminate();
      if (err) reject(err);
      else resolveAll();
    };
    const feed = (w: Worker) => {
      if (next >= order.length) return;
      const i = order[next++]!;
      w.postMessage({ i, job: jobs[i] });
    };
    for (let k = 0; k < n; k++) {
      const w = new Worker(file);
      pool.push(w);
      w.on('message', (m: { i: number; out?: JobOut; error?: string }) => {
        if (m.error) return finish(new Error(m.error));
        out[m.i] = m.out!;
        done++;
        if (label && (done % 50 === 0 || done === jobs.length)) {
          (globalThis as { process?: { stderr: { write(s: string): void } } }).process?.stderr.write(`\r  ${label}: ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}초)   `);
        }
        if (done === jobs.length) {
          if (label) (globalThis as { process?: { stderr: { write(s: string): void } } }).process?.stderr.write('\n');
          finish();
        } else feed(w);
      });
      w.on('error', (e) => finish(e));
      feed(w);
      feed(w);
    }
  });
  return out as T[];
}
