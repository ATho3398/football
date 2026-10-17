// 훈련 (25.3, 부록 C.41): 홈의 오늘 훈련 카드, 주간 계획 7칸(바둑판, 눌러서 그날만 바꾸기), 기술 훈련 게이지, 영상 분석 힌트,
// 하루 훈련 고르기 바텀시트, 휴가 카드. 칸 스타일은 C.39 능력치 바둑판(.ag-cell)과 같은 박스

import { BottomSheet, Button, OptionRow, SectionTitle, Tabs, esc } from '../components';
import type { TrainingOptionVM, TrainingVM } from '../viewModels';
import { panel } from './common';

const num = (n: number) => (Math.round(n * 10) / 10).toString();

function dayCell(d: TrainingVM['week'][number]): string {
  const cls = `ag-cell tr-cell tr-${d.kind}${d.today ? ' is-today' : ''}${d.changed ? ' is-changed' : ''}${d.locked ? '' : ' is-edit'}`;
  const body = `<span class="ag-name">${esc(d.wd)} ${esc(d.md)}</span><b class="tr-k">${esc(d.short)}</b>${d.changed ? '<span class="ag-d up">변경</span>' : d.today ? '<span class="ag-d">오늘</span>' : ''}`;
  return d.locked
    ? `<div class="${cls}">${body}</div>`
    : `<div class="${cls}" role="button" tabindex="0" data-act="train-day" data-v="${esc(d.date)}" aria-label="${esc(d.wd)} ${esc(d.md)} ${esc(d.short)} 바꾸기">${body}</div>`;
}

/** 홈 "오늘 훈련" + 주간 계획 + 게이지 */
export function trainingSection(vm: TrainingVM): string {
  const t = vm.today;
  if (vm.vacation) {
    return `${SectionTitle({ title: '휴가', action: `${vm.vacation.days}일` })}
      ${panel(`<div class="tr-today tr-vacation"><b>리그 휴장 · 휴가 중</b>
        <p class="small">훈련 선택 없이 쉬어요. XP 없음 · 피로 하루 −${num(t.fatigue)} · 폼 저하 없음.</p>
        <p class="small muted">${esc(vm.vacation.until)}부터 훈련을 다시 해요. [계속]을 누르면 휴가 끝까지 한 번에 넘어가요.</p></div>
        ${vm.last ? `<p class="small muted">${esc(vm.last)}</p>` : ''}`)}`;
  }
  const head = `<div class="tr-today">
      <div class="kv"><b>${esc(t.name)}${t.bundle ? ` · ${esc(t.bundle)}` : ''}</b>${t.changed ? '<span class="cal-tag">오늘만 변경</span>' : ''}</div>
      <p class="small">${esc(t.desc)}</p>
      <p class="small muted po-num">${t.kind === 'match' ? '' : `XP +${num(t.xp)} · 피로 −${num(t.fatigue)} · `}이번 주 훈련 XP ${num(vm.weekXp)}/${vm.cap}</p>
      ${t.locked ? '' : Button({ variant: 'secondary', size: 'sm', act: 'train-day', data: { v: t.date }, children: '오늘 훈련 바꾸기' })}
    </div>`;
  const notes = [
    ...vm.hints.map((h) => `<li>🎥 ${esc(h)}</li>`),
    ...(vm.eve ? ['<li>경기 전날 영상 분석 완료 · 시작 패 +1 (카드 엔진 연결 예정)</li>'] : []),
    ...(vm.formPenalty ? ['<li class="warn">휴식이 길어져 다음 경기 폼 −1. 회복 훈련을 하면 지워져요.</li>'] : []),
  ];
  return `${SectionTitle({ title: '오늘 훈련', action: `시즌 훈련 XP ${vm.seasonXp}` })}
    ${panel(`${head}
      <h4 class="ag-head">주간 계획 · 칸을 누르면 그날만 바꿔요</h4>
      <div class="ag-grid tr-week">${vm.week.map(dayCell).join('')}</div>
      <p class="small muted">기본 계획: 경기 다음 날 회복, 이틀 뒤 휴식, 전날 영상 분석, 나머지 기술 훈련. [계속]은 계획대로 진행해요.</p>
      ${notes.length ? `<ul class="tr-notes small">${notes.join('')}</ul>` : ''}
      ${vm.last ? `<p class="small muted">어제 · ${esc(vm.last)}</p>` : ''}`)}
    ${gaugeSection(vm)}`;
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
      <p class="small muted">기술 훈련 하루에 고른 묶음 +1. 다 차면 그 묶음에서 가장 낮은 능력치 +1 (칸 수 = 30 × 그 능력치의 포인트 비용, 묶음당 시즌 +2, 전체 +6). 30세부터는 천천히 차요.</p>
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
      desc: `${o.desc} · XP +${num(o.xp)} · 피로 −${num(o.fatigue)}`, ...(o.planned ? { tag: '기본' } : {}),
    })).join(''),
  });
}
