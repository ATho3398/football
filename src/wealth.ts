// 재정 b (19.6~19.9 · 19.11, 부록 C.68b): 카드 상점(매주)·일반 카드팩(주당 한도)·TP 카드 해금(5.4)·생활(집·차, 사치 리스크)·
// 자선(위상 +, 시즌 상한, 자선가)·투자(예금·부동산·이벤트형)·엔딩 자산 점수. 돈은 money.ts 의 잔고·내역(book)을 쓴다.
// 돈으로 능력치를 직접 사지 않는다 (19.1): 카드는 경기 카드, 집·차는 피로 회복·멘탈 피로만 작게. 수치는 BALANCE.wealth

import { addDays, weekday, type IsoDate } from './calendar';
import { addOwned, groupOfPosition, grantTierPick, poolFor } from './cardCollection';
import { BALANCE } from './config/balance';
import { cardById, type Rarity } from './config/cards';
import type { GameState } from './game';
import { reputationTier } from './growth';
import { pushInbox } from './inbox';
import { addLife } from './life';
import { book, ensureMoney, flowsIn, flowsOut, moneyLabel, myWage, type Deal, type MoneyState } from './money';
import { createRng, hashSeed, type Rng } from './rng';

const W = () => BALANCE.wealth;
const TIER_ORDER = ['normal', 'special', 'topClass', 'worldClass', 'legendary'] as const;
const round = (v: number, unit: number): number => Math.round(v / unit) * unit;
const rngOf = (state: GameState, ...parts: (string | number)[]): Rng => createRng(hashSeed([state.worldSeed, 'wealth', ...parts].join(':')));

/** 위상 티어 순번 (0 일반 ~ 4 레전더리) */
export const tierIndex = (state: GameState): number => TIER_ORDER.indexOf(reputationTier(state.player.reputation, state.player.honors));

/** 그 주 월요일 */
export function weekOf(d: IsoDate): IsoDate {
  return addDays(d, -((weekday(d) + 6) % 7));
}

// ── 카드 상점 · 카드팩 (19.6) ──

export const RARITY_KO: Record<Rarity, string> = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' };
const RARITY_DOWN: Record<Rarity, Rarity | null> = { legendary: 'epic', epic: 'rare', rare: 'common', common: null };

/** 일반 카드 가격 = 주급 × 0.5, 카드팩 = 주급 × 1 (500만 원 단위, 최소 500만 원) */
const wagePrice = (state: GameState, k: number): number => Math.max(500, round(myWage(state) * k, 500));
export const packPrice = (state: GameState): number => wagePrice(state, W().pack.price);

export function cardPrice(state: GameState, r: Rarity): number {
  return r === 'common' ? wagePrice(state, W().shop.commonPrice) : W().shop.price[r];
}

/** 이번 주 상점 (없거나 지난주 것이면 새로, 시드 = 세계 · 그 주 월요일) */
export function ensureShop(state: GameState): NonNullable<MoneyState['shop']> | null {
  if (!state.cards || state.phase === 'retired') return null;
  const m = ensureMoney(state);
  const week = weekOf(state.calendar.date);
  if (m.shop?.week === week) return m.shop;
  const rng = rngOf(state, 'shop', week);
  const S = W().shop;
  const n = S.size[0] + Math.floor(rng() * (S.size[1] - S.size[0] + 1));
  const col = state.cards;
  const g = groupOfPosition(state.player.position);
  const ids: string[] = [];
  const tot = Object.values(S.weights).reduce((t, w) => t + w, 0);
  for (let k = 0; k < n; k++) {
    let x = rng() * tot;
    let r: Rarity | null = (Object.keys(S.weights) as Rarity[]).find((key) => (x -= S.weights[key]) < 0) ?? 'common';
    let got: string | undefined;
    while (r && !got) {
      const pool = poolFor(g, [r]).filter((c) => (col.owned[c.id] ?? 0) < BALANCE.cards.maxCopies && !ids.includes(c.id));
      got = pool.length ? pool[Math.floor(rng() * pool.length)]!.id : undefined;
      r = RARITY_DOWN[r];
    }
    if (got) ids.push(got);
  }
  m.shop = { week, items: ids.map((id) => ({ id, price: 0 })), packs: 0 };
  return m.shop;
}

