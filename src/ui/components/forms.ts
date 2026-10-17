// 요청 5·6 입력·칩 컴포넌트 (부록 C.54, bundle.js 옮김): TextField · Stepper · PointBar · TagChip · PixelTile.
// 클래스·치수는 bundle.css .po-field / .po-stepper / .po-pointbar / .po-tag / .po-pixel. 화면 연결은 U5-b~g 패치가 한다

import { Icon, type IconName } from './basic';
import { actAttrs, cx, esc, signed, type Action } from './html';

// ── TextField ──

export interface TextFieldProps {
  value?: string; placeholder?: string; label?: string; count?: string; hint?: string; icon?: IconName; focused?: boolean; clearable?: boolean;
  /** 진짜 입력칸 (지정하면 <input>, 없으면 디자인처럼 표시만) */
  input?: { id?: string; name?: string; maxLength?: number; type?: 'text' | 'search' };
  /** 지우기 동작 */
  onClear?: Action;
}

export function TextField(p: TextFieldProps): string {
  const has = p.value != null && p.value !== '';
  const value = p.input
    ? `<input class="po-field__value" type="${p.input.type ?? 'text'}"${p.input.id ? ` id="${esc(p.input.id)}"` : ''}${p.input.name ? ` name="${esc(p.input.name)}"` : ''}${
      p.input.maxLength ? ` maxlength="${p.input.maxLength}"` : ''} value="${esc(p.value ?? '')}"${p.placeholder ? ` placeholder="${esc(p.placeholder)}"` : ''}>`
    : `<span class="${cx('po-field__value', !has && 'is-ph')}">${esc(has ? p.value! : p.placeholder ?? '')}${p.focused ? '<i class="po-field__caret"></i>' : ''}</span>`;
  const clear = has && p.clearable !== false
    ? `<span class="po-field__clear" role="button" aria-label="지우기"${actAttrs(p.onClear ?? {})}>${Icon({ name: 'close', size: 14, strokeWidth: 2.6 })}</span>` : '';
  return `<label class="${cx('po-field', p.focused && 'is-focus')}">${
    p.label ? `<span class="po-field__label">${esc(p.label)}${p.count ? `<span class="po-num">${esc(p.count)}</span>` : ''}</span>` : ''}<span class="po-field__box">${
    p.icon ? Icon({ name: p.icon, size: 18 }) : ''}${value}${clear}</span>${p.hint ? `<span class="po-field__hint">${esc(p.hint)}</span>` : ''}</label>`;
}

// ── Stepper (− 값 +: 나이·키·몸무게) ──

export interface StepperProps {
  label?: string; value: number; unit?: string; min?: number; max?: number; range?: string;
  /** 값이 주는 영향 한 줄 (포인트·상한) */
  sub?: string; subTone?: 'gain' | 'cost' | 'warn'; disabled?: boolean; size?: 'md' | 'sm';
  onMinus?: Action; onPlus?: Action;
}

export function Stepper(p: StepperProps): string {
  const dis = !!p.disabled;
  const atMin = dis || (p.min != null && p.value <= p.min);
  const atMax = dis || (p.max != null && p.value >= p.max);
  const range = p.range ?? (p.min != null && p.max != null ? `${p.min}~${p.max}${p.unit ?? ''}` : null);
  const name = p.label ?? '값';
  const btn = (icon: IconName, off: boolean, a: Action | undefined, what: string) =>
    `<button type="button" class="po-stepper__btn"${off ? ' disabled' : ''} aria-label="${esc(name)} ${what}"${actAttrs(a ?? {})}>${Icon({ name: icon, size: 18, strokeWidth: 2.6 })}</button>`;
  return `<div class="${cx('po-stepper', dis && 'is-disabled', p.size === 'sm' && 'po-stepper--sm')}">${
    p.label || range ? `<span class="po-stepper__head">${p.label ? `<b>${esc(p.label)}</b>` : ''}${range ? `<span class="po-num">${esc(range)}</span>` : ''}</span>` : ''}<span class="po-stepper__box">${
    btn('minus', atMin, p.onMinus, '내리기')}<span class="po-stepper__mid"><span class="po-stepper__val"><b class="po-num">${p.value}</b>${p.unit ? `<small>${esc(p.unit)}</small>` : ''}</span>${
    p.sub ? `<span class="${cx('po-stepper__sub', p.subTone && `is-${p.subTone}`)}">${esc(p.sub)}</span>` : ''}</span>${btn('plus', atMax, p.onPlus, '올리기')}</span></div>`;
}

