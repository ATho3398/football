import { describe, expect, it } from 'vitest';
import { runJobs } from '../scripts/engine/pool';
import { neutralJob } from '../scripts/engine/suite';
import type { MatchOut } from '../scripts/engine/job';

// E.18 0번: 경기마다 시드가 정해져 있으므로 워커 수와 상관없이 결과가 같아야 한다
describe('측정 병렬 실행 (E.18)', () => {
  it('워커 1개 / 3개 / 메인 스레드 결과가 같다', async () => {
    const jobs = [0, 1, 2, 3].map((i) => neutralJob(i, i === 3 ? { mods: [{ team: 0, slot: 9, attrs: ['shooting'], delta: 10 }] } : {}));
    const strip = (xs: MatchOut[]) => xs.map(({ ms: _ms, ...r }) => r);
    const one = strip(await runJobs<MatchOut>(jobs, { workers: 1 }));
    const three = strip(await runJobs<MatchOut>(jobs, { workers: 3 }));
    const inline = strip(await runJobs<MatchOut>(jobs.slice(0, 2), { workers: 0 }));
    expect(three).toEqual(one);
    expect(inline).toEqual(one.slice(0, 2));
    expect(one[0]).not.toEqual(one[1]);
  });
});
