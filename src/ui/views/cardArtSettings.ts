// 설정 → 꾸미기 → 카드 이미지 (부록 C.48, C.59 디자인 140~143): 카드 목록(검색·종류 칩·그림 없음만·상태 칩) → 편집 화면(지금 쓰는 그림,
// full·덱 슬롯·경기 패·목록 썸네일 미리보기, 버튼 3) → 위치·확대 시트(안내선·슬라이더 값). 사용자 그림은 이 브라우저(IndexedDB)에만, 경기 중에는 잠금

import { CARDS, cardById, type CardDef } from '../../config/cards';
import { Banner, Button, GameCard, Icon, Tabs, TextField, esc, type GameCardData, type GameCardType } from '../components';
import { cardArtPos, cardArtSource, CARD_ART_FILES, cardArtUrl, userArtCount, type ArtPos } from '../cardArt';
import { gameCardData } from './deck';
import { isWide } from '../skin';

export type CardKindFilter = 'all' | GameCardType;

export interface CardArtUI {
  q: string;
  kind: CardKindFilter;
  /** 그림 없음만 */
  none: boolean;
  /** 고른 카드 id */
  sel: string | null;
  /** 목록 전체 보기 (C.59: 처음엔 8장) */
  more?: boolean;
  /** 위치·확대 맞추기 중: fresh = 방금 올린 이미지(저장 때 정규화), 아니면 저장된 내 그림 위치만 */
  crop: null | ({ id: string; name: string; src: string; fresh: boolean } & ArtPos);
}

export const CARD_ART_UI_DEFAULT: CardArtUI = { q: '', kind: 'all', none: false, sel: null, crop: null };

const KINDS: { id: CardKindFilter; label: string }[] = [
  { id: 'all', label: '전체' }, { id: 'play', label: '플레이' }, { id: 'setpiece', label: '세트피스' }, { id: 'passive', label: '패시브' },
  { id: 'combo', label: '콤보' }, { id: 'manage', label: '관리' }, { id: 'signature', label: '시그니처' }, { id: 'order', label: '지시' },
];
const RARITY_KO = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' } as const;
const SOURCE_KO = { user: '내 그림', default: '기본 그림', none: '그림 없음' } as const;

/** 거르기 결과 (테스트·화면 공용) */
export function cardArtList(ui: Pick<CardArtUI, 'q' | 'kind' | 'none'>): CardDef[] {
  const q = ui.q.trim().toLowerCase();
  return CARDS.filter((d) => {
    if (ui.kind !== 'all' && gameCardData(d).type !== ui.kind) return false;
    if (ui.none && cardArtSource(d.id) !== 'none') return false;
    return !q || d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q);
  });
}

/** 목록 처음 보이는 수 (디자인 140) */
export const CARD_ART_PAGE = 8;

function thumb(d: CardDef): string {
  const url = cardArtUrl(d.id);
  const type = gameCardData(d).type;
  return `<span class="ca-thumb po-rarity--${d.rarity === 'legendary' ? 'legend' : d.rarity}">${url ? `<img class="po-art" src="${esc(url)}" alt="" loading="lazy" decoding="async">` : Icon({ name: KIND_ICON[type], size: 20 })}</span>`;
}

const KIND_ICON: Record<GameCardType, 'play' | 'setpiece' | 'passive' | 'combo' | 'manage' | 'signature' | 'order'> = {
  play: 'play', setpiece: 'setpiece', passive: 'passive', combo: 'combo', manage: 'manage', signature: 'signature', order: 'order',
};

const srcChip = (src: keyof typeof SOURCE_KO): string => `<span class="po-chip ca-src ca-src--${src}">${SOURCE_KO[src]}</span>`;

function row(d: CardDef, sel: string | null): string {
  const type = gameCardData(d).type;
  const kind = KINDS.find((k) => k.id === type)?.label ?? type;
  return `<button type="button" class="real-row ca-row${d.id === sel ? ' is-on' : ''}" data-act="ca-pick" data-key="${esc(d.id)}">${thumb(d)}
    <span class="grow"><b>${esc(d.name)}</b><small>${esc(kind)} · <span class="ca-rar ca-rar--${d.rarity}">${RARITY_KO[d.rarity]}</span></small></span>${srcChip(cardArtSource(d.id))}</button>`;
}

