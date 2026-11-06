import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { ratingDelta, ratingFromParts, type RatingParts } from '../src/engine/rating';
import { ROLE_OPTIONS } from '../src/engine/roles';

// C.81r 역할별 평점 쏠림 보정: 평점 산출 가중만 바꾼다 (패스 체감 · 수비 행동 · 역할별 정규화)
const blank = (extra: Partial<RatingParts> = {}): RatingParts => ({
  group: 'CAM', passes: 0, forward: 0, keyPasses: 0, onTarget: 0, goals: 0, assists: 0, dribbles: 0, tackles: 0,
  interceptions: 0, aerials: 0, lost: 0, dangerLost: 0, attackLost: 0, fouls: 0, offsides: 0, yellows: 0, red: 0,
  conceded: 0, saves: 0, cleanSheet: 0, result: 0, ...extra,
});
const R = ENGINE.rating;

describe('C.81r 평점 가중', () => {
  it('패스 개수 체감: 무릎까지는 그대로, 넘는 몫은 꼬리 비율만 오른다', () => {
    const knee = R.passKnee.CAM!;
    const per = (n: number) => ratingDelta(blank({ passes: n + 1 })) - ratingDelta(blank({ passes: n }));
    expect(per(knee - 1)).toBeCloseTo(R.pass);
    expect(per(knee + 5)).toBeCloseTo(R.pass * R.passTail);
    const fk = R.forwardKnee.CAM!;
    const fper = (n: number) => ratingDelta(blank({ passes: n + 1, forward: n + 1 })) - ratingDelta(blank({ passes: n, forward: n }));
    expect(fper(fk - 1)).toBeCloseTo(R.forwardPass);
    expect(fper(fk + 5)).toBeCloseTo(R.forwardPass * R.forwardTail);
  });

  it('무릎이 없는 군(GK, CM 안전 패스)은 패스 체감이 없다 — C.81u: CM 전진 패스는 무릎 있음', () => {
    const d = ratingDelta(blank({ group: 'GK', passes: 90, forward: 40 })) - ratingDelta(blank({ group: 'GK' }));
    expect(d).toBeCloseTo(50 * R.pass + 40 * R.forwardPass);
    const fk = R.forwardKnee.CM!;
    const c = ratingDelta(blank({ group: 'CM', passes: 90, forward: 40 })) - ratingDelta(blank({ group: 'CM' }));
    expect(c).toBeCloseTo(50 * R.pass + (fk + (40 - fk) * R.forwardTail) * R.forwardPass);
  });

  it('수비 행동: 블록·걷어내기도 평점에 들어가고 태클·인터셉트 가중이 올랐다', () => {
    const base = ratingDelta(blank());
    expect(ratingDelta(blank({ blocks: 2 })) - base).toBeCloseTo(2 * R.block);
    expect(ratingDelta(blank({ clearances: 3 })) - base).toBeCloseTo(3 * R.clearance);
    expect(R.block).toBeGreaterThan(0);
    expect(R.tackle).toBeGreaterThan(0.1);
    expect(R.interception).toBeGreaterThan(0.08);
  });

  it('역할별 정규화: 군 안 역할 평균은 0 근처, 역할이 없으면 보정 없음', () => {
    for (const [g, roles] of Object.entries(ROLE_OPTIONS)) {
      if (g === 'GK') continue;
      const m = roles.reduce((a, r) => a + (R.roleCenter[r] ?? 0), 0) / roles.length;
      expect(Math.abs(m)).toBeLessThan(0.02);
      for (const r of roles) expect(Math.abs(R.roleCenter[r] ?? 0)).toBeLessThanOrEqual(0.25);
    }
    const p = blank({ passes: 30, forward: 10, keyPasses: 2 });
    const none = ratingFromParts(p);
    // 같은 행동이면 roleCenter 가 낮은(쏠림이 아래였던) 역할이 더 높은 평점
    expect(ratingFromParts({ ...p, role: 'boxCrasher' })).toBeGreaterThan(none);
    expect(ratingFromParts({ ...p, role: 'freeRole' })).toBeLessThan(none);
  });
});
