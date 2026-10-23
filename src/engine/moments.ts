// 내 선수 개입: 결정 순간 (부록 E.11, E4). 직접 모드에서 내 선수의 결정 시점 중 중요도가 임계값 이상인 순간에 시뮬이 멈추고,
// 선택지 3개(안전/균형/도박) + 카드 0~1장 자리 + 맡기기를 보여 준다. 고른 행동은 엔진 후보 그대로 주입하고 결과는 E.8 확률로 판정한다.
// 자동 모드와 "맡기기"는 엔진 판단식(E.7)을 그대로 쓰므로 결과가 자동 경기와 같다 (같은 시드 → 같은 경기).
// 카드 (3단계, C.36): 패의 카드는 Moment.cards 로 보여 주고, 플레이 카드는 4번째 선택지(행동 변형), 확률 카드는 선택지 확률 보정이다.
// 자동 모드는 같은 중요도 기준의 "카드 기회"에서 F.5 규칙(플레이 카드 = 엔진 판단식이 같이 평가, 확률 카드 = 패 앞에서 조건 맞는 첫 장)을 쓴다.
// C.40 (pending 39 5항): 직접 모드 최소 정지 보장을 없앴다. 성공 확률이 maxP(90%)를 넘는 선택지는 목록에서 빼고(그건 맡기기가 할 일),
// 남은 선택지가 2개 이상이거나 패에 지금 쓸 수 있는 장면 카드가 있을 때만 멈춘다. 공중볼·상대 슈팅·코너는 그 장면 반응 카드가 패에 있을 때만
// 멈춰서 고르게 한다(카드 장면 정지, type 'react'). 엔진 판단식·확률과 자동 경로는 그대로다.

import { BALANCE } from '../config/balance';
import { cardById, type OptionTag } from '../config/cards';
import { posGroup } from '../roster';
import { defJudgement, directFkOn, duelOdds, duelEligible, penaltyProb } from './actions';
import {
  airScenes, boostValue, buildVariant, cardRand, emptyMod, handView, inShotCone, judgeShift, masteryBonus, passiveValue, playCard, prepCands, reactiveCards, startWatch, tagsOf,
  type ActionMod, type CardUse, type MomentCard, type OptionCtx, type ReactCard, type Variant,
} from './cards';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as physics_ from './physics';
const { duelEdgeOf } = physics_;
import { directiveVariants } from './directive';
import * as duel_ from './duel';
const { aerialScore, dribbleProb, duelTail } = duel_;
import { candidates, choose, judgementOf, passivePreview, riskyAction, shotModel, visible, type ActionType, type Candidate } from './onball';
import * as pitch_ from './pitch';
const { attackDir, clamp, dist, inOppBox, oppGoal, positionValue, toNorm } = pitch_;
import * as rating_ from './rating';
const { ratingDelta, ratingParts } = rating_;
import * as rng_ from './rng';
const { Purpose, rand } = rng_;
import { offsideRisk } from './referee';
import * as rapport_ from './rapport';
const { chemMul, isExploit } = rapport_;
import type { Agent, SimState } from './state';

const M = ENGINE.moments;

/** 장면 id (F.2.1). 공중볼·코너·상대 코너/프리킥·상대 슈팅은 카드 장면 정지(C.40), lineCall 은 아직 정지 없음 */
export type SceneId =
  | 'shot' | 'dribble' | 'keyPass' | 'aerial' | 'cross' | 'counter' | 'press' | 'duel' | 'freeKick' | 'penalty' | 'corner'
  | 'oppShot' | 'oppFreeKick' | 'oppCorner' | 'lineCall' | 'holdUp' | 'rebound' | 'halftime';

export const SCENE_LABEL: Record<SceneId, string> = {
  shot: '슈팅 찬스', dribble: '1대1 돌파', keyPass: '패스 선택', aerial: '공중볼', cross: '측면 크로스', counter: '역습',
  press: '전방 압박', duel: '수비 1대1', freeKick: '프리킥', penalty: '페널티킥', corner: '코너킥', oppShot: '상대 슈팅',
  oppFreeKick: '상대 프리킥', oppCorner: '상대 코너킥', lineCall: '라인 컨트롤', holdUp: '등지고 받음', rebound: '리바운드', halftime: '하프타임',
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
  /** 상대 분석 리포트의 약점을 노리는 선택지 (C.74c, 표시용 "약점 공략") */
  exploit?: boolean;
  /** 2단 행동 (C.75k 몰고 가다 슛): 이 행동(몰고 가기) 뒤 다음 결정에서 슛. p 는 첫 단(몰고 가기) 성공 확률 */
  chain?: { type: 'shoot'; p: number };
  /** 소극적 백패스 감점 (C.77s A1·A3, 평점 단위 < 0): 이 백패스를 고르면 성공·실패와 무관하게 붙는다. 없으면 감점 없음 */
  passive?: number;
  /** 기대 평점 (C.77s A3, 표시용): 최적 플레이 봇과 같은 optionValue (성공 뒤 이어질 공격 몫·소극적 감점 포함) */
  ev?: number;
  /** 내부: 후보 인덱스 / 1대1 행동 번호 */
  ref: number;
}