/** 머리말 글 (설정 화면이 그린다) */
export function cardArtHero(ui: CardArtUI, locked: boolean): { eyebrow: string; chips: (string | { label: string; soft?: boolean })[] } {
  const d = ui.sel ? cardById(ui.sel) : undefined;
  const withArt = CARDS.filter((c) => CARD_ART_FILES.has(c.id.replace(/^sig-/, ''))).length;
  if (d) {
    const kind = KINDS.find((k) => k.id === gameCardData(d).type)?.label ?? '';
    const src = cardArtSource(d.id);
    const pos = src === 'user' ? cardArtPos(d.id) : undefined;
    return {
      eyebrow: `${d.name} · ${kind} · ${RARITY_KO[d.rarity]}`,
      chips: locked ? [{ label: '경기 중 · 보기만', soft: true }] : [SOURCE_KO[src], ...(pos ? [{ label: `위치 확대 ${pos.zoom.toFixed(1)}배`, soft: true }] : [])],
    };
  }
  return { eyebrow: '설정 · 꾸미기 · 카드 그림 바꾸기', chips: locked ? [{ label: '경기 중 · 보기만', soft: true }] : [`내 그림 ${userArtCount()}장`, { label: `기본 그림 ${withArt}장 · 카드 ${CARDS.length}장`, soft: true }] };
}

const lockBanner = (): string => Banner({ tone: 'warning', title: '경기가 끝나면 바꿀 수 있어요', children: '경기 중에는 카드 이미지를 볼 수만 있어요. 아래 버튼이 모두 잠겨요.' });

/** 편집 화면 (디자인 141·142): 지금 쓰는 그림 3칸(표시만) · full 미리보기 · 덱 슬롯·경기 패·목록 썸네일 · 버튼 3 */
function editor(d: CardDef, locked: boolean): string {
  const src = cardArtSource(d.id);
  const card = gameCardData(d);
  const hasDefault = CARD_ART_FILES.has(d.id.replace(/^sig-/, ''));
  const note = src === 'user' ? '내가 올린 그림' : src === 'default' ? `기본 그림(카드 일러스트) ${CARDS.filter((c) => CARD_ART_FILES.has(c.id.replace(/^sig-/, ''))).length}장 중 하나` : '그림 없음 · 종류 아이콘 기본 장면';
  const now = `<div class="ca-now"><div class="kv"><b>지금 쓰는 그림</b><small class="muted">${esc(note)}</small></div>${
    Tabs({ items: (['user', 'default', 'none'] as const).map((k) => ({ id: k, label: SOURCE_KO[k] })), value: src, fill: true, label: '지금 쓰는 그림' }).replace(/<button /g, '<button disabled ')}</div>`;
  const lockIcon = locked ? 'lock' : undefined;
  const btns = `<div class="ca-edit__btns">${Button({ size: 'lg', block: true, icon: lockIcon ?? 'upload', act: 'ca-upload', data: { key: d.id }, disabled: locked, children: src === 'user' ? '다시 올리기' : '이미지 올리기' })}
    <div class="btn-row even">${Button({ variant: 'secondary', block: true, icon: lockIcon ?? 'sliders', act: 'ca-adjust', data: { key: d.id }, disabled: locked || src !== 'user', children: '위치 맞추기' })}${
      Button({ variant: 'secondary', block: true, icon: lockIcon ?? 'restore', act: 'ca-clear', data: { key: d.id }, disabled: locked || src !== 'user', children: '기본으로' })}</div></div>`;
  return `${locked ? lockBanner() : ''}${now}
    <div class="ca-edit ca-editor"><div class="ca-edit__card">${GameCard({ card, size: 'full' })}</div>
      <div class="ca-edit__minis"><span>${GameCard({ card, size: 'mini' })}<small>덱 슬롯</small></span><span>${GameCard({ card, size: 'hand' })}<small>경기 패</small></span><span>${thumb(d)}<small>목록 썸네일</small></span></div></div>
    ${btns}
    <p class="small muted">정사각형·가로 그림도 돼요. 원본은 자르지 않고 위치·확대 값만 저장해요. 버튼 규칙: 기본 그림·그림 없음 = [이미지 올리기]만 · 내 그림 = 세 버튼 모두.${
      src === 'user' ? ` [기본으로]를 누르면 ${hasDefault ? '기본 그림' : '그림 없음(기본 장면)'}으로 돌아가요.` : ''}</p>`;
}

