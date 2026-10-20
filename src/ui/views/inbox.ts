// 인박스 (20.4, 부록 C.63): 디자인 없음 → C.57 홈 알림 카드(디자인 133)·면담 화면(디자인 45)의 컴포넌트를 재사용.
// 목록 = 알림 카드 줄, 선택형 = 면담처럼 선택지 라디오 + 아래 [나중에][이걸로 할게요]. 홈에는 안 읽은 것 최대 3개 + 라이벌 카드

import { Avatar, Button, Crest, HeroPanel, Icon, OptionRow, SectionTitle, StatChip, Tabs, esc } from '../components';
import type { GoalsCardVM, InboxDetailVM, InboxRowVM, InboxVM, RivalCardVM } from '../inboxVM';
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
  const ans = vm.answer ? panel(`<b class="mg-sub">${vm.answer.auto ? (vm.answer.text.startsWith('자동 진행') ? '자동 진행 답' : '기본 선택') : '내 선택'} · ${esc(vm.answer.label || '—')}</b><p class="small">${esc(vm.answer.text)}</p>`, 'ib-answer') : '';
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

/** 홈 라이벌 카드 (20.5 → C.76g 디자인 195): 얼굴·이름·팀·OVR + 시즌 기록 비교 표(앞선 쪽 색) + 골+도움 막대 + 앞섬/뒤짐 칩 */
export function rivalSection(vm: RivalCardVM): string {
  const max = Math.max(1, vm.me.ga, vm.them.ga);
  const cmp = (label: string, a: number | null, b: number | null, fa: string, fb: string, num = true) => {
    const lead = num && a != null && b != null ? Math.sign(a - b) : 0;
    return `<div class="rv-cmp__row"><b class="po-num${lead > 0 ? ' is-lead' : ''}">${esc(fa)}</b><span>${label}</span><b class="po-num${lead < 0 ? ' is-lead is-them' : ''}">${esc(fb)}</b></div>`;
  };
  const f = (v: number | null) => (v == null ? '—' : String(v));
  const avg = (v: string) => (v === '-' ? null : Number(v));
  const tone = vm.lead > 0 ? 'is-ahead' : vm.lead < 0 ? 'is-behind' : 'is-tie';
  const chip = vm.lead > 0 ? `앞섬 · ${vm.lead}개` : vm.lead < 0 ? `뒤짐 · ${-vm.lead}개` : '동률';
  return `${SectionTitle({ title: `라이벌 · ${vm.name}`, action: vm.lead > 0 ? `${vm.lead}개 앞서요` : vm.lead < 0 ? `${-vm.lead}개 뒤져요` : '동률' })}
    ${panel(`<div class="rv-head">${Avatar({ size: 48 })}<div class="grow"><b class="rv-name">${esc(vm.name)}</b><p class="small muted">${Crest({ name: vm.team, size: 16 })}<button type="button" class="dt-link" data-act="team-open" data-v="${esc(vm.teamId)}">${esc(vm.team)}</button> · ${esc(vm.pos)} · ${vm.age}세 · 위상 ${vm.rep}</p></div><span class="rv-ovr"><b class="po-num">${vm.ovr}</b><small>OVR</small></span></div>
      <div class="rv-cmp"><div class="rv-cmp__who"><span class="is-me">나</span><span class="is-them">${esc(vm.name.split(' ').pop() ?? vm.name)}</span></div>
        ${cmp('경기', vm.me.apps, vm.them.apps, f(vm.me.apps), f(vm.them.apps), false)}
        ${cmp('골', vm.me.goals, vm.them.goals, f(vm.me.goals), f(vm.them.goals))}
        ${cmp('도움', vm.me.assists, vm.them.assists, f(vm.me.assists), f(vm.them.assists))}
        ${cmp('평균 평점', avg(vm.me.avg), avg(vm.them.avg), vm.me.avg, vm.them.avg)}
        ${cmp('골+도움', vm.me.ga, vm.them.ga, String(vm.me.ga), String(vm.them.ga))}</div>
      <div class="rv-bars" aria-hidden="true"><i class="is-me" style="width:${Math.round((vm.me.ga / max) * 100)}%"></i><i class="is-them" style="width:${Math.round((vm.them.ga / max) * 100)}%"></i></div>
      <div class="rv-verdict ${tone}"><span class="rv-chip">${chip}</span><span class="small">골+도움 ${vm.me.ga} 대 ${vm.them.ga} · ${esc(vm.record)}</span></div>
      <p class="small muted">골+도움과 평균 평점으로 겨뤄요. 시즌이 끝나면 비교 결과가 위상·감독 신뢰도에 조금 반영돼요.${vm.est ? ` ${esc(vm.name)} 기록은 추정이에요.` : ''} 내 위상 ${vm.myRep}.</p>`, 'mg-card rv-card')}`;
}

