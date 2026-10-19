import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { newGame, playRound, type GameState } from '../src/game';
import { deserialize, serialize } from '../src/save';
import {
  acceptOffer, buyoutFor, clubAcceptChance, makeOfferSet, myBuyout, myTop3, myValue, offerTier, ratingOf, renewContract,
} from '../src/transfer';

function finishSeason(g: GameState): void {
  while (g.phase === 'season') playRound(g, { engine: 'quick' });
}

const O = BALANCE.transfer.offers;

describe('계약 중 이적 제안 빈도 (C.48, pending 78)', () => {
  const g0 = newGame({ mode: 'real', playerId: 'kane', seed: 'c48-offers', difficulty: 'normal' });
  finishSeason(g0);
  const clone = (): GameState => deserialize(serialize(g0));
  const withYears = (left: number): GameState => {
    const g = clone();
    // 비시즌: 남은 시즌 = until − (season + 1) + 1
    g.market.contract.until = g.league.season + left;
    g.market.request = null;
    return g;
  };

  it('남은 계약 시즌으로 단계: 0~1 last · 2 one · 3+ more, 이적 명단이면 last', () => {
    expect(offerTier(withYears(1))).toBe('last');
    expect(offerTier(withYears(2))).toBe('one');
    expect(offerTier(withYears(3))).toBe('more');
    expect(offerTier(withYears(5))).toBe('more');
    const listed = withYears(4);
    listed.market.request = { season: listed.league.season, accepted: true };
    expect(offerTier(listed)).toBe('last');
  });

  it('단계별 제안 수 (구단 거절 포함, 임대 제외)가 byYears 범위 안, 평균은 last > one > more', () => {
    const avg: Record<string, number> = {};
    for (const [left, tier] of [[1, 'last'], [2, 'one'], [4, 'more']] as const) {
      const g = withYears(left);
      let sum = 0;
      for (let k = 0; k < 30; k++) {
        const s = makeOfferSet(g, 'summer', `t${k}`);
        const n = s.offers.filter((o) => o.kind === 'transfer').length + s.refused.length;
        expect(n).toBeLessThanOrEqual(O.byYears[tier][1]);
        sum += n;
      }
      avg[tier] = sum / 30;
    }
    expect(avg.last!).toBeGreaterThan(avg.one!);
    expect(avg.one!).toBeGreaterThan(avg.more!);
  });

  it('2년 이상 남으면 지금 팀보다 전력이 높은 구단만 제안', () => {
    const g = withYears(4);
    const cur = ratingOf(g, g.player.teamId);
    for (let k = 0; k < 20; k++) {
      const s = makeOfferSet(g, 'summer', `m${k}`);
      for (const o of s.offers.filter((x) => x.kind === 'transfer')) expect(ratingOf(g, o.teamId)).toBeGreaterThan(cur);
      for (const r of s.refused) expect(ratingOf(g, r.teamId)).toBeGreaterThan(cur);
    }
  });

  it('계약 중 제안은 이적료가 붙고, 소속 구단이 거절한 제안은 고를 수 없다 (refused)', () => {
    const g = withYears(1);
    let refused = 0;
    let kept = 0;
    for (let k = 0; k < 30; k++) {
      const s = makeOfferSet(g, 'summer', `r${k}`);
      for (const o of s.offers.filter((x) => x.kind === 'transfer')) {
        expect(o.fee).toBeGreaterThan(0);
        kept++;
      }
      for (const r of s.refused) expect(s.offers.some((o) => o.teamId === r.teamId)).toBe(false);
      refused += s.refused.length;
    }
    expect(refused).toBeGreaterThan(0);
    expect(kept).toBeGreaterThan(0);
  });

  it('수락 확률: 이적료가 높을수록 ↑, 팀 OVR 상위 3이면 ↓, 바이아웃 이상이면 1', () => {
    const g = withYears(2);
    const v = myValue(g);
    expect(v).toBeGreaterThan(0);
    const lo = clubAcceptChance(g, v * 0.8, v);
    const hi = clubAcceptChance(g, v * 1.4, v);
    expect(hi).toBeGreaterThan(lo);
    const C = O.club;
    const top = myTop3(g);
    expect(clubAcceptChance(g, v, v)).toBeCloseTo(Math.max(C.minP, C.base - (top ? C.top3 : 0)), 6);
    // 바이아웃 이상 = 거절 불가
    g.market.contract.buyout = Math.round(v * 0.9);
    expect(myBuyout(g)).toBe(Math.round(v * 0.9));
    expect(clubAcceptChance(g, v, v)).toBe(1);
    const s = makeOfferSet(g, 'summer', 'bo');
    expect(s.refused).toHaveLength(0);
  });

  it('이적 명단(요청 수락)이면 구단이 거절하지 않는다', () => {
    const g = withYears(3);
    g.market.request = { season: g.league.season, accepted: true };
    for (let k = 0; k < 10; k++) expect(makeOfferSet(g, 'summer', `l${k}`).refused).toHaveLength(0);
  });

  it('계약 만료(자유계약)면 이적료·거절 없음', () => {
    const g = withYears(0);
    expect(myValue(g)).toBe(0);
    const s = makeOfferSet(g, 'summer', 'fa');
    expect(s.refused).toHaveLength(0);
    for (const o of s.offers) expect(o.fee).toBeUndefined();
  });

  it('새 계약·재계약·이적 수락 때 바이아웃이 생기고 세이브 왕복 그대로', () => {
    const g = newGame({ mode: 'prospect', position: 'ST', seed: 'c48-buyout', difficulty: 'normal' });
    expect(g.market.contract.buyout).toBe(buyoutFor(g.player, BALANCE.transfer.newGameYears));
    expect(g.market.contract.buyout).toBeGreaterThan(0);
    finishSeason(g);
    const back = deserialize(serialize(g));
    expect(back.market.contract.buyout).toBe(g.market.contract.buyout);
    // 재계약
    const r = clone();
    r.market.renewal = { years: [2, 3], wage: 1000 };
    renewContract(r, 3);
    expect(r.market.contract.buyout).toBe(buyoutFor(r.player, 3));
    // 이적 수락
    const a = withYears(1);
    const s = makeOfferSet(a, 'summer', 'acc');
    const i = s.offers.findIndex((o) => o.kind === 'transfer');
    if (i >= 0) {
      a.market.offers = s.offers;
      a.market.refused = s.refused;
      acceptOffer(a, i, () => 0);
      expect(a.market.contract.buyout).toBe(buyoutFor(a.player, s.offers[i]!.years));
      expect(a.market.refused).toBeNull();
    }
    // 옛 세이브 (buyout 없음) → 계약 길이로 계산
    const old = clone();
    delete old.market.contract.buyout;
    expect(myBuyout(old)).toBe(buyoutFor(old.player, old.market.contract.until - old.market.contract.from + 1));
  });
});
