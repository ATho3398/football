// 경기 계산 작업 (부록 C.38): Web Worker 와 메인 스레드(워커를 못 쓸 때)가 같은 함수를 쓴다

import { playNpcMatch, type NpcMatchInput } from './npcMatch';
import { playMyMatch, type EngineMatchInput } from './adapter';

export type EngineJob = { kind: 'npc'; input: NpcMatchInput } | { kind: 'my'; input: EngineMatchInput };

export function runJob(job: EngineJob): unknown {
  return job.kind === 'npc' ? playNpcMatch(job.input) : playMyMatch(job.input);
}
