// 감독 신뢰도·면담 (C.62, 18.2·18.3 · C.76g 디자인 198 감독 줄): 홈 "주전 경쟁" 카드(디자인 22) · 감독 면담 화면(디자인 45) · 면담 결과 한 줄

import { Avatar, Button, HeroPanel, Icon, OptionRow, SectionTitle, esc } from '../components';
import type { CompetitionVM, MeetingVM, PosCellVM } from '../managerVM';
import { isWide } from '../skin';
import { actionRow, panel } from './common';

/** 홈 주전 경쟁 카드 (디자인 22): 신뢰도 게이지, 나와 경쟁자 2명 선발 점수 막대(분해), 최근 신뢰도 변화 5개, 다음 면담 조건 */
export function competitionSection(vm: CompetitionVM): string {
  const rows = vm.rows.map((r) => `<div class="mg-row${r.me ? ' is-me' : ''}">
      <div class="mg-row__head"><span class="mg-row__name">${esc(r.name)} <small>${esc(r.detail)}</small></span><b class="po-num">${esc(r.total)}</b></div>
      <div class="mg-bar" aria-hidden="true"><i class="o" style="width:${r.w[0]}%"></i><i class="t" style="width:${r.w[1]}%"></i><i class="f" style="width:${r.w[2]}%"></i><i class="x" style="width:${r.w[3]}%"></i></div>
    </div>`).join('');
  const legend = `<div class="mg-legend"><span><i class="o"></i>슬롯 OVR</span><span><i class="t"></i>신뢰도</span><span><i class="f"></i>폼·성향</span><span><i class="x"></i>피로</span><span class="grow"></span><span>막대 50점부터</span></div>`;
  const log = vm.log.length
    ? `<div class="mg-log">${vm.log.map((y) => `<div class="mg-log__row"><b class="po-num ${y.up ? 'ok' : 'fail'}">${esc(y.v)}</b><span>${esc(y.t)}</span><span class="muted">${esc(y.when)}</span></div>`).join('')}</div>`
    : '<p class="small muted">아직 변화가 없어요. 출전 경기 평점·골·도움·승패·경고로 오르내려요.</p>';
  const perks = vm.perks.length || vm.captain
    ? `<div class="mg-perks">${vm.captain ? `<span class="mg-perk is-cap">${esc(vm.captain)}</span>` : ''}${vm.perks.map((p) => `<span class="mg-perk">${esc(p)}</span>`).join('')}</div>`
    : '';
  const hint = `<div class="mg-hint">${Icon({ name: 'player', size: 18 })}<span class="grow">${esc(vm.hint)}</span>${
    vm.meeting ? Button({ size: 'sm', act: 'go', data: { to: 'meeting' }, children: '면담하기' }) : ''}</div>`;
  return `${SectionTitle({ title: `주전 경쟁 · ${vm.pos}`, action: `선발 확률 ${vm.chance}%` })}
    ${panel(`<div class="mg-boss">${Avatar({ size: 44 })}<div class="grow"><small class="muted">감독</small><b>${esc(vm.mgrName)}</b>${vm.mgrStyle ? `<small class="muted">${esc(vm.mgrStyle)}</small>` : ''}</div><span class="mg-boss__trust"><small class="muted">신뢰도</small><span><b class="po-num">${vm.trust}</b><small class="po-num"> / 100</small></span></span></div>
      <div class="mg-trustbar" role="meter" aria-label="감독 신뢰도" aria-valuenow="${vm.trust}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.max(0, Math.min(100, vm.trust))}%"></i></div>
      ${vm.styleLine ? `<p class="small muted mg-style">${esc(vm.styleLine)}</p>` : ''}
      <div class="mg-rows">${rows}${legend}</div>
      ${perks}
      <hr class="mg-hr">
      <b class="mg-sub">최근 신뢰도 변화</b>
      ${log}
      ${hint}`, 'mg-card')}`;
}

const posCell = (c: PosCellVM, label: string, sug: boolean) => `<div class="mg-pos${sug ? ' is-sug' : ''}"><small class="muted">${label}</small><b class="mg-pos__name">${esc(c.pos)}</b><small class="muted">${esc(c.formation)}</small>
  <div class="mg-pos__kv"><span>OVR</span><b class="po-num">${c.ovr}</b></div>
  <div class="mg-pos__kv"><span>숙련도</span><b class="po-num">${c.prof}/100</b></div><div class="mg-trustbar"><i style="width:${Math.max(0, Math.min(100, c.prof))}%"></i></div>
  <div class="mg-pos__kv"><span>선발 확률</span><b class="po-num${sug ? ' up' : ''}">${c.chance}%</b></div></div>`;