/** 슬라이더 한 줄 (디자인 70·143: 이름 · 지금 값 · 양 끝 글) */
export function rangeRow(id: string, label: string, min: number, max: number, value: number, text: string, ends: [string, string]): string {
  return `<div class="set-range"><div class="set-range__head"><b>${esc(label)}</b><span class="set-range__val po-num" id="${id}-v">${esc(text)}</span></div>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${value}" aria-label="${esc(label)}">
    <div class="set-range__ends"><small>${esc(ends[0])}</small><small>${esc(ends[1])}</small></div></div>`;
}

/** 슬라이더 값 글 (카드 그림: x 오른쪽 +, y 위 +) */
export function caRangeText(id: 'ca-zoom' | 'ca-x' | 'ca-y', n: number): string {
  if (id === 'ca-zoom') return `${(n / 100).toFixed(1)}배`;
  if (!n) return '가운데';
  return id === 'ca-x' ? `${n > 0 ? '오른쪽' : '왼쪽'} ${Math.abs(n)}%` : `${n > 0 ? '위로' : '아래로'} ${Math.abs(n)}%`;
}

/** 위치·확대 시트 (디자인 143): 실제 카드 틀(full) + 덱 슬롯(mini), 안내선 범례, 슬라이더 3 + [가운데로] */
function cropSheet(c: NonNullable<CardArtUI['crop']>): string {
  const d = cardById(c.id);
  const base: GameCardData = d ? gameCardData(d) : { name: c.name, type: 'play', rarity: 'common', level: 1, effect: { pre: '' }, condition: { text: '', met: true } };
  const card: GameCardData = { ...base, art: c.src, artPos: { x: c.x, y: c.y, zoom: c.zoom } };
  const zoom = Math.round(c.zoom * 100);
  return `<div class="po-overlay po-overlay--sheet"><div class="po-sheet fo-crop ca-crop" role="dialog" aria-modal="true" aria-label="카드 그림 위치 맞추기"><span class="po-sheet__grip" aria-hidden="true"></span>
    <div class="po-sheet__head"><span class="po-sheet__eyebrow">카드 이미지</span><b>위치·확대 맞추기</b><p>그림 칸 가로 4 : 세로 3에 맞춰요. 원본은 자르지 않아요.</p></div>
    <div class="po-sheet__body">
      <div class="ca-crop__stage" id="ca-prev"><div class="ca-crop__full">${GameCard({ card, size: 'full' })}<i class="ca-guide" aria-hidden="true"></i></div>
        <div class="ca-crop__mini">${GameCard({ card, size: 'mini' })}<small class="muted">덱 슬롯</small>
          <ul class="ca-legend"><li><i class="is-brand"></i>카드 = 그림 칸</li><li><i class="is-white"></i>사선 아래는 글자 칸이라 가려져요</li><li><i class="is-cyan"></i>덱 슬롯·경기 패는 가운데만 보여요</li></ul></div></div>
      ${rangeRow('ca-zoom', '확대', 100, 400, zoom, caRangeText('ca-zoom', zoom), ['1배', '4배'])}
      ${rangeRow('ca-x', '좌우', -50, 50, Math.round(c.x), caRangeText('ca-x', Math.round(c.x)), ['왼쪽 50%', '오른쪽 50%'])}
      ${rangeRow('ca-y', '위아래', -50, 50, Math.round(c.y), caRangeText('ca-y', Math.round(c.y)), ['아래 50%', '위 50%'])}
    </div>
    <div class="po-sheet__foot"><div class="btn-row ca-crop__foot">${Button({ variant: 'ghost', icon: 'restore', act: 'ca-crop-center', children: '가운데로' })}${Button({ variant: 'secondary', size: 'lg', act: 'ca-crop-cancel', children: '취소' })}${Button({ size: 'lg', block: true, icon: 'check', act: 'ca-crop-save', children: '저장' })}</div></div>
  </div></div>`;
}