export interface Moment {
  id: number;
  /**
   * react = 카드 장면 정지 (공중볼·상대 슈팅, C.40): 선택지 "카드 없이" + 패의 반응 카드.
   * halftime = 하프타임 전술 변경 (C.75k, 직접 모드 화면만): 선택지 없음, 확정은 MyMatchRun.halftime
   */
  type: 'onball' | 'duel' | 'setPiece' | 'react' | 'halftime';
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
  /** 성공 확률 maxP(90%)를 넘어 목록에서 뺀 선택지가 있었다 (C.40, 화면 안내용) */
  sure?: boolean;
  /** 뺀 확실한 선택지 중 기대 평점 최대 (최적 플레이 봇이 맡기기와 견줄 때만 쓴다. 맡기면 엔진이 대개 이것을 고른다) */
  delegateEv?: number;
  /** 확실한 선택지 다시 넣음 (C.75v): 남은 선택지가 모두 sureBackBelow 미만이라 뺀 확실한 선택지 1개를 맨 위 "안전"으로 넣었다 */
  sureBack?: boolean;
  /** 소유 정지: 내 선수가 상대 박스 안 (C.75a, 표시·측정용) */
  box?: boolean;
  /** 슛 선택지가 없거나 밀린 이유 한 줄 (C.75a, 예 "등지고 받음 — 먼저 돌아서야 해요") */
  shotNote?: string;
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
  /** 도박 실패 완화 (C.75a): 직접 모드에서 고른 소유 선택지의 결정 시각과 되돌릴 감점 몫 k (첫 소유 변경에서 지운다) */
  relief?: { t: number; k: number } | null;
  /** 리셋 즉발 (C.75h): 리셋을 쓴 결정 순간 id (장면당 1번) */
  resetUsed?: number;
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

/** 출전 시간 비율 (90분 = 1, 상한 1.5) */
function minuteShare(s: SimState): [number, number] {
  const mins = s.input.myMinutes ? Math.max(1, s.input.myMinutes.end - s.input.myMinutes.start) : 90;
  return [mins, Math.min(1.5, mins / 90)];
}

/** 간격·최대 턴 */
function roomFor(s: SimState, stops: number, lastT: number): boolean {
  if (s.t - lastT < M.gap) return false;
  return stops < Math.ceil(M.maxStops * minuteShare(s)[1]);
}

/**
 * 이번 순간이 중요한가: 간격·최대 턴, 임계값 × 정지 빈도 배수.
 * catchUp: 자동 모드 카드 기회(F.5) — C.34 임계값표(autoThreshold)와 최소 턴 따라잡기 (C.36 그대로, 직접 모드 정지는 C.40부터 쓰지 않는다)
 */
function wouldStop(s: SimState, a: Agent, stake: number, stops: number, lastT: number, stop: StopLevel, mul = 1, catchUp = false): boolean {
  if (!roomFor(s, stops, lastT)) return false;
  const [mins, share] = minuteShare(s);
  const group = posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position);
  let th = ((catchUp ? M.autoThreshold : M.threshold)[group] ?? 0.45) * M.stopMul[stop] * mul;
  if (catchUp && stop !== 'critical') {
    const played = Math.max(0, (s.t - a.enteredAt) / 60);
    const expected = M.autoMinStops * share * Math.min(1, played / mins);
    if (stops < expected - 1) th *= M.autoCatchUpMul;
  }
  return stake >= th;
}

function shouldStop(s: SimState, a: Agent, stake: number): boolean {
  const ms = s.moments;
  if (ms.control.mode !== 'direct') return false;
  return wouldStop(s, a, stake, ms.stops, ms.lastStopT, ms.control.stop);
}

/**
 * 고를 거리가 있는가 (C.75a, pending 128 2항): 선택지 + 쓸 수 있는 카드가 새로 연 선택지가 minOptions 개 이상이고 그중 판정 있는 것이 있을 때.
 * 맡기기는 세지 않는다. 확률 카드·패시브는 선택지를 늘리지 않아 세지 않는다 (C.40 의 "장면 카드만 있어도 멈춤"을 없앴다).
 * 1대1의 따라붙기·패스길 막기는 판정 없는 행동이지만 서로 다른 선택이라 센다. 세트피스의 "엔진 판단대로"(판정 없음)는 맡기기와 같아 뺀다
 */
function enoughChoices(options: MomentOption[], cards: Moment['cards'], countNull = true): boolean {
  const opened = cards.flatMap((mc) => (mc.usable && mc.option ? [mc.option] : []));
  const all = [...options.filter((o) => countNull || o.p !== null), ...opened];
  return all.length >= M.minOptions && all.some((o) => o.p !== null);
}

/** 도박 실패 완화 배수 (C.75a): 성공 확률이 낮을수록 실패 감점을 줄인다 (floor ~ 1) */
export function failFactor(p: number | null): number {
  if (p === null) return 1;
  const F = M.failRelief;
  return clamp(F.floor + ((1 - F.floor) * p) / F.pRef, F.floor, 1);
}

/** 성공 확률 구간 라벨 (C.75v): ≥ labelBands.safe 안전, ≥ labelBands.balanced 균형, 그 밖 도박. 판정 없음(null)은 fallback */
export function bandKind(p: number | null, fallback: OptionKind = 'safe'): OptionKind {
  if (p === null) return fallback;
  const B = M.labelBands;
  return p >= B.safe - 1e-9 ? 'safe' : p >= B.balanced - 1e-9 ? 'balanced' : 'gamble';
}

/**
 * 선택지를 성공 확률 순으로 놓고 확률 구간으로 안전·균형·도박을 붙인다 (C.75v, C.40 의 "순서대로 안전·균형·도박"을 바꿈:
 * 13% 가 "안전"으로 보이던 문제). 판정 없는 선택지는 맨 위·안전 (지금 규칙)
 */
function relabel<T extends { o: MomentOption }>(xs: T[]): T[] {
  const sorted = [...xs].sort((x, y) => (y.o.p ?? 1) - (x.o.p ?? 1));
  for (const x of sorted) x.o.kind = bandKind(x.o.p);
  return sorted;
}

/** 자동 모드 카드 기회 (F.5): 덱이 있고 자동 모드일 때, 직접 모드 "중요한 순간만"과 같은 기준 */
function autoOccasion(s: SimState, a: Agent, stake: number): boolean {
  const cs = s.cards;
  if (!cs || !BALANCE.cards.autoMoments || s.moments.control.mode !== 'auto') return false;
  if (!wouldStop(s, a, stake, cs.occ, cs.lastOccT, 'important', BALANCE.cards.autoStopMul, true)) return false;
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
  // 위험 감수 실패 (C.77s A2): 전진·침투·크로스·돌파는 상대 진영이면 riskLostFactor (core recordLoss 와 같은 규칙)
  const lost = ax < 1 / 3 ? R.dangerLost : ax > 2 / 3 ? R.lost * R.attackLostFactor : ax > 0.5 && riskyAction(s, a, c) ? R.lost * R.riskLostFactor : R.lost;
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
  // 상대 분석·동료 호흡 (C.74c): 실행 배율을 표시 확률에도 (리포트 약점이면 "약점 공략" 표시)
  if (s.rapport) {
    const ex = isExploit(s, a, c.type);
    const k = (ex ? s.rapport.scout!.mul : 1) * (c.type === 'pass' || c.type === 'through' ? chemMul(s, a, s.agents[c.receiver]) : 1);
    if (ex) opt.exploit = true;
    if (k !== 1 && opt.p !== null) opt.p = round2(Math.min(0.99, opt.p * k));
  }
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
  // 지시 카드 (C.75i): 지시 이행 = 엔진 1순위 그대로, 독단 = 개인 가치 최대 (직접 모드만)
  out.push(...directiveVariants(s, cands));
  return out;
}

