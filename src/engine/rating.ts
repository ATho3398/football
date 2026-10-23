// 평점 (E.12, C.26): 6.5 + scale × (행동 델타 합 + 팀 결과 − 포지션 center), 3.0~10.0

import { posGroup } from '../roster';
// 가져온 값은 지역 상수로 (C.78f: vitest 는 가져온 이름을 쓸 때마다 모듈 객체 접근자를 거쳐 경기 계산이 약 25% 느려진다)
import * as config_ from './config';
const { ENGINE } = config_;
import * as pitch_ from './pitch';
const { clamp } = pitch_;
import type { Agent, SimState } from './state';

type RatingConfig = typeof ENGINE.rating;

/** 평점 계산에 들어가는 한 선수의 경기 기록 (측정 스크립트가 계수를 바꿔 다시 계산할 때도 쓴다) */
export interface RatingParts {
  group: string;
  passes: number;
  forward: number;
  keyPasses: number;
  onTarget: number;
  goals: number;
  assists: number;
  dribbles: number;
  tackles: number;
  interceptions: number;
  aerials: number;
  lost: number;
  dangerLost: number;
  attackLost: number;
  /** 위험 감수 실패 (C.77s A2): 전진·침투·크로스·돌파 뒤 상대 진영(마지막 1/3 앞)에서 잃은 횟수. 없으면 0 */
  riskLost?: number;
  /** 소극적 백패스 (C.77s A1): 허용 횟수를 넘긴 가중 합 (× passive, 경기 최대 passiveMax). 없으면 0 */
  passive?: number;
  /** 소극적 백패스 횟수 (허용 안 포함, 측정용 — 평점 식에는 passive 만 쓴다) */
  passiveN?: number;
  fouls: number;
  offsides: number;
  yellows: number;
  red: number;
  /** 수비/중원/GK 만 센 실점 */
  conceded: number;
  /** GK 만 (교체로 나갔으면 절반) */
  saves: number;
  cleanSheet: number;
  /** 1 승 / 0 무 / −1 패 */
  result: number;
  /** 카드 성공/실패 평점 (C.36, 행동 델타 단위). 카드가 없으면 0 */
  card?: number;
  /** 직접 모드 도박 실패 완화로 되돌린 공 상실 감점 (C.75a, 행동 델타 단위). 자동 경기는 0 */
  relief?: number;
  /** 공격 포지션(ST·WING·CAM) 무기여 경기 (C.75f, E-3): 45분 이상 뛰고 골·도움·키패스·유효슈팅·드리블 성공이 모두 0 이면 1. 경기 종료 평점에만 붙는다 */
  noContrib?: number;
}

const ATTACK_GROUPS = new Set(['ST', 'WING', 'CAM']);

/** 무기여 판정 (크로스 성공·박스 터치는 기여로 치지 않는다) */
export function isNoContrib(p: Pick<RatingParts, 'group' | 'goals' | 'assists' | 'keyPasses' | 'onTarget' | 'dribbles'>): boolean {
  return ATTACK_GROUPS.has(p.group) && p.goals + p.assists + p.keyPasses + p.onTarget + p.dribbles === 0;
}