/** 상점 카드를 살 수 없는 이유 (없으면 null) */
export function cardBlocked(state: GameState, rarity: Rarity, price: number, owned: number): string | null {
  const req = W().shop.tierReq[rarity];
  if (tierIndex(state) < req) return `${['일반', '스페셜', '탑클래스', '월드클래스'][req]} 위상부터`;
  if (owned >= BALANCE.cards.maxCopies) return `이미 ${BALANCE.cards.maxCopies}장`;
  if (ensureMoney(state).cash < price) return '잔고가 모자라요';
  return null;
}

/** 상점 카드 사기 */
export function buyShopCard(state: GameState, idx: number): boolean {
  const shop = ensureShop(state);
  const it = shop?.items[idx];
  const rarity = it && cardById(it.id)?.rarity;
  if (!shop || !it || !rarity || it.sold || !state.cards) return false;
  const price = cardPrice(state, rarity);
  if (cardBlocked(state, rarity, price, state.cards.owned[it.id] ?? 0)) return false;
  book(state, 'card', -price, RARITY_KO[rarity]);
  addOwned(state.cards, it.id);
  it.sold = 1;
  it.price = price;
  return true;
}

export function packBlocked(state: GameState): string | null {
  const shop = ensureShop(state);
  if (!shop) return '지금은 살 수 없어요';
  if (shop.packs >= W().pack.perWeek) return `이번 주 한도 ${W().pack.perWeek}팩을 다 샀어요`;
  if (ensureMoney(state).cash < packPrice(state)) return '잔고가 모자라요';
  return null;
}

/** 일반 카드팩: 장마다 일반(가끔 희귀), 2장 다 가진 카드는 빼고. 받은 카드 id */
export function buyPack(state: GameState): string[] {
  if (packBlocked(state) || !state.cards) return [];
  const shop = ensureShop(state)!;
  const P = W().pack;
  const rng = rngOf(state, 'pack', shop.week, shop.packs);
  const g = groupOfPosition(state.player.position);
  const got: string[] = [];
  for (let k = 0; k < P.cards; k++) {
    const r: Rarity = rng() < P.rareChance ? 'rare' : 'common';
    const pool = poolFor(g, [r]).filter((c) => (state.cards!.owned[c.id] ?? 0) < BALANCE.cards.maxCopies);
    const fallback = pool.length ? pool : poolFor(g, ['common', 'rare']).filter((c) => (state.cards!.owned[c.id] ?? 0) < BALANCE.cards.maxCopies);
    if (!fallback.length) break;
    const id = fallback[Math.floor(rng() * fallback.length)]!.id;
    addOwned(state.cards, id);
    got.push(id);
  }
  book(state, 'card', -packPrice(state), '카드팩');
  shop.packs++;
  return got;
}

// ── TP 카드 해금 (5.4 · 5.5) ──

export type TpKind = 'rare' | 'epic';

export function tpBlocked(state: GameState, kind: TpKind): string | null {
  const G = BALANCE.goals;
  const col = state.cards;
  if (!col || state.phase === 'retired') return '지금은 쓸 수 없어요';
  if ((col.tp ?? 0) < G.tpUnlock[kind]) return `TP ${G.tpUnlock[kind]} 필요`;
  if (kind === 'epic' && tierIndex(state) < G.tpEpicTier) return '탑클래스 위상부터';
  return null;
}

/** TP 로 카드 3택 1 선택권 (덱 화면에서 고른다) */
export function useTp(state: GameState, kind: TpKind): boolean {
  if (tpBlocked(state, kind)) return false;
  const col = state.cards!;
  const n = col.tpUsed ?? 0;
  const ok = grantTierPick(col, `tp:${n}`, state.player.position, state.worldSeed, `TP 카드 해금 · ${RARITY_KO[kind]}`, { [kind]: 1 }, 'goal');
  if (!ok) return false;
  col.tp = (col.tp ?? 0) - BALANCE.goals.tpUnlock[kind];
  col.tpUsed = n + 1;
  return true;
}

// ── 생활: 집 · 차 (19.7) ──

export type LifeItem = 'house' | 'car';

const itemList = (k: LifeItem) => (k === 'house' ? W().houses : W().cars);

/** 바꾸는 비용 = 새 구매가 − 지금 것 매각가 (월세·숙소는 0). 음수면 0 (돈을 돌려받지 않는 단순화는 하지 않는다: 낮추면 차액을 받는다) */
export function lifeCost(state: GameState, k: LifeItem, lvl: number): number {
  const m = ensureMoney(state);
  const cur = k === 'house' ? m.house ?? 0 : m.car ?? 0;
  const list = itemList(k);
  const resale = k === 'house' ? W().houseResale : W().carResale;
  return list[lvl]!.price - round(list[cur]!.price * resale, 500);
}