// ── PointBar (배분 포인트 띠: 남음 / 0 / 초과) ──

export interface PointBarProps { left: number; total: number; label?: string; items?: { label: string; value: number; base?: boolean }[]; message?: string; sticky?: boolean }

export type PointBarState = 'left' | 'zero' | 'over';
export const pointBarState = (left: number): PointBarState => (left < 0 ? 'over' : left === 0 ? 'zero' : 'left');

export function PointBar(p: PointBarProps): string {
  const st = pointBarState(p.left);
  const total = p.total || 0;
  const pct = total > 0 ? Math.max(0, Math.min(1, (total - p.left) / total)) : 0;
  const msg = p.message ?? (st === 'over' ? `✕ ${-p.left}P 넘쳤어요 · 시작할 수 없어요` : st === 'zero' ? '✓ 다 썼어요' : '남았어요');
  const items = p.items?.length
    ? `<span class="po-pointbar__items">${p.items.map((it) => {
      const z = !it.value;
      return `<span class="${cx('po-pointbar__item', !z && (it.value > 0 ? 'is-plus' : 'is-minus'), it.base && 'is-base')}">${esc(it.label)} <b class="po-num">${it.base ? it.value : z ? '0' : signed(it.value, 0)}</b></span>`;
    }).join('')}</span>` : '';
  return `<div class="${cx('po-pointbar', `is-${st}`, p.sticky && 'is-sticky')}" role="status" aria-live="polite"><div class="po-pointbar__row"><span class="po-pointbar__label">${esc(p.label ?? '배분 포인트')}</span><b class="po-pointbar__left po-num">${p.left}<small>P</small></b><span class="po-pointbar__total po-num">/ ${total}P</span><span class="po-pointbar__msg">${esc(msg)}</span></div><span class="po-pointbar__track"><i style="width:${st === 'over' ? 100 : pct * 100}%"></i></span>${items}</div>`;
}

// ── TagChip (색 = 장점/단점/효과 없음 · 앞 기호 = 종류 · 점선 + 시계 = 해제형 · 취소선 = 해제됨) ──

export type TagKind = 'gen' | 'career' | 'play' | 'story';
export interface TagChipProps extends Action {
  name: string; kind?: TagKind; polarity?: 'pro' | 'con';
  /** 해제형: 해제 조건 글 */
  release?: string; released?: boolean;
  /** 효과 범위 (예: 프리킥) */
  scope?: string; showScope?: boolean; desc?: string; size?: 'md' | 'sm';
}

const TAG_KIND: Record<TagKind, { l: string; i?: IconName }> = { gen: { l: '생성 태그' }, career: { l: '커리어 태그', i: 'pin' }, play: { l: '플레이 태그', i: 'star' }, story: { l: '스토리 태그', i: 'chat' } };

