// 17차 1단계 공통 컴포넌트 (U17-a, 디자인 player-one-design-b17-1 S00 K2·K4·K7·K9·K11·K13·K14).
// bundle.js 17차 블록(Chip · Panel · DataTable · TopStrip · EmptyState · ToolBar · PlayerRow)을 HTML 문자열 함수로 옮겼다.
// 이름·props 는 디자인 그대로, onClick 대신 data-act(Action). 글자 바닥 12px(적용 명세 0절 3번), 누르는 칸 44px 은 CSS(skin-b17.css)

import { Icon, type IconName } from './basic';
import { actAttrs, cx, esc, type Action } from './html';

// ── K2 Chip: info(값, 누를 수 없음) · filter(누르는 칩) · status(상태 배지, 테두리만) ──

export type ChipTone = 'neutral' | 'success' | 'fail' | 'warning' | 'injury' | 'brand' | 'mine';
export interface ChipProps extends Action {
  kind?: 'info' | 'filter' | 'status';
  tone?: ChipTone;
  label?: string;
  value?: string | number;
  icon?: IconName;
  selected?: boolean;
  className?: string;
}

export function Chip(p: ChipProps): string {
  const kind = p.kind ?? 'info';
  const cls = cx('po-xchip', `po-xchip--${kind}`, `po-xchip--${p.tone ?? 'neutral'}`, p.selected && 'is-on', p.className);
  const inner = `${p.icon ? Icon({ name: p.icon, size: 12, strokeWidth: 2.4 }) : ''}${p.label != null ? `<span class="po-xchip__label">${esc(p.label)}</span>` : ''}${
    p.value != null ? `<b class="po-xchip__value po-num">${esc(p.value)}</b>` : ''}`;
  return kind === 'filter'
    ? `<button type="button" class="${cls}" aria-pressed="${!!p.selected}"${actAttrs(p)}>${inner}</button>`
    : `<span class="${cls}">${inner}</span>`;
}

// ── K4 Panel: info(정보) · task(할 일, 왼쪽 라임 막대) · alert(알림, 아이콘 + 닫기). folded = 접은 한 줄(summary) ──

export interface PanelProps {
  kind?: 'info' | 'task' | 'alert';
  title?: string;
  eyebrow?: string;
  /** 오른쪽 작은 글자 (이스케이프됨) */
  right?: string;
  icon?: IconName;
  /** 접고 펴기: 머리를 누르면 이 동작 (없으면 화살표만 그림) */
  foldable?: boolean;
  folded?: boolean;
  onFold?: Action;
  summary?: string;
  onClose?: Action;
  /** 본문 (HTML) */
  children?: string;
  /** 아래 행동 줄 (HTML, 보통 Button) */
  action?: string;
  className?: string;
}

export function Panel(p: PanelProps): string {
  const kind = p.kind ?? 'info';
  const folded = !!p.folded;
  const fold = p.foldable
    ? `<span class="po-panel__fold" aria-hidden="true">${Icon({ name: 'chevron-down', size: 18, ...(folded ? {} : { style: 'transform:rotate(180deg)' }) })}</span>`
    : '';
  const headInner = `${p.icon ? `<span class="po-panel__icon">${Icon({ name: p.icon, size: 18 })}</span>` : ''}<span class="po-panel__titles">${
    p.eyebrow ? `<span class="po-panel__eyebrow">${esc(p.eyebrow)}</span>` : ''}${p.title ? `<b class="po-panel__title">${esc(p.title)}</b>` : ''}</span>${
    p.right != null ? `<span class="po-panel__right">${esc(p.right)}</span>` : ''}${fold}`;
  const close = p.onClose ? `<button type="button" class="po-panel__close" aria-label="닫기"${actAttrs(p.onClose)}>${Icon({ name: 'close', size: 16 })}</button>` : '';
  const head = p.title || p.right != null || p.icon || p.eyebrow
    ? p.foldable && p.onFold?.act
      ? `<header class="po-panel__head"><button type="button" class="po-panel__toggle" aria-expanded="${!folded}"${actAttrs(p.onFold)}>${headInner}</button>${close}</header>`
      : `<header class="po-panel__head">${headInner}${close}</header>`
    : '';
  const body = folded ? (p.summary ? `<div class="po-panel__summary">${esc(p.summary)}</div>` : '') : (p.children ?? '');
  return `<section class="${cx('po-panel', `po-panel--${kind}`, folded && 'is-folded', p.className)}">${head}${body}${!folded && p.action ? `<div class="po-panel__action">${p.action}</div>` : ''}</section>`;
}

// ── K7 DataTable: 머리 · 줄 40px · 숫자 오른쪽 · 내 줄 시안 막대 · 구간 줄(up/down) · 접기("n개 더 보기") ──

