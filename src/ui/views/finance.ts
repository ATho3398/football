// 재정 화면 (C.68a, 19번, 디자인 없음 — PC 2열·가로 폰 기준, 기존 HeroPanel·SectionTitle·OptionRow 배치 재사용)
// 탭 (C.68b → C.77q 메뉴 정리): 돈 (이번 시즌 수입/지출 · 계약 금액 · 최근 내역) · 생활·투자 (집 · 차 · 자선 · 투자 · 자산 점수)
// C.77q: 카드 상점 탭 → 상점 화면(shopView), 스태프·코치 모집 → 훈련 화면 스태프 탭(staffSection), 에이전트 → 선수 › 계약(agentSection)

import { Button, GameCard, HeroPanel, Icon, SectionTitle, Tabs, TierBadge, esc } from '../components';
import { cardById } from '../../config/cards';
import { cardSheet, gameCardData, type DeckCardVM } from './deck';
import type { FinanceVM, StaffRowVM, StaffVM } from '../financeVM';
import { designTier } from '../viewModels';
import { isWide } from '../skin';
import { panel, pc2 } from './common';

const kv = (rows: { label: string; value: string }[], cls = '') =>
  `<div class="fn-kv ${cls}">${rows.map((r) => `<div><span>${esc(r.label)}</span><b class="po-num">${esc(r.value)}</b></div>`).join('')}</div>`;

function staffCard(s: StaffRowVM, mode: 'staff' | 'cand'): string {
  const btn = mode === 'cand'
    ? Button({ size: 'sm', act: 'fn-hire', data: { v: s.id }, disabled: !!s.blocked, children: '고용' })
    : Button({ size: 'sm', variant: s.leaving ? 'secondary' : 'ghost', act: 'fn-leave', data: { v: s.id }, children: s.leaving ? '해지 취소' : '해지' });
  return `<div class="fn-staff${s.leaving ? ' is-leaving' : ''}">
    <div class="fn-staff__top">${TierBadge({ tier: designTier(s.tier), size: 'sm' })}<b>${esc(s.role)} ${esc(s.name)}</b>${btn}</div>
    <small>${esc(s.effect)}${s.attrs ? ` · ${esc(s.attrs)}` : ''}</small>
    <small class="muted po-num">${esc(s.salary)} · ${esc(s.term)}${s.leaving ? ' · 시즌 끝에 떠나요' : ''}${s.blocked ? ` · <span class="warn">${esc(s.blocked)}</span>` : ''}</small>
  </div>`;
}

export type FinanceTab = 'money' | 'life';
const TAB_KO: Record<FinanceTab, string> = { money: '돈', life: '생활·투자' };

export function financeView(vm: FinanceVM, tab: FinanceTab = 'money'): string {
  const hero = HeroPanel({
    title: '재정', back: { act: 'go', data: { to: 'home' } }, eyebrow: `잔고 · ${vm.cash}`, value: vm.cashShort, pad: false, progress: false, compact: true,
    chips: [`주급 ${vm.wage}`, `순자산 ${vm.worthShort}`, { label: `시즌 ${vm.netShort}`, soft: true }],
  });
  const tabs = Tabs({ items: (['money', 'life'] as FinanceTab[]).map((id) => ({ id, label: TAB_KO[id] })), value: tab, act: 'fn-tab', fill: true, label: '재정 탭' });
  if (tab === 'life') {
    const [l, r] = lifeTab(vm);
    return `${hero}<div class="body fn-body">${tabs}${isWide() ? pc2(l, r, 'fn-pc') : `${l}${r}`}</div>`;
  }
  const season = `${SectionTitle({ title: '이번 시즌', action: `순수입 ${vm.net}` })}
    <div class="fn-flow"><div><small class="muted">수입 ${esc(vm.inTotal)}</small>${vm.income.length ? kv(vm.income, 'is-in') : '<p class="small muted">아직 없어요.</p>'}</div>
    <div><small class="muted">지출 ${esc(vm.outTotal)}</small>${vm.expense.length ? kv(vm.expense, 'is-out') : '<p class="small muted">아직 없어요.</p>'}</div></div>
    ${vm.last ? `<p class="small muted">지난 시즌(${esc(vm.last.season)}) 순수입 <b class="po-num ${vm.last.netRaw < 0 ? 'down' : 'up'}">${esc(vm.last.net)}</b></p>` : ''}
    <p class="small muted">주급·생활비·스태프 급여는 일요일마다, 출전·골 보너스도 그때 같이 정산해요. 우승 보너스·스폰서는 시즌 끝에 들어와요.</p>`;
  const contract = `${SectionTitle({ title: '계약 금액' })}${kv(vm.contract)}
    <p class="small muted">계약금(연봉의 10% × 계약 연수)은 이적·재계약 때 받고, 에이전트 수수료가 빠져요(에이전트는 선수 › 계약).</p>`;
  const ledger = `${SectionTitle({ title: '최근 내역', ...(vm.ledger.length ? { action: `${vm.ledger.length}건` } : {}) })}${vm.ledger.length
    ? `<ul class="fn-ledger">${vm.ledger.map((e) => `<li><small class="muted">${esc(e.date)}</small><span>${esc(e.label)}</span><b class="po-num ${e.plus ? 'up' : 'down'}">${esc(e.amount)}</b></li>`).join('')}</ul>`
    : '<p class="small muted">첫 일요일에 주급이 들어와요.</p>'}`;
  if (isWide()) return `${hero}<div class="body fn-body">${tabs}${pc2(`${season}${contract}`, ledger, 'fn-pc')}</div>`;
  return `${hero}<div class="body fn-body">${tabs}${season}${contract}${ledger}</div>`;
}

