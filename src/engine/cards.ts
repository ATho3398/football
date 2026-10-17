// 카드 효과 엔진 (부록 F, 16.2·16.3, C.36): 덱 → 패/드로우 → 결정 순간·자동 경기에서 카드 사용 → 내 선수의 다음 행동에만 붙는 보정.
// 카드는 능력치를 올리지 않는다 (E.15.1, F.0 2번): 성공 확률은 엔진 판정(E.8) 그대로이고 카드는 그 위에 ±%p 를 얹는다(한 행동 합계 최대 +15%p).
// 플레이 카드는 엔진 후보를 바탕으로 한 "행동 변형"을 4번째 선택지로 연다. 고르면 그 후보를 그대로 실행하고 결과는 피치에 보인다.
// 카드 데이터는 src/config/cards.ts 한 곳이고 여기서는 효과 스키마(F.2.1)만 읽는다. 덱이 없으면 SimState.cards = null 이고
// 엔진은 C.35 와 한 비트도 다르지 않다 (모든 보정은 s.cards 가 있을 때만 붙는다).

import type { FieldAttribute } from '../attributes';
import { BALANCE } from '../config/balance';
import { cardById, type CardDef, type CardEffect, type ComboTrigger, type OptionTag, type OptionWhen, type Rarity, type CardKind } from '../config/cards';
import { ENGINE } from './config';
import { finishSkill, lossCost, shotModel, type Candidate } from './onball';
import { attackDir, clamp, dist, inOppBox, L, oppGoal, toNorm, W } from './pitch';
import { Purpose, rand } from './rng';
import type { Agent, SimState } from './state';

const C = BALANCE.cards;
type AddOption = Extract<CardEffect, { type: 'addOption' }>;
type ProbEffect = Extract<CardEffect, { type: 'probDelta' }>;

export interface CardInput {
  /** 덱 (카드 id, 중복 가능). 비어 있으면 카드 없음 */
  deck: string[];
  /** 카드별 지금까지 사용 횟수 (숙련도, F.3.2) */
  mastery?: Record<string, number>;
}

/** 경기 중 카드 사용 한 번 */
export interface CardUse {
  id: string;
  minute: number;
  scene: string;
  /** 자동 규칙(F.5)으로 쓴 카드 */
  auto: boolean;
  result: 'success' | 'fail' | 'neutral';
}

export interface CardReport {
  uses: CardUse[];
  /** 경기 중 뽑은 카드 수 (시작 패 포함), 성공 보너스 드로우 수 */
  drawn: number;
  bonus: number;
  hand: string[];
  passives: string[];
}

/** 내 선수의 다음 행동 한 번에 붙는 보정 */
export interface ActionMod {
  card: string | null;
  /** 성공 확률 %p (슛 = 유효 슈팅, 크로스 = 공중볼 승리, PK = 성공) */
  on: number;
  /** 상대 선방 확률 %p */
  save: number;
  blockMul: number;
  /** 크로스 공중볼 승리 보정 */
  edge: number;
  /** 성공 / 실패 평점 (평점 단위) */
  rs: number;
  rf: number;
  /** 실패 평점 감소 비율 (침착, failureSoftener) */
  soften: number;
  /** 세트피스: 직접 프리킥을 찬다 (카드 선택지) */
  direct?: boolean;
}

type WatchKind = 'shoot' | 'pass' | 'cross' | 'dribble' | 'carry' | 'holdup' | 'duel' | 'foul' | 'block' | 'air' | 'none';

interface Snap { goals: number; passes: number; crosses: number; dribbles: number; tackles: number; holdups: number; lost: number; blocks: number; air: number; poss: 0 | 1 }

interface Watch { kind: WatchKind; t: number; team: 0 | 1; snap: Snap; rs: number; rf: number; soften: number; down: number; use: CardUse | null }

interface Combo { id: string; on: ComboTrigger; option?: OptionTag; value: number; armedT: number }

export interface CardState {
  pile: string[];
  hand: string[];
  passives: string[];
  started: boolean;
  nextDraw: number;
  bonus: number;
  drawn: number;
  combos: Combo[];
  /** 지금 실행하는 내 행동의 보정 (실행 직후 지운다) */
  mod: ActionMod | null;
  /** 세트피스 키커 보정 (그 재개 실행에만) */
  sp: ActionMod | null;
  watch: Watch | null;
  /** 자동 경기 카드 기회 (F.5): 횟수, 마지막 시각 */
  occ: number;
  lastOccT: number;
  lastTackleT: number;
  uses: CardUse[];
  mastery: Record<string, number>;
}

