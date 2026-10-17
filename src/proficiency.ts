// 포지션 전환 (4.3, 부록 D.3, C.39 개정): 포지션별 숙련도(0~100), 0 시작·적응기·미출전 감소, 거리별 OVR 페널티, 주 포지션 변경 요청

import { consumeGainMult, trainingAptMult } from './aptitude';
import { BALANCE } from './config/balance';
import { PLAYABLE_POSITIONS, positionOvr, type FieldPosition, type PlayablePosition } from './positions';
import type { PlayerState, Position } from './types';
import { noAdaptation, storyProfMul, tagHas } from './tags';

/** 이번 시즌 = 마지막 기록 시즌 + 1 (기록이 없으면 시작 시즌). 무한한 충성심 돌아온 첫 시즌 판정용 */
const storySeason = (p: PlayerState): number => (p.history?.at(-1)?.season ?? BALANCE.newGame.startYear - 1) + 1;

const P = BALANCE.proficiency;

/** 적응기 경기 수: 저니맨 ×0.7 (C.47) */
const adaptGames = (p: PlayerState): number => (tagHas(p, 'journeyman') ? Math.round(P.adaptGames * BALANCE.tags.natural.journeyAdapt) : P.adaptGames);

/** 숙련도를 따지는 포지션 (LWB/RWB 는 LB/RB 로 본다) */
export function profKey(pos: Position): PlayablePosition | null {
  if (pos === 'GK') return null;
  if (pos === 'LWB') return 'LB';
  if (pos === 'RWB') return 'RB';
  return pos as PlayablePosition;
}

/** 두 포지션 사이 거리 (인접 관계 그래프의 최단 걸음 수) */
export function positionDistance(a: Position, b: Position): number {
  const from = profKey(a);
  const to = profKey(b);
  if (!from || !to) return Infinity;
  if (from === to) return 0;
  const adj = new Map<string, string[]>();
  for (const [x, y] of P.edges) {
    adj.set(x, [...(adj.get(x) ?? []), y]);
    adj.set(y, [...(adj.get(y) ?? []), x]);
  }
  const dist = new Map<string, number>([[from, 0]]);
  const queue = [from as string];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of adj.get(cur) ?? []) {
      if (dist.has(n)) continue;
      dist.set(n, dist.get(cur)! + 1);
      if (n === to) return dist.get(n)!;
      queue.push(n);
    }
  }
  return Infinity;
}

export type Proficiency = Record<PlayablePosition, number>;

/** 초기 숙련도: 주 포지션 100, 서브 포지션 70, 그 외는 0 (C.39, 거리 무관) */
export function initialProficiency(main: FieldPosition, subs: readonly Position[] = []): Proficiency {
  const out = {} as Proficiency;
  const subKeys = subs.map(profKey).filter((x): x is PlayablePosition => x !== null);
  for (const pos of PLAYABLE_POSITIONS) {
    out[pos] = pos === profKey(main) ? 100 : subKeys.includes(pos) ? P.subPosition : P.initial;
  }
  return out;
}

/** 포지션별 숙련도 진행 (C.39): 그 포지션 출전 수(적응기), 연속 미출전 수(감소), 100을 찍은 적 있는지 */
export interface ProfTrack { apps: number; idle: number; peak: boolean }
export type ProfLog = Partial<Record<PlayablePosition, ProfTrack>>;

/** 진행 기록 초기값: 100인 포지션(주 포지션 등)은 100 달성으로 본다 */
export function initialProfLog(prof: Proficiency): ProfLog {
  const out: ProfLog = {};
  for (const pos of PLAYABLE_POSITIONS) out[pos] = { apps: 0, idle: 0, peak: prof[pos] >= 100 };
  return out;
}

function track(p: PlayerState, k: PlayablePosition): ProfTrack {
  p.profLog ??= initialProfLog(p.proficiency);
  return (p.profLog[k] ??= { apps: 0, idle: 0, peak: p.proficiency[k] >= 100 });
}

/** 숙련도 (기록이 없으면 100: NPC, 이전 세이브 변환 전) */
export function proficiencyOf(p: { proficiency?: Proficiency }, pos: Position): number {
  const k = profKey(pos);
  if (!k || !p.proficiency) return 100;
  return p.proficiency[k] ?? 100;
}

type ProfHolder = { proficiency?: Proficiency; position?: Position; formerPosition?: FieldPosition };

/** 페널티 거리: 주 포지션에서의 거리 (주 포지션 자체는 이전 주 포지션에서의 거리), 최소 1. 주 포지션을 모르면 3 이상 */
export function penaltyDistance(p: ProfHolder, pos: Position): number {
  if (!p.position) return P.maxPenaltyByDistance.length;
  const origin = profKey(pos) === profKey(p.position) ? p.formerPosition ?? p.position : p.position;
  const d = positionDistance(origin, pos);
  return Number.isFinite(d) ? Math.max(1, d) : P.maxPenaltyByDistance.length;
}

/** 포지션 OVR 페널티 = 거리별 최대 페널티(1: 6, 2: 10, 3 이상: 14) × (1 − 숙련도/100) (C.39 ③) */
export function distancePenalty(prof: number, dist: number): number {
  const max = P.maxPenaltyByDistance[Math.min(Math.max(dist, 1), P.maxPenaltyByDistance.length) - 1]!;
  return max * (1 - Math.min(100, Math.max(0, prof)) / 100);
}

/** 그 포지션에서의 페널티 */
export function positionPenalty(p: ProfHolder, pos: Position): number {
  return distancePenalty(proficiencyOf(p, pos), penaltyDistance(p, pos));
}