/** 내 선수 결정 시점 (소유): 멈출 순간이면 s.moments.pending 을 채우고 true */
export function onballMoment(s: SimState, a: Agent): boolean {
  const ms = s.moments;
  if (!a.spec.isMe || ms.control.mode !== 'direct' || a.line === 0) return false;
  const cands = candidates(s, a);
  // 몰고 가다 슛의 둘째 단 (C.75k): 슛 후보가 있으면 멈추지 않고 decide 가 슛한다
  if (intentShot(s, a, cands)) return false;
  prepCands(s, a, cands);
  const stake = onballStake(s, a, cands);
  if (!shouldStop(s, a, stake)) return false;
  const adj = staminaAdj(s, a);
  const kinds: OptionKind[] = ['safe', 'balanced', 'gamble'];
  // 성공 확률이 maxP 를 넘는 후보는 선택지에서 뺀다 (C.40): 보이는 확률(슛은 골 확률, 그 밖은 체력 보정 뒤) 기준
  const shownP = (c: Candidate) => (c.type === 'shoot' ? (s.cards ? shotP(s, a, c.p) : c.p) : clamp(c.p + adj, 0.01, 0.99));
  const pool = cands.filter((c) => shownP(c) <= M.maxP + 1e-9);
  const picks = keepSlots(a, pool, pickOptions(pool));
  const cs = carryShootOption(s, a, cands, adj);
  if (cs) cs.o.kind = bandKind(cs.o.p);
  const mk = (c: Candidate, kind: OptionKind = 'safe') => {
    const o = optionOf(s, a, c, kind, cands.indexOf(c), adj);
    if (c.type === 'shoot' && s.cards) o.p = round2(shotP(s, a, c.p));
    // 소극적 백패스 (C.77s A3): 남은 허용 횟수를 넣은 감점
    const pv = round2(passivePreview(s, a, c, cands));
    if (pv < 0) o.passive = pv;
    return o;
  };
  // 같은 이름 줄(예 같은 수비수 돌파 방향만 다름)은 기대 평점이 큰 하나만 (C.75v)
  const main: { c: Candidate; o: MomentOption }[] = [];
  picks.forEach((c, i) => {
    if (!c) return;
    const o = mk(c, kinds[i]!);
    const j = main.findIndex((x) => x.o.label === o.label);
    if (j < 0) main.push({ c, o });
    else if (optionValue(o) > optionValue(main[j]!.o)) main[j] = { c, o };
  });
  // 확실한 선택지 (C.40 에서 뺀 것): 기대 평점 최대가 맡기기 기준 (최적 플레이 봇), C.75v 다시 넣기 후보
  const sureC = cands.filter((c) => shownP(c) > M.maxP + 1e-9);
  const sure = sureC.length > 0;
  const sureBest = sureC.map((c) => ({ c, o: mk(c) })).reduce<{ c: Candidate; o: MomentOption; v: number } | null>((b, x) => {
    const v = optionValue(x.o);
    return !b || v > b.v ? { ...x, v } : b;
  }, null);
  const delegateEv = sureBest ? sureBest.v : undefined;
  // C.75v 더 고를 거리 (최대 maxOptions, 확실한 선택지 자리는 남은 것이 모두 낮을 때만 비워 둔다)
  const maybeBack = !!sureBest && main.length > 0 && main.every((x) => (x.o.p ?? 1) < M.sureBackBelow);
  const room = M.maxOptions - main.length - (cs ? 1 : 0) - (maybeBack ? 1 : 0);
  const extra = extraOptions(cands, pool, main, room, mk);
  const rest = [...main, ...extra];
  const back = maybeBack && rest.every((x) => (x.o.p ?? 1) < M.sureBackBelow) ? sureBest : null;
  // 몰고 가다 슛은 확률 순 목록 뒤 마지막 줄
  const made = [...relabel([...(back ? [back] : []), ...rest].map((x) => ({ o: x.o, ctx: optionCtx(s, a, x.c) }))), ...(cs ? [cs] : [])];
  const options = made.map((x) => x.o);
  const ctx = made.map((x) => x.ctx);
  const scene = onballScene(s, a, cands);
  const { cards, variants } = onballCards(s, a, scene, cands, ctx, adj);
  if (!enoughChoices(options, cards)) return false;
  // 도박 실패 완화 (C.75a): 보이는 실패 평점도 확률 배수로 (카드 선택지는 onballCards 에서, 몰고 가다 슛은 첫 단 확률로)
  for (const o of options) o.down = round2(o.down * failFactor(o.chain ? o.chain.p : o.p));
  // 기대 평점 (C.77s A3): 카드에 보이는 값 (실패 평점 완화 뒤)
  for (const o of [...options, ...cards.flatMap((mc) => (mc.option ? [mc.option] : []))]) o.ev = round2(optionValue(o));
  settleMoment(s, true);
  const box = inOppBox(a.x, a.y, attackDir(a.team, s.half));
  const shotNote = shotNoteOf(s, a, cands, [...options, ...cards.flatMap((mc) => (mc.usable && mc.option ? [mc.option] : []))], box);
  ms.pending = {
    ...base(s, a, 'onball', scene, stake), options, cards, cands, variants, ...(sure ? { sure, delegateEv } : {}), ...(back ? { sureBack: true } : {}), ...(box ? { box } : {}), ...(shotNote ? { shotNote } : {}),
  };
  return true;
}