export function lifeBlocked(state: GameState, k: LifeItem, lvl: number): string | null {
  const m = ensureMoney(state);
  const cur = k === 'house' ? m.house ?? 0 : m.car ?? 0;
  if (state.phase === 'retired') return '은퇴했어요';
  if (lvl === cur) return '지금 쓰는 것';
  if (lvl < 0 || lvl >= itemList(k).length) return '없는 단계';
  const cost = lifeCost(state, k, lvl);
  if (cost > 0 && m.cash < cost) return '잔고가 모자라요';
  return null;
}

/** 집·차 바꾸기: 살던 것은 매각가로 팔고 새 것을 산다. 사치품이면 사치 리스크(언론 논란) */
export function setLife(state: GameState, k: LifeItem, lvl: number): boolean {
  if (lifeBlocked(state, k, lvl)) return false;
  const m = ensureMoney(state);
  const it = itemList(k)[lvl]!;
  const cost = lifeCost(state, k, lvl);
  book(state, 'life', -cost, `${it.ko}${cost < 0 ? ' (팔고 옮김)' : ''}`);
  if (k === 'house') m.house = lvl;
  else m.car = lvl;
  const L = W().luxury;
  const lux = k === 'house' ? lvl >= L.houseFrom : lvl >= L.carFrom;
  if (lux && state.events && rngOf(state, 'lux', state.calendar.date, k, lvl)() < L.chance) {
    state.events.queue.push({ id: 'n_luxuryBuy', date: addDays(state.calendar.date, L.days) });
  }
  return true;
}

/** 이번 주 차 효과 (일요일, wealthDayEnd): 멘탈 피로 − */
function weeklyLife(state: GameState): void {
  const c = W().cars[state.money?.car ?? 0]!;
  if (c.mental) addLife(state, 'mental', -c.mental);
}

// ── 자선 (19.8) ──

export function ensureCharity(m: MoneyState): NonNullable<MoneyState['charity']> {
  return (m.charity ??= { total: 0, season: 0, rep: 0 });
}

export function donateBlocked(state: GameState, amount: number): string | null {
  if (state.phase === 'retired') return '은퇴했어요';
  if (ensureMoney(state).cash < amount) return '잔고가 모자라요';
  return null;
}

/** 기부: 이번 시즌 기부 1억마다 위상 +1 (시즌 상한 30). 누적 100억이면 자선가. 받은 위상 */
export function donate(state: GameState, amount: number, why = '자선 기부'): number {
  if (donateBlocked(state, amount)) return 0;
  const m = ensureMoney(state);
  const c = ensureCharity(m);
  const C = W().charity;
  book(state, 'charity', -amount, why);
  c.total += amount;
  c.season += amount;
  const want = Math.min(C.seasonCap, Math.floor(c.season / C.perRep));
  const d = Math.max(0, want - c.rep);
  if (d) {
    c.rep += d;
    state.player.reputation = Math.min(BALANCE.reputation.max, state.player.reputation + d);
  }
  checkCharityBadge(state);
  return d;
}

/** 이벤트 기부 (s_charity 기부만): 누적(자선가)에만 넣는다 — 위상은 이벤트 효과가 따로 준다 */
export function eventCharity(state: GameState, amount: number): void {
  ensureCharity(ensureMoney(state)).total += amount;
  checkCharityBadge(state);
}

function checkCharityBadge(state: GameState): void {
  const c = ensureCharity(ensureMoney(state));
  if (c.badge || c.total < W().charity.badge) return;
  c.badge = state.league.season;
  pushInbox(state, {
    cat: 'money', key: 'charity-badge', title: '자선가',
    body: `누적 기부 ${moneyLabel(c.total)}. 재단이 "자선가" 배지를 보냈어요. 은퇴 커리어 요약에 남아요.`, link: { to: 'finance', label: '재정 보기' },
  });
}

// ── 투자 (19.9) ──

export function ensureInvest(m: MoneyState): NonNullable<MoneyState['invest']> {
  return (m.invest ??= { deposit: 0, estate: 0, deals: [] });
}

export type InvestKind = 'deposit' | 'estate';
export const INVEST_KO: Record<InvestKind, string> = { deposit: '예금', estate: '부동산' };

