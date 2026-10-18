// 훈련 (25.3, 부록 C.41 → C.57 디자인 91·92·150): 홈의 오늘 훈련 한 줄, 오늘 훈련 카드 + 주간 7칸(DayCell, 눌러서 그날만 바꾸기),
// 기술 훈련 게이지, 영상 분석 힌트, 하루 훈련 고르기 바텀시트(고르고 확정), 휴가 카드

import { BottomSheet, Button, DayCell, Icon, SectionTitle, Tabs, esc, type IconName } from '../components';
import type { DayPlan } from '../../training';
import { PRESET_NAME_MAX } from '../../training';
import type { PresetEditVM, PresetRowVM, PresetsVM, TrainingOptionVM, TrainingVM } from '../viewModels';
import { panel } from './common';
import { isLifeKind } from '../../life';
import { BALANCE } from '../../config/balance';

const num = (n: number) => (Math.round(n * 100) / 100).toString();
const sgn = (n: number) => (n > 0 ? `+${num(n)}` : n < 0 ? `−${num(-n)}` : '+0');

/** 조사 "으로/로": 받침이 있고 ㄹ이 아니면 "으로" */
function euro(word: string): string {
  const c = word.charCodeAt(word.length - 1) - 0xac00;
  return c >= 0 && c < 11172 && c % 28 !== 0 && c % 28 !== 8 ? '으로' : '로';
}

/** 훈련 종류 아이콘 (디자인 91·92) */
export const PLAN_ICON: Record<DayPlan, IconName> = {
  tech: 'train', weakFoot: 'target', intense: 'risk', position: 'tactic', setpiece: 'card', video: 'video', recovery: 'recover', rest: 'rest',
  match: 'ball', vacation: 'plane', rehab: 'injury',
  family: 'home', language: 'chat', teamMeal: 'combo', therapy: 'face', trip: 'plane', media: 'star',
};
const cellKind = (k: DayPlan): 'train' | 'rest' | 'match' => (k === 'match' ? 'match' : k === 'rest' || k === 'recovery' || k === 'vacation' || k === 'rehab' || isLifeKind(k) ? 'rest' : 'train');

/** 주간 7칸 한 칸 = DayCell (디자인 91): 요일 · 날짜 · 아이콘 · 2글자. 바꿀 수 있는 날은 눌러서 그날만 바꾸기 */
function dayCell(d: TrainingVM['week'][number]): string {
  return DayCell({
    kind: cellKind(d.kind), day: d.wd, date: d.md, icon: PLAN_ICON[d.kind], label: d.short.slice(0, 2), today: d.today, fixed: d.fixed,
    className: d.changed ? 'is-changed' : '', ariaLabel: `${d.wd} ${d.md} ${d.short}${d.locked ? '' : ' 바꾸기'}`,
    ...(d.locked ? {} : { act: { act: 'train-day', data: { v: d.date } } }),
  });
}

const weekRow = (vm: TrainingVM) => `<div class="tr-week">${vm.week.map(dayCell).join('')}</div>`;

/** 이번 주 미리 보기 (프리셋 탭, 오늘부터 7칸) */
export function weekPreview(vm: TrainingVM): string {
  return `${SectionTitle({ title: '이번 주 미리 보기', action: `프리셋 ${vm.presets.activeName}` })}
    ${panel(weekRow(vm))}`;
}

/** 홈 "오늘 훈련" 한 줄 (디자인 86): 누르면 훈련·일정 */
export function todayRow(vm: TrainingVM): string {
  const t = vm.today;
  const eyebrow = vm.vacation ? `휴가 · ${vm.vacation.days}일` : `오늘 훈련${t.fixed ? ' · 고정' : t.changed ? ' · 오늘만 변경' : ` · 프리셋 ${vm.presets.activeName}`}`;
  const line = vm.vacation
    ? `체력 하루 +${num(t.fatigue)} · ${vm.vacation.until}부터 훈련`
    : `${t.kind === 'match' ? '' : `XP +${num(t.xp)} · 체력 +${num(t.fatigue)} · `}이번 주 훈련 XP ${num(vm.weekXp)}/${vm.cap}`;
  const extra = [
    ...(t.fixed ? [`${Icon({ name: 'lock', size: 12 })}경기 다음 날은 휴식으로 고정돼요`] : []),
    ...(vm.formPenalty ? ['<span class="warn">휴식이 길어져 다음 경기 폼 −1</span>'] : []),
  ];
  return `<button type="button" class="panel hm-train" data-act="go-tab" data-v="schedule"><span class="hm-train__icon">${Icon({ name: vm.vacation ? 'plane' : PLAN_ICON[t.kind], size: 20 })}</span>
    <span class="hm-train__body"><small>${esc(eyebrow)}</small><b>${esc(vm.vacation ? '리그 휴장 · 휴가 중' : `${t.name}${t.bundle ? ` · ${t.bundle}` : ''}`)}</b><span class="po-num">${esc(line)}</span>${extra.map((x) => `<em>${x}</em>`).join('')}</span>
    ${Icon({ name: 'chevron-right', size: 18 })}</button>`;
}

