// 게임 카드 (디자인 GameCard, bundle.js 옮김, 부록 C.39): full 280×392 · deck 0.6배 · mini(덱 슬롯) · hand(경기 중 패).
// 그림(art, C.48)이 있으면 그림 칸(280×210, 사선 아래는 글자 패널)에 이미지를, 없거나 못 읽으면 기본 장면을 그린다.
// C.68c: 그림은 디자인 B CardScene 대로 SVG <image> — artSquare(1:1 원본)·artPosMini(mini·hand)·flip·rotate·옮긴 가장자리 거울 채움.
// 기본 장면(C.54 디자인 144·요청 6): 단색 + 하프라인·센터서클 + 종류 아이콘(희귀도 색 55%). 옛 골문·수비벽·궤적 장면은 placeholder: 'scene'.
// 이미지 층(.po-art-g)은 기본 장면 위에 얹어 404 면 지워도 기본 장면이 보인다 (main 의 error 리스너). 클래스·치수는 bundle.css .po-card / .po-gc / .po-mc

import { Icon, type IconName } from './basic';
import { FILLED, ICON_PATHS } from './iconPaths';
import { actAttrs, cx, esc, type Action } from './html';

export type GameCardType = 'play' | 'setpiece' | 'passive' | 'combo' | 'manage' | 'signature' | 'order';
export type GameCardRarity = 'common' | 'rare' | 'epic' | 'legend';
export type GameCardPos = 'all' | 'att' | 'mid' | 'def';

export interface GameCardData {
  name: string;
  type: GameCardType;
  rarity: GameCardRarity;
  level: number;
  /** 효과 문장: 앞 · 강조 수치(희귀도 색) · 뒤 */
  effect: { pre: string; hi?: string; post?: string };
  condition: { text: string; met: boolean; current?: string | number };
  pos?: GameCardPos;
  isNew?: boolean;
  count?: number;
  /** 카드 그림 URL (C.48, cardArtUrl) */
  art?: string;
  /** 그림 위치·확대 (디자인 artPos, 정식·덱): x 오른쪽 %, y 위로 % (그림 칸 기준), zoom 1~4, flip 좌우 반전, rotate 도(−45~45) */
  artPos?: ArtPos;
  /** 간략 카드(mini·hand) 위치. 없으면 artPos (C.68c) */
  artPosMini?: ArtPos;
  /** 1:1 원본: 가로 280 에 맞추고 세로는 칸 밖으로 넘침 (y 로 고름, C.68c) */
  artSquare?: boolean;
  /** 그림 없을 때 기본 장면 (C.54): 'type' = 단색 + 종류 아이콘(기본), 'scene' = 옛 골문 장면 */
  placeholder?: 'type' | 'scene';
}

export interface ArtPos { x: number; y: number; zoom: number; flip?: boolean; rotate?: number }

export interface GameCardProps extends Action {
  card: GameCardData;
  size: 'full' | 'deck' | 'mini' | 'hand';
  state?: 'normal' | 'selected' | 'disabled' | 'locked';
  reason?: string;
  className?: string;
}

const TYPE_KO: Record<GameCardType, string> = { play: '플레이', setpiece: '세트피스', passive: '패시브', combo: '콤보', manage: '관리', signature: '시그니처', order: '지시 · 이행' };
const TYPE_ICON: Record<GameCardType, IconName> = { play: 'newchoice', setpiece: 'setpiece', passive: 'passive', combo: 'combo', manage: 'manage', signature: 'signature', order: 'order' };
const RARITY_KO: Record<GameCardRarity, string> = { common: '일반', rare: '희귀', epic: '에픽', legend: '전설' };
const POS_KO: Record<GameCardPos, string> = { all: '공용', att: '공격', mid: '미드', def: '수비' };

const CARD_W = 280;
const CARD_H = 392;
const ART_H = 210;
const TRAJ: Record<string, string> = {
  setpiece: 'M44 268 Q 120 70 200 150', passive: 'M44 268 Q 110 200 180 170', combo: 'M44 268 Q 90 120 170 130', manage: 'M44 268 Q 160 120 210 190',
  order: 'M44 268 Q 100 150 150 150 Q 190 150 205 110', play: 'M44 268 Q 70 120 140 140 Q 200 160 214 108', signature: 'M44 268 Q 140 40 206 168',
};
const CUT = { clip: 'M0 0H280V172L0 206Z', overlay: [{ d: 'M0 211L280 177V182L0 216Z', op: 1 }, { d: 'M0 221L280 187V189L0 223Z', op: 0.5 }] };
const SCENE = (() => {
  let net = '';
  let wall = '';
  for (let x = 84; x <= 196; x += 14) net += `M${x} 124V212 `;
  for (let y = 136; y <= 204; y += 14) net += `M72 ${y}H208 `;
  for (const x of [112, 130, 148, 166]) wall += `M${x - 7} 224V200a7 7 0 0 1 14 0V224Z M${x - 6} 184a6 6 0 1 0 12 0a6 6 0 1 0-12 0Z `;
  return { net, wall };
})();