/** 엔진 어댑터(proficientAttrs)가 쓰는 환산: (100 − x) × 0.25. x 는 engineProficiency 로 만든다 */
export function proficiencyPenalty(x: number): number {
  return (100 - Math.min(100, Math.max(0, x))) * P.enginePerPoint;
}

/**
 * 엔진 입력용 숙련도: 엔진 어댑터(proficientAttrs)는 (100 − x) × 0.25 를 능력치에서 빼므로,
 * 그 값이 거리별 페널티와 같아지는 x 를 넘긴다 (엔진 코드는 그대로, C.39)
 */
export function engineProficiency(p: ProfHolder, pos: Position): number {
  return 100 - positionPenalty(p, pos) / P.enginePerPoint;
}

/** 숙련도를 반영한 포지션 OVR (D.3: 변경 후에는 새 포지션의 OVR 로 선발 판정과 평점을 계산) */
export function proficientOvr(p: Pick<PlayerState, 'attributes'> & ProfHolder, pos: FieldPosition): number {
  return Math.round(positionOvr(p.attributes, pos) - positionPenalty(p, pos));
}

/**
 * 출전 후 숙련도 상승 (C.39 ②): 경기당 2.25 × 출전 비율 × 숨은 적성 배수(0.7~1.6) × 조언 뒤 포변 보너스(×2, 부록 C.37).
 * 그 포지션 출전 20경기까지는 적응기 ×0.3. 최대 100. 전술에서 주 포지션 밖 슬롯(played)으로 뛰면 그 포지션이 오른다 (E.19 ②)
 */
export function gainProficiency(p: PlayerState, minutes: number, played: Position = p.position): void {
  const k = profKey(played);
  if (!k || !p.proficiency || minutes <= 0) return;
  // 숨은 적성 배수와 조언 뒤 포변 보너스 (부록 C.37). 보너스 경기 수는 숙련도가 100이어도 줄어든다
  const mult = consumeGainMult(p, played) * (played !== p.position ? storyProfMul(p, p.teamId) : 1);
  const t = track(p, k);
  // 아카데미 출신·무한한 충성심 (C.47): 그 구단에서 적응기 없음
  const adapt = t.apps < adaptGames(p) && !noAdaptation(p, p.teamId, storySeason(p)) ? P.adaptMult : 1;
  t.apps++;
  t.idle = 0;
  const cur = p.proficiency[k];
  if (cur >= 100) {
    t.peak = true;
    return;
  }
  const next = Math.min(100, Math.round((cur + P.gain * adapt * mult * Math.min(1, minutes / 90)) * 100) / 100);
  p.proficiency[k] = next;
  if (next >= 100) t.peak = true;
}

/**
 * 내 팀 경기 한 번이 끝날 때 (C.39 ④): 뛴 포지션은 오르고(gainProficiency), 나머지 포지션은 연속 미출전이 1 늘어
 * 5경기(100을 찍은 포지션은 10경기)부터 경기마다 −1. 주 포지션은 줄지 않는다. 하한 0
 */
export function afterTeamMatch(p: PlayerState, minutes: number, played: Position = p.position): void {
  if (!p.proficiency) return;
  const playedKey = minutes > 0 ? profKey(played) : null;
  if (playedKey) gainProficiency(p, minutes, played);
  const main = profKey(p.position);
  for (const pos of PLAYABLE_POSITIONS) {
    if (pos === playedKey || pos === main) continue;
    const t = track(p, pos);
    t.idle++;
    const cur = p.proficiency[pos];
    if (cur > 0 && t.idle >= (t.peak ? P.idleGamesPeak : P.idleGames)) p.proficiency[pos] = Math.max(0, Math.round((cur - P.decay) * 100) / 100);
  }
}

/**
 * "주 포지션 변경 요청" (D.3): 항상 허용, 비용은 숙련도 페널티뿐. 비시즌에만 되고,
 * 포변 조언이 살아 있는 동안은 시즌 중에도 된다 (allowed = 비시즌 또는 조언 기간, 부록 C.37)
 */
export function requestPositionChange(p: PlayerState, to: PlayablePosition, allowed: boolean): boolean {
  if (!allowed || to === p.position) return false;
  p.formerPosition = p.position;
  p.formerPositions = [...(p.formerPositions ?? []).filter((f) => f !== p.position && f !== to), p.position];
  p.position = to;
  return true;
}

/**
 * 포지션·역할 훈련 (25.3, 부록 C.41): 숙련도 + amount × 적응기 배수 × 숨은 적성 배수 (조언 뒤 포변 보너스면 ×2, 보너스 경기 수는 줄이지 않는다).
 * 출전 수·연속 미출전(감소 카운트)은 경기 기준 그대로라 건드리지 않는다. 오른 양을 돌려준다
 */
export function trainProficiency(p: PlayerState, pos: Position, amount: number): number {
  const k = profKey(pos);
  if (!k || !p.proficiency) return 0;
  const cur = p.proficiency[k];
  if (cur >= 100) return 0;
  const t = track(p, k);
  const adapt = t.apps < adaptGames(p) && !noAdaptation(p, p.teamId, storySeason(p)) ? P.adaptMult : 1;
  const prof = pos !== p.position ? storyProfMul(p, p.teamId) : 1;
  const next = Math.min(100, Math.round((cur + amount * adapt * prof * trainingAptMult(p, pos)) * 100) / 100);
  p.proficiency[k] = next;
  if (next >= 100) t.peak = true;
  return next - cur;
}
