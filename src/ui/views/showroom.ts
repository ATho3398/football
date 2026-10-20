// 유니폼 교환 패널(경기 결과) · 진열실 화면 (C.76b, pending 130 ②③).
// 패널: 상대 실제 선수 목록(얼굴 · 이름 · 포지션 · 성공 확률 · 관계) → 하나 골라 요청, 결과 한 줄 대사. 경기당 1번.
// 진열실: 집 단계 칸 수만큼 진열(트로피 · 유니폼), 나머지는 보관함. [빼기] · [진열], 교환 기록

import { Avatar, Button, esc, HeroPanel, Icon, SectionTitle } from '../components';
import type { JerseyPanelVM, ShowItemVM, ShowroomVM } from '../jerseyVM';
import { panel } from './common';

export function jerseyPanel(vm: JerseyPanelVM): string {
  if (vm.done) {
    const d = vm.done;
    return `${SectionTitle({ title: '유니폼 교환', action: '경기당 1번' })}<div class="panel jx-done ${d.ok ? 'is-ok' : 'is-no'}" role="status">
      <span class="jx-done__icon">${Icon({ name: d.ok ? 'check' : 'close', size: 20 })}</span>
      <span class="grow"><b>${esc(d.name)} · ${d.ok ? '유니폼을 받았어요!' : '거절했어요'}</b><small>“${esc(d.line)}”</small></span>
      ${d.ok ? Button({ variant: 'ghost', size: 'sm', icon: 'trophy', act: 'go', data: { to: 'showroom' }, children: '진열실' }) : ''}</div>`;
  }
  const rows = vm.picks.map((p) => `<button type="button" class="jx-pick" data-act="jersey-ask" data-v="${esc(p.id)}"${p.have ? ' disabled' : ''} aria-label="${esc(p.name)}에게 유니폼 요청, 성공 확률 ${p.pct}%">
    ${Avatar({ size: 36, face: p.face, name: p.name, shape: 'square' })}
    <span class="grow jx-pick__main"><b>${esc(p.name)}</b><small>${esc(p.pos)}${p.ovr ? ` · OVR ${p.ovr}` : ''}${p.rel ? ` · ${esc(p.rel)}` : ''}${p.have ? ' · 이미 받음' : ''}</small></span>
    <span class="jx-pick__pct"><b class="po-num">${p.pct}%</b><small>성공</small></span></button>`).join('');
  return `${SectionTitle({ title: '유니폼 교환', action: `내 위상 ${vm.tier} · 경기당 1번` })}${panel(`<p class="small muted">상대 팀 실제 선수 한 명에게 유니폼을 바꾸자고 해 봐요. 내 위상 · 오늘 평점 · 상대 성격(침착성·리더십) · 관계(더비·국적·내 옛 팀)로 정해져요.</p><div class="jx-list">${rows}</div>`, 'jx-panel')}`;
}

function itemCard(x: ShowItemVM, act: 'sr-take' | 'sr-put', disabled = false): string {
  const art = x.kind === 'trophy'
    ? `<span class="sr-art sr-art--trophy">${Icon({ name: 'trophy', size: 28 })}</span>`
    : `<span class="sr-art sr-art--jersey">${Avatar({ size: 40, face: x.face!, name: x.title, shape: 'square' })}<span class="pc-jersey">${Icon({ name: 'player', size: 12 })}</span></span>`;
  const btn = Button({ variant: act === 'sr-take' ? 'ghost' : 'secondary', size: 'sm', act, data: { v: x.key }, disabled, children: act === 'sr-take' ? '빼기' : '진열' });
  return `<div class="sr-item sr-item--${x.kind}">${art}<b class="sr-item__t">${esc(x.title)}</b><small class="sr-item__s">${esc(x.sub)}</small>${btn}</div>`;
}

export function showroomView(vm: ShowroomVM): string {
  const hero = HeroPanel({
    title: '진열실', back: { act: 'go', data: { to: 'home' } }, eyebrow: `${vm.house} · 진열 칸`, value: `${vm.shown.length}/${vm.slots}`, pad: false, progress: false, compact: true,
    chips: [`유니폼 ${vm.got}벌 · 요청 ${vm.swaps}번`, { label: vm.nextSlots ? `집을 넓히면 ${vm.nextSlots}칸` : '가장 큰 집', soft: true }],
  });
  const empty = Math.max(0, vm.slots - vm.shown.length);
  const slots = `<div class="sr-grid">${vm.shown.map((x) => itemCard(x, 'sr-take')).join('')}${'<div class="sr-item is-empty" aria-label="빈 칸"><span class="sr-art"></span><small class="muted">빈 칸</small></div>'.repeat(empty)}</div>`;
  const full = vm.shown.length >= vm.slots;
  const stored = vm.stored.length
    ? `<div class="sr-grid sr-grid--store">${vm.stored.map((x) => itemCard(x, 'sr-put', full)).join('')}</div>${full ? '<p class="small muted">진열 칸이 다 찼어요. 하나 빼거나 집을 넓혀 보세요 (재정 → 생활).</p>' : ''}`
    : '<p class="small muted">보관함이 비었어요. 우승 트로피나 유니폼 교환으로 모은 유니폼이 여기 들어와요.</p>';
  const log = vm.log.length
    ? panel(`<div class="sr-log">${vm.log.map((l) => `<div class="sr-log__row ${l.ok ? 'is-ok' : 'is-no'}"><span class="po-num small">${esc(l.date)}</span><span class="grow">${esc(l.name)} <small>(${esc(l.vs)}전)</small></span><b>${l.ok ? '받음' : '거절'}</b></div>`).join('')}</div>`)
    : '<p class="small muted">아직 요청한 적이 없어요. 경기 결과 화면에서 상대 실제 선수에게 요청할 수 있어요.</p>';
  return `${hero}<div class="body sr-body">
    ${SectionTitle({ title: '진열장', action: `${vm.shown.length} / ${vm.slots}칸` })}${slots}
    ${SectionTitle({ title: '보관함', action: `${vm.stored.length}개` })}${stored}
    ${SectionTitle({ title: '교환 기록', action: vm.swaps ? `최근 ${vm.log.length}번` : '' })}${log}
  </div>`;
}