/** 기본 장면 (요청 6): 단색 바탕 + 하프라인·센터서클(흰 7%) + 종류 아이콘(희귀도 색 55%). 좌표는 280×210 그림 칸 기준 */
function typeScene(type: GameCardType, thin: boolean): string {
  const ic = TYPE_ICON[type];
  const fill = FILLED[ic] ? 'var(--r)' : 'none';
  return `<rect x="0" y="0" width="${CARD_W}" height="440" fill="#1a1d24"/>
    <path d="M0 150H280" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
    <circle cx="140" cy="150" r="64" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="2"/>
    <svg x="92" y="${thin ? 36 : 64}" width="96" height="96" viewBox="0 0 24 24" style="fill:${fill};stroke:var(--r)" stroke-width="${thin ? 2.2 : 1.6}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"><path d="${ICON_PATHS[ic]}"/></svg>`;
}

/** 기본 그림: 그림 없으면 종류 장면, placeholder 'scene' 이면 옛 장면(조명 아래 골문, 수비벽, 공의 궤적) */
function scene(type: GameCardType, thin: boolean, placeholder?: GameCardData['placeholder']): string {
  if (placeholder !== 'scene') return typeScene(type, thin);
  return `<rect x="0" y="0" width="${CARD_W}" height="440" fill="#1a1d24"/>
    <circle cx="150" cy="40" r="190" style="fill:var(--r)" fill-opacity="0.12"/><circle cx="150" cy="40" r="100" style="fill:var(--r)" fill-opacity="0.12"/>
    <path d="M60 0H100L190 440H30Z" fill="#ffffff" fill-opacity="0.06"/><path d="M200 0H232L270 440H150Z" fill="#ffffff" fill-opacity="0.05"/>
    <path d="M0 232L280 212V440H0Z" fill="#20242c"/><path d="M0 262L280 242" stroke="#ffffff" stroke-opacity="0.2" stroke-width="2"/>
    <path d="${SCENE.net}" stroke="#ffffff" stroke-opacity="0.22" stroke-width="${thin ? 1.5 : 1}"/>
    <path d="M70 214V120H210V206" stroke="#e9ecf1" stroke-width="${thin ? 7 : 5}" fill="none" stroke-linejoin="round"/>
    <path d="${SCENE.wall}" fill="#0b0c0f"/>
    <path d="${TRAJ[type] ?? TRAJ.passive}" style="stroke:var(--r)" stroke-width="${thin ? 6 : 3}" stroke-dasharray="${thin ? '12 10' : '7 6'}" fill="none" stroke-linecap="round"/>
    <circle cx="44" cy="268" r="${thin ? 14 : 11}" fill="#f3f4f6"/>${thin ? '' : '<path d="M44 263l4.5 3.2-1.7 5.3h-5.6l-1.7-5.3z" fill="#121317"/>'}`;
}

let clipSeq = 0;

const n = (v: unknown): number => +(v as number) || 0;

/** 그림 층 (디자인 B CardScene 옮김): 칸 크기 기준 이동 + 확대, flip·rotate 는 그림 자기 가운데 기준, 옮기면 가장자리를 거울로 이어 채운다 */
export function artLayer(href: string, p: ArtPos | undefined, sq: boolean | undefined): string {
  const z = Math.max(1, Math.min(4, n(p?.zoom) || 1));
  const iw = CARD_W * z;
  const ih = sq ? iw : ART_H * z;
  const ix = (CARD_W - iw) / 2 + (n(p?.x) * CARD_W) / 100;
  const iy = (ART_H - ih) / 2 - (n(p?.y) * ART_H) / 100;
  const img = (t?: string) => `<image href="${esc(href)}" x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid slice"${t ? ` transform="${t}"` : ''}/>`;
  const rot = Math.max(-45, Math.min(45, n(p?.rotate)));
  const cx = ix + iw / 2;
  const cy = iy + ih / 2;
  const moved = n(p?.x) !== 0 || n(p?.y) !== 0 || rot !== 0;
  const tf = `${rot ? `rotate(${rot} ${cx} ${cy}) ` : ''}${p?.flip ? `translate(${2 * cx} 0) scale(-1 1)` : ''}`.trim();
  const mirror = moved ? img(`translate(0 ${2 * (iy + ih)}) scale(1 -1)`) + img(`translate(0 ${2 * iy}) scale(1 -1)`) + img(`translate(${2 * ix} 0) scale(-1 1)`) + img(`translate(${2 * (ix + iw)} 0) scale(-1 1)`) : '';
  return `<rect x="0" y="0" width="${CARD_W}" height="${ART_H}" fill="#121317"/><g${tf ? ` transform="${tf}"` : ''}>${mirror}${img()}</g>`;
}

