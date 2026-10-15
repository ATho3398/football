// 화면 골격 컴포넌트 (bundle.js 옮김, H.6 2번): AppBar, Tabs, HeroPanel, SectionTitle, Banner, Toast, Modal, BottomSheet

import { Crest, Icon, IconButton, type IconName } from './basic';
import { actAttrs, cx, esc, type Action } from './html';

// ── AppBar ──

export interface AppBarProps {
  team: string;
  subtitle?: string;
  crest?: string | false;
  /** 알림(인박스)은 5단계 기능이다. 값이 없으면 종 아이콘을 숨긴다 (I.1 점진 공개) */
  unread?: number;
  /** onSave 대신 동작. 없으면 저장 아이콘을 숨긴다 */
  save?: Action;
  /** 오른쪽 추가 아이콘 (I.19 8번 설정 톱니). 없으면 숨긴다 */
  extra?: Action & { name: IconName; label: string };
}

export function AppBar(p: AppBarProps): string {
  return `<header class="po-appbar"><div class="po-appbar__title">${p.crest !== false ? Crest({ name: p.team, size: 24, src: p.crest }) : ''}<div><b>${esc(p.team)}</b><small>${esc(p.subtitle ?? '')}</small></div></div><div class="po-appbar__actions">${
    p.unread != null ? IconButton({ name: 'bell', label: '알림', variant: 'ghost', badge: p.unread }) : ''}${
    p.save ? IconButton({ ...p.save, name: 'disk', label: '저장', variant: 'ghost' }) : ''}${
    p.extra ? IconButton({ ...p.extra, variant: 'ghost' }) : ''}</div></header>`;
}

// ── Tabs ──

export interface TabItem { id: string; label: string; icon?: IconName; badge?: number }
export interface TabsProps { items: TabItem[]; value: string; variant?: 'segment' | 'underline' | 'nav'; fill?: boolean; label?: string; /** onChange 대신: data-act 와 data-v=탭 id */ act?: string; data?: Record<string, string> }

export function Tabs(p: TabsProps): string {
  const variant = p.variant ?? 'segment';
  const tabs = p.items.map((it) => {
    const on = it.id === p.value;
    return `<button type="button" role="tab" aria-selected="${on}" class="${cx('po-tab', on && 'is-on')}"${actAttrs({ act: p.act, data: { ...p.data, v: it.id } })}>${
      it.icon ? Icon({ name: it.icon, size: variant === 'nav' ? 22 : 16, strokeWidth: on && variant === 'nav' ? 2.4 : 2 }) : ''}<span>${esc(it.label)}</span>${
      it.badge != null ? `<span class="po-dotbadge po-num">${it.badge}</span>` : ''}</button>`;
  }).join('');
  return `<div class="${cx('po-tabs', `po-tabs--${variant}`, p.fill && 'po-tabs--fill')}" role="tablist"${p.label ? ` aria-label="${esc(p.label)}"` : ''}>${tabs}</div>`;
}

// ── HeroPanel ──

export interface HeroPanelProps {
  title: string;
  /** 오른쪽 글자 (이스케이프됨) 또는 rightHtml */
  right?: string;
  rightHtml?: string;
  /** 뒤로 가기 동작. false 면 숨김 */
  back?: Action | false;
  eyebrow?: string;
  value?: number | string;
  total?: number;
  pad?: boolean;
  progress?: boolean;
  chips?: (string | { label: string; soft?: boolean })[];
  children?: string;
}

