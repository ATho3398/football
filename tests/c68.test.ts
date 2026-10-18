// C.68a (40단계 5-7 a): 개인 재정 — 통화 표기 · 주 정산(주급·생활비·스태프 급여·출전/골 보너스) · 비시즌 몫 · 계약금·에이전트 수수료 ·
// 우승 보너스·스폰서 · 스태프 슬롯 · 코치 모집(다음 주 후보) · 고용/해지 · 코치 효과(D.13: 기술 훈련 게이지·XP 배율, 한계, 상한) · 의료 효과 · 세이브 38
import { describe, expect, it } from 'vitest';
import { addDays, weekday } from '../src/calendar';
import { BALANCE } from '../src/config/balance';
import { endDay, isMatchDay, newGame, playOthers, playRound, SAVE_FORMAT_VERSION, startNextSeason, autoMarket, type GameState } from '../src/game';
import { rollInjury } from '../src/injury';
import {
  agentFee, coachBoost, ensureMoney, flowsIn, hireStaff, injuryChanceMul, injuryDaysMul, moneyLabel, moneyShort, myWage, onContractSigned,
  scoutBlocked, signingBonus, staffRecoveryMul, staffSlots, startScout, toggleLeave, type Staff,
} from '../src/money';
import { createRng } from '../src/rng';
import { deserialize, serialize } from '../src/save';
import { gaugeNeed, techDay } from '../src/training';
import { financeVM } from '../src/ui/financeVM';
import { financeView } from '../src/ui/views/finance';

const prospect = (seed: string): GameState => newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });

/** 오늘(시즌 중)부터 n 일 진행 (경기 날이면 경기) */
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

const coach = (tier: Staff['tier'], attrs: Staff['attrs'], id = 'c1'): Staff => ({ id, name: '코치', tier, role: 'coach', attrs, salary: 500, years: 1, until: 9999 });

describe('통화 표기', () => {
  it('만 원 정수 → 한국식', () => {
    expect(moneyLabel(500)).toBe('500만 원');
    expect(moneyLabel(12000)).toBe('1억 2,000만 원');
    expect(moneyLabel(300000)).toBe('30억 원');
    expect(moneyLabel(-500)).toBe('−500만 원');
    expect(moneyLabel(500, true)).toBe('+500만 원');
    expect(moneyShort(15000)).toBe('1.5억');
    expect(moneyShort(3500)).toBe('3,500만');
  });
});

describe('주 정산과 시즌', () => {
  it('일요일이 끝나면 주급 − 생활비, 시즌 + 비시즌 = 52주 주급', () => {
    const g = prospect('c68-week');
    const w = myWage(g);
    expect(w).toBeGreaterThan(0);
    // 첫 일요일까지
    while (weekday(g.calendar.date) !== 0) advance(g, 1);
    const before = ensureMoney(g).cash;
    advance(g, 1);
    const m = ensureMoney(g);
    expect(m.weeks).toBe(1);
    expect(m.season.wage).toBe(w);
    expect(m.cash - before).toBe(w - Math.round((w * BALANCE.money.living) / 10) * 10 + (m.season.appearance ?? 0) + (m.season.goal ?? 0));
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    autoMarket(g, 'stay');
    startNextSeason(g);
    const h = ensureMoney(g).history.at(-1)!;
    expect(h.flows.wage).toBe(w * 52);
    expect(ensureMoney(g).weeks).toBe(0);
  });

  it('계약금 = 연봉 × 10% × 연수, 에이전트 수수료 5%, 임대는 없음', () => {
    const g = prospect('c68-sign');
    expect(signingBonus(1000, 3)).toBe(15600);
    expect(signingBonus(1000, 9)).toBe(26000);
    expect(agentFee(1000, 15600)).toBe(Math.round(((15600 + 52000) * 0.05) / 10) * 10);
    const c0 = ensureMoney(g).cash;
    onContractSigned(g, { wage: 1000, from: 2018, until: 2020 }, '재계약');
    expect(ensureMoney(g).cash - c0).toBe(15600 - agentFee(1000, 15600));
    onContractSigned(g, { wage: 1000, from: 2018, until: 2018, loan: { parent: 'ars', until: 2018 } }, '임대');
    expect(ensureMoney(g).season.signing).toBe(15600);
  });
});

