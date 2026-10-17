// 능력치 바둑판 (C.39, pending 39 2번 ③): 선수 화면·포인트 찍기·새 게임 공통. 슬라이더·막대 대신 네모 박스 그리드.
// 박스 = 이름 · 숫자(크게) · 이번 변화. 숫자 구간별 색, 지금 포지션 핵심 능력치는 테두리 강조. 모바일 3열, PC 6열. 분류는 작은 머리말로만

import { esc } from '../components';

export interface AttrCellVM {
  attr: string;
  label: string;
  value: number;
  /** 이번 변화 (선수 화면: 이번 시즌, 포인트 찍기: 이번 배분). 0 이면 숨김 */
  delta: number;
  key: boolean;
  /** 포인트 찍기: 올리는 비용(최대면 null), OVR 기여, 막힘, [−] 가능 */
  edit?: { cost: number | null; ovrDelta: number | null; maxed: boolean; blocked: boolean; canLower: boolean };
}

export interface AttrGroupVM { name: string; cells: AttrCellVM[] }

/** 숫자 구간 (색): 85+ / 75+ / 65+ / 50+ / 그 아래 */
export function attrTier(v: number): 1 | 2 | 3 | 4 | 5 {
  return v >= 85 ? 5 : v >= 75 ? 4 : v >= 65 ? 3 : v >= 50 ? 2 : 1;
}

const signedInt = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

function cell(c: AttrCellVM, sel: string | null): string {
  const on = c.edit && sel === c.attr;
  const cls = `ag-cell ag-t${attrTier(c.value)}${c.key ? ' is-key' : ''}${on ? ' is-sel' : ''}${c.edit ? ' is-edit' : ''}${c.edit?.maxed ? ' is-max' : ''}`;
  const d = c.delta ? `<span class="ag-d po-num ${c.delta > 0 ? 'up' : 'down'}">${signedInt(c.delta)}</span>` : '';
  const head = `<span class="ag-name">${esc(c.label)}</span><b class="ag-v po-num">${c.value}</b>${d}`;
  if (!c.edit) return `<div class="${cls}">${head}</div>`;
  const e = c.edit;
  const cost = e.maxed ? '최대' : e.blocked ? '상한' : `${e.cost}P`;
  const edit = on
    ? `<span class="ag-edit">
        <button type="button" class="ag-btn" data-act="lower" data-attr="${esc(c.attr)}" aria-label="${esc(c.label)} 내리기"${e.canLower ? '' : ' disabled'}>−</button>
        <small class="po-num">${esc(cost)}</small>
        <button type="button" class="ag-btn plus" data-act="raise" data-attr="${esc(c.attr)}" aria-label="${esc(c.label)} 올리기 (${esc(cost)})"${e.maxed || e.blocked ? ' disabled' : ''}>+</button>
      </span>`
    : `<span class="ag-cost po-num">${esc(cost)}${e.ovrDelta ? ` · OVR +${e.ovrDelta}` : ''}</span>`;
  return `<div class="${cls}" role="button" tabindex="0" data-act="alloc-sel" data-v="${esc(c.attr)}" aria-pressed="${!!on}">${head}${edit}</div>`;
}

export function attrGrid(groups: AttrGroupVM[], sel: string | null = null): string {
  return `<div class="ag">${groups.map((g) => `<div class="ag-group"><h4 class="ag-head">${esc(g.name)}</h4><div class="ag-grid">${g.cells.map((c) => cell(c, sel)).join('')}</div></div>`).join('')}
    <div class="ag-legend small"><span><i class="ag-sw ag-t5"></i>85+</span><span><i class="ag-sw ag-t4"></i>75+</span><span><i class="ag-sw ag-t3"></i>65+</span><span><i class="ag-sw ag-t2"></i>50+</span><span><i class="ag-sw ag-t1"></i>~49</span><span><i class="ag-sw key"></i>포지션 핵심</span></div></div>`;
}
