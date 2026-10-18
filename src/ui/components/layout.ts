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
export interface TabsProps {
  items: TabItem[]; value: string; variant?: 'segment' | 'underline' | 'nav'; fill?: boolean; label?: string; /** onChange 대신: data-act 와 data-v=탭 id */ act?: string; data?: Record<string, string>;
  /** 가로 스크롤 + 오른쪽 흐림 (요청 5: 다 안 보여도 되는 섹션 이동 칩 줄) */
  scroll?: boolean;
  /** 격자 열 수 (요청 5: 탭 6개 이상 = cols 3, 폰 3×2) */
  cols?: number;
}

export function Tabs(p: TabsProps): string {
  const variant = p.variant ?? 'segment';
  const tabs = p.items.map((it) => {
    const on = it.id === p.value;
    return `<button type="button" role="tab" aria-selected="${on}" class="${cx('po-tab', on && 'is-on')}"${actAttrs({ act: p.act, data: { ...p.data, v: it.id } })}>${
      it.icon ? Icon({ name: it.icon, size: variant === 'nav' ? 22 : 16, strokeWidth: on && variant === 'nav' ? 2.4 : 2 }) : ''}<span>${esc(it.label)}</span>${
      it.badge != null ? `<span class="po-dotbadge po-num">${it.badge}</span>` : ''}</button>`;
  }).join('');
  return `<div class="${cx('po-tabs', `po-tabs--${variant}`, p.fill && 'po-tabs--fill', p.scroll && 'po-tabs--scroll', p.cols && 'po-tabs--grid')}" role="tablist"${p.label ? ` aria-label="${esc(p.label)}"` : ''}${
    p.cols ? ` style="grid-template-columns: repeat(${p.cols}, minmax(0, 1fr))"` : ''}>${tabs}</div>`;
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
  /** 작은 머리말 (C.39 홈: 큰 숫자를 줄인다) */
  compact?: boolean;
  /** B 테마 미페 머리말 (C.57, B-apply 2절): 사진 주소. 없으면 일반 머리말 */
  face?: string;
  /** 배경 없는 사진(누끼)이면 true → 디자인 그대로, 아니면 네모 사진을 같은 자리에 */
  cutout?: boolean;
  /** 등번호 (두 자리면 작게) */
  kit?: number | string;
  /** 큰 이름 (Black Han Sans, 길면 글자 크기를 줄인다) */
  name?: string;
  /** OVR 아래 작은 글자 ("OVR · LW") */
  unit?: string;
}

/** 미페 머리말 이름 칸 폭(폰 390: left 16 ~ right 130)과 글자 크기: 풀 50 · compact 36 → 최소 24px (B-apply 2절) */
export const HERO_NAME = { width: 244, full: 50, compact: 36, min: 24 } as const;

/** Black Han Sans 글자 폭 근사(em): 한글 0.83 · 공백 0.3 · 라틴·숫자 0.56 · 그 밖 0.5. 실측 손흥민 50px = 125px, 바스티안 슈바인슈타이거 ≈ 25.8px에서 244px */
export function heroNameEm(name: string): number {
  let w = 0;
  for (const ch of name) w += /[\uac00-\ud7a3]/.test(ch) ? 0.83 : ch === ' ' ? 0.3 : /[A-Za-z0-9]/.test(ch) ? 0.56 : 0.5;
  return w;
}

/** 이름이 칸에 맞는 글자 크기 (정수 px, base → min). 화면에서는 그린 뒤 실제 폭으로 한 번 더 맞춘다 (main.ts fitHeroNames) */
export function heroNameSize(name: string, compact = false, width: number = HERO_NAME.width): number {
  const base = compact ? HERO_NAME.compact : HERO_NAME.full;
  const em = heroNameEm(name);
  return em <= 0 ? base : Math.max(HERO_NAME.min, Math.min(base, Math.floor(width / em)));
}

/** 글자 머리말 판별 (bundle.js HeroPanel): 숫자·기호·단위 한 글자 말고 다른 글자가 있으면 글자 값 (48px 한 줄, compact 22px) */
export const heroIsText = (v: unknown): boolean => typeof v === 'string' && /[^0-9.,:/%+\-−·× ]/.test(v.replace(/[위세점명P일R골개]$/, ''));