describe('스태프 슬롯·모집·고용', () => {
  it('슬롯은 위상 티어별 2/3/4/5', () => {
    const g = prospect('c68-slot');
    g.player.reputation = 0;
    expect(staffSlots(g)).toBe(2);
    g.player.reputation = 1000;
    expect(staffSlots(g)).toBeGreaterThanOrEqual(5);
  });

  it('모집하면 비용을 내고 7일 뒤 후보 2~3명, 고용·슬롯·해지 → 다음 시즌 빠짐', () => {
    const g = prospect('c68-scout');
    ensureMoney(g).cash = 100000;
    expect(scoutBlocked(g)).toBeNull();
    expect(startScout(g)).toBe(true);
    expect(scoutBlocked(g)).not.toBeNull();
    expect(ensureMoney(g).season.scout).toBeLessThan(0);
    advance(g, 6);
    expect(ensureMoney(g).candidates).toHaveLength(0);
    advance(g, 1);
    const m = ensureMoney(g);
    expect(m.candidates.length).toBeGreaterThanOrEqual(2);
    expect(m.candidates.length).toBeLessThanOrEqual(3);
    for (const c of m.candidates) {
      expect(c.salary % BALANCE.staff.salaryUnit).toBe(0);
      if (c.role === 'coach') expect(c.attrs!.length).toBe(Math.min(BALANCE.staff.coach.range[c.tier], c.attrs!.length));
    }
    expect(g.inbox!.items.some((i) => i.cat === 'money')).toBe(true);
    // 같은 시드면 같은 후보
    const g2 = prospect('c68-scout');
    ensureMoney(g2).cash = 100000;
    startScout(g2);
    advance(g2, 7);
    expect(ensureMoney(g2).candidates).toEqual(m.candidates);
    // 고용 (슬롯 2)
    g.player.reputation = 0;
    const ids = m.candidates.map((c) => c.id);
    expect(hireStaff(g, ids[0]!)).toBe(true);
    expect(hireStaff(g, ids[1]!)).toBe(true);
    if (ids[2]) expect(hireStaff(g, ids[2])).toBe(false);
    expect(m.staff).toHaveLength(2);
    expect(toggleLeave(g, m.staff[0]!.id)).toBe(true);
    const leaving = m.staff[0]!.id;
    while (g.phase === 'season') playRound(g, { engine: 'quick' });
    expect(ensureMoney(g).staff.some((s) => s.id === leaving)).toBe(true);
    autoMarket(g, 'stay');
    startNextSeason(g);
    expect(ensureMoney(g).staff.some((s) => s.id === leaving)).toBe(false);
    expect(ensureMoney(g).history.at(-1)!.flows.staff).toBeLessThan(0);
  });
});

describe('코치 효과 (D.13 재설계)', () => {
  it('전문 능력치 중 한계 이하에서 가장 낮은 것이 목표, 겹치면 가산, 상한 +40%', () => {
    const g = prospect('c68-coach');
    const p = g.player;
    p.attributes.shooting = 60;
    p.attributes.heading = 50;
    p.attributes.longShots = 70;
    ensureMoney(g).staff = [coach('special', ['shooting', 'longShots'])];
    expect(coachBoost(g, p, 'finishing')).toEqual({ target: 'shooting', boost: 0.15 });
    expect(coachBoost(g, p, 'passing')).toBeNull();
    // 한계 (일반 75): 넘으면 효과 없음
    ensureMoney(g).staff = [coach('normal', ['shooting'])];
    p.attributes.shooting = 76;
    expect(coachBoost(g, p, 'finishing')).toBeNull();
    p.attributes.shooting = 60;
    ensureMoney(g).staff = [coach('legendary', ['shooting'], 'a'), coach('worldClass', ['shooting'], 'b')];
    expect(coachBoost(g, p, 'finishing')!.boost).toBe(BALANCE.staff.coach.maxBoost);
  });

  it('기술 훈련 게이지: 코치 목표 능력치가 오르고, 배율만큼 빨리 찬다', () => {
    const g = prospect('c68-gauge');
    const p = g.player;
    const t = g.training;
    p.attributes.shooting = 60;
    p.attributes.heading = 40;
    const need = gaugeNeed(p, 'finishing', 'shooting');
    t.gauges.finishing = need - 1.1;
    expect(techDay(t, p, 'finishing', 1, 'shooting')).toBeUndefined();
    t.gauges.finishing = need - 1.1;
    expect(techDay(t, p, 'finishing', 1.2, 'shooting')).toBe('shooting');
    expect(p.attributes.shooting).toBe(61);
    expect(p.attributes.heading).toBe(40);
  });

  it('하루 진행: 코치가 있으면 그 묶음 기술 훈련 XP·게이지가 늘고 훈련 결과에 코치 배율', () => {
    const run = (withCoach: boolean) => {
      const g = prospect('c68-day');
      g.training.focus = 'finishing';
      if (withCoach) ensureMoney(g).staff = [coach('topClass', ['shooting', 'heading'])];
      advance(g, 28);
      return { xp: g.training.season.xp, gauge: g.training.gauges.finishing + (g.training.seasonUps.finishing ?? 0) * 1000 };
    };
    const a = run(false);
    const b = run(true);
    expect(b.xp).toBeGreaterThan(a.xp);
    expect(b.gauge).toBeGreaterThan(a.gauge);
  });
});

