// 기본 컴포넌트 (디자인 묶음 bundle.js 를 React 없이 옮김, H.6 2번): 클래스·치수는 bundle.css, props 이름은 index.d.ts 그대로

import { actAttrs, cx, esc, fmt1, signed, type Action } from './html';
import { FILLED, ICON_PATHS, type IconName } from './iconPaths';
import { autoEmblem, clubOf, crestSrc, faceSrc, type FaceRef } from '../faces';

export type { IconName };
export type DesignTier = 'normal' | 'key' | 'top' | 'world' | 'legend';

// ── Icon ──

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; filled?: boolean; label?: string; className?: string; style?: string }

export function Icon(p: IconProps): string {
  const size = p.size ?? 20;
  const filled = p.filled ?? !!FILLED[p.name];
  const aria = p.label ? `role="img" aria-label="${esc(p.label)}"` : 'aria-hidden="true"';
  return `<svg class="${cx('po-icon', p.className)}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${p.strokeWidth ?? 2}" stroke-linecap="round" stroke-linejoin="round" ${aria}${p.style ? ` style="${p.style}"` : ''}><path d="${ICON_PATHS[p.name]}"/></svg>`;
}

// ── FootPair (C.75x) ──

export interface FootPairProps { foot: 'left' | 'right'; weakFoot: number; /** 주발 숫자 (데이터에 없으면 5) */ main?: number; size?: number; className?: string }

/** 양발 발자국 두 개 (왼발 · 오른발): 각 발자국 안에 그 발 숫자 1~5. 주발 = 강조색(lime) 채움, 약발 = 흐린 테두리 */
export function FootPair(p: FootPairProps): string {
  const size = p.size ?? 34;
  const main = p.main ?? 5;
  const one = (side: 'left' | 'right') => {
    const isMain = side === p.foot;
    const n = isMain ? main : p.weakFoot;
    const flip = side === 'left' ? ' transform="matrix(-1 0 0 1 24 0)"' : '';
    return `<svg class="${cx('po-foot', isMain && 'is-main')}" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS.foot}"${flip}/><text x="${side === 'left' ? 11.8 : 12.2}" y="18.3" text-anchor="middle">${n}</text></svg>`;
  };
  const label = `주발 ${p.foot === 'left' ? '왼발' : '오른발'} ${main} · 약발 ${p.weakFoot}`;
  return `<span class="${cx('po-feet', p.className)}" role="img" aria-label="${label}">${one('left')}${one('right')}</span>`;
}

// ── Button ──

export interface ButtonProps extends Action {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: IconName;
  iconRight?: IconName;
  disabled?: boolean;
  className?: string;
  /** 버튼 글자 (이스케이프됨) */
  children?: string;
  label?: string;
}

export function Button(p: ButtonProps): string {
  const size = p.size ?? 'md';
  const is = size === 'sm' ? 16 : 20;
  return `<button type="button" class="${cx('po-btn', `po-btn--${p.variant ?? 'primary'}`, `po-btn--${size}`, p.block && 'po-btn--block', p.className)}"${actAttrs(p)}${p.disabled ? ' disabled' : ''}${p.label ? ` aria-label="${esc(p.label)}"` : ''}>${
    p.icon ? Icon({ name: p.icon, size: is }) : ''}${p.children != null ? `<span>${esc(p.children)}</span>` : ''}${p.iconRight ? Icon({ name: p.iconRight, size: is }) : ''}</button>`;
}

/** 아이콘 버튼 (bundle.css po-iconbtn, AppBar·StatBar 안에서 쓰는 모양) */
export function IconButton(p: Action & { name: IconName; label: string; variant?: 'ghost' | 'brand'; disabled?: boolean; badge?: number }): string {
  return `<button type="button" class="${cx('po-iconbtn', p.variant && `po-iconbtn--${p.variant}`)}" aria-label="${esc(p.label)}"${actAttrs(p)}${p.disabled ? ' disabled' : ''}>${Icon({ name: p.name })}${
    p.badge ? `<span class="po-dotbadge po-num">${p.badge}</span>` : ''}</button>`;
}

// ── Avatar / Crest ──

