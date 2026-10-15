// 밸런스 설정 (docs/game-design.md 부록 A)
// 모든 수치는 초기값이다. 이 파일만 고치면 게임에 반영된다.
// 세이브 필드 구조를 바꾸는 변경은 src/save.ts 의 SAVE_FORMAT_VERSION 을 올린다.

import type { FieldAttribute } from '../attributes';
import type { Tier } from '../types';

/** 수치를 바꾸면 올린다. 새 게임 시작 시 세이브에 기록된다. */
export const BALANCE_VERSION = 16;

export type Difficulty = 'easy' | 'normal' | 'hard';

export const BALANCE = {
  // ── 성장 (5.1, 6.2, B.5) ──
  growth: {
    xpPerLevel: 200,
    /** OVR 연동 XP 요구량 (5.1, 부록 D.6 #2): 필요 XP = xpPerLevel × (1 + max(0, OVR - fromOvr) × perOvr) */
    xpByOvr: { fromOvr: 80, perOvr: 0.06 }, // 기획서 0.04, 부록 C.6
    pointsPerLevel: 5,
    /** 한 번의 레벨업에서 한 능력치에 올릴 수 있는 최대치 */
    maxRaisePerLevel: 3,
    maxAttribute: 99,
    /**
     * 포인트 비용 구간: 현재 값이 cost1Max 이하면 1, cost2Max 이하면 2, 그 위는 3.
     * 내 선수는 현재 위상 티어(reputation.tierCuts)의 구간을 쓴다 (6.2 성장 해금, 부록 D.0 #1)
     */
    costBands: {
      normal: { cost1Max: 70, cost2Max: 84 },
      special: { cost1Max: 73, cost2Max: 86 },
      topClass: { cost1Max: 76, cost2Max: 89 },
      worldClass: { cost1Max: 78, cost2Max: 91 },
      legendary: { cost1Max: 80, cost2Max: 92 },
    } satisfies Record<Tier, { cost1Max: number; cost2Max: number }>,
    /** 고값 추가 비용 (6.2, 부록 D.6 #1, 위상 무관): [현재 값이 이 값 이상, 비용]. 실제 비용 = max(구간 비용, 고값 비용) */
    highValueCost: [
      [93, 4],
      [96, 6],
      [98, 9],
    ] as [number, number][],
    /**
     * 시즌 종료 자동 성장 (17~21세): 전 능력치 +min~max.
     * 기획서 기본은 전 티어 +0~2. 잠재력 티어 차이가 30세 OVR 에 드러나도록 티어별로 나눴다.
     * 내 선수의 숨은 잠재력은 이 자동 성장 폭에만 쓴다 (6.2)
     */
    /**
     * 실제 선수 성장 여지 (부록 D.7 #1, 실제 선수만): 정점 목표 = 시작 OVR + 시작 나이별 여지.
     * 필요 XP에 × (1 + max(0, OVR - (정점 목표 - softBelow)) × perOvr) 를 더 곱해 목표 근처에서 성장이 느려진다.
     * roomByStartAge: [이 나이부터, 여지]
     */
    realPeak: {
      roomByStartAge: [
        [0, 10],
        [21, 8],
        [24, 7],
        [27, 4],
        [30, 2],
      ] as [number, number][],
      softBelow: 2,
      perOvr: 3.0,
      /** OVR 이 정점 목표 - 이 값 이상이면 17~21세 자동 성장을 받지 않는다 */
      autoGrowthStopBelow: 6,
    },
    autoGrowth: {
      minAge: 17,
      maxAge: 21,
      byTier: {
        normal: [0, 2],
        special: [0, 2],
        topClass: [1, 2],
        worldClass: [2, 3],
        legendary: [3, 4],
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
    /** 고령 XP 감쇠 (6.1): [이 나이부터, 배율]. 경기 XP와 결장 주 훈련 XP에만 적용. 기획서 0.9/0.8/0.65/0.5, 부록 C.6 */
    veteranMultiplier: [
      [30, 0.75],
      [32, 0.6],
      [34, 0.45],
      [36, 0.3],
    ] as [number, number][],
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
    // 팀 내 활약 업적 (5.3, 부록 D.0 #5)
    /** 내 골+어시스트가 팀 득점의 share 이상 */
    teamAttack: { minApps: 15, share: 0.25, xp: 100 },
    /** 시즌 평균 평점 minAvg 이상 highAvgRating.minAvg 미만 */
    steadyRating: { minApps: 10, minAvg: 7.0, xp: 80 },
    /** 최종 순위가 시즌 전 팀 레이팅 순위보다 minPlacesAbove 계단 이상 위 */
    underdog: { minPlacesAbove: 3, xp: 100 },
  },
  reputation: {
    max: 1000,
    /** 업적 XP 중 위상 점수로 쌓이는 비율 */
    fromAchievementXp: 1 / 2,
    /** 개인 기록 가산 (8.1, 부록 D.6 #3): MOM 1회당, 시즌 골+어시 per 개당 points, 시즌 합계 최대 max */
    personal: { perMom: 5, goalInvolvements: { per: 10, points: 25 }, max: 200 }, // 기획서 3 / 10 / 120, 부록 C.6
    /** 시즌당 감소 비율 */
    seasonDecay: 0.02,
    tierCuts: { normal: 0, special: 150, topClass: 350, worldClass: 600, legendary: 850 } satisfies Record<Tier, number>,
  },

  // ── 실력 티어 (B.5): OVR 하한 ──
  skillTierCuts: { normal: 0, special: 70, topClass: 77, worldClass: 84, legendary: 90 } satisfies Record<Tier, number>,

  // ── 노화 (6.1) ──
  // 능력치마다 [이 나이부터, 시즌당 평균 하락]. 소수는 확률 (0.5 = 능력치마다 50% 확률로 -1, 즉 2년에 -1꼴)
  aging: {
    /** 속도, 가속, 민첩성, 체력, 근력, 점프. 기획서 0.7/1.3/2, 부록 C.6 */
    physical: [
      [30, 1],
      [32, 2.2],
      [36, 3],
    ] as [number, number][],
    /** 기술/수비/멘탈 */
    other: [
      [33, 0.5],
      [35, 1],
      [37, 2],
    ] as [number, number][],
    /**
     * 노화를 포지션 OVR 에 중요한 능력치에 몰아주는 정도 (0 = 고르게, 1 = OVR 비중에 정비례).
     * 능력치별 배율 = (1 - s) + s × (OVR 비중 / 25개 평균 비중). 평균 배율이 1이라 총 하락량은 그대로다.
     * 고르게 깎으면 포인트를 OVR 능력치에만 찍는 선수는 30대에도 OVR 이 떨어지지 않는다 (부록 D.0 점검)
     */
    positionFocus: 0.8,
  },

  // ── 노련함 능력치 (6.1.1, 부록 D.0 #4) ──
  veteran: {
    attributes: [
      'offTheBall', 'defensivePositioning', 'vision', 'composure', 'bigMatch', 'leadership', 'interception', 'marking',
    ] as readonly FieldAttribute[],
    /** 시즌 종료 때 능력치마다 +1 확률: [이 나이부터, 확률]. 포인트 비용과 무관 */
    growth: [
      [27, 0.5],
      [31, 0.25],
      [34, 0],
    ] as [number, number][],
    /** 이 나이부터 노화 대상. 그 전에는 면제 */
    agingFromAge: 35,
    /** 노화 시 기술/멘탈 하락 확률에 곱하는 값. 기획서 0.5, 부록 C.8 */
    agingFactor: 0.4,
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

  // ── 폼 (7.2, 부록 D.1) ──
  form: {
    /** 최근 출전 N경기 평점 평균. N경기 미만이면 보정 없음 */
    games: 5,
    /** 보정 = clamp((평균 - pivot) × perPoint, -max, +max) 를 다음 경기 평점에 더한다 */
    pivot: 6.5,
    perPoint: 0.3,
    max: 0.3,
    /** 화면 5단계: 보정이 이 값 이상이면 매우 좋음 / 좋음, 이 값 이하면 매우 나쁨 / 나쁨 */
    veryGood: 0.2,
    good: 0.07,
    bad: -0.07,
    veryBad: -0.2,
  },

  // ── 부상 (7.3, 부록 D.2) ──
  // 출전 경기마다 확률 = base × 출전 비율 × 난이도 배율 × 피로 보정 × 신체 보정 × 나이 보정
  injury: {
    base: 0.02,
    /** 피로 보정 = 1 + max(0, 피로 - fatigueFrom) × fatiguePerPoint */
    fatigueFrom: 30,
    fatiguePerPoint: 0.02,
    /** 신체 보정 = physicalBase - physicalSlope × (근력 + 체력) / 2 / 100 */
    physicalBase: 1.3,
    physicalSlope: 0.6,
    /** 나이 보정: 이 나이 이상이면 × ageMultiplier */
    ageFrom: 30,
    ageMultiplier: 1.3,
    /** 등급 추첨 확률(합 1)과 기간(주). 시즌아웃은 남은 시즌 전체, 최소 minWeeks */
    grades: {
      minor: { chance: 0.7, weeks: [1, 3] as [number, number] },
      major: { chance: 0.27, weeks: [8, 16] as [number, number] },
      seasonEnding: { chance: 0.03, minWeeks: 20 },
    },
    /** 부상 중 주당 재활 XP (출전 대신) */
    rehabXp: 4,
    /** 비시즌 동안 줄어드는 부상 기간 (기획서 미정, 코드 세션 결정) */
    offseasonWeeks: 8,
    /** 영구 하락: 중상 이상에서 chance (ageFrom 이상이면 × ageMultiplier) 확률로 신체 능력치 attrs개가 각 -drop */
    permanent: {
      chance: 0.2,
      ageFrom: 30,
      ageMultiplier: 1.5,
      attrs: [1, 2] as [number, number],
      drop: [1, 3] as [number, number],
    },
  },

  // ── 징계 (부록 E.10) ──
  discipline: {
    /** 시즌 옐로 누적 이 장수마다 출장 정지 */
    yellowBanEvery: 5,
    /** 퇴장/누적 시 출장 정지 경기 수 */
    banMatches: 1,
  },

  // ── 피로 (7.1) ──
  fatigue: {
    max: 100,
    /** 90분 출전 시 증가량 */
    perMatch90: 22,
    /** 경기가 있는 주의 회복량 (경기 전에 적용). 주당 1경기라 피로가 거의 쌓이지 않는다. 부상 중인 주는 noMatchWeekRecovery */
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

  // ── 팀 로스터 생성기 (23번, R단계) ──
  roster: {
    /** 팀당 24명 포지션 구성. 윙 3명은 포메이션 측면 포지션 2명 + 랜덤 1명 */
    squad: { GK: 3, CB: 4, FB: 4, CDM: 2, CM: 3, CAM: 2, WING: 3, ST: 3 },
    /** 가상 선수 목표 OVR = 팀 레이팅 + 오프셋 + N(0, sd). 주전 / 1차 백업 / 그 외 */
    starterOffset: 0, starterSd: 2,
    backupOffset: -5, backupSd: 3,
    reserveOffset: -11, reserveSd: 3,
    /** 팀 레이팅을 목표 ±fitTolerance 안으로 맞출 때까지 주전 OVR 을 조정 (최대 fitIterations 회) */
    fitTolerance: 0.3,
    /** 실제 선수가 있는 팀의 가상 선수 OVR 상한 = 그 팀 실제 선수 평균 OVR (E.24 3번). 이 때문에 팀 레이팅이 목표보다 낮아질 수 있다 */
    virtualCapToReal: true,
    /** 상한 계산에 넣는 실제 주전: 팀 레이팅 − 이 값 이상인 실제 선수 (어린 유망주 제외) */
    virtualCapStarterGap: 10,
    fitIterations: 30,
    /** 가상 선수 나이 N(mean, sd), [min, max] */
    age: { mean: 26, sd: 4, min: 18, max: 36 },
    /** 전성기 전 가상 선수의 전성기 OVR = 현재 OVR + 남은 시즌 × U(min, max), 최대 maxPeak */
    youthGrowthPerSeason: { min: 0, max: 0.8 },
    maxPeak: 94,
    /** 충성도 N(mean, sd) 0~100, 계약 만료 1~5년 후 (18.6) */
    loyalty: { mean: 60, sd: 20 },
    contractYears: { min: 1, max: 5 },
    /** 라인업 선택: 포지션군이 다르면 선택 점수에서 뺀다 (가까운 군은 near) */
    outOfGroupPenalty: 6,
    nearGroupPenalty: 2,
    /** 벤치 7명: GK 1 + 수비/미드/공격 최소 2명씩 */
    bench: { GK: 1, DEF: 2, MID: 2, ATT: 2 },
    /** 은퇴 확률 (가상 선수, 시즌 종료 후 나이 기준): [이 나이부터, 확률]. 38세는 강제 */
    retireChance: [
      [33, 0.12],
      [35, 0.3],
      [37, 0.6],
    ] as [number, number][],
    /** 은퇴 자리 보충 가상 선수: 나이 min~max, 전성기 OVR = 팀 장기 평균 레이팅 + N(peakOffset, peakSd) */
    rookie: { minAge: 18, maxAge: 23, peakOffset: -1, peakSd: 3, minOvr: 45 },
    /**
     * 시즌 팀 컨디션: 2시즌째부터 리그 팀 레이팅 = 로스터 레이팅 + N(0, sd).
     * 로스터 레이팅만 쓰면 시즌 간 변동(σ 약 0.6)이 이전 방식(σ 약 1.7)보다 작아 약팀 돌풍이 줄어든다 (부록 C.8)
     */
    seasonFormSd: 1.5,
    /** 계약이 끝나면 재계약 1~4년 (이적은 5-4 단계) */
    renewYears: { min: 1, max: 4 },
  },

  // ── 골키퍼 (부록 E.9) ──
  goalkeeper: {
    /** GK OVR = 4능력치 가중 평균. 유형별 */
    ovrWeights: {
      classic: { shotStopping: 0.45, handling: 0.3, commandOfArea: 0.15, distribution: 0.1 },
      sweeper: { shotStopping: 0.4, handling: 0.2, commandOfArea: 0.2, distribution: 0.2 },
    },
    sweeperChance: 0.4,
    /** 능력치 생성: 목표 OVR + 가중치 높은 능력치일수록 높게 + N(0, sd) */
    attrSd: 4,
    /** GK 성장: 전성기 나이 27~31, 이 나이부터 하락 */
    peakAge: { min: 27, max: 31 },
    agingFrom: 32,
    /** 하락 시즌당 OVR (나이별): [이 나이부터, 하락] */
    aging: [
      [32, 1],
      [35, 2],
    ] as [number, number][],
    /** 필드 선수가 GK 를 볼 때 능력치 (부록 E.10) */
    fieldPlayerAsGk: { shotStopping: 20, handling: 20, commandOfArea: 30, distribution: 30 },
  },
} as const;

export type Balance = typeof BALANCE;
