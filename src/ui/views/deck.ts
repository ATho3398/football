// 덱 편집 화면 (F.6, I.17 9번, C.36): 덱 세트 3개, 덱 슬롯(8~14장), 카드 풀, 요건 미달 회색, 희귀도 색, 시그니처 해금 진행, 카드 선택권(획득).

import { BALANCE } from '../../config/balance';
import { CARDS, cardById, type CardDef } from '../../config/cards';
import { canAdd, deckProblems, signatureProgress, unusableReason } from '../../cardCollection';
import { cardRole, cardText } from '../../engine/cards';
import { myMatchPosition, type GameState } from '../../game';
import { previewLineup } from '../../myTactics';
import { ROLE_NAMES_KO } from '../../engine/roles';
import { Button, HeroPanel, SectionTitle, Tabs, esc } from '../components';
import { panel } from './common';
import { RARITY_COLOR, RARITY_KO } from './moment';

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
  signature: { name: string; role: string; apps: number; need: number; unlocked: boolean } | null;
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

function cardVM(g: GameState, def: CardDef, deck: string[], role: string | undefined): DeckCardVM {
  const col = g.cards;
  return {
    id: def.id, name: def.name, rarity: def.rarity, kind: KIND_KO[def.kind], role: ROLE_KO[cardRole(def)], text: cardText(def), condition: def.condition,
    inDeck: deck.filter((x) => x === def.id).length, owned: col.owned[def.id] ?? 0,
    problem: unusableReason(def, g.player.attributes, posOfSlot(g), role),
    addBlock: canAdd(col, deck, def.id), fresh: col.fresh.includes(def.id), mastery: col.mastery[def.id] ?? 0,
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
    signature: sig && role ? { name: cardById(sig.id)!.name, role: ROLE_NAMES_KO[role] ?? role, apps: sig.apps, need: sig.need, unlocked: sig.unlocked } : null,
    picks: col.picks.map((p, idx) => ({ idx, label: p.label, options: p.options.map((id) => cardVM(g, cardById(id)!, deck, role)) })),
    position: posOfSlot(g),
  };
}

function cardTile(c: DeckCardVM, right: string, cls = ''): string {
  const off = c.problem !== null;
  return `<div class="dk-card${off ? ' is-off' : ''}${c.fresh ? ' is-fresh' : ''} ${cls}" style="--r:${RARITY_COLOR[c.rarity]}">
    <div class="dk-card__main">
      <div class="dk-card__top"><span class="dk-rar">${RARITY_KO[c.rarity]}</span><span class="dk-kind">${esc(c.kind)} · ${esc(c.role)}</span>${c.fresh ? '<span class="dk-new">NEW</span>' : ''}</div>
      <b>${esc(c.name)}${c.inDeck > 1 ? ` <span class="po-num">×${c.inDeck}</span>` : ''}</b>
      <span class="dk-text">${esc(c.text)}</span>
      <span class="dk-cond">${esc(c.condition)}${c.mastery ? ` · 사용 ${c.mastery}회` : ''}</span>
      ${off ? `<span class="dk-problem">못 씀 · ${esc(c.problem!)}</span>` : ''}
    </div>
    <div class="dk-card__act">${right}</div>
  </div>`;
}