/** 소유 결정 순간의 패 (카드 선택지 포함, 실패 평점은 완화 배수 적용). 리셋 즉발 뒤 다시 계산할 때도 쓴다 (C.75h) */
function onballCards(s: SimState, a: Agent, scene: SceneId, cands: Candidate[], ctx: OptionCtx[], adj: number): { cards: Moment['cards']; variants: Variant[] } {
  if (!s.cards) return { cards: [], variants: [] };
  const variants = onballVariants(s, a, scene, cands);
  const cards = handView(s, a, scene, ctx, variants, true).map((mc) => {
    const v = variants.find((x) => x.hand === mc.hand);
    if (!v) return mc;
    const option = optionOf(s, a, v.cand, 'card', -1, adj, labelOf(s, a, v.cand), { rs: v.mod.rs, rf: v.mod.rf });
    const bp = v.baseCand.type === 'shoot' ? shotP(s, a, v.baseCand.p) : Math.max(0.01, Math.min(0.99, v.baseCand.p - (v.baseCand.cardD ?? 0) + adj));
    option.down = round2(option.down * failFactor(option.p));
    return { ...mc, option: { ...option, baseP: round2(bp) } };
  });
  return { cards, variants };
}

/**
 * 더 고를 거리 (C.75v): 안전·균형·도박 3칸 밖의 후보에서 최대 room 개. 같은 후보(sameAs)·같은 이름 줄은 넣지 않고,
 * 행동 종류가 새로운 것 → 받는 사람이 새로운 것 순으로, 같은 순위 안에서는 기대 평점(봇 optionValue) 큰 것부터.
 * 고를 거리 없는 뻔한 것은 넣지 않는다: 기대 평점이 맡기기(엔진 효용 1위 후보)보다 extraEvGap 넘게 낮으면 빼고, 같은 행동 종류는 extraTypeCap 줄까지
 */
function extraOptions(
  cands: Candidate[], pool: Candidate[], main: { c: Candidate; o: MomentOption }[], room: number, mk: (c: Candidate) => MomentOption,
): { c: Candidate; o: MomentOption }[] {
  if (room <= 0 || !cands.length) return [];
  const top = cands.reduce((b, c) => (c.u > b.u ? c : b));
  const floor = optionValue(mk(top)) - M.extraEvGap;
  const have = [...main];
  const out: { c: Candidate; o: MomentOption; v: number; tier: number }[] = [];
  for (const c of pool) {
    if (have.some((x) => sameAs(x.c, c))) continue;
    const o = mk(c);
    const v = optionValue(o);
    if (v < floor) continue;
    out.push({ c, o, v, tier: 0 });
  }
  const picked: { c: Candidate; o: MomentOption }[] = [];
  while (picked.length < room) {
    let best: (typeof out)[number] | null = null;
    for (const x of out) {
      if (have.some((h) => sameAs(h.c, x.c) || h.o.label === x.o.label)) continue;
      // 같은 행동 종류가 이미 extraTypeCap 줄이면 더 넣지 않는다 (백패스만 세 줄 같은 뻔한 목록 방지)
      if (have.filter((h) => h.c.type === x.c.type).length >= M.extraTypeCap) continue;
      // 새 행동 종류 0, 같은 종류지만 새 받는 사람 1, 그 밖 2 (같은 종류·같은 받는 사람·다른 이름 = 다른 방향의 몰고 가기 등)
      x.tier = !have.some((h) => h.c.type === x.c.type) ? 0 : x.c.receiver >= 0 && !have.some((h) => h.c.type === x.c.type && h.c.receiver === x.c.receiver) ? 1 : 2;
      if (!best || x.tier < best.tier || (x.tier === best.tier && x.v > best.v)) best = x;
    }
    if (!best) break;
    picked.push({ c: best.c, o: best.o });
    have.push({ c: best.c, o: best.o });
  }
  return picked;
}

/**
 * 자리 보장 (C.75a, pending 128 3항): pickOptions(안전·균형·도박)가 밀어낸 슛(xG ≥ shotKeepXg)과, 공격수가 앞을 막은 수비수를 제치는 드리블을
 * 선택지 3칸에 넣는다. 빈 칸이 있으면 그 칸, 없으면 엔진 효용이 가장 낮은 칸(보장한 칸 제외)과 바꾼다
 */
export function keepSlots(a: Agent, pool: Candidate[], picks: [Candidate | null, Candidate | null, Candidate | null]): [Candidate | null, Candidate | null, Candidate | null] {
  const out = [...picks] as [Candidate | null, Candidate | null, Candidate | null];
  const kept: Candidate[] = [];
  const put = (c: Candidate | undefined) => {
    if (!c) return;
    // 같은 종류(슛·드리블)가 이미 칸에 있으면 그것을 지킨다 (방향만 다른 같은 수비수 돌파가 두 줄 되지 않게)
    const have = out.find((x) => x && x.type === c.type);
    if (have) {
      kept.push(have);
      return;
    }
    if (out.some((x) => x && sameAs(x, c))) {
      kept.push(c);
      return;
    }
    let at = out.findIndex((x) => x === null);
    if (at < 0) {
      let lo = Infinity;
      out.forEach((x, i) => {
        if (x && !kept.some((k) => sameAs(k, x)) && x.u < lo) {
          lo = x.u;
          at = i;
        }
      });
    }
    if (at < 0) return;
    out[at] = c;
    kept.push(c);
  };
  const top = (type: ActionType, key: (c: Candidate) => number, ok: (c: Candidate) => boolean = () => true) =>
    pool.filter((c) => c.type === type && ok(c)).sort((x, y) => key(y) - key(x))[0];
  put(top('shoot', (c) => c.p, (c) => c.p >= M.shotKeepXg));
  if (M.dribbleKeepGroups.includes(posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position))) put(top('dribble', (c) => c.u));
  return out;
}

/**
 * 몰고 가다 슛 (C.75k, 직접 모드 2단 행동): 앞으로 몰고 가기 후보 중 도착점 xG(지금 수비 위치로 평가) ≥ shotKeepXg 인 것에서
 * 몰고 가기 성공 × 도착점 xG 가 가장 큰 것. 표시 확률 = 그 곱 × carryShootDiscount. 카드 확률 보정은 붙이지 않는다 (태그 없음)
 */
