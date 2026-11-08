// 재정 화면 VM (C.68a, 19번): 잔고 · 이번 시즌 수입/지출 · 계약 금액 · 스태프(슬롯·해지) · 코치 모집·후보 · 최근 내역

import { dateLabel } from '../calendar';
import type { GameState } from '../game';
import { TIER_NAMES_KO, reputationTier } from '../growth';
import {
  annualOf, ensureMoney, EXPENSE_CATS, flowsIn, flowsOut, hireBlocked, INCOME_CATS, MONEY_CAT_KO, moneyLabel, moneyShort, myWage,
  scoutBlocked, scoutCost, staffEffect, staffSlots, STAFF_ROLE_KO, attrShort, type Staff,
} from '../money';
import { BALANCE } from '../config/balance';
import { cardById, type Rarity } from '../config/cards';
import type { Tier } from '../types';
import {
  assetScore, cardBlocked, cardPrice, careerNet, donateBlocked, ensureCharity, ensureInvest, ensureShop, INVEST_KO, lifeBlocked, lifeCost, netWorth,
  packBlocked, packPrice, RARITY_KO, tpBlocked, type InvestKind, type LifeItem,
} from '../wealth';
import { lifeYearly } from '../money';

export interface StaffRowVM {
  id: string; name: string; role: string; tier: Tier; tierName: string; effect: string; attrs: string; salary: string; term: string;
  leaving: boolean; blocked: string | null;
}

export interface FinanceVM {
  cash: string; cashShort: string; cashRaw: number; wage: string; annual: string; net: string; netRaw: number;
  income: { label: string; value: string }[]; expense: { label: string; value: string }[]; inTotal: string; outTotal: string;
  last: { season: string; net: string; netRaw: number } | null;
  contract: { label: string; value: string }[];
  slots: number; used: number; tierName: string;
  staff: StaffRowVM[];
  scout: { cost: string; blocked: string | null; waiting: string | null };
  candidates: StaffRowVM[]; candUntil: string | null;
  ledger: { date: string; label: string; amount: string; plus: boolean }[];
  /** b (C.68b) */
  worth: string; worthShort: string; asset: number; career: string;
  shop: { idx: number; id: string; rarity: Rarity; rarityKo: string; price: string; sold: boolean; blocked: string | null; /** 가진 장수 / 최대 (C.76i 디자인 219 "샀어요 · 1/2") */ owned: number; max: number }[] | null;
  /** 등급별 가격 칩 (C.76i 디자인 219) */
  prices: { rarity: Rarity; label: string }[];
  /** 머리말 칩 "시즌 +7.1억" (한 줄) */
  netShort: string;
  pack: { price: string; left: number; per: number; blocked: string | null; cards: number };
  tp: { have: number; rare: { cost: number; blocked: string | null }; epic: { cost: number; blocked: string | null } } | null;
  life: { kind: LifeItem; title: string; cur: string; yearly: string; options: { lvl: number; name: string; price: string; effect: string; cost: string; cur: boolean; blocked: string | null; lux: boolean }[] }[];
  charity: { total: string; season: string; rep: number; cap: number; badge: boolean; toBadge: string; /** 자선가까지 진행 0~1 */ ratio: number; units: { v: number; label: string; blocked: string | null }[] };
  invest: { kinds: { kind: InvestKind; name: string; bal: string; rate: string; put: { v: number; label: string; blocked: string | null }[]; canTake: boolean }[]; deals: { label: string; amount: string }[] };
  agent: { premium: boolean; fee: string; feePremium: string; wageUp: string };
}

const seasonLabel = (s: number) => `${s}-${String((s + 1) % 100).padStart(2, '0')}`;

function row(g: GameState, s: Staff, cand: boolean): StaffRowVM {
  return {
    id: s.id, name: s.name, role: STAFF_ROLE_KO[s.role], tier: s.tier, tierName: TIER_NAMES_KO[s.tier], effect: staffEffect(s),
    attrs: s.attrs?.map(attrShort).join(' · ') ?? '', salary: `연 ${moneyLabel(s.salary)}`,
    term: cand ? `${s.years}시즌 계약` : `${seasonLabel(s.until ?? g.league.season)} 시즌까지`,
    leaving: !!s.leaving, blocked: cand ? hireBlocked(g, s) : null,
  };
}

const pct = (v: number, d = 0) => `${(v * 100).toFixed(d)}%`;

