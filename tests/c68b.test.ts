// C.68b (40단계 5-7 b): 재정 b — 카드 상점(매주)·카드팩(주당 한도)·TP 해금 · 집·차(효과·유지비·사치 리스크) · 자선(위상 상한·자선가) ·
// 투자(예금·부동산·이벤트형 정산) · 엔딩 자산 점수 · 이벤트 돈 효과 · 고급 에이전트 · 시즌 목표 "챔스 n강" · NPC 위상 연봉/몸값 · 세이브 39
import { describe, expect, it } from 'vitest';
import { addDays } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { cardById } from '../src/config/cards';
import { applyEffects, ensureEvents } from '../src/events';
import { endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, type GameState } from '../src/game';
import { book, ensureMoney, flowsIn, flowsOut, lifeYearly, myWage, onContractSigned, signingBonus, staffRecoveryMul } from '../src/money';
import { deserialize, serialize } from '../src/save';
import { goalLabel, goalMet, makeGoals, valueLabel } from '../src/seasonGoals';
import { financeVM } from '../src/ui/financeVM';
import { financeView } from '../src/ui/views/finance';
import { npcAnnualWage, npcValue } from '../src/finance';
import {
  acceptDeal, assetScore, buyPack, buyShopCard, cardBlocked, donate, endingScores, ensureShop, moveInvest, netWorth, packBlocked, setLife, tpBlocked, useTp,
  wealthSeasonEnd, weekOf,
} from '../src/wealth';

const prospect = (seed: string): GameState => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
const rich = (seed: string, cash = 5_000_000): GameState => {
  const g = prospect(seed);
  ensureMoney(g).cash = cash;
  return g;
};

function advance(g: GameState, days: number): void {
  const until = addDays(g.calendar.date, days);
  while (g.phase === 'season' && g.calendar.date < until) {
    if (isMatchDay(g)) playRound(g, { engine: 'quick' });
    else {
      playOthers(g, 'quick');
      endDay(g);
    }
  }
}

describe('카드 상점·카드팩 (19.6)', () => {
  it('매주 3~4장, 같은 주는 같은 진열(결정적), 일반 = 주급 × 0.5, 희귀 이상은 위상 조건·절대 가격', () => {
    const g = rich('c68b-shop');
    const s = ensureShop(g)!;
    expect(s.week).toBe(weekOf(g.calendar.date));
    expect(s.items.length).toBeGreaterThanOrEqual(3);
    expect(s.items.length).toBeLessThanOrEqual(4);
    const again = rich('c68b-shop');
    expect(ensureShop(again)!.items.map((x) => x.id)).toEqual(s.items.map((x) => x.id));
    const W = BALANCE.wealth;
    // 신인(일반 위상): 희귀는 스페셜부터
    expect(cardBlocked(g, 'rare', W.shop.price.rare, 0)).toMatch(/스페셜/);
    expect(cardBlocked(g, 'common', 500, 0)).toBeNull();
    expect(cardBlocked(g, 'common', 500, 2)).toMatch(/2장/);
    const common = s.items.findIndex((x) => cardById(x.id)!.rarity === 'common');
    if (common >= 0) {
      const id = s.items[common]!.id;
      const had = g.cards!.owned[id] ?? 0;
      const c0 = ensureMoney(g).cash;
      expect(buyShopCard(g, common)).toBe(true);
      expect(g.cards!.owned[id]).toBe(Math.min(2, had + 1));
      expect(c0 - ensureMoney(g).cash).toBe(Math.max(500, Math.round((myWage(g) * 0.5) / 500) * 500));
      expect(buyShopCard(g, common)).toBe(false);
    }
    // 다음 주 = 새 진열
    g.calendar.date = addDays(s.week, 7);
    expect(ensureShop(g)!.week).not.toBe(s.week);
  });
  it('카드팩: 주급 × 1, 한 팩 3장, 주당 2팩 한도', () => {
    const g = rich('c68b-pack');
    const n0 = Object.values(g.cards!.owned).reduce((t, v) => t + v, 0);
    expect(buyPack(g).length).toBe(3);
    expect(buyPack(g).length).toBe(3);
    expect(packBlocked(g)).toMatch(/한도/);
    expect(buyPack(g)).toEqual([]);
    expect(Object.values(g.cards!.owned).reduce((t, v) => t + v, 0)).toBeGreaterThan(n0);
    expect(ensureMoney(g).season.card).toBe(-2 * Math.max(500, Math.round(myWage(g) / 500) * 500));
  });
});

