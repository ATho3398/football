// 경기 계산 작업 (부록 C.38): Web Worker 와 메인 스레드(워커를 못 쓸 때)가 같은 함수를 쓴다

import { playNpcMatch, type NpcMatchInput } from './npcMatch';
import { playMyMatch, type EngineMatchInput, type MyMatchOutput } from './adapter';
import { fromWireReplay, toWireReplay, type WireReplay } from '../replayCodec';

/**
 * my = 자동 진행 중 내 경기 (재생 데이터 없음).
 * myr (C.81c) = [경기 시작] 자동 경기를 재생 데이터까지 미리 계산 — 메인 스레드의 playMyMatch(input, { teams }) 와 같은 호출이라 같은 결과
 */
export type EngineJob = { kind: 'npc'; input: NpcMatchInput } | { kind: 'my'; input: EngineMatchInput } | { kind: 'myr'; input: EngineMatchInput; teams: [string, string] };

/** myr 결과: 재생 데이터는 Float64Array 한 장(복사 없이 넘김) */
export interface MyReplayOut { out: Omit<MyMatchOutput, 'replay'>; wire: WireReplay | null }

export function runJob(job: EngineJob): unknown {
  if (job.kind === 'npc') return playNpcMatch(job.input);
  if (job.kind === 'my') return playMyMatch(job.input);
  const { replay, ...out } = playMyMatch(job.input, { teams: job.teams });
  return { out, wire: replay ? toWireReplay(replay) : null } satisfies MyReplayOut;
}

/** 워커가 결과를 복사 없이 넘길 버퍼 (myr 재생 데이터) */
export function transferOf(out: unknown): ArrayBuffer[] {
  const buf = (out as Partial<MyReplayOut> | null)?.wire?.buf;
  return buf ? [buf.buffer as ArrayBuffer] : [];
}

/** myr 결과 → MyMatchOutput (재생 데이터를 풀어 붙인다) */
export function myReplayOutput(x: MyReplayOut): MyMatchOutput {
  return x.wire ? { ...x.out, replay: fromWireReplay(x.wire) } : { ...x.out };
}