export function deckView(vm: DeckVM): string {
  const C = BALANCE.cards;
  const hero = HeroPanel({
    title: '카드 덱', back: { act: 'go', data: { to: 'home' } }, eyebrow: `덱 ${vm.set + 1}${vm.set === vm.active ? ' · 경기에 쓰는 덱' : ''}`,
    value: vm.count, total: C.deckMax, progress: false,
    chips: [`${C.deckMin}~${C.deckMax}장`, `같은 카드 ${C.maxCopies}장`, `세트피스 ${C.maxSetPiece}장`, ...(vm.unusable ? [{ label: `못 쓰는 카드 ${vm.unusable}장`, soft: true }] : [])],
  });
  const picks = vm.picks.length
    ? `${SectionTitle({ title: '카드 선택', action: `${vm.picks.length}개 남음` })}${vm.picks.map((p) => panel(`<p class="line"><b>${esc(p.label)}</b> · 3장 중 1장을 가져요</p>
      <div class="dk-list">${p.options.map((c, k) => cardTile(c, Button({ size: 'sm', act: 'pick-take', data: { v: `${p.idx}:${k}` }, children: '가져오기' }))).join('')}</div>`)).join('')}`
    : '';
  const sets = Tabs({ items: vm.sets, value: String(vm.set), act: 'deck-set', fill: true, label: '덱 세트' });
  const use = vm.set === vm.active
    ? '<p class="small muted">이 덱으로 경기를 뛰어요. 경기 시작 때 4장, 15분마다 1장, 장면에서 성공하면 1장 더(경기당 3장) 뽑아요.</p>'
    : Button({ variant: 'secondary', block: true, act: 'deck-use', data: { v: String(vm.set) }, disabled: vm.problems.length > 0, children: vm.problems.length ? '규칙에 맞춰야 쓸 수 있어요' : `덱 ${vm.set + 1}로 경기 뛰기` });
  const probs = vm.problems.length ? `<div class="dk-probs">${vm.problems.map((p) => `<p class="small">${esc(p)}</p>`).join('')}</div>` : '';
  const deck = `${SectionTitle({ title: '덱', action: `${vm.count}장` })}${panel(`${probs}<div class="dk-list">${vm.deck.map((c) => cardTile(c, Button({
    size: 'sm', variant: 'secondary', act: 'deck-remove', data: { v: c.id }, disabled: vm.count <= C.deckMin, children: '빼기',
  }))).join('')}</div>${vm.count <= C.deckMin ? `<p class="small muted">${C.deckMin}장보다 적게는 못 빼요. 바꾸려면 먼저 넣고 빼요.</p>` : ''}`)}`;
  const pool = `${SectionTitle({ title: '가진 카드', action: vm.pool.length ? `${vm.pool.length}종 더 넣을 수 있음` : '모두 덱에 있음' })}${panel(vm.pool.length
    ? `<div class="dk-list">${vm.pool.map((c) => cardTile(c, Button({ size: 'sm', act: 'deck-add', data: { v: c.id }, disabled: c.addBlock !== null, children: c.addBlock ?? '넣기' }))).join('')}</div>`
    : '<p class="small muted">레벨 5마다, 시즌이 끝날 때 카드를 고를 수 있어요.</p>')}`;
  const s = vm.signature;
  const sig = s ? `${SectionTitle({ title: '역할 시그니처', action: s.role })}${panel(s.unlocked
    ? `<p class="line"><b>${esc(s.name)}</b> 해금됨 · 가진 카드에서 덱에 넣어요. 이 역할일 때만 써요.</p>`
    : `<div class="dk-card is-locked" style="--r:${RARITY_COLOR.rare}"><div class="dk-card__main"><div class="dk-card__top"><span class="dk-rar">희귀</span><span class="dk-kind">시그니처 · 잠김</span></div>
        <b>${esc(s.name)}</b><span class="dk-cond">${esc(s.role)}로 ${s.need}경기 출전하면 해금 · 지금 ${s.apps}/${s.need}</span></div></div>`)}`
    : '';
  return `${hero}<div class="body">${picks}${sets}${use}${deck}${pool}${sig}</div>`;
}

/** 홈 "카드 덱" 줄 */
export function deckHomeSection(vm: { active: number; count: number; unusable: number; picks: number }): string {
  return `${SectionTitle({ title: '카드 덱', action: `덱 ${vm.active + 1} · ${vm.count}장` })}${panel(`
    ${vm.unusable ? `<p class="small dk-warn">이 덱에 지금 못 쓰는 카드 ${vm.unusable}장 (포지션·능력치·역할 요건)</p>` : ''}
    ${vm.picks ? `<p class="small"><b>카드 선택 ${vm.picks}개</b>를 받을 수 있어요.</p>` : ''}
    ${Button({ variant: vm.picks ? 'primary' : 'secondary', block: true, act: 'go', data: { to: 'deck' }, children: vm.picks ? '카드 고르고 덱 편집' : '덱 편집' })}`)}`;
}
