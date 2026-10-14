// 경기 시뮬 (B.4): 한 번의 함수 호출로 결과, 출전, 골/어시스트, 평점, XP 계산

import { BALANCE, type Difficulty } from './config/balance';
import { randInt } from './growth';
import { poisson, expectedGoals } from './league';
import { DEFENDER_POSITIONS, type FieldPosition } from './positions';
import { gaussian, type Rng } from './rng';

export interface MatchInput {
  ovr: number;
  position: FieldPosition;
  fatigue: number;
  teamRating: number;
  oppRating: number;
  home: boolean;
  difficulty: Difficulty;
  bigMatch?: boolean;
  /** 폼 보정 (7.2). 평점에 그대로 더한다 */
  formBonus?: number;
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

export function simulateMatch(input: MatchInput, rng: Rng): MatchResult {
  const M = BALANCE.match;
  const R = BALANCE.rating;

  // 출전 판정
  const started = rng() < startProbability(input.ovr, input.teamRating, input.fatigue);
  let minutes = 90;
  if (!started) minutes = rng() < M.subChance ? randInt(rng, M.subMinutes.min, M.subMinutes.max) : 0;
  const share = minutes / 90;

  // 팀 득점. 내 선수는 출전 시간만큼 팀 전력에 작게 반영
  const ownRating = input.teamRating + (input.ovr - input.teamRating) * share * BALANCE.league.myPlayerInfluence;
  const goalsFor = poisson(rng, expectedGoals(ownRating, input.oppRating, input.home));
  const goalsAgainst = poisson(rng, expectedGoals(input.oppRating, ownRating, !input.home));
  const outcome: MatchOutcome = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';

  if (minutes === 0) {
    const xp = Math.round(BALANCE.matchXp.bench * BALANCE.difficulty[input.difficulty].xp);
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

  // 평점
  const resultBonus = outcome === 'win' ? R.win : outcome === 'loss' ? R.loss : R.draw;
  let delta = (input.ovr - input.oppRating) * R.perOvrDiff + resultBonus + gaussian(rng) * R.randomSd;
  if (goalsAgainst === 0 && DEFENDER_POSITIONS.includes(input.position)) delta += R.cleanSheetDefender;
  // 교체 출전은 활약 폭이 작다
  if (!started) delta *= Math.max(R.subDampenMin, share);
  delta += goals * R.goal + assists * R.assist;
  delta += BALANCE.difficulty[input.difficulty].rating;
  delta += input.formBonus ?? 0;
  delta -= fatiguePenalty(input.fatigue) * BALANCE.fatigue.ratingPenaltyPerPoint;
  const rating = Math.round(clamp(R.base + delta, R.min, R.max) * 10) / 10;

  const mom = rating >= R.momMin && outcome !== 'loss';
  const xp = matchXp(rating, outcome, mom, minutes, input.bigMatch ?? false, input.difficulty);
  return { goalsFor, goalsAgainst, outcome, started, minutes, goals, assists, rating, mom, xp };
}