function lifeVM(g: GameState, kind: LifeItem): FinanceVM['life'][number] {
  const W = BALANCE.wealth;
  const m = ensureMoney(g);
  const list = kind === 'house' ? W.houses : W.cars;
  const cur = (kind === 'house' ? m.house : m.car) ?? 0;
  const L = W.luxury;
  return {
    kind, title: kind === 'house' ? '집' : '차', cur: list[cur]!.ko, yearly: moneyLabel(lifeYearly({ house: kind === 'house' ? cur : 0, car: kind === 'car' ? cur : 0 })),
    options: list.map((it, lvl) => {
      const rent = 'rent' in it ? it.rent : 0;
      const eff = 'recovery' in it ? (it.recovery ? `피로 회복 +${pct(it.recovery)}` : '효과 없음') : ('mental' in it && it.mental ? `멘탈 피로 주 −${it.mental}` : '효과 없음');
      const cost = lvl === cur ? 0 : lifeCost(g, kind, lvl);
      return {
        lvl, name: it.ko, cur: lvl === cur, lux: kind === 'house' ? lvl >= L.houseFrom : lvl >= L.carFrom,
        price: rent ? `연 ${moneyLabel(rent)}` : it.price ? moneyLabel(it.price) : '무료',
        effect: eff, cost: lvl === cur ? '' : cost >= 0 ? `${moneyLabel(cost)} 필요` : `${moneyLabel(-cost)} 돌려받음`,
        blocked: lvl === cur ? null : lifeBlocked(g, kind, lvl),
      };
    }),
  };
}

export type StaffVM = Pick<FinanceVM, 'slots' | 'used' | 'tierName' | 'staff' | 'scout' | 'candidates' | 'candUntil'>;

/** 코치·스태프 (C.77q: 훈련 화면 탭). 상점(ensureShop)을 건드리지 않게 재정 VM 과 따로 만든다 */
export function staffVM(g: GameState): StaffVM {
  const m = ensureMoney(g);
  return {
    slots: staffSlots(g), used: m.staff.filter((s) => !s.leaving).length, tierName: TIER_NAMES_KO[reputationTier(g.player.reputation, g.player.honors)],
    staff: m.staff.map((s) => row(g, s, false)),
    scout: { cost: moneyLabel(scoutCost(g)), blocked: m.scout ? null : scoutBlocked(g), waiting: m.scout ? `${dateLabel(m.scout.arrive)} 도착 예정 · 후보 ${m.scout.n}명` : null },
    candidates: m.candidates.map((s) => row(g, s, true)),
    candUntil: m.candUntil ? dateLabel(m.candUntil) : null,
  };
}

/** 에이전트 (C.77q: 선수 › 계약) */
export function agentVM(g: GameState): FinanceVM['agent'] {
  const W = BALANCE.wealth;
  return { premium: ensureMoney(g).agent === 'premium', fee: pct(BALANCE.money.agent), feePremium: pct(W.agentPremium.fee), wageUp: pct(W.agentPremium.wage) };
}

export function financeVM(g: GameState): FinanceVM {
  const m = ensureMoney(g);
  const w = myWage(g);
  const B = BALANCE.money;
  const f = m.season;
  const net = flowsIn(f) - flowsOut(f);
  const lh = m.history.at(-1);
  const tier = reputationTier(g.player.reputation, g.player.honors);
  const sponsor = Math.min(B.sponsorMax, annualOf(w) * B.sponsor[tier]);
  return {
    cash: moneyLabel(m.cash), cashShort: moneyShort(m.cash), cashRaw: m.cash, wage: moneyShort(w), annual: moneyShort(annualOf(w)), net: moneyLabel(net, true), netRaw: net, netShort: `${net > 0 ? '+' : ''}${moneyShort(net)}`,
    income: INCOME_CATS.filter((c) => f[c]).map((c) => ({ label: MONEY_CAT_KO[c], value: moneyLabel(f[c]!) })),
    expense: EXPENSE_CATS.filter((c) => f[c]).map((c) => ({ label: MONEY_CAT_KO[c], value: moneyLabel(-f[c]!) })),
    inTotal: moneyLabel(flowsIn(f)), outTotal: moneyLabel(flowsOut(f)),
    last: lh ? { season: seasonLabel(lh.season), net: moneyLabel(flowsIn(lh.flows) - flowsOut(lh.flows), true), netRaw: flowsIn(lh.flows) - flowsOut(lh.flows) } : null,
    contract: [
      { label: '주급', value: moneyLabel(w) },
      { label: '연봉', value: moneyLabel(annualOf(w)) },
      { label: '출전수당', value: `경기당 ${moneyLabel(Math.round(w * B.bonus.appearance))}` },
      { label: '골 보너스', value: `골당 ${moneyLabel(Math.round(w * B.bonus.goal))}` },
      { label: '우승 보너스', value: `우승마다 ${moneyLabel(Math.round(annualOf(w) * B.bonus.title))}` },
      { label: '스폰서', value: sponsor > 0 ? `시즌 끝 약 ${moneyLabel(Math.round(sponsor / 500) * 500)}` : `탑클래스 위상부터` },
      { label: '생활비', value: `주 ${moneyLabel(Math.round(w * B.living))} (연봉의 ${Math.round(B.living * 100)}%)` },
    ],
    ...staffVM(g),
    ledger: m.ledger.slice(-14).reverse().map(([date, cat, amount, note]) => ({
      date: dateLabel(date), label: `${MONEY_CAT_KO[cat]}${note ? ` · ${note}` : ''}`, amount: moneyLabel(amount, true), plus: amount > 0,
    })),
    ...wealthVM(g),
  };
}