/** 꾸미기 → 카드 이미지 본문 (목록 140 / 편집 141 / 경기 중 142) */
export function cardArtSection(ui: CardArtUI, locked: boolean): string {
  const sel = ui.sel ? cardById(ui.sel) : undefined;
  const wide = isWide();
  if (sel && !wide) return `${editor(sel, locked)}<input type="file" id="ca-file" accept="image/*" hidden>`;
  const list = cardArtList(ui);
  const counts = { user: 0, default: 0, none: 0 };
  for (const d of CARDS) counts[cardArtSource(d.id)]++;
  const kinds = Tabs({ items: KINDS.map((k) => ({ id: k.id, label: k.id === 'all' ? `전체 ${CARDS.length}` : k.label })), value: ui.kind, act: 'ca-kind', scroll: true, label: '종류 거르기' });
  const shown = ui.more ? list : list.slice(0, CARD_ART_PAGE);
  const left = list.length - shown.length;
  const listHtml = `${locked && !wide ? lockBanner() : ''}
    <div class="ca-prio">${Icon({ name: 'info', size: 16 })}<span class="grow">우선순위 <b>내 그림 › 기본 그림 › 기본 장면</b></span></div>
    ${TextField({ value: ui.q, placeholder: '카드 이름', icon: 'search', input: { id: 'ca-q', type: 'search', maxLength: 20 }, clearable: false })}
    ${kinds}
    <div class="ca-count"><small class="muted">${CARDS.length}장 · 내 그림 ${counts.user} · 기본 그림 ${counts.default} · 그림 없음 ${counts.none}</small>
      <button type="button" class="set-switch${ui.none ? ' is-on' : ''}" data-act="ca-none" role="switch" aria-checked="${ui.none}"><i aria-hidden="true"></i>그림 없음만</button></div>
    <div class="real-list ca-list">${shown.map((d) => row(d, ui.sel)).join('') || '<p class="small muted">맞는 카드가 없어요.</p>'}</div>
    ${left > 0 ? Button({ variant: 'ghost', block: true, icon: 'chevron-down', act: 'ca-more', children: `${left}장 더 보기` }) : ''}
    <div class="panel ca-legend-panel"><b class="small">상태 칩 3종</b><div class="ca-legend-chips">${srcChip('user')}${srcChip('default')}${srcChip('none')}</div>
      <p class="small muted">썸네일은 덱에서 보일 모습 그대로(그림 없음 = 종류 아이콘 기본 장면). 테두리 = 희귀도. 줄을 누르면 편집 화면으로 가요.</p></div>
    <input type="file" id="ca-file" accept="image/*" hidden>`;
  // PC (C.61 디자인 152): 목록 | 편집을 나란히. 고른 카드가 없으면 오른쪽에 안내
  if (wide) {
    const right = sel ? editor(sel, locked) : `${locked ? lockBanner() : ''}<div class="panel ca-pick-hint"><span class="ca-pick-hint__card" aria-hidden="true"><i></i><span>${Icon({ name: 'card', size: 22 })}</span><em></em><em></em></span><b>고른 카드 없음</b><small class="muted">카드를 고르면 여기서 편집해요</small>
      <ol class="ca-pick-hint__steps"><li><b class="po-num">1</b>왼쪽 목록에서 카드 줄을 눌러요</li><li><b class="po-num">2</b>지금 쓰는 그림과 미리보기가 여기에 떠요</li><li><b class="po-num">3</b>[이미지 올리기]로 내 그림을 넣고 위치·확대를 맞춰요</li></ol></div>`;
    return `<div class="ca-pc"><div class="ca-pc__list">${listHtml}</div><div class="ca-pc__edit">${right}</div></div>`;
  }
  return listHtml;
}

export function cardArtOverlay(ui: CardArtUI): string {
  return ui.crop ? cropSheet(ui.crop) : '';
}