function carryShootOption(s: SimState, a: Agent, cands: Candidate[], adj: number): { o: MomentOption; ctx: OptionCtx } | null {
  const dir = attackDir(a.team, s.half);
  let best: { c: Candidate; pc: number; xg: number } | null = null;
  for (const c of cands) {
    if (c.type !== 'carry' || (c.x - a.x) * dir < 1) continue;
    const xg = shotModel(s, a, false, { x: c.x, y: c.y }).xg;
    if (xg < M.shotKeepXg) continue;
    const pc = clamp(c.p + adj, 0.01, 0.99);
    if (!best || pc * xg > best.pc * best.xg) best = { c, pc, xg };
  }
  if (!best) return null;
  const R = ENGINE.rating;
  const lost = ratingEstimate(s, a, best.c)[1];
  const o: MomentOption = {
    kind: 'gamble', action: 'carry', label: '몰고 가다 슛', p: round2(best.pc * best.xg * M.carryShootDiscount), success: '몰고 가서 골', fail: '막히거나 뺏김',
    up: round2(R.goal * R.scale), down: round2(lost), to: { x: best.c.x, y: best.c.y }, ref: cands.indexOf(best.c), value: Math.round(best.xg * 1000) / 1000,
    chain: { type: 'shoot', p: round2(best.pc) },
  };
  return { o, ctx: { tags: [], box: inOppBox(a.x, a.y, dir) } };
}

/** 몰고 가다 슛 둘째 단 (C.75k): 의도가 살아 있으면(시간 안, 같은 팀 소유) 가장 좋은 슛 후보. 만료면 의도를 지운다 */
export function intentShot(s: SimState, a: Agent, cands: Candidate[]): Candidate | null {
  const it = a.intent;
  if (!it) return null;
  if (s.t > it.until || s.possStartT !== it.poss || s.ball.owner !== a.idx) {
    a.intent = null;
    return null;
  }
  let best: Candidate | null = null;
  for (const c of cands) if (c.type === 'shoot' && (!best || c.p > best.p)) best = c;
  return best;
}

/** 하프타임 전술 변경 순간 (C.75k): 직접 모드 화면(정책 없음)이고 내 선수가 명단에 있으면 pending 을 채우고 true */
export function halftimeMoment(s: SimState): boolean {
  const ms = s.moments;
  if (ms.control.mode !== 'direct' || ms.control.policy) return false;
  const a = s.agents.find((x) => x.spec.isMe) ?? [...s.bench[0], ...s.bench[1]].find((x) => x.spec.isMe);
  if (!a) return false;
  ms.pending = base(s, a, 'halftime', 'halftime', 0);
  return true;
}

/** 슛을 못 고르는 이유 한 줄 (C.75a): 슈팅 거리 근처인데 슛 선택지가 안 보일 때만 */
function shotNoteOf(s: SimState, a: Agent, cands: Candidate[], shown: MomentOption[], box: boolean): string | undefined {
  if (shown.some((o) => o.action === 'shoot')) return undefined;
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const d = dist(a.x, a.y, gx, gy);
  const near = d <= ENGINE.prob.shotMaxDist && toNorm(a.x, a.y, dir)[0] > 0.6;
  if (a.backToGoal && near) return '등지고 받음 — 먼저 돌아서야 슛할 수 있어요';
  const shot = cands.find((c) => c.type === 'shoot');
  if (shot) return box || shot.p >= 0.03 ? `슛 각이 거의 막힘 (골 확률 ${Math.round(shot.p * 100)}%)` : undefined;
  if (!near && d <= ENGINE.prob.shotMaxDist + 8 && toNorm(a.x, a.y, dir)[0] > 0.6) return '슈팅 거리 밖 — 더 다가가야 해요';
  return undefined;
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
  // 자동 경기 결정 순간 카드 금지 (C.75h, autoMoments false): 자동 모드 1대1 카드 기회 없음
  if (ms.control.mode !== 'direct' && (!s.cards || !BALANCE.cards.autoMoments)) return false;
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
      kind: bandKind(round2(odds.pWin)), action: 'tackle', label: '태클', p: round2(odds.pWin), success: '공을 빼앗음', fail: `제쳐짐 · 파울 ${Math.round(odds.pFoul * 100)}%`,
      up: round2(R.tackle * R.scale), down: round2(odds.pFoul * R.foul * R.scale), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 0, value: 0,
    },
  ];
  // 성공 확률 maxP 초과 태클은 뺀다 (C.40). 따라붙기·패스길 막기는 판정이 없어 그대로 둔다
  const sure = odds.pWin > M.maxP;
  if (sure) options.pop();
  const { cards, dv } = duelCards(s, a, o, scene, options, odds);
  if (!enoughChoices(options, cards)) return false;
  settleMoment(s, true);
  ms.pending = { ...base(s, a, 'duel', scene, stake), options, opponent: o.spec.id, cards, ...(sure ? { sure } : {}), ...(dv.length ? { duelVariants: dv } : {}) } as Moment & { duelVariants?: DuelVariant[] };
  return true;
}