export function HeroPanel(p: HeroPanelProps): string {
  const pct = p.total ? Math.round((Number(p.value) / p.total) * 100) : null;
  const val = typeof p.value === 'number' && p.pad !== false ? String(p.value).padStart(2, '0') : p.value;
  const back = p.back
    ? `<button type="button" class="po-hero__back" aria-label="뒤로"${actAttrs(p.back)}>${Icon({ name: 'chevron-right', size: 18, strokeWidth: 2.4, style: 'transform:scaleX(-1)' })}</button>`
    : '<span></span>';
  const chips = p.chips
    ? `<div class="po-hero__chips">${p.chips.map((c) => {
      const ch = typeof c === 'string' ? { label: c } : c;
      return `<span class="${cx('po-hero__chip', ch.soft && 'is-soft')}">${esc(ch.label)}</span>`;
    }).join('')}</div>`
    : '';
  return `<section class="po-hero"><div class="po-hero__bar">${back}<span class="po-hero__title">${esc(p.title)}</span><span class="po-hero__right">${p.rightHtml ?? esc(p.right ?? '')}</span></div>${
    p.eyebrow ? `<span class="po-hero__eyebrow">${esc(p.eyebrow)}</span>` : ''}${
    val != null ? `<div class="po-hero__num"><span class="po-hero__value po-num">${esc(val)}</span>${p.total != null ? `<span class="po-hero__total po-num">/ ${p.total}</span>` : ''}</div>` : ''}${
    pct != null && p.progress !== false ? `<div class="po-hero__progress"><span class="po-hero__track"><i style="width:${pct}%"></i></span><span class="po-num">${pct}%</span></div>` : ''}${
    chips}${p.children ?? ''}</section>`;
}

// ── SectionTitle ──

export interface SectionTitleProps { title: string; action?: string; as?: 'h2' | 'h3' }

export function SectionTitle(p: SectionTitleProps): string {
  const tag = p.as ?? 'h2';
  return `<div class="po-section"><span class="po-section__bar" aria-hidden="true"></span><${tag} class="po-section__title">${esc(p.title)}</${tag}>${
    p.action ? `<span class="po-section__action">${esc(p.action)}</span>` : ''}</div>`;
}

// ── Banner / Toast ──

const BANNER_ICON: Record<string, IconName> = { injury: 'injury', warning: 'danger', info: 'info', success: 'check' };

export interface BannerProps { tone?: 'injury' | 'warning' | 'info' | 'success'; title: string; children?: string; action?: string; onAction?: Action }

export function Banner(p: BannerProps): string {
  const tone = p.tone ?? 'info';
  return `<div class="${cx('po-banner', `po-banner--${tone}`)}" role="${tone === 'injury' || tone === 'warning' ? 'alert' : 'status'}"><span class="po-banner__icon">${Icon({ name: BANNER_ICON[tone]!, size: 18 })}</span><div class="po-banner__body"><b>${esc(p.title)}</b>${
    p.children ? `<p>${esc(p.children)}</p>` : ''}</div>${p.action ? `<button type="button" class="po-banner__action"${actAttrs(p.onAction ?? {})}>${esc(p.action)}</button>` : ''}</div>`;
}

const TOAST_ICON: Record<string, IconName> = { levelup: 'levelup', badge: 'star', card: 'combo', info: 'info' };

export interface ToastProps { kind?: 'levelup' | 'badge' | 'card' | 'info'; title: string; body?: string; action?: string; onAction?: Action }

export function Toast(p: ToastProps): string {
  const kind = p.kind ?? 'info';
  return `<div class="${cx('po-toast', `po-toast--${kind}`)}" role="status"><span class="po-toast__icon">${Icon({ name: TOAST_ICON[kind]!, size: 22 })}</span><div class="po-toast__body"><b>${esc(p.title)}</b>${
    p.body ? `<span>${esc(p.body)}</span>` : ''}</div>${p.action ? `<button type="button" class="po-toast__action"${actAttrs(p.onAction ?? {})}>${esc(p.action)}</button>` : ''}</div>`;
}

// ── BottomSheet / Modal (겹침 바깥을 누르면 onClose 동작) ──

export interface BottomSheetProps { title?: string; eyebrow?: string; subtitle?: string; children?: string; footer?: string; open?: boolean; inline?: boolean; onClose?: Action }