/** 덱이 있으면 카드 상태 (덱 순서는 시드로 섞는다) */
export function initCards(input: CardInput | undefined, seed: number): CardState | null {
  const deck = (input?.deck ?? []).filter((id) => cardById(id));
  if (!deck.length) return null;
  // 결정적 섞기 (Fisher–Yates, 시드 난수)
  const pile = [...deck];
  for (let i = pile.length - 1; i > 0; i--) {
    const j = Math.floor(rand(seed, 0, i, Purpose.Cards, 1) * (i + 1));
    [pile[i], pile[j]] = [pile[j]!, pile[i]!];
  }
  return {
    pile, hand: [], passives: [], started: false, nextDraw: 0, bonus: 0, drawn: 0, combos: [], mod: null, sp: null, watch: null,
    occ: 0, lastOccT: -100, lastTackleT: -100, uses: [], mastery: { ...(input?.mastery ?? {}) },
  };
}

export function emptyMod(card: string | null = null): ActionMod {
  return { card, on: 0, save: 0, blockMul: 1, edge: 0, rs: 0, rf: 0, soften: 0 };
}

function me(s: SimState): Agent | undefined {
  return s.agents.find((x) => x.spec.isMe && x.onPitch);
}

function drawCards(cs: CardState, n: number): number {
  let k = 0;
  while (k < n && cs.pile.length && cs.hand.length < C.handMax) {
    cs.hand.push(cs.pile.shift()!);
    cs.drawn++;
    k++;
  }
  return k;
}

// ── 조건 ──

const BASE_JUDGE: Record<string, Partial<Record<FieldAttribute, number>>> = {
  dribble: { dribbling: 0.5, agility: 0.2, acceleration: 0.15, ballControl: 0.15 },
  pass: { shortPassing: 0.6, vision: 0.4 },
  keyPass: { shortPassing: 0.4, vision: 0.6 },
  longPass: { longPassing: 0.7, vision: 0.3 },
  cross: { crossing: 1 },
  carry: { dribbling: 0.5, acceleration: 0.3, ballControl: 0.2 },
  holdup: { strength: 0.5, ballControl: 0.5 },
  tackle: { tackling: 0.6, defensivePositioning: 0.4 },
  race: { tackling: 0.6, defensivePositioning: 0.4 },
  header: { heading: 0.6, jumping: 0.4 },
};

function weighted(a: Agent, w: Partial<Record<FieldAttribute, number>>): number {
  let sum = 0;
  let tw = 0;
  for (const [k, v] of Object.entries(w) as [FieldAttribute, number][]) {
    sum += a.attrs[k] * v;
    tw += v;
  }
  return tw > 0 ? sum / tw : 0;
}

/** 판정 능력치 차이 → 성공 확률 이동 (E.15.1: 능력치로 계산, ±judgeMax) */
export function judgeShift(a: Agent, eff: AddOption): number {
  if (!eff.judge) return 0;
  const baseSkill = eff.base === 'shoot' ? finishSkill(a.attrs, 'shot') : weighted(a, BASE_JUDGE[eff.base] ?? {});
  return clamp((C.judgeK * (weighted(a, eff.judge) - baseSkill)) / 100, -C.judgeMax, C.judgeMax);
}

export function masteryBonus(cs: CardState, def: CardDef): number {
  if (!def.mastery) return 0;
  const n = cs.mastery[def.id] ?? 0;
  let b = 0;
  for (const [at, v] of C.mastery) if (n >= at) b = v;
  return b;
}

/** 후보의 선택지 태그 (F.2.1) */
export function tagsOf(s: SimState, a: Agent, c: Candidate): OptionTag[] {
  const fwd = (c.x - a.x) * attackDir(a.team, s.half) > 3;
  switch (c.type) {
    case 'shoot': return ['shoot', 'risky'];
    case 'through': return ['pass', 'keyPass'];
    case 'pass': case 'cutback': case 'layoff': return fwd ? ['pass', 'keyPass'] : ['pass', 'safe'];
    case 'cross': return ['cross'];
    case 'dribble': return ['dribble', 'risky'];
    case 'hold': return ['safe'];
    case 'clear': return ['clear', 'safe'];
    default: return [];
  }
}

const KIND_ROLE: Record<CardKind, MomentCardRole> = {
  play: 'play', setPiece: 'boost', passive: 'passive', combo: 'combo', manage: 'boost', signature: 'play', directive: 'boost',
};

export type MomentCardRole = 'play' | 'boost' | 'passive' | 'combo' | 'soften' | 'redraw';

export function cardRole(def: CardDef): MomentCardRole {
  if (def.effects.some((e) => e.type === 'addOption')) return 'play';
  if (def.effects.some((e) => e.type === 'failureSoftener')) return 'soften';
  if (def.effects.some((e) => e.type === 'discardDraw')) return 'redraw';
  return KIND_ROLE[def.kind];
}