export interface DataTableColumn { key: string; label: string; align?: 'left' | 'right' | 'center'; width?: string; grow?: boolean; num?: boolean; strong?: boolean }
export interface DataTableProps {
  columns: DataTableColumn[];
  rows: Record<string, string | number>[];
  /** 내 줄 index */
  mine?: number;
  /** index → 'up' | 'down' (승격·강등 같은 구간 줄) */
  marks?: Record<number, 'up' | 'down'>;
  /** 접기 단추 글자 ("14팀 더 보기") */
  more?: string;
  onMore?: Action;
  dense?: boolean;
  label?: string;
  className?: string;
}

export function DataTable(p: DataTableProps): string {
  const tpl = p.columns.map((c) => c.width ?? (c.grow ? 'minmax(0, 1fr)' : 'auto')).join(' ');
  const al = (c: DataTableColumn) => `is-${c.align ?? (c.num ? 'right' : 'left')}`;
  const head = `<div class="po-table__row po-table__head" role="row" style="grid-template-columns:${tpl}">${p.columns.map((c) => `<span role="columnheader" class="${cx('po-table__cell', al(c))}">${esc(c.label)}</span>`).join('')}</div>`;
  const rows = p.rows.map((r, i) => `<div role="row" class="${cx('po-table__row', p.mine === i && 'is-mine', p.marks?.[i] && `is-${p.marks[i]}`)}" style="grid-template-columns:${tpl}">${
    p.columns.map((c) => `<span role="cell" class="${cx('po-table__cell', al(c), c.num && 'po-num', c.strong && 'is-strong')}">${esc(r[c.key] ?? '')}</span>`).join('')}</div>`).join('');
  const more = p.more ? `<button type="button" class="po-table__more"${actAttrs(p.onMore ?? {})}>${esc(p.more)}${Icon({ name: 'chevron-down', size: 14 })}</button>` : '';
  return `<div class="${cx('po-table', p.dense && 'is-dense', p.className)}" role="table"${p.label ? ` aria-label="${esc(p.label)}"` : ''}>${head}${rows}${more}</div>`;
}

// ── K9 TopStrip: 위 띠 1종 (머리말 위 흐름 안, 한 번에 하나) ──

export type TopStripKind = 'live' | 'running' | 'guide' | 'update' | 'test' | 'interview';
const STRIP_ICON: Record<TopStripKind, IconName> = { live: 'match', running: 'running', guide: 'info', update: 'download', test: 'target', interview: 'chat' };
/** 겹치면 앞이 이긴다 (S03-c: 경기 중 > 자동 진행 > 면담 > 1군 테스트 > 새 버전 > 안내) */
export const TOP_STRIP_ORDER: readonly TopStripKind[] = ['live', 'running', 'interview', 'test', 'update', 'guide'];

export interface TopStripProps {
  kind?: TopStripKind;
  title: string;
  text?: string;
  icon?: IconName;
  action?: string;
  onAction?: Action;
  /** 띠 전체를 누르면 이 동작 (경기 중 = 경기로) */
  onTap?: Action;
  onClose?: Action;
  /** [나중에] 같은 둘째 단추 (글자 단추) */
  secondary?: { label: string; act: string; data?: Record<string, string> };
  className?: string;
}

export function TopStrip(p: TopStripProps): string {
  const kind = p.kind ?? 'guide';
  const lead = kind === 'live' ? '<i class="po-strip__dot" aria-hidden="true"></i>' : `<span class="po-strip__icon">${Icon({ name: p.icon ?? STRIP_ICON[kind], size: 16 })}</span>`;
  const text = `<span class="po-strip__text"><b>${esc(p.title)}</b>${p.text ? `<span>${esc(p.text)}</span>` : ''}</span>`;
  const main = p.onTap ? `<button type="button" class="po-strip__tap"${actAttrs(p.onTap)}>${lead}${text}</button>` : `${lead}${text}`;
  const sec = p.secondary ? `<button type="button" class="po-strip__later"${actAttrs({ act: p.secondary.act, ...(p.secondary.data ? { data: p.secondary.data } : {}) })}>${esc(p.secondary.label)}</button>` : '';
  return `<div class="${cx('po-strip', `po-strip--${kind}`, p.className)}" role="${kind === 'live' || kind === 'interview' ? 'alert' : 'status'}">${main}${sec}${
    p.action ? `<button type="button" class="po-strip__action"${actAttrs(p.onAction ?? {})}>${esc(p.action)}</button>` : ''}${
    p.onClose ? `<button type="button" class="po-strip__close" aria-label="닫기"${actAttrs(p.onClose)}>${Icon({ name: 'close', size: 14 })}</button>` : ''}</div>`;
}

