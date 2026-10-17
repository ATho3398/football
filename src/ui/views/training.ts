// 훈련 (25.3, 부록 C.41): 홈의 오늘 훈련 카드, 주간 계획 7칸(바둑판, 눌러서 그날만 바꾸기), 기술 훈련 게이지, 영상 분석 힌트,
// 하루 훈련 고르기 바텀시트, 휴가 카드. 칸 스타일은 C.39 능력치 바둑판(.ag-cell)과 같은 박스

import { BottomSheet, Button, OptionRow, SectionTitle, Tabs, esc } from '../components';
import { PRESET_NAME_MAX } from '../../training';
import type { PresetEditVM, PresetRowVM, PresetsVM, TrainingOptionVM, TrainingVM } from '../viewModels';
import { panel } from './common';
import { BALANCE } from '../../config/balance';

const num = (n: number) => (Math.round(n * 100) / 100).toString();

function dayCell(d: TrainingVM['week'][number]): string {
  const cls = `ag-cell tr-cell tr-${d.kind}${d.today ? ' is-today' : ''}${d.changed ? ' is-changed' : ''}${d.locked ? '' : ' is-edit'}`;
  const body = `<span class="ag-name">${esc(d.wd)} ${esc(d.md)}</span><b class="tr-k">${esc(d.short)}</b>${d.changed ? '<span class="ag-d up">변경</span>' : d.fixed ? '<span class="ag-d">고정</span>' : d.today ? '<span class="ag-d">오늘</span>' : ''}`;
  return d.locked
    ? `<div class="${cls}">${body}</div>`
    : `<div class="${cls}" role="button" tabindex="0" data-act="train-day" data-v="${esc(d.date)}" aria-label="${esc(d.wd)} ${esc(d.md)} ${esc(d.short)} 바꾸기">${body}</div>`;
}

/** 이번 주 미리 보기 (프리셋 탭, 오늘부터 7칸) */
export function weekPreview(vm: TrainingVM): string {
  return `${SectionTitle({ title: '이번 주 미리 보기', action: `프리셋 ${vm.presets.activeName}` })}
    ${panel(`<div class="ag-grid tr-week">${vm.week.map(dayCell).join('')}</div>`)}`;
}

/** 홈 "오늘 훈련" + 주간 계획 + 게이지 (gauge=false 면 게이지 빼고) */
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
      <div class="kv"><b>${esc(t.name)}${t.bundle ? ` · ${esc(t.bundle)}` : ''}</b>${t.changed ? '<span class="cal-tag">오늘만 변경</span>' : ''}</div>
      <p class="small">${esc(t.desc)}</p>
      <p class="small muted po-num">${t.kind === 'match' ? '' : `XP +${num(t.xp)} · 체력 +${num(t.fatigue)} · `}이번 주 훈련 XP ${num(vm.weekXp)}/${vm.cap}</p>
      ${t.fixed ? '<p class="small muted">경기 다음 날은 휴식으로 고정돼요 (바꿀 수 없어요).</p>' : ''}
      ${t.locked ? '' : Button({ variant: 'secondary', size: 'sm', act: 'train-day', data: { v: t.iso }, children: '오늘 훈련 바꾸기' })}
      <p class="small muted pr-line">이번 주 프리셋 <b>${esc(vm.presets.activeName)}</b>${vm.presets.auto ? (vm.presets.manual ? ' · 이번 주만 직접 고름' : ' · 자동') : ' · 자동 끔'} · <button type="button" class="link-btn" data-act="go" data-to="schedule">프리셋 바꾸기</button></p>
    </div>`;
  const notes = [
    ...vm.hints.map((h) => `<li>🎥 ${esc(h)}</li>`),
    ...(vm.eve ? ['<li>경기 전날 영상 분석 완료 · 시작 패 +1 (곧 적용돼요)</li>'] : []),
    ...(vm.formPenalty ? ['<li class="warn">휴식이 길어져 다음 경기 폼 −1. 회복 훈련을 하면 지워져요.</li>'] : []),
  ];
  return `${SectionTitle({ title: '오늘 훈련', action: `시즌 훈련 XP ${vm.seasonXp}` })}
    ${panel(`${head}
      <h4 class="ag-head">주간 계획 · 칸을 누르면 그날만 바꿔요</h4>
      <div class="ag-grid tr-week">${vm.week.map(dayCell).join('')}</div>
      <p class="small muted">경기 다음 날 휴식(고정), 경기 전날 영상 분석, 나머지 날은 이번 주 프리셋대로. [계속]은 계획대로 진행해요.</p>
      ${notes.length ? `<ul class="tr-notes small">${notes.join('')}</ul>` : ''}
      ${vm.last ? `<p class="small muted">어제 · ${esc(vm.last)}</p>` : ''}`)}
    ${gauge ? gaugeSection(vm) : ''}`;
}

/** 기술 훈련 게이지 (묶음 7개) */
export function gaugeSection(vm: TrainingVM): string {
  const cells = vm.gauges.map((g) => {
    const pct = Math.round((g.value / g.full) * 100);
    return `<div class="ag-cell tr-gauge${g.today ? ' is-key' : ''}${g.capped ? ' is-max' : ''}">
      <span class="ag-name">${esc(g.name)}</span><b class="ag-v po-num">${g.value}<small>/${g.full}</small></b>
      <span class="tr-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
      <span class="ag-cost po-num">시즌 +${g.ups}/${g.max}${g.capped ? ' · 상한' : ''}</span></div>`;
  }).join('');
  const items = [{ id: 'auto', label: '자동' }, ...vm.gauges.map((g) => ({ id: g.id, label: g.name }))];
  return `${SectionTitle({ title: '기술 훈련 게이지', action: `시즌 +${vm.seasonUps}/${vm.seasonMax}` })}
    ${panel(`<div class="ag-grid tr-gauges">${cells}</div>
      <p class="small muted">기술 훈련 하루에 고른 묶음 +1. 다 차면 그 묶음에서 가장 낮은 능력치가 내부 +1(1~20 표시로 1/5칸) 올라요 (게이지 칸 수 = ${BALANCE.training.gauge.full} × 그 능력치의 포인트 비용, 묶음당 시즌 +2, 전체 +6). 30세부터는 천천히 차요.</p>
      <div class="tr-focus">${Tabs({ items, value: vm.focus, act: 'train-focus', label: '기술 훈련 묶음' })}</div>`)}`;
}

/** 하루 훈련 고르기 */
export function trainingSheet(vm: { date: string; injured: boolean; options: TrainingOptionVM[] }, dateIso: string): string {
  return BottomSheet({
    eyebrow: vm.date, title: vm.injured ? '부상 중 · 재활 또는 휴식' : '이날 훈련 고르기',
    subtitle: vm.injured ? '부상 중에는 훈련 대신 재활하거나 쉬어요.' : '이날만 바뀌어요. 다른 날은 기본 계획대로예요.',
    onClose: { act: 'sheet-close' },
    children: vm.options.map((o) => OptionRow({
      act: 'train-set', data: { v: o.kind, date: dateIso }, radio: true, selected: o.selected, title: o.name,
      desc: `${o.desc} · XP +${num(o.xp)} · 체력 +${num(o.fatigue)}`, ...(o.planned ? { tag: '기본' } : {}),
    })).join(''),
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
