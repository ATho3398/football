// C.80g (53단계): 박스 밖 땅볼 롱패스 수신 경합 · 공중 롱볼 먼 경합
import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { aerialWin, receiveWin } from '../src/engine/duel';
import { teamSetupFromRoster } from '../src/engine/setup';
import { createMatch } from '../src/engine/sim';
import type { Agent } from '../src/engine/state';
import { createTeamRoster } from '../src/roster';
import { PATCH_LABEL } from '../src/version';

const home = createTeamRoster({ id: 'h', rating: 75 }, 'c80g-h', 2018, []);
const away = createTeamRoster({ id: 'a', rating: 75 }, 'c80g-a', 2018, []);
const state = () => createMatch({ home: teamSetupFromRoster(home, 75, 75), away: teamSetupFromRoster(away, 75, 75), mode: 'auto', difficulty: 'normal', seed: 3, bigMatch: false }).state;

describe('C.80g 땅볼 롱패스 수신 경합', () => {
  it('스위치 기본값: 박스 밖 20 m+ 땅볼 2.5 m 경합 켬 · 공중 먼 경합 끔(코드만)', () => {
    const P = ENGINE.prob;
    expect(P.contestOut).toBe(1);
    expect(P.contestOutFrom).toBe(20);
    expect(P.contestOutDist).toBe(2.5);
    expect(P.airContestFar).toBe(0);
    expect(P.airContestBias).toBeGreaterThan(0);
    expect(PATCH_LABEL).toMatch(/^C\.8/);
  });

  it('수신 경합은 볼 컨트롤·근력·민첩이 좋은 받는 선수가 더 잘 이긴다', () => {
    const s = state();
    const rc = s.agents.find((a) => a.team === 0 && a.line > 0)!;
    const def = s.agents.find((a) => a.team === 1 && a.line > 0)!;
    const weak: Agent = { ...rc, attrs: { ...rc.attrs, ballControl: 40, strength: 40, agility: 40 } };
    const good: Agent = { ...rc, attrs: { ...rc.attrs, ballControl: 90, strength: 80, agility: 85 } };
    expect(receiveWin(good, def)).toBeGreaterThan(receiveWin(weak, def));
  });

  it('먼 공중 경합 보정은 받는 쪽 확률을 올린다', () => {
    const s = state();
    const rc = s.agents.find((a) => a.team === 0 && a.line > 0)!;
    const def = s.agents.find((a) => a.team === 1 && a.line > 0)!;
    expect(aerialWin(rc, def, 0, ENGINE.prob.airContestBias)).toBeGreaterThan(aerialWin(rc, def));
    expect(aerialWin(rc, def, 0, 0)).toBe(aerialWin(rc, def));
  });
});
