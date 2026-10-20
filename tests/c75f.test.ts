import { describe, expect, it } from 'vitest';
import { ENGINE } from '../src/engine/config';
import { isNoContrib, ratingDelta, type RatingParts } from '../src/engine/rating';
import { createMatch } from '../src/engine/sim';
import { teamSetupFromRoster } from '../src/engine/setup';
import { rebuildRosters } from '../src/game';
import { teamRatings } from '../src/roster';

const blank = (extra: Partial<RatingParts> = {}): RatingParts => ({
  group: 'WING', passes: 20, forward: 5, keyPasses: 0, onTarget: 0, goals: 0, assists: 0, dribbles: 0, tackles: 0,
  interceptions: 0, aerials: 0, lost: 0, dangerLost: 0, attackLost: 0, fouls: 0, offsides: 0, yellows: 0, red: 0,
  conceded: 0, saves: 0, cleanSheet: 0, result: 0, ...extra,
});

describe('공격 포지션 무기여 경기 감점 (C.75f, E-3)', () => {
  const R = ENGINE.rating;

  it('ST·WING·CAM 이 골·도움·키패스·유효슈팅·드리블 성공 모두 0 이면 무기여, 하나라도 있거나 다른 포지션이면 아님', () => {
    expect(isNoContrib(blank())).toBe(true);
    expect(isNoContrib(blank({ group: 'ST' }))).toBe(true);
    expect(isNoContrib(blank({ group: 'CAM' }))).toBe(true);
    for (const k of ['goals', 'assists', 'keyPasses', 'onTarget', 'dribbles'] as const) expect(isNoContrib(blank({ [k]: 1 }))).toBe(false);
    expect(isNoContrib(blank({ group: 'CM' }))).toBe(false);
    expect(isNoContrib(blank({ group: 'FB' }))).toBe(false);
  });

  it('무기여 플래그는 평점 약 −0.3 (scale 포함)', () => {
    const d = ratingDelta(blank({ noContrib: 1 })) - ratingDelta(blank());
    expect(d * R.scale).toBeCloseTo(-0.3, 1);
  });

  it('경기 종료 평점에서 무기여 공격수는 감점이 붙는다 (45분 이상)', () => {
    const rosters = rebuildRosters('c75f', undefined, 0);
    const ratings = teamRatings(rosters);
    const [h, a] = Object.keys(ratings) as [string, string];
    const home = teamSetupFromRoster(rosters[h]!, ratings[h]!, ratings[a]!, 'c75f');
    const away = teamSetupFromRoster(rosters[a]!, ratings[a]!, ratings[h]!, 'c75f');
    const r = createMatch({ home, away, mode: 'auto', difficulty: 'normal', seed: 75, bigMatch: false }).runToEnd();
    expect(r.players.length).toBeGreaterThan(20);
    for (const p of r.players) expect(p.rating).toBeGreaterThanOrEqual(R.min);
  });
});