function artG(c: GameCardData, mini: boolean): string {
  return `<g class="po-art-g" data-mini="${mini ? 1 : 0}">${artLayer(c.art!, mini ? c.artPosMini ?? c.artPos : c.artPos, c.artSquare)}</g>`;
}

function fullCard(c: GameCardData): string {
  const id = `po-clip-${++clipSeq}`;
  const e = c.effect;
  const cond = c.condition;
  return `<div class="po-gc">
    <svg class="po-gc__art" width="${CARD_W}" height="${CARD_H}" viewBox="0 0 ${CARD_W} ${CARD_H}" aria-hidden="true">
      <defs><clipPath id="${id}"><path d="${CUT.clip}"/></clipPath></defs>
      <g clip-path="url(#${id})"><g transform="translate(0 -10)">${scene(c.type, false, c.placeholder)}</g>${c.art ? artG(c, false) : ''}</g>
      ${CUT.overlay.map((o) => `<path d="${o.d}" style="fill:var(--r)" opacity="${o.op}"/>`).join('')}
    </svg>
    <div class="po-gc__top"><span class="po-gc__rarity">${RARITY_KO[c.rarity]}</span><span class="po-gc__chip">${Icon({ name: TYPE_ICON[c.type], size: 12, strokeWidth: 2.6, style: 'color:var(--r)' })}${TYPE_KO[c.type]}</span></div>
    ${c.pos ? `<span class="po-gc__chip po-gc__pos po-pos--${c.pos}">${c.pos === 'def' ? Icon({ name: 'defense', size: 12, strokeWidth: 2.4 }) : ''}${POS_KO[c.pos]}</span>` : ''}
    <span class="po-gc__chip po-gc__lv">숙련 Lv ${c.level}</span>
    ${c.isNew ? '<span class="po-gc__new">NEW</span>' : ''}
    <div class="po-gc__body">
      <span class="po-gc__name">${esc(c.name)}</span>
      <div class="po-gc__effect"><span class="po-gc__label">효과</span><span class="po-gc__text">${esc(e.pre)}${e.hi ? `<b class="po-num">${esc(e.hi)}</b>` : ''}${esc(e.post ?? '')}</span></div>
      <div class="po-gc__cond"><span><b>조건</b> ${esc(cond.text)}</span>${cond.current != null || !cond.met
        ? `<span class="po-gc__state ${cond.met ? 'is-met' : 'is-unmet'}">${cond.met ? '✓ 충족' : '✕ 미달'}${cond.current != null ? ` · 현재 ${esc(cond.current)}` : ''}</span>` : ''}</div>
    </div>
  </div>`;
}

function miniCard(c: GameCardData): string {
  return `<svg class="po-mc__art" viewBox="${c.art || c.placeholder !== 'scene' ? '0 0 280 210' : '20 90 240 300'}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${scene(c.type, true, c.placeholder)}${c.art ? artG(c, true) : ''}</svg>
    <span class="po-mc__band"></span><span class="po-mc__dot"></span>
    ${c.pos === 'def' ? `<span class="po-mc__pos po-pos--def" title="수비">${Icon({ name: 'defense', size: 10, strokeWidth: 2.6 })}</span>` : ''}
    <span class="po-mc__name">${esc(c.name)}</span>
    ${c.count && c.count > 1 ? `<span class="po-mc__count po-num">×${c.count}</span>` : ''}`;
}

export function GameCard(p: GameCardProps): string {
  const c = p.card;
  const state = p.state ?? 'normal';
  const blocked = state === 'disabled' || state === 'locked';
  const full = p.size === 'full' || p.size === 'deck';
  const tag = p.act ? 'button' : 'div';
  const label = `${c.name} (${RARITY_KO[c.rarity]} ${TYPE_KO[c.type]}${c.pos ? ` · ${POS_KO[c.pos]}` : ''})`;
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="${cx('po-card', `po-card--${p.size}`, `po-rarity--${c.rarity}`, `is-${state}`, p.className)}"${actAttrs(p)} aria-label="${esc(label)}"${blocked && tag === 'button' ? ' aria-disabled="true"' : ''}>${
    full ? `<span class="po-card__scale">${fullCard(c)}</span>` : miniCard(c)}${
    !full && c.isNew ? '<span class="po-mc__new">NEW</span>' : ''}${
    blocked && p.reason ? `<span class="po-card__reason">${esc(p.reason)}</span>` : ''}</${tag}>`;
}