// ── 코치·스태프 (C.68a → C.77q 훈련 화면 탭) ──

/** 스태프(슬롯·해지) · 코치 모집 · 후보. 훈련 화면 [코치·스태프] 탭에 들어간다 */
export function staffSection(vm: StaffVM): string {
  const staff = `${SectionTitle({ title: '스태프', action: `${vm.used}/${vm.slots} · ${vm.tierName} 위상` })}
    ${vm.staff.length ? vm.staff.map((s) => staffCard(s, 'staff')).join('') : '<p class="small muted">아직 스태프가 없어요. 코치를 모집해 보세요.</p>'}
    <p class="small muted">슬롯은 위상이 오르면 늘어요(일반 2 · 스페셜 3 · 탑클래스 4 · 월드클래스 5). 코치는 전문 능력치를 기술 훈련할 때 효과가 붙고, 의료 스태프는 부상·회복을 도와요. 급여는 주급과 같이 정산돼요. 해지하면 위약금 없이 시즌 끝에 떠나요.</p>`;
  const scout = `${SectionTitle({ title: '코치 모집', action: vm.scout.cost })}
    ${vm.scout.waiting ? `<p class="small">${esc(vm.scout.waiting)}</p>`
      : `${Button({ block: true, icon: 'search', act: 'fn-scout', disabled: !!vm.scout.blocked, children: `모집하기 · ${vm.scout.cost}` })}${vm.scout.blocked ? `<p class="small warn">${esc(vm.scout.blocked)}</p>` : '<p class="small muted">다음 주에 후보 2~3명이 와요. 이름·티어·전문 분야·급여는 랜덤이에요.</p>'}`}
    ${vm.candidates.length ? `${SectionTitle({ title: '코치 후보', action: vm.candUntil ? `${vm.candUntil}까지` : '' })}${vm.candidates.map((s) => staffCard(s, 'cand')).join('')}` : ''}`;
  return `<div class="fn-body tr-staff">${isWide() ? pc2(staff, scout, 'fn-pc') : `${vm.candidates.length ? `${scout}${staff}` : `${staff}${scout}`}`}</div>`;
}

// ── 상점 화면 (19.6 · 5.4 → C.77q 재정 탭에서 독 [상점] 화면으로) ──

/** 상점 화면. 카드(이번 주 카드 · 방금 연 카드팩)를 누르면 덱과 같은 카드 상세 시트(sheet) */
export function shopView(vm: FinanceVM, o: { lastPack?: string[]; sheet?: DeckCardVM | null } = {}): string {
  const hero = HeroPanel({
    title: '상점', back: { act: 'go', data: { to: 'home' } }, eyebrow: `잔고 · ${vm.cash}`, value: vm.cashShort, pad: false, progress: false, compact: true,
    chips: [`카드팩 ${vm.pack.left}/${vm.pack.per}`, ...(vm.tp ? [{ label: `TP ${vm.tp.have}`, soft: true }] : [])],
  });
  const sheet = o.sheet ? cardSheet({ from: 'view', card: o.sheet }, 0) : '';
  return `${hero}<div class="body fn-body sh-body">${shopTab(vm, o.lastPack ?? [])}</div>${sheet}`;
}

/** 상점 카드 한 장 (mini, 누르면 카드 상세) */
const shopCard = (id: string) => GameCard({ card: gameCardData(cardById(id)!), size: 'mini', act: 'card-open', data: { v: id, from: 'view' } });

