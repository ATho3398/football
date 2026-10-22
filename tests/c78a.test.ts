// C.78a (공통 규칙 로드맵 5단계 전환 수비): 측정 훅(transProbe)은 엔진 결과를 바꾸지 않는다 · 전환 상수를 켜면 같은 시드에서도 결정적이고 실제로 갈린다 ·
// 출구 침투는 탈취 때 1명만 · 역압박이 뚫리면 그 틱에 끝나고 가담자는 긴급 복귀
import { describe, expect, it } from 'vitest';
import { turnover } from '../src/engine/core';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { transitionTick } from '../src/engine/offball';
import { createTeamRoster, rosterRating } from '../src/roster';
import { transRun } from '../scripts/engine/transProbe';
import { TRANSITION_ON, withEngine } from './scenes/harness';

function match(seed: number) {
  const h = createTeamRoster({ id: 'th', rating: 75 }, `c78a-h${seed}`, 2018, []);
  const a = createTeamRoster({ id: 'ta', rating: 75 }, `c78a-a${seed}`, 2018, []);
  return createMatch({ home: teamSetupFromRoster(h, rosterRating(h), 75, `th${seed}`), away: teamSetupFromRoster(a, rosterRating(a), 75, `ta${seed}`), mode: 'auto', difficulty: 'normal', seed, bigMatch: false, neutral: true });
}

describe('C.78a 전환 수비', () => {
  it('전환 측정 훅을 돌려도 같은 시드 같은 결과 · 상실을 센다', () => {
    const off = match(7801).runToEnd();
    const m = match(7801);
    const t = transRun(m);
    const on = m.runToEnd();
    expect(JSON.stringify(on.teamStats)).toBe(JSON.stringify(off.teamStats));
    expect(t.team[0].n + t.team[1].n).toBeGreaterThan(80);
  });

  it('전환 상수를 켜면 결정적이고 결과가 달라진다', () => {
    const off = match(7802).runToEnd();
    const [a, b] = withEngine(TRANSITION_ON, () => [match(7802).runToEnd(), match(7802).runToEnd()]);
    expect(JSON.stringify(a!.teamStats)).toBe(JSON.stringify(b!.teamStats));
    expect(JSON.stringify(a!.teamStats)).not.toBe(JSON.stringify(off.teamStats));
  });

  it('탈취 때 출구 침투는 1명 · 역압박이 뚫리면 그 틱에 끝나고 가담자는 긴급 복귀', () => {
    withEngine(TRANSITION_ON, () => {
      const s = match(7803).state;
      s.restart = null;
      s.t = 600;
      // 팀 1 이 하프라인에서 공을 얻음 → 팀 0 이 잃은 팀
      const owner = s.agents.find((x) => x.team === 1 && x.line === 2)!;
      s.ball.owner = owner.idx;
      s.ball.x = 52;
      s.ball.y = 34;
      owner.x = 52;
      owner.y = 34;
      for (const x of s.agents) x.runUntil = 0;
      // 팀 1(−x 로 공격) 공격 줄 둘을 공보다 앞(40 m)에
      s.agents.filter((x) => x.team === 1 && x.line === 3).forEach((x, k) => { x.x = 40; x.y = 20 + 28 * k; });
      turnover(s, 0, true);
      expect(s.agents.filter((x) => x.team === 1 && x.runUntil > s.t)).toHaveLength(1);
      const tm = s.teams[0];
      // 가담자를 공보다 앞(상대 진영 쪽)에 두고 역압박을 연다 → 뚫림
      const ps = s.agents.filter((x) => x.team === 0 && x.line === 2).slice(0, 2);
      ps.forEach((x) => { x.x = 60; x.recoverUrgent = false; });
      tm.counterPressers = ps.map((x) => x.idx);
      tm.counterUntil = s.t + 9;
      transitionTick(s);
      expect(tm.counterUntil).toBe(s.t);
      expect(tm.brokeAt).toBe(s.t);
      expect(ps.every((x) => x.recoverUrgent && x.nextOffball === s.t)).toBe(true);
    });
  });
});
