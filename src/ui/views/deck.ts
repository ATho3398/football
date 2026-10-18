// 덱 편집 화면 (F.6, I.17 9번, C.36): 덱 세트 3개, 덱 슬롯(8~14장), 카드 풀, 요건 미달 회색, 희귀도 색, 시그니처 해금 진행, 카드 선택권(획득).
// C.39: 디자인 GameCard 로 그린다. 덱·가진 카드는 mini 4열 그리드, 누르면 카드 상세(full) 시트에서 빼기/넣기, 획득 3택1은 deck 크기

import { attrTextToDisplay } from '../../attributes';
import { BALANCE } from '../../config/balance';
import { CARDS, cardById, type CardDef } from '../../config/cards';
import { canAdd, deckProblems, signatureProgress, unusableReason } from '../../cardCollection';
import { cardRole, cardText } from '../../engine/cards';
import { myMatchPosition, type GameState } from '../../game';
import { previewLineup } from '../../myTactics';
import { ROLE_NAMES_KO } from '../../engine/roles';
import { Banner, BottomSheet, Button, GameCard, HeroPanel, Icon, SectionTitle, Tabs, esc, type GameCardData } from '../components';
import { actionRow, panel } from './common';
import { cardArtPos, cardArtUrl } from '../cardArt';

const ROLE_KO = { play: '4번째 선택지', boost: '이번 턴 확률', passive: '남은 경기 장착', combo: '다음 장면', soften: '이번 턴', redraw: '패 바꾸기' } as const;
const KIND_KO = { play: '플레이', setPiece: '세트피스', passive: '패시브', combo: '콤보', manage: '관리', signature: '시그니처', directive: '지시' } as const;

export interface DeckCardVM {
  id: string;
  name: string;
  rarity: CardDef['rarity'];
  kind: string;
  role: string;
  text: string;
  condition: string;
  /** 덱에 넣은 장수 / 가진 장수 */
  inDeck: number;
  owned: number;
  /** 지금 포지션·능력치·역할로 못 쓰는 이유 */
  problem: string | null;
  /** 넣을 수 없는 이유 */
  addBlock: string | null;
  fresh: boolean;
  mastery: number;
  /** 디자인 GameCard 데이터 */
  card: GameCardData;
}

export interface DeckVM {
  set: number;
  active: number;
  sets: { id: string; label: string }[];
  count: number;
  problems: string[];
  deck: DeckCardVM[];
  pool: DeckCardVM[];
  unusable: number;
  signature: { id: string; name: string; role: string; apps: number; need: number; unlocked: boolean } | null;
  picks: { idx: number; label: string; options: DeckCardVM[] }[];
  position: string;
}

/** 경기 전 경고·덱 화면 공통: 덱에서 지금 못 쓰는 카드 수 */
export function deckUnusable(g: GameState, role: string | undefined, set = g.cards.active): number {
  const pos = posOfSlot(g);
  return (g.cards.decks[set] ?? []).filter((id) => {
    const d = cardById(id);
    return !d || unusableReason(d, g.player.attributes, pos, role) !== null;
  }).length;
}

function posOfSlot(g: GameState): string {
  return g.tactics ? myMatchPosition(g) : g.player.position;
}

/** 지금 전술에서 내 역할 id (시그니처 카드 조건) */
export function myRoleId(g: GameState): string | undefined {
  const roster = g.rosters[g.player.teamId];
  if (!g.tactics || !roster) return undefined;
  return previewLineup(g.tactics, roster, { name: g.player.name, attrs: g.player.attributes })[g.tactics.mySlot]?.role;
}

const GC_TYPE = { play: 'play', setPiece: 'setpiece', passive: 'passive', combo: 'combo', manage: 'manage', signature: 'signature', directive: 'order' } as const;
const GC_RARITY = { common: 'common', rare: 'rare', epic: 'epic', legendary: 'legend' } as const;
const GC_POS = { common: 'all', attack: 'att', midfield: 'mid', defense: 'def' } as const;

/** 카드 정의 → 디자인 GameCard 데이터: 효과 문장의 첫 "+n%p" 를 희귀도 색 강조로, 숙련 Lv = 사용 횟수 구간 (F.3.2) */
export function gameCardData(def: CardDef, o: { uses?: number; met?: boolean; isNew?: boolean; count?: number } = {}): GameCardData {
  const text = cardText(def);
  const m = /[+−-]\d+%p/.exec(text);
  const uses = o.uses ?? 0;
  return {
    name: def.name, type: GC_TYPE[def.kind], rarity: GC_RARITY[def.rarity], pos: GC_POS[def.group],
    level: 1 + BALANCE.cards.mastery.filter(([at]) => uses >= at).length,
    effect: m ? { pre: text.slice(0, m.index), hi: m[0], post: text.slice(m.index + m[0].length) } : { pre: text },
    condition: { text: attrTextToDisplay(def.condition), met: o.met ?? true },
    ...(o.isNew ? { isNew: true } : {}), ...(o.count ? { count: o.count } : {}),
    ...cardArtOf(def.id),
  };
}