export function BottomSheet(p: BottomSheetProps): string {
  if (p.open === false) return '';
  const head = p.title || p.eyebrow
    ? `<div class="po-sheet__head">${p.eyebrow ? `<span class="po-sheet__eyebrow">${esc(p.eyebrow)}</span>` : ''}${p.title ? `<b>${esc(p.title)}</b>` : ''}${p.subtitle ? `<p>${esc(p.subtitle)}</p>` : ''}</div>`
    : '';
  const sheet = `<div class="po-sheet" role="dialog" aria-modal="${!p.inline}"${p.title ? ` aria-label="${esc(p.title)}"` : ''}><span class="po-sheet__grip" aria-hidden="true"></span>${head}<div class="po-sheet__body">${p.children ?? ''}</div>${
    p.footer ? `<div class="po-sheet__foot">${p.footer}</div>` : ''}</div>`;
  return p.inline ? sheet : `<div class="po-overlay po-overlay--sheet" data-overlay="1"${actAttrs(p.onClose ?? {})}>${sheet}</div>`;
}

export interface ModalProps { title: string; children?: string; icon?: IconName; tone?: 'info' | 'warning' | 'danger'; actions?: string[]; open?: boolean; inline?: boolean; onClose?: Action }

export function Modal(p: ModalProps): string {
  if (p.open === false) return '';
  const box = `<div class="po-modal" role="dialog" aria-modal="${!p.inline}" aria-label="${esc(p.title)}">${
    p.icon ? `<span class="po-modal__icon po-modal__icon--${p.tone ?? 'info'}">${Icon({ name: p.icon, size: 24 })}</span>` : ''}<b class="po-modal__title">${esc(p.title)}</b>${
    p.children ? `<div class="po-modal__body">${esc(p.children)}</div>` : ''}${p.actions ? `<div class="po-modal__actions">${p.actions.join('')}</div>` : ''}</div>`;
  return p.inline ? box : `<div class="po-overlay" data-overlay="1"${actAttrs(p.onClose ?? {})}>${box}</div>`;
}

// ── FitBadge / OptionRow (4단계 잔여: 주 포지션 변경 요청 시트, 배지 목록) ──

const FIT = { good: ['잘 맞음', '✓'], ok: ['보통', '–'], bad: ['안 맞음', '✕'] } as const;

export function FitBadge(p: { fit: 'good' | 'ok' | 'bad'; label?: string }): string {
  const [l, s] = FIT[p.fit];
  return `<span class="po-fit po-fit--${p.fit}" aria-label="적합도 ${l}"><i aria-hidden="true">${s}</i>${p.label ? `${esc(p.label)} ${l}` : l}</span>`;
}

export interface OptionRowProps extends Action {
  title: string; desc?: string; note?: string; icon?: IconName; fit?: 'good' | 'ok' | 'bad'; tag?: string; right?: string;
  selected?: boolean; radio?: boolean; disabled?: boolean;
}

export function OptionRow(p: OptionRowProps): string {
  const el = p.act ? 'button' : 'div';
  const right = p.right || p.fit || p.tag
    ? `<span class="po-option__right">${p.tag ? `<span class="po-option__tag">${esc(p.tag)}</span>` : ''}${p.fit ? FitBadge({ fit: p.fit }) : ''}${p.right ?? ''}</span>`
    : '';
  return `<${el}${el === 'button' ? ' type="button"' : ''} class="${cx('po-option', p.selected && 'is-on', p.disabled && 'is-disabled')}"${p.radio ? ` role="radio" aria-checked="${!!p.selected}"` : ''}${actAttrs(p)}${p.disabled && el === 'button' ? ' disabled' : ''}>${
    p.icon ? `<span class="po-option__icon">${Icon({ name: p.icon, size: 20 })}</span>` : ''}<span class="po-option__main"><b>${esc(p.title)}</b>${p.desc ? `<span>${esc(p.desc)}</span>` : ''}${
    p.note ? `<em class="po-option__note">${Icon({ name: 'signature', size: 12, strokeWidth: 2.2 })}${esc(p.note)}</em>` : ''}</span>${right}${p.radio ? '<span class="po-option__radio" aria-hidden="true"></span>' : ''}</${el}>`;
}
