// 경기 시뮬 (B.4): 한 번의 함수 호출로 결과, 출전, 골/어시스트, 평점, XP 계산

import { BALANCE, type Difficulty } from './config/balance';
import { randInt } from './growth';
import { expectedGoals, scorePair } from './league';
import { DEFENDER_POSITIONS, type FieldPosition } from './positions';
import { gaussian, type Rng } from './rng';

export interface MatchInput {
  ovr: number;
  position: FieldPosition;
  fatigue: number;
  teamRating: number;
  oppRating: number;
  home: boolean;
  /** 중립 경기 (컵·챔스 결승, 대표팀 대회, C.79o): 홈 이점 없음 */
  neutral?: boolean;
  difficulty: Difficulty;
  bigMatch?: boolean;
  /** 폼 보정 (7.2). 평점에 그대로 더한다 */
  formBonus?: number;
  /** 부상으로 결장 (7.3). 출전하지 않고 재활 XP 를 받는다 */
  injured?: boolean;
  /** 1군 테스트 출전 보장 (C.45) */
  forceStart?: boolean;
  /** 커리어 태그 선발 경쟁 보정 (C.47, OVR 단위). 출전 판정에만 */
  startBonus?: number;
  /** 선발 확률을 바로 준다 (C.62 감독 신뢰도·면담 보상, manager.startChance). 있으면 위 OVR·보정 대신 쓴다 */
  startP?: number;
}

export type MatchOutcome = 'win' | 'draw' | 'loss';

export interface MatchResult {
  goalsFor: number;
  goalsAgainst: number;
  outcome: MatchOutcome;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number;
  /** 출전하지 않았으면 null */
  rating: number | null;
  mom: boolean;
  xp: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function fatiguePenalty(fatigue: number): number {
  return Math.max(0, fatigue - BALANCE.fatigue.penaltyFrom);
}

/** 선발 확률 (B.4) */
export function startProbability(ovr: number, teamRating: number, fatigue: number): number {
  const M = BALANCE.match;
  const p = clamp(M.startBase + (ovr - teamRating) * M.startPerOvr, M.startMin, M.startMax);
  const condition = 1 - fatiguePenalty(fatigue) * BALANCE.fatigue.startPenaltyPerPoint;
  return clamp(p * condition, 0, 1);
}

/** 경기 XP (5.2) */
export function matchXp(rating: number, outcome: MatchOutcome, mom: boolean, minutes: number, bigMatch: boolean, difficulty: Difficulty): number {
  const X = BALANCE.matchXp;
  let xp = Math.max(0, (rating - X.ratingBase) * X.perRatingPoint) + X.appearance;
  xp += outcome === 'win' ? X.win : outcome === 'draw' ? X.draw : X.loss;
  if (mom) xp += X.mom;
  xp *= Math.min(1, minutes / 90);
  if (bigMatch) xp *= X.bigMatchMultiplier;
  xp *= BALANCE.difficulty[difficulty].xp;
  return Math.round(xp);
}

/** 빠른 경기 포지션 보정 (C.26): 동레이팅 중립 경기에서 이 포지션이 받는 골·도움·클린시트 기대 평점 */
export function positionCenter(position: FieldPosition, share: number, dampen: number): number {
  const M = BALANCE.match;
  const R = BALANCE.rating;
  const lambda = (M.baseGoals * (1 + Math.exp(M.homeRating * M.goalsK))) / 2;
  const pGoal = Math.min(M.maxInvolvement, M.scorerShare[position] * share);
  const pAssist = Math.min(M.maxInvolvement, M.assistShare[position] * share);
  let c = lambda * (pGoal * R.goal + (1 - pGoal) * pAssist * R.assist);
  if (DEFENDER_POSITIONS.includes(position)) c += Math.exp(-lambda) * R.cleanSheetDefender * dampen;
  return c;
}

export function simulateMatch(input: MatchInput, rng: Rng): MatchResult {
  const M = BALANCE.match;
  const R = BALANCE.rating;

  // 출전 판정
  // 1군 테스트 출전 보장 (C.45): 난수는 그대로 쓴다
  const roll = rng();
  const started = !input.injured && (!!input.forceStart || roll < (input.startP ?? startProbability(input.ovr + (input.startBonus ?? 0), input.teamRating, input.fatigue)));
  let minutes = 90;
  if (!started) minutes = !input.injured && rng() < M.subChance ? randInt(rng, M.subMinutes.min, M.subMinutes.max) : 0;
  const share = minutes / 90;

  // 팀 득점. 내 선수는 출전 시간만큼 팀 전력에 작게 반영
  const ownRating = input.teamRating + (input.ovr - input.teamRating) * share * BALANCE.league.myPlayerInfluence;
  const [goalsFor, goalsAgainst] = scorePair(rng,
    expectedGoals(ownRating, input.oppRating, input.home && !input.neutral),
    expectedGoals(input.oppRating, ownRating, !input.home && !input.neutral));
  const outcome: MatchOutcome = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';

  if (minutes === 0) {
    const weekXp = input.injured ? BALANCE.injury.rehabXp : BALANCE.matchXp.bench;
    const xp = Math.round(weekXp * BALANCE.difficulty[input.difficulty].xp);
    return { goalsFor, goalsAgainst, outcome, started, minutes, goals: 0, assists: 0, rating: null, mom: false, xp };
  }

  // 골/어시스트: 우리 팀 골마다 추첨
  const strength = input.ovr / input.teamRating;
  const pGoal = Math.min(M.maxInvolvement, M.scorerShare[input.position] * strength * share);
  const pAssist = Math.min(M.maxInvolvement, M.assistShare[input.position] * strength * share);
  let goals = 0;
  let assists = 0;
  for (let i = 0; i < goalsFor; i++) {
    if (rng() < pGoal) goals++;
    else if (rng() < pAssist) assists++;
  }

  // 평점 (C.26): 6.5 + 포지션 보정 + 활약. 포지션 보정은 동레이팅 경기에서 그 포지션이 기대하는 골·도움·클린시트 몫을 빼서
  // 포지션 평균이 6.5 근처가 되게 한다 (엔진 center 와 같은 역할)
  const resultBonus = outcome === 'win' ? R.win : outcome === 'loss' ? R.loss : R.draw;
  const defender = DEFENDER_POSITIONS.includes(input.position);
  let delta = (input.ovr - input.oppRating) * R.perOvrDiff + resultBonus + gaussian(rng) * R.randomSd;
  if (goalsAgainst === 0 && defender) delta += R.cleanSheetDefender;
  // 교체 출전은 활약 폭이 작다
  const dampen = started ? 1 : Math.max(R.subDampenMin, share);
  delta *= dampen;
  delta += goals * R.goal + assists * R.assist;
  delta -= positionCenter(input.position, share, dampen);
  delta += BALANCE.difficulty[input.difficulty].rating;
  delta += input.formBonus ?? 0;
  delta -= fatiguePenalty(input.fatigue) * BALANCE.fatigue.ratingPenaltyPerPoint;
  const rating = Math.round(clamp(R.base + delta, R.min, R.max) * 10) / 10;

  const mom = rating >= R.momMin && outcome !== 'loss';
  const xp = matchXp(rating, outcome, mom, minutes, input.bigMatch ?? false, input.difficulty);
  return { goalsFor, goalsAgainst, outcome, started, minutes, goals, assists, rating, mom, xp };
}
