// C.81c 자동 경기 대기 줄이기: [경기 시작] 자동 경기를 워커에서 재생 데이터까지 미리 계산 — 결과·재생 데이터가 메인 스레드 직접 계산과 비트 단위로 같다
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { endDay, isMatchDay, newGame, otherJob, playOthers, roundMatch, selectableRealPlayers, todaysOthers, upcomingOthers } from '../src/game';
import { playMyMatch } from '../src/engine/adapter';
import { myReplayOutput, runJob, transferOf, type MyReplayOut } from '../src/engine/jobs';
import { fromWireReplay, toWireReplay } from '../src/replayCodec';
import { EnginePool, specKey } from '../src/ui/enginePool';
import type { Replay } from '../src/replay';

/** 비트 단위 비교용: -0·NaN 까지 구분하는 직렬화 */
const exact = (x: unknown) => createHash('sha256').update(JSON.stringify(x, (_k, v) => (typeof v === 'number' ? (Object.is(v, -0) ? '-0' : Number.isNaN(v) ? 'NaN' : v) : v)) ?? 'undefined').digest('hex');

describe('C.81c 자동 경기 미리 계산 (결과 불변)', () => {
  const real = selectableRealPlayers()[3]!;
  const g = newGame({ seed: 'c81c-test', mode: 'real', playerId: real.id, difficulty: 'normal' });
  const rm = roundMatch(g);
  const direct = playMyMatch(rm.input, { teams: rm.teams });

  it('myr 작업(워커와 같은 함수) → 풀어낸 결과가 메인 스레드 playMyMatch(input, { teams }) 와 같다 (재생 프레임 포함)', () => {
    const raw = runJob({ kind: 'myr', input: rm.input, teams: rm.teams }) as MyReplayOut;
    expect(transferOf(raw)).toHaveLength(1);
    // 워커가 넘기는 것처럼 복제 (버퍼는 transfer, 나머지는 구조 복제)
    const sent = structuredClone(raw, { transfer: transferOf(raw) });
    const out = myReplayOutput(sent);
    expect(exact(out.result)).toBe(exact(direct.result));
    expect(exact(out.engine)).toBe(exact(direct.engine));
    expect(exact(out.my)).toBe(exact(direct.my));
    expect(out.side).toBe(direct.side);
    expect(out.replay!.frames.length).toBe(direct.replay!.frames.length);
    expect(exact(out.replay)).toBe(exact(direct.replay));
  });

  it('재생 데이터 무손실 코덱: restart·공 가진 선수 없음·-0 까지 그대로', () => {
    const r: Replay = {
      ...direct.replay!,
      frames: [
        { e: 0, t: 0, ball: { x: -0, y: 34.123456789, z: 0.0001 }, carrier: null, players: [{ id: 'a', x: 1.23, y: -4.56 }] },
        { e: 0.1, t: 0.1, ball: { x: 1, y: 2, z: 3 }, carrier: 'a', players: [{ id: 'a', x: 1.5, y: 2 }, { id: 'b', x: 0, y: 0 }], restart: 'corner' as never },
      ],
    };
    expect(exact(fromWireReplay(toWireReplay(r)))).toBe(exact(r));
  });

  it('풀: 미리 계산한 myr 를 같은 입력의 myReplay 가 그대로 쓴다 (다시 계산 안 함) · 입력이 바뀌면 다시', async () => {
    let calls = 0;
    const pool = new EnginePool(2, () => { throw new Error('no worker'); }, (j) => { calls++; return runJob(j); });
    // 워커를 못 띄우는 풀은 메인 스레드에서 같은 함수로
    const out = await pool.myReplay(rm.input, rm.teams);
    expect(calls).toBe(1);
    expect(exact(out.engine)).toBe(exact(direct.engine));
    expect(exact(out.replay)).toBe(exact(direct.replay));
  });

  it('입력 키: 선발·전술 등 입력이 바뀌면 다른 키 (미리 계산 결과를 쓰지 않음)', () => {
    const a = specKey({ kind: 'myr', input: rm.input, teams: rm.teams });
    const b = specKey({ kind: 'myr', input: { ...rm.input, seed: rm.input.seed + 1 }, teams: rm.teams });
    const c = specKey({ kind: 'my', input: rm.input });
    expect(a).not.toBe(b);
    expect(a).not.toBe(c);
    expect(specKey({ kind: 'myr', input: roundMatch(g).input, teams: rm.teams })).toBe(a);
  });

  it('미리 계산 목록에서 오늘 빼기 (계산 중인 오늘 경기를 두 번 돌리지 않게): from = 1 이면 오늘 경기가 없다', () => {
    const h = newGame({ seed: 'c81c-up', mode: 'real', playerId: real.id, difficulty: 'normal' });
    h.options = { quickOthers: true };
    // 다른 경기가 있는 날까지
    for (let k = 0; k < 40 && !todaysOthers(h).length; k++) { playOthers(h, 'quick'); endDay(h); }
    const today = todaysOthers(h).map(([r, i]) => specKey({ kind: 'npc', input: otherJob(h, r, i).input }));
    expect(today.length).toBeGreaterThan(0);
    const all = new Set(upcomingOthers(h, 3, 7).map((input) => specKey({ kind: 'npc', input })));
    const skip = new Set(upcomingOthers(h, 3, 7, 1).map((input) => specKey({ kind: 'npc', input })));
    for (const k of today) {
      expect(all.has(k)).toBe(true);
      expect(skip.has(k)).toBe(false);
    }
  });

  it('내 경기 입력은 그날 다른 경기 결과와 무관 (경기 날 도착 즉시 미리 계산해도 [경기 시작]에서 그대로 맞는다)', () => {
    const h = newGame({ seed: 'c81c-dep', mode: 'real', playerId: real.id, difficulty: 'normal' });
    h.options = { quickOthers: true };
    for (let k = 0; k < 40 && !isMatchDay(h); k++) { playOthers(h, 'quick'); endDay(h); }
    expect(isMatchDay(h)).toBe(true);
    const a = roundMatch(h);
    const ka = specKey({ kind: 'myr', input: a.input, teams: a.teams });
    playOthers(h, 'quick');
    const b = roundMatch(h);
    expect(specKey({ kind: 'myr', input: b.input, teams: b.teams })).toBe(ka);
  });

  it('풀: 내 경기(first)는 줄 맨 앞 — 미리 계산 결과를 가져가는 다른 경기(hit)보다도 먼저 워커로 간다', async () => {
    const posted: number[] = [];
    const ws: { onmessage: ((e: { data: unknown }) => void) | null; postMessage: (m: { id: number; job: { input: { x: number } } }) => void; terminate: () => void }[] = [];
    const pending: (() => void)[] = [];
    const factory = () => {
      const w = {
        onmessage: null as ((e: { data: unknown }) => void) | null,
        onerror: null,
        postMessage(m: { id: number; job: { input: { x: number } } }) { posted.push(m.job.input.x); pending.push(() => w.onmessage?.({ data: { id: m.id, out: m.job.input.x } })); },
        terminate() {},
      };
      ws.push(w);
      return w as never;
    };
    const pool = new EnginePool(1, factory, () => 0);
    const j = (x: number) => ({ kind: 'npc', input: { x } }) as never;
    pool.run(j(1));
    pool.prefetch(j(2));
    pool.prefetch(j(3));
    const mine = pool.run({ kind: 'npc', input: { x: 9 } } as never, true);
    const hit = pool.run(j(3));
    // 워커 하나: 1 계산 중 → 다음은 9(맨 앞), 그다음 3(hit), 2
    while (pending.length) { pending.shift()!(); await new Promise((r) => setTimeout(r, 0)); }
    expect(posted).toEqual([1, 9, 3, 2]);
    expect(await mine).toBe(9);
    expect(await hit).toBe(3);
  });
});