/** 요건 (포지션, 능력치, 역할, 지시 카드 비활성): 장면과 무관한 조건. 맞지 않으면 이유 */
export function requirementProblem(def: CardDef, attrs: Record<string, number>, pos: string, role: string | undefined): string | null {
  if (def.inactiveUntil) return `${def.inactiveUntil}에 열려요`;
  if (def.positions.length && !def.positions.includes(pos)) return `${def.positions.join('/')} 포지션 카드`;
  for (const [k, v] of Object.entries(def.requires)) if ((attrs[k] ?? 0) < (v as number)) return `능력치 요건 미달`;
  const ro = def.effects.find((e) => e.type === 'roleOnly');
  if (ro && ro.type === 'roleOnly' && ro.role !== role) return '그 역할일 때만';
  return null;
}

function reqProblem(s: SimState, a: Agent, def: CardDef): string | null {
  return requirementProblem(def, a.spec.attrs, a.pos, a.role.id);
}

function whenOk(s: SimState, a: Agent, w: OptionWhen | undefined): boolean {
  if (!w) return true;
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const d = dist(a.x, a.y, gx, gy);
  if (w.minDist !== undefined && d < w.minDist) return false;
  if (w.maxDist !== undefined && d > w.maxDist) return false;
  if (w.nearDef !== undefined && !s.agents.some((o) => o.onPitch && o.team !== a.team && o.line !== 0 && dist(o.x, o.y, a.x, a.y) <= w.nearDef!)) return false;
  if (w.gkOut !== undefined) {
    const gk = s.agents.find((o) => o.onPitch && o.team !== a.team && o.line === 0);
    if (!gk || Math.abs(gk.x - gx) < w.gkOut) return false;
  }
  if (w.wide && !(inOppBox(a.x, a.y, dir) && Math.abs(a.y - gy) > ENGINE.pitch.goalWidth)) return false;
  if (w.ownHalf && toNorm(a.x, a.y, dir)[0] >= 0.5) return false;
  return true;
}

// ── 패시브·콤보 (장면과 무관하게 남은 경기 동안) ──

function probEffects(def: CardDef): ProbEffect[] {
  return def.effects.filter((e): e is ProbEffect => e.type === 'probDelta');
}

function passiveFor(s: SimState, a: Agent, tags: OptionTag[], box: boolean): number {
  const cs = s.cards!;
  let v = 0;
  for (const id of cs.passives) {
    const def = cardById(id)!;
    for (const e of probEffects(def)) {
      if (!e.option || !tags.includes(e.option) || (e.box && !box)) continue;
      v += e.value + (e.value > 0 ? masteryBonus(cs, def) : 0);
    }
  }
  return v;
}

function comboHolds(s: SimState, a: Agent, on: ComboTrigger, armedT: number): boolean {
  const cs = s.cards!;
  switch (on) {
    case 'dribbleWon': return a.dribbleT > armedT && s.t - a.dribbleT <= 6 && s.ball.owner === a.idx;
    case 'ballWon': return a.gotBy === 'gain' && s.teams[a.team].wonAt > armedT && s.t - s.teams[a.team].wonAt <= 6;
    case 'tackleWon': return cs.lastTackleT > armedT && s.t - cs.lastTackleT <= 10;
  }
}

/** 지금 조건이 맞는 콤보 보너스 (consume 이면 쓴 콤보를 지운다) */
function comboFor(s: SimState, a: Agent, tags: OptionTag[], consume: boolean): number {
  const cs = s.cards!;
  let v = 0;
  cs.combos = cs.combos.filter((c) => {
    if (!c.option || !tags.includes(c.option) || !comboHolds(s, a, c.on, c.armedT)) return true;
    v += c.value;
    return !consume;
  });
  return v;
}

/** 실행한 행동에 맞는 콤보를 지운다 (조건이 맞을 때만, 슛은 shotCardMod 가) */
export function consumeCombos(s: SimState, a: Agent, tags: OptionTag[]): void {
  comboFor(s, a, tags, true);
}

/** 내 후보 확률에 패시브·콤보를 얹는다 (판단 효용 u 는 그대로라 엔진 선택은 같고, 판정만 바뀐다). 슛·크로스는 실행 때 따로 */
export function prepCands(s: SimState, a: Agent, cands: Candidate[]): void {
  const cs = s.cards;
  if (!cs || (!cs.passives.length && !cs.combos.length)) return;
  for (const c of cands) {
    if (c.type === 'shoot' || c.type === 'cross') continue;
    const tags = tagsOf(s, a, c);
    const d = Math.min(C.bonusCap, passiveFor(s, a, tags, false) + comboFor(s, a, tags, false));
    if (d === 0) continue;
    c.cardD = d;
    c.p = clamp(c.p + d, 0.01, 0.99);
    if (c.pFlight !== undefined) c.pFlight = clamp(c.pFlight + d, 0.01, 0.99);
  }
}