// ── K11 EmptyState: 아이콘 + 한 줄 + (설명) + 할 수 있는 행동 ──

export interface EmptyStateProps { icon?: IconName; title: string; text?: string; action?: string; compact?: boolean; className?: string }

export function EmptyState(p: EmptyStateProps): string {
  return `<div class="${cx('po-empty', p.compact && 'is-compact', p.className)}"><span class="po-empty__icon">${Icon({ name: p.icon ?? 'info', size: p.compact ? 20 : 28 })}</span>${
    p.compact ? `<span class="po-empty__main"><b class="po-empty__title">${esc(p.title)}</b>${p.text ? `<span class="po-empty__text">${esc(p.text)}</span>` : ''}</span>`
      : `<b class="po-empty__title">${esc(p.title)}</b>${p.text ? `<span class="po-empty__text">${esc(p.text)}</span>` : ''}`}${
    p.action ? `<span class="po-empty__action">${p.action}</span>` : ''}</div>`;
}

// ── K13 ToolBar: 홈 머리말 도구 줄 — < · 날짜 글자 · 아이콘 단추(최대 4) ──

export interface ToolBarItem extends Action { icon: IconName; label: string; badge?: number; on?: boolean }
export interface ToolBarProps {
  /** 왼쪽 < (초기화면). false 면 자리만 비움 */
  back?: Action | false;
  backLabel?: string;
  date?: string;
  items: ToolBarItem[];
  className?: string;
}
export const TOOLBAR_MAX = 4;

export function ToolBar(p: ToolBarProps): string {
  const back = p.back
    ? `<button type="button" class="po-toolbar__btn po-toolbar__back" aria-label="${esc(p.backLabel ?? '초기화면')}"${actAttrs(p.back)}>${Icon({ name: 'chevron-right', size: 18, strokeWidth: 2.4, style: 'transform:scaleX(-1)' })}</button>`
    : '';
  const items = p.items.slice(0, TOOLBAR_MAX).map((it) => `<button type="button" class="${cx('po-toolbar__btn', it.on && 'is-on')}" aria-label="${esc(it.badge ? `${it.label} ${it.badge}` : it.label)}" title="${esc(it.label)}"${actAttrs(it)}>${
    Icon({ name: it.icon, size: 18 })}${it.badge ? `<b class="po-toolbar__badge po-num">${it.badge > 99 ? '99+' : it.badge}</b>` : ''}</button>`).join('');
  return `<div class="${cx('po-toolbar', p.className)}" role="toolbar" aria-label="홈 도구">${back}${p.date ? `<span class="po-toolbar__date po-num">${esc(p.date)}</span>` : ''}<span class="po-toolbar__sp"></span>${items}</div>`;
}

// ── K14 PlayerRow: 선수 줄 1종 — 사진(없으면 꺾인 판 + 첫 글자) · 이름 · 메타 · 오른쪽 값 ──

export interface PlayerRowProps extends Action {
  name: string;
  meta?: string;
  photo?: string;
  rank?: number | string;
  value?: number | string;
  unit?: string;
  mine?: boolean;
  badge?: string;
  selected?: boolean;
  dim?: boolean;
  className?: string;
}

/** 사진 없음 판 글자: 공백 뺀 첫 글자 */
export const playerInitial = (name: string): string => Array.from(name.replace(/\s/g, ''))[0] ?? '';

export function PlayerRow(p: PlayerRowProps): string {
  const tag = p.act ? 'button' : 'div';
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="${cx('po-prow', p.mine && 'is-mine', p.selected && 'is-selected', p.dim && 'is-dim', p.className)}"${actAttrs(p)}>${
    p.rank != null ? `<span class="po-prow__rank po-num">${esc(p.rank)}</span>` : ''}<span class="po-prow__photo">${
    p.photo ? `<img src="${esc(p.photo)}" alt="" loading="lazy">` : `<span class="po-prow__ini">${esc(playerInitial(p.name))}</span>`}</span><span class="po-prow__main"><span class="po-prow__name"><span class="po-prow__nm">${esc(p.name)}</span>${
    p.mine ? '<i class="po-prow__me">나</i>' : ''}${p.badge ? `<span class="po-prow__badge">${esc(p.badge)}</span>` : ''}</span>${p.meta ? `<span class="po-prow__meta">${esc(p.meta)}</span>` : ''}</span>${
    p.value != null ? `<span class="po-prow__value"><b class="po-num">${esc(p.value)}</b>${p.unit ? `<small>${esc(p.unit)}</small>` : ''}</span>` : ''}${
    p.act ? Icon({ name: 'chevron-right', size: 16, className: 'po-prow__go' }) : ''}</${tag}>`;
}
