// 인박스 (20.4, 부록 C.63): 디자인 없음 → C.57 홈 알림 카드(디자인 133)·면담 화면(디자인 45)의 컴포넌트를 재사용.
// 목록 = 알림 카드 줄, 선택형 = 면담처럼 선택지 라디오 + 아래 [나중에][이걸로 할게요]. 홈에는 안 읽은 것 최대 3개 + 라이벌 카드

import { Button, HeroPanel, Icon, OptionRow, SectionTitle, Tabs, esc } from '../components';
import type { InboxDetailVM, InboxRowVM, InboxVM, RivalCardVM } from '../inboxVM';
import { actionRow, panel } from './common';

function linkButton(l: NonNullable<InboxRowVM['link']>): string {
  return Button({ size: 'sm', variant: 'secondary', act: l.act ?? 'go', data: l.act ? { v: l.v ?? '' } : { to: l.to ?? 'home' }, children: l.label });
}

/** 알림 카드 한 줄 (디자인 133 hm-alert): 아이콘 · 머리(분류·날짜) · 제목 · 내용 · 상태 · 버튼. home = 홈 카드(닫기 = 읽음) */
export function inboxCard(r: InboxRowVM, home = false): string {
  const btns = [
    r.pending ? Button({ size: 'sm', act: 'inbox-open', data: { v: r.id }, children: '답하기' }) : '',
    r.link ? linkButton(r.link) : '',
    !home && !r.pending ? Button({ size: 'sm', variant: 'ghost', act: 'inbox-open', data: { v: r.id }, children: '자세히' }) : '',
  ].filter(Boolean).join('');
  const x = home && !r.pending ? `<button type="button" class="hm-alert__x" data-act="inbox-read" data-v="${r.id}" aria-label="읽음">${Icon({ name: 'close', size: 16 })}</button>` : '<span></span>';
  return `<div class="panel hm-alert ib-row${r.unread ? ' is-unread' : ''}${r.pending ? ' is-todo' : ''}" role="status">
    <span class="hm-alert__icon">${Icon({ name: r.icon, size: 18 })}</span>
    <div class="hm-alert__body"><span class="hm-alert__eyebrow">${esc(r.cat)} · ${esc(r.when)}${r.status ? ` · <b class="ib-status">${esc(r.status)}</b>` : ''}</span><b>${esc(r.title)}</b><p>${esc(r.body)}</p>${btns ? `<div class="ib-btns">${btns}</div>` : ''}</div>
    ${x}</div>`;
}

/** 홈 알림 (C.57 "알림 n · 모두 닫기" 자리): 안 읽은 인박스 최대 3개 + [인박스] */
export function homeInboxSection(rows: InboxRowVM[], unread: number): string {
  if (!rows.length) return '';
  const head = `<div class="hm-alerts-head"><b>알림 <span class="po-num">${unread}</span></b><span class="ib-head-btns">${
    unread > rows.filter((r) => r.pending).length ? '<button type="button" class="link-btn" data-act="inbox-all-read">모두 읽음</button>' : ''}<button type="button" class="link-btn" data-act="go" data-to="inbox">인박스</button></span></div>`;
  return head + rows.map((r) => inboxCard(r, true)).join('');
}

/** 인박스 화면 */
export function inboxView(vm: InboxVM): string {
  const hero = HeroPanel({
    title: '인박스', back: { act: 'go', data: { to: 'home' } }, compact: true, pad: false, progress: false,
    eyebrow: '알림 · 소식 · 답할 것', value: vm.unread ? `안 읽음 ${vm.unread}` : '모두 읽음',
    chips: vm.todo ? [`답할 것 ${vm.todo}`] : [{ label: '답할 것 없음', soft: true }],
  });
  const tabs = Tabs({ items: [{ id: 'all', label: '전체' }, { id: 'todo', label: `답할 것${vm.todo ? ` ${vm.todo}` : ''}` }, { id: 'info', label: '소식' }], value: vm.filter, variant: 'underline', fill: true, act: 'inbox-tab', label: '인박스' });
  const list = vm.rows.length ? vm.rows.map((r) => inboxCard(r)).join('') : panel('<p class="muted small">아직 알림이 없어요. 경기·하루 진행에 따라 소식과 선택이 와요.</p>');
  const tools = vm.unread ? `<div class="ib-tools"><button type="button" class="link-btn" data-act="inbox-all-read">모두 읽음</button></div>` : '';
  return `${hero}<div class="body ib-body">${tabs}${tools}<div class="ib-list">${list}</div>
    <p class="small muted">선택형은 기한(보통 7일)이 지나면 기본 선택으로 넘어가요. 오래된 읽은 알림은 ${'80'}개를 넘으면 지워져요.</p></div>`;
}

