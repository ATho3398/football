// 내 선수 개입: 결정 순간 (부록 E.11, E4). 직접 모드에서 내 선수의 결정 시점 중 중요도가 임계값 이상인 순간에 시뮬이 멈추고,
// 선택지 3개(안전/균형/도박) + 카드 0~1장 자리 + 맡기기를 보여 준다. 고른 행동은 엔진 후보 그대로 주입하고 결과는 E.8 확률로 판정한다.
// 자동 모드와 "맡기기"는 엔진 판단식(E.7)을 그대로 쓰므로 결과가 자동 경기와 같다 (같은 시드 → 같은 경기).
// 카드 (3단계, C.36): 패의 카드는 Moment.cards 로 보여 주고, 플레이 카드는 4번째 선택지(행동 변형), 확률 카드는 선택지 확률 보정이다.
// 자동 모드는 같은 중요도 기준의 "카드 기회"에서 F.5 규칙(플레이 카드 = 엔진 판단식이 같이 평가, 확률 카드 = 패 앞에서 조건 맞는 첫 장)을 쓴다.

import { BALANCE } from '../config/balance';
import { cardById, type OptionTag } from '../config/cards';
import { posGroup } from '../roster';
import { defJudgement, directFkOn, duelOdds, duelEligible, penaltyProb } from './actions';
import {
  boostValue, buildVariant, cardRand, emptyMod, handView, judgeShift, masteryBonus, passiveValue, playCard, prepCands, startWatch, tagsOf,
  type ActionMod, type CardUse, type MomentCard, type OptionCtx, type Variant,
} from './cards';
import { ENGINE } from './config';
import { dribbleProb } from './duel';
import { candidates, choose, shotModel, type ActionType, type Candidate } from './onball';
import { attackDir, dist, inOppBox, oppGoal, positionValue, toNorm } from './pitch';
import { ratingDelta, ratingParts } from './rating';
import { offsideRisk } from './referee';
import type { Agent, SimState } from './state';

const M = ENGINE.moments;

/** 장면 id (F.2.1). lineCall·aerial·oppShot·세트피스는 데이터와 분류만 있고 정지는 3단계에서 붙인다 */
export type SceneId =
  | 'shot' | 'dribble' | 'keyPass' | 'aerial' | 'cross' | 'counter' | 'press' | 'duel' | 'freeKick' | 'penalty' | 'corner'
  | 'oppShot' | 'oppFreeKick' | 'oppCorner' | 'lineCall' | 'holdUp' | 'rebound';

export const SCENE_LABEL: Record<SceneId, string> = {
  shot: '슈팅 찬스', dribble: '1대1 돌파', keyPass: '패스 선택', aerial: '공중볼', cross: '측면 크로스', counter: '역습',
  press: '전방 압박', duel: '수비 1대1', freeKick: '프리킥', penalty: '페널티킥', corner: '코너킥', oppShot: '상대 슈팅',
  oppFreeKick: '상대 프리킥', oppCorner: '상대 코너킥', lineCall: '라인 컨트롤', holdUp: '등지고 받음', rebound: '리바운드',
};

export type StopLevel = 'all' | 'important' | 'critical';
export type ControlMode = 'direct' | 'auto';
export type OptionKind = 'safe' | 'balanced' | 'gamble' | 'card';
export type DuelAction = 'tackle' | 'jockey' | 'lane' | 'foul';

export interface MomentOption {
  kind: OptionKind;
  action: ActionType | DuelAction;
  label: string;
  /** 성공 확률 (슛은 골 확률 xG). 판정이 없는 행동(따라붙기)은 null */
  p: number | null;
  success: string;
  fail: string;
  /** 평점 변화 추정: 성공 / 실패 (E.12 행동 델타 × scale) */
  up: number;
  down: number;
  /** 성공 시 위치 가치 (슛은 판단용 xG, 최적 플레이 봇용) */
  value: number;
  /** 침투·전진 패스: 받는 선수 오프사이드 위험 */
  offside?: 'low' | 'mid' | 'high';
  /** 카드 선택지: 바탕 행동의 확률 (카드 없이, C.36) */
  baseP?: number;
  /** 코트 화살표 (엔진 좌표, m) */
  to: { x: number; y: number };
  /** 받는 선수 / 상대 id (표시용) */
  target?: string;
  /** 내부: 후보 인덱스 / 1대1 행동 번호 */
  ref: number;
}

export interface Moment {
  id: number;
  type: 'onball' | 'duel' | 'setPiece';
  scene: SceneId;
  /** 경기 시계 (초) */
  t: number;
  minute: number;
  stake: number;
  score: [number, number];
  /** 내 팀 쪽 */
  side: 0 | 1;
  options: MomentOption[];
  /** 패 (C.36): 쓸 수 있는지, 확률 미리보기, 플레이 카드의 4번째 선택지. 카드가 없는 경기는 빈 배열 */
  cards: (MomentCard & { option?: MomentOption })[];
  /** 장착된 패시브 이름 */
  passives: string[];
  /** 내 선수와 상대(1대1) id */
  me: string;
  opponent?: string;
}

/** 경기 후 "내 결정 기록" 한 줄 (I.17 10번) */
export interface DecisionRecord {
  id: number;
  minute: number;
  scene: SceneId;
  /** 고른 선택지 유형 또는 맡김 */
  choice: OptionKind | 'delegate';
  label: string;
  p: number | null;
  /** 결과: 성공 / 실패 / 판정 중 경기 종료 */
  result: 'success' | 'fail' | 'neutral';
  /** 그 뒤 outcomeWindow 초 동안 실제 평점 변화 (팀 결과 제외) */
  delta: number;
  /** 재생용 흐른 시간 (초) */
  e: number;
  /** 중요도 (측정용) */
  stake: number;
  /** 화면이 보여 준 결과 (E5 최소, 부록 C.35): 결과 구간에서 본 성공/실패와 흐름. 직접 모드 화면에서만 채운다 (엔진은 읽지 않는다) */
  seen?: { result: 'success' | 'fail' | 'neutral'; flow: string };
  /** 이 결정에 쓴 카드 이름 (C.36) */
  card?: string;
}

/** 결정: 선택지 인덱스, 맡기기, 또는 카드와 함께 (opt = 'card' 면 플레이 카드가 연 4번째 선택지) */
export type MomentChoice = number | 'delegate' | { opt: number | 'card'; card: number | null };