/** 훈련·일정 "오늘 훈련" 카드 + 주간 7칸 (디자인 91). gauge=true 면 게이지도 */
export function trainingSection(vm: TrainingVM, gauge = true): string {
  const t = vm.today;
  if (vm.vacation) {
    return `${SectionTitle({ title: '휴가', action: `${vm.vacation.days}일` })}
      ${panel(`<div class="tr-today tr-vacation"><b>리그 휴장 · 휴가 중</b>
        <p class="small">훈련 선택 없이 쉬어요. XP 없음 · 체력 하루 +${num(t.fatigue)} · 폼 저하 없음.</p>
        <p class="small muted">${esc(vm.vacation.until)}부터 훈련을 다시 해요. [계속]을 누르면 휴가 끝까지 한 번에 넘어가요.</p></div>
        ${vm.last ? `<p class="small muted">${esc(vm.last)}</p>` : ''}`)}`;
  }
  const head = `<div class="tr-today">
      <span class="tr-today__icon">${Icon({ name: PLAN_ICON[t.kind], size: 20 })}</span>
      <span class="tr-today__name"><small>오늘 훈련${t.fixed ? ' · 고정' : t.changed ? ' · 오늘만 변경' : ''}</small><b>${esc(t.name)}${t.bundle ? ` · ${esc(t.bundle)}` : ''}</b></span>
      ${t.kind === 'match' ? '' : `<span class="tr-today__nums"><span><small>XP</small><b class="po-num">${sgn(t.xp)}</b></span><span><small>체력</small><b class="po-num ok">${sgn(t.fatigue)}</b></span></span>`}
    </div>
    <p class="small muted tr-desc">${esc(t.fixed ? `${t.desc} 경기 다음 날은 휴식으로 고정돼요.` : t.desc)}</p>`;
  const notes = [
    ...vm.hints.map((h) => `<li>🎥 ${esc(h)}</li>`),
    ...(vm.eve ? ['<li>경기 전날 영상 분석 완료 · 시작 패 +1 (곧 적용돼요)</li>'] : []),
    ...(vm.formPenalty ? ['<li class="warn">휴식이 길어져 다음 경기 폼 −1. 회복 훈련을 하면 지워져요.</li>'] : []),
  ];
  return `${panel(`${head}
      ${weekRow(vm)}
      <div class="tr-foot small muted"><span>칸을 누르면 그날만 바꿔요</span><span>이번 주 훈련 XP <b class="po-num">${num(vm.weekXp)}/${vm.cap}</b></span></div>
      <p class="small muted pr-line">이번 주 프리셋 <b>${esc(vm.presets.activeName)}</b>${vm.presets.auto ? (vm.presets.manual ? ' · 이번 주만 직접 고름' : ' · 자동') : ' · 자동 끔'} · <button type="button" class="link-btn" data-act="train-tab" data-v="pre">프리셋 바꾸기</button></p>
      ${notes.length ? `<ul class="tr-notes small">${notes.join('')}</ul>` : ''}
      ${vm.last ? `<p class="small muted">어제 · ${esc(vm.last)}</p>` : ''}`, 'tr-daycard')}
    ${gauge ? gaugeSection(vm) : ''}`;
}

/** 기술 훈련 게이지 (묶음 7개, 디자인 91: 묶음 탭 + 2열 칸) */
export function gaugeSection(vm: TrainingVM): string {
  const cells = vm.gauges.map((g) => {
    const pct = Math.round((g.value / g.full) * 100);
    const on = vm.focus === g.id || (vm.focus === 'auto' && g.today);
    return `<div class="tr-gauge${on ? ' is-key' : ''}${g.capped ? ' is-max' : ''}">
      <span class="tr-gauge__top"><b>${esc(g.name)}</b><span class="po-num"><b>${g.value}</b>/${g.full}</span></span>
      <span class="tr-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <small class="po-num">시즌 +${g.ups}/${g.max}${g.capped ? ' · 상한' : ''}${g.today ? ' · 오늘 집중' : ''}</small>${g.coach ? `<small class="tr-gauge__coach">${esc(g.coach)}</small>` : ''}</div>`;
  }).join('');
  const items = [{ id: 'auto', label: '자동' }, ...vm.gauges.map((g) => ({ id: g.id, label: g.name }))];
  return `${SectionTitle({ title: '기술 훈련 게이지', action: `시즌 +${vm.seasonUps}/${vm.seasonMax}` })}
    <div class="tr-focus">${Tabs({ items, value: vm.focus, act: 'train-focus', label: '기술 훈련 묶음', scroll: true })}</div>
    <div class="tr-gauges">${cells}</div>
    <p class="small muted">기술 훈련을 하면 고른 묶음 +1칸. 다 차면 그 묶음에서 가장 낮은 능력치가 1/5칸 올라요(칸 수 = ${BALANCE.training.gauge.full} × 그 능력치의 포인트 비용, 묶음당 시즌 +${BALANCE.training.gauge.bundleSeasonMax}, 전체 +${vm.seasonMax}). [자동]이면 시즌 상한이 남은 묶음 중 내 포지션 OVR에 가장 크게 들어가는 묶음이 차요. 30세부터는 천천히 차요. 코치가 있으면 그 코치의 전문 능력치가 목표가 되고 더 빨리 차요(재정 화면).</p>`;
}