/** 알림 하나 (선택형 = 면담 화면 구조, 디자인 45) */
export function inboxDetailView(vm: InboxDetailVM, sel: string | null): string {
  const pick = vm.choices.find((c) => c.id === sel && !c.disabled) ?? vm.choices.find((c) => !c.disabled) ?? null;
  const hero = HeroPanel({ title: '인박스', back: { act: 'go', data: { to: 'inbox' } }, compact: true, pad: false, progress: false, eyebrow: vm.when, value: vm.cat, chips: vm.status ? [vm.status] : [] });
  const say = `<div class="mg-say"><span class="hm-alert__icon">${Icon({ name: vm.icon, size: 20 })}</span><div><small>${esc(vm.cat)} · ${esc(vm.when)}</small><b class="ib-title">${esc(vm.title)}</b><p>${esc(vm.body)}</p></div></div>`;
  const ans = vm.answer ? panel(`<b class="mg-sub">${vm.answer.auto ? '기본 선택' : '내 선택'} · ${esc(vm.answer.label || '—')}</b><p class="small">${esc(vm.answer.text)}</p>`, 'ib-answer') : '';
  const opts = vm.pending
    ? `${SectionTitle({ title: '어떻게 할까요?', action: '1개' })}<div class="mg-opts">${vm.choices.map((c) => OptionRow({
      act: 'inbox-pick', data: { v: c.id }, radio: true, selected: pick?.id === c.id, title: c.label, desc: c.disabled ? `${c.desc} · ${c.disabled}` : c.desc, disabled: !!c.disabled,
    })).join('')}</div><p class="small muted">답하지 않으면 기한이 끝날 때 기본 선택으로 넘어가요.</p>`
    : '';
  const link = vm.link ? `<div class="ib-btns">${linkButton(vm.link)}</div>` : '';
  const dock = vm.pending
    ? `<div class="dock mg-dock">${actionRow(
      Button({ variant: 'secondary', size: 'lg', block: true, act: 'go', data: { to: 'inbox' }, children: '나중에' }),
      Button({ size: 'lg', block: true, act: 'inbox-answer', data: { v: pick?.id ?? '', id: vm.id }, disabled: !pick, children: '이걸로 할게요' }),
    )}</div>`
    : '';
  return `${hero}<div class="body mg-body ib-detail">${say}${ans}${opts}${link}</div>${dock}`;
}

/** 홈 라이벌 카드 (20.5, 디자인 없음 → 주전 경쟁 카드 막대 재사용) */
export function rivalSection(vm: RivalCardVM): string {
  const max = Math.max(1, vm.me.ga, vm.them.ga);
  const bar = (v: number, cls: string) => `<div class="mg-bar" aria-hidden="true"><i class="${cls}" style="width:${Math.round((v / max) * 100)}%"></i></div>`;
  return `${SectionTitle({ title: `라이벌 · ${vm.name}`, action: vm.lead > 0 ? `${vm.lead}개 앞서요` : vm.lead < 0 ? `${-vm.lead}개 뒤져요` : '동률' })}
    ${panel(`<p class="small muted mg-mgr"><button type="button" class="dt-link" data-act="team-open" data-v="${esc(vm.teamId)}">${esc(vm.team)}</button> · ${esc(vm.pos)} · ${vm.age}세 · OVR ${vm.ovr} · ${esc(vm.record)}</p>
      <div class="mg-rows">
        <div class="mg-row is-me"><div class="mg-row__head"><span class="mg-row__name">나 <small>평점 ${esc(vm.me.avg)}</small></span><b class="po-num">${vm.me.ga}</b></div>${bar(vm.me.ga, 'o')}</div>
        <div class="mg-row"><div class="mg-row__head"><span class="mg-row__name">${esc(vm.name)} <small>${vm.them.apps}경기 · 평점 ${esc(vm.them.avg)}${vm.est ? ' · 추정' : ''}</small></span><b class="po-num">${vm.them.ga}</b></div>${bar(vm.them.ga, 't')}</div>
      </div>
      <p class="small muted">골+도움과 평균 평점으로 겨뤄요. 시즌이 끝나면 비교 결과가 위상·감독 신뢰도에 조금 반영돼요.</p>`, 'mg-card rv-card')}`;
}