/** 넣기 (amount > 0) · 빼기 (amount < 0, −Infinity = 전부). 실제로 옮긴 금액 */
export function moveInvest(state: GameState, kind: InvestKind, amount: number): number {
  if (state.phase === 'retired') return 0;
  const m = ensureMoney(state);
  const iv = ensureInvest(m);
  const a = amount > 0 ? Math.min(amount, Math.max(0, m.cash)) : -Math.min(-amount, iv[kind]);
  if (!a || (amount > 0 && a < amount)) return 0;
  iv[kind] += a;
  book(state, 'saving', -a, `${INVEST_KO[kind]} ${a > 0 ? '넣기' : '빼기'}`);
  return a;
}

/** 이벤트형 투자 제안 (일요일, 시즌 offerWeek 주째): 잔고 minCash 이상이면 offerChance 로 인박스 선택형 (n_investDeal) */
function maybeOfferDeal(state: GameState): void {
  const I = W().invest;
  const m = ensureMoney(state);
  const iv = ensureInvest(m);
  const season = state.league.season;
  if (iv.offered === season || !state.events || state.phase !== 'season') return;
  const rng = rngOf(state, 'deal', season);
  const week = I.offerWeek[0] + Math.floor(rng() * (I.offerWeek[1] - I.offerWeek[0] + 1));
  if (m.weeks !== week) return;
  iv.offered = season;
  if (rng() >= I.offerChance || m.cash < I.minCash) return;
  const amount = Math.max(10000, Math.min(I.max, round(m.cash * I.share, 10000)));
  const tot = I.outcomes.reduce((t, [, w]) => t + w, 0);
  let x = rng() * tot;
  const mult = I.outcomes.find(([, w]) => (x -= w) < 0)?.[0] ?? 1;
  const labels = ['친구의 레스토랑 사업', '스포츠 의류 스타트업', '고향 풋살장 건립', '선수 출신 선배의 축구 아카데미', '에너지 음료 브랜드'];
  iv.offer = { label: labels[Math.floor(rng() * labels.length)]!, amount, mult, season };
  state.events.queue.push({ id: 'n_investDeal', date: state.calendar.date });
}

/** 제안 받기 (이벤트 효과 { invest: 'deal' }): 투자금을 빼서 시즌 끝 정산 목록에 */
export function acceptDeal(state: GameState): string | null {
  const m = ensureMoney(state);
  const iv = ensureInvest(m);
  const o = iv.offer;
  iv.offer = null;
  if (!o || m.cash < o.amount) return null;
  book(state, 'saving', -o.amount, o.label);
  iv.deals.push(o);
  return `${moneyLabel(o.amount)} 투자`;
}

export const declineDeal = (state: GameState): void => {
  if (state.money?.invest) state.money.invest.offer = null;
};

/** 시즌 끝: 예금·부동산 수익(잔고로), 이벤트형 투자 정산. 인박스 한 줄 */
function settleInvest(state: GameState): void {
  const m = ensureMoney(state);
  const iv = m.invest;
  if (!iv) return;
  const I = W().invest;
  const season = state.league.season;
  const lines: string[] = [];
  const dep = Math.round(iv.deposit * I.deposit);
  if (dep) {
    book(state, 'invest', dep, '예금 이자');
    lines.push(`예금 이자 ${moneyLabel(dep, true)}`);
  }
  if (iv.estate) {
    const rate = I.estate + (rngOf(state, 'estate', season)() * 2 - 1) * I.estateSwing;
    const e = Math.round(iv.estate * rate);
    book(state, 'invest', e, `부동산 ${(rate * 100).toFixed(1)}%`);
    lines.push(`부동산 ${moneyLabel(e, true)} (${(rate * 100).toFixed(1)}%)`);
  }
  for (const d of iv.deals) {
    const back = Math.round(d.amount * d.mult);
    book(state, 'saving', d.amount, `${d.label} 정산`);
    book(state, 'invest', back - d.amount, d.label);
    lines.push(`${d.label} ${d.mult === 0 ? '실패 — 투자금을 잃었어요' : `${moneyLabel(back - d.amount, true)} (×${d.mult})`}`);
  }
  iv.deals = [];
  if (lines.length) pushInbox(state, { cat: 'money', key: `invest:${season}`, title: '투자 정산', body: `${lines.join(' · ')}.`, link: { to: 'finance', label: '재정 보기' } });
}

