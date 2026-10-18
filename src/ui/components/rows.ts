// 이적 쪽 컴포넌트 (부록 C.54, bundle.js 옮김): 재정 등급 칩 FinChip · OfferCard · TransferRow. 훈련 주간 칸 DayCell (C.57).
// 요청 6 새 props: OfferCard tier·fee·homeClub, TransferRow fee·toTier. 화면 연결은 U5-f(34o) 패치가 한다

import { Avatar, Button, Crest, Icon, type IconName } from './basic';
import { actAttrs, cx, esc, type Action } from './html';

// ── 재정 등급 칩 (4단 막대 + 글자, 색 없음) ──

export type FinTierKo = '빅클럽' | '상위' | '중위' | '하위';
const FIN_N: Record<FinTierKo, number> = { 빅클럽: 4, 상위: 3, 중위: 2, 하위: 1 };

export function FinChip(tier: string | undefined, sm = false, barsOnly = false): string {
  const n = tier ? FIN_N[tier as FinTierKo] : undefined;
  if (!n) return '';
  return `<span class="${cx('po-fin', sm && 'po-fin--sm', barsOnly && 'po-fin--bars')}" title="재정 등급 ${esc(tier!)}"${barsOnly ? ` aria-label="재정 ${esc(tier!)}"` : ''}><span class="po-fin__bars" aria-hidden="true">${
    [0, 1, 2, 3].map((k) => `<i class="${k < n ? 'on' : ''}" style="height:${4 + k * 2}px"></i>`).join('')}</span>${barsOnly ? '' : esc(tier!)}</span>`;
}

export const FIN_TIERS: FinTierKo[] = ['빅클럽', '상위', '중위', '하위'];

// ── OfferCard ──

export interface OfferData {
  club: string; crest?: string; color?: string; league: string; rank?: number; strength: string | number; /** 예상 출전 (숫자면 %, 글이면 그대로 — C.60 "주전 경쟁") */ apps: number | string; starts: number; years: string; weekly: string; yearly: string;
  loan?: boolean; tag?: string; note?: string;
  /** 재정 등급 (요청 6) */
  tier?: FinTierKo;
  /** 이적료 (요청 6) */
  fee?: string;
  /** 친정 표시 (요청 6, 예: "유스 출신 구단") */
  homeClub?: string;
}
export interface OfferCardProps { offer: OfferData; selected?: boolean; actions?: boolean; onAccept?: Action; onReject?: Action;
  /** 구단 이름을 누르면 (C.60: 팀 상세) */
  clubAct?: Action;
  /** 거절 못 함 (자유계약 마지막 제안) */
  rejectDisabled?: boolean;
  /** 수락 버튼 글자 (기본 "수락") */
  acceptLabel?: string }

export function OfferCard(p: OfferCardProps): string {
  const o = p.offer;
  return `<article class="${cx('po-offer', o.loan && 'is-loan', p.selected && 'is-selected')}"><header class="po-offer__head">${Crest({ name: o.club, ...(o.crest ? { src: o.crest } : {}), size: 36, ...(o.color ? { color: o.color } : {}) })}<span class="po-offer__club">${p.clubAct ? `<button type="button" class="dt-link po-offer__link"${actAttrs(p.clubAct)}><b>${esc(o.club)}</b>${Icon({ name: 'chevron-right', size: 14, strokeWidth: 2.6 })}</button>` : `<b>${esc(o.club)}</b>`}<span>${
    esc(o.league + (o.rank != null ? ` · ${o.rank}위` : ''))}</span></span><span class="po-offer__tags">${FinChip(o.tier, true)}${
    o.loan ? '<span class="po-offer__tag is-loan">임대</span>' : o.tag ? `<span class="po-offer__tag">${esc(o.tag)}</span>` : ''}</span></header>${
    o.homeClub ? `<span class="po-offer__home">${Icon({ name: 'home', size: 12, strokeWidth: 2.6 })}${esc(o.homeClub)}</span>` : ''}<dl class="po-offer__grid"><div><dt>팀 전력</dt><dd class="po-num">${esc(o.strength)}</dd></div><div><dt>예상 출전</dt><dd class="po-num">${typeof o.apps === 'number' ? `${o.apps}%` : esc(o.apps)}</dd></div><div><dt>예상 선발</dt><dd class="po-num">${o.starts}%</dd></div><div><dt>${o.loan ? '임대 기간' : '계약'}</dt><dd>${esc(o.years)}${
    o.fee ? `<small class="po-offer__fee">이적료 ${esc(o.fee)}</small>` : ''}</dd></div></dl><div class="po-offer__wage"><span>주급 <b class="po-num">${esc(o.weekly)}</b></span><span>연봉 <b class="po-num">${esc(o.yearly)}</b></span>${
    o.note ? `<em>${esc(o.note)}</em>` : ''}</div>${p.actions !== false ? `<div class="po-offer__actions">${
    Button({ variant: 'secondary', block: true, ...(p.onReject ?? {}), disabled: !!p.rejectDisabled, children: '거절' })}${Button({ block: true, icon: 'check', ...(p.onAccept ?? {}), children: p.acceptLabel ?? '수락' })}</div>` : ''}</article>`;
}