/** 하루 훈련 고르기 (디자인 92·150): 줄을 고르고 아래 [○○으로]로 확정, [프리셋대로]는 그날 바꾼 것을 지운다 */
export function trainingSheet(vm: { date: string; injured: boolean; options: TrainingOptionVM[]; weakFoot?: string }, dateIso: string, pick: string | null = null): string {
  const sel = vm.options.find((o) => o.kind === pick) ?? vm.options.find((o) => o.selected) ?? vm.options[0]!;
  const planned = vm.options.find((o) => o.planned);
  const rows = vm.options.map((o, i) => `${o.life && !vm.options[i - 1]?.life ? '<div class="tr-opts__head small lf-sec"><span>생활 · 훈련 대신</span><span></span><span></span></div>' : ''}<button type="button" class="tr-opt${o.kind === sel.kind ? ' is-on' : ''}" role="radio" aria-checked="${o.kind === sel.kind}" data-act="train-pick" data-v="${o.kind}" data-date="${esc(dateIso)}">
      <span class="tr-opt__icon">${Icon({ name: PLAN_ICON[o.kind], size: 18 })}</span>
      <span class="tr-opt__main"><b>${esc(o.name)}${o.planned ? ' <i class="tr-tag">기본</i>' : ''}${o.selected && !o.planned ? ' <i class="tr-tag is-on">지금</i>' : ''}</b><small>${esc(o.kind === 'weakFoot' && vm.weakFoot ? `약발 게이지 +1칸 · ${vm.weakFoot}` : o.desc)}</small></span>
      <b class="tr-opt__xp po-num">${sgn(o.xp)}</b><b class="tr-opt__ft po-num">${sgn(o.fatigue)}</b></button>`).join('');
  const label = sel.name.replace(/ \(기본\)$/, '');
  return BottomSheet({
    eyebrow: vm.date, title: vm.injured ? '부상 중 · 재활 또는 휴식' : '이날 훈련 고르기',
    subtitle: vm.injured ? '부상 중에는 훈련 대신 재활하거나 쉬어요.' : '이날만 바뀌어요. 다른 날은 프리셋대로예요.',
    onClose: { act: 'sheet-close' },
    children: `<div class="tr-opts" role="radiogroup" aria-label="훈련"><div class="tr-opts__head small"><span>훈련</span><span>XP</span><span>체력</span></div>${rows}</div>
      ${vm.options.some((o) => o.kind === 'weakFoot') ? `<p class="small muted tr-wf">약발 훈련: ${BALANCE.weakFoot.trainingGauge}칸이 차면 약발 +1(시즌 최대 +${BALANCE.weakFoot.seasonMax}). 약발 5 = 양발잡이가 되면 이 줄은 사라져요.</p>` : ''}`,
    footer: `<div class="btn-row even">${Button({ variant: 'secondary', block: true, act: 'train-set', data: { v: planned?.kind ?? sel.kind, date: dateIso }, disabled: !planned, children: '프리셋대로' })}${
      Button({ block: true, icon: 'check', act: 'train-set', data: { v: sel.kind, date: dateIso }, children: `${label}${euro(label)}` })}</div>`,
  });
}

// ── 훈련 프리셋 (C.52, pending 82 6번, 디자인 159) ──