/** 슛 실행 보정 (shoot 에서 읽는다): 이번 행동 보정 + 패시브(박스 안) + 콤보. 합계 +15%p 상한 */
export function shotCardMod(s: SimState, a: Agent): { on: number; save: number; blockMul: number } | null {
  const cs = s.cards;
  if (!cs || !a.spec.isMe) return null;
  const box = inOppBox(a.x, a.y, attackDir(a.team, s.half));
  const m = cs.mod;
  const on = Math.min(C.bonusCap, (m?.on ?? 0) + passiveFor(s, a, ['shoot'], box) + comboFor(s, a, ['shoot'], true));
  const save = m?.save ?? 0;
  const blockMul = m?.blockMul ?? 1;
  if (on === 0 && save === 0 && blockMul === 1) return null;
  return { on, save, blockMul };
}

/** 크로스 공중볼 보정 (cross 에서 읽는다) */
export function crossCardEdge(s: SimState, a: Agent): number {
  const cs = s.cards;
  if (!cs || !a.spec.isMe || !cs.mod) return 0;
  return Math.min(C.bonusCap, cs.mod.edge + cs.mod.on);
}

/** 카드 확률 상한: 기본 확률 대비 +bonusCap 까지 */
function capped(base: number, p: number): number {
  return clamp(Math.min(p, base + C.bonusCap), 0.01, 0.99);
}

// ── 행동 변형 (플레이 카드의 4번째 선택지) ──

export interface Variant {
  hand: number;
  def: CardDef;
  eff: AddOption;
  cand: Candidate;
  mod: ActionMod;
  /** 표시 확률 (슛 = 골 확률) */
  p: number;
  /** 바탕 후보 */
  baseCand: Candidate;
}

function pickBase(s: SimState, a: Agent, cands: Candidate[], eff: AddOption): Candidate | null {
  const dir = attackDir(a.team, s.half);
  const fwd = (c: Candidate) => (c.x - a.x) * dir > 3;
  let pool: Candidate[];
  switch (eff.base) {
    case 'shoot': pool = cands.filter((c) => c.type === 'shoot'); break;
    case 'pass': pool = cands.filter((c) => c.type === 'pass' || c.type === 'cutback' || c.type === 'layoff' || c.type === 'through'); break;
    case 'keyPass': pool = cands.filter((c) => c.type === 'through' || (c.type === 'pass' && fwd(c))); break;
    case 'longPass': pool = cands.filter((c) => (c.type === 'pass' || c.type === 'through') && dist(a.x, a.y, c.x, c.y) >= 25); break;
    case 'dribble': pool = cands.filter((c) => c.type === 'dribble'); if (!pool.length) pool = cands.filter((c) => c.type === 'carry' && fwd(c)); break;
    case 'carry': pool = cands.filter((c) => c.type === 'carry' && fwd(c)); break;
    case 'cross': pool = cands.filter((c) => c.type === 'cross' || c.type === 'cutback'); break;
    case 'holdup': pool = cands.filter((c) => c.type === 'holdup'); break;
    default: pool = [];
  }
  let best: Candidate | null = null;
  for (const c of pool) if (!best || c.u > best.u) best = c;
  return best;
}

/** 골 확률 (슛 변형): (1 − 블록) × 유효 × (1 − 선방) */
function shotGoalP(s: SimState, a: Agent, on: number, save: number, blockMul: number): number {
  const m = shotModel(s, a);
  const pOn = clamp(m.pOn + on, 0, 1);
  const pGoal = clamp(m.pGoal - save, 0, 1);
  return (1 - Math.min(1, m.pBlock * blockMul)) * pOn * pGoal;
}