const DEFAULT_AVATAR = `<svg viewBox="0 0 160 160" width="100%" height="100%" aria-hidden="true"><rect width="160" height="160" fill="var(--surface-3)"/><circle cx="132" cy="28" r="44" fill="var(--line)"/><path d="M22 160c4-30 26-44 58-44s54 14 58 44z" fill="var(--brand)"/><path d="M62 118l18 18 18-18" fill="none" stroke="var(--on-brand)" stroke-width="5" stroke-linejoin="round"/><rect x="68" y="92" width="24" height="26" rx="8" fill="#d9a77f"/><ellipse cx="80" cy="70" rx="28" ry="32" fill="#e8b98f"/><path d="M51 66c-2-24 12-38 30-38 17 0 31 11 29 34-6-9-16-14-28-14-12 0-23 6-31 18z" fill="#1d1a19"/><ellipse cx="70" cy="74" rx="3" ry="4" fill="#1d1a19"/><ellipse cx="90" cy="74" rx="3" ry="4" fill="#1d1a19"/><path d="M73 88q7 5 14 0" fill="none" stroke="#9b6a4a" stroke-width="3" stroke-linecap="round"/></svg>`;

export interface AvatarProps {
  src?: string; name?: string; size?: number; shape?: 'circle' | 'square'; ring?: boolean;
  /** 선수 (부록 C.43): 페이스온 > 레포 사진 > 기본 얼굴 순으로 찾고, 없거나 깨지면 지금 아바타 */
  face?: FaceRef;
}

export function Avatar(p: AvatarProps): string {
  const size = p.size ?? 56;
  const radius = p.shape === 'square' ? 'var(--radius-md)' : '50%';
  const src = p.src ?? (p.face ? faceSrc(p.face) : undefined);
  if (!src) {
    return `<span class="${cx('po-avatar', p.ring && 'po-avatar--ring')}" style="width:${size}px;height:${size}px;border-radius:${radius}">${DEFAULT_AVATAR}</span>`;
  }
  // 이미지 (C.43 개정, 미니페이스): 원형 틀·테두리·배경 없이 정사각형 이미지 그대로 (PNG 는 얼굴만, JPG 는 사각).
  // 읽는 동안·못 읽으면 아래 기본 아바타가 보이고, 다 읽으면 숨긴다
  return `<span class="${cx('po-avatar', 'po-avatar--img', p.ring && 'is-mine')}" style="width:${size}px;height:${size}px"><span class="po-avatar__fb" style="border-radius:${radius}">${DEFAULT_AVATAR}</span><img src="${esc(src)}" alt="${esc(p.name ?? '')}" loading="lazy" decoding="async" onload="this.previousElementSibling.style.visibility='hidden'" onerror="this.remove()"></span>`;
}

export interface CrestProps { name: string; src?: string; size?: number; color?: string; /** 팀 id (없으면 이름으로 찾는다) */ team?: string }

/** 구단 엠블럼 (부록 C.43): 페이스온 > 레포 로고 > 자동 엠블럼(모양·팀 색·이니셜) */
export function Crest(p: CrestProps): string {
  const size = p.size ?? 28;
  const id = p.team ?? clubOf(p.name)?.id;
  const src = p.src ?? (id ? crestSrc(id) : undefined);
  const auto = autoEmblem(id ?? p.name, p.name || '?', size);
  if (!src) return auto;
  return `<span class="po-crest po-crest--img" style="width:${size}px;height:${Math.round(size * 1.125)}px">${auto}<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" decoding="async" onload="this.previousElementSibling.style.visibility='hidden'" onerror="this.remove()"></span>`;
}

// ── Badges & chips ──

const TIERS: Record<DesignTier, string> = { normal: '일반', key: '스페셜', top: '탑클래스', world: '월드클래스', legend: '레전더리' };
const TIER_ORDER: DesignTier[] = ['normal', 'key', 'top', 'world', 'legend'];

export interface TierBadgeProps { tier: DesignTier; score?: number; size?: 'sm' | 'md' }