/** 카드 그림 (C.48): cardArtUrl 한 함수로 정하고, 사용자 그림이면 위치·확대 */
export function cardArtOf(id: string): Pick<GameCardData, 'art' | 'artPos'> {
  const art = cardArtUrl(id);
  const pos = cardArtPos(id);
  return art ? { art, ...(pos ? { artPos: pos } : {}) } : {};
}

function cardVM(g: GameState, def: CardDef, deck: string[], role: string | undefined): DeckCardVM {
  const col = g.cards;
  const problem = unusableReason(def, g.player.attributes, posOfSlot(g), role);
  const inDeck = deck.filter((x) => x === def.id).length;
  const fresh = col.fresh.includes(def.id);
  const mastery = col.mastery[def.id] ?? 0;
  return {
    id: def.id, name: def.name, rarity: def.rarity, kind: KIND_KO[def.kind], role: ROLE_KO[cardRole(def)], text: cardText(def), condition: attrTextToDisplay(def.condition),
    inDeck, owned: col.owned[def.id] ?? 0, problem, addBlock: canAdd(col, deck, def.id), fresh, mastery,
    card: gameCardData(def, { uses: mastery, met: problem === null, isNew: fresh, count: inDeck }),
  };
}

export function deckVM(g: GameState, set: number, role: string | undefined): DeckVM {
  const col = g.cards;
  const deck = col.decks[set] ?? [];
  const uniq = [...new Set(deck)];
  const ownedIds = CARDS.filter((c) => (col.owned[c.id] ?? 0) > 0);
  const sig = role ? signatureProgress(col, role) : null;
  return {
    set, active: col.active,
    sets: col.decks.map((d, i) => ({ id: String(i), label: `덱 ${i + 1}${i === col.active ? ' ✓' : ''} · ${d.length}장` })),
    count: deck.length, problems: deckProblems(deck),
    deck: uniq.map((id) => cardVM(g, cardById(id)!, deck, role)),
    pool: ownedIds.filter((c) => (col.owned[c.id] ?? 0) > deck.filter((x) => x === c.id).length).map((c) => cardVM(g, c, deck, role)),
    unusable: deckUnusable(g, role, set),
    signature: sig && role ? { id: sig.id, name: cardById(sig.id)!.name, role: ROLE_NAMES_KO[role] ?? role, apps: sig.apps, need: sig.need, unlocked: sig.unlocked } : null,
    picks: col.picks.map((p, idx) => ({ idx, label: p.label, options: p.options.map((id) => cardVM(g, cardById(id)!, deck, role)) })),
    position: posOfSlot(g),
  };
}

/** 못 쓰는 이유 짧게 (디자인 144 이유 칩: 포지션 · 능력치 · 역할) */
export function shortReason(problem: string): string {
  return problem.includes('포지션') ? '포지션' : problem.includes('역할') ? '역할' : problem.includes('능력치') ? '능력치' : '잠김';
}

/** 덱·가진 카드 그리드 한 칸 (mini). 누르면 카드 상세 시트 */
function miniTile(c: DeckCardVM, from: 'deck' | 'pool'): string {
  const card = from === 'pool' ? { ...c.card, count: 0 } : c.card;
  return GameCard({ card, size: 'mini', act: 'card-open', data: { v: c.id, from }, state: c.problem ? 'disabled' : 'normal', ...(c.problem ? { reason: shortReason(c.problem) } : {}) });
}

const RARITY_KO = { common: '일반', rare: '희귀', epic: '에픽', legendary: '전설' } as const;