/** final: 경기 종료 평점이면 true (무기여 감점은 경기 중 결정 평점 변화에 섞지 않는다) */
export function ratingParts(s: SimState, a: Agent, duration: number, final = false): RatingParts {
  const R = ENGINE.rating;
  const st = a.stats;
  const rt = a.rt;
  const gf = s.teams[a.team].stats.goals;
  const ga = s.teams[1 - a.team]!.stats.goals;
  const minutes = (((a.leftAt ?? s.elapsed) - a.enteredAt) / duration) * 90;
  const p: RatingParts = {
    group: posGroup(a.spec.slot >= 0 ? a.pos : a.spec.position),
    passes: st.passesCompleted,
    forward: rt.forward,
    keyPasses: st.keyPasses,
    onTarget: st.shotsOnTarget,
    goals: st.goals,
    assists: st.assists,
    dribbles: st.dribblesWon,
    tackles: st.tacklesWon,
    interceptions: st.interceptions,
    aerials: st.aerialsWon,
    lost: rt.lost,
    dangerLost: rt.dangerLost,
    attackLost: rt.attackLost,
    ...(rt.riskLost ? { riskLost: rt.riskLost } : {}),
    ...(rt.passiveW ? { passive: rt.passiveW } : {}),
    ...(rt.passive ? { passiveN: rt.passive } : {}),
    fouls: st.fouls,
    offsides: st.offsides,
    yellows: st.yellows,
    red: st.red ? 1 : 0,
    conceded: a.line <= 2 ? rt.conceded : 0,
    saves: a.line === 0 ? s.teams[a.team].stats.saves * (a.leftAt !== null ? 0.5 : 1) : 0,
    cleanSheet: a.line <= 1 && ga === 0 && minutes >= R.cleanSheetMinMinutes ? 1 : 0,
    result: gf > ga ? 1 : gf < ga ? -1 : 0,
    ...(rt.card ? { card: rt.card } : {}),
    ...(rt.relief ? { relief: rt.relief } : {}),
  };
  if (final && minutes >= R.noContribMinMinutes && isNoContrib(p)) p.noContrib = 1;
  return p;
}

/** 행동 델타 합 + 팀 결과 (center 를 빼기 전) */
export function ratingDelta(p: RatingParts, R: RatingConfig = ENGINE.rating): number {
  let d = 0;
  d += (p.passes - p.forward) * R.pass + p.forward * R.forwardPass;
  // 유효 슈팅은 골이 된 슈팅을 빼고 센다 (골 가치에 이미 들어 있다, C.26)
  d += p.keyPasses * R.keyPass + Math.max(0, p.onTarget - p.goals) * R.onTarget + p.goals * R.goal + p.assists * R.assist;
  d += p.dribbles * R.dribble + p.tackles * R.tackle + p.interceptions * R.interception + p.aerials * R.aerial;
  // 공 상실: 우리 진영 1/3 은 위험 지역 감점, 상대 진영 마지막 1/3 은 시도에 따른 상실이라 절반 (C.26)
  // 위험 감수 실패 (C.77s A2): 전진·침투·크로스·돌파 뒤 상대 진영이면 riskLostFactor
  const risk = p.riskLost ?? 0;
  d += (p.lost - p.dangerLost - p.attackLost - risk) * R.lost + p.attackLost * R.lost * R.attackLostFactor + risk * R.lost * R.riskLostFactor + p.dangerLost * R.dangerLost;
  // 소극적 백패스 (C.77s A1): 경기 최대 passiveMax
  if (p.passive) d += Math.max(R.passiveMax, p.passive * R.passive);
  d += p.fouls * R.foul + p.offsides * R.offside + p.yellows * R.yellow + p.red * R.red;
  d += p.conceded * R.conceded + p.saves * R.save + p.cleanSheet * R.cleanSheet;
  d += p.result > 0 ? R.win : p.result < 0 ? R.loss : R.draw;
  if (p.card) d += p.card;
  if (p.relief) d += p.relief;
  if (p.noContrib) d += p.noContrib * R.noContrib;
  return d;
}

export function ratingFromParts(p: RatingParts, R: RatingConfig = ENGINE.rating): number {
  const rating = R.mean + R.scale * (ratingDelta(p, R) - (R.center[p.group] ?? 0.5));
  return Math.round(clamp(rating, R.min, R.max) * 10) / 10;
}

/** 경기 종료 후 출전한 모든 선수의 평점 */
export function computeRatings(s: SimState, players: Agent[], duration: number): void {
  for (const a of players) a.stats.rating = ratingFromParts(ratingParts(s, a, duration, true));
}