function shopTab(vm: FinanceVM, lastPack: string[]): string {
  const cards = vm.shop
    ? `<div class="fn-shop">${vm.shop.map((c) => {
      const def = cardById(c.id)!;
      return `<div class="fn-shop__item${c.sold ? ' is-sold' : ''}">${shopCard(def.id)}
        <small class="po-num"><b>${esc(c.rarityKo)}</b> · ${esc(c.price)}</small>
        ${c.sold ? `<small class="muted fn-sold">${Icon({ name: 'check', size: 12 })}샀어요 · ${c.owned}/${c.max}</small>` : Button({ size: 'sm', block: true, act: 'fn-buy', data: { v: String(c.idx) }, disabled: !!c.blocked, children: '사기' })}
        ${!c.sold && c.blocked ? `<small class="warn">${esc(c.blocked)}</small>` : ''}</div>`;
    }).join('')}</div>`
    : '<p class="small muted">지금은 상점이 열리지 않아요.</p>';
  const prices = `<div class="fn-prices">${vm.prices.map((p) => `<span class="fn-price r-${p.rarity}">${esc(p.label)}</span>`).join('')}</div>`;
  const shop = `${SectionTitle({ title: '이번 주 카드', action: '월요일마다 바뀌어요' })}${cards}${prices}
    <p class="small muted">카드를 누르면 효과·조건을 봐요. 에픽·전설은 스페셜 · 탑클래스 · 월드클래스 위상부터 나와요. 같은 카드는 2장까지.</p>`;
  const pack = `${SectionTitle({ title: '일반 카드팩', action: `이번 주 ${vm.pack.left}/${vm.pack.per}` })}
    ${Button({ block: true, icon: 'card', act: 'fn-pack', disabled: !!vm.pack.blocked, children: `카드팩 사기 · ${vm.pack.price}` })}
    <p class="small ${vm.pack.blocked ? 'warn' : 'muted'}">${esc(vm.pack.blocked ?? `한 팩 ${vm.pack.cards}장 · 일반 위주(가끔 희귀). 에픽 이상은 상점과 시즌 목표로만 얻어요.`)}</p>
    ${lastPack.length ? `${SectionTitle({ title: '방금 연 카드팩', action: `${lastPack.length}장 · 눌러서 상세` })}${panel(`<div class="gc-grid">${lastPack.filter((id) => cardById(id)).map(shopCard).join('')}</div>`)}` : ''}`;
  const tp = vm.tp ? `${SectionTitle({ title: 'TP 카드 해금', action: `TP ${vm.tp.have}` })}
    <div class="fn-btns">${Button({ size: 'sm', variant: 'secondary', act: 'fn-tp', data: { v: 'rare' }, disabled: !!vm.tp.rare.blocked, children: `희귀 3택 1 · TP ${vm.tp.rare.cost}` })}${
      Button({ size: 'sm', variant: 'secondary', act: 'fn-tp', data: { v: 'epic' }, disabled: !!vm.tp.epic.blocked, children: `에픽 3택 1 · TP ${vm.tp.epic.cost}` })}</div>
    <p class="small muted">TP는 시즌 목표 달성으로 쌓여요(쉬움 1 · 보통 2 · 어려움 3). 해금한 선택권은 덱 화면에서 골라요. 에픽은 탑클래스 위상부터.</p>` : '';
  return `${shop}${pack}${tp}`;
}

// ── 생활·투자 탭 (19.7~19.9 · 19.11) ──

/** 긴 안내는 접기 줄 (C.76i 디자인 220) */
const fold = (head: string, body: string) => `<details class="fn-fold"><summary>${Icon({ name: 'info', size: 14 })}<span class="grow">${esc(head)}</span><span class="fn-fold__more">펼치기</span></summary><p class="small muted">${esc(body)}</p></details>`;

/** 에이전트 줄 (C.76i 디자인 220): 지금 = 라임 테두리 · 다른 쪽 [바꾸기] */
const agentRow = (name: string, desc: string, cur: boolean) => `<div class="fn-opt${cur ? ' is-cur' : ''}"><div class="fn-opt__top"><b>${esc(name)}</b>${
  cur ? '<small class="up">지금</small>' : Button({ size: 'sm', variant: 'ghost', act: 'fn-agent', children: '바꾸기' })}</div><small class="muted">${esc(desc)}</small></div>`;

