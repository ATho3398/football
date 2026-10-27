import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, type GameState } from '../src/game';
import { playerOvr } from '../src/growth';
import { shiftOvr } from '../src/npc';
import { createRng } from '../src/rng';
import { isProspectDeal, makeOfferSet, prospectBoost } from '../src/transfer';
import type { Tier } from '../src/types';

const P = BALANCE.transfer.prospect;

/** OVR 67 · 위상 30 유망주, 계약 마지막 해 (제안 3~5개 단계) */
function youngster(seed: string, age: number, tier: Tier): GameState {
  const g = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
  shiftOvr(g.player.attributes, g.player.position, 67 - playerOvr(g.player), createRng(1));
  g.player.age = age;
  g.player.potentialTier = tier;
  g.player.reputation = 30;
  g.market.contract.until = g.league.season;
  return g;
}

describe('유망주 계약 — 로열로드 (C.78u, pending 144)', () => {
  it('가산: maxAge 세 이하만, 잠재력이 클수록, 최대 maxBoost', () => {
    const base = { reputation: 0, peakTarget: undefined };
    expect(prospectBoost({ ...base, age: P.maxAge + 1, potentialTier: 'legendary' }, 67)).toBe(0);
    expect(prospectBoost({ ...base, age: 19, potentialTier: 'worldClass' }, 67)).toBeGreaterThan(prospectBoost({ ...base, age: 19, potentialTier: 'normal' }, 67));
    expect(prospectBoost({ reputation: 0, age: 19, potentialTier: 'normal', peakTarget: 99 }, 60)).toBe(P.maxBoost);
  });

  it('유망주 계약 판정: 나이 가산 유효 OVR + minGap 이상 강한 팀, 23세부터 없음', () => {
    expect(isProspectDeal({ age: 20 }, 68, 80)).toBe(true);
    expect(isProspectDeal({ age: 20 }, 68, 72)).toBe(false);
    expect(isProspectDeal({ age: 23 }, 68, 84)).toBe(false);
  });

  it('잠재력 상위 19세 OVR 67: 상위 6팀 제안이 오고, 유망주 계약은 저연봉·4~5년', () => {
    let top6 = 0;
    let deals = 0;
    for (let i = 0; i < 12; i++) {
      const g = youngster(`c78u-${i}`, 19, 'worldClass');
      const top = new Set([...g.league.teams].sort((a, b) => b.rating - a.rating).slice(0, 6).map((t) => t.id));
      const offers = makeOfferSet(g, 'summer').offers.filter((o) => o.kind === 'transfer');
      if (offers.some((o) => top.has(o.teamId))) top6++;
      for (const o of offers.filter((x) => x.prospect)) {
        deals++;
        expect(o.years).toBeGreaterThanOrEqual(P.years[0]);
        expect(o.years).toBeLessThanOrEqual(P.years[1]);
      }
    }
    expect(top6).toBeGreaterThanOrEqual(6);
    expect(deals).toBeGreaterThan(0);
  });

  it('23세 이상은 유망주 설정과 무관 (가산 끄기 전후 같은 제안)', () => {
    const g = youngster('c78u-old', 24, 'worldClass');
    const a = makeOfferSet(g, 'summer').offers;
    const keep = P.maxAge;
    P.maxAge = -1;
    try {
      expect(makeOfferSet(g, 'summer').offers).toEqual(a);
    } finally {
      P.maxAge = keep;
    }
    expect(a.some((o) => o.prospect)).toBe(false);
  });
});
