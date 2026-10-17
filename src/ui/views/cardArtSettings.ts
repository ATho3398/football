// 설정 → 카드 이미지 (부록 C.48, pending 70): 카드 목록(검색·종류 거르기·그림 없음만) → 편집 칸(실제 full 카드 미리보기,
// [이미지 올리기]·[위치 맞추기]·[기본으로]) → 위치·확대 시트(카드 그림 칸 비율). 사용자 그림은 이 브라우저(IndexedDB)에만, 경기 중에는 잠금

import { CARDS, cardById, type CardDef } from '../../config/cards';
import { Button, GameCard, esc, type GameCardData, type GameCardType } from '../components';
import { cardArtSource, CARD_ART_FILES, cardArtUrl, userArtCount, type ArtPos } from '../cardArt';
import { gameCardData } from './deck';
import { panel } from './common';

export type CardKindFilter = 'all' | GameCardType;

export interface CardArtUI {
  q: string;
  kind: CardKindFilter;
  /** 그림 없음만 */
  none: boolean;
  /** 고른 카드 id */
  sel: string | null;
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

function row(d: CardDef, sel: string | null): string {
  const src = cardArtSource(d.id);
  const url = cardArtUrl(d.id);
  const type = gameCardData(d).type;
  const kind = KINDS.find((k) => k.id === type)?.label ?? type;
  return `<button type="button" class="real-row ca-row${d.id === sel ? ' is-on' : ''}" data-act="ca-pick" data-key="${esc(d.id)}">
    <span class="ca-thumb po-rarity--${d.rarity === 'legendary' ? 'legend' : d.rarity}">${url ? `<img class="po-art" src="${esc(url)}" alt="" loading="lazy" decoding="async">` : '<i>그림 없음</i>'}</span>
    <span class="grow"><b>${esc(d.name)}</b><small>${esc(kind)} · ${RARITY_KO[d.rarity]}</small></span>
    <span class="po-chip${src === 'user' ? ' po-chip--brand' : ''}">${SOURCE_KO[src]}</span></button>`;
}

function editor(d: CardDef, locked: boolean): string {
  const src = cardArtSource(d.id);
  const card = gameCardData(d);
  const where = src === 'user' ? '내가 올린 그림을 쓰고 있어요.' : src === 'default' ? '기본 그림(카드 일러스트)을 쓰고 있어요.' : '그림이 없어 기본 장면(골문·수비벽·공 궤적)을 그려요.';
  return panel(`<div class="ca-edit"><div class="ca-edit__card">${GameCard({ card, size: 'full' })}</div>
    <div class="ca-edit__side"><b>${esc(d.name)}</b><small class="muted">${esc(where)}</small>
      <div class="ca-edit__btns">${Button({ size: 'sm', icon: 'upload', act: 'ca-upload', data: { key: d.id }, disabled: locked, children: src === 'user' ? '다시 올리기' : '이미지 올리기' })}${
        src === 'user' ? Button({ variant: 'secondary', size: 'sm', act: 'ca-adjust', data: { key: d.id }, disabled: locked, children: '위치 맞추기' }) : ''}${
        src === 'user' ? Button({ variant: 'secondary', size: 'sm', icon: 'restore', act: 'ca-clear', data: { key: d.id }, disabled: locked, children: '기본으로' }) : ''}</div>
      <small class="muted">${src === 'user' ? `[기본으로]를 누르면 ${CARD_ART_FILES.has(d.id.replace(/^sig-/, '')) ? '기본 그림' : '그림 없음(기본 장면)'}으로 돌아가요.` : '정사각형·가로 그림도 돼요. 올린 뒤 위치·확대를 맞춰요.'}</small></div></div>`, 'ca-editor');
}

/** 위치·확대 시트: 실제 카드 틀(full)과 덱 슬롯(mini) 미리보기 */
function cropSheet(c: NonNullable<CardArtUI['crop']>): string {
  const d = cardById(c.id);
  const base: GameCardData = d ? gameCardData(d) : { name: c.name, type: 'play', rarity: 'common', level: 1, effect: { pre: '' }, condition: { text: '', met: true } };
  const card: GameCardData = { ...base, art: c.src, artPos: { x: c.x, y: c.y, zoom: c.zoom } };
  return `<div class="po-overlay po-overlay--sheet"><div class="po-sheet fo-crop ca-crop" role="dialog" aria-modal="true" aria-label="카드 그림 위치 맞추기"><span class="po-sheet__grip" aria-hidden="true"></span>
    <div class="po-sheet__head"><span class="po-sheet__eyebrow">카드 이미지</span><b>${esc(c.name)}</b><p>그림 칸(가로 4 : 세로 3)에 맞춰요. 사선 아래는 글자 칸이라 가려져요. 덱 슬롯·경기 패는 가운데만 보여요.</p></div>
    <div class="po-sheet__body">
      <div class="ca-crop__stage" id="ca-prev">${GameCard({ card, size: 'full' })}<div class="ca-crop__mini">${GameCard({ card, size: 'mini' })}<small class="muted">덱 슬롯</small></div></div>
      <label class="fo-range"><span>확대</span><input type="range" id="ca-zoom" min="100" max="400" value="${Math.round(c.zoom * 100)}"></label>
      <label class="fo-range"><span>좌우</span><input type="range" id="ca-x" min="-50" max="50" value="${Math.round(c.x)}"></label>
      <label class="fo-range"><span>위아래</span><input type="range" id="ca-y" min="-50" max="50" value="${Math.round(c.y)}"></label>
    </div>
    <div class="po-sheet__foot"><div class="btn-row even">${Button({ variant: 'secondary', size: 'lg', block: true, act: 'ca-crop-cancel', children: '취소' })}${Button({ size: 'lg', block: true, icon: 'check', act: 'ca-crop-save', children: '저장' })}</div></div>
  </div></div>`;
}

export function cardArtSection(ui: CardArtUI, locked: boolean): string {
  const list = cardArtList(ui);
  const sel = ui.sel ? cardById(ui.sel) : undefined;
  const withArt = CARDS.filter((d) => cardArtSource(d.id) === 'default').length;
  const chips = `<div class="ca-chips" role="group" aria-label="종류 거르기">${KINDS.map((k) => `<button type="button" class="po-chip ca-chip${ui.kind === k.id ? ' is-on' : ''}" data-act="ca-kind" data-v="${k.id}" aria-pressed="${ui.kind === k.id}">${k.label}</button>`).join('')}
    <button type="button" class="po-chip ca-chip${ui.none ? ' is-on' : ''}" data-act="ca-none" aria-pressed="${ui.none}">그림 없음만</button></div>`;
  return `${panel(`<p class="small">카드마다 그림을 올려 바꿀 수 있어요. 덱·가진 카드·카드 상세·경기 패·카드 선택에 모두 나와요. 이미지는 이 브라우저에만 저장돼요(세이브 파일 내보내기에서 "카드 이미지 포함"을 켜면 같이 옮겨요).</p>
      <p class="small muted">우선순위: 내가 올린 그림 > 기본 그림(${withArt}장) > 기본 장면 · 내 그림 ${userArtCount()}장 · 카드 ${CARDS.length}장</p>
      ${locked ? '<p class="small"><b>경기가 끝나면 바꿀 수 있어요.</b> 경기 중에는 카드 이미지를 볼 수만 있어요.</p>' : ''}`)}
    ${sel ? editor(sel, locked) : ''}
    <label class="field fo-search"><span aria-hidden="true">🔍</span><input type="search" id="ca-q" value="${esc(ui.q)}" placeholder="카드 이름" autocomplete="off"></label>
    ${chips}
    <div class="real-list fo-list ca-list">${list.map((d) => row(d, ui.sel)).join('') || '<p class="small muted">맞는 카드가 없어요.</p>'}</div>
    <input type="file" id="ca-file" accept="image/*" hidden>`;
}

export function cardArtOverlay(ui: CardArtUI): string {
  return ui.crop ? cropSheet(ui.crop) : '';
}