export function TierBadge(p: TierBadgeProps): string {
  const idx = TIER_ORDER.indexOf(p.tier);
  const pips = TIER_ORDER.map((_, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('');
  return `<span class="${cx('po-tier', `po-tier--${p.tier}`, p.size === 'sm' && 'po-tier--sm')}"><span class="po-tier__pips" aria-hidden="true">${pips}</span><span>${TIERS[p.tier]}</span>${
    p.score != null ? `<b class="po-num">${p.score}</b>` : ''}</span>`;
}

/** 평점 색 단계 (I.1): 5.0 미만, 5~6, 6~7, 7~8, 8 이상 */
export const ratingStep = (v: number): number => (v < 5 ? 1 : v < 6 ? 2 : v < 7 ? 3 : v < 8 ? 4 : 5);

export interface RatingBadgeProps { value: number; delta?: number; size?: 'sm' | 'md' | 'lg' }

export function RatingBadge(p: RatingBadgeProps): string {
  const d = p.delta;
  const delta = d == null ? ''
    : `<span class="${cx('po-delta', d > 0 ? 'is-up' : d < 0 ? 'is-down' : 'is-flat')}">${d > 0 ? '▲' : d < 0 ? '▼' : ''}${signed(d)}</span>`;
  return `<span class="po-rating-wrap"><span class="${cx('po-rating', `po-rating--${p.size ?? 'md'}`, `po-rating--s${ratingStep(p.value)}`)}" aria-label="평점 ${fmt1(p.value)}">${fmt1(p.value)}</span>${delta}</span>`;
}

export interface StatChipProps { label?: string; value?: string | number; icon?: IconName; tone?: 'neutral' | 'brand' | 'mine' | 'success' | 'fail' | 'warning' }

export function StatChip(p: StatChipProps): string {
  return `<span class="${cx('po-chip', `po-chip--${p.tone ?? 'neutral'}`)}">${p.icon ? Icon({ name: p.icon, size: 14 }) : ''}${
    p.label ? `<span class="po-chip__label">${esc(p.label)}</span>` : ''}${p.value != null ? `<b class="po-num">${esc(p.value)}</b>` : ''}</span>`;
}

// ── Meters ──

export interface MeterProps { value: number; max?: number; gain?: number; label?: string; showValue?: boolean; tone?: 'brand' | 'xp' | 'mine' | 'warning'; size?: 'md' | 'lg'; className?: string }

export function Meter(p: MeterProps): string {
  const max = p.max ?? 100;
  const pct = Math.max(0, Math.min(100, (p.value / max) * 100));
  const gain = p.gain ? Math.min(100 - pct, (p.gain / max) * 100) : 0;
  const head = p.label || p.showValue
    ? `<div class="po-meter__head"><span class="po-meter__label">${esc(p.label ?? '')}</span>${
      p.showValue ? `<span class="po-num po-meter__value">${p.value}${p.gain ? ` +${p.gain}` : ''} / ${max}</span>` : ''}</div>`
    : '';
  return `<div class="${cx('po-meter', `po-meter--${p.tone ?? 'brand'}`, p.size === 'lg' && 'po-meter--lg', p.className)}">${head}<div class="po-meter__track" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${p.value}"${p.label ? ` aria-label="${esc(p.label)}"` : ''}><div class="po-meter__fill" style="width:${pct}%"></div>${
    gain > 0 ? `<div class="po-meter__gain" style="left:${pct}%;width:${gain}%"></div>` : ''}</div></div>`;
}

export interface FatigueGaugeProps { /** 내부 피로 0~100 (표시는 체력 = 100 − 피로, C.44) */ value: number; compact?: boolean }

/** 화면 체력 (C.44 pending 52 2번): 100 − 내부 피로. 내부 값·밸런스는 그대로 */
export const staminaOf = (fatigue: number): number => Math.max(0, Math.min(100, 100 - Math.round(fatigue || 0)));

/** 체력 게이지: 100 → 0, 낮을수록 빨강 (체력 30 이하 = 빨강, 60 이하 = 주황) */
export function FatigueGauge(p: FatigueGaugeProps): string {
  const v = staminaOf(p.value);
  const level = v > 60 ? 'low' : v > 30 ? 'mid' : 'high';
  const on = Math.ceil(v / 10);
  const segs = Array.from({ length: 10 }, (_, i) => `<i class="${i < on ? 'on' : ''}"></i>`).join('');
  return `<div class="${cx('po-fatigue', `po-fatigue--${level}`, p.compact && 'po-fatigue--compact')}" role="meter" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100" aria-label="체력">${
    p.compact ? '' : '<span class="po-fatigue__label">체력</span>'}<span class="po-fatigue__segs">${segs}</span><b class="po-num">${v}</b></div>`;
}

const FORMS: [string, IconName][] = [['최악', 'double-down'], ['나쁨', 'arrow-down'], ['보통', 'arrow-flat'], ['좋음', 'arrow-up'], ['최고', 'double-up']];

export interface FormIndicatorProps { level: 1 | 2 | 3 | 4 | 5; showLabel?: boolean; size?: number }

export function FormIndicator(p: FormIndicatorProps): string {
  const lv = Math.max(1, Math.min(5, p.level));
  const [l, i] = FORMS[lv - 1]!;
  return `<span class="${cx('po-form', `po-form--${lv}`)}" aria-label="폼 ${l}"><span class="po-form__icon">${Icon({ name: i, size: p.size ?? 18, strokeWidth: 2.5 })}</span>${
    p.showLabel !== false ? `<span class="po-form__label">${l}</span>` : ''}</span>`;
}

// ── StatBar ──

const statStep = (v: number) => (v < 40 ? 1 : v < 55 ? 2 : v < 65 ? 3 : v < 75 ? 4 : 5);

export interface StatBarProps {
  label: string; value: number; max?: number; add?: number; editable?: boolean; cost?: number; ovrDelta?: number; maxed?: boolean; locked?: boolean; highlight?: boolean;
  /** onPlus / onMinus 대신 동작 */
  plus?: Action; minus?: Action;
}

export function StatBar(p: StatBarProps): string {
  const max = p.max ?? 99;
  const add = p.add ?? 0;
  const w = (n: number) => `${(n / max) * 100}%`;
  const ctrl = p.editable
    ? `<span class="po-statbar__ctrl"><span class="${cx('po-statbar__cost', (p.cost ?? 0) >= 2 && 'is-warn')}">${p.cost != null ? `<small>비용</small><b class="po-num">${p.cost}</b>` : ''}</span><span class="po-statbar__ovr po-num">${
      p.ovrDelta != null && !p.maxed ? `OVR +${p.ovrDelta}` : p.maxed ? '최대' : ''}</span><button type="button" class="po-iconbtn" aria-label="${esc(p.label)} 내리기"${actAttrs(p.minus ?? {})}${add <= 0 || !p.minus ? ' disabled' : ''}>${Icon({ name: 'minus', size: 16 })}</button><button type="button" class="po-iconbtn po-iconbtn--brand" aria-label="${esc(p.label)} 올리기"${actAttrs(p.plus ?? {})}${p.maxed || p.locked ? ' disabled' : ''}>${Icon({ name: p.maxed ? 'lock' : 'plus', size: 16 })}</button></span>`
    : '';
  return `<div class="${cx('po-statbar', p.editable && 'po-statbar--edit', p.highlight && 'is-highlight')}"><span class="po-statbar__label">${esc(p.label)}</span><span class="po-statbar__track"><span class="${cx('po-statbar__fill', `po-step-${statStep(p.value)}`)}" style="width:${w(p.value)}"></span>${
    add > 0 ? `<span class="po-statbar__add" style="left:${w(p.value)};width:${w(add)}"></span>` : ''}</span><span class="po-statbar__value po-num">${p.value + add}${add > 0 ? `<small>+${add}</small>` : ''}</span>${ctrl}</div>`;
}

// ── PlayerCard ──

export interface PlayerCardData { name: string; age: number; position: string; ovr: number; tier: DesignTier; tierScore?: number; level: number; xp?: number; xpMax?: number; team: string; avatar?: string; crest?: string; face?: FaceRef }
export interface PlayerCardProps { player: PlayerCardData; variant?: 'full' | 'compact' }

export function PlayerCard(props: PlayerCardProps): string {
  const p = props.player;
  if (props.variant === 'compact') {
    return `<div class="${cx('po-pcard', 'po-pcard--compact', `po-tierframe--${p.tier}`)}">${Avatar({ src: p.avatar, name: p.name, size: 48, face: p.face })}<div class="po-pcard__main"><div class="po-pcard__name">${esc(p.name)}</div><div class="po-pcard__meta">${esc(p.position)} · ${p.age}세 · ${esc(p.team)}</div></div><div class="po-pcard__ovrbox"><b class="po-num">${p.ovr}</b><small>OVR</small></div></div>`;
  }
  return `<div class="${cx('po-pcard', `po-tierframe--${p.tier}`)}"><div class="po-pcard__top"><div class="po-pcard__ovr"><b class="po-num">${p.ovr}</b><span class="po-pcard__pos">${esc(p.position)}</span></div>${
    Avatar({ src: p.avatar, name: p.name, size: 96, shape: 'square', face: p.face })}<div class="po-pcard__side">${Crest({ name: p.team, src: p.crest, size: 28 })}<span class="po-pcard__lv">LV<b class="po-num">${p.level}</b></span></div></div><div class="po-pcard__name">${esc(p.name)}</div><div class="po-pcard__meta">${p.age}세 · ${esc(p.team)}</div><div class="po-pcard__tier">${
    TierBadge({ tier: p.tier, score: p.tierScore, size: 'sm' })}</div>${p.xp != null ? Meter({ value: p.xp, max: p.xpMax, label: 'XP', showValue: true, tone: 'xp', className: 'po-pcard__xp' }) : ''}</div>`;
}
