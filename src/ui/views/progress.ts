// 자동 진행 (C.44 pending 47 5번·52 4번): 범위 고르기 시트(경기 수 / 다음 중요 경기 직전까지)와 진행 중 반투명 레이어.
// 레이어는 화면을 다시 그리지 않고 지금 화면 위에 따로 붙인다 (main.ts autoLayer)

import { BottomSheet, Button, esc, OptionRow } from '../components';
import type { AutoSheetVM } from '../viewModels';

export function autoSheet(vm: AutoSheetVM, count: number): string {
  const n = Math.max(1, Math.min(vm.remaining, count));
  const chips = [...vm.quick.map((q) => ({ v: q, label: `${q}경기` })), { v: vm.remaining, label: `시즌 끝 (${vm.remaining})` }];
  const quick = `<div class="auto-quick">${chips.map((c) => `<button type="button" class="po-chip auto-chip${c.v === n ? ' is-on' : ''}" data-act="auto-count" data-v="${c.v}">${esc(c.label)}</button>`).join('')}</div>`;
  const input = `<label class="auto-input"><span>직접</span><input type="number" id="auto-n" min="1" max="${vm.remaining}" value="${n}" inputmode="numeric"><span>경기</span></label>`;
  const targets = vm.targets.map((t) => {
    if (!t.available) return OptionRow({ title: t.label, desc: '이 대회는 아직 없어요 (다음 업데이트에서 열려요)', tag: '아직 없음', disabled: true });
    if (!t.next) return OptionRow({ title: t.label, desc: '이번 시즌에 남은 경기가 없어요', disabled: true });
    const x = t.next;
    const desc = `다음 ${x.date} · ${x.text} · ${x.before ? `그 전까지 ${x.before}경기 자동` : '다음 경기가 바로 이 경기예요'} · 시즌 남은 ${x.left}경기`;
    return OptionRow({ act: 'auto-until', data: { v: String(x.round) }, title: t.label, desc, icon: 'star', disabled: x.before === 0, right: x.before ? `<b class="po-num small">${x.before}경기</b>` : '' });
  }).join('');
  return BottomSheet({
    eyebrow: `자동 진행 · ${vm.date}`, title: '어디까지 진행할까요?', subtitle: '내 경기도 재생 없이 계산해요. 포인트는 찍지 않고 쌓아 두고, 답이 필요한 일(이적 제안 등)이 생기면 멈춰요.',
    onClose: { act: 'sheet-close' },
    children: `<h4 class="ag-head">① 경기 수</h4>${quick}${input}
      ${Button({ size: 'lg', block: true, icon: 'ff', act: 'auto-run', children: `${n}경기 자동 진행` })}
      <h4 class="ag-head auto-h2">② 다음 중요 경기 직전까지</h4><div class="opts">${targets}</div>`,
  });
}

/** 진행 중 레이어 내용 (텍스트만 바꿔 끼운다) */
export function autoLayerHtml(): string {
  return `<div class="auto-layer__box" role="status" aria-live="polite"><span class="live-dot" aria-hidden="true"></span>
    <b class="auto-layer__title">자동 경기 진행 중</b><span class="auto-layer__count po-num"></span><span class="auto-layer__meta small"></span>
    <span class="auto-layer__bar" aria-hidden="true"><i></i></span>
    ${Button({ variant: 'secondary', act: 'sim-stop', className: 'auto-layer__stop', children: '중단' })}</div>`;
}