/** 카드 획득 3택1 (디자인 85, C.60): 3장(deck 크기) 중 눌러 고르고 아래 상세 → [이 카드 받기] */
function pickView(vm: DeckVM, sel: number, back: 'home' | 'prep'): string {
  const p = vm.picks[0]!;
  const k = Math.min(Math.max(0, sel), p.options.length - 1);
  const c = p.options[k]!;
  const rare = [...new Set(p.options.map((o) => RARITY_KO[o.rarity]))].join('·');
  const hero = HeroPanel({
    title: '카드 획득', back: { act: 'go', data: { to: back } }, eyebrow: `${p.label} · 1장 고르기`, value: '3택1', pad: false, progress: false,
    chips: [vm.picks.length > 1 ? `${vm.picks.length}번 남음` : '이번 1번', { label: rare, soft: true }],
  });
  return `${hero}<div class="body">
    <p class="small muted">고른 카드는 가진 카드로 들어가요 · 덱에 넣는 건 덱 편집에서</p>
    <div class="gc-pick">${p.options.map((o, i) => `<div class="gc-pick__item">${GameCard({ card: o.card, size: 'mini', act: 'pick-sel', data: { v: String(i) }, state: i === k ? 'selected' : o.problem ? 'disabled' : 'normal', ...(o.problem ? { reason: shortReason(o.problem) } : {}) })}</div>`).join('')}</div>
    <div class="panel pick-detail"><div class="pick-detail__head"><b>${esc(c.name)}</b><small>${RARITY_KO[c.rarity]} · ${esc(c.kind)} · ${esc(c.role)}</small></div>
      <p>${esc(c.text)}</p><small class="muted">조건 · ${esc(c.condition || '없음')}${c.problem ? ` · <b class="fail">지금 못 씀: ${esc(c.problem)}</b>` : ''}</small></div>
    ${Button({ size: 'lg', block: true, icon: 'check', act: 'pick-take', data: { v: `${p.idx}:${k}` }, children: '이 카드 받기' })}
    <p class="small muted pick-hint">카드를 눌러 비교해요 · 고르지 않으면 받을 수 없어요</p>
    ${Button({ variant: 'ghost', block: true, act: 'more', data: { v: 'pickLater' }, children: '나중에 고르고 덱 먼저 보기' })}
  </div>`;
}

/** 카드 상세 시트 (full): 효과·조건·못 쓰는 이유와 빼기/넣기 */
export interface CardSheetVM { from: 'deck' | 'pool' | 'pick' | 'view'; card: DeckCardVM }

/** 덱 세트 한 벌의 카드 (C.66c 경기 준비 줄): 같은 카드도 한 칸씩, 덱에 든 순서대로 */
export function deckCardsVM(g: GameState, set: number, role: string | undefined): DeckCardVM[] {
  const deck = g.cards.decks[set] ?? [];
  return deck.flatMap((id) => {
    const def = cardById(id);
    return def ? [cardVM(g, def, deck, role)] : [];
  });
}

export function cardSheet(s: CardSheetVM, count: number): string {
  const c = s.card;
  const C = BALANCE.cards;
  const foot = s.from === 'deck'
    ? Button({ size: 'lg', block: true, variant: 'secondary', act: 'deck-remove', data: { v: c.id }, disabled: count <= C.deckMin, children: count <= C.deckMin ? `${C.deckMin}장보다 적게는 못 빼요` : '덱에서 빼기' })
    : s.from === 'pool'
      ? Button({ size: 'lg', block: true, act: 'deck-add', data: { v: c.id }, disabled: c.addBlock !== null, children: c.addBlock ?? '덱에 넣기' })
      : '';
  const close = Button({ size: 'lg', block: true, variant: 'secondary', act: 'card-close', children: '닫기' });
  return BottomSheet({
    eyebrow: `${c.kind} · ${c.role}`, title: c.name, onClose: { act: 'card-close' },
    children: `<div class="gc-detail">${GameCard({ card: c.card, size: 'full', state: c.problem ? 'disabled' : 'normal' })}</div>
      <p class="small muted gc-detail__meta">덱에 ${c.inDeck}장 · 가진 카드 ${c.owned}장${c.mastery ? ` · 사용 ${c.mastery}회` : ''}${c.problem ? ` · <b class="fail">지금 못 씀: ${esc(c.problem)}</b>` : ''}</p>`,
    footer: foot ? actionRow(close, foot) : close,
  });
}

