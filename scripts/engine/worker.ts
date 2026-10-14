// 측정 워커: 메시지로 받은 작업을 돌려 결과를 보낸다
import { parentPort } from 'node:worker_threads';
import { runJob, type Job } from './job';

parentPort!.on('message', (msg: { i: number; job: Job }) => {
  try {
    parentPort!.postMessage({ i: msg.i, out: runJob(msg.job) });
  } catch (e) {
    parentPort!.postMessage({ i: msg.i, error: String((e as Error)?.stack ?? e) });
  }
});