function faceHero(p: HeroPanelProps): string {
  const kit = p.kit != null ? String(p.kit) : '';
  const back = p.back
    ? `<button type="button" class="po-hero__back" aria-label="뒤로"${actAttrs(p.back)}>${Icon({ name: 'chevron-right', size: 18, strokeWidth: 2.4, style: 'transform:scaleX(-1)' })}</button>`
    : '<span class="po-hero__noback"></span>';
  const name = p.name ?? '';
  const size = heroNameSize(name, p.compact);
  const chips = p.chips
    ? `<div class="po-hero__chips">${p.chips.map((c) => {
      const ch = typeof c === 'string' ? { label: c } : c;
      return `<span class="${cx('po-hero__chip', ch.soft && 'is-soft')}">${esc(ch.label)}</span>`;
    }).join('')}</div>`
    : '';
  return `<section class="${cx('po-hero po-hero--face', p.compact && 'po-hero--compact', !p.cutout && 'is-square')}">${
    kit ? `<span class="${cx('po-hero__kit po-num', kit.length > 1 && 'is-two')}" aria-hidden="true">${esc(kit)}</span>` : ''}<img class="${cx('po-hero__face', !p.cutout && 'is-square')}" src="${esc(p.face!)}" alt="${esc(name)}"><span class="po-hero__line" aria-hidden="true"></span><span class="po-hero__slab" aria-hidden="true"></span><div class="po-hero__bar">${back}<span class="po-hero__title">${esc(p.title)}</span><span class="po-hero__right">${p.rightHtml ?? esc(p.right ?? '')}</span></div><div class="po-hero__who">${
    p.eyebrow ? `<span class="po-hero__eyebrow">${esc(p.eyebrow)}</span>` : ''}<span class="po-hero__name" data-fit="${p.compact ? HERO_NAME.compact : HERO_NAME.full}" style="font-size:${size}px;line-height:${Math.round(size * 1.08)}px">${esc(name)}</span>${chips}</div>${
    p.value != null ? `<div class="po-hero__num"><span class="po-hero__value po-num">${esc(p.value)}</span>${p.unit ? `<span class="po-hero__unit">${esc(p.unit)}</span>` : ''}</div>` : ''}${p.children ?? ''}</section>`;
}

export function HeroPanel(p: HeroPanelProps): string {
  if (p.face) return faceHero(p);
  const pct = p.total ? Math.round((Number(p.value) / p.total) * 100) : null;
  const val = typeof p.value === 'number' && p.pad !== false ? String(p.value).padStart(2, '0') : p.value;
  const isText = heroIsText(val);
  const back = p.back
    ? `<button type="button" class="po-hero__back" aria-label="뒤로"${actAttrs(p.back)}>${Icon({ name: 'chevron-right', size: 18, strokeWidth: 2.4, style: 'transform:scaleX(-1)' })}</button>`
    : '<span class="po-hero__noback"></span>';
  const chips = p.chips
    ? `<div class="po-hero__chips">${p.chips.map((c) => {
      const ch = typeof c === 'string' ? { label: c } : c;
      return `<span class="${cx('po-hero__chip', ch.soft && 'is-soft')}">${esc(ch.label)}</span>`;
    }).join('')}</div>`
    : '';
  return `<section class="${cx('po-hero', p.compact && 'po-hero--compact', isText && 'po-hero--text')}"><div class="${cx('po-hero__bar', !p.back && 'is-noback')}">${back}<span class="po-hero__title">${esc(p.title)}</span><span class="po-hero__right">${p.rightHtml ?? esc(p.right ?? '')}</span></div>${
    p.eyebrow ? `<span class="po-hero__eyebrow">${esc(p.eyebrow)}</span>` : ''}${
    val != null ? `<div class="${cx('po-hero__num', p.unit && 'has-unit')}"><span class="po-hero__value po-num">${esc(val)}</span>${p.total != null ? `<span class="po-hero__total po-num">/ ${p.total}</span>` : ''}${p.unit ? `<span class="po-hero__unit">${esc(p.unit)}</span>` : ''}</div>` : ''}${
    pct != null && p.progress !== false ? `<div class="po-hero__progress"><span class="po-hero__track"><i style="width:${pct}%"></i></span><span class="po-num">${pct}%</span></div>` : ''}${
    chips}${p.children ?? ''}</section>`;
}

// ── SectionTitle ──

export interface SectionTitleProps { title: string; action?: string; as?: 'h2' | 'h3'; /** 오른쪽 글자를 버튼으로 (C.58 "전체 보기 ›") */ onAction?: Action }

export function SectionTitle(p: SectionTitleProps): string {
  const tag = p.as ?? 'h2';
  return `<div class="po-section"><span class="po-section__bar" aria-hidden="true"></span><${tag} class="po-section__title">${esc(p.title)}</${tag}>${
    p.action ? (p.onAction ? `<button type="button" class="po-section__action po-section__link"${actAttrs(p.onAction)}>${esc(p.action)}</button>` : `<span class="po-section__action">${esc(p.action)}</span>`) : ''}</div>`;
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

export interface ModalProps { title: string; children?: string; icon?: IconName; tone?: 'info' | 'warning' | 'danger'; actions?: string[]; open?: boolean; inline?: boolean; onClose?: Action;
  /** 제목 아래 작은 꼬리표 (디자인 65 "새 기능") */
  badge?: string;
  /** 본문 아래 표 (디자인 98 수락 확인: 계약 · 주급 · 팀 전력 …) */
  rows?: [string, string][] }

export function Modal(p: ModalProps): string {
  if (p.open === false) return '';
  const box = `<div class="po-modal" role="dialog" aria-modal="${!p.inline}" aria-label="${esc(p.title)}">${
    p.icon ? `<span class="po-modal__icon po-modal__icon--${p.tone ?? 'info'}">${Icon({ name: p.icon, size: 24 })}</span>` : ''}<b class="po-modal__title">${esc(p.title)}</b>${p.badge ? `<span class="po-modal__badge">${esc(p.badge)}</span>` : ''}${
    p.rows?.length ? `<dl class="po-modal__rows">${p.rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd class="po-num">${esc(v)}</dd></div>`).join('')}</dl>` : ''}${
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