/** 수비 1대1 결정 순간의 패 (태클 변형·전술적 파울 선택지). 리셋 즉발 뒤 다시 계산할 때도 쓴다 (C.75h) */
function duelCards(s: SimState, a: Agent, o: Agent, scene: SceneId, options: MomentOption[], odds: ReturnType<typeof duelOdds>): { cards: Moment['cards']; dv: DuelVariant[] } {
  if (!s.cards) return { cards: [], dv: [] };
  const R = ENGINE.rating;
  const dv = duelVariants(s, a, scene, odds.pWin);
  const ctx: OptionCtx[] = [{ tags: ['safe'], box: false }, { tags: ['press'], box: false }, { tags: ['tackle', 'risky'], box: false }];
  const fake: Variant[] = dv.map((v) => ({ hand: v.hand }) as Variant);
  const cards = handView(s, a, scene, ctx, fake, true).map((mc) => {
    if (mc.deltas) mc.deltas = options.map((x, k) => (x.p === null ? 0 : mc.deltas![k] ?? 0));
    if (mc.deltas && mc.role === 'boost' && !mc.deltas.some((d) => d !== 0)) return { ...mc, usable: false, reason: '맞는 선택지가 없어요', deltas: undefined };
    const v = dv.find((x) => x.hand === mc.hand);
    if (!v) return mc;
    const opt: MomentOption = v.pick === 3
      ? { kind: 'card', action: 'foul', label: v.label, p: TACTICAL_FOUL, success: '역습을 끊음', fail: '놓침 · 경고 위험 70%', up: round2(v.mod.rs), down: round2(R.foul * R.scale + v.mod.rf), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 3, value: 0 }
      : { kind: 'card', action: 'tackle', label: v.label, p: round2(v.p), baseP: round2(odds.pWin - (a.cardBoost?.tackle ?? 0)), success: '공을 빼앗음', fail: `제쳐짐 · 파울 ${Math.round(Math.min(1, odds.pFoul * v.foulMul) * 100)}%`, up: round2(R.tackle * R.scale + v.mod.rs), down: round2(odds.pFoul * v.foulMul * R.foul * R.scale + v.mod.rf), to: { x: o.x, y: o.y }, target: o.spec.id, ref: 0, value: 0 };
    return { ...mc, option: opt };
  });
  return { cards, dv };
}

// ── 카드 장면 정지 (C.40): 공중볼·코너·상대 코너/프리킥·상대 슈팅. 직접 모드에서 그 장면 반응 카드가 패에 있을 때만 멈춘다 ──

/** 카드 장면에서 멈출 수 있는가: 직접 모드, 간격·최대 턴 (중요도 임계값은 보지 않는다: 카드가 있으면 그 장면 자체가 쓸 자리) */
function reactRoom(s: SimState): Agent | null {
  const ms = s.moments;
  if (!s.cards || ms.control.mode !== 'direct' || ms.pending || !s.cards.hand.length) return null;
  const a = s.agents.find((x) => x.spec.isMe && x.onPitch);
  if (!a || a.line === 0 || !roomFor(s, ms.stops, ms.lastStopT)) return null;
  return a;
}

type ReactPending = Moment & { react: { kind: 'air' | 'block'; until: number; shooter?: number } };

/** 반응 카드 선택지: 바탕 확률 + 카드 보정 (상한 bonusCap) */
function reactMoment(
  s: SimState, a: Agent, kind: 'air' | 'block', scene: SceneId, list: ReactCard[], baseOpt: MomentOption, stake: number, extra: ReactPending['react'],
): void {
  const cs = s.cards!;
  const view = handView(s, a, scene, [], [], false);
  const cards: Moment['cards'] = view.map((mc) => {
    const r = list.find((x) => x.hand === mc.hand);
    if (!r) return { ...mc, usable: false, reason: mc.reason && mc.reason !== '이 장면에서는 못 써요' ? mc.reason : '이 장면에서는 반응 카드만 써요' };
    const p = clamp((baseOpt.p ?? 0) + Math.min(BALANCE.cards.bonusCap, r.value), 0.02, 0.98);
    const option: MomentOption = {
      ...baseOpt, kind: 'card', label: r.eff?.label ?? r.def.name, p: round2(p), baseP: baseOpt.p ?? undefined,
      up: round2(baseOpt.up + (r.eff?.ratingSuccess ?? 0)), down: round2(baseOpt.down + (r.eff?.ratingFail ?? 0)), ref: -1,
    };
    return { ...mc, usable: true, reason: undefined, deltas: undefined, option };
  });
  void cs;
  settleMoment(s, true);
  s.moments.pending = { ...base(s, a, 'react', scene, stake), options: [baseOpt], cards, react: extra } as ReactPending;
}

/**
 * 공중볼 (크로스·코너·상대 코너/프리킥): 이번 틱에 뜬 공중볼이 박스 안에 떨어지고 내 선수가 착지점 reactAerialRange m 안이며
 * 그 장면 반응 카드(헤더·세트피스 수비)가 패에 있으면 멈춘다. 공이 뜬 뒤라 엔진 흐름은 그대로이고, 고른 카드는 경합 때 붙는다 (airCardEdge)
 */
export function aerialMoment(s: SimState): boolean {
  const fl = s.ball.flight;
  if (!fl || fl.outcome !== 'aerial' || fl.t0 !== s.t || fl.passer < 0) return false;
  const a = reactRoom(s);
  if (!a) return false;
  const passer = s.agents[fl.passer]!;
  const attacking = passer.team === a.team;
  if (attacking && passer === a) return false;
  const scenes = airScenes(s, attacking, !!fl.fromCross);
  if (!scenes.length || !inOppBox(fl.toX, fl.toY, attackDir(passer.team, s.half))) return false;
  if (dist(a.x, a.y, fl.toX, fl.toY) > M.reactAerialRange) return false;
  const list = reactiveCards(s, a, scenes, 'header');
  if (!list.length) return false;
  // 예상 경합 상대: 착지점에 가장 가까운 상대 필드 선수
  let opp: Agent | null = null;
  for (const o of s.agents) {
    if (!o.onPitch || o.team === a.team || o.line === 0) continue;
    if (!opp || dist(o.x, o.y, fl.toX, fl.toY) < dist(opp.x, opp.y, fl.toX, fl.toY)) opp = o;
  }
  const PR = ENGINE.prob;
  const [att, def] = attacking ? [a, opp] : [opp, a];
  const pA = att && def ? duelTail(1 / (1 + Math.exp(-((aerialScore(att) - aerialScore(def)) / PR.aerialScale + (fl.fromCross ? PR.aerialAttackBonus : 0) + duelEdgeOf(att) - duelEdgeOf(def))))) : 0.5;
  const p = clamp(attacking ? pA + (a.cardBoost?.air ?? 0) : 1 - pA + (a.cardBoost?.air ?? 0), 0.02, 0.98);
  const R = ENGINE.rating;
  const scene = scenes[0] as SceneId;
  const baseOpt: MomentOption = {
    kind: 'balanced', action: 'hold', label: attacking ? '카드 없이 헤더 경합' : '카드 없이 걷어내기 경합', p: round2(p),
    success: attacking ? '공중볼 따냄 (헤더·연결)' : '공중볼 따냄 (걷어냄)', fail: '상대가 따냄', up: round2(R.aerial * R.scale), down: 0,
    to: { x: fl.toX, y: fl.toY }, ref: 0, value: 0,
  };
  const stake = M.stakeK * 0.15 * stakeMul(s, a.team);
  reactMoment(s, a, 'air', scene, list, baseOpt, stake, { kind: 'air', until: fl.t0 + fl.dur + 1 });
  return true;
}