/** 플레이 카드 한 장의 행동 변형. 바탕 후보가 없거나 위치 조건이 안 맞으면 null */
export function buildVariant(s: SimState, a: Agent, def: CardDef, hand: number, cands: Candidate[]): Variant | null {
  const cs = s.cards!;
  const eff = def.effects.find((e): e is AddOption => e.type === 'addOption');
  if (!eff || !whenOk(s, a, eff.when)) return null;
  const base = pickBase(s, a, cands, eff);
  if (!base) return null;
  const mod = emptyMod(def.id);
  mod.rs = eff.ratingSuccess ?? 0;
  mod.rf = eff.ratingFail ?? 0;
  const delta = (eff.probDelta ?? 0) + ((eff.probDelta ?? 0) > 0 ? masteryBonus(cs, def) : 0) + judgeShift(a, eff);
  const cand: Candidate = { ...base };
  let p: number;
  if (eff.base === 'shoot') {
    mod.on = Math.min(C.bonusCap, delta);
    mod.save = -(eff.saveDelta ?? 0);
    mod.blockMul = eff.blockMul ?? 1;
    p = shotGoalP(s, a, mod.on + passiveFor(s, a, ['shoot'], inOppBox(a.x, a.y, attackDir(a.team, s.half))), mod.save, mod.blockMul);
    cand.p = p;
    cand.value = p;
    cand.u = base.p > 0 ? base.u * (p / base.p) : base.u;
  } else if (eff.base === 'cross') {
    mod.on = delta;
    mod.edge = eff.edge ?? 0;
    p = capped(base.p, base.p + delta + mod.edge);
    cand.u = base.u + (p - base.p) * Math.max(0, base.value);
    cand.p = p;
  } else {
    let np = base.p + delta;
    if (eff.failMul !== undefined) np = 1 - (1 - np) * eff.failMul;
    // 상한은 패시브를 얹기 전 확률 기준 (한 행동 합계 +15%p)
    p = capped(base.p - (base.cardD ?? 0), np);
    cand.cardD = p - (base.p - (base.cardD ?? 0));
    cand.p = p;
    if (cand.pFlight !== undefined) cand.pFlight = capped(base.pFlight!, cand.pFlight + (p - base.p));
    if (eff.carry && cand.type === 'carry') {
      const dir = attackDir(a.team, s.half);
      cand.x = clamp(a.x + dir * eff.carry, 1, L - 1);
      cand.y = clamp(cand.y, 1, W - 1);
    }
    const [nx, ny] = toNorm(a.x, a.y, attackDir(a.team, s.half));
    cand.u = base.u + (p - base.p) * (base.value - lossCost(nx, ny));
  }
  return { hand, def, eff, cand, mod, p, baseCand: base };
}

// ── 결정 순간의 패 ──

export interface MomentCard {
  hand: number;
  id: string;
  name: string;
  kind: CardKind;
  rarity: Rarity;
  role: MomentCardRole;
  /** 카드 문구 (조건·효과) */
  text: string;
  usable: boolean;
  reason?: string;
  /** 확률 카드: 선택지별 확률 변화 (같은 순서, %p) */
  deltas?: number[];
}

/** 태그가 맞는 1회 확률 카드 값 (집중은 어떤 선택지든) */
export function boostValue(cs: CardState, def: CardDef, tags: OptionTag[]): number {
  let v = 0;
  for (const e of probEffects(def)) {
    if (e.duration !== 'once') continue;
    if (e.option && !tags.includes(e.option)) continue;
    v += e.value + (e.value > 0 ? masteryBonus(cs, def) : 0);
  }
  return Math.min(C.bonusCap, v);
}

/** 패시브를 지금 장착하면 이 태그 행동에 붙는 값 */
export function passiveValue(cs: CardState, def: CardDef, tags: OptionTag[], box: boolean): number {
  let v = 0;
  for (const e of probEffects(def)) if (e.option && tags.includes(e.option) && !(e.box && !box)) v += e.value + (e.value > 0 ? masteryBonus(cs, def) : 0);
  return v;
}

export interface OptionCtx {
  tags: OptionTag[];
  /** 이 선택지가 슛이면 슛 골 확률 환산 배율 (유효 %p → 골 %p) */
  shotK?: number;
  box: boolean;
}