/** 감독 면담 (디자인 45 → C.76i 191·192): 큰 신뢰도 머리말 · 감독 말풍선 · 감독/내 역할/면담 줄(포지션 제안은 지금 → 제안 두 칸) · 요구 강도 칩 선택지 · "이걸 고르면" 예고 · [다음에요][이걸로 할게요]. PC는 2열(오른쪽 선택지 + 버튼) */
export function meetingView(vm: MeetingVM, sel: string | null): string {
  const pick = vm.options.find((o) => o.id === sel && !o.disabled) ?? vm.options.find((o) => !o.disabled) ?? null;
  const hero = HeroPanel({ title: '감독 면담', back: { act: 'go', data: { to: 'home' } }, eyebrow: '감독 신뢰도', value: vm.trust, total: 100, chips: vm.chips });
  const say = `<div class="mg-say">${Avatar({ size: 44 })}<div><small>${esc(vm.manager)}</small><p>${esc(vm.line)}</p></div></div>`;
  const info = `<div class="panel mg-info"><div><small class="muted">감독</small><b>${esc(vm.mgrName)}</b><small class="muted">${esc(vm.mgrStyle)}</small></div>
    <div><small class="muted">내 역할</small><b>${esc(vm.role.title)}</b><small class="muted po-num">${esc(vm.role.line)}</small></div>
    <div><small class="muted">면담</small><b>하루 행동</b><small class="muted">오늘 훈련 대신</small></div></div>`;
  const cmp = vm.compare ? `${SectionTitle({ title: '포지션 비교', action: `선발 ${vm.compare.sug.chance - vm.compare.cur.chance >= 0 ? '+' : ''}${vm.compare.sug.chance - vm.compare.cur.chance}%p` })}
    <div class="mg-cmp">${posCell(vm.compare.cur, '지금 포지션', false)}<span class="mg-cmp__arrow">${Icon({ name: 'chevron-right', size: 18 })}</span>${posCell(vm.compare.sug, '감독 제안', true)}</div>` : '';
  const opts = vm.options.map((o) => OptionRow({
    act: 'meet-pick', data: { v: o.id }, radio: true, selected: pick?.id === o.id, icon: o.icon, title: o.title,
    desc: o.disabled ? `${o.desc} · ${o.disabled}` : o.desc, disabled: !!o.disabled, ...(o.tag ? { tag: o.tag } : {}),
  })).join('');
  const to = pick ? Math.max(0, Math.min(100, vm.trust + pick.pv.delta)) : vm.trust;
  const d = to - vm.trust;
  const lo = Math.min(vm.trust, to);
  const preview = pick ? `<div class="panel mg-pv"><div class="mg-pv__head"><b>${vm.kind === 'reward' ? '받는 보상' : '이걸 고르면'}</b><span class="small muted">신뢰도 <b class="po-num">${vm.trust}</b> › <b class="po-num mg-pv__to${d > 0 ? ' up' : d < 0 ? ' down' : ''}">${to}</b> <small class="po-num ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0'}</small></span></div>
    <div class="mg-pv__bar" aria-hidden="true"><i style="width:${lo}%"></i>${d ? `<i class="${d > 0 ? 'is-up' : 'is-down'}" style="width:${Math.abs(d)}%"></i>` : ''}</div>
    <div class="mg-pv__chips">${pick.pv.chips.map((c) => `<span class="mg-pv__chip${c.tone ? ` is-${c.tone}` : ''}">${esc(c.label)}</span>`).join('')}</div></div>` : '';
  const note = vm.blocked ? `<p class="small warn">${esc(vm.blocked)}</p>` : '<p class="small muted">면담은 하루 행동이에요. 오늘 훈련 대신 면담하고, 오늘은 휴식으로 바뀌어요.</p>';
  const btns = actionRow(
    Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'home' }, children: '다음에요' }),
    Button({ size: 'lg', block: true, act: 'meet-ok', data: { v: pick?.id ?? '' }, disabled: !pick || !!vm.blocked, children: '이걸로 할게요' }),
  );
  const list = `${SectionTitle({ title: vm.section, action: '1개' })}<div class="mg-opts">${opts}</div>`;
  if (isWide()) {
    return `${hero}<div class="body mg-body mg-pc"><div class="mg-pc__l">${say}${vm.compare ? cmp : info}${preview}${note}</div><div class="mg-pc__r">${list}<div class="mg-inline-btns">${btns}</div></div></div>`;
  }
  return `${hero}<div class="body mg-body">${say}${vm.compare ? cmp : info}${list}${preview}${note}</div>
    <div class="dock mg-dock">${btns}</div>`;
}