/** 결정 정책: 선택지 인덱스 또는 맡기기. 없으면(직접 모드 화면) 시뮬이 멈춘다 */
export type MomentPolicy = (m: Moment) => MomentChoice;

export interface MomentControl {
  mode: ControlMode;
  stop: StopLevel;
  policy?: MomentPolicy;
}

export interface MomentState {
  control: MomentControl;
  pending: (Moment & { cands?: Candidate[]; variants?: Variant[] }) | null;
  stops: number;
  lastStopT: number;
  log: DecisionRecord[];
  /** 결과 판정 중인 결정: 시작 시 평점 델타, 소유 팀 */
  open: { rec: DecisionRecord; t: number; base: number; team: 0 | 1; action: string } | null;
  nextId: number;
}

export function initMoments(control?: MomentControl): MomentState {
  return { control: control ?? { mode: 'auto', stop: 'important' }, pending: null, stops: 0, lastStopT: -100, log: [], open: null, nextId: 1 };
}

function myDelta(s: SimState, a: Agent): number {
  const p = ratingParts(s, a, Math.max(1, s.elapsed));
  p.result = 0;
  p.cleanSheet = 0;
  p.conceded = 0;
  return ratingDelta(p) - ENGINE.rating.draw;
}

/** 결정 결과 정리: 다음 정지, outcomeWindow 초 경과, 경기 종료 때 */
export function settleMoment(s: SimState, force = false): void {
  const o = s.moments.open;
  if (!o) return;
  const a = s.agents.find((x) => x.spec.isMe) ?? [...s.bench[0], ...s.bench[1]].find((x) => x.spec.isMe);
  const inFlight = s.ball.flight !== null;
  if (!force && (s.t < o.t + M.outcomeWindow || inFlight)) return;
  const d = a ? (myDelta(s, a) - o.base) * ENGINE.rating.scale : 0;
  o.rec.delta = Math.round(d * 100) / 100;
  const keep = s.possTeam === o.team;
  o.rec.result = d > 0.005 ? 'success' : d < -0.005 ? 'fail'
    : o.action === 'jockey' || o.action === 'lane' ? 'neutral' : keep ? 'success' : 'fail';
  s.moments.open = null;
}

function stakeMul(s: SimState, team: 0 | 1): number {
  const gd = Math.abs(s.teams[team].stats.goals - s.teams[1 - team]!.stats.goals);
  return (s.input.bigMatch ? M.bigMatch : 1) * (s.t >= M.tensionMinute * 60 && gd <= 1 ? M.tension : 1);
}

/**
 * 이번 순간에 멈추는가: 임계값 × 정지 빈도 배수, 최소 턴 따라잡기, 최대 턴, 간격.
 * 자동 모드 카드 기회(F.5)도 같은 식을 "중요한 순간만" 기준으로 쓴다 (stops·lastT 는 카드 상태의 따로 센 값)
 */
function wouldStop(s: SimState, a: Agent, stake: number, stops: number, lastT: number, stop: StopLevel, mul = 1): boolean {
  if (s.t - lastT < M.gap) return false;
  const mins = s.input.myMinutes ? Math.max(1, s.input.myMinutes.end - s.input.myMinutes.start) : 90;
  const share = Math.min(1.5, mins / 90);
  if (stops >= Math.ceil(M.maxStops * share)) return false;
  const group = posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position);
  let th = (M.threshold[group] ?? 0.45) * M.stopMul[stop] * mul;
  // 최소 턴 (중요한 순간만·모든 순간): 출전 시간 대비 진행이 기대 턴보다 1 이상 뒤처지면 임계값을 낮춘다
  if (stop !== 'critical') {
    const played = Math.max(0, (s.t - a.enteredAt) / 60);
    const expected = M.minStops * share * Math.min(1, played / mins);
    if (stops < expected - 1) th *= M.catchUpMul;
  }
  return stake >= th;
}

function shouldStop(s: SimState, a: Agent, stake: number): boolean {
  const ms = s.moments;
  if (ms.control.mode !== 'direct') return false;
  return wouldStop(s, a, stake, ms.stops, ms.lastStopT, ms.control.stop);
}