/**
 * 상대 슈팅 (오픈 플레이): 내가 슈팅 길(콘) 안이고 몸으로 막기 카드가 패에 있으면 슛 직전에 멈춘다.
 * actions.shoot 가 맨 앞에서 부르고 true 면 슛을 미룬다 → 결정 뒤 같은 틱에 shoot 를 다시 부른다 (난수는 틱 기준이라 결과가 같다)
 */
export function oppShotMoment(s: SimState, shooter: Agent): boolean {
  const a = reactRoom(s);
  if (!a || a.team === shooter.team || s.cards!.react?.shooter === shooter.idx) return false;
  if (!inShotCone(s, shooter, a)) return false;
  const list = reactiveCards(s, a, ['oppShot'], 'block');
  if (!list.length) return false;
  const m = shotModel(s, shooter);
  const R = ENGINE.rating;
  const baseOpt: MomentOption = {
    kind: 'balanced', action: 'hold', label: '카드 없이 막기', p: round2(m.pBlock), success: '슛을 몸으로 막음', fail: `슛이 지나감 (상대 골 확률 ${Math.round(m.xg * 100)}%)`,
    up: round2(R.interception * R.scale), down: 0, to: { x: shooter.x, y: shooter.y }, target: shooter.spec.id, ref: 0, value: 0,
  };
  reactMoment(s, a, 'block', 'oppShot', list, baseOpt, M.stakeK * m.xg * stakeMul(s, a.team), { kind: 'block', until: s.t + 0.5, shooter: shooter.idx });
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
  if (!s.cards || !BALANCE.cards.autoMoments || a.line === 0 || s.moments.control.mode !== 'auto') return null;
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
  if (s.moments.control.mode !== 'direct' && !BALANCE.cards.autoMoments) return false;
  const scene: SceneId | null = r.type === 'penalty' ? 'penalty' : r.type === 'freeKick' && !r.indirect ? 'freeKick' : null;
  if (!scene) return false;
  const R = ENGINE.rating;
  const dir = attackDir(a.team, s.half);
  const [gx, gy] = oppGoal(dir);
  const pPen = scene === 'penalty' ? penaltyProb(s, a, 0) : 0;
  const options: MomentOption[] = scene === 'penalty'
    ? [{ kind: bandKind(round2(pPen)), action: 'shoot', label: 'PK 슈팅', p: round2(pPen), success: '골', fail: '선방·실축', up: round2(R.goal * R.scale), down: 0, to: { x: gx, y: gy }, ref: 0, value: pPen }]
    : [{ kind: 'balanced', action: 'hold', label: '엔진 판단대로 (슈팅·크로스·패스)', p: null, success: '세트피스 진행', fail: '-', up: 0, down: 0, to: { x: gx, y: gy }, ref: 0, value: 0 }];
  const ctx: OptionCtx[] = [{ tags: scene === 'penalty' ? ['shoot'] : ['cross', 'pass'], box: scene === 'penalty' }];
  const { view, vars } = setPieceCards(s, a, scene, pPen, ctx);
  if (!view.some((c) => c.usable)) return false;
  if (s.moments.control.mode === 'direct') {
    // 고를 거리 2개 미만(카드가 선택지를 새로 열지 않음)이면 멈추지 않는다 (C.75a)
    if (!enoughChoices(options, view, false)) return false;
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

/** 세트피스 결정 순간의 패 (슛 변형 선택지). 리셋 즉발 뒤 다시 계산할 때도 쓴다 (C.75h) */
function setPieceCards(s: SimState, a: Agent, scene: SceneId, pPen: number, ctx: OptionCtx[]): { view: Moment['cards']; vars: SpVariant[] } {
  const R = ENGINE.rating;
  const [gx, gy] = oppGoal(attackDir(a.team, s.half));
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
  return { view, vars };
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
  // 하프타임 (C.75k): 정지 수·결정 기록·결과 판정에 넣지 않는다 (전술 변경 기록은 applyHalftimeTactics)
  if (m.type === 'halftime') return { cand: null, duel: null, mod: null, use: null, action: null, down: 0 };
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
  if (m.type === 'react') {
    // 카드 장면 (C.40): 맡기기 = 지금 규칙(조건 맞는 첫 장 자동), 카드 없이 = 쓰지 않기, 카드 = 그 카드. 카드는 장면이 오면 엔진 훅이 쓴다
    const rp = (m as ReactPending).react;
    if (opt) {
      const id = useCardOpt || (mc && mc.role !== 'play') ? mc!.id : null;
      if (id) rec.card = mc!.name;
      s.cards!.react = { kind: rp.kind, id, until: rp.until, ...(rp.shooter !== undefined ? { shooter: rp.shooter } : {}) };
    } else s.cards!.react = null;
    rec.result = 'neutral';
    return { cand: null, duel: null, mod: null, use: null, action: 'react', down: 0 };
  }
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
  // 도박 실패 완화 (C.75a): 첫 소유 변경까지 내 공 상실 감점의 (1 − 배수) 몫을 되돌린다
  const k = 1 - failFactor(opt.chain ? opt.chain.p : opt.p);
  ms.relief = k > 0 ? { t: s.t, k } : null;
  // 몰고 가다 슛 (C.75k): 몰고 가기를 실행하고, 다음 결정에서 슛 (intentShot)
  if (opt.chain) a.intent = { type: 'shoot', until: s.t + M.carryShootWindow, poss: s.possStartT };
  return { cand: c, duel: null, mod, use, action: c.type, down: opt.down };
}

/**
 * 리셋 즉발 (C.75h, pending 133 03:57): 결정 순간에서 리셋 카드를 바로 쓴다. 장면은 진행하지 않고 못 쓰는 카드부터 1장 버리고 1장 뽑은 뒤
 * 패·카드 선택지를 지금 상태로 다시 계산한다(refreshPending). 장면당 1번, 카드 1장 제한(확정 때 쓰는 카드)에는 세지 않는다. 결정적 (덱 순서 그대로)
 */
export function redrawNow(s: SimState, hand: number): boolean {
  const ms = s.moments;
  const m = ms.pending;
  if (!m || !s.cards || m.type === 'react' || ms.resetUsed === m.id) return false;
  const mc = m.cards.find((c) => c.hand === hand);
  const a = s.agents.find((x) => x.spec.isMe && x.onPitch);
  if (!a || !mc || !mc.usable || mc.role !== 'redraw') return false;
  playCard(s, a, hand, m.scene, false, m.cards.filter((c) => !c.usable).map((c) => c.hand));
  ms.resetUsed = m.id;
  refreshPending(s);
  return true;
}

/** 멈춘 결정 순간의 패·카드 선택지를 지금 패로 다시 계산한다 (엔진 후보·기본 선택지는 그대로). 리셋을 쓴 장면이면 남은 리셋은 못 씀 */
export function refreshPending(s: SimState): void {
  const ms = s.moments;
  const m = ms.pending as (Moment & { cands?: Candidate[]; variants?: Variant[]; duelVariants?: DuelVariant[]; spVariants?: SpVariant[] }) | null;
  const a = s.agents.find((x) => x.spec.isMe && x.onPitch);
  if (!m || !s.cards || !a) return;
  if (m.type === 'onball' && m.cands) {
    const ctx = m.options.map((o) => optionCtx(s, a, m.cands![o.ref]!));
    const r = onballCards(s, a, m.scene, m.cands, ctx, staminaAdj(s, a));
    m.cards = r.cards;
    m.variants = r.variants;
  } else if (m.type === 'duel') {
    const o = s.agents[s.ball.owner];
    if (!o) return;
    const r = duelCards(s, a, o, m.scene, m.options, duelOdds(s, o, a));
    m.cards = r.cards;
    m.duelVariants = r.dv;
  } else if (m.type === 'setPiece') {
    const pPen = m.scene === 'penalty' ? penaltyProb(s, a, 0) : 0;
    const r = setPieceCards(s, a, m.scene, pPen, [{ tags: m.scene === 'penalty' ? ['shoot'] : ['cross', 'pass'], box: m.scene === 'penalty' }]);
    m.cards = r.view;
    m.spVariants = r.vars;
  } else return;
  if (ms.resetUsed === m.id) m.cards = m.cards.map((c) => (c.role === 'redraw' ? { ...c, usable: false, reason: '리셋은 장면당 1번', deltas: undefined } : c));
}

/**
 * 판단 미끄러짐 (C.75h, B안): 내 선수의 엔진 결정(자동·맡기기·정지 안 한 순간)에서 판단(judgementOf)이 ref 보다 낮으면
 * p = max × (ref − 판단)/ref 확률로 고른 후보보다 효용이 한 단계 낮은 (보이는) 후보를 고른다. 결정적 난수, NPC 는 부르지 않는다
 */
export function slipPick(s: SimState, a: Agent, cands: Candidate[], c: Candidate): Candidate {
  const S = M.delegateSlip;
  const p = clamp((S.max * (S.ref - judgementOf(a))) / S.ref, 0, S.max);
  if (p <= 0 || rand(s.seed, s.tick, a.idx, Purpose.Decide, 9) >= p) return c;
  let next: Candidate | null = null;
  cands.forEach((x, k) => {
    if (x !== c && x.u < c.u && (!next || x.u > next.u) && visible(s, a, x, k)) next = x;
  });
  return next ?? c;
}

/** 기대 평점 (봇): 바로 오는 평점 + 성공 시 이어질 공격의 평점 몫 */
export function optionValue(o: MomentOption, dp = 0): number {
  const R = ENGINE.rating;
  // 몰고 가다 슛 (C.75k): p = 몰고 가기 성공 × 골 확률(할인), 실패 감점은 몰고 가기에서 뺏길 때만
  if (o.chain) return Math.min(1, (o.p ?? 0) + dp) * o.up + (1 - o.chain.p) * o.down;
  const p = Math.max(0, Math.min(1, (o.p ?? 1) + dp));
  const chain = o.action === 'shoot' ? 0
    : o.action === 'pass' || o.action === 'through' || o.action === 'cutback' || o.action === 'layoff' || o.action === 'cross' ? o.value * R.assist * R.scale
    : o.value * R.goal * R.scale * 0.5;
  // 소극적 백패스 감점 (C.77s A1)은 성공·실패와 무관하게 붙는다
  return p * (o.up + chain) + (1 - p) * o.down + (o.passive ?? 0);
}

/**
 * 최적 플레이 봇 (F.7): 기대 평점이 가장 큰 선택지. 바로 오는 평점 변화(성공 up / 실패 down)에 더해, 성공하면 이어질 공격의
 * 평점 몫을 위치 가치로 어림한다: 패스·크로스는 도움(assist) 몫, 몰고 가기·돌파·유지는 내 슛 몫의 절반. 판정 없는 행동은 0
 */
export function bestOption(m: Moment): number {
  // 선택지 인덱스만 (맡기기와 견주는 것은 bestChoice)
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
  const v0 = m.options.length ? optionValue(m.options[i0]!) : -Infinity;
  let best: { v: number; c: MomentChoice } = { v: v0 + minGain, c: i0 };
  // 확실한 선택지를 뺀 순간 (C.40): 남은 선택지가 그보다 못하면 맡긴다 (카드를 쓰는 편이 나으면 아래에서 바뀐다)
  if (m.delegateEv !== undefined && m.delegateEv > v0) best = { v: m.delegateEv + minGain, c: 'delegate' };
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
