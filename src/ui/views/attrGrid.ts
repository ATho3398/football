// 능력치 바둑판 (C.39, pending 39 2번 ③): 선수 화면·포인트 찍기·새 게임 공통. 슬라이더·막대 대신 네모 박스 그리드.
// 박스 = 이름 · 숫자(크게) · 이번 변화. 숫자 구간별 색, 지금 포지션 핵심 능력치는 테두리 강조. 모바일 3열, PC 6열. 분류는 작은 머리말로만.
// C.44 (pending 47 3번): 화면 숫자는 1~20 (내부 0~99 ÷ 5 반올림). 박스 아래 얇은 막대 = 다음 칸까지 진행

import { attrDisplay, displayProgress } from '../../attributes';
import { esc, Icon } from '../components';

export interface AttrCellVM {
  attr: string;
  label: string;
  /** 내부 값 0~99 (화면은 1~20) */
  value: number;
  /** 이번 변화의 기준 내부 값 (선수 화면: 시즌 시작, 포인트 찍기: 들어올 때). 없으면 변화 숨김 */
  base?: number;
  key: boolean;
  /** 편집 박스 (포인트 찍기·커스텀 생성): 한 칸(+1) 비용(최대면 null)·칸 수(1), 지금 갈 수 있는 칸 수(0/1), OVR 기여, 막힘, 포인트 부족, [−] 가능 */
  edit?: { cost: number | null; steps: number; reach: number; ovrDelta: number | null; maxed: boolean; blocked: boolean; canLower: boolean; short?: boolean };
}

export interface AttrGroupVM { name: string; cells: AttrCellVM[] }

/** 숫자 구간 (색, 1~20 표시 기준): 17+ / 15+ / 13+ / 10+ / 그 아래 */
export function attrTier(v: number): 1 | 2 | 3 | 4 | 5 {
  const d = attrDisplay(v);
  return d >= 17 ? 5 : d >= 15 ? 4 : d >= 13 ? 3 : d >= 10 ? 2 : 1;
}

const signedInt = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}`;

/** 이름: 괄호 설명은 작게 ("볼 컨트롤(퍼스트 터치·키핑)") */
function nameHtml(label: string): string {
  const m = /^(.*?)\((.*)\)$/.exec(label);
  return m ? `${esc(m[1]!)}<small> ${esc(m[2]!)}</small>` : esc(label);
}

/** 편집 박스의 동작 이름 (포인트 찍기 기본, 커스텀 생성은 cu-, C.45) */
export interface AttrActs { sel: string; raise: string; lower: string }
const ALLOC_ACTS: AttrActs = { sel: 'alloc-sel', raise: 'raise', lower: 'lower' };

function cell(c: AttrCellVM, sel: string | null, acts: AttrActs = ALLOC_ACTS): string {
  const on = c.edit && sel === c.attr;
  // C.70 (디자인 163): 남은 포인트로 못 올리는 칸 = 회색 + 자물쇠 "nP 부족"
  const short = !!c.edit && c.edit.blocked && !!c.edit.short && !c.edit.maxed;
  const cls = `ag-cell ag-t${attrTier(c.value)}${c.key ? ' is-key' : ''}${on ? ' is-sel' : ''}${c.edit ? ' is-edit' : ''}${c.edit?.maxed ? ' is-max' : ''}${short ? ' is-short' : ''}`;
  const dd = c.base === undefined ? 0 : attrDisplay(c.value) - attrDisplay(c.base);
  const d = dd ? `<span class="ag-d po-num ${dd > 0 ? 'up' : 'down'}">${signedInt(dd)}</span>` : c.base !== undefined && c.value !== c.base ? `<span class="ag-d po-num ${c.value > c.base ? 'up' : 'down'}" title="다음 칸까지 진행">${c.value > c.base ? '▲' : '▼'}</span>` : '';
  const pct = Math.round(displayProgress(c.value) * 100);
  const bar = `<span class="ag-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>`;
  const head = `<span class="ag-name" title="${esc(c.label)}">${nameHtml(c.label)}</span><b class="ag-v po-num">${attrDisplay(c.value)}</b>${d}${bar}`;
  if (!c.edit) return `<div class="${cls}" title="${esc(c.label)} ${attrDisplay(c.value)} · 다음 칸까지 ${pct}%">${head}</div>`;
  const e = c.edit;
  const cost = e.maxed ? '최대' : e.blocked ? (e.short ? `${e.cost}P 부족` : '상한') : `${e.cost}P`;
  // 디자인 AttrTile selected (C.72, 163): 고른 상태에서도 비용·OVR 줄은 그대로, 그 아래 [−][+] 큰 단추 줄(32px)
  const costRow = `<span class="ag-cost po-num"><b>${esc(cost)}</b>${e.ovrDelta ? `<span>OVR +${e.ovrDelta}</span>` : ''}</span>`;
  const edit = on
    ? `${costRow}<span class="ag-edit ag-steps">
        <button type="button" class="ag-btn" data-act="${acts.lower}" data-attr="${esc(c.attr)}" aria-label="${esc(c.label)} 내리기"${e.canLower ? '' : ' disabled'}>−</button>
        <button type="button" class="ag-btn plus" data-act="${acts.raise}" data-attr="${esc(c.attr)}" aria-label="${esc(c.label)} 올리기 (${esc(cost)})"${e.maxed || e.reach === 0 ? ' disabled' : ''}>+</button>
      </span>`
    : short
      ? `<span class="ag-cost ag-short">${Icon({ name: 'lock', size: 12, strokeWidth: 2.4 })}${esc(cost)}</span>`
      : costRow;
  return `<div class="${cls}" role="button" tabindex="0" data-act="${acts.sel}" data-v="${esc(c.attr)}" aria-pressed="${!!on}">${head}${edit}</div>`;
}

/** 바둑판 모양 (C.58 디자인 93·113): 열 수(폰 4열 = AttrGrid), 범례를 위로, 테두리 범례 글자 */
export interface AttrGridOpts { cols?: 3 | 4; legendTop?: boolean; keyLabel?: string; /** 범례에 "포인트 부족" (C.70 디자인 163) */ shortLegend?: boolean }

export function attrGrid(groups: AttrGroupVM[], sel: string | null = null, acts?: AttrActs, o: AttrGridOpts = {}): string {
  const legend = `<div class="ag-legend small"><span><i class="ag-sw ag-t5"></i>17+</span><span><i class="ag-sw ag-t4"></i>15+</span><span><i class="ag-sw ag-t3"></i>13+</span><span><i class="ag-sw ag-t2"></i>10+</span><span><i class="ag-sw ag-t1"></i>~9</span><span><i class="ag-sw key"></i>${esc(o.keyLabel ?? '포지션 핵심')}</span>${o.shortLegend ? '<span><i class="ag-sw short"></i>포인트 부족</span>' : ''}<span><i class="ag-sw bar"></i>막대 = 다음 칸까지</span></div>`;
  return `<div class="ag${o.cols === 4 ? ' ag--4' : ''}">${o.legendTop ? legend : ''}${groups.map((g) => `<div class="ag-group"><h4 class="ag-head">${esc(g.name)}</h4><div class="ag-grid">${g.cells.map((c) => cell(c, sel, acts)).join('')}</div></div>`).join('')}
    ${o.legendTop ? '' : legend}</div>`;
}