describe('의료 효과', () => {
  it('팀 닥터 = 부상 확률 −, 물리치료사 = 기간 −, 영양사 = 회복 + (같은 종류는 가장 높은 것)', () => {
    const g = prospect('c68-med');
    const m = ensureMoney(g);
    m.staff = [
      { id: 'd', name: 'D', tier: 'special', role: 'doctor', salary: 500, years: 1 },
      { id: 'p', name: 'P', tier: 'legendary', role: 'physio', salary: 500, years: 1 },
      { id: 'p2', name: 'P2', tier: 'normal', role: 'physio', salary: 500, years: 1 },
      { id: 'n', name: 'N', tier: 'normal', role: 'nutrition', salary: 500, years: 1 },
    ];
    expect(injuryChanceMul(g)).toBeCloseTo(1 - BALANCE.staff.medical.doctor.special);
    expect(injuryDaysMul(g)).toBeCloseTo(1 - BALANCE.staff.medical.physio.legendary);
    expect(staffRecoveryMul(g)).toBeCloseTo(1 + BALANCE.staff.medical.nutrition.normal);
    // 확률 0 이면 다치지 않고, 같은 rng 면 기간이 줄어든다
    const p = { ...g.player, fatigue: 100 };
    expect(rollInjury({ ...p }, 90, 'hard', 10, { season: 2018, round: 1 }, createRng(1), 0)).toBeNull();
    let full = null;
    let seed = 0;
    for (; seed < 5000 && !full; seed++) full = rollInjury({ ...p }, 90, 'hard', 10, { season: 2018, round: 1 }, createRng(seed));
    const cut = rollInjury({ ...p }, 90, 'hard', 10, { season: 2018, round: 1 }, createRng(seed - 1), 1, 0.5)!;
    expect(full).not.toBeNull();
    if (full!.grade !== 'seasonEnding') expect(cut.daysTotal).toBe(Math.max(1, Math.round(full!.daysTotal * 0.5)));
  });
});

describe('재정 화면·세이브 38', () => {
  it('VM·화면이 그려지고, 세이브 왕복 · 37 세이브(재정 없음)는 잔고 0 으로 시작', () => {
    const g = prospect('c68-ui');
    advance(g, 10);
    startScout(g);
    const vm = financeVM(g);
    expect(vm.cashRaw).toBe(ensureMoney(g).cash);
    expect(vm.contract.length).toBeGreaterThan(4);
    const html = financeView(vm);
    expect(html).toContain('재정');
    expect(html).toContain('코치 모집');
    expect(SAVE_FORMAT_VERSION).toBe(38);
    expect(deserialize(serialize(g)).money).toEqual(g.money);
    const raw = JSON.parse(serialize(g));
    raw.saveFormat = 37;
    delete raw.money;
    const old = deserialize(JSON.stringify(raw));
    expect(old.money).toBeUndefined();
    advance(old, 8);
    expect(ensureMoney(old).cash).toBeGreaterThan(0);
    expect(flowsIn(ensureMoney(old).season)).toBeGreaterThan(0);
  });
});