/** 자동 모드 카드 기회 (F.5): 덱이 있고 자동 모드일 때, 직접 모드 "중요한 순간만"과 같은 기준 */
function autoOccasion(s: SimState, a: Agent, stake: number): boolean {
  const cs = s.cards;
  if (!cs || s.moments.control.mode !== 'auto') return false;
  if (!wouldStop(s, a, stake, cs.occ, cs.lastOccT, 'important', BALANCE.cards.autoStopMul)) return false;
  cs.occ++;
  cs.lastOccT = s.t;
  return true;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function nameOf(s: SimState, idx: number): string {
  const r = s.agents[idx];
  return r ? (r.spec.name ?? r.pos) : '';
}

/** 평점 변화 추정 (E.12 행동 델타 × scale): 성공 / 실패 */
function ratingEstimate(s: SimState, a: Agent, c: Candidate): [number, number] {
  const R = ENGINE.rating;
  const dir = attackDir(a.team, s.half);
  const [ax] = toNorm(a.x, a.y, dir);
  const lost = ax < 1 / 3 ? R.dangerLost : ax > 2 / 3 ? R.lost * R.attackLostFactor : R.lost;
  const fwd = (c.x - a.x) * dir > 3;
  switch (c.type) {
    case 'shoot': return [R.goal * R.scale, 0];
    case 'pass': case 'cutback': case 'layoff': return [(fwd ? R.forwardPass : R.pass) * R.scale, lost * R.scale];
    case 'through': return [(R.forwardPass + R.keyPass * 0.5) * R.scale, lost * R.scale];
    case 'cross': return [(R.forwardPass + R.keyPass * 0.5) * R.scale, lost * R.scale];
    case 'dribble': return [R.dribble * R.scale, lost * R.scale];
    case 'holdup': return [R.pass * R.scale, lost * R.scale];
    case 'clear': return [0, 0];
    default: return [0, lost * R.scale];
  }
}

const ACTION_TEXT: Record<ActionType, [string, string]> = {
  pass: ['패스 연결', '공을 뺏김'],
  through: ['침투 패스 연결', '차단당함'],
  cutback: ['컷백 연결', '차단당함'],
  layoff: ['내주기 연결', '차단당함'],
  holdup: ['버티고 지켜냄', '공을 뺏김'],
  carry: ['앞으로 전진', '공을 뺏김'],
  hold: ['공을 지킴', '압박에 뺏김'],
  shoot: ['골', '막히거나 빗나감'],
  cross: ['크로스가 동료에게', '수비가 걷어냄'],
  clear: ['위험 지역 탈출', '상대가 다시 잡음'],
  dribble: ['수비수를 제침', '태클에 뺏김'],
};

function labelOf(s: SimState, a: Agent, c: Candidate): string {
  const who = c.receiver >= 0 ? nameOf(s, c.receiver) : '';
  const dir = attackDir(a.team, s.half);
  switch (c.type) {
    case 'pass': return (c.x - a.x) * dir > 3 ? `${who}에게 전진 패스` : (c.x - a.x) * dir < -3 ? `${who}에게 백패스` : `${who}에게 패스`;
    case 'through': return `${who}에게 침투 패스`;
    case 'cutback': return `${who}에게 컷백`;
    case 'layoff': return `${who}에게 내주기`;
    case 'holdup': return '등지고 버티기';
    case 'carry': return Math.abs(c.y - a.y) > 2 ? '측면으로 몰고 가기' : '앞으로 몰고 가기';
    case 'hold': return '공 지키기';
    case 'shoot': return '슛';
    case 'cross': return `${who} 쪽 크로스`;
    case 'clear': return '걷어내기';
    case 'dribble': return `${nameOf(s, c.opponent ?? -1) || '수비수'} 1대1 돌파`;
  }
}

function sameAs(x: Candidate, y: Candidate): boolean {
  return x.type === y.type && x.receiver === y.receiver && Math.abs(x.x - y.x) < 0.5 && Math.abs(x.y - y.y) < 0.5;
}

/** 후보에서 선택지 3개: 안전(성공 확률 최고), 균형(효용 최고), 도박(성공 시 가치 최고). 겹치면 다음 순위 */
export function pickOptions(cands: Candidate[]): [Candidate | null, Candidate | null, Candidate | null] {
  const used: Candidate[] = [];
  const best = (score: (c: Candidate) => number, ok: (c: Candidate) => boolean = () => true): Candidate | null => {
    let b: Candidate | null = null;
    for (const c of cands) {
      if (!ok(c) || used.some((u) => sameAs(u, c))) continue;
      if (!b || score(c) > score(b)) b = c;
    }
    if (b) used.push(b);
    return b;
  };
  const balanced = best((c) => c.u);
  const safe = best((c) => c.p);
  const gamble = best((c) => c.value, (c) => c.p >= 0.04);
  return [safe, balanced, gamble];
}

function staminaAdj(s: SimState, a: Agent): number {
  return s.t >= M.staminaMinute * 60 ? -((100 - a.stamina) / 100) * M.staminaPenalty : 0;
}

function onballScene(s: SimState, a: Agent, cands: Candidate[]): SceneId {
  const dir = attackDir(a.team, s.half);
  if (a.backToGoal) return 'holdUp';
  if (s.t - s.lastShotT[a.team] <= M.reboundTime && inOppBox(a.x, a.y, dir)) return 'rebound';
  const shot = cands.find((c) => c.type === 'shoot');
  if (shot && shot.p >= M.shotSceneXg) return 'shot';
  if (s.possOrigin === 'open' && s.t - s.teams[a.team].wonAt <= M.counterTime) return 'counter';
  if (cands.some((c) => c.type === 'cross')) return 'cross';
  if (cands.some((c) => c.type === 'dribble')) return 'dribble';
  return 'keyPass';
}

/** 소유 결정의 중요도 (E.11): stakeK × (최대 위치 가치 증가분 + 최대 xG) × 경기 중요도 × 긴장도 */
function onballStake(s: SimState, a: Agent, cands: Candidate[]): number {
  const dir = attackDir(a.team, s.half);
  const [ax, ay] = toNorm(a.x, a.y, dir);
  const here = positionValue(ax, ay);
  let gain = 0;
  let xg = 0;
  for (const c of cands) {
    if (c.type === 'shoot') xg = Math.max(xg, c.p);
    else gain = Math.max(gain, c.value - here);
  }
  return M.stakeK * (gain + xg) * stakeMul(s, a.team);
}

function optionOf(s: SimState, a: Agent, c: Candidate, kind: OptionKind, ref: number, adj: number, label?: string, extra?: { rs: number; rf: number }): MomentOption {
  const dir = attackDir(a.team, s.half);
  const [up, down] = ratingEstimate(s, a, c);
  const [succ, fail] = ACTION_TEXT[c.type];
  const p = c.type === 'shoot' ? c.p : Math.max(0.01, Math.min(0.99, c.p + adj));
  const opt: MomentOption = {
    kind, action: c.type, label: label ?? labelOf(s, a, c), p: round2(p), success: succ, fail, up: round2(up + (extra?.rs ?? 0)), down: round2(down + (extra?.rf ?? 0)),
    to: { x: c.x, y: c.y }, ref, value: Math.round(c.value * 1000) / 1000,
    ...(c.receiver >= 0 ? { target: s.agents[c.receiver]!.id } : c.opponent !== undefined ? { target: s.agents[c.opponent]!.id } : {}),
  };
  if ((c.type === 'through' || c.type === 'pass') && c.receiver >= 0 && (c.x - a.x) * dir > 3) {
    const r = offsideRisk(s, a, s.agents[c.receiver]!);
    opt.offside = r < 0.15 ? 'low' : r < 0.5 ? 'mid' : 'high';
  }
  return opt;
}

/** 선택지의 카드 미리보기용 맥락 (태그, 슛이면 유효 → 골 확률 배율) */
function optionCtx(s: SimState, a: Agent, c: Candidate): OptionCtx {
  const box = inOppBox(a.x, a.y, attackDir(a.team, s.half));
  if (c.type !== 'shoot') return { tags: tagsOf(s, a, c), box };
  const m = shotModel(s, a);
  return { tags: tagsOf(s, a, c), box, shotK: (1 - m.pBlock) * m.pGoal };
}

/** 요건·장면이 맞는 플레이 카드 (변형을 만들어 볼 카드): handView 에 변형 없이 물으면 위치 조건 문구만 남는 카드 */
const NO_VARIANT = '지금 위치·상황 조건이 안 맞아요';

function playable(s: SimState, a: Agent, scene: SceneId): number[] {
  return handView(s, a, scene, [], [], true).filter((v) => v.role === 'play' && v.reason === NO_VARIANT).map((v) => v.hand);
}

/** 플레이 카드 변형 (패에서 장면·요건이 맞는 카드) */
function onballVariants(s: SimState, a: Agent, scene: SceneId, cands: Candidate[]): Variant[] {
  const cs = s.cards;
  if (!cs) return [];
  const out: Variant[] = [];
  for (const i of playable(s, a, scene)) {
    const v = buildVariant(s, a, cardById(cs.hand[i]!)!, i, cands);
    if (v) out.push(v);
  }
  return out;
}

/** 내 선수 결정 시점 (소유): 멈출 순간이면 s.moments.pending 을 채우고 true */
export function onballMoment(s: SimState, a: Agent): boolean {
  const ms = s.moments;
  if (!a.spec.isMe || ms.control.mode !== 'direct' || a.line === 0) return false;
  const cands = candidates(s, a);
  prepCands(s, a, cands);
  const stake = onballStake(s, a, cands);
  if (!shouldStop(s, a, stake)) return false;
  const adj = staminaAdj(s, a);
  const kinds: OptionKind[] = ['safe', 'balanced', 'gamble'];
  const picks = pickOptions(cands);
  const options: MomentOption[] = [];
  const ctx: OptionCtx[] = [];
  picks.forEach((c, i) => {
    if (!c) return;
    const o = optionOf(s, a, c, kinds[i]!, cands.indexOf(c), adj);
    if (c.type === 'shoot' && s.cards) o.p = round2(shotP(s, a, c.p));
    options.push(o);
    ctx.push(optionCtx(s, a, c));
  });
  const scene = onballScene(s, a, cands);
  let cards: Moment['cards'] = [];
  let variants: Variant[] = [];
  if (s.cards) {
    variants = onballVariants(s, a, scene, cands);
    cards = handView(s, a, scene, ctx, variants, true).map((mc) => {
      const v = variants.find((x) => x.hand === mc.hand);
      if (!v) return mc;
      const option = optionOf(s, a, v.cand, 'card', -1, adj, labelOf(s, a, v.cand), { rs: v.mod.rs, rf: v.mod.rf });
      const bp = v.baseCand.type === 'shoot' ? shotP(s, a, v.baseCand.p) : Math.max(0.01, Math.min(0.99, v.baseCand.p - (v.baseCand.cardD ?? 0) + adj));
      return { ...mc, option: { ...option, baseP: round2(bp) } };
    });
  }
  settleMoment(s, true);
  ms.pending = { ...base(s, a, 'onball', scene, stake), options, cards, cands, variants };
  return true;
}

/** 슛 선택지 골 확률에 패시브(박스 안)·콤보를 얹는다 */
function shotP(s: SimState, a: Agent, p: number): number {
  const cs = s.cards;
  if (!cs?.passives.length) return p;
  const m = shotModel(s, a);
  const pre = m.pOn;
  const box = inOppBox(a.x, a.y, attackDir(a.team, s.half));
  let on = 0;
  for (const id of cs.passives) on += boostLike(cs, id, 'shoot', box);
  on = Math.min(BALANCE.cards.bonusCap, on);
  if (!on || pre <= 0) return p;
  return p * Math.min(1, pre + on) / pre;
}

function boostLike(cs: NonNullable<SimState['cards']>, id: string, tag: 'shoot', box: boolean): number {
  const def = cardById(id)!;
  let v = 0;
  for (const e of def.effects) if (e.type === 'probDelta' && e.option === tag && !(e.box && !box)) v += e.value;
  void cs;
  return v;
}

function base(s: SimState, a: Agent, type: Moment['type'], scene: SceneId, stake: number): Moment {
  const ms = s.moments;
  return {
    id: ms.nextId, type, scene, t: Math.round(s.t * 10) / 10, minute: Math.floor(s.t / 60) + 1, stake: round2(stake),
    score: [s.teams[0].stats.goals, s.teams[1].stats.goals], side: a.team, options: [], cards: [], passives: s.cards ? s.cards.passives.map((id) => cardById(id)!.name) : [], me: a.spec.id,
  };
}

/** 수비 1대1 카드 변형: 태클 계열(슬라이딩·커버링 질주·시그니처) 또는 전술적 파울 */
interface DuelVariant { hand: number; pick: 0 | 3; pDelta: number; foulMul: number; p: number; mod: ActionMod; label: string }

function duelVariants(s: SimState, a: Agent, scene: SceneId, pWin: number): DuelVariant[] {
  const cs = s.cards;
  if (!cs) return [];
  const out: DuelVariant[] = [];
  for (const i of playable(s, a, scene)) {
    const def = cardById(cs.hand[i]!)!;
    const eff = def.effects.find((e) => e.type === 'addOption');
    if (!eff || eff.type !== 'addOption' || (eff.base !== 'tackle' && eff.base !== 'race' && eff.base !== 'foul')) continue;
    const mod = { ...emptyMod(def.id), rs: eff.ratingSuccess ?? 0, rf: eff.ratingFail ?? 0 };
    if (eff.base === 'foul') {
      out.push({ hand: i, pick: 3, pDelta: 0, foulMul: 1, p: TACTICAL_FOUL, mod, label: eff.label });
      continue;
    }
    const raw = (eff.probDelta ?? 0) + ((eff.probDelta ?? 0) > 0 ? masteryBonus(cs, def) : 0) + judgeShift(a, eff);
    const ref = pWin - (a.cardBoost?.tackle ?? 0);
    const p = Math.max(0.02, Math.min(0.98, Math.min(pWin + raw, ref + BALANCE.cards.bonusCap)));
    out.push({ hand: i, pick: 0, pDelta: p - pWin, foulMul: eff.foulMul ?? 1, p, mod, label: eff.label });
  }
  return out;
}

/** 전술적 파울 성공 확률 (F.4: 90%) */
export const TACTICAL_FOUL = 0.9;

/** 상대 소유자와 1대1 (내가 가장 가까운 수비수, duelRange 안): 멈출 순간이면 pending 을 채우고 true. 자동 모드 카드 기회도 여기서 */
export function duelMoment(s: SimState): boolean {
  const ms = s.moments;
  if (ms.control.mode !== 'direct' && !s.cards) return false;
  const o = s.agents[s.ball.owner];
  if (!o || o.line === 0) return false;
  const a = s.agents.find((x) => x.spec.isMe && x.onPitch);
  if (!a || a.team === o.team || !duelEligible(s, o, a)) return false;
  const da = dist(a.x, a.y, o.x, o.y);
  for (const d of s.agents) if (d !== a && d.onPitch && d.team === a.team && d.line !== 0 && dist(d.x, d.y, o.x, o.y) < da) return false;
  const odds = duelOdds(s, o, a);
  const dirO = attackDir(o.team, s.half);
  const [gx, gy] = oppGoal(dirO);
  const xg = dist(o.x, o.y, gx, gy) <= ENGINE.prob.shotMaxDist && toNorm(o.x, o.y, dirO)[0] > 0.6 ? shotModel(s, o).xg : 0;
  const stake = M.stakeK * (odds.beaten + xg) * stakeMul(s, a.team);
  const own = toNorm(o.x, o.y, attackDir(a.team, s.half))[0] < 0.5;
  const scene: SceneId = own ? 'duel' : 'press';
  if (ms.control.mode !== 'direct') {
    if (autoOccasion(s, a, stake)) autoCardDuel(s, a, o, odds, scene);
    return false;
  }
  if (!shouldStop(s, a, stake)) return false;
  const R = ENGINE.rating;
  const pBeat = dribbleProb(o, a);
  const options: MomentOption[] = [
    {
      kind: 'safe', action: 'jockey', label: '따라붙으며 지연', p: null, success: '동료가 돌아올 시간을 범', fail: '판정 없음',
      up: 0, down: 0, to: { x: o.x, y: o.y }, target: o.spec.id, ref: 1, value: 0,
    },
    {
      kind: 'balanced', action: 'lane', label: '패스길 막기', p: null, success: '위험한 패스를 막음', fail: `돌파 허용 위험 (상대 돌파 ${Math.round(pBeat * 100)}%)`,
      up: round2(R.interception * 0.3 * R.scale), down: 0, to: { x: (o.x + a.x) / 2, y: (o.y + a.y) / 2 }, target: o.spec.id, ref: 2, value: 0,
    },
    {
      kind: 'gamble', action: 'tackle', label: '태클', p: round2(odds.pWin), success: '공을 빼앗음', fail: `제쳐짐 · 파울 ${Math.round(odds.pFoul * 100)}%`,
      up: round2(R.tackle * R.scale), down: round2(odds.pFoul * R.foul * R.scale), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 0, value: 0,
    },
  ];
  let cards: Moment['cards'] = [];
  let dv: DuelVariant[] = [];
  if (s.cards) {
    dv = duelVariants(s, a, scene, odds.pWin);
    const ctx: OptionCtx[] = [{ tags: ['safe'], box: false }, { tags: ['press'], box: false }, { tags: ['tackle', 'risky'], box: false }];
    const fake: Variant[] = dv.map((v) => ({ hand: v.hand }) as Variant);
    cards = handView(s, a, scene, ctx, fake, true).map((mc) => {
      if (mc.deltas) mc.deltas = mc.deltas.map((d, k) => (options[k]!.p === null ? 0 : d));
      if (mc.deltas && mc.role === 'boost' && !mc.deltas.some((d) => d !== 0)) return { ...mc, usable: false, reason: '맞는 선택지가 없어요', deltas: undefined };
      const v = dv.find((x) => x.hand === mc.hand);
      if (!v) return mc;
      const opt: MomentOption = v.pick === 3
        ? { kind: 'card', action: 'foul', label: v.label, p: TACTICAL_FOUL, success: '역습을 끊음', fail: '놓침 · 경고 위험 70%', up: round2(v.mod.rs), down: round2(R.foul * R.scale + v.mod.rf), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 3, value: 0 }
        : { kind: 'card', action: 'tackle', label: v.label, p: round2(v.p), baseP: round2(odds.pWin - (a.cardBoost?.tackle ?? 0)), success: '공을 빼앗음', fail: `제쳐짐 · 파울 ${Math.round(Math.min(1, odds.pFoul * v.foulMul) * 100)}%`, up: round2(R.tackle * R.scale + v.mod.rs), down: round2(odds.pFoul * v.foulMul * R.foul * R.scale + v.mod.rf), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 0, value: 0 };
      return { ...mc, option: opt };
    });
  }
  settleMoment(s, true);
  ms.pending = { ...base(s, a, 'duel', scene, stake), options, opponent: o.spec.id, cards, ...(dv.length ? { duelVariants: dv } : {}) } as Moment & { duelVariants?: DuelVariant[] };
  return true;
}

/** 자동 모드 1대1 카드 기회 (F.5): 플레이 카드(태클 변형·전술적 파울)는 엔진 판단식(1대1 효용 softmax)이 같이 평가, 아니면 첫 확률 카드 */
function autoCardDuel(s: SimState, a: Agent, o: Agent, odds: ReturnType<typeof duelOdds>, scene: SceneId): void {
  const cs = s.cards!;
  const dv = duelVariants(s, a, scene, odds.pWin);
  const us: number[] = [...odds.us];
  for (const v of dv) {
    if (v.pick === 3) us.push(TACTICAL_FOUL * odds.beaten - ENGINE.defense.foulCost);
    else {
      a.cardBoost ??= { tackle: 0, air: 0 };
      a.cardBoost.tackle += v.pDelta;
      us.push(duelOdds(s, o, a).us[0]);
      a.cardBoost.tackle -= v.pDelta;
    }
  }
  const O = ENGINE.onball;
  const tau = O.tempBase * Math.exp(O.tempSlope * (0.7 - defJudgement(a)));
  const mx = Math.max(...us);
  const ws = us.map((u) => Math.exp(((u - mx) * O.utilityScale) / tau));
  let x = cardRand(s, a, 0) * ws.reduce((t, w) => t + w, 0);
  let pick = ws.length - 1;
  for (let k = 0; k < ws.length; k++) {
    x -= ws[k]!;
    if (x <= 0) {
      pick = k;
      break;
    }
  }
  if (pick >= 3) {
    const v = dv[pick - 3]!;
    const use = playCard(s, a, v.hand, scene, true);
    s.forcedDuel = { idx: a.idx, pick: v.pick, pDelta: v.pDelta, foulMul: v.foulMul };
    pendingWatch(s, a, v.pick === 3 ? 'foul' : 'tackle', v.mod, use);
    return;
  }
  // 확률 카드: 패 앞에서 조건 맞는 첫 장 (엔진이 고른 행동에 맞으면)
  const action = (['tackle', 'jockey', 'lane'] as const)[pick]!;
  const tags: OptionTag[] = action === 'tackle' ? ['tackle', 'risky'] : action === 'jockey' ? ['safe'] : ['press'];
  const r = firstProbCard(s, a, scene, tags, action === 'tackle' ? 'duel' : 'none');
  if (!r) return;
  s.forcedDuel = { idx: a.idx, pick: pick === 0 ? 0 : pick === 1 ? 1 : 2, pDelta: r.delta };
  pendingWatch(s, a, action, r.mod, r.use);
}

/**
 * 첫 확률 카드 (F.5): 패 앞에서부터 요건·장면이 맞고 이 행동에 효과가 있는 카드 1장을 쓴다 (확률·패시브·콤보·침착, 리셋은 못 쓰는 카드가 있을 때).
 * 반환 delta 는 이 행동의 성공 확률 %p (패시브가 엔진 훅으로 붙는 슛·1대1은 0)
 */
function firstProbCard(s: SimState, a: Agent, scene: SceneId, tags: OptionTag[], kind: 'onball' | 'shot' | 'duel' | 'none'): { delta: number; mod: ActionMod; use: CardUse } | null {
  const cs = s.cards!;
  const box = inOppBox(a.x, a.y, attackDir(a.team, s.half));
  const view = handView(s, a, scene, [{ tags, box }], [], false);
  const dead = view.some((v) => !v.usable && v.reason !== undefined && v.reason !== '이 장면에서는 못 써요' && v.reason !== NO_VARIANT && !v.reason.startsWith('패시브'));
  for (const mc of view) {
    if (!mc.usable || mc.role === 'play') continue;
    if (mc.role === 'boost' && (kind === 'none' || !mc.deltas?.[0])) continue;
    if (mc.role === 'redraw' && !dead) continue;
    const def = cardById(mc.id)!;
    const delta = kind === 'none' ? 0 : mc.role === 'boost' ? boostValue(cs, def, tags) : mc.role === 'passive' && kind === 'onball' ? Math.min(BALANCE.cards.bonusCap, passiveValue(cs, def, tags, box)) : 0;
    const use = playCard(s, a, mc.hand, scene, true);
    const mod = emptyMod(def.id);
    for (const e of def.effects) if (e.type === 'failureSoftener') mod.soften = e.value;
    return { delta, mod, use };
  }
  return null;
}

/** 판정 시작을 다음 실행 뒤로 (1대1은 defendDuels 가 실행한다): 지금 상태를 스냅샷으로 남긴다 */
function pendingWatch(s: SimState, a: Agent, action: string, mod: ActionMod | null, use: CardUse | null, down = 0): void {
  startWatch(s, a, action, mod, use, down);
}

/**
 * 자동 모드 소유 카드 기회 (F.5): 플레이 카드 변형을 엔진 후보에 넣어 엔진 판단식(E.7 softmax)이 같이 고르게 하고,
 * 변형을 고르지 않았으면 패 앞에서 조건 맞는 첫 확률 카드를 그 행동에 쓴다. 기회가 아니면 null (엔진 그대로)
 */
export function autoCardDecide(s: SimState, a: Agent, cands: Candidate[]): { cand: Candidate; mod: ActionMod | null; use: CardUse | null } | null {
  if (!s.cards || a.line === 0 || s.moments.control.mode !== 'auto') return null;
  const stake = onballStake(s, a, cands);
  if (!autoOccasion(s, a, stake)) return null;
  const scene = onballScene(s, a, cands);
  const vars = onballVariants(s, a, scene, cands);
  const pool = vars.length ? [...cands, ...vars.map((v) => v.cand)] : cands;
  const c = choose(s, a, pool);
  const v = vars.find((x) => x.cand === c);
  if (v) {
    const use = playCard(s, a, v.hand, scene, true);
    return { cand: c, mod: v.mod, use };
  }
  const tags = tagsOf(s, a, c);
  const r = firstProbCard(s, a, scene, tags, c.type === 'shoot' ? 'shot' : 'onball');
  if (!r) return { cand: c, mod: null, use: null };
  return { cand: applyDelta(c, r.delta, r.mod), mod: r.mod, use: r.use };
}

/** 확률 보정을 후보에 (슛은 실행 보정 on 으로) */
function applyDelta(c: Candidate, delta: number, mod: ActionMod): Candidate {
  if (!delta) return c;
  if (c.type === 'shoot' || c.type === 'cross') {
    mod.on += delta;
    return c;
  }
  const room = Math.max(0, BALANCE.cards.bonusCap - (c.cardD ?? 0));
  const d = Math.min(delta, room);
  const out = { ...c, p: Math.min(0.99, c.p + d), cardD: (c.cardD ?? 0) + d };
  if (out.pFlight !== undefined) out.pFlight = Math.min(0.99, out.pFlight + d);
  return out;
}

/**
 * 세트피스 (C.36, pending 32 ②): 내 선수가 PK·직접 프리킥 키커이고 그 장면 카드를 쓸 수 있으면 직접 모드는 멈추고,
 * 자동 모드는 F.5 규칙으로 카드를 정해 s.cards.sp 에 둔다 (재개 실행에만 붙는다). 멈췄으면 true
 */
export function setPieceMoment(s: SimState): boolean {
  const cs = s.cards;
  const r = s.restart;
  if (!cs || !r || !cs.hand.length) return false;
  const a = s.agents[r.taker];
  if (!a || !a.spec.isMe || !a.onPitch) return false;
  const scene: SceneId | null = r.type === 'penalty' ? 'penalty' : r.type === 'freeKick' && !r.indirect ? 'freeKick' : null;
  if (!scene) return false;
  const R = ENGINE.rating;
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const pPen = scene === 'penalty' ? penaltyProb(s, a, 0) : 0;
  const options: MomentOption[] = scene === 'penalty'
    ? [{ kind: 'balanced', action: 'shoot', label: 'PK 슈팅', p: round2(pPen), success: '골', fail: '선방·실축', up: round2(R.goal * R.scale), down: 0, to: { x: gx, y: gy }, ref: 0, value: pPen }]
    : [{ kind: 'balanced', action: 'hold', label: '엔진 판단대로 (슈팅·크로스·패스)', p: null, success: '세트피스 진행', fail: '-', up: 0, down: 0, to: { x: gx, y: gy }, ref: 0, value: 0 }];
  const ctx: OptionCtx[] = [{ tags: scene === 'penalty' ? ['shoot'] : ['cross', 'pass'], box: scene === 'penalty' }];
  const vars = setPieceVariants(s, a, scene, pPen);
  const fake = vars.map((v) => ({ hand: v.hand }) as Variant);
  const view = handView(s, a, scene, ctx, fake, true).map((mc) => {
    const v = vars.find((x) => x.hand === mc.hand);
    if (!v) return mc;
    const opt: MomentOption = {
      kind: 'card', action: 'shoot', label: v.label, p: round2(v.p), ...(scene === 'penalty' ? { baseP: round2(pPen) } : {}), success: '골', fail: scene === 'penalty' ? '선방·실축' : '벽·선방·빗나감',
      up: round2(R.goal * R.scale + v.mod.rs), down: round2(v.mod.rf), to: { x: gx, y: gy }, ref: 0, value: v.p,
    };
    return { ...mc, option: opt };
  });
  if (!view.some((c) => c.usable)) return false;
  if (s.moments.control.mode === 'direct') {
    const ms = s.moments;
    settleMoment(s, true);
    ms.pending = { ...base(s, a, 'setPiece', scene, 1), options, cards: view, ...(vars.length ? { spVariants: vars } : {}) } as Moment;
    return true;
  }
  // 자동 (F.5): 카드 선택지는 엔진이 같이 평가 (골 확률이 기본 처리보다 높으면), 아니면 첫 확률 카드
  cs.occ++;
  cs.lastOccT = s.t;
  const [nx, ny] = toNorm(a.x, a.y, dir);
  const baseValue = scene === 'penalty' ? pPen : positionValue(nx, ny);
  const best = vars.reduce<SpVariant | null>((b, v) => (v.p > baseValue && (!b || v.p > b.p) ? v : b), null);
  if (best) {
    const use = playCard(s, a, best.hand, scene, true);
    cs.sp = best.mod;
    startWatch(s, a, 'shoot', best.mod, use);
    return false;
  }
  const pr = firstProbCard(s, a, scene, ctx[0]!.tags, 'onball');
  if (pr) {
    pr.mod.on += pr.delta;
    cs.sp = pr.mod;
    startWatch(s, a, scene === 'penalty' ? 'shoot' : 'pass', pr.mod, pr.use);
  }
  return false;
}

function probTag(id: string, tag: string): boolean {
  return cardById(id)!.effects.some((e) => e.type === 'probDelta' && e.option === tag);
}

interface SpVariant { hand: number; p: number; mod: ActionMod; label: string }

/** 세트피스 슛 변형 (프리킥 스페셜·무회전·파넨카): PK = PK 성공 확률 + 보정, 직접 프리킥 = (1 − 벽) × 유효 × (1 − 선방) */
function setPieceVariants(s: SimState, a: Agent, scene: SceneId, pPen: number): SpVariant[] {
  const cs = s.cards!;
  const out: SpVariant[] = [];
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const d = dist(a.x, a.y, gx, gy);
  for (const i of playable(s, a, scene)) {
    const def = cardById(cs.hand[i]!)!;
    const eff = def.effects.find((e) => e.type === 'addOption');
    if (!eff || eff.type !== 'addOption' || eff.base !== 'shoot') continue;
    if (eff.when?.minDist !== undefined && d < eff.when.minDist) continue;
    const delta = (eff.probDelta ?? 0) + ((eff.probDelta ?? 0) > 0 ? masteryBonus(cs, def) : 0) + judgeShift(a, eff);
    const mod = { ...emptyMod(def.id), on: delta, save: -(eff.saveDelta ?? 0), blockMul: eff.blockMul ?? 1, rs: eff.ratingSuccess ?? 0, rf: eff.ratingFail ?? 0 };
    let p: number;
    if (scene === 'penalty') p = Math.max(0.05, Math.min(0.97, pPen + delta));
    else {
      if (d > FK_CARD_MAX || Math.abs(a.y - gy) >= 15) continue;
      mod.direct = true;
      const m = shotModel(s, a);
      const pOn = Math.max(0, Math.min(1, directFkOn(a, d) + delta));
      p = (1 - ENGINE.setPiece.wallBlock * mod.blockMul) * pOn * Math.max(0, Math.min(1, m.pGoal + mod.save));
    }
    out.push({ hand: i, p, mod, label: eff.label });
  }
  return out;
}

/** 카드로 차는 직접 프리킥 최대 거리 (m): 엔진 직접 프리킥(directMax 25 m)보다 조금 멀리까지 */
const FK_CARD_MAX = 30;

/** 결정 확정: 기록을 남기고 주입할 후보(소유)·1대1 행동·세트피스 보정을 돌려준다. delegate 면 cand/duel 없음 (엔진 판단) */
export function takeMoment(s: SimState, choice: MomentChoice): {
  cand: Candidate | null; duel: { pick: number; pDelta?: number; foulMul?: number } | null; mod: ActionMod | null; use: CardUse | null; action: string | null; down: number;
} {
  const ms = s.moments;
  const m = ms.pending! as Moment & { cands?: Candidate[]; variants?: Variant[]; duelVariants?: DuelVariant[]; spVariants?: SpVariant[] };
  ms.pending = null;
  settleMoment(s, true);
  ms.stops++;
  ms.nextId++;
  ms.lastStopT = s.t;
  const a = s.agents.find((x) => x.spec.isMe)!;
  const pick: { opt: number | 'card' | 'delegate'; card: number | null } = typeof choice === 'object' ? choice : { opt: choice, card: null };
  const mc = pick.card !== null && pick.opt !== 'delegate' ? m.cards.find((c) => c.hand === pick.card && c.usable) ?? null : null;
  const useCardOpt = pick.opt === 'card' && mc?.option;
  const opt = pick.opt === 'delegate' ? null : useCardOpt ? mc!.option! : m.options[pick.opt as number] ?? null;
  const rec: DecisionRecord = {
    id: m.id, minute: m.minute, scene: m.scene, choice: opt ? opt.kind : 'delegate', label: opt ? opt.label : '맡기기 (엔진 판단)',
    p: opt ? opt.p : null, result: 'neutral', delta: 0, e: Math.round(s.elapsed * 10) / 10, stake: m.stake,
  };
  ms.log.push(rec);
  ms.open = { rec, t: s.t, base: myDelta(s, a), team: a.team, action: opt ? opt.action : 'delegate' };
  if (!opt) return { cand: null, duel: null, mod: null, use: null, action: null, down: 0 };
  // 카드 (C.36): 플레이 카드는 그 선택지일 때만, 확률·패시브·콤보·침착·리셋은 고른 선택지와 함께
  let use: CardUse | null = null;
  let mod: ActionMod | null = s.cards ? emptyMod() : null;
  let delta = 0;
  if (mc && (mc.role !== 'play' || useCardOpt)) {
    rec.card = mc.name;
    const idx = useCardOpt ? -1 : (pick.opt as number);
    delta = idx >= 0 ? (mc.deltas?.[idx] ?? 0) : 0;
    use = playCard(s, a, mc.hand, m.scene, false);
    const def = cardById(mc.id)!;
    for (const e of def.effects) if (e.type === 'failureSoftener') mod!.soften = e.value;
  }
  if (m.type === 'setPiece') {
    if (useCardOpt) {
      const v = m.spVariants!.find((x) => x.hand === mc!.hand)!;
      mod = v.mod;
    } else if (mod && delta) mod.on += delta;
    else if (mod && use && probTag(use.id, 'cross')) mod.on += boostValue(s.cards!, cardById(use.id)!, ['cross']);
    rec.p = opt.p;
    return { cand: null, duel: null, mod, use, action: useCardOpt || m.scene === 'penalty' ? 'shoot' : 'pass', down: 0 };
  }
  if (m.type === 'duel') {
    if (useCardOpt) {
      const v = m.duelVariants!.find((x) => x.hand === mc!.hand)!;
      return { cand: null, duel: { pick: v.pick, pDelta: v.pDelta, foulMul: v.foulMul }, mod: v.mod, use, action: v.pick === 3 ? 'foul' : 'tackle', down: opt.down };
    }
    // 패시브(철벽 수비 등)는 장착하면 duelOdds 가 붙인다
    const pd = mc?.role === 'boost' ? delta : 0;
    return { cand: null, duel: { pick: opt.ref, ...(pd ? { pDelta: pd } : {}) }, mod, use, action: opt.action, down: opt.down };
  }
  let c: Candidate;
  if (useCardOpt) {
    const v = m.variants!.find((x) => x.hand === mc!.hand)!;
    c = v.cand;
    mod = v.mod;
  } else {
    c = m.cands![opt.ref]!;
    // 확률 카드: 슛은 유효 슈팅 %p 로 (표시는 골 확률로 환산했다)
    if (delta && mod) {
      // 패시브를 장착한 슛은 실행 훅(shotCardMod)이 붙이므로 여기서 더하지 않는다
      const passive = mc!.role === 'passive';
      const raw = c.type === 'shoot' ? (passive ? 0 : boostValue(s.cards!, cardById(use!.id)!, ['shoot'])) : delta;
      c = applyDelta(c, raw, mod);
    }
  }
  // 체력 보정 (E.11): 70분 이후 성공 확률에서 뺀다 (슛은 E.8 슛 판정 그대로)
  const adj = staminaAdj(s, a);
  if (adj !== 0 && c.type !== 'shoot') {
    c.p = Math.max(0.01, c.p + adj);
    if (c.pFlight !== undefined) c.pFlight = Math.max(0.01, c.pFlight + adj);
  }
  return { cand: c, duel: null, mod, use, action: c.type, down: opt.down };
}

/** 기대 평점 (봇): 바로 오는 평점 + 성공 시 이어질 공격의 평점 몫 */
function optionValue(o: MomentOption, dp = 0): number {
  const R = ENGINE.rating;
  const p = Math.max(0, Math.min(1, (o.p ?? 1) + dp));
  const chain = o.action === 'shoot' ? 0
    : o.action === 'pass' || o.action === 'through' || o.action === 'cutback' || o.action === 'layoff' || o.action === 'cross' ? o.value * R.assist * R.scale
    : o.value * R.goal * R.scale * 0.5;
  return p * (o.up + chain) + (1 - p) * o.down;
}

/**
 * 최적 플레이 봇 (F.7): 기대 평점이 가장 큰 선택지. 바로 오는 평점 변화(성공 up / 실패 down)에 더해, 성공하면 이어질 공격의
 * 평점 몫을 위치 가치로 어림한다: 패스·크로스는 도움(assist) 몫, 몰고 가기·돌파·유지는 내 슛 몫의 절반. 판정 없는 행동은 0
 */
export function bestOption(m: Moment): number {
  let bi = 0;
  let bv = -Infinity;
  m.options.forEach((o, i) => {
    const v = optionValue(o);
    if (v > bv) {
      bv = v;
      bi = i;
    }
  });
  return bi;
}

/**
 * 카드까지 고르는 최적 플레이 봇 (F.7, npm run balance:cards): 선택지 × (카드 없음 / 확률 카드 / 플레이 카드 선택지) 중 기대 평점 최대.
 * 카드는 기대 평점이 minGain 이상 오를 때만 쓴다 (아끼기). 패시브는 처음 쓸 수 있을 때 장착한다 (남은 경기 전체에 붙는다)
 */
export function bestChoice(m: Moment, minGain = 0.02): MomentChoice {
  const i0 = bestOption(m);
  const v0 = m.options.length ? optionValue(m.options[i0]!) : 0;
  let best: { v: number; c: MomentChoice } = { v: v0 + minGain, c: i0 };
  for (const mc of m.cards) {
    if (!mc.usable) continue;
    if (mc.option) {
      const v = optionValue(mc.option);
      if (v > best.v) best = { v, c: { opt: 'card', card: mc.hand } };
    } else if (mc.deltas) {
      mc.deltas.forEach((d, k) => {
        const o = m.options[k];
        if (!o || !d) return;
        const v = optionValue(o, d) + (mc.role === 'passive' ? PASSIVE_FUTURE : 0);
        if (v > best.v) best = { v, c: { opt: k, card: mc.hand } };
      });
    } else if (mc.role === 'combo') {
      // 콤보는 걸어 두면 조건이 맞는 다음 행동에 붙는다 (앞으로의 가치)
      const v = v0 + PASSIVE_FUTURE * 0.6;
      if (v > best.v) best = { v, c: { opt: i0, card: mc.hand } };
    } else if (mc.role === 'soften') {
      const o = m.options[i0];
      if (o) {
        const v = v0 - (1 - (o.p ?? 1)) * o.down * 0.5;
        if (v > best.v) best = { v, c: { opt: i0, card: mc.hand } };
      }
    }
  }
  return best.c;
}

/** 봇이 패시브 장착에 매기는 앞으로의 가치 (평점) */
const PASSIVE_FUTURE = 0.05;