// ── 순자산 · 엔딩 자산 점수 (19.11) ──

/** 순자산 = 잔고 + 예금 + 부동산 + 정산 전 투자 + 집 매각가 */
export function netWorth(state: Pick<GameState, 'money'>): number {
  const m = state.money;
  if (!m) return 0;
  const iv = m.invest;
  const house = round(W().houses[m.house ?? 0]!.price * W().houseResale, 500);
  return m.cash + (iv ? iv.deposit + iv.estate + iv.deals.reduce((t, d) => t + d.amount, 0) : 0) + house;
}

/** 엔딩 자산 점수 = clamp(33 × log10(순자산(억) + 1), 0, 100) */
export function assetScore(worth: number): number {
  const eok = Math.max(0, worth) / 10000;
  return Math.max(0, Math.min(100, Math.round(W().assetScoreK * Math.log10(eok + 1))));
}

/** 커리어 누적 순수입 (지난 시즌들 + 이번 시즌) */
export function careerNet(state: Pick<GameState, 'money'>): number {
  const m = state.money;
  if (!m) return 0;
  return [...m.history.map((h) => h.flows), m.season].reduce((t, f) => t + flowsIn(f) - flowsOut(f), 0);
}

/** 엔딩 점수 훅 (18.11 명예의 전당, 19.8): 자산 · 자선 · 위상 */
export function endingScores(state: GameState): { worth: number; asset: number; charity: number; philanthropist: boolean; reputation: number } {
  const c = state.money?.charity;
  const worth = netWorth(state);
  return { worth, asset: assetScore(worth), charity: c?.total ?? 0, philanthropist: !!c?.badge, reputation: state.player.reputation };
}

// ── 하루·시즌 훅 (game.ts) ──

/** 하루 끝 (moneyDayEnd 뒤): 일요일이면 차 효과, 투자 제안 */
export function wealthDayEnd(state: GameState, ended: IsoDate): void {
  if (weekday(ended) !== 0 || !state.money) return;
  weeklyLife(state);
  maybeOfferDeal(state);
}

/** 시즌 끝 (moneySeasonEnd 뒤): 투자 정산 */
export function wealthSeasonEnd(state: GameState): void {
  settleInvest(state);
}

/** 새 시즌 (moneySeasonStart 뒤): 이번 시즌 기부·위상 셈 다시 */
export function wealthSeasonStart(state: GameState): void {
  const c = state.money?.charity;
  if (c) {
    c.season = 0;
    c.rep = 0;
  }
}

/**
 * 측정용 지출 정책 (npm run balance 의 [C.68 재정] 코치 풀 투자 줄만 — 화면에서는 쓰지 않는다): 평범한 선수의 지출.
 * 시즌 시작 때 잔고가 다음 집 값의 houseCash 배 이상이면 이사, 차는 carCash 배. 기부 = 지난 시즌 순수입 × charityShare
 * + charityFree(억) 를 넘는 몫 × charityRich (부자일수록 더 기부, 19.11 "남은 돈은 자선·투자·사치재로"). 잔고에서 연봉 1년치를 남기고 나머지 investShare 를 예금·부동산 반반
 */
export const AUTO_SPEND = { houseCash: 2, carCash: 3, charityShare: 0.05, charityFree: 150000, charityRich: 0.6, investShare: 0.2 };

export function autoSpend(state: GameState): void {
  const m = ensureMoney(state);
  const A = AUTO_SPEND;
  for (const k of ['house', 'car'] as const) {
    const cur = (k === 'house' ? m.house : m.car) ?? 0;
    const next = cur + 1;
    if (next < itemList(k).length && m.cash >= itemList(k)[next]!.price * (k === 'house' ? A.houseCash : A.carCash)) setLife(state, k, next);
  }
  const h = m.history.at(-1);
  const net = h ? flowsIn(h.flows) - flowsOut(h.flows) : 0;
  const give = Math.floor((net * A.charityShare + Math.max(0, net - A.charityFree) * A.charityRich) / 10000) * 10000;
  if (give > 0 && m.cash >= give) donate(state, give);
  const spare = m.cash - myWage(state) * 52;
  if (spare > 20000) {
    const put = round((spare * A.investShare) / 2, 10000);
    if (put > 0) {
      moveInvest(state, 'deposit', put);
      moveInvest(state, 'estate', put);
    }
  }
}
