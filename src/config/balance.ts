// 밸런스 설정 (docs/game-design.md 부록 A)
// 모든 수치는 초기값이다. 이 파일만 고치면 게임에 반영된다.
// 세이브 필드 구조를 바꾸는 변경은 src/save.ts 의 SAVE_FORMAT_VERSION 을 올린다.

import type { Tier } from '../types';

/** 수치를 바꾸면 올린다. 새 게임 시작 시 세이브에 기록된다. */
export const BALANCE_VERSION = 1;

export type Difficulty = 'easy' | 'normal' | 'hard';

export const BALANCE = {
  // ── 성장 (5.1, 6.2, B.5) ──
  growth: {
    xpPerLevel: 200,
    pointsPerLevel: 5,
    /** 한 번의 레벨업에서 한 능력치에 올릴 수 있는 최대치 */
    maxRaisePerLevel: 3,
    maxAttribute: 99,
    /** 포인트 비용 구간: 현재 값이 cost1Max 이하면 1, cost2Max 이하면 2, 그 위는 3 */
    costBands: {
      normal: { cost1Max: 70, cost2Max: 84 },
      special: { cost1Max: 73, cost2Max: 86 },
      topClass: { cost1Max: 76, cost2Max: 89 },
      worldClass: { cost1Max: 78, cost2Max: 91 },
      legendary: { cost1Max: 80, cost2Max: 92 },
    } satisfies Record<Tier, { cost1Max: number; cost2Max: number }>,
    /**
     * 시즌 종료 자동 성장 (17~21세): 전 능력치 +min~max.
     * 기획서 기본은 전 티어 +0~2. 잠재력 티어 차이가 30세 OVR 에 드러나도록 티어별로 나눴다.
     */
    autoGrowth: {
      minAge: 17,
      maxAge: 21,
      byTier: {
        normal: [0, 2],
        special: [0, 2],
        topClass: [1, 2],
        worldClass: [2, 3],
        legendary: [2, 4],
      } satisfies Record<Tier, [number, number]>,
    },
  },

  // ── 경기 XP (5.2) ──
  matchXp: {
    ratingBase: 4.0,
    perRatingPoint: 10,
    /** 출전하면 결과와 무관하게 받는 XP (90분 기준, 출전 시간 비례) */
    appearance: 8,
    win: 8,
    draw: 5,
    loss: 3,
    mom: 15,
    /** 출전하지 못한 주에도 받는 훈련 XP */
    bench: 8,
    bigMatchMultiplier: 1.5,
  },

  // ── 시즌 업적 XP (5.3), 위상 (8.1) ──
  achievements: {
    /** 리그 순위별 XP. [최대 순위, XP] 순서대로 처음 맞는 것 */
    leaguePosition: [
      [1, 300],
      [2, 200],
      [4, 120],
    ] as [number, number][],
    highAvgRating: { minAvg: 7.5, minApps: 10, xp: 150 },
  },
  reputation: {
    max: 1000,
    /** 업적 XP 중 위상 점수로 쌓이는 비율 */
    fromAchievementXp: 1 / 3,
    /** 시즌당 감소 비율 */
    seasonDecay: 0.02,
    tierCuts: { normal: 0, special: 150, topClass: 350, worldClass: 600, legendary: 850 } satisfies Record<Tier, number>,
  },

  // ── 실력 티어 (B.5): OVR 하한 ──
  skillTierCuts: { normal: 0, special: 70, topClass: 77, worldClass: 84, legendary: 90 } satisfies Record<Tier, number>,

  // ── 노화 (6.1) ──
  // 능력치마다 [이 나이부터, 시즌당 평균 하락]. 소수는 확률 (0.5 = 능력치마다 50% 확률로 -1, 즉 2년에 -1꼴)
  aging: {
    /** 속도, 가속, 민첩성, 체력, 근력, 점프 */
    physical: [
      [30, 0.5],
      [32, 1],
      [36, 2],
    ] as [number, number][],
    /** 기술/수비/멘탈 */
    other: [
      [33, 0.5],
      [35, 1],
      [37, 2],
    ] as [number, number][],
  },

  // ── 은퇴 (1) ──
  retirement: { optionalAge: 30, forcedAge: 38 },

  // ── 새 게임 (B.2) ──
  newGame: {
    startAge: 17,
    startYear: 2018,
    startOvr: { min: 52, max: 60 },
    potentialOdds: { normal: 45, special: 30, topClass: 15, worldClass: 8, legendary: 2 } satisfies Record<Tier, number>,
    /** 가상 유망주 배정 팀: 레이팅 순위 기준 이 범위(1 = 최강)에서 랜덤 */
    teamRankRange: { min: 8, max: 20 },
  },

  // ── 리그 (B.3) ──
  league: {
    /** 시즌마다 팀 레이팅: 팀 장기 평균 + (현재 - 장기 평균) × keep + N(0, sd) */
    ratingKeep: 0.6,
    ratingNoiseSd: 1.5,
    ratingMin: 60,
    ratingMax: 90,
    /** 내 선수가 팀 전력에 주는 영향: (내 OVR - 팀 레이팅) × 출전 비율 × 이 값 */
    myPlayerInfluence: 1 / 11,
  },

  // ── 경기 시뮬 (B.4) ──
  match: {
    startBase: 0.8,
    startPerOvr: 0.04,
    startMin: 0.15,
    startMax: 0.95,
    subChance: 0.5,
    subMinutes: { min: 15, max: 30 },
    baseGoals: 1.35,
    goalsK: 0.05,
    homeBonus: 0.25,
    scorerShare: {
      ST: 0.3, CF: 0.22, LW: 0.15, RW: 0.15, CAM: 0.12, CM: 0.06, LM: 0.1, RM: 0.1,
      CDM: 0.03, LB: 0.03, RB: 0.03, LWB: 0.03, RWB: 0.03, CB: 0.04,
    },
    assistShare: {
      ST: 0.1, CF: 0.14, LW: 0.15, RW: 0.15, CAM: 0.18, CM: 0.1, LM: 0.14, RM: 0.14,
      CDM: 0.05, LB: 0.08, RB: 0.08, LWB: 0.08, RWB: 0.08, CB: 0.02,
    },
    /** 골/어시 확률 상한 (한 골당) */
    maxInvolvement: 0.6,
  },

  // ── 평점 (B.4) ──
  rating: {
    base: 6.0,
    perOvrDiff: 0.03,
    win: 0.4,
    draw: 0,
    loss: -0.4,
    goal: 0.8,
    assist: 0.5,
    cleanSheetDefender: 0.4,
    randomSd: 0.6,
    min: 3.0,
    max: 10.0,
    /** MOM: 평점이 이 값 이상이고 지지 않았을 때 */
    momMin: 8.0,
    /** 교체 출전은 평점 변동을 출전 비율만큼 줄이되 최소 이 비율 */
    subDampenMin: 0.4,
  },

  // ── 피로 (7.1) ──
  fatigue: {
    max: 100,
    /** 90분 출전 시 증가량 */
    perMatch90: 22,
    /** 경기가 있는 주의 회복량 (경기 전에 적용). 1단계는 주당 1경기라 피로가 거의 쌓이지 않는다 */
    weeklyRecovery: 25,
    noMatchWeekRecovery: 40,
    /** 이 값을 넘으면 평점/선발 확률 페널티 */
    penaltyFrom: 50,
    ratingPenaltyPerPoint: 0.02,
    startPenaltyPerPoint: 0.01,
  },

  // ── 난이도 (14) ──
  difficulty: {
    easy: { label: '쉬움', xp: 1.2, rating: 0.2, injury: 0.7 },
    normal: { label: '보통', xp: 1.0, rating: 0, injury: 1.0 },
    hard: { label: '어려움', xp: 0.85, rating: -0.2, injury: 1.3 },
  } satisfies Record<Difficulty, { label: string; xp: number; rating: number; injury: number }>,

  // ── NPC 성장 (5.6, B.6) ──
  npc: {
    peakOvr: {
      normal: [60, 72],
      special: [70, 79],
      topClass: [78, 85],
      worldClass: [84, 90],
      legendary: [89, 96],
    } satisfies Record<Tier, [number, number]>,
    peakAge: { min: 25, max: 29 },
    /** 전성기 전: 남은 차이 / (전성기까지 남은 시즌 + 1) × approach 만큼 접근 */
    approach: 1.0,
    /** 전성기 전 한 시즌 최대 상승폭 (폭발적 성장 보너스 제외) */
    maxSeasonGain: 4,
    seasonLuck: 1.5,
    breakoutChance: 0.05,
    breakoutBonus: 3,
    stagnationChance: 0.05,
    /** 변화량 배분 시 핵심 능력치 가중 */
    keyAttributeWeight: 3,
  },
} as const;

export type Balance = typeof BALANCE;