// ── TransferRow ──

export interface TransferRowProps {
  name: string; pos: string; age: number; ovr: number; status?: string; from: string; to?: string; avatar?: string; mine?: boolean;
  /** 빈자리 보충 줄 (위 이적 줄 아래에 붙음) */
  fill?: boolean;
  /** 몸값 (요청 6) */
  fee?: string;
  /** 가는 팀 재정 등급 (요청 6) */
  toTier?: FinTierKo;
  /** 누르면 (C.60: 선수 상세) */
  act?: Action;
}

export function TransferRow(p: TransferRowProps): string {
  if (p.fill) {
    return `<div class="po-xfer po-xfer--fill"><span class="po-xfer__fillmark">↳</span><span class="po-xfer__filltext">빈자리 보충 · <b>${esc(p.name)}</b> ${esc(p.pos)} <span class="po-num">${p.age}세 · OVR ${p.ovr}</span></span>${
      p.from ? `<span class="po-xfer__fillfrom">${esc(p.from)}에서</span>` : ''}</div>`;
  }
  const to = p.to ?? '';
  const tag = p.act?.act ? 'button' : 'div';
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="${cx('po-xfer', p.mine && 'is-mine')}"${p.act ? actAttrs(p.act) : ''}>${Avatar({ ...(p.avatar ? { src: p.avatar } : {}), name: p.name, size: 40 })}<span class="po-xfer__main"><span class="po-xfer__name"><b>${esc(p.name)}</b><span class="po-xfer__pos">${esc(p.pos)}</span><span class="po-num">${p.age}세</span></span><span class="po-xfer__move">${
    Crest({ name: p.from, size: 14, color: 'var(--ink-faint)' })}<span>${esc(p.from)}</span>${Icon({ name: 'chevron-right', size: 12, strokeWidth: 2.6 })}${Crest({ name: to, size: 14 })}<b>${esc(to)}</b>${FinChip(p.toTier, true)}</span>${
    p.fee != null ? `<span class="po-xfer__fee">몸값 <b class="po-num">${esc(p.fee)}</b></span>` : ''}</span><span class="po-xfer__side"><b class="po-num">${p.ovr}</b><span>${esc(p.status ?? '')}</span></span></${tag}>`;
}

// ── DayCell (디자인 91, 요청 5): 주간 훈련 7칸의 한 칸. 요일 · 날짜 · 아이콘 · 2글자 이름. 숫자는 시트에서 ──

export interface DayCellProps {
  kind?: 'train' | 'rest' | 'match';
  /** "월" */
  day: string;
  /** "9.17" */
  date: string;
  icon?: IconName;
  /** 2글자 ("기술") */
  label: string;
  today?: boolean;
  /** 경기 다음 날 휴식 고정 (작은 자물쇠) */
  fixed?: boolean;
  past?: boolean;
  selected?: boolean;
  /** 누르면 동작 (없으면 div) */
  act?: Action;
  ariaLabel?: string;
  className?: string;
}

export function DayCell(p: DayCellProps): string {
  const kind = p.kind ?? 'train';
  const icon = p.icon ?? (kind === 'match' ? 'ball' : kind === 'rest' ? 'rest' : 'train');
  const cls = cx('po-day', `po-day--${kind}`, p.today && 'is-today', p.selected && 'is-selected', p.fixed && 'is-fixed', p.past && 'is-past', p.className);
  const body = `<span class="po-day__dow">${esc(p.day)}</span><b class="po-day__date po-num">${esc(p.date)}</b><span class="po-day__icon">${Icon({ name: icon, size: 18 })}${
    p.fixed ? `<span class="po-day__lock">${Icon({ name: 'lock', size: 9, strokeWidth: 2.8 })}</span>` : ''}</span><span class="po-day__label">${esc(p.label)}</span>${p.today ? '<span class="po-day__today">오늘</span>' : ''}`;
  return p.act
    ? `<button type="button" class="${cls}"${actAttrs(p.act)}${p.ariaLabel ? ` aria-label="${esc(p.ariaLabel)}"` : ''}>${body}</button>`
    : `<div class="${cls}"${p.ariaLabel ? ` aria-label="${esc(p.ariaLabel)}"` : ''}>${body}</div>`;
}