const TAG_KO: Record<OptionTag, string> = {
  shoot: '슈팅', pass: '패스', dribble: '드리블 돌파', cross: '크로스', header: '공중볼', tackle: '태클', press: '압박', clear: '걷어내기',
  block: '블록', keyPass: '전진·침투 패스', safe: '안전한 선택', risky: '도박 선택',
};
const pp = (v: number) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%p`;

/** 카드 문구 (효과 스키마에서 만든다) */
export function cardText(def: CardDef): string {
  const ro = def.effects.find((e) => e.type === 'roleOnly');
  if (ro && ro.type === 'roleOnly') return ro.text;
  const out: string[] = [];
  for (const e of def.effects) {
    switch (e.type) {
      case 'addOption': out.push(`4번째 선택지 "${e.label}"${e.probDelta ? ` ${pp(e.probDelta)}` : ''}${e.note ? ` · ${e.note}` : ''}`); break;
      case 'probDelta':
        if (e.value === 0) out.push(e.note ?? '');
        else out.push(`${e.option ? TAG_KO[e.option] : '고른 선택지'} ${pp(e.value)}${e.box ? ' (박스 안)' : ''}${e.duration === 'rest' ? ' · 남은 경기' : ' · 이번 턴'}`);
        break;
      case 'nextSceneBonus': out.push(`${e.if} → 다음 ${e.option ? TAG_KO[e.option] : '행동'} ${pp(e.value)}`); break;
      case 'fatigueMult': out.push(`체력 소모 × ${e.value}`); break;
      case 'failureSoftener': out.push('이번 턴 실패하면 평점 감소 절반'); break;
      case 'discardDraw': out.push('못 쓰는 카드 1장 버리고 1장 뽑기'); break;
      case 'directive': out.push(e.text); break;
      default: break;
    }
  }
  return out.filter(Boolean).join(' · ') || def.condition;
}

/** 이 장면에서 패의 각 카드를 쓸 수 있는지와 미리보기 */
export function handView(
  s: SimState, a: Agent, scene: string, options: OptionCtx[], variants: Variant[], allowPlay: boolean,
): MomentCard[] {
  const cs = s.cards!;
  return cs.hand.map((id, i) => {
    const def = cardById(id)!;
    const role = cardRole(def);
    const card: MomentCard = { hand: i, id, name: def.name, kind: def.kind, rarity: def.rarity, role, text: cardText(def), usable: false };
    const req = reqProblem(s, a, def);
    if (req) return { ...card, reason: req };
    if (def.scenes.length && !def.scenes.includes(scene as never)) return { ...card, reason: '이 장면에서는 못 써요' };
    if (role === 'play') {
      if (!allowPlay) return { ...card, reason: '이 장면에서는 못 써요' };
      return variants.some((v) => v.hand === i) ? { ...card, usable: true } : { ...card, reason: '지금 위치·상황 조건이 안 맞아요' };
    }
    if (role === 'passive') {
      if (cs.passives.length >= C.passiveSlots) return { ...card, reason: `패시브 슬롯 ${C.passiveSlots}개가 찼어요` };
      const deltas = options.map((o) => Math.round(100 * Math.min(C.bonusCap, passiveValue(cs, def, o.tags, o.box)) * (o.shotK ?? 1)) / 100);
      return { ...card, usable: true, deltas };
    }
    if (role === 'boost') {
      const deltas = options.map((o) => Math.round(100 * boostValue(cs, def, o.tags) * (o.shotK ?? 1)) / 100);
      if (!deltas.some((d) => d !== 0)) return { ...card, reason: '맞는 선택지가 없어요' };
      return { ...card, usable: true, deltas };
    }
    if (role === 'redraw') return cs.pile.length && cs.hand.length > 1 ? { ...card, usable: true } : { ...card, reason: '뽑을 카드가 없어요' };
    return { ...card, usable: true };
  });
}

/** 카드 사용 처리 (패에서 빼고 기록). 패시브는 장착, 콤보는 대기, 리셋은 다른 카드 1장 버리고 1장 */
export function playCard(s: SimState, a: Agent, hand: number, scene: string, auto: boolean): CardUse {
  const cs = s.cards!;
  const id = cs.hand[hand]!;
  cs.hand.splice(hand, 1);
  const def = cardById(id)!;
  const use: CardUse = { id, minute: Math.floor(s.t / 60) + 1, scene, auto, result: 'neutral' };
  cs.uses.push(use);
  const role = cardRole(def);
  if (role === 'passive') {
    cs.passives.push(id);
    for (const e of def.effects) if (e.type === 'fatigueMult') a.drainMul *= e.value;
    const tk = passiveValue(cs, def, ['tackle'], false);
    const air = passiveValue(cs, def, ['header'], false);
    if (tk || air) {
      a.cardBoost ??= { tackle: 0, air: 0 };
      a.cardBoost.tackle = Math.min(C.bonusCap, a.cardBoost.tackle + tk);
      a.cardBoost.air = Math.min(C.bonusCap, a.cardBoost.air + air);
    }
  } else if (role === 'combo') {
    for (const e of def.effects) if (e.type === 'nextSceneBonus') cs.combos.push({ id, on: e.on, ...(e.option ? { option: e.option } : {}), value: e.value + masteryBonus(cs, def), armedT: s.t });
  } else if (role === 'redraw') {
    // 리셋: 쓸 수 없는 카드부터(없으면 맨 앞) 1장 버리고 1장 뽑는다
    let k = cs.hand.findIndex((h) => reqProblem(s, a, cardById(h)!) !== null);
    if (k < 0) k = 0;
    if (cs.hand.length) cs.hand.splice(k, 1);
    drawCards(cs, 1);
  }
  return use;
}

// ── 결과 판정 (성공 보너스 드로우, 카드 성공/실패 평점) ──

function snap(s: SimState, a: Agent): Snap {
  const t = s.teams[a.team].stats;
  return {
    goals: a.stats.goals, passes: a.stats.passesCompleted, crosses: a.stats.crossesCompleted, dribbles: a.stats.dribblesWon,
    tackles: a.stats.tacklesWon, holdups: t.holdupsWon, lost: t.dispossessed, blocks: a.stats.blocks, air: a.stats.aerialsWon, poss: s.possTeam,
  };
}

export function watchKind(action: string): WatchKind {
  switch (action) {
    case 'shoot': return 'shoot';
    case 'pass': case 'through': case 'cutback': case 'layoff': return 'pass';
    case 'cross': return 'cross';
    case 'dribble': return 'dribble';
    case 'carry': case 'hold': return 'carry';
    case 'holdup': return 'holdup';
    case 'tackle': case 'jockey': case 'lane': return 'duel';
    case 'foul': return 'foul';
    case 'header': return 'air';
    case 'block': return 'block';
    default: return 'none';
  }
}

/** 행동 실행 직후 판정 시작 (결정 순간·자동 카드 기회만) */
export function startWatch(s: SimState, a: Agent, action: string, mod: ActionMod | null, use: CardUse | null, down = 0): void {
  const cs = s.cards;
  if (!cs) return;
  if (cs.watch) resolveWatch(s, 'neutral');
  cs.watch = { kind: watchKind(action), t: s.t, team: a.team, snap: snap(s, a), rs: mod?.rs ?? 0, rf: mod?.rf ?? 0, soften: mod?.soften ?? 0, down, use };
}

function resolveWatch(s: SimState, res: 'success' | 'fail' | 'neutral'): void {
  const cs = s.cards!;
  const w = cs.watch!;
  cs.watch = null;
  const a = s.agents.find((x) => x.spec.isMe) ?? [...s.bench[0], ...s.bench[1]].find((x) => x.spec.isMe);
  if (!a) return;
  const R = ENGINE.rating;
  let dv = 0;
  if (res === 'success') {
    dv += w.rs;
    if (cs.bonus < C.bonusDraws && drawCards(cs, 1)) cs.bonus++;
    if (w.kind === 'duel') cs.lastTackleT = s.t;
  } else if (res === 'fail') {
    dv += w.rf;
    // 침착 (실패 평점 감소 절반): 고른 선택지의 실패 평점 추정과 카드 실패 평점을 되돌린다
    if (w.soften) dv -= w.soften * (w.down + w.rf);
  }
  if (dv) a.rt.card = (a.rt.card ?? 0) + dv / R.scale;
  if (w.use) w.use.result = res;
}

function watchState(s: SimState, w: Watch, a: Agent): 'success' | 'fail' | null {
  const n = snap(s, a);
  const o = w.snap;
  const lostBall = s.possTeam !== w.team;
  const late = s.t - w.t >= C.watchWindow;
  switch (w.kind) {
    case 'shoot': return n.goals > o.goals ? 'success' : late || (s.t - w.t > 0.5 && !s.ball.flight && s.ball.owner !== a.idx) ? 'fail' : null;
    case 'pass': return n.passes > o.passes ? 'success' : lostBall || late ? 'fail' : null;
    case 'cross': return n.crosses > o.crosses ? 'success' : lostBall || late ? 'fail' : null;
    case 'dribble': return n.dribbles > o.dribbles ? 'success' : 'fail';
    case 'holdup': return n.holdups > o.holdups ? 'success' : 'fail';
    case 'carry': return n.lost > o.lost || lostBall ? 'fail' : s.t - w.t >= 1 ? 'success' : null;
    case 'duel': return n.tackles > o.tackles || s.possTeam === w.team && o.poss !== w.team ? 'success' : late ? 'fail' : null;
    case 'foul': return 'success';
    case 'block': return n.blocks > o.blocks ? 'success' : 'fail';
    case 'air': return n.air > o.air ? 'success' : late ? 'fail' : null;
    default: return late ? 'fail' : null;
  }
}

/** 결과 판정을 지금 볼 수 있으면 (드리블·버티기는 실행과 같은 틱) */
export function checkWatch(s: SimState): void {
  const cs = s.cards;
  if (!cs?.watch) return;
  const a = s.agents.find((x) => x.spec.isMe);
  if (!a || !a.onPitch) {
    resolveWatch(s, 'neutral');
    return;
  }
  const r = watchState(s, cs.watch, a);
  if (r) resolveWatch(s, r);
}

/** 매 틱 (stepTail): 시작 패, 15분 드로우, 판정 */
export function cardsTick(s: SimState): void {
  const cs = s.cards;
  if (!cs) return;
  const a = me(s);
  if (a && !cs.started) {
    cs.started = true;
    drawCards(cs, C.startHand);
    cs.nextDraw = s.t + C.drawEvery;
  } else if (a && s.t >= cs.nextDraw) {
    drawCards(cs, 1);
    cs.nextDraw += C.drawEvery;
  }
  checkWatch(s);
}

/** 경기 끝: 열린 판정 정리, 기록 */
export function cardsFinish(s: SimState): void {
  const cs = s.cards;
  if (cs?.watch) {
    const a = s.agents.find((x) => x.spec.isMe);
    const r = a ? watchState(s, cs.watch, a) : null;
    resolveWatch(s, r ?? 'neutral');
  }
}

export function cardReport(s: SimState): CardReport | undefined {
  const cs = s.cards;
  if (!cs) return undefined;
  return { uses: cs.uses.map((u) => ({ ...u })), drawn: cs.drawn, bonus: cs.bonus, hand: [...cs.hand], passives: [...cs.passives] };
}

// ── 반응 카드 (멈추지 않는 장면: 공중볼·상대 슈팅. 조건이 맞으면 패에서 자동으로 쓴다, C.36 남은 일 참고) ──

function reactive(s: SimState, a: Agent, scenes: string[], base: AddOption['base'] | 'header'): { hand: number; def: CardDef; value: number; eff: AddOption | null } | null {
  const cs = s.cards!;
  for (let i = 0; i < cs.hand.length; i++) {
    const def = cardById(cs.hand[i]!)!;
    if (reqProblem(s, a, def) || !def.scenes.some((x) => scenes.includes(x))) continue;
    const eff = def.effects.find((e): e is AddOption => e.type === 'addOption' && e.base === base) ?? null;
    if (eff) return { hand: i, def, value: (eff.probDelta ?? 0) + judgeShift(a, eff), eff };
    const v = boostValue(cs, def, [base as OptionTag]);
    if (v) return { hand: i, def, value: v, eff: null };
  }
  return null;
}

/** 공중볼 경합에서 내 선수 보정: 패시브(공중 장악) + 반응 카드(다이빙 헤더·세트피스 가담 헤더·세트피스 수비) */
export function airCardEdge(s: SimState, a: Agent | null, attacking: boolean, fromCross: boolean): number {
  const cs = s.cards;
  if (!cs || !a || !a.spec.isMe) return 0;
  let v = a.cardBoost?.air ?? 0;
  const sp = s.t - s.possStartT < 15 ? s.possOrigin : null;
  const scenes = attacking ? (sp === 'corner' ? ['corner', 'aerial'] : fromCross ? ['aerial'] : []) : sp === 'corner' ? ['oppCorner'] : sp === 'freeKick' ? ['oppFreeKick'] : [];
  if (scenes.length) {
    const r = reactive(s, a, scenes, 'header');
    if (r) {
      const use = playCard(s, a, r.hand, scenes[0]!, true);
      v += r.value;
      startWatch(s, a, 'header', { ...emptyMod(r.def.id), rs: r.eff?.ratingSuccess ?? 0, rf: r.eff?.ratingFail ?? 0 }, use);
    }
  }
  return Math.min(C.bonusCap, v);
}

/** 상대 슈팅: 내가 슈팅 길(콘) 안이면 몸으로 막기 (반응 카드). 블록 확률 보정 */
export function blockCardBonus(s: SimState, shooter: Agent): { me: Agent; value: number } | null {
  const cs = s.cards;
  if (!cs) return null;
  const a = me(s);
  if (!a || a.team === shooter.team || a.line === 0) return null;
  const [gx, gy] = oppGoal(attackDir(shooter.team, s.half));
  const ux = gx - shooter.x;
  const uy = gy - shooter.y;
  const len2 = ux * ux + uy * uy || 1;
  const k = ((a.x - shooter.x) * ux + (a.y - shooter.y) * uy) / len2;
  if (k <= 0.02 || k >= 0.95) return null;
  const off = Math.abs((a.x - shooter.x) * uy - (a.y - shooter.y) * ux) / Math.sqrt(len2);
  if (off > ENGINE.prob.coneWidth) return null;
  const r = reactive(s, a, ['oppShot'], 'block');
  if (!r) return null;
  const use = playCard(s, a, r.hand, 'oppShot', true);
  startWatch(s, a, 'block', { ...emptyMod(r.def.id), rs: r.eff?.ratingSuccess ?? 0, rf: r.eff?.ratingFail ?? 0 }, use);
  return { me: a, value: Math.min(C.bonusCap, r.value) };
}

/** 자동 결정용 난수 (카드 기회의 softmax) */
export function cardRand(s: SimState, a: Agent, k: number): number {
  return rand(s.seed, s.tick, a.idx, Purpose.Cards, k + 10);
}