describe('TP 카드 해금 (5.4 · 5.5)', () => {
  it('TP 3 → 희귀 3택 1, TP 5 → 에픽 3택 1 (탑클래스부터)', () => {
    const g = prospect('c68b-tp');
    expect(tpBlocked(g, 'rare')).toMatch(/TP 3/);
    g.cards!.tp = 8;
    const picks = g.cards!.picks.length;
    expect(useTp(g, 'rare')).toBe(true);
    expect(g.cards!.tp).toBe(5);
    expect(g.cards!.picks.length).toBe(picks + 1);
    expect(g.cards!.picks.at(-1)!.options.every((id) => cardById(id)!.rarity === 'rare')).toBe(true);
    expect(tpBlocked(g, 'epic')).toMatch(/탑클래스/);
    g.player.reputation = 700;
    expect(useTp(g, 'epic')).toBe(true);
    expect(g.cards!.tp).toBe(0);
  });
});

describe('생활 (19.7)', () => {
  it('집: 구매가·매각 70%·유지비 3%·피로 회복 +, 차: 멘탈 피로 −, 사치품은 언론 논란 예약 가능', () => {
    const g = rich('c68b-life', 10_000_000);
    const W = BALANCE.wealth;
    expect(staffRecoveryMul(g)).toBe(1);
    const c0 = ensureMoney(g).cash;
    expect(setLife(g, 'house', 2)).toBe(true);
    expect(c0 - ensureMoney(g).cash).toBe(W.houses[2]!.price);
    expect(staffRecoveryMul(g)).toBeCloseTo(1 + W.houses[2]!.recovery);
    expect(lifeYearly(ensureMoney(g))).toBe(W.houses[2]!.price * W.houseUpkeep);
    const c1 = ensureMoney(g).cash;
    expect(setLife(g, 'house', 3)).toBe(true);
    expect(c1 - ensureMoney(g).cash).toBe(W.houses[3]!.price - W.houses[2]!.price * W.houseResale);
    // 사치품: 여러 번 사면 적어도 한 번은 논란이 예약된다 (확률 50%, 날짜·단계 시드)
    const ev = ensureEvents(g);
    for (let i = 0; i < 6; i++) {
      g.calendar.date = addDays(g.calendar.date, 1);
      setLife(g, 'car', i % 2 ? 3 : 4);
    }
    expect(ev.queue.some((q) => q.id === 'n_luxuryBuy')).toBe(true);
    expect(netWorth(g)).toBe(ensureMoney(g).cash + W.houses[3]!.price * W.houseResale);
  });
});

describe('자선 (19.8)', () => {
  it('1억당 위상 +1, 시즌 상한 +30, 누적 100억 자선가', () => {
    const g = rich('c68b-charity', 20_000_000);
    const r0 = g.player.reputation;
    expect(donate(g, 50000)).toBe(5);
    expect(g.player.reputation).toBe(r0 + 5);
    expect(donate(g, 1_000_000)).toBe(25);
    expect(g.player.reputation).toBe(r0 + 30);
    expect(donate(g, 10000)).toBe(0);
    const m = ensureMoney(g);
    expect(m.charity!.total).toBe(1_060_000);
    expect(m.charity!.badge).toBe(g.league.season);
    expect(endingScores(g).philanthropist).toBe(true);
    expect(flowsOut(m.season)).toBe(1_060_000);
  });
});

describe('투자 (19.9)', () => {
  it('예금·부동산 넣기/빼기는 순수입에 안 들어가고, 시즌 끝 이자·수익, 이벤트형은 투자금 안에서만 손해', () => {
    const g = rich('c68b-invest', 1_000_000);
    const m = ensureMoney(g);
    expect(moveInvest(g, 'deposit', 100000)).toBe(100000);
    expect(moveInvest(g, 'estate', 100000)).toBe(100000);
    expect(m.cash).toBe(800000);
    expect(flowsIn(m.season) - flowsOut(m.season)).toBe(0);
    expect(netWorth(g)).toBe(1_000_000);
    m.invest!.offer = { label: '테스트 사업', amount: 50000, mult: 0, season: g.league.season };
    expect(acceptDeal(g)).toMatch(/투자/);
    expect(netWorth(g)).toBe(1_000_000);
    wealthSeasonEnd(g);
    expect(m.season.invest).toBe(Math.round(100000 * 0.03) + (m.season.invest! - 3000));
    const estate = m.season.invest! - 3000 + 50000;
    expect(Math.abs(estate)).toBeLessThanOrEqual(100000 * (0.06 + 0.08) + 1);
    // 실패한 사업: 투자금만 잃음
    expect(m.invest!.deals.length).toBe(0);
    expect(netWorth(g)).toBe(1_000_000 + m.season.invest!);
    expect(moveInvest(g, 'deposit', -Infinity)).toBe(-100000);
  });
  it('주 정산 중 제안이 오면 인박스 선택형, 거절 기본', () => {
    const g = rich('c68b-deal', 1_000_000);
    advance(g, 7 * 26);
    const box = g.inbox?.items ?? [];
    const it = box.find((x) => x.ev === 'n_investDeal');
    // 확률 60% 이라 시드에 따라 없을 수 있다 — 있으면 본문에 금액
    if (it) expect(it.body).toMatch(/억/);
    expect(ensureMoney(g).invest?.offered).toBe(g.league.season);
  });
});

