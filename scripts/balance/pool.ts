// 밸런스 점검 병렬 실행 (C.78l): scripts/engine/pool.ts 와 같은 방식 — 워커 코드를 esbuild 로 한 파일로 묶고
// 코어 수(WORKERS, 기본 코어 수)만큼 worker_threads 로 나눠 돌린다. 결과는 작업 순서대로 돌려주므로 워커 수와 무관하다.
// WORKERS=0 이면 메인 스레드에서 차례로 (C.78l 전과 같은 경로)

import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';
import { runCareerJob, type CareerJob, type Run } from './career';

const here = dirname(fileURLToPath(import.meta.url));
const proc = (globalThis as { process?: { env: Record<string, string | undefined>; stderr: { write(s: string): void } } }).process;

async function bundle(): Promise<string> {
  const out = resolve(here, '../../node_modules/.cache/balance-harness/worker.mjs');
  mkdirSync(dirname(out), { recursive: true });
  await build({
    entryPoints: [join(here, 'worker.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out,
    logLevel: 'warning', target: 'node20',
  });
  return out;
}

export function runCareers(jobs: CareerJob[]): Promise<Run[]> {
  const n = Math.min(Math.max(0, Number(proc?.env.WORKERS ?? cpus().length)), jobs.length);
  if (n <= 0) return Promise.resolve(jobs.map(runCareerJob));
  return (async () => {
    const file = await bundle();
    const out: Run[] = new Array(jobs.length);
    let next = 0;
    let done = 0;
    const t0 = Date.now();
    await new Promise<void>((resolveAll, reject) => {
      const pool: Worker[] = [];
      const finish = (err?: Error) => {
        for (const w of pool) void w.terminate();
        if (err) reject(err);
        else resolveAll();
      };
      const feed = (w: Worker) => {
        if (next >= jobs.length) return;
        const i = next++;
        w.postMessage({ i, job: jobs[i] });
      };
      for (let k = 0; k < n; k++) {
        const w = new Worker(file);
        pool.push(w);
        w.on('message', (m: { i: number; out?: Run; error?: string }) => {
          if (m.error) return finish(new Error(m.error));
          out[m.i] = m.out!;
          done++;
          if (done % 20 === 0 || done === jobs.length) proc?.stderr.write(`  커리어 ${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)}초, 워커 ${n})\n`);
          if (done === jobs.length) finish();
          else feed(w);
        });
        w.on('error', (e) => finish(e));
        feed(w);
      }
    });
    return out;
  })();
}
