// C.80t (53단계): 게겐 역압박 가담 가산 · 티키 → 게겐 상대 성향 보정
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { matchupPts } from '../src/engine/fit';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { TENDENCY, tacticsOf } from '../src/engine/tactics';
import type { Tendency } from '../src/engine/types';
import { createTeamRoster } from '../src/roster';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80t-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80t-a', 2018, []);
function state(a: Tendency, b: Tendency) {
  const h = teamSetupFromRoster(home, 75, 75);
  const w = teamSetupFromRoster(away, 75, 75);
  h.tactics = tacticsOf(a);
  w.tactics = tacticsOf(b);
  return createMatch({ home: h, away: w, mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false, neutral: true }).state;
}

describe('C.80t 게겐다움', () => {
  it('게겐 역압박 가담 가산 0.35 (counterJoin 에 게겐만 더함)', () => {
    expect(TENDENCY.gegenJoin).toBe(0.35);
    expect(ENGINE.offball.counterJoin).toBe(0.4);
  });

  it('티키 → 게겐 칸: 짧은 패스·공 지키기 +2, 게겐 쪽·다른 실행은 0', () => {
    expect(ENGINE.matchup.tikitaka!.gegenpress).toEqual({ short: 2.5, keep: 2 }); // C.81s 짧은 패스 2 → 2.5 (게겐>티키 +0.47 → +0.38)
    const s = state('tikitaka', 'gegenpress');
    expect(matchupPts(s, 0, 'short')).toBe(2.5);
    expect(matchupPts(s, 0, 'keep')).toBe(2);
    expect(matchupPts(s, 0, 'air')).toBe(0);
    expect(matchupPts(s, 1, 'short')).toBe(0);
  });
});