/** 덱 편집 (디자인 116 · 144, C.60): compact 머리말 · 덱 세트 탭 3 · 덱 mini 4열(못 쓰는 카드 이유 칩) · 가진 카드. 카드 선택이 남아 있으면 먼저 획득 화면(85) */
export function deckView(vm: DeckVM, sheet: CardSheetVM | null = null, back: 'home' | 'prep' = 'home', pick: { sel: number; later: boolean } = { sel: 1, later: false }): string {
  if (vm.picks.length && !pick.later && !sheet) return pickView(vm, pick.sel, back);
  const C = BALANCE.cards;
  const arts = vm.deck.filter((c) => c.card.art).length;
  const hero = HeroPanel({
    title: '카드 덱', back: { act: 'go', data: { to: back } }, compact: true, eyebrow: `덱 ${vm.set + 1}${vm.set === vm.active ? ' · 경기에 쓰는 덱' : ''}`,
    value: vm.count, total: C.deckMax, progress: false,
    chips: [`${C.deckMin}~${C.deckMax}장`, `같은 카드 ${C.maxCopies}장`, { label: vm.unusable ? `못 쓰는 카드 ${vm.unusable}장` : `그림 ${arts}장`, soft: true }],
  });
  const picks = vm.picks.length
    ? Banner({ tone: 'info', title: `카드 선택 ${vm.picks.length}개를 받을 수 있어요`, action: '고르기', onAction: { act: 'more', data: { v: 'pickLater' } } })
    : '';
  const sets = Tabs({ items: vm.sets, value: String(vm.set), act: 'deck-set', fill: true, label: '덱 세트' });
  const use = vm.set === vm.active
    ? '<p class="small muted">이 덱으로 경기를 뛰어요. 경기 시작 때 4장, 15분마다 1장, 장면에서 성공하면 1장 더(경기당 3장) 뽑아요.</p>'
    : Button({ variant: 'secondary', block: true, act: 'deck-use', data: { v: String(vm.set) }, disabled: vm.problems.length > 0, children: vm.problems.length ? '규칙에 맞춰야 쓸 수 있어요' : `덱 ${vm.set + 1}로 경기 뛰기` });
  const probs = vm.problems.length ? `<div class="dk-probs">${vm.problems.map((p) => `<p class="small">${esc(p)}</p>`).join('')}</div>` : '';
  const deck = `${SectionTitle({ title: '덱', action: `${vm.count}장 · 그림 ${arts} · 기본 장면 ${vm.deck.length - arts}` })}${panel(`${probs}<div class="gc-grid">${vm.deck.map((c) => miniTile(c, 'deck')).join('')}</div>`)}`;
  const pool = `${SectionTitle({ title: '가진 카드', action: vm.pool.length ? `${vm.pool.length}종 더 넣을 수 있음` : '모두 덱에 있음' })}${panel(vm.pool.length
    ? `<div class="gc-grid">${vm.pool.map((c) => miniTile(c, 'pool')).join('')}</div>`
    : '<p class="small muted">레벨 5마다, 시즌이 끝날 때 카드를 고를 수 있어요.</p>')}`;
  const s = vm.signature;
  const sigCard: GameCardData = { name: s?.name ?? '', type: 'signature', rarity: 'rare', level: 1, effect: { pre: '' }, condition: { text: '', met: false }, ...(s ? cardArtOf(s.id) : {}) };
  const sig = s ? `${SectionTitle({ title: '역할 시그니처', action: s.role })}${panel(s.unlocked
    ? `<p class="line"><b>${esc(s.name)}</b> 해금됨 · 가진 카드에서 덱에 넣어요. 이 역할일 때만 써요.</p>`
    : `<div class="gc-sig"><div class="gc-sig__card">${GameCard({ card: sigCard, size: 'mini', state: 'locked', reason: '잠김' })}</div>
        <p class="small"><b>${esc(s.name)}</b><br><span class="muted">${esc(s.role)}로 ${s.need}경기 출전하면 해금 · 지금 ${s.apps}/${s.need}</span></p></div>`)}`
    : '';
  return `${hero}<div class="body">${picks}${sets}${use}${deck}${pool}${sig}</div>${sheet ? cardSheet(sheet, vm.count) : ''}`;
}

/** 홈 "카드 덱" 줄 */
export function deckHomeSection(vm: { active: number; count: number; unusable: number; picks: number }): string {
  // C.57 (홈 한 화면): 알릴 것이 없으면 오늘 훈련 줄과 같은 한 줄
  if (!vm.unusable && !vm.picks) {
    return `<button type="button" class="panel hm-train" data-act="go" data-to="deck"><span class="hm-train__icon">${Icon({ name: 'deck', size: 20 })}</span>
      <span class="hm-train__body"><small>카드 덱</small><b>덱 ${vm.active + 1} · ${vm.count}장</b><span>덱 편집</span></span>${Icon({ name: 'chevron-right', size: 18 })}</button>`;
  }
  return `${SectionTitle({ title: '카드 덱', action: `덱 ${vm.active + 1} · ${vm.count}장` })}${panel(`
    ${vm.unusable ? `<p class="small dk-warn">이 덱에 지금 못 쓰는 카드 ${vm.unusable}장 (포지션·능력치·역할 요건)</p>` : ''}
    ${vm.picks ? `<p class="small"><b>카드 선택 ${vm.picks}개</b>를 받을 수 있어요.</p>` : ''}
    ${Button({ variant: vm.picks ? 'primary' : 'secondary', block: true, act: 'go', data: { to: 'deck' }, children: vm.picks ? '카드 고르고 덱 편집' : '덱 편집' })}`)}`;
}
