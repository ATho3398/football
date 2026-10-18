// 재정 화면 (C.68a, 19번, 디자인 없음 — PC 2열·가로 폰 기준, 기존 HeroPanel·SectionTitle·OptionRow 배치 재사용)
// 왼쪽: 이번 시즌 수입/지출 · 계약 금액 · 최근 내역 / 오른쪽: 스태프(슬롯·해지) · 코치 모집 · 후보

import { Button, HeroPanel, SectionTitle, TierBadge, esc } from '../components';
import type { FinanceVM, StaffRowVM } from '../financeVM';
import { designTier } from '../viewModels';
import { isWide } from '../skin';
import { pc2 } from './common';

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

export function financeView(vm: FinanceVM): string {
  const hero = HeroPanel({
    title: '재정', back: { act: 'go', data: { to: 'home' } }, eyebrow: `잔고 · ${vm.cash}`, value: vm.cashShort, pad: false, progress: false, compact: true,
    chips: [`주급 ${vm.wage}`, `연봉 ${vm.annual}`, { label: `이번 시즌 ${vm.net}`, soft: vm.netRaw < 0 }],
  });
  const season = `${SectionTitle({ title: '이번 시즌', action: `순수입 ${vm.net}` })}
    <div class="fn-flow"><div><small class="muted">수입 ${esc(vm.inTotal)}</small>${vm.income.length ? kv(vm.income, 'is-in') : '<p class="small muted">아직 없어요.</p>'}</div>
    <div><small class="muted">지출 ${esc(vm.outTotal)}</small>${vm.expense.length ? kv(vm.expense, 'is-out') : '<p class="small muted">아직 없어요.</p>'}</div></div>
    ${vm.last ? `<p class="small muted">지난 시즌(${esc(vm.last.season)}) 순수입 <b class="po-num ${vm.last.netRaw < 0 ? 'down' : 'up'}">${esc(vm.last.net)}</b></p>` : ''}
    <p class="small muted">주급·생활비·스태프 급여는 일요일마다, 출전·골 보너스도 그때 같이 정산해요. 우승 보너스·스폰서는 시즌 끝에 들어와요.</p>`;
  const contract = `${SectionTitle({ title: '계약 금액' })}${kv(vm.contract)}
    <p class="small muted">계약금(연봉의 10% × 계약 연수)은 이적·재계약 때 받고, 에이전트 수수료 5%가 빠져요.</p>`;
  const ledger = `${SectionTitle({ title: '최근 내역' })}${vm.ledger.length
    ? `<ul class="fn-ledger">${vm.ledger.map((e) => `<li><small class="muted">${esc(e.date)}</small><span>${esc(e.label)}</span><b class="po-num ${e.plus ? 'up' : 'down'}">${esc(e.amount)}</b></li>`).join('')}</ul>`
    : '<p class="small muted">첫 일요일에 주급이 들어와요.</p>'}`;
  const staff = `${SectionTitle({ title: '스태프', action: `${vm.used}/${vm.slots} · ${vm.tierName} 위상` })}
    ${vm.staff.length ? vm.staff.map((s) => staffCard(s, 'staff')).join('') : '<p class="small muted">아직 스태프가 없어요. 코치를 모집해 보세요.</p>'}
    <p class="small muted">슬롯은 위상이 오르면 늘어요(일반 2 · 스페셜 3 · 탑클래스 4 · 월드클래스 5). 코치는 전문 능력치를 기술 훈련할 때 효과가 붙고, 의료 스태프는 부상·회복을 도와요. 해지하면 위약금 없이 시즌 끝에 떠나요.</p>`;
  const scout = `${SectionTitle({ title: '코치 모집', action: vm.scout.cost })}
    ${vm.scout.waiting ? `<p class="small">${esc(vm.scout.waiting)}</p>`
      : `${Button({ block: true, icon: 'search', act: 'fn-scout', disabled: !!vm.scout.blocked, children: `모집하기 · ${vm.scout.cost}` })}${vm.scout.blocked ? `<p class="small warn">${esc(vm.scout.blocked)}</p>` : '<p class="small muted">다음 주에 후보 2~3명이 와요. 이름·티어·전문 분야·급여는 랜덤이에요.</p>'}`}
    ${vm.candidates.length ? `${SectionTitle({ title: '후보', action: vm.candUntil ? `${vm.candUntil}까지` : '' })}${vm.candidates.map((s) => staffCard(s, 'cand')).join('')}` : ''}`;
  const left = `${season}${contract}${ledger}`;
  const right = `${staff}${scout}`;
  if (isWide()) return `${hero}<div class="body fn-body">${pc2(left, right, 'fn-pc')}</div>`;
  return `${hero}<div class="body fn-body">${season}${staff}${scout}${contract}${ledger}</div>`;
}
