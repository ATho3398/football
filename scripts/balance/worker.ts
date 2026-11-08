// 밸런스 점검 워커 (C.78l): 메시지로 받은 커리어 작업을 돌려 결과를 보낸다
import { parentPort } from 'node:worker_threads';
import { runCareerJob, type CareerJob } from './career';

parentPort!.on('message', (msg: { i: number; job: CareerJob }) => {
  try {
    parentPort!.postMessage({ i: msg.i, out: runCareerJob(msg.job) });
  } catch (e) {
    parentPort!.postMessage({ i: msg.i, error: String((e as Error)?.stack ?? e) });
  }
});
