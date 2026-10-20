// 자동 진행 (C.44 pending 47 5번·52 4번 → C.57 디자인 61~64): 범위 고르기 시트(경기 수 / 다음 중요 경기 직전까지)와 진행 중 레이어 카드.
// 레이어는 화면을 다시 그리지 않고 지금 화면 위에 따로 붙인다 (main.ts autoLayer)

import { BottomSheet, Button, Icon, Switch, esc } from '../components';
import { AUTO_PREFS_DEFAULT, type AutoPrefs } from '../autoPrefs';
import type { AutoSheetVM } from '../viewModels';

export function autoSheet(vm: AutoSheetVM, count: number, prefs: AutoPrefs = AUTO_PREFS_DEFAULT): string {
  const n = Math.max(1, Math.min(vm.remaining, count));
  const chips = [...vm.quick.filter((q) => q < vm.remaining).map((q) => ({ v: q, label: `${q}` })), { v: vm.remaining, label: `시즌 끝 · ${vm.remaining}` }];
  const quick = `<div class="auto-quick">${chips.map((c) => `<button type="button" class="po-chip auto-chip${c.v === n ? ' is-on' : ''}" data-act="auto-count" data-v="${c.v}">${esc(c.label)}</button>`).join('')}</div>`;
  const input = `<div class="auto-input"><label class="auto-input__box"><input type="number" id="auto-n" min="1" max="${vm.remaining}" value="${n}" inputmode="numeric" aria-label="직접 입력 경기 수">
      <button type="button" class="auto-input__clear" data-act="auto-count" data-v="1" aria-label="지우기">${Icon({ name: 'close', size: 14, strokeWidth: 2.6 })}</button></label><span>경기</span></div>
    <p class="auto-hint small muted">1~${vm.remaining}경기</p>`;
  const open = vm.targets.filter((t) => t.available);
  const locked = vm.targets.filter((t) => !t.available);
  const targets = open.map((t) => {
    if (!t.next) return `<div class="auto-target is-off"><span class="auto-target__icon">${Icon({ name: 'star', size: 18 })}</span><span class="auto-target__main"><b>${esc(t.label)}</b><small>${esc(t.note ?? '이번 시즌에 남은 경기가 없어요')}</small></span></div>`;
    const x = t.next;
    const desc = `${x.date} · ${x.text} · ${x.before ? `그 전까지 ${x.before}경기` : '다음 경기가 바로 이 경기예요'}`;
    const body = `<span class="auto-target__icon">${Icon({ name: 'star', size: 18 })}</span><span class="auto-target__main"><b>${esc(t.label)}</b><small>${esc(desc)}</small></span>${
      x.before ? `<span class="auto-target__n po-num">${x.before}경기</span>` : ''}<i class="radio" aria-hidden="true"></i>`;
    return x.before
      ? `<button type="button" class="auto-target" data-act="auto-until" data-v="${esc(x.iso)}" data-n="${x.before}">${body}</button>`
      : `<div class="auto-target is-off">${body}</div>`;
  }).join('');
  const lockBox = locked.length
    ? `<div class="auto-locked"><div class="auto-locked__chips">${locked.map((t) => `<span class="auto-locked__chip">${Icon({ name: 'lock', size: 11, strokeWidth: 2.6 })}${esc(t.label)}</span>`).join('')}</div>
      <p class="small muted">아직 없음 · 이 대회들은 커리어가 이어지면 생겨요</p></div>`
    : '';
  // 진행 설정 (22.2, C.73b, 디자인 없음 — Switch 재사용): 포인트 추천 배분 · 멈춤 조건. 이적 제안·재계약은 늘 멈춘다
  const sw = (k: keyof AutoPrefs, label: string, desc: string) => Switch({ label, desc, on: prefs[k], act: 'auto-pref', data: { k }, className: 'auto-pref' });
  const settings = `<h4 class="ag-head auto-h2">진행 설정</h4><div class="auto-prefs">
      ${sw('alloc', '포인트 추천 배분 자동 적용', '레벨업 포인트를 포인트 화면 [자동 배분]과 같은 규칙으로 바로 찍어요.')}
      ${sw('event', '선택 이벤트가 오면 멈춤', '답이 필요한 인박스 이벤트가 새로 오면 멈춰요. 끄면 기한이 지나 기본 선택으로 넘어가요. 인터뷰는 멈추지 않고 손해가 가장 적은 답을 골라요.')}
      ${sw('injury', '부상당하면 멈춤', '내 선수가 새로 다치면 멈춰요.')}
    </div><p class="small muted">이적 제안·재계약처럼 답해야 하는 일은 늘 멈춰요. [중단]은 그날까지 끝내고 멈춰요.</p>`;
  return BottomSheet({
    eyebrow: `자동 진행 · ${vm.date}`, title: '어디까지 진행할까요?', subtitle: `내 경기도 재생 없이 계산해요. ${prefs.alloc ? '포인트는 추천 배분으로 바로 찍고' : '포인트는 쌓아 두고'}, 답이 필요한 일이 생기면 멈춰요.`,
    onClose: { act: 'sheet-close' },
    children: `<h4 class="ag-head">경기 수</h4>${quick}<h4 class="ag-head">직접 입력</h4>${input}
      <h4 class="ag-head auto-h2">다음 중요 경기 직전까지</h4><div class="auto-targets">${targets}${lockBox}</div>${settings}`,
    footer: `<div class="auto-foot">${Button({ size: 'lg', block: true, icon: 'ff', act: 'auto-run', children: `${n}경기 자동 진행` })}${
      Button({ variant: 'secondary', block: true, icon: 'trophy', act: 'auto-end', className: 'auto-end', children: '시즌 요약으로 바로 이동' })}</div>`,
  });
}