function presetRow(r: PresetRowVM): string {
  const badge = r.active ? '<span class="pr-badge is-on">지금</span>' : r.recommended ? '<span class="pr-badge">추천</span>' : '';
  const cells = r.week.map((d) => `<span class="pr-day tr-${d.kind}${d.fixed ? ' is-fixed' : ''}${d.today ? ' is-today' : ''}" title="${esc(d.wd)}"><small>${esc(d.wd)}</small><b class="tr-k">${esc(d.short)}</b></span>`).join('');
  return `<div class="pr-row${r.active ? ' is-on' : ''}">
    <button type="button" class="pr-pick" role="radio" aria-checked="${r.active}" data-act="preset-pick" data-v="${esc(r.id)}">
      <span class="pr-head"><i class="radio${r.active ? ' on' : ''}" aria-hidden="true"></i><b>${esc(r.name)}</b>${badge}</span>
      <span class="pr-desc">${esc(r.desc)}</span>
      <span class="pr-week" aria-hidden="true">${cells}</span>
    </button>
    ${r.custom ? `<button type="button" class="pr-edit" data-act="preset-edit" data-v="${esc(r.id)}" aria-label="${esc(r.name)} 편집">편집</button>` : ''}
  </div>`;
}

/** 훈련 프리셋 탭: 이번 주 추천 + 기본 4 + 내 프리셋(무제한) + 새로 만들기 */
export function presetSection(vm: PresetsVM): string {
  const r = vm.rec;
  const chips = r.chips.map((c) => `<span class="pr-chip pr-chip--${c.tone}">${esc(c.label)}</span>`).join('');
  const rec = `<div class="pr-rec">
      <div class="pr-rec__head"><b>이번 주 추천 · ${esc(r.name)}</b>${vm.auto ? '<span class="pr-badge is-on">자동</span>' : ''}</div>
      <div class="pr-chips">${chips}</div>
      <p class="small">${esc(r.line)}</p>
      ${r.applied
        ? `<p class="small muted">이번 주(${esc(vm.weekLabel)})에 적용 중이에요.</p>`
        : Button({ block: true, icon: 'check', act: 'preset-apply', children: '이번 주에 적용' })}
      <div class="kv pr-auto"><span class="small">주가 바뀔 때 추천 프리셋 자동 적용</span>${Tabs({ items: [{ id: 'off', label: '끔' }, { id: 'on', label: '켬' }], value: vm.auto ? 'on' : 'off', act: 'preset-auto', label: '프리셋 자동 적용' })}</div>
      <p class="small muted">직접 고른 프리셋은 그 주만 유지돼요. 자동을 끄면 고른 프리셋이 다음 주에도 이어져요.</p>
    </div>`;
  return `${SectionTitle({ title: '훈련 프리셋', action: `이번 주 ${vm.weekLabel}` })}
    ${rec}
    ${SectionTitle({ title: '기본 프리셋', action: `${vm.base.length}개` })}
    <div class="pr-list" role="radiogroup" aria-label="기본 프리셋">${vm.base.map(presetRow).join('')}</div>
    ${SectionTitle({ title: '내 프리셋', action: vm.custom.length ? `${vm.custom.length}개 · 무제한` : '무제한' })}
    <div class="pr-list" role="radiogroup" aria-label="내 프리셋">${vm.custom.map(presetRow).join('')}</div>
    ${Button({ variant: 'secondary', block: true, icon: 'plus', act: 'preset-edit', data: { v: '' }, children: '새 프리셋 만들기' })}
    <p class="small muted pr-note">경기 다음 날 휴식·경기 전날 영상 분석은 프리셋과 상관없이 그대로예요(흐린 칸). 주간 계획 칸을 누르면 그날만 바꿔요.</p>`;
}

/** 커스텀 프리셋 만들기·이름 바꾸기·지우기 시트 */
export function presetEditSheet(vm: PresetEditVM): string {
  const slots = vm.slots.map((sl, i) => `<label class="pr-slot"><span>${esc(sl.label)}</span><select data-preset-slot="${i}" aria-label="${esc(sl.label)}">${
    vm.kinds.map((k) => `<option value="${k.id}"${k.id === sl.kind ? ' selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>`).join('');
  const footer = `<div class="btn-row even">${vm.id ? Button({ variant: 'ghost', block: true, act: 'preset-del', data: { v: vm.id }, children: '지우기' }) : Button({ variant: 'ghost', block: true, act: 'sheet-close', children: '취소' })}${
    Button({ block: true, icon: 'check', act: 'preset-save', data: { v: vm.id ?? '' }, children: vm.id ? '저장' : '만들기' })}</div>`;
  return BottomSheet({
    eyebrow: '내 프리셋', title: vm.id ? '프리셋 편집' : '새 프리셋 만들기',
    subtitle: '훈련일 순서대로 채워요. 경기 날·경기 다음 날 휴식·경기 전날 영상 분석 날은 건너뛰어요.',
    onClose: { act: 'sheet-close' },
    children: `<label class="field"><span class="label">이름</span><input type="text" id="f-preset-name" maxlength="${PRESET_NAME_MAX}" value="${esc(vm.name)}" placeholder="비우면 '내 프리셋 n'"></label>
      <div class="pr-slots">${slots}</div>`,
    footer,
  });
}