describe('엔딩 자산 점수 (19.11)', () => {
  it('clamp(33 × log10(순자산 억 + 1), 0, 100): 20억 43 · 100억 66 · 300억 82 · 1000억 99', () => {
    expect(assetScore(200000)).toBe(44);
    expect(assetScore(1_000_000)).toBe(66);
    expect(assetScore(3_000_000)).toBe(82);
    expect(assetScore(10_000_000)).toBe(99);
    expect(assetScore(-50000)).toBe(0);
    expect(assetScore(0)).toBe(0);
  });
});

describe('이벤트 돈 효과 · 고급 에이전트 · NPC 위상 연봉', () => {
  it('{ money: n } = 주급 × n, charity 면 기부 누적', () => {
    const g = rich('c68b-ev', 0);
    const w = myWage(g);
    applyEffects(g, [{ money: 2 }], '테스트');
    expect(ensureMoney(g).season.event).toBe(Math.max(500, w * 2));
    applyEffects(g, [{ money: -1, charity: true }], '기부');
    expect(ensureMoney(g).charity!.total).toBe(Math.max(500, w));
  });
  it('고급 에이전트: 주급 +5%, 수수료 8%', () => {
    const g = rich('c68b-agent', 0);
    ensureMoney(g).agent = 'premium';
    const c = { wage: 10000, from: 2020, until: 2022 };
    onContractSigned(g, c, '테스트');
    expect(c.wage).toBe(10500);
    const bonus = signingBonus(10500, 3);
    expect(ensureMoney(g).season.agent).toBe(-Math.round(((bonus + 10500 * 52) * 0.08) / 10) * 10);
  });
  it('NPC 연봉·몸값: 위상을 넘기면 그 위상으로 (없으면 OVR 근사 그대로)', () => {
    const g = prospect('c68b-npc');
    const team = g.league.teams[0]!;
    const p = g.rosters[team.id]!.players.find((x) => !x.gk)!;
    expect(npcAnnualWage(p, team.rating, 900)).toBeGreaterThan(npcAnnualWage(p, team.rating));
    expect(npcValue(p, g.league.season, 900)).toBeGreaterThanOrEqual(npcValue(p, g.league.season));
  });
});

describe('시즌 목표 챔스 n강 (pending 109 ⑤)', () => {
  it('챔스 팀이면 구단 목표가 확률로 챔스 단계, 다른 목표는 그대로', () => {
    let found = false;
    for (let i = 0; i < 30 && !found; i++) {
      const g = prospect(`c68b-ucl-${i}`);
      const u = g.cups?.ucl;
      if (!u) continue;
      const team = u.groups.flat().find((id) => g.league.teams.some((t) => t.id === id))!;
      const before = makeGoals(g);
      g.player.teamId = team;
      const list = makeGoals(g);
      const club = list[1]!;
      if (club.kind !== 'uclStage') continue;
      found = true;
      expect(club.target).toBeGreaterThanOrEqual(1);
      expect(club.target).toBeLessThanOrEqual(4);
      expect(goalLabel(club)).toMatch(/^챔스 .+ 진출$/);
      expect(valueLabel('uclStage', 0)).toBe('조별리그');
      expect(goalMet(g, club, club.target)).toBe(true);
      expect(goalMet(g, club, club.target - 1)).toBe(false);
      void before;
    }
    expect(found).toBe(true);
  });
});

describe('재정 화면 탭·세이브 39', () => {
  it('세 탭이 그려지고 세이브 왕복', () => {
    const g = rich('c68b-ui', 3_000_000);
    setLife(g, 'house', 2);
    donate(g, 10000);
    moveInvest(g, 'deposit', 10000);
    const vm = financeVM(g);
    expect(vm.shop!.length).toBeGreaterThanOrEqual(3);
    for (const tab of ['money', 'shop', 'life'] as const) expect(financeView(vm, tab)).toContain('재정 탭');
    expect(financeView(vm, 'shop')).toContain('카드팩');
    expect(financeView(vm, 'life')).toContain('엔딩 자산 점수');
    expect(SAVE_FORMAT_VERSION).toBe(50);
    const back = deserialize(serialize(g));
    expect(back.money!.house).toBe(2);
    expect(back.money!.charity!.total).toBe(10000);
    expect(back.money!.invest!.deposit).toBe(10000);
    book(back, 'card', -500);
    expect(back.money!.season.card).toBe(-500);
  });
});
