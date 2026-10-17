// 밸런스 설정 (docs/game-design.md 부록 A)
// 모든 수치는 초기값이다. 이 파일만 고치면 게임에 반영된다.
// 세이브 필드 구조를 바꾸는 변경은 src/save.ts 의 SAVE_FORMAT_VERSION 을 올린다.

import type { FieldAttribute } from '../attributes';
import type { Tier } from '../types';

/** 수치를 바꾸면 올린다. 새 게임 시작 시 세이브에 기록된다. */
export const BALANCE_VERSION = 30;

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
     * 내 선수는 현재 실력 티어(skillTierCuts, OVR)의 구간을 쓴다 (6.2 성장 해금, 부록 C.23: 위상과 분리)
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
    ratingBase: 4.4,
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
    fromAchievementXp: 0.9, // C.22 1/2, 기획 1/4 → 부록 C.23 (새 컷·30세 목표에 맞춤, 아래 seasonGainMax 와 함께)
    /** 개인 기록 가산 (8.1, 부록 D.6 #3): MOM 1회당, 시즌 골+어시 per 개당 points, 시즌 합계 최대 max */
    personal: { perMom: 5, goalInvolvements: { per: 10, points: 10 }, max: 80 }, // C.22 5 / 25 / 200 → 부록 C.23
    /**
     * 한 시즌 위상 증가 상한 (업적 + 개인 기록, 배지 보너스 제외). 부록 C.23 신설: 업적 XP 는 시즌마다 0 / 100 / 200 처럼
     * 들쭉날쭉해서 한두 시즌 대박으로 월드클래스에 닿는 꼬리를 자른다. 900 에는 여러 시즌 압도해야 닿는다
     */
    seasonGainMax: 140, // C.23 110 → C.25 130 (부진·순위 감점만큼 30세 목표를 되돌림) → 부록 C.27 140 (MOM 8.3으로 줄어든 개인 기록 가산만큼)
    /** fromAge 세 이상 시즌의 위상 증가 상한 (부록 C.25 신설, C.27 30세부터). 전성기가 지난 뒤에는 쌓이는 속도를 줄여 35세 월드클래스를 줄인다 */
    lateSeasonGainMax: { fromAge: 30, max: 40 }, // C.25 31세 → 부록 C.27 (티어 하한으로 900 도달이 영구가 되어 30세 시즌 증가를 줄임)
    /** 시즌당 감소 비율 */
    seasonDecay: 0.02,
    /**
     * 부진 감점 (8.1, 부록 C.25): 출전 경기 평점이 기준(가장 최근 minApps 경기 이상 뛴 시즌의 내 평균 − belowAvg) 미만인 경기가
     * 연속되면 fromStreak 번째부터 그 경기 직후 위상의 perStep × (연속 − 1), 최대 maxShare 를 뺀다. 결장은 연속을 끊지도 늘리지도 않는다.
     * 기준 시즌이 없으면(첫 시즌) fallbackAvg − belowAvg. 사용자 제안의 절대 기준 7.0 은 빠른 경기 평점의 75~97% 가 미만이라 쓰지 않는다
     */
    slump: { belowAvg: 0.5, minApps: 10, fallbackAvg: 6.5, fromStreak: 2, perStep: 0.002, maxShare: 0.01 },
    /** 순위 감점 (8.1, 부록 C.25): 시즌 끝 순위가 시즌 전 팀 레이팅 순위보다 낮은 계단마다 위상의 perPlace, 최대 maxShare */
    rankDrop: { perPlace: 0.005, maxShare: 0.03 },
    /** 레드카드 감점 (8.1, 부록 C.27): 시즌 끝에 퇴장 1회당 위상의 perRed, 최대 maxShare */
    redCard: { perRed: 0.01, maxShare: 0.03 },
    /**
     * 출전 시간 부족 감점 (8.1, 부록 C.27): 시즌 리그 전체 시간 대비 출전 시간 비율이 minShare 미만이면
     * 모자란 step(10%p)마다 — 조금이라도 모자라면 1계단부터 — 위상의 perStep, 최대 maxShare. 부상 결장도 포함한다
     */
    minutesShort: { minShare: 0.5, step: 0.1, perStep: 0.01, maxShare: 0.04 },
    /**
     * 이적과 붙은 하락 이유 (D.19, 부록 C.42): 약팀 이적 = 새 팀 레이팅이 minGap 이상 낮으면 (차이 − minGap + 1) × perPoint, 최대 maxShare (임대 제외).
     * 벤치 장기화 = 출전 시간 비율 maxShare 미만 시즌이 seasons 시즌 연속이면 위상의 points (출전 부족 감점에 더해)
     */
    weakMove: { minGap: 3, perPoint: 0.01, maxShare: 0.05 },
    benchStreak: { seasons: 2, maxShare: 0.3, points: 0.03 },
    /**
     * 티어 하한 (8.1, 부록 C.27): 위상 점수는 지금 티어(스페셜/탑클래스/월드클래스) 컷 밑으로 내려가지 않는다.
     * 모든 감점(부진·순위·시즌 감소·레드·출전 부족)이 이 바닥을 따르고, 바닥에 막힌 감점은 사라진다
     */
    floorTiers: ['special', 'topClass', 'worldClass'] as Tier[],
    /** 레전더리 컷은 월드클래스와 같다. 점수만으로는 오르지 않고 아래 업적 조건도 채워야 한다 (8.1, 부록 C.23) */
    tierCuts: { normal: 0, special: 250, topClass: 550, worldClass: 900, legendary: 900 } satisfies Record<Tier, number>,
    /** 레전더리 조건: 발롱도르 ballonDorMin 회 이상 그리고 (트레블 또는 월드컵 우승 또는 발롱도르 ballonDorAlt 회 이상) */
    legendary: { ballonDorMin: 1, ballonDorAlt: 3 },
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

  // ── 평점 (B.4, C.26) ──
  rating: {
    /** 평점 = base + 활약 − 포지션 보정(동레이팅에서 기대하는 골·도움·클린시트 몫, positionCenter) */
    base: 6.5,
    /** 내 OVR − 상대 팀 레이팅 1점당. 0.03 → 0.02 (C.26: 실제 선수 ST 20골 안팎 시즌이 7.5~7.7 로 높아서) */
    perOvrDiff: 0.02,
    win: 0.4,
    draw: 0,
    loss: -0.4,
    /** 엔진과 같게 골 약 +1.0, 도움 약 +0.6 (C.26) */
    goal: 1.0,
    assist: 0.6,
    cleanSheetDefender: 0.4,
    /** 0.6 → 0.5 (C.26: 골·도움 가치를 올린 만큼 전체 σ 0.8 근처로) */
    randomSd: 0.5,
    min: 3.0,
    max: 10.0,
    /** MOM: 평점이 이 값 이상이고 지지 않았을 때 */
    momMin: 8.3, // 8.0 → 부록 C.27 (C.26 뒤 엔진 MOM 3.7% → 약 2%)
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

  // ── 캘린더 (25.1~25.2 6번, 부록 C.38): 2018-19 프리미어리그 패턴. 날짜는 [다음 해면 1, 월, 일] ──
  calendar: {
    /** 개막: 8월 n번째 토요일 (금요일 1경기 포함) */
    openingWeek: 2,
    /** 최종 라운드: 이 날짜(다음 해 5월)에 가장 가까운 토요일의 다음 날 일요일 (모든 경기 같은 날) */
    finalNear: [5, 12] as [number, number],
    /** A매치 휴식기: 이 날짜와 가장 가까운 토요일 주말은 리그 없음 */
    internationalBreaks: [[0, 9, 8], [0, 10, 13], [0, 11, 17], [1, 3, 23]] as [number, number, number][],
    /** 컵 주말 (FA컵, 5-6 에서 채운다): 리그 없음 */
    cupWeekends: [[1, 1, 5], [1, 1, 26], [1, 2, 16]] as [number, number, number][],
    /** 라운드가 38개를 넘으면 시드로 빼는 주말 후보 (FA컵 8강·4강 주말) */
    droppableWeekends: [[1, 3, 16], [1, 4, 13]] as [number, number, number][],
    /** 주중 라운드 기본 자리 (이 날짜 뒤 첫 화요일, 화·수에 나눠 치른다) */
    midweek: [[0, 12, 4], [1, 1, 29], [1, 2, 26], [1, 4, 2]] as [number, number, number][],
    /** 5번째 주중 라운드 후보 (시드로 하나) */
    extraMidweek: [[1, 4, 23], [0, 9, 25], [0, 10, 30]] as [number, number, number][],
    fifthMidweekChance: 0.5,
  },

  // ── 피로 (7.1) ──
  fatigue: {
    max: 100,
    /** 90분 출전 시 증가량 */
    perMatch90: 22,
    /**
     * 주간 회복량. 하루 단위 진행(부록 C.38)에서는 하루가 끝날 때마다 ÷ 7 씩 회복한다(경기 날 포함, 7일 간격이면 지금 주간 값과 같다).
     * 부상 중인 날은 noMatchWeekRecovery ÷ 7
     */
    weeklyRecovery: 25,
    noMatchWeekRecovery: 40,
    /** 이 값을 넘으면 평점/선발 확률 페널티 */
    penaltyFrom: 50,
    ratingPenaltyPerPoint: 0.02,
    startPenaltyPerPoint: 0.01,
  },

  // ── 훈련과 휴가 (25.3, 부록 C.41): 경기가 없는 날 훈련 1개. fatigue = 그날 피로 회복량 (+면 줄어듦) ──
  training: {
    kinds: {
      tech: { xp: 1.0, fatigue: 3.5 },
      intense: { xp: 1.5, fatigue: 2 },
      position: { xp: 0.5, fatigue: 4 },
      setpiece: { xp: 0.5, fatigue: 4 },
      video: { xp: 0.5, fatigue: 4.5 },
      recovery: { xp: 0, fatigue: 5.5 },
      rest: { xp: 0, fatigue: 6 },
    },
    /** 훈련 XP 주간(월~일) 상한. 재활 XP 도 여기에 든다. 고령 감쇠·난이도 배율은 상한 뒤에 곱한다 */
    weeklyXpCap: 6,
    /**
     * 경기 XP 배율 (25.3 "경기 XP × 0.8 + 훈련 XP ≈ 지금 시즌 XP"). 결장 경기 XP(옛 결장 주 훈련 XP 8)는 하루 훈련으로 바뀌어 0.
     * C.41 측정: 기본 계획 훈련 XP 시즌 약 125 + 게이지 능력치 시즌 약 1.8. 30세 OVR 무작위 레전더리(가드 79~83): 0.8 → 83.4, 0.75 → 83.1
     * → 0.7 (경기 XP 를 게이지 능력치만큼 더 줄인다)
     */
    matchXpScale: 0.7,
    /**
     * 기술 훈련 게이지: 하루 +per (× 고령 감쇠), full × 그 능력치 포인트 비용(6.2)이 차면 그 묶음에서 가장 낮은 능력치 +1.
     * 묶음당 시즌 bundleSeasonMax, 전체 시즌 seasonMax. C.41 측정: 비용·감쇠 없이 30 이면 고값 능력치가 공짜로 올라 99 능력치·노화 가드가 깨진다
     */
    gauge: { per: 1, full: 30, bundleSeasonMax: 2, seasonMax: 6 },
    /** 고강도 훈련 부상: 하루 chance (× 난이도 부상 배율), 경상 days 일 */
    intenseInjury: { chance: 0.003, days: [3, 10] as [number, number] },
    /** 포지션·역할 훈련: 전술 "내 위치" 숙련도 + (× 적응기·적성 배수), 역할 시그니처 해금 진행 + 경기 */
    positionProf: 0.5,
    roleApps: 0.1,
    /** 세트피스·카드 훈련: 덱에서 가장 덜 쓴 카드 숙련 진행 + 회 */
    cardMastery: 0.2,
    /** 영상 분석: 다음 경기 상대 힌트 최대 줄 수 */
    videoHintsMax: 3,
    /** 휴식 restStreak 일 연속(휴가 제외)이면 다음 경기 폼 −restFormPenalty (화면 한 단계 ≈ 0.1). 회복 훈련은 연속을 끊고 이 감점을 지운다 */
    restStreak: 4,
    restFormPenalty: 0.1,
    /** 부상 중 휴식: 회복 하루 + restHealBonus 일. 부상 중 기본은 재활(재활 XP 주 injury.rehabXp ÷ 7, 피로 fatigue.noMatchWeekRecovery ÷ 7) */
    restHealBonus: 0.5,
    /**
     * 휴가 (25.3 5번): 하루 피로 −fatigue, XP 0, 폼 저하 없음. A매치 휴식기 = 휴식기 주말을 사이에 둔 내 경기 두 개 사이에서
     * 앞 경기 afterMatch 일 뒤부터 다음 경기 beforeMatch 일 전까지. 비시즌은 개막 campDays 일 전 소집으로 끝난다
     */
    vacation: { fatigue: 6, afterMatch: 2, beforeMatch: 4, campDays: 7 },
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
    /**
     * 가상 선수 능력치 상한 (E.25 1번): 각 능력치 ≤ 자기 OVR + 이 값 (GK 는 GK 능력치끼리, 필드는 필드끼리).
     * 실제 주전이 있는 팀은 추가로 ≤ 그 팀 실제 선수의 같은 능력치 최대값. 깎인 만큼은 다른 능력치로 옮기지 않는다
     */
    virtualAttrOverOvr: 8,
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
    /** 계약이 끝나고 이적하지 않은 선수는 재계약 1~4년 (이적은 transfer, 18.6) */
    renewYears: { min: 1, max: 4 },
  },

  // ── 이적과 계약 (18.6 NPC 점수 모델, 18.10 내 선수, 부록 C.42). 수치는 모두 초안 ──
  transfer: {
    /** 이적시장 비중: 여름(비시즌) / 겨울(1월). 이적 의향 확률 × 비중이 그 이적시장의 이동 확률 */
    windowShare: { summer: 0.8, winter: 0.2 },
    /** push: 계약 만료(여름 +25, 겨울은 남은 반 시즌이라 그 절반), 출전 시간 비율 minutesShare 미만 +20, 야망 (OVR − 팀 레이팅) × 3 (0 아래로는 안 내려감), 순위 하위 +10, 31세 이상 +5 */
    push: { contract: 25, contractWinter: 12, minutes: 20, minutesShare: 0.4, ambition: 3, bottomFrom: 15, bottom: 10, veteranAge: 31, veteran: 5 },
    /** resist = 충성도 × loyalty + 소속 연수 × perYear (최대 yearsMax) */
    resist: { loyalty: 0.5, perYear: 2, yearsMax: 15 },
    /** 이적 의향 확률 = 시그모이드((점수 + N(0, noiseSd) − center) / scale) */
    noiseSd: 6,
    center: 20,
    scale: 10,
    /** 엔진 기록이 없을 때(빠른 경기) 출전 시간 비율 추정: 라인업 / 벤치 / 그 외 */
    estShare: { starter: 0.85, bench: 0.25, reserve: 0.05 },
    /**
     * 목적지 (18.6): 후보 = 레이팅 ≥ 기준 − minGap. 기준 = min(현재 팀 레이팅, OVR + refOverOvr) (벤치 선수가 더 강팀으로만 가지 않게).
     * 후보 점수 = (후보 레이팅 − 현재 팀 레이팅) + 포지션 필요도 × needWeight + N(0, noiseSd) − 수준 차 벌점(후보 > OVR + overOvr 이면 1당 overPenalty)
     * 상위 top 개 중 exp(점수 / temp) 가중 추첨. 리그 밖 클럽의 포지션 필요도는 outsideNeed
     */
    dest: { minGap: 2, refOverOvr: 2, needWeight: 5, noiseSd: 2, overOvr: 4, overPenalty: 2, top: 3, temp: 3, outsideNeed: 0.3, backupNeed: 0.4 },
    /** 리그 팀 시즌(여름+겨울) 영입 최대 */
    maxSignings: 2,
    /** 이적생 새 계약 1~5년, 새 충성도 = 기존 × keep + N(mean, sd) */
    newContract: { min: 1, max: 5 },
    newLoyalty: { keep: 0.5, mean: 30, sd: 10 },
    /** 빈자리 보충 (리그 밖 클럽에서 오는 가상 선수): OVR = min(나간 선수 OVR + N(offset, sd), 팀 레이팅 + overTeam), 나이 min~max */
    fill: { offset: -1, sd: 2, overTeam: 4, minAge: 21, maxAge: 29 },
    /**
     * 내 선수 (18.10): 비시즌 제안 3~5개 = 관심 상위. 관심 = −|유효 OVR − 팀 레이팅 − fitOffset| × fit + 필요도 × 5 + 위상 / repDiv + N(0, noiseSd).
     * 유효 OVR = OVR + (youthAge − 나이) × youthPerYear (어린 선수는 잠재력을 본다). 18.6 의 야망 항 (OVR − 팀 레이팅) × 3 을 팀 입장의 "수준 맞음"으로 뒤집었다
     */
    offers: { min: 3, max: 5, fit: 1.5, fitOffset: 1, youthAge: 22, youthPerYear: 1.5, needWeight: 5, repDiv: 40, noiseSd: 4 },
    /** 임대 (18.10): 21세 이하 + 출전 시간 비율 0.4 미만이면 임대 제안 1~2개 (예상 선발 확률이 가장 높은 팀), 1시즌 */
    loan: { maxAge: 21, maxShare: 0.4, offers: [1, 2] as [number, number] },
    /** 계약 기간: 나이별 [최소, 최대] (어릴수록 길게). 새 게임 가상 유망주는 newGameYears */
    years: [[21, 3, 5], [27, 2, 5], [30, 1, 4], [99, 1, 2]] as [number, number, number][],
    newGameYears: 3,
    /**
     * 이적 요청 (18.10, 신뢰도는 5-1): 선발 비율 또는 출전 시간 비율이 minShare 미만(내 팀 경기 minGames 이상 치른 뒤, 그 전이면 지난 시즌),
     * 또는 위상이 팀 수준을 넘을 때(내 위상 ≥ 팀 레이팅 위상 기준 + repOver, OVR ≥ 팀 레이팅 + ovrOver).
     * 놓아줄 확률 = base (계약 만료면 1) − 팀 내 OVR 1위면 topPenalty
     */
    request: { minShare: 0.4, minGames: 8, repOver: 100, ovrOver: 4, base: 0.7, topPenalty: 0.3 },
    /** 팀 레이팅 → 그 팀 주전에게 기대되는 위상 (이적 요청 "위상이 팀 격차를 넘음"), 앵커 사이 선형 */
    teamRep: [[66, 40], [70, 75], [75, 150], [80, 350], [85, 600]] as [number, number][],
    /** 주급 (19.11 곡선, 만 원): 위상 앵커 사이 로그 선형, ±15% (팀 레이팅 75 기준 1당 1.5%, OVR 75 기준 1당 1%), 50만 원 단위 */
    wageCurve: [[0, 500], [75, 1000], [150, 2000], [250, 3500], [350, 6000], [475, 9500], [600, 15000], [725, 19000], [850, 25000], [1000, 30000]] as [number, number][],
    wageTeam: 0.015,
    wageOvr: 0.01,
    wageSpread: 0.15,
  },

  // ── 포지션 전환 (4.3, 부록 D.3) ──
  proficiency: {
    /** 포지션 인접 관계 (LWB/RWB 는 LB/RB 와 같은 포지션으로 본다). 거리 = 최단 걸음 수 */
    edges: [
      ['ST', 'CF'], ['CF', 'CAM'], ['CF', 'LW'], ['CF', 'RW'], ['LW', 'LM'], ['RW', 'RM'], ['LM', 'CM'], ['RM', 'CM'],
      ['CAM', 'CM'], ['CM', 'CDM'], ['CDM', 'CB'], ['LB', 'LM'], ['RB', 'RM'], ['LB', 'CB'], ['RB', 'CB'],
    ] as [string, string][],
    /** 주 포지션 외 시작 숙련도 (C.39, pending 39 4번 ①: 거리 무관 0) */
    initial: 0,
    /** 선수 데이터의 서브 포지션 */
    subPosition: 70,
    /** 포지션 OVR 페널티 = 거리별 최대 페널티 × (1 − 숙련도/100) (C.39 ③): [거리 1, 2, 3 이상] */
    maxPenaltyByDistance: [6, 10, 14],
    /** 엔진 어댑터 환산 (proficientAttrs 가 (100 − x) × 0.25 를 뺀다): 그 값이 위 페널티와 같아지게 x 를 넘긴다 */
    enginePerPoint: 0.25,
    /** 출전 1경기(90분)당 숙련도 상승 × 출전 비율 × 적성 배수 (C.39 ②). 적성 1.0 기준 100까지 약 59경기 */
    gain: 2.25,
    /** 적응기: 그 포지션 출전 adaptGames 경기까지 상승량 × adaptMult */
    adaptGames: 20,
    adaptMult: 0.3,
    /** 감소 (C.39 ④): 그 포지션 연속 미출전 idleGames 경기부터 경기마다 −decay, 100을 찍은 포지션은 idleGamesPeak 경기부터. 주 포지션 없음, 하한 0 */
    idleGames: 5,
    idleGamesPeak: 10,
    decay: 1,
  },

  // ── 포지션 적성 (pending 31·36, 부록 C.37): 숨은 재능 타입, 포지션군 숙련도 상승 배수, 시작 후보, 포변 조언 ──
  aptitude: {
    /** 재능 타입 능력치 기울기: 기준 자리 OVR 에 안 들어가는 타입 능력치 + boost (가상 유망주, 기준 자리 OVR·성장 곡선은 그대로) */
    talentBoost: 8,
    /** 재능 타입이 맞는 포지션군의 숙련도 상승 배수 */
    matched: { min: 1.2, max: 1.5 },
    /** 엇갈린 숨은 재능 자리("차두리"): 확률, 배수 */
    hiddenChance: 0.3,
    hidden: { min: 1.4, max: 1.6 },
    /** 나머지 포지션군 */
    other: { min: 0.7, max: 1.0 },
    /** 실제 선수·옛 세이브 (pending 36 ④⑤): 주 포지션군, 나머지는 other. 엇갈림 없음 */
    realMain: { min: 1.2, max: 1.4 },
    /** 시작 후보 (pending 31 01:03 개정): 적합도 상위 top 개 포지션군 + 와일드카드 1 */
    candidates: {
      top: 3,
      /** 숨은 재능 자리가 상위 밖이면 와일드카드가 그 자리일 확률 */
      wildHidden: 0.5,
      /** 와일드카드를 고르는 적합도 순위 범위 (1부터, 숨은 재능이 아닐 때) */
      wildRanks: [4, 6] as [number, number],
    },
    /** 코치 한 줄 평의 적성 말투 경계: 배수 ≥ high 면 따뜻한 말투, < low 면 담담한 말투 */
    hintHigh: 1.3,
    hintLow: 1.0,
    /** 포변 조언 (pending 31 3번, 36 ①②⑥) */
    advice: {
      /**
       * 지금 주 포지션에서 seasons 시즌 연속 시즌 평균 평점이 ratingMax 이하 (선발 minStarts 경기 이상인 시즌만 = 주전으로 뛴 부진).
       * C.37 측정: 10대 교체 출전 시즌은 에이전트 엔진 평균 5.7이라 출전 수 기준이면 거의 모든 유망주가 18세에 조언을 받는다
       */
      ratingMax: 6.2,
      seasons: 2,
      minStarts: 15,
      /**
       * 같은 주 포지션(포지션군)에서 받는 조언 최대 수 (감독 한마디 → 뉴스). 조언 뒤 다음 조언은 그 뒤 시즌들로만 다시 판정한다
       * (겹치지 않는 2시즌). C.37 측정: 제한 없으면 커리어당 3.2회 → 목표 0~2회
       */
      maxPerPosition: 2,
      /** 조언이 살아 있는 기간: 시즌 종료 조언 → 비시즌 + 다음 시즌 소집일(개막 7일 전)부터 windowDays 일 (pending 36 ①, C.41: 4라운드 → 30일) */
      windowDays: 30,
      /** 조언 뒤 그 포지션군으로 포변하면 그 포지션군으로 뛴 boostGames 경기 동안 숙련도 상승 × boostMult */
      boostGames: 10,
      boostMult: 2,
    },
  },

  // ── 레전드 배지 (8.2, 부록 D.4): 부여 시 위상 + reputation ──
  badges: {
    reputation: 30, // C.22 100 → 부록 C.23
    careerGoals: 500,
    leagueTitles: 5,
    sameTeamSeasons: 10,
    /**
     * "한 팀 10시즌" 판정을 켤지 (부록 C.22). 이적(5-4단계)이 없는 지금은 모든 선수가 10시즌째에 자동으로 받아
     * 30세 위상이 약 +100 올라 회귀 가드(레전더리 위상 중앙값)가 깨진다. 이적이 생기면 켠다
     */
    oneClubEnabled: false,
  },

  // ── 경기 후 전술 리포트 판정 경계 (21.5.2, 부록 C.22). 실제 시즌 380경기 빈도로 조정. 경기 결과에는 영향 없음 ──
  tacticalReport: {
    counter: { okShare: 0.15, okMin: 3, badMax: 0 },
    gegenpress: { okMin: 25, okRatio: 1.5 },
    tikitaka: { okPoss: 60, okPassPct: 85, badPoss: 52 },
    direct: { okLongShare: 26, okLongPct: 62, badLongPct: 58 },
    block: { okOppOnMax: 5, okOppCentralMax: 6, badOppOn: 9 },
    common: { oppCounter: 4, possNoShots: 55, longShare: 30, offsides: 5, crosses: 15, crossPct: 20, pressWins: 24 },
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

  // ── 카드 (16.2, 부록 F.3·F.3.2·F.5, C.36) ──
  cards: {
    /** 덱 8~14장, 같은 카드 2장, 세트피스 3장 (F.3) */
    deckMin: 8,
    deckMax: 14,
    maxCopies: 2,
    maxSetPiece: 3,
    /** 덱 세트 (I.17 9번) */
    deckSets: 3,
    /** 시작 패, 드로우 간격(경기 시계 초), 성공 보너스 드로우 최대, 패 최대, 패시브 슬롯 (F.3) */
    startHand: 4,
    drawEvery: 900,
    bonusDraws: 3,
    handMax: 6,
    passiveSlots: 2,
    /** 한 행동에 붙는 카드 확률 보너스 합계 상한 (F.0 2번, E.15.1) */
    bonusCap: 0.15,
    /** 판정 능력치(judge)를 바꾸는 카드: 성공 확률 += judgeK × (판정 능력치 − 기본 판정 능력치)/100, ±judgeMax 안 */
    judgeK: 0.6,
    judgeMax: 0.1,
    /** 카드 숙련도 (F.3.2): 사용 횟수 [이상, %p] */
    mastery: [[5, 0.02], [15, 0.04], [30, 0.06]] as [number, number][],
    /** 성공/실패 판정 창 (초): 패스·크로스 도착, 슈팅 결과, 몰고 가기 */
    watchWindow: 4,
    /** 자동 경기 카드 기회 (F.5): "중요한 순간만"과 같은 중요도 임계값 배수 */
    autoStopMul: 1.0,
    /** 획득 (F.1 간이 경로): 레벨업 n레벨마다 일반 3택 1, 시즌 종료 희귀·에픽 3택 1, 역할 시그니처 해금 경기 수 */
    levelEvery: 5,
    pickOptions: 3,
    seasonEpicChance: 0.2,
    signatureUnlock: 10,
  },
  // ── 외모군 (pending 50, 부록 C.43): 가상 선수 외모군을 국적별 분포에서 뽑는다 (가중치). 기본 얼굴 이미지 매니페스트(public/faces/base)와 같은 이름을 쓴다.
  // 최종 외모군 목록은 사용자가 주는 이미지 설정값에 맞춘다. 추첨은 선수 id 로 따로 만든 난수라 기존 시드 결과를 바꾸지 않는다
  appearance: {
    byNationality: {
      England: { white: 68, black: 26, latinMideast: 4, eastAsian: 2 },
      Scotland: { white: 88, irish: 8, black: 4 },
      'Republic of Ireland': { irish: 70, white: 25, black: 5 },
      'Northern Ireland': { irish: 50, white: 48, black: 2 },
      Wales: { white: 88, irish: 6, black: 6 },
      France: { white: 45, black: 40, latinMideast: 15 },
      Spain: { latinMideast: 55, white: 43, black: 2 },
      Portugal: { latinMideast: 55, white: 35, black: 10 },
      Germany: { white: 80, black: 10, latinMideast: 10 },
      Netherlands: { white: 65, black: 30, latinMideast: 5 },
      Belgium: { white: 60, black: 35, latinMideast: 5 },
      Brazil: { latinMideast: 55, black: 30, white: 15 },
      Argentina: { latinMideast: 60, white: 40 },
      Uruguay: { latinMideast: 60, white: 40 },
      Senegal: { black: 100 },
      Nigeria: { black: 100 },
      Egypt: { latinMideast: 95, black: 5 },
      Gabon: { black: 100 },
      Denmark: { white: 92, black: 5, latinMideast: 3 },
      Norway: { white: 92, black: 5, latinMideast: 3 },
      'Korea Republic': { eastAsian: 100 },
      Japan: { eastAsian: 100 },
      China: { eastAsian: 100 },
    } as Record<string, Partial<Record<'eastAsian' | 'white' | 'irish' | 'black' | 'latinMideast', number>>>,
    /** 표에 없는 국적 */
    fallback: { white: 50, black: 25, latinMideast: 20, eastAsian: 5 } as Partial<Record<'eastAsian' | 'white' | 'irish' | 'black' | 'latinMideast', number>>,
  },
} as const;

export type Balance = typeof BALANCE;
