// playRound 어댑터 (E.14): 내 경기를 엔진(자동 모드)으로 돌리고 기존 MatchResult 로 바꾼다

import { BALANCE, type Difficulty } from '../config/balance';
import type { MatchOutcome, MatchResult } from '../match';
import { matchXp } from '../match';
import { posGroup, type TeamRoster } from '../roster';
import type { FieldPosition } from '../positions';
import type { FieldAttributes } from '../attributes';
import { ENGINE } from './config';
import { teamSetupFromRoster } from './setup';
import { createMatch } from './sim';
import type { EngineResult, PlayerSpec, PlayerStats, TeamSetup } from './types';

export const MY_ID = 'me';

export interface MyMatchPlan {
  /** 선발이면 true */
  started: boolean;
  /** 출전 구간(분). 출전하지 않으면 null */
  minutes: { start: number; end: number } | null;
}

export interface MyPlayerInput {
  position: FieldPosition;
  attributes: FieldAttributes;
  fatigue: number;
  /** 폼 보정 (D.1, ±0.3) */
  form: number;
}

export interface EngineMatchInput {
  myRoster: TeamRoster;
  oppRoster: TeamRoster;
  myRating: number;
  oppRating: number;
  home: boolean;
  me: MyPlayerInput;
  plan: MyMatchPlan;
  difficulty: Difficulty;
  seed: number;
  worldSeed: string;
  bigMatch?: boolean;
}

/** 경기 시작 스태미나 = 100 − 피로 × staminaPerFatigue (E.16) */
export function startStamina(fatigue: number): number {
  return Math.max(30, 100 - fatigue * ENGINE.match.staminaPerFatigue);
}

/** 내 선수가 들어갈 슬롯: 같은 포지션군 중 OVR 이 가장 낮은 선수 자리, 없으면 GK 를 뺀 가장 낮은 선수 */
function mySlot(setup: TeamSetup, pos: FieldPosition): number {
  const g = posGroup(pos);
  const outfield = setup.lineup.map((p, i) => ({ p, i })).filter(({ p }) => p.position !== 'GK' && p.slot >= 0);
  const same = outfield.filter(({ p }) => posGroup(p.position) === g);
  const pool = same.length ? same : outfield;
  return pool[pool.length - 1]!.i;
}

export function buildMyMatch(m: EngineMatchInput) {
  const mySetup = teamSetupFromRoster(m.myRoster, m.myRating, m.oppRating, m.worldSeed);
  const oppSetup = teamSetupFromRoster(m.oppRoster, m.oppRating, m.myRating, m.worldSeed);
  const meSpec: PlayerSpec = {
    id: MY_ID, name: '나', slot: -1, position: m.me.position, attrs: { ...m.me.attributes },
    stamina: startStamina(m.me.fatigue), form: m.me.form, isMe: true,
  };
  if (m.plan.minutes) {
    if (m.plan.started) {
      const i = mySlot(mySetup, m.me.position);
      meSpec.slot = mySetup.lineup[i]!.slot;
      mySetup.lineup[i] = meSpec;
    } else {
      mySetup.bench = [...mySetup.bench, meSpec];
    }
  }
  return createMatch({
    home: m.home ? mySetup : oppSetup,
    away: m.home ? oppSetup : mySetup,
    mode: 'auto',
    myPlayerId: m.plan.minutes ? MY_ID : undefined,
    difficulty: m.difficulty,
    seed: m.seed,
    bigMatch: m.bigMatch ?? false,
    ...(m.plan.minutes ? { myMinutes: m.plan.minutes } : {}),
  });
}

export interface MyMatchOutput {
  result: MatchResult;
  engine: EngineResult;
  my: PlayerStats | null;
  /** 내 팀 쪽 (0 홈, 1 원정) */
  side: 0 | 1;
}

/** 엔진 결과 → 기존 MatchResult (E.2 toMatchResult) */
export function toMatchResult(r: EngineResult, side: 0 | 1, started: boolean, difficulty: Difficulty, bigMatch = false): MatchResult {
  const goalsFor = side === 0 ? r.homeGoals : r.awayGoals;
  const goalsAgainst = side === 0 ? r.awayGoals : r.homeGoals;
  const outcome: MatchOutcome = goalsFor > goalsAgainst ? 'win' : goalsFor < goalsAgainst ? 'loss' : 'draw';
  const my = r.myStats;
  const minutes = my ? Math.max(1, my.minutes) : 0;
  if (!my || minutes === 0) {
    const xp = Math.round(BALANCE.matchXp.bench * BALANCE.difficulty[difficulty].xp);
    return { goalsFor, goalsAgainst, outcome, started: false, minutes: 0, goals: 0, assists: 0, rating: null, mom: false, xp };
  }
  const R = BALANCE.rating;
  const rating = Math.round(Math.min(R.max, Math.max(R.min, my.rating + BALANCE.difficulty[difficulty].rating)) * 10) / 10;
  const mom = rating >= R.momMin && outcome !== 'loss';
  const xp = matchXp(rating, outcome, mom, minutes, bigMatch, difficulty);
  return { goalsFor, goalsAgainst, outcome, started, minutes, goals: my.goals, assists: my.assists, rating, mom, xp };
}

export function playMyMatch(m: EngineMatchInput): MyMatchOutput {
  const sim = buildMyMatch(m);
  const engine = sim.runToEnd();
  const side: 0 | 1 = m.home ? 0 : 1;
  const result = toMatchResult(engine, side, m.plan.started, m.difficulty, m.bigMatch);
  return { result, engine, my: engine.myStats, side };
}

/** 경기 후 피로 증가 (E.16): 실제 이동 거리에서 환산. 90분 풀타임 평균 거리가 기존 +22 부근 */
export function fatigueFromDistance(distance: number): number {
  return (BALANCE.fatigue.perMatch90 * distance) / ENGINE.match.fatigueRefDistance;
}
