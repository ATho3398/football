// 경기 엔진 Web Worker (25.1~25.2 4번, 부록 C.38): 다른 팀 경기(프레임 없이)와 자동 진행 중 내 경기를 계산한다.
// 메인 스레드와 같은 함수라 같은 입력이면 같은 결과다 (결정성)

import { runJob, type EngineJob } from './jobs';

const ctx = globalThis as unknown as { onmessage: ((e: MessageEvent) => void) | null; postMessage: (m: unknown) => void };
ctx.onmessage = (e: MessageEvent<{ id: number; job: EngineJob }>) => {
  const { id, job } = e.data;
  try {
    const t0 = performance.now();
    const out = runJob(job);
    // ms: 계산 시간 (풀 측정용, C.75b)
    ctx.postMessage({ id, out, ms: performance.now() - t0 });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err) });
  }
};