/** 보상 문구 "XP 50 · TP 1 · 희귀 카드 3택 1" → XP · 카드 선택권 칩 · TP (C.76g 디자인 204) */
function goalReward(r: string): string {
  const parts = r.split(' · ');
  const xp = parts.find((x) => x.startsWith('XP ')) ?? '';
  const tp = parts.find((x) => x.startsWith('TP ')) ?? '';
  const rest = parts.filter((x) => x !== xp && x !== tp).map((x) => { const m = /^(\S+) 카드 3택 1$/.exec(x); return m ? `카드 선택권 +1 · ${m[1]}` : x; });
  return `${xp ? `<span class="gl-xp po-num">${esc(xp)}</span>` : ''}${rest.map((x) => `<span class="gl-pick">${esc(x)}</span>`).join('')}${tp ? `<b class="gl-tp po-num">${esc(tp)}</b>` : ''}`;
}

const GOAL_TONE = { done: 'success', track: 'brand', behind: 'warning', start: 'neutral' } as const;
const TIER_TONE = { easy: 'neutral', normal: 'mine', hard: 'warning' } as const;

/** 홈 시즌 목표 카드 (18.9, C.65): 줄 = 난이도 칩 · 출처 · 목표 / 진행 막대 / 지금 값 · 상태 · 보상. 디자인 없음 → 주전 경쟁 카드(mg-row) 틀 재사용 */
export function goalsSection(vm: GoalsCardVM): string {
  const rows = vm.rows.map((r) => `<div class="mg-row gl-row gl-${r.status}">
      <div class="mg-row__head"><span class="mg-row__name">${StatChip({ label: r.tierKo, tone: TIER_TONE[r.tier] })} ${esc(r.source)} · ${esc(r.label)}</span><b class="po-num">${esc(r.value)}</b></div>
      <div class="mg-bar" aria-hidden="true"><i class="t" style="width:${Math.round(r.ratio * 100)}%"></i></div>
      <div class="gl-meta small">${goalReward(r.reward)}<span class="grow"></span>${StatChip({ label: r.statusKo, tone: GOAL_TONE[r.status] })}</div>
    </div>`).join('');
  return `${SectionTitle({ title: '시즌 목표', action: vm.round ? `${vm.ok}/3 순항 · 시즌 ${vm.round}경기째` : `개막 전 · ${vm.rounds}R` })}
    ${panel(`<div class="mg-rows">${rows}</div>
      <p class="small muted">시즌이 끝나면 판정해요. 달성하면 XP와 카드 3택 1, 감독·구단 목표는 감독 신뢰도에도 반영돼요.</p>`, 'mg-card gl-card')}`;
}

/** 시즌 요약 목표 결과 (18.9, C.65): 달성 n/3 · 줄마다 결과 · 업적 선택권 */
export function goalsResultPanel(r: { rows: { ok: boolean; source: string; tierKo: string; label: string; value: string; xp: number; trust: number }[]; awards: string[]; xp: number; picks: number }): string {
  const met = r.rows.filter((x) => x.ok).length;
  const rows = r.rows.map((x) => `<div class="ach gl-res${x.ok ? ' is-ok' : ''}"><span class="ach__icon">${Icon({ name: x.ok ? 'check' : 'close', size: 16 })}</span><span class="grow">${esc(x.source)}(${esc(x.tierKo)}) · ${esc(x.label)} <small class="muted">${esc(x.value)}</small></span>${
    x.ok ? `<b class="po-num up">+${x.xp}</b>` : '<span class="small muted">실패</span>'}${x.trust ? `<small class="po-num ${x.trust > 0 ? 'up' : 'down'}">신뢰 ${x.trust > 0 ? '+' : ''}${x.trust}</small>` : ''}</div>`).join('');
  const aw = r.awards.map((a) => `<div class="ach"><span class="ach__icon">${Icon({ name: 'trophy', size: 16 })}</span><span class="grow">업적 · ${esc(a)}</span><span class="small">카드 3택 1</span></div>`).join('');
  return `<p class="season-todo-head">시즌 목표 <span class="po-num">${met}/3</span> 달성${r.xp ? ` · XP +${r.xp}` : ''}${r.picks ? ` · 카드 선택권 ${r.picks}장` : ''}</p>${panel(rows + aw, 'gl-result')}`;
}
