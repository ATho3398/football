// 내 선수 개입: 결정 순간 (부록 E.11, E4). 직접 모드에서 내 선수의 결정 시점 중 중요도가 임계값 이상인 순간에 시뮬이 멈추고,
// 선택지 3개(안전/균형/도박) + 카드 0~1장 자리 + 맡기기를 보여 준다. 고른 행동은 엔진 후보 그대로 주입하고 결과는 E.8 확률로 판정한다.
// 자동 모드와 "맡기기"는 엔진 판단식(E.7)을 그대로 쓰므로 결과가 자동 경기와 같다 (같은 시드 → 같은 경기).
// 카드 효과는 3단계: 지금은 장면 id 와 카드 자리(cards: [])만 있다 (F.2.1, F.4).

import { posGroup } from '../roster';
import { duelOdds, duelEligible } from './actions';
import { ENGINE } from './config';
import { dribbleProb } from './duel';
import { candidates, shotModel, type ActionType, type Candidate } from './onball';
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
export type OptionKind = 'safe' | 'balanced' | 'gamble';
export type DuelAction = 'tackle' | 'jockey' | 'lane';

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
  /** 코트 화살표 (엔진 좌표, m) */
  to: { x: number; y: number };
  /** 받는 선수 / 상대 id (표시용) */
  target?: string;
  /** 내부: 후보 인덱스 / 1대1 행동 번호 */
  ref: number;
}

export interface Moment {
  id: number;
  type: 'onball' | 'duel';
  scene: SceneId;
  /** 경기 시계 (초) */
  t: number;
  minute: number;
  stake: number;
  score: [number, number];
  /** 내 팀 쪽 */
  side: 0 | 1;
  options: MomentOption[];
  /** 카드 0~1장 자리 (3단계에서 패를 채운다) */
  cards: never[];
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
}

/** 결정 정책: 선택지 인덱스 또는 맡기기. 없으면(직접 모드 화면) 시뮬이 멈춘다 */
export type MomentPolicy = (m: Moment) => number | 'delegate';

export interface MomentControl {
  mode: ControlMode;
  stop: StopLevel;
  policy?: MomentPolicy;
}