export function TagChip(p: TagChipProps): string {
  const kind: TagKind = p.kind && TAG_KIND[p.kind] ? p.kind : 'gen';
  const pol = kind === 'story' ? 'none' : p.polarity ?? 'pro';
  const K = TAG_KIND[kind];
  const rel = !!p.release;
  const sm = p.size === 'sm';
  const tip = [K.l + (pol === 'pro' ? ' · 장점' : pol === 'con' ? ' · 단점' : ''), p.scope && `${p.scope}에서만 효과`, rel && `해제형 · ${p.release}`, p.released && '해제됨', p.desc].filter(Boolean).join('\n');
  const tag = p.act ? 'button' : 'span';
  const mark = K.i ? Icon({ name: K.i, size: sm ? 11 : 13, strokeWidth: 2.6, filled: kind === 'play' }) : pol === 'con' ? '−' : '+';
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="${cx('po-tag', `po-tag--${kind}`, `po-tag--${pol}`, rel && 'is-release', p.released && 'is-released', sm && 'po-tag--sm')}" title="${esc(tip)}" aria-label="${esc(`${p.name} — ${tip.replace(/\n/g, ' · ')}`)}"${actAttrs(p)}><span class="po-tag__mark" aria-hidden="true">${mark}</span><span class="po-tag__name">${esc(p.name)}</span>${
    p.scope && p.showScope ? `<span class="po-tag__scope">${esc(p.scope)}</span>` : ''}${
    rel ? `<span class="po-tag__rel" aria-hidden="true">${Icon({ name: 'clock', size: sm ? 10 : 12, strokeWidth: 2.6 })}</span>` : ''}${
    kind === 'story' ? '<span class="po-tag__none">효과 없음</span>' : ''}</${tag}>`;
}

// ── PixelTile (16px 도트 정수배) ──

export interface PixelSprite { kind?: 'person' | 'kit'; skin?: string; hair?: string; hairStyle?: 'short' | 'long' | 'curly'; kit?: string; kit2?: string; pattern?: 'solid' | 'stripe' | 'hoop' }
export interface PixelTileProps extends Action { sprite?: PixelSprite; src?: string; /** 직접 그린 그림 (게임 도트 겹친 이미지, C.59) */ art?: string; scale?: number; label?: string; title?: string; selected?: boolean; isDefault?: boolean; disabled?: boolean }

const PX_PERSON = ['................', '.....hhhhhh.....', '....hhhhhhhh....', '....hssssssh....', '....ssssssss....', '....sesssses....', '....ssssssss....', '.....ssssss.....',
  '......ssss......', '...tttttttttt...', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..', '..tttttttttttt..'];
const PX_KIT = ['................', '................', '...tttc..cttt...', '..ttttcccctttt..', '.tttttttttttttt.', 'tttttttttttttttt', 'tttttttttttttttt', 'ttt.tttttttt.ttt',
  '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '....tttttttt....', '................'];

function pixelMap(sp: PixelSprite): string[] {
  let m = (sp.kind === 'kit' ? PX_KIT : PX_PERSON).slice();
  if (sp.kind === 'kit') return m;
  if (sp.hair === 'none') m = m.map((r, i) => (i === 1 ? '................' : i === 2 ? '.....ssssss.....' : r.replace(/h/g, 's')));
  else if (sp.hairStyle === 'long') { m[4] = '...hssssssssh...'; m[5] = '...h' + 'sesssses' + 'h...'; m[6] = '...hssssssssh...'; m[7] = '....hssssssh....'; }
  else if (sp.hairStyle === 'curly') { m[0] = '....hhhhhhhh....'; m[1] = '...hhhhhhhhhh...'; m[2] = '...hhhhhhhhhh...'; m[3] = '...hhssssssh....'; }
  return m;
}

export function pixelSprite(sp: PixelSprite, size: number): string {
  const col: Record<string, string> = { h: sp.hair && sp.hair !== 'none' ? sp.hair : '#2a1d16', s: sp.skin ?? '#e8b894', e: '#121317', t: sp.kit ?? 'var(--team-home)', c: sp.kit2 ?? '#f3f4f6' };
  let rects = '';
  pixelMap(sp).forEach((row, y) => {
    for (let x = 0; x < 16; x++) {
      const ch = row[x];
      if (!ch || ch === '.') continue;
      let f = col[ch]!;
      if (ch === 't' && sp.pattern === 'stripe' && Math.floor(x / 2) % 2 === 1) f = col.c!;
      if (ch === 't' && sp.pattern === 'hoop' && Math.floor(y / 2) % 2 === 1) f = col.c!;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" style="fill:${f}"/>`;
    }
  });
  return `<svg class="po-pixel__svg" width="${size}" height="${size}" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export function PixelTile(p: PixelTileProps): string {
  const sc = Math.max(1, Math.min(6, Math.round(p.scale ?? 3)));
  const size = 16 * sc;
  const tag = p.act ? 'button' : 'div';
  const title = p.title ?? p.label;
  return `<${tag}${tag === 'button' ? ` type="button" aria-pressed="${!!p.selected}"` : ''} class="${cx('po-pixel', p.selected && 'is-selected', p.isDefault && 'is-default', p.disabled && 'is-disabled')}" style="--px-size:${size}px"${
    title ? ` title="${esc(title)}"` : ''}${actAttrs(p)}${p.disabled && tag === 'button' ? ' disabled' : ''}><span class="po-pixel__art">${
    p.art ?? (p.src ? `<img src="${esc(p.src)}" width="${size}" height="${size}" alt="" class="po-pixel__img">` : pixelSprite(p.sprite ?? {}, size))}${
    p.isDefault ? '<span class="po-pixel__def">기본</span>' : ''}${
    p.selected ? `<span class="po-pixel__check">${Icon({ name: 'check', size: 10, strokeWidth: 3.2 })}</span>` : ''}</span>${
    p.label != null ? `<span class="po-pixel__label">${esc(p.label)}</span>` : ''}</${tag}>`;
}
