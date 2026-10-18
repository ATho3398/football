// 재정 화면 VM (C.68a, 19번): 잔고 · 이번 시즌 수입/지출 · 계약 금액 · 스태프(슬롯·해지) · 코치 모집·후보 · 최근 내역

import { dateLabel } from '../calendar';
import type { GameState } from '../game';
import { TIER_NAMES_KO, reputationTier } from '../growth';
import {
  annualOf, ensureMoney, EXPENSE_CATS, flowsIn, flowsOut, hireBlocked, INCOME_CATS, MONEY_CAT_KO, moneyLabel, moneyShort, myWage,
  scoutBlocked, scoutCost, staffEffect, staffSlots, STAFF_ROLE_KO, attrShort, type Staff,
} from '../money';
import { BALANCE } from '../config/balance';
import type { Tier } from '../types';

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
    cash: moneyLabel(m.cash), cashShort: moneyShort(m.cash), cashRaw: m.cash, wage: moneyShort(w), annual: moneyShort(annualOf(w)), net: moneyLabel(net, true), netRaw: net,
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
    slots: staffSlots(g), used: m.staff.filter((s) => !s.leaving).length, tierName: TIER_NAMES_KO[tier],
    staff: m.staff.map((s) => row(g, s, false)),
    scout: { cost: moneyLabel(scoutCost(g)), blocked: m.scout ? null : scoutBlocked(g), waiting: m.scout ? `${dateLabel(m.scout.arrive)} 도착 예정 · 후보 ${m.scout.n}명` : null },
    candidates: m.candidates.map((s) => row(g, s, true)),
    candUntil: m.candUntil ? dateLabel(m.candUntil) : null,
    ledger: m.ledger.slice(-14).reverse().map(([date, cat, amount, note]) => ({
      date: dateLabel(date), label: `${MONEY_CAT_KO[cat]}${note ? ` · ${note}` : ''}`, amount: moneyLabel(amount, true), plus: amount > 0,
    })),
  };
}