export interface MomentState {
  control: MomentControl;
  pending: (Moment & { cands?: Candidate[] }) | null;
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

/** 이번 순간에 멈추는가: 임계값 × 정지 빈도 배수, 최소 턴 따라잡기, 최대 턴, 간격 */
function shouldStop(s: SimState, a: Agent, stake: number): boolean {
  const ms = s.moments;
  const c = ms.control;
  if (c.mode !== 'direct') return false;
  if (s.t - ms.lastStopT < M.gap) return false;
  const mins = s.input.myMinutes ? Math.max(1, s.input.myMinutes.end - s.input.myMinutes.start) : 90;
  const share = Math.min(1.5, mins / 90);
  if (ms.stops >= Math.ceil(M.maxStops * share)) return false;
  const group = posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position);
  let th = (M.threshold[group] ?? 0.45) * M.stopMul[c.stop];
  // 최소 턴 (중요한 순간만·모든 순간): 출전 시간 대비 진행이 기대 턴보다 1 이상 뒤처지면 임계값을 낮춘다
  if (c.stop !== 'critical') {
    const played = Math.max(0, (s.t - a.enteredAt) / 60);
    const expected = M.minStops * share * Math.min(1, played / mins);
    if (ms.stops < expected - 1) th *= M.catchUpMul;
  }
  return stake >= th;
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

/** 내 선수 결정 시점 (소유): 멈출 순간이면 s.moments.pending 을 채우고 true */
export function onballMoment(s: SimState, a: Agent): boolean {
  const ms = s.moments;
  if (!a.spec.isMe || ms.control.mode !== 'direct' || a.line === 0) return false;
  const cands = candidates(s, a);
  const dir = attackDir(a.team, s.half);
  const [ax, ay] = toNorm(a.x, a.y, dir);
  const here = positionValue(ax, ay);
  let gain = 0;
  let xg = 0;
  for (const c of cands) {
    if (c.type === 'shoot') xg = Math.max(xg, c.p);
    else gain = Math.max(gain, c.value - here);
  }
  const stake = M.stakeK * (gain + xg) * stakeMul(s, a.team);
  if (!shouldStop(s, a, stake)) return false;
  const adj = staminaAdj(s, a);
  const kinds: OptionKind[] = ['safe', 'balanced', 'gamble'];
  const picks = pickOptions(cands);
  const options: MomentOption[] = [];
  picks.forEach((c, i) => {
    if (!c) return;
    const [up, down] = ratingEstimate(s, a, c);
    const [succ, fail] = ACTION_TEXT[c.type];
    const p = c.type === 'shoot' ? c.p : Math.max(0.01, Math.min(0.99, c.p + adj));
    const opt: MomentOption = {
      kind: kinds[i]!, action: c.type, label: labelOf(s, a, c), p: round2(p), success: succ, fail, up: round2(up), down: round2(down),
      to: { x: c.x, y: c.y }, ref: cands.indexOf(c), value: Math.round(c.value * 1000) / 1000,
      ...(c.receiver >= 0 ? { target: s.agents[c.receiver]!.id } : c.opponent !== undefined ? { target: s.agents[c.opponent]!.id } : {}),
    };
    if ((c.type === 'through' || c.type === 'pass') && c.receiver >= 0 && (c.x - a.x) * dir > 3) {
      const r = offsideRisk(s, a, s.agents[c.receiver]!);
      opt.offside = r < 0.15 ? 'low' : r < 0.5 ? 'mid' : 'high';
    }
    options.push(opt);
  });
  settleMoment(s, true);
  ms.pending = { ...base(s, a, 'onball', onballScene(s, a, cands), stake), options, cands };
  return true;
}

function base(s: SimState, a: Agent, type: Moment['type'], scene: SceneId, stake: number): Moment {
  const ms = s.moments;
  return {
    id: ms.nextId, type, scene, t: Math.round(s.t * 10) / 10, minute: Math.floor(s.t / 60) + 1, stake: round2(stake),
    score: [s.teams[0].stats.goals, s.teams[1].stats.goals], side: a.team, options: [], cards: [], me: a.spec.id,
  };
}

/** 상대 소유자와 1대1 (내가 가장 가까운 수비수, duelRange 안): 멈출 순간이면 pending 을 채우고 true */
export function duelMoment(s: SimState): boolean {
  const ms = s.moments;
  if (ms.control.mode !== 'direct') return false;
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
  if (!shouldStop(s, a, stake)) return false;
  const R = ENGINE.rating;
  const own = toNorm(o.x, o.y, attackDir(a.team, s.half))[0] < 0.5;
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
  settleMoment(s, true);
  ms.pending = { ...base(s, a, 'duel', own ? 'duel' : 'press', stake), options, opponent: o.spec.id };
  return true;
}

/** 결정 확정: 기록을 남기고 주입할 후보(소유) 또는 1대1 행동을 돌려준다. delegate 면 null (엔진 판단) */
export function takeMoment(s: SimState, choice: number | 'delegate'): { cand: Candidate | null; duel: number | null } {
  const ms = s.moments;
  const m = ms.pending!;
  ms.pending = null;
  settleMoment(s, true);
  ms.stops++;
  ms.nextId++;
  ms.lastStopT = s.t;
  const opt = choice === 'delegate' ? null : m.options[choice] ?? null;
  const a = s.agents.find((x) => x.spec.isMe)!;
  const rec: DecisionRecord = {
    id: m.id, minute: m.minute, scene: m.scene, choice: opt ? opt.kind : 'delegate', label: opt ? opt.label : '맡기기 (엔진 판단)',
    p: opt ? opt.p : null, result: 'neutral', delta: 0, e: Math.round(s.elapsed * 10) / 10, stake: m.stake,
  };
  ms.log.push(rec);
  ms.open = { rec, t: s.t, base: myDelta(s, a), team: a.team, action: opt ? opt.action : 'delegate' };
  if (!opt) return { cand: null, duel: null };
  if (m.type === 'duel') return { cand: null, duel: opt.ref };
  const c = m.cands![opt.ref]!;
  // 체력 보정 (E.11): 70분 이후 성공 확률에서 뺀다 (슛은 E.8 슛 판정 그대로)
  const adj = staminaAdj(s, a);
  if (adj !== 0 && c.type !== 'shoot') {
    c.p = Math.max(0.01, c.p + adj);
    if (c.pFlight !== undefined) c.pFlight = Math.max(0.01, c.pFlight + adj);
  }
  return { cand: c, duel: null };
}

/**
 * 최적 플레이 봇 (F.7): 기대 평점이 가장 큰 선택지. 바로 오는 평점 변화(성공 up / 실패 down)에 더해, 성공하면 이어질 공격의
 * 평점 몫을 위치 가치로 어림한다: 패스·크로스는 도움(assist) 몫, 몰고 가기·돌파·유지는 내 슛 몫의 절반. 판정 없는 행동은 0
 */
export function bestOption(m: Moment): number {
  const R = ENGINE.rating;
  let bi = 0;
  let bv = -Infinity;
  m.options.forEach((o, i) => {
    const p = o.p ?? 1;
    const chain = o.action === 'shoot' ? 0
      : o.action === 'pass' || o.action === 'through' || o.action === 'cutback' || o.action === 'layoff' || o.action === 'cross' ? o.value * R.assist * R.scale
      : o.value * R.goal * R.scale * 0.5;
    const v = p * (o.up + chain) + (1 - p) * o.down;
    if (v > bv) {
      bv = v;
      bi = i;
    }
  });
  return bi;
}