function lifeTab(vm: FinanceVM): [string, string] {
  const life = vm.life.map((l) => `${SectionTitle({ title: l.title, action: `${l.cur} · 연 ${l.yearly}` })}
    ${l.options.map((o) => `<div class="fn-opt${o.cur ? ' is-cur' : ''}"><div class="fn-opt__top"><b>${esc(o.name)}</b><small class="po-num muted">${esc(o.price)}</small>${
      o.cur ? '<small class="up">지금</small>' : Button({ size: 'sm', variant: 'ghost', act: 'fn-life', data: { v: `${l.kind}:${o.lvl}` }, disabled: !!o.blocked, children: '바꾸기' })}</div>
      <small class="muted">${esc(o.effect)}${o.cost ? ` · ${esc(o.cost)}` : ''}${o.lux ? ' · 사치품(언론 논란 위험)' : ''}${!o.cur && o.blocked ? ` · <span class="warn">${esc(o.blocked)}</span>` : ''}</small></div>`).join('')}`).join('');
  const lifeNote = fold('집·차 효과 · 되팔기 · 유지비', '집·차는 효과가 작아요(피로 회복 · 멘탈 피로). 바꾸면 쓰던 것은 팔아요(집 70% · 차 50%). 유지비(집 5% · 차 10%)와 월세는 주 정산에 같이 빠져요.');
  const c = vm.charity;
  const charity = `${SectionTitle({ title: '자선', action: c.badge ? '자선가' : `누적 ${c.total}` })}
    <div class="fn-btns">${c.units.map((u) => Button({ size: 'sm', variant: 'secondary', act: 'fn-donate', data: { v: String(u.v) }, disabled: !!u.blocked, children: `${u.label} 기부` })).join('')}</div>
    ${c.badge ? '' : `<div class="fn-goal"><span class="small">"자선가"까지</span><small class="muted">남은 <b class="po-num">${esc(c.toBadge)}</b></small></div><div class="mg-trustbar fn-goal__bar"><i style="width:${Math.round(c.ratio * 100)}%"></i></div>`}
    <p class="small muted">1억마다 위상 +1(시즌 상한 +${c.cap}, 이번 시즌 +${c.rep}). 누적 100억이면 "자선가"${c.badge ? ' — 받았어요' : `(남은 ${esc(c.toBadge)})`}.</p>`;
  const invest = `${SectionTitle({ title: '투자', action: '시즌 끝 정산' })}
    ${vm.invest.kinds.map((k) => `<div class="fn-opt"><div class="fn-opt__top"><b>${esc(k.name)}</b><small class="po-num">${esc(k.bal)}</small><small class="muted">${esc(k.rate)}</small></div>
      <div class="fn-btns">${k.put.map((p) => Button({ size: 'sm', variant: 'ghost', act: 'fn-invest', data: { v: `${k.kind}:${p.v}` }, disabled: !!p.blocked, children: `+${p.label}` })).join('')}${
        Button({ size: 'sm', variant: 'ghost', act: 'fn-invest', data: { v: `${k.kind}:-all` }, disabled: !k.canTake, children: '모두 빼기' })}</div></div>`).join('')}
    ${vm.invest.deals.length ? `<div class="fn-kv">${vm.invest.deals.map((d) => `<div><span>${esc(d.label)}</span><b class="po-num">${esc(d.amount)}</b></div>`).join('')}</div>` : ''}
    <p class="small muted">예금은 안전, 부동산은 해마다 오르내려요. 사업 투자 제안은 인박스로 와요(손해는 투자금 안에서만).</p>`;
  const asset = `${SectionTitle({ title: '자산', action: `엔딩 자산 점수 ${vm.asset}` })}
    <div class="fn-kv"><div><span>순자산</span><b class="po-num">${esc(vm.worth)}</b></div><div><span>커리어 순수입</span><b class="po-num">${esc(vm.career)}</b></div></div>
    ${fold('순자산 = 잔고 + 투자 + 집 매각가 · 자산 점수 구간', '은퇴하면 커리어 요약에 자산 점수(순자산 20억 44 · 100억 66 · 300억 82)가 남아요.')}`;
  return [`${asset}${life}${lifeNote}`, `${charity}${invest}`];
}

/** 에이전트 (C.76i 디자인 220 → C.77q 선수 › 계약 탭): 일반 / 고급 두 줄 */
export function agentSection(a: FinanceVM['agent']): string {
  return `${SectionTitle({ title: '에이전트', action: a.premium ? '고급' : '일반' })}
    ${agentRow('일반 에이전트', `수수료 ${a.fee}`, !a.premium)}${agentRow('고급 에이전트', `새 계약 주급 +${a.wageUp} · 수수료 ${a.feePremium} · 다음 계약부터 적용돼요`, a.premium)}
    <p class="small muted">계약금에서 에이전트 수수료가 빠져요.</p>`;
}