/** 진행 중 레이어 카드 (디자인 62): 빨간 점 + 제목, 큰 n / m경기, 날짜·계산 중 경기, 막대, 최근 결과, 순위·쌓인 포인트, [중단] */
export function autoLayerHtml(): string {
  return `<div class="auto-layer__box" role="status" aria-live="polite">
    <div class="auto-layer__head"><span class="live-dot" aria-hidden="true"></span><b class="auto-layer__title">자동 경기 진행 중</b></div>
    <div class="auto-layer__count"><b class="po-num auto-layer__n">0</b><span class="po-num auto-layer__m">/ 0경기</span></div>
    <span class="auto-layer__meta small"></span>
    <span class="auto-layer__bar" aria-hidden="true"><i></i></span>
    <ul class="auto-layer__results"></ul>
    <div class="auto-layer__stats small"><span>현재 순위 <b class="po-num auto-layer__rank">-</b></span><span><span class="auto-layer__ptsl">쌓인 포인트</span> <b class="po-num auto-layer__pts">0</b></span></div>
    ${Button({ variant: 'secondary', block: true, icon: 'stop', act: 'sim-stop', className: 'auto-layer__stop', children: '중단' })}</div>`;
}

/** 레이어 한 줄 결과 (최근 2경기) */
export interface AutoResultLine { label: string; opp: string; gf: number; ga: number; rating: number | null }

export function autoResultsHtml(list: AutoResultLine[]): string {
  return list.slice(-2).map((r) => {
    const o = r.gf > r.ga ? ['win', '승'] : r.gf < r.ga ? ['loss', '패'] : ['draw', '무'];
    return `<li><span class="po-num">${esc(r.label)}</span><b class="grow">${esc(r.opp)} <em class="is-${o[0]} po-num">${r.gf}-${r.ga} ${o[1]}</em></b><span>내 평점 <b class="po-num">${r.rating != null ? r.rating.toFixed(1) : '-'}</b></span></li>`;
  }).join('');
}