function wealthVM(g: GameState) {
  const W = BALANCE.wealth;
  const m = ensureMoney(g);
  const worth = netWorth(g);
  const shop = ensureShop(g);
  const col = g.cards;
  const ch = ensureCharity(m);
  const iv = ensureInvest(m);
  const G = BALANCE.goals;
  return {
    worth: moneyLabel(worth), worthShort: moneyShort(worth), asset: assetScore(worth), career: moneyLabel(careerNet(g), true),
    shop: shop && col ? shop.items.map((it, idx) => {
      const r = cardById(it.id)!.rarity;
      const price = it.sold ? it.price : cardPrice(g, r);
      return { idx, id: it.id, rarity: r, rarityKo: RARITY_KO[r], price: moneyLabel(price), sold: !!it.sold, blocked: it.sold ? null : cardBlocked(g, r, price, col.owned[it.id] ?? 0), owned: col.owned[it.id] ?? 0, max: BALANCE.cards.maxCopies };
    }) : null,
    prices: ((['common', 'rare', 'epic', 'legendary'] as const)).map((r) => ({ rarity: r, label: `${RARITY_KO[r]} · ${r === 'common' ? '주급의 절반' : moneyShort(cardPrice(g, r))}` })),
    pack: { price: moneyLabel(packPrice(g)), left: Math.max(0, W.pack.perWeek - (shop?.packs ?? 0)), per: W.pack.perWeek, blocked: packBlocked(g), cards: W.pack.cards },
    tp: col ? { have: col.tp ?? 0, rare: { cost: G.tpUnlock.rare, blocked: tpBlocked(g, 'rare') }, epic: { cost: G.tpUnlock.epic, blocked: tpBlocked(g, 'epic') } } : null,
    life: [lifeVM(g, 'house'), lifeVM(g, 'car')],
    charity: {
      total: moneyLabel(ch.total), season: moneyLabel(ch.season), rep: ch.rep, cap: W.charity.seasonCap, badge: !!ch.badge,
      toBadge: moneyLabel(Math.max(0, W.charity.badge - ch.total)), ratio: Math.min(1, ch.total / W.charity.badge),
      units: W.charity.units.map((v) => ({ v, label: moneyShort(v), blocked: donateBlocked(g, v) })),
    },
    invest: {
      kinds: (['deposit', 'estate'] as InvestKind[]).map((kind) => ({
        kind, name: INVEST_KO[kind], bal: moneyLabel(iv[kind]),
        rate: kind === 'deposit' ? `연 ${pct(W.invest.deposit)}` : `연 ${pct(W.invest.estate)} ± ${pct(W.invest.estateSwing)}`,
        put: W.invest.units.map((v) => ({ v, label: moneyShort(v), blocked: g.phase === 'retired' ? '은퇴했어요' : m.cash < v ? '잔고 부족' : null })),
        canTake: iv[kind] > 0 && g.phase !== 'retired',
      })),
      deals: iv.deals.map((d) => ({ label: d.label, amount: moneyLabel(d.amount) })),
    },
    agent: agentVM(g),
  };
}
