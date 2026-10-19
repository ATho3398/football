// 부상 (7.3, 부록 D.2): 출전 경기마다 판정, 등급 추첨, 영구 하락

import { injuryMul, type Tagged } from './tags';
import { BALANCE, type Difficulty } from './config/balance';
import { PHYSICAL, randInt, type AttributeDelta } from './growth';
import type { Rng } from './rng';
import type { Injury, InjuryGrade, PlayerState } from './types';

export const INJURY_NAMES_KO: Record<InjuryGrade, string> = {
  minor: '경상', major: '중상', seasonEnding: '시즌아웃',
};

/** 이번 경기에서 다칠 확률. fatigue 는 경기 시작 때 피로 */
export function injuryChance(
  p: Pick<PlayerState, 'attributes' | 'age' | 'fatigue'> & Tagged, minutes: number, difficulty: Difficulty,
): number {
  const I = BALANCE.injury;
  if (minutes <= 0) return 0;
  const fatigue = 1 + Math.max(0, p.fatigue - I.fatigueFrom) * I.fatiguePerPoint;
  const physical = I.physicalBase - (I.physicalSlope * (p.attributes.strength + p.attributes.stamina)) / 2 / 100;
  const age = p.age >= I.ageFrom ? I.ageMultiplier : 1;
  // 장단점 (C.45): 유리몸 ×1.5, 철강왕 ×0.6
  return I.base * Math.min(1, minutes / 90) * BALANCE.difficulty[difficulty].injury * fatigue * physical * age * injuryMul(p);
}

function rollGrade(rng: Rng): InjuryGrade {
  const G = BALANCE.injury.grades;
  const r = rng();
  if (r < G.minor.chance) return 'minor';
  if (r < G.minor.chance + G.major.chance) return 'major';
  return 'seasonEnding';
}

/** 영구 하락: 신체 능력치 1~2개 각 -1~3. attrs 를 바로 바꾸고 변화량을 돌려준다 */
function rollPermanent(p: PlayerState, grade: InjuryGrade, rng: Rng): AttributeDelta {
  const P = BALANCE.injury.permanent;
  const delta: AttributeDelta = {};
  if (grade === 'minor') return delta;
  const chance = P.chance * (p.age >= P.ageFrom ? P.ageMultiplier : 1);
  if (rng() >= chance) return delta;
  const pool = [...PHYSICAL];
  const n = randInt(rng, P.attrs[0], P.attrs[1]);
  for (let i = 0; i < n && pool.length; i++) {
    const a = pool.splice(Math.floor(rng() * pool.length), 1)[0]!;
    const nv = Math.max(1, p.attributes[a] - randInt(rng, P.drop[0], P.drop[1]));
    if (nv !== p.attributes[a]) delta[a] = nv - p.attributes[a];
    p.attributes[a] = nv;
  }
  return delta;
}

/**
 * 출전한 경기 뒤 부상 판정. 다치면 p.injury 를 설정하고 돌려준다.
 * remainingRounds: 이 경기 뒤 남은 시즌 라운드 수 (시즌아웃 기간). at.daysToEnd: 최종 라운드까지 남은 날 (시즌아웃은 그보다 짧지 않다)
 */
export function rollInjury(
  p: PlayerState, minutes: number, difficulty: Difficulty, remainingRounds: number,
  at: { season: number; round: number; date?: string; daysToEnd?: number }, rng: Rng,
  chanceMul = 1, daysMul = 1,
): Injury | null {
  // 의료 스태프 (C.68a): 팀 닥터 = 확률 ×chanceMul, 물리치료사 = 경상·중상 기간 ×daysMul (시즌아웃은 그대로)
  if (rng() >= injuryChance(p, minutes, difficulty) * chanceMul) return null;
  const G = BALANCE.injury.grades;
  const grade = rollGrade(rng);
  const weeks = grade === 'seasonEnding'
    ? Math.max(remainingRounds, G.seasonEnding.minWeeks)
    : randInt(rng, G[grade].weeks[0], G[grade].weeks[1]);
  const days = grade === 'seasonEnding' ? Math.max(weeks * 7, at.daysToEnd ?? 0) : Math.max(1, Math.round(weeks * 7 * daysMul));
  const injury: Injury = {
    grade, weeksTotal: weeks, daysTotal: days, daysLeft: days, ...(at.date ? { date: at.date } : {}), season: at.season, round: at.round,
    permanent: rollPermanent(p, grade, rng),
  };
  p.injury = injury;
  return injury;
}

/** 부상 중 days 일 경과 (부록 C.38). 회복하면 true */
export function healDays(p: PlayerState, days = 1): boolean {
  if (!p.injury) return false;
  p.injury.daysLeft -= days;
  if (p.injury.daysLeft > 0) return false;
  p.injury = null;
  return true;
}

/** 남은 부상 기간 (주, 올림) */
export function weeksLeft(inj: Injury): number {
  return Math.ceil(inj.daysLeft / 7);
}
