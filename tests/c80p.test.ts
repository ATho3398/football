// C.80p (53단계): 상대 성향별 직접 보정표 · 직선 반대 전환 보임 가산은 내려앉은 상대 앞에서만
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { fitPts, matchupPts } from '../src/engine/fit';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80p-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80p-a', 2018, []);
function state(a: Tendency, b: Tendency) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true }).state;
}

describe('C.80p 상대 성향별 보정', () => {
  it('표: 티키 → 직선 칸만 공중·짧은 패스·공 지키기·태클 +2 (능력치 점수), 티키 행은 그 칸과 게겐 칸(C.80t) (C.80w 롱패스 칸은 c80w 테스트)', () => {
    expect(ENGINE.matchup.tikitaka!.direct).toEqual({ air: 7, short: 3, keep: 3, tackle: 6 }); // C.82g 2 → 3 · C.82f: 공중 → 7 · 태클 → 6 (C.82g 병합 뒤 960 티키>직선 0.00) (티키>직선 −0.01 → +0.055)
    expect(Object.keys(ENGINE.matchup).sort()).toEqual(['balanced', 'block', 'direct', 'gegenpress', 'tikitaka']); // C.81s: 게겐 → 직선 칸
    expect(Object.keys(ENGINE.matchup.tikitaka!)).toEqual(['direct', 'counter', 'gegenpress']); // C.80t: 티키 → 게겐 칸 추가 · C.82f: 티키 → 역습 칸
  });

  it('티키가 직선을 상대할 때만 걸리고 반대쪽(직선 팀)·다른 상대에는 0', () => {
    const s = state('tikitaka', 'direct');
    expect(matchupPts(s, 0, 'air')).toBe(7); // C.82f: 2 → 7
    expect(matchupPts(s, 0, 'short')).toBe(3); // C.82g
    expect(matchupPts(s, 0, 'long')).toBe(0);
    expect(matchupPts(s, 1, 'air')).toBe(0);
    const g = state('tikitaka', 'gegenpress');
    expect(matchupPts(g, 0, 'air')).toBe(0); // C.80t: 티키 → 게겐 칸은 짧은 패스·공 지키기만
  });

  it('fitPts(판단·실행 공통) 에 그대로 더해진다', () => {
    const s = state('tikitaka', 'direct');
    const g = state('tikitaka', 'block');
    // 같은 로스터·같은 성향이라 적합도 몫은 같다 — 차이는 보정표 몫
    expect(fitPts(s, 0, 'keep') - fitPts(g, 0, 'keep')).toBeCloseTo(3, 9);
  });
});
