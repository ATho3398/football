// 밸런스 설정 (docs/game-design.md 부록 A)
// 모든 수치는 초기값이다. 이 파일만 고치면 게임에 반영된다.
// 세이브 필드 구조를 바꾸는 변경은 src/save.ts 의 SAVE_FORMAT_VERSION 을 올린다.

import type { FieldAttribute } from '../attributes';
import type { Tier } from '../types';

/** 수치를 바꾸면 올린다. 새 게임 시작 시 세이브에 기록된다. */
export const BALANCE_VERSION = 49;

export type Difficulty = 'easy' | 'normal' | 'hard';

export const BALANCE = {
  // ── 성장 (5.1, 6.2, B.5) ──
  growth: {
    xpPerLevel: 200,
    /** OVR 연동 XP 요구량 (5.1, 부록 D.6 #2): 필요 XP = xpPerLevel × (1 + max(0, OVR - fromOvr) × perOvr) */
    xpByOvr: { fromOvr: 80, perOvr: 0.06 }, // 기획서 0.04, 부록 C.6
    /** 레벨업 포인트 (C.49 pending 80: 5 → 1). 포인트 1개 = 찍기 한 번 = 1~20 화면 +1칸 = 내부 +pointStep */
    pointsPerLevel: 1,
    pointStep: 5,
    maxAttribute: 99,
    /**
     * 비용 구간 (내부 값): 현재 값이 cost1Max 이하면 1, cost2Max 이하면 2, 그 위는 3.
     * 포인트 찍기(C.49)는 화면 값 기준: 지금 칸(1~20)이 화면(cost1Max) 이하면 1P, 화면(cost2Max) 이하면 2P, 그 위는 3P (고값 추가 비용 없음).
     * 훈련 게이지는 내부 값 기준 그대로 (BALANCE.training.gauge.highValueCost 포함).
     * 내 선수는 현재 실력 티어(skillTierCuts, OVR)의 구간을 쓴다 (6.2 성장 해금, 부록 C.23: 위상과 분리)
     */
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
    // C.49: 포인트 고값 비용(4/6/9)이 없어져 고령 회복이 싸진 만큼 31세부터 당김 (30세 그대로, 30→36세 노화 가드 맞춤). 이전 32 0.6 · 34 0.45 · 36 0.3
    veteranMultiplier: [
      [30, 0.75],
      [31, 0.55],
      [33, 0.4],
      [35, 0.25],
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
      [38, 5],
      [41, 7],
    ] as [number, number][],
    /** 기술/수비/멘탈 */
    other: [
      [33, 0.5],
      [35, 1],
      [37, 2],
      [38, 3],
      [41, 4],
    ] as [number, number][],
    /**
     * 노화를 포지션 OVR 에 중요한 능력치에 몰아주는 정도 (0 = 고르게, 1 = OVR 비중에 정비례).
     * 능력치별 배율 = (1 - s) + s × (OVR 비중 / 25개 평균 비중). 평균 배율이 1이라 총 하락량은 그대로다.
     * 고르게 깎으면 포인트를 OVR 능력치에만 찍는 선수는 30대에도 OVR 이 떨어지지 않는다 (부록 D.0 점검)
     */
    positionFocus: 0.8,
    /**
     * 38세부터 (pending 48 1, C.45 — 내 선수 강제 은퇴 삭제 뒤): 포지션 몰아주기를 lateFocus 로 낮춰 골고루 깎이고,
     * 체력·속도 계열(lateExtra)은 추가 배율. NPC 는 38세에 은퇴하므로 영향 없음
     */
    lateFrom: 38,
    lateFocus: 0.3,
    lateExtra: { stamina: 1.5, pace: 1.5, acceleration: 1.5 } as Partial<Record<FieldAttribute, number>>,
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
  // 내 선수는 30세부터 [은퇴] 가능, 강제 은퇴 없음 (pending 48 1, C.45). forcedAge 는 NPC(실제·가상) 은퇴 나이
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
      // C.44: 경기 다음 날 휴식 고정 → 기본 주(경기 1개) 기술 훈련 3일 → 4일. 주 합계를 C.43 과 같게 (XP 3.5, 피로 회복 26.5, 게이지 칸 비율):
      // xp 1.0 → 0.75, fatigue 3.5 → 4.0, gauge.full 30 → 40
      tech: { xp: 0.75, fatigue: 4.0 },
      intense: { xp: 1.5, fatigue: 2 },
      position: { xp: 0.5, fatigue: 4 },
      setpiece: { xp: 0.5, fatigue: 4 },
      video: { xp: 0.5, fatigue: 4.5 },
      recovery: { xp: 0, fatigue: 5.5 },
      rest: { xp: 0, fatigue: 6 },
      /** 약발 훈련 (C.45): 기술 훈련과 같은 XP·회복, 게이지는 BALANCE.weakFoot */
      weakFoot: { xp: 0.75, fatigue: 4.0 },
      // 생활 하루 행동 (pending 47 4번, C.63 b): 훈련 대신. XP 없음, 회복은 휴식~회복 훈련 사이. 효과는 BALANCE.life.actions
      family: { xp: 0, fatigue: 5 },
      language: { xp: 0, fatigue: 4.5 },
      teamMeal: { xp: 0, fatigue: 4.5 },
      therapy: { xp: 0, fatigue: 5 },
      trip: { xp: 0, fatigue: 6 },
      media: { xp: 0, fatigue: 4 },
    },
    /**
     * 훈련 프리셋 자동 추천 (C.52, pending 82 6번): 주가 바뀔 때(월요일) 이번 주 경기 수·경기 간격·체력(100 − 피로)·부상으로 고른다.
     * 부상 중 → 회복 중심, 경기 2번 이상 또는 경기 간격 busyGap 일 이하 → 경기 많은 주, 체력 lowCondition 미만 → 회복 중심,
     * 경기 1번 이하이고 체력 freshCondition 이상 → 기술 집중, 그 밖 → 균형
     */
    presets: { lowCondition: 65, freshCondition: 85, busyGap: 3 },
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
    gauge: {
      per: 1, full: 40, bundleSeasonMax: 2, seasonMax: 6,
      /** 고값 게이지 배수 (6.2·D.6 #1 의 고값 비용, C.49부터 훈련 게이지에만): [현재 값이 이 값 이상, 배수]. 배수 = max(구간 비용, 이 값) */
      highValueCost: [
        [93, 4],
        [96, 6],
        [98, 9],
      ] as [number, number][],
    },
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

  // ── 더비 (C.44 pending 52 5번): 5-2 라이벌 이벤트·큰 경기 배율 훅. 지금은 모두 1 (경기·성장 영향 없음) ──
  derby: {
    /** 더비 경기 위상·XP 배율 (5-2에서 정한다) */
    reputation: 1,
    xp: 1,
    /** 큰 더비 추가 배율 */
    bigReputation: 1,
    bigXp: 1,
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
    offers: {
      min: 3, max: 5, fit: 1.5, fitOffset: 1, youthAge: 22, youthPerYear: 1.5, needWeight: 5, repDiv: 40, noiseSd: 4,
      /**
       * 남은 계약별 제안 수 (C.48, pending 78): 만료·마지막 해(남은 0~1시즌) / 1년 더 남음(2시즌) / 2년 이상 더 남음(3시즌 이상).
       * 2년 이상이면 지금 팀보다 전력이 높은 구단만 (감당 가능 판정 C.46 은 그대로). 이적 명단(요청 수락)이면 그 시즌 창은 last
       */
      byYears: { last: [3, 5], one: [1, 3], more: [0, 2] } as Record<'last' | 'one' | 'more', [number, number]>,
      /**
       * 소속 구단 수락 판정 (C.48): 이적료 = 몸값 × U(feeMin, feeMax) (남은 영입 예산까지), 수락 확률 = base + (이적료/몸값 − 1) × slope
       * − (팀 OVR 상위 3이면 top3), [minP, 1]. 바이아웃 이상이면 거절 불가. 계약 만료(몸값 0)·이적 명단·임대는 판정 없음
       */
      club: { feeMin: 0.8, feeMax: 1.5, base: 0.55, slope: 1.2, top3: 0.3, minP: 0.05 },
      /** 바이아웃 = 계약할 때 몸값(그 계약 연수 기준) × buyoutMul */
      buyoutMul: 1.8,
    },
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
  // ── 신체·양발 (pending 47 1, 부록 C.45): 키·몸무게·주발·약발. 생성 분포와 엔진 실행 배율 (판단 구조는 그대로) ──
  body: {
    /** 포지션군별 키 평균·표준편차 (cm)와 BMI 평균. CB·ST·GK 크고 윙·공미 작다 */
    byGroup: {
      GK: { height: 189, sd: 4, bmi: 23.6 },
      CB: { height: 187, sd: 4, bmi: 23.8 },
      FB: { height: 178, sd: 4.5, bmi: 22.9 },
      CDM: { height: 181, sd: 5, bmi: 23.2 },
      CM: { height: 179, sd: 5, bmi: 22.9 },
      CAM: { height: 176, sd: 5, bmi: 22.6 },
      WING: { height: 176, sd: 5, bmi: 22.6 },
      ST: { height: 183, sd: 6, bmi: 23.5 },
    },
    bmiSd: 1.0,
    heightMin: 160,
    heightMax: 205,
    /** 왼발잡이 비율 (포지션별, 나머지는 other) */
    leftFoot: { LB: 0.65, LWB: 0.65, LM: 0.5, LW: 0.35, RW: 0.35, RB: 0.06, RWB: 0.06, RM: 0.1, other: 0.2 } as Record<string, number>,
    /** 약발 1~5 생성 가중치 (주발은 늘 5) */
    weakFootOdds: [3, 22, 50, 20, 5] as readonly number[],
    /** 약발로 찬 공의 정확도 배율 (약발 1 ×0.75 … 5 ×1.0) */
    weakFootMul: [0.75, 0.8125, 0.875, 0.9375, 1] as readonly number[],
    /**
     * 약발로 차야 하는 정도: 찬 방향의 좌우 성분(공격 방향 기준 sin) |lat| 이 weakFrom 이하면 아무 발이나(0),
     * weakFull 이상이면 완전히 약발(1). 오른쪽으로 보내는 공 = 왼발, 왼쪽으로 = 오른발
     */
    weakFrom: 0.25,
    weakFull: 0.75,
    /** 패스는 거리로도 섞는다: passFrom m 이하 짧은 패스는 몸을 돌려 차므로 0, passFull m 이상은 전부 (C.45 첫 측정: 짧은 옆 패스까지 걸면 패스 성공률 −3%p) */
    passFrom: 12,
    passFull: 30,
    /** 키 기준 (cm)과 공중볼 점수(헤더 0.5 + 점프 0.3 + 근력 0.2 척도) cm 당 보정, 한도 */
    refHeight: 181,
    aerialPerCm: 0.25,
    aerialMax: 5,
    /** GK 리치 (기준 188 cm): 공중볼 잡기 확률·선방 확률 cm 당 */
    gkRefHeight: 188,
    gkClaimPerCm: 0.004,
    gkSavePerCm: 0.0015,
    gkReachMax: 0.04,
    /** 몸무게 (BMI 기준 23): 몸싸움(근력) 점수 BMI 1 당 +, 가속·민첩 BMI 1 당 − (작게) */
    refBmi: 23,
    strengthPerBmi: 1.0,
    strengthMax: 3,
    quicknessPerBmi: 1.0,
    quicknessMax: 3,
    /** 커스텀 생성: 키가 기준보다 크면 속도·가속·민첩 상한 cm 당 −, 헤더·점프 상한 cm 당 + */
    custom: { speedCapBase: 75, speedCapPerCm: 0.8, aerialCapBase: 70, aerialCapPerCm: 0.6, capMin: 55, capMax: 85 },
  },

  // ── 약발 강화 (pending 47 1, C.45): 포인트로 +1 (내부 포인트 cost), 하루 훈련 "약발 훈련" 게이지 (시즌 최대 +1) ──
  weakFoot: {
    pointCost: 10, // C.49: 50 → 10 (포인트 ÷ 5)
    /** 약발 훈련 하루 게이지 +1, 다 차면 약발 +1 (시즌 최대 seasonMax) */
    trainingGauge: 30,
    seasonMax: 1,
  },

  // ── 태그 (pending 47 2·62.4·66, C.45): 생성 때 고르는 장단점과 플레이로 얻는 커리어 태그를 하나로. 효과·비용·해제 조건 ──
  tags: {
    maxPro: 2,
    maxCon: 3,
    /**
     * 생성 비용 기준값 (장점 −, 단점 +). 영구 × permMul, 해제형 × removableMul (반올림). 생성 전용 태그는 늘 영구.
     * C.45 1차(장단점 20종)의 영구 값과 비슷하게 기준값을 잡았다
     */
    cost: {
      // C.49: 커스텀 칸 비용 2/3/4 → 1/2/3 에 맞춰 C.45 값 × 약 0.58 (같은 시작 OVR 이 되는 배분 포인트 비율)
      glass: 8, ironMan: 8, troublemaker: 4, rollercoaster: 6, consistent: 6, slowRecovery: 6, resilient: 6, professional: 9,
      managerSensitive: 2, poorNegotiator: 2, homesick: 2, mediaShy: 2, weakFootOne: 6, starQuality: 4, linguist: 2, leader: 2, twoFooted: 8,
    } as Record<string, number>,
    permMul: 1.5,
    removableMul: 0.6,
    /** 랜덤 생성 태그 수 0·1·2개 확률, 해제형으로 붙을 확률 */
    randomCountOdds: [0.4, 0.4, 0.2] as readonly number[],
    randomRemovable: 0.5,
    /** 원클럽맨·영원한 <구단>: 첫 성인 구단에서 재계약 renewals 번 이상 또는 seasons 시즌 이상 (이적하면 떨어진다, 임대는 이적 아님) */
    oneClub: { renewals: 3, seasons: 8 },
    /** NPC 유스 출신: 생성 선수가 지금 구단 유스 출신일 확률 (아니면 리그 밖 포함 랜덤 구단) */
    npcOwnYouth: 0.2,
    effects: {
      glassInjury: 1.5,
      ironManInjury: 0.6,
      rollercoasterForm: 1.5,
      consistentForm: 0.7,
      slowRecovery: 0.8,
      resilient: 1.2,
      professionalXp: 1.1,
      starWage: 1.1,
      troublemakerCards: 1.4,
      /** 노익장 (플레이 전용, C.47 pending 67 20:55 확정): 노화 하락 ×0.7 (30~34세 절감 21.2 > 늦게 핀 꽃 15.5) */
      evergreenAging: 0.7,
      bigGameForm: 0.1,
      twoFootedStart: 4,
      weakFootOneStart: 1,
    },
    /**
     * 커리어 태그 효과 (pending 64, C.47): 그 구단에 있을 때만 켜진다 (이적하면 꺼짐). 영원한 <구단> = 원클럽맨 × eternalMul.
     * 선발 경쟁·이적 점수는 OVR·점수 단위, 재계약은 확률(%p)·연봉 여유 비율
     */
    story: {
      /** 원클럽맨: 재계약 판정 실패를 뒤집을 확률, 연봉 여력이 이만큼 모자라도 받아 줌, 선발 경쟁 OVR +, 다른 포지션 숙련도 상승 ×, NPC 이적 점수 − */
      oneClubRenew: 0.15,
      oneClubWage: 0.05,
      oneClubStart: 2,
      oneClubProf: 1.15,
      oneClubNpcResist: 8,
      eternalMul: 1.5,
      /** 영원한 <구단>: 시즌 위상 증가 × (팬 인기 = 위상) */
      eternalRep: 1.03,
      /** 아카데미 출신: 그 구단 숙련도 적응기 없음, 선발 경쟁 OVR + */
      academyStart: 1,
      /** 친정 선택: 시즌 위상 증가 × */
      homeChoiceRep: 1.015,
      /** 무한한 충성심: 돌아온 첫 시즌 적응기 없음, 첫 loyalGames 경기 폼 + */
      loyalForm: 0.1,
      loyalGames: 10,
      /** 방출의 설움: 방출한 구단 상대 폼 +, 계약 뒤 첫 releasedSeasons 시즌 경기 XP × */
      releasedForm: 0.1,
      releasedXp: 1.05,
      releasedSeasons: 2,
    },
    /** 노익장 판정 (30세 이후): 시즌 평점 rating 이상 또는 OVR ovr 이상 유지(지난 시즌 대비 −keep 이내). 2시즌 연속 평점 dropBelow 미만이면 해제 */
    evergreen: { fromAge: 30, rating: 7.0, ovr: 80, keep: 1, dropBelow: 6.5, dropSeasons: 2, minApps: 10 },
    /**
     * 늦게 핀 꽃 판정 (차두리형): 한 포지션군 oldSeasons 시즌 이상 뒤 전환 → 새 포지션 첫 window 시즌 안에 시즌 평점 ≥ 옛 평균 + rating
     * 또는 새 포지션 OVR ≥ 옛 OVR + ovr. 효과: 신체·기술멘탈 각각 첫 노화 1회 면제
     */
    lateBloomer: { oldSeasons: 3, window: 2, rating: 0.3, ovr: 3, minApps: 10 },
    /** 플레이 중 자연 발생 태그 (pending 65, C.47): 붙는 조건과 효과 (효과는 미미하게) */
    natural: {
      /** 스타 플레이어: 위상 starRep 이상 + 시즌 평점 starRating 이상 2시즌 연속, 2시즌 연속 starDrop 미만이면 해제. 제안 연봉 × */
      starRep: 700, starRating: 7.3, starDrop: 6.8, starPlayerWage: 1.1,
      /** 원더키드: 이 나이 이하, 시즌 평점 또는 골·도움 (출전 minApps 이상). 제안 연봉 × */
      wonderAge: 20, wonderRating: 7.2, wonderPoints: 10, wonderkidWage: 1.05,
      /** 빅매치 체질: 더비·상위 bigTop 팀 상대 통산 bigApps 경기 이상, 평균 평점이 평소 + bigDiff 이상 (bigKeep 아래면 해제) */
      bigTop: 6, bigApps: 10, bigDiff: 0.4, bigKeep: 0.2,
      derbyGoals: 5, derbyHeroForm: 0.05,
      superSubGoals: 5, superSubKeep: 2, superSubForm: 0.1,
      lateMinute: 80, lateGoals: 5,
      recordRep: 10, cleanSheets: 15, cleanSheetMinutes: 60,
      /** 철인: 리그 전 경기 또는 ironMinutes 분 이상 2시즌 연속, ironDrop 분 미만 시즌이면 해제 */
      ironMinutes: 3000, ironDrop: 2000, everPresentRecovery: 1.05,
      /** 유리몸 (플레이 획득): 2시즌 안 부상 glassInjuries 회 이상 또는 결장 glassDays 일 이상 */
      glassInjuries: 3, glassDays: 60,
      /** 플레이로 얻은 둘 다 태그의 효과 (pending 65 값, 생성 태그는 C.45 값 그대로) */
      playGlass: 1.1, playConsistent: 0.8, playRoller: 1.2, playTrouble: 1.15,
      /** 꾸준함 / 롤러코스터: 20경기 이상 시즌 평점 표준편차가 이 값 이하 / 이상 */
      consistentSd: 0.45, rollerSd: 1.0, sdApps: 20,
      /** 문제아: 시즌 경고 / 퇴장 */
      troubleYellows: 10, troubleReds: 2,
      /** 신사: gentleSeasons 시즌 연속 경고 gentleYellows 이하·퇴장 0 (20경기 이상), 경고 확률 × */
      gentleSeasons: 3, gentleYellows: 3, gentleDrop: 6, gentlemanCards: 0.8,
      exClubGoals: 3, exClubForm: 0.05,
      journeyClubs: 5, journeyAdapt: 0.7,
      cultSeasons: 3, cultHeroRep: 1.01,
      traitorForm: 0.1,
    },
  },

  // ── 레전드 팩 (pending 63, C.47): 2018-19 세계에 15~22세로. 시작 OVR = 전성기 OVR − startGap(나이), 전성기 나이 peakAge ──
  legends: {
    minAge: 15,
    maxAge: 22,
    /** [이 나이부터, 전성기까지 모자란 OVR]. 전성기 나이 29 에 닿도록 (NPC 성장 곡선 approach 1, 시즌 최대 +4) */
    startGap: [[15, 34], [16, 31], [17, 28], [18, 25], [19, 21], [20, 18], [21, 15], [22, 12]] as [number, number][],
    peakAge: 29,
    gkPeakAge: 30,
    /** 시작 능력치 역산: 능력치 묶음별 모자람 배율 (멘탈은 어릴수록 더 낮다) */
    gapMul: { mental: 1.4, physical: 1.1, other: 0.85 },
    /** 게임에 없는 유스 구단: 수준(lv)이 가까운 PL 팀 near 곳 중 시드로 */
    near: 8,
    /**
     * 전성기 OVR = 데이터 능력치 포지션 OVR + peakBonus, [minPeak, maxPeak]. 실제 선수 데이터도 중심값(메시 87·호날두 90)보다 NPC 전성기(레전더리 89~96)가 높은 것과 맞춘다.
     * 포지션 OVR 식이 낮게 보는 중앙 미드필더 레전드는 하한으로 (모자란 만큼은 성장이 OVR 가중 능력치로 채운다)
     */
    peakBonus: 4,
    minPeak: 88,
    maxPeak: 96,
    loyalty: 70,
  },

  // ── 커스텀 생성 (pending 47 2·49 1, C.45): 모든 능력치 base 에서 시작, 배분 포인트를 나눈다. 한 칸(1~20 표시 1칸 = 내부 5)씩, 비용은 칸당 (구간별) ──
  custom: {
    base: 40,
    /** C.49: 칸 비용 2/3/4 → 1/2/3, 같은 시작 OVR 이 되게 100 → 58 (자동 배분 평균 57.4) */
    points: 58,
    /** 칸(내부 5) 비용: [지금 내부 값이 이 값 미만이면, 비용] */
    step: 5,
    costBands: [[55, 1], [65, 2], [100, 3]] as [number, number][],
    /** 능력치 상한 (키 상한은 BALANCE.body.custom) */
    cap: 75,
    /** 나이 15~23: 17세 기준, 1살당 배분 포인트 (나이가 많을수록 +). C.45 측정(일반 잠재력 30세 OVR 이 나이와 상관없이 74~75): 21/살, 어리면 −3/살 → C.49 13/살, −2/살 (나이별 시작 OVR 동일) */
    minAge: 15,
    maxAge: 23,
    refAge: 17,
    pointsPerYear: 13,
    /** 17세보다 어리면 1살당 (− 포인트) */
    pointsPerYearYounger: 2,
    heightMin: 165,
    heightMax: 200,
    bmiMin: 19.5,
    bmiMax: 27,
    /** 약발 선택 포인트 (3 기준, 높으면 −, 낮으면 +). 커스텀에서는 양발잡이·약발 1 장단점 대신 이 값으로 고른다 */
    weakFootPoints: [6, 3, 0, -7, -15] as readonly number[], // C.49: × 0.58
  },

  // ── 시작 소속·1군 테스트·재계약 판정 (pending 61·62, C.45 10·12번). 유스 시스템은 없고 유스는 서사 ──
  startClub: {
    /** 이 나이 이하 + 유스 구단 선택 = 시즌 첫 리그 경기 테스트 (그 위는 스탯 맞는 팀 목록에서 바로 계약) */
    trialMaxAge: 18,
    /** 테스트 경기 수: 기본 3, 판정이 애매하면 최대 5 */
    trialGames: 3,
    trialMaxGames: 5,
    /** 아주 좋음: 평균 평점 이상, 또는 공격포인트·득점 이상 */
    greatRating: 7.0,
    greatPoints: 3,
    greatGoals: 2,
    /** 아주 나쁨: 평균 평점 미만이고 공격포인트 0 */
    badRating: 6.0,
    /** 판정 점수 = (평균 평점 − pivot) + statWeight × (유효 OVR + 유스 완화 − 팀 레이팅). passScore 이상 통과, failScore 이하 방출 */
    pivot: 6.5,
    statWeight: 0.03,
    passScore: 0.5,
    failScore: -0.5,
    /** 자기 유스 출신 완화 (OVR 상당) */
    youthRelief: 5,
    /** 재계약 판정은 C.46 부터 BALANCE.finance.renew (모든 선수, 재정·로스터 기준) */
    /** 테스트·방출 뒤 영입 제안 수 [최소, 최대] (자유계약이라 이적시장 밖이어도) */
    freeOffers: [3, 4] as [number, number],
    /** 합격 뒤 다른 팀 경쟁 제안 [최소, 최대]와 유스 구단 연봉 = 다른 제안 평균 × [하한, 상한] (돈 vs 친정) */
    rivalOffers: [2, 3] as [number, number],
    youthWage: [0.75, 0.9] as [number, number],
    /** 다른 팀 연봉 가산: 하위권일수록 (순위 비율 × 이 값) */
    rivalWageBoost: 0.25,
    /** 19세 이상 소속팀 선택 목록 수 */
    fitTeams: 6,
    /** 원클럽맨 태그: 한 구단 시즌 수 */
    oneClubSeasons: 10,
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
  // ── 도트 선수 아이콘 (부록 C.45, docs/design/pixel-kits.md 3·4번): 경기 화면 캐릭터 보기의 인물(피부·머리)과 유니폼 충돌 규칙.
  // 겉모습만이라 경기 결과·시드에 영향이 없다. 추첨은 `pixel:<선수 id>` 시드의 별도 난수
  pixelLook: {
    /** 외모군 → 피부 분포 (가중치) */
    skin: {
      eastAsian: { yellow: 100 },
      white: { white: 100 },
      irish: { white: 100 },
      black: { black: 100 },
      latinMideast: { mideast: 70, white: 30 },
    } as Record<'eastAsian' | 'white' | 'irish' | 'black' | 'latinMideast', Record<string, number>>,
    /** 외모군 → 피부별 머리 분포 (가중치). 피부가 표에 없으면 hairBySkin */
    hair: {
      eastAsian: { yellow: { black: 85, brown: 10, bald: 3, blonde: 2 } },
      white: { white: { brown: 45, blonde: 25, black: 22, bald: 8 } },
      irish: { white: { brown: 50, blonde: 40, black: 5, bald: 5 } }, // blonde = 붉은 머리 대용
      black: { black: { black: 88, bald: 10, blonde: 2 } },
      latinMideast: { mideast: { black: 75, brown: 18, bald: 7 }, white: { black: 50, brown: 45, bald: 5 } },
    } as Record<'eastAsian' | 'white' | 'irish' | 'black' | 'latinMideast', Record<string, Record<string, number>>>,
    /** 외모군을 모를 때 피부별 머리 분포 */
    hairBySkin: {
      yellow: { black: 85, brown: 10, bald: 3, blonde: 2 },
      white: { brown: 45, blonde: 25, black: 22, bald: 8 },
      black: { black: 88, bald: 10, blonde: 2 },
      mideast: { black: 75, brown: 18, bald: 7 },
    } as Record<string, Record<string, number>>,
    /** 없는 조합 대체 (3.3): `피부_머리` → 머리. 그 밖에는 같은 피부의 첫 머리 */
    missing: { black_brown: 'black', mideast_blonde: 'brown' } as Record<string, string>,
    /** 유니폼 충돌 기준: 몸통 평균색 RGB 거리가 이보다 가까우면 겹친다 (4번) */
    clashDistance: 120,
    /** 경기 화면 kitClash (C.54 디자인 139): 두 팀 몸통 색 중 가장 가까운 두 색의 RGB 거리가 이보다 작으면 원정 몸통에 주황 테두리 */
    clashBody: 48,
    /** GK 단색 순서: 초록 → 노랑 → 주황 → 보라 → 검정 → 하늘 */
    gkOrder: ['C07', 'C06', 'C09', 'C10', 'C05', 'C04'] as string[],
    /** 표에 없는 국가·구단이고 색도 모를 때 */
    fallbackKit: { home: 'C02', away: 'C05' },
  },

  // ── 리그별 로스터 인원 (pending 62.1, 부록 C.46). 6개 리그 표를 모두 두고 지금은 PL 만 쓴다 ──
  squad: {
    /**
     * 리그 규칙 (2018-19 기준, 부록 C.46 출처): 게임 최소·최대(21세 초과 등록 상한), 21세 이하 추가 인원, 비자국 육성 상한.
     * 분데스리가·리그 1 은 공식 상한이 없어 게임 상한 30. 조건 칸은 지금 PL 의 비자국 육성만 쓴다 (나머지는 6단계)
     */
    leagues: {
      pl: { min: 18, max: 25, u21Extra: 5, nonHomegrownMax: 17 },
      championship: { min: 18, max: 25, u21Extra: 5, nonHomegrownMax: 99 },
      laliga: { min: 18, max: 25, u21Extra: 0, nonHomegrownMax: 99 },
      seriea: { min: 18, max: 25, u21Extra: 5, nonHomegrownMax: 99 },
      bundesliga: { min: 18, max: 30, u21Extra: 0, nonHomegrownMax: 99 },
      ligue1: { min: 18, max: 30, u21Extra: 0, nonHomegrownMax: 99 },
    } as Record<'pl' | 'championship' | 'laliga' | 'seriea' | 'bundesliga' | 'ligue1', { min: number; max: number; u21Extra: number; nonHomegrownMax: number }>,
    /** 21세 이하 = 그 시즌 나이 ≤ u21Age (2018-19 PL 은 1997-01-01 이후 출생) */
    u21Age: 21,
    /** 시즌 시작 생성: 기본 24명(23번 포지션 구성) + 21세 이하 유망주 extraU21 [최소, 최대] → 24~27, 평균 25.5 */
    extraU21: [0, 3] as [number, number],
    extraAge: [17, 20] as [number, number],
    /** 21세 이하 추가 유망주 OVR = 팀 레이팅 + offset + N(0, sd) */
    extraOffset: -16, extraSd: 3,
    /** 이적: 나간 뒤 인원이 fillBelow 아래면 빈자리 보충, 들어온 뒤 softMax 를 넘으면 가장 낮은 순위 선수를 내보낸다 */
    fillBelow: 25,
    softMax: 27,
    /** 자국 육성 국적 (육성 이력 근사: 이 국적 또는 잉글랜드·웨일스 구단 유스 출신) */
    homegrownNations: ['England', 'Wales', 'Scotland', 'Northern Ireland'] as string[],
    /** 비자국 육성이 상한을 넘으면 목적지 점수에서 뺀다 (경고 없이 자동 조정) */
    nonHomegrownPenalty: 6,
  },

  // ── 구단 재정 (NPC 전용, pending 62.2, 부록 C.46). 금액은 모두 만 원 (19.1 표시 단위), 계산·판정만 ──
  finance: {
    /**
     * 재정 등급 (2018-19 딜로이트 머니리그 2019 = 2017-18 매출 근사): 빅클럽 = 상위 10위 안 6팀, 상위 = 17~23위 5팀,
     * 하위 = 승격팀·매출 최하위권 (울버햄튼은 승격팀이지만 2018 여름 대형 투자로 중위), 나머지 중위. 리그 밖 클럽은 레이팅으로 등급만 (outsideTier)
     */
    teamTier: {
      mun: 'big', mci: 'big', liv: 'big', che: 'big', ars: 'big', tot: 'big',
      eve: 'upper', new: 'upper', whu: 'upper', lei: 'upper', sou: 'upper',
      cry: 'mid', bou: 'mid', wat: 'mid', bha: 'mid', bur: 'mid',
      wol: 'mid', ful: 'low', car: 'low', hud: 'low',
    } as Record<string, 'big' | 'upper' | 'mid' | 'low'>,
    /** 리그 밖 클럽 등급: 레이팅 ≥ big → 빅클럽, ≥ upper → 상위, ≥ mid → 중위, 그 아래 하위 */
    outsideTier: { big: 82, upper: 77, mid: 72 },
    /**
     * 등급별 시즌 연봉 총액 상한 (만 원, 연봉 = 주급 × 52). 시작 로스터 연봉 총액(19.11 곡선, NPC 위상 근사, 시드 24개 최대) 등급 최고 × 약 1.15:
     * 빅클럽 맨시티 최대 약 1,400억 · 아스널 약 480억, 상위 에버턴 약 216억, 중위 울버햄튼 약 151억, 하위 풀럼 약 92억
     */
    wageCap: { big: 16500000, upper: 2500000, mid: 1750000, low: 1100000 } as Record<'big' | 'upper' | 'mid' | 'low', number>,
    /** 등급별 시즌 영입 예산 기본값 (만 원) */
    budget: { big: 2500000, upper: 900000, mid: 500000, low: 300000 } as Record<'big' | 'upper' | 'mid' | 'low', number>,
    /** 순위 상금: 지난 시즌 순위 r → (21 − r) × prizePerRank (1위 +40억 원, 20위 +2억 원) */
    prizePerRank: 20000,
    /** 판 선수 몸값의 이 비율이 그 시즌 남은 예산에 더해진다 */
    saleShare: 0.5,
    /** 리그 밖 클럽(등급만): 한 선수 몸값 ≤ 등급 예산 × outsideBudgetShare, 연봉 ≤ 등급 상한 × outsideWageShare */
    outsideBudgetShare: 0.6,
    outsideWageShare: 0.12,
    /**
     * 몸값 (만 원) = base × 1.18^(OVR − 70) × 나이 × 잠재력 × 위상 × 남은 계약, 500만 원 단위, 상한 maxValue.
     * 나이 [이 나이 이하, 배수], 잠재력 = 1 + (전성기 − OVR) × potPerPoint (최대 potMax), 위상 = 1 + 위상 / repDiv (최대 repMax),
     * 남은 계약 [연수, 배수] (0년 = 자유계약·만료 = 몸값 0)
     */
    value: {
      base: 100000, growth: 1.18,
      age: [[21, 1.3], [24, 1.15], [27, 1], [29, 0.85], [31, 0.6], [33, 0.4], [99, 0.2]] as [number, number][],
      potPerPoint: 0.04, potMax: 0.4,
      repDiv: 2000, repMax: 0.5,
      contract: [0, 0.6, 0.85, 1] as number[],
      maxValue: 8000000,
      unit: 500,
    },
    /** NPC 위상 근사 (연봉 계산용): OVR → 위상, 앵커 사이 선형 */
    npcRep: [[60, 0], [66, 40], [70, 75], [75, 150], [80, 350], [85, 600], [90, 850], [94, 1000]] as [number, number][],
    /** 내 선수 제안 연봉이 그 팀 남은 연봉 여력에 맞춰 이 비율 아래로 깎이면 제안하지 않는다 */
    minWageShare: 0.7,
    /**
     * 재계약 판정 (pending 68): allPlayers = false 면 커스텀 생성 선수만 (모든 선수면 balance 잔류 가드 13/15, C.46). ① 남은 연봉 여력(지금 내 연봉 제외) < 새 연봉 ② 그 포지션군에서 유효 OVR 순위가
     * 수요 × depth 보다 아래이고 유효 OVR < 팀 레이팅 − gap. 둘 중 하나면 재계약 실패·방출
     */
    renew: { depth: 2, gap: 14, allPlayers: false },
  },

  // ── 감독 신뢰도·면담 (18.2·18.3, 부록 C.62) ──
  manager: {
    /** 새 팀 시작 = 50 + (주 포지션 OVR − 팀 레이팅) × startPerOvr, [startMin, startMax]. 그 뒤 0~100 */
    start: 50, startPerOvr: 1, startMin: 40, startMax: 60,
    /** 출전 경기: 평점 ≥ ratingHigh +ratingDelta, < ratingLow −ratingDelta (교체 출전은 절반). 골·도움 각 +1, 승 +1 / 패 −1, 경고 −1, 퇴장 −5 */
    ratingHigh: 7.0, ratingLow: 6.0, ratingDelta: 2, goal: 1, assist: 1, win: 1, loss: 1, yellow: 1, red: 5,
    /** 골·도움 합 경기당 상한 (해트트릭 한 경기로 신뢰도가 튀지 않게) */
    involvementMax: 3,
    /** 감독 기억 감쇠: 출전 경기마다 신뢰도가 50 쪽으로 이만큼 (비율) 돌아온다 (오래된 인상은 옅어짐, 추천안) */
    reversion: 0.04,
    /** 선발 점수 = 슬롯 OVR + 태그 + (신뢰도 − 50) × trustPerPoint + 폼(최근 평점 폼 × formScale, ±formMax) − 피로 70 이상 fatigueMinus (화면 분해) */
    trustPerPoint: 0.06, formScale: 5, formMax: 1.5, fatigueFrom: 70, fatigueMinus: 2,
    /** 경쟁자 (NPC) 신뢰도 고정 */
    npcTrust: 60,
    /** 홈 "최근 신뢰도 변화" 줄 수 */
    logMax: 5,
    /** 감독 성향 (data/managers.ts): 21세 이하 시작 +youthStart, 내려갈 때 × strictDown, 모든 변화 × steadyMul */
    styles: { youthStart: 5, youthAge: 21, strictDown: 1.25, steadyMul: 0.8 },
    /** 이적 요청 (C.42 훅): 신뢰도가 이 값 미만이면 요청할 수 있다 (또는 위상이 팀 수준을 넘을 때, 또는 낮은 신뢰 면담에서) */
    requestBelow: 35,
    /**
     * 커리어 태그 효과 (C.62, C.47 표에서 5-1 로 미룬 것): 원클럽맨 하락 × oneClubDown (영원한은 감소분 × 1.5), 문제아 하락 × troublemakerDown,
     * 컬트 히어로 상승 × cultHeroUp, 친정 선택 그 구단 시작 +homeChoiceStart, 감독 불화 민감 = 신뢰도가 떨어진 경기 다음 경기 폼 −sensitiveForm,
     * 재계약 판정(커스텀): 저니맨 실패 +journeyRenew, 신뢰도 30 미만 실패 +lowRenew, 신뢰도 80 이상 실패를 highKeep 확률로 뒤집음
     */
    tags: { oneClubDown: 0.8, troublemakerDown: 1.2, cultHeroUp: 1.1, homeChoiceStart: 5, sensitiveForm: 0.15, journeyRenew: 0.1, lowRenew: 0.25, highKeep: 0.2 },
    meeting: {
      /** 낮은 신뢰 면담: 신뢰도 lowBelow 미만이 lowDays 일 이상, 또는 시즌 중반(라운드 midRound 이상) 선발·출전 시간 비율 minShare 미만 */
      lowBelow: 30, lowDays: 14, midRound: 19, minShare: 0.4,
      /** 같은 면담 다시 열리기까지 (일) */
      lowCooldown: 28,
      /** 보상 면담: 신뢰도 rewardFrom 이상, 시즌 전반·후반 한 번씩 */
      rewardFrom: 80,
      /** 포지션 제안: 고른 슬롯 OVR 이 최고 포지션 OVR 보다 posGap 이상 낮은 채로 posGames 경기 */
      posGap: 5, posGames: 3,
      /** 더 노력하겠다: 신뢰도 +effortTrust, effortDays 일 동안 훈련 XP × effortXp */
      effortTrust: 5, effortDays: 14, effortXp: 1.2,
      /** 불만 표출: 신뢰도 −complainTrust, complainChance 확률로 감독이 다음 complainGames 경기 기회를 준다 */
      complainTrust: 5, complainChance: 0.35, complainGames: 2,
      /** 주전 보장: 다음 startGames 경기 선발 확률 최소 startFloor / 선호 슬롯 보장: 다음 slotGames 경기 무조건 선발 */
      startGames: 8, startFloor: 0.85, slotGames: 5,
      /** 포지션 제안을 따르면 */
      posTrust: 3,
    },
  },

  // ── 이벤트 엔진·인박스·라이벌·구단 (20번, 부록 C.63) ──
  events: {
    /** 시즌 선택형 슬롯: 개막부터 weeks 주차 중 min~max 개 (20.3) */
    slots: { weeks: [8, 14, 20, 26, 32], min: 4, max: 5 },
    /** 선택형 기한 (일). 지나면 기본 선택 */
    deadlineDays: 7,
    /** 바로 뜨는 이벤트(하루·경기 뒤) 사이 최소 간격 (일) — 알림이 몰리지 않게 */
    minGapDays: 3,
    /** 정보형 기본 쿨다운 (일) */
    messageCooldown: 21,
    /** 효과 상한 (이벤트 1개당, 20.7 1번): 위상 ±rep, 신뢰도 ±trust. 돈은 5-7 재정 전이라 효과 없음 */
    caps: { rep: 5, trust: 10 },
    /** 가족 우환 "가족 곁으로" 휴가 (pending 102 ⑨, C.67a): 이 날수 동안 경기 결장·훈련 없음(휴가 회복) */
    familyLeaveDays: 5,
    /** 이벤트 폼 보정 상한 (다음 n경기, 경기 입력) */
    formMax: 0.2,
    /** 인박스 최대 (오래된 읽은 것부터 지움) */
    inboxMax: 80,
    rival: {
      /** 나이 ±ageGap (교체 기준 위상 차는 C.64부터 world.rivalMaxGap) */
      ageGap: 3,
      /** 시즌 끝 비교 점수 = 골+도움 차 + 평균 평점 차 × avgWeight, ±1 넘으면 승패 */
      avgWeight: 10,
      /** 이기면 위상 +winRep · 신뢰도 +winTrust, 지면 위상 loseRep · 신뢰도 loseTrust */
      winRep: 3, winTrust: 2, loseRep: -2, loseTrust: -1,
      /** NPC 기록이 없을 때 추정: 팀 경기 × estApps 출전, 포지션군 경기당 골+도움 */
      estApps: 0.85,
      /** 같은 포지션 영입: 내 팀에 온 같은 포지션군 선수 OVR ≥ 내 OVR − competitorGap 이면 "새 경쟁자" 이벤트 */
      competitorGap: 3,
      estGa: { ST: 0.6, WING: 0.45, CAM: 0.45, CM: 0.2, CDM: 0.1, FB: 0.12, CB: 0.06, GK: 0 },
    },
    /** 감독 경질: fromRound 라운드부터, 순위 rankFrom 이하 또는 (순위 − 전력 순위) ≥ expectedGap, 최근 lastGames 경기 maxWins 승 이하 → 경기 뒤 chance (주전 고정 감독 × steadyMul), 시즌 한 번 */
    coach: { fromRound: 10, rankFrom: 17, expectedGap: 6, lastGames: 5, maxWins: 1, chance: 0.12, steadyMul: 0.7 },
    /** 주장: 신뢰도 하락 × downMul, 시즌 끝 위상 +seasonRep, 새 시즌에 신뢰도 stripBelow 미만이면 완장 뺏김 */
    captain: { downMul: 0.9, seasonRep: 3, stripBelow: 30 },
  },

  // ── 커리어 챕터 (22.1, 부록 C.73a, pending 119) ── XP·성장 수치는 바꾸지 않는다
  chapters: {
    /** 챕터 나이 상한 (시즌 시작 나이): 유망주 ≤20 · 도약 21~25 · 전성기 26~31 · 황혼 32~ */
    maxAge: { prospect: 20, rise: 25, prime: 31 },
    /**
     * 시즌 목표 난이도 섞기 (18.9 위에): 기본은 쉬움/보통/어려움 하나씩. 유망주는 easier 확률로 어려움 하나가 보통으로,
     * 전성기는 harder 확률로 쉬움 하나가 보통으로. 황혼은 개인 목표 셈 배수 personalMul · 평점 personalRating 더하기 (완화)
     */
    goalMix: { prospect: { easier: 0.5, harder: 0 }, rise: { easier: 0, harder: 0 }, prime: { easier: 0, harder: 0.5 }, twilight: { easier: 0, harder: 0 } },
    twilightGoal: { personalMul: 0.85, personalRating: -0.1 },
    /**
     * 이벤트 분류 배율 (태그별, 확률·슬롯 가중치에 곱함). 태그 여러 개면 곱한 뒤 eventClamp 안으로.
     * 위상을 올리는 이벤트(칭찬·스타·스폰서·주장)는 키우지 않는다 — 레전더리 35세 900+ 가드가 경계(12/48)라 (C.73a 측정)
     */
    eventMul: {
      prospect: { minutes: 1.4, contract: 1.3, training: 1.3, manager: 1.2, star: 0.6, luxury: 0.6, sponsor: 0.7, aging: 0.5, retire: 0.5, mentor: 0.5 },
      rise: { transfer: 1.5, contract: 1.2, minutes: 0.8, aging: 0.5, retire: 0.5, mentor: 0.5 },
      prime: { luxury: 1.2, minutes: 0.7, retire: 0.5 },
      twilight: { aging: 1.5, retire: 1.5, mentor: 1.5, injury: 1.2, transfer: 0.7, star: 0.6, sponsor: 0.6, praise: 0.6 },
    } as Record<string, Readonly<Record<string, number>>>,
    eventClamp: [0.5, 1.5] as readonly [number, number],
    /** 챕터 끝 카드 선택권 1회 (C.65 선택권 흐름): 유망주 희귀 · 도약 희귀 · 전성기 에픽 · 황혼 없음 */
    pick: { prospect: 'rare', rise: 'rare', prime: 'epic', twilight: null } as Record<string, string | null>,
    /** 챕터 하이라이트 보관 수 */
    highlights: 3,
  },

  // ── 시즌 하이라이트 3 (22.2 끝 · I.13, 부록 C.73b): 최고 평점 경기 · 골 · 위기. 챕터 하이라이트 후보 점수도 같이 ──
  seasonHighlights: {
    /** 최고 평점 경기 점수 = 평점 + 골 × goalW + 도움 × assistW (C.73a 그대로) */
    best: { goalW: 0.3, assistW: 0.2 },
    /** 골 경기 점수 = base + 골 × perGoal + 승부를 가른 골(이긴 경기 골 차 ≤ 내 골, 비긴 경기 내 골) decisive. 골이 없으면 도움 경기 (perAssist) */
    goal: { base: 5, perGoal: 1, decisive: 1, perAssist: 0.6 },
    /**
     * 위기 점수: 부상 결장 연속 = injuryBase + 경기 × injuryPer (최대 injuryMax), 연패(minLosing 이상) = losingBase + 연패 × losingPer,
     * 최악 평점 경기(worstBelow 미만) = worstBase + (worstBelow − 평점). 셋 중 가장 큰 것. 챕터 후보로는 낮게(위기는 트로피·배지가 없을 때만 보이게)
     */
    crisis: { injuryBase: 3, injuryPer: 0.25, injuryMax: 6, minLosing: 3, losingBase: 2.5, losingPer: 0.5, worstBelow: 6, worstBase: 3 },
  },

  // ── 은퇴 후 (18.11, 부록 C.73b): 명예의 전당(세이브 밖 로컬 저장) · 새 게임 보너스 ──
  legacy: {
    /** 명예의 전당 보관 수 */
    hallSize: 3,
    /** 커리어 점수 = 최종 위상 + 자산 점수 × assetW + 레전드 배지 × badgeW + 트로피 × trophyW + 통산 (골 + 도움) × gaW */
    score: { assetW: 2, badgeW: 100, trophyW: 30, gaW: 0.5 },
    /** 새 게임 보너스: 시작 카드 선택권 1회 (C.65 흐름). 보통 커리어 normal, 레전드 배지를 받은 커리어 legend */
    bonus: { normal: 'common', legend: 'rare' } as Record<'normal' | 'legend', string>,
  },

  // ── 경기 외 생활 (pending 47 4번, 부록 C.63) ──
  life: {
    /** 시작값 (0~100). 멘탈 피로는 높을수록 나쁨. 적응도는 팀에 따라 (adapt) */
    start: { home: 70, adapt: 70, team: 60, mental: 20 },
    /** 하루마다 기준값 쪽으로 (차이 × rate): 가정 안정 → 70, 팀 관계 → 60 (리더 · 주장 +leaderTo) */
    drift: { homeTo: 70, homeRate: 0.02, teamTo: 60, teamRate: 0.015, leaderTo: 10 },
    /** 적응도: 새 팀 시작 = 외국인(잉글랜드 국적이 아님) foreignStart / 잉글랜드 domesticStart / 무한한 충성심 귀환 loyalStart, 첫 시즌 실제 선수(이미 그 구단) settledStart. 하루 +perDay (향수병 ×homesickMul, 언어 천재 ×linguistMul) */
    adapt: { foreignStart: 45, domesticStart: 65, loyalStart: 85, settledStart: 85, perDay: 0.3, homesickMul: 0.5, linguistMul: 2 },
    /** 팀 관계: 새 팀 시작 newTeam, 무한한 충성심 귀환 loyalTeam, 원클럽맨 하한 oneClubFloor */
    team: { newTeam: 50, loyalTeam: 75, oneClubFloor: 40 },
    /**
     * 멘탈 피로: 하루마다 baseTo 쪽으로 (차이 × baseRate) + 경기 +match (큰 경기 +big 더), 휴식 날 rest, 휴가 vacation, 회복 훈련 recovery, 그 밖 날 other,
     * 피로 fatigueFrom 이상인 날 +fatigueAdd. 평형: 주 1경기 ≈ 35, 주 2경기 ≈ 45, 큰 경기·연전·이벤트가 겹치면 70+
     */
    mental: { baseTo: 25, baseRate: 0.02, match: 3, big: 2, rest: -1.5, vacation: -3, recovery: -1, other: 0, fatigueFrom: 70, fatigueAdd: 0.5 },
    /** 하루 행동 효과 (훈련 대신). media = 미디어 인터뷰: good 확률로 위상 +goodRep, 아니면 badRep (언론 울렁증 ×shyMul, 언론의 총아 ×darlingMul 확률) */
    actions: {
      family: { home: 8, mental: -2 },
      language: { adapt: 5 },
      teamMeal: { team: 6, mental: -1 },
      therapy: { mental: -10 },
      trip: { mental: -8, home: 3 },
      media: { good: 0.6, goodRep: 2, badRep: -1, mental: 2, shyMul: 0.6, darlingMul: 1.25 },
    },
    /** 엔진 밖 영향 (경기 입력 폼, 피로 회복): 지표가 low 미만이면 lowForm, high 이상이면 highForm, 멘탈 피로 mentalHigh 이상 mentalForm(mentalMax 이상 mentalMaxForm) · 회복 × mentalRecovery, 합 ±formMax */
    effects: {
      low: 35, high: 80, lowForm: { home: -0.05, adapt: -0.05, team: -0.05 }, highForm: { home: 0.02, team: 0.03 },
      mentalHigh: 70, mentalForm: -0.06, mentalMax: 85, mentalMaxForm: -0.12, mentalLow: 15, mentalLowForm: 0.02, mentalRecovery: 0.9, formMax: 0.15,
    },
    /** 생활 이벤트 시즌 상한 (pending 47 질문 ④: 쉬움 1, 보통 2, 어려움 3) */
    eventsPerSeason: { easy: 1, normal: 2, hard: 3 },
    /** 태그 (5-2 몫): 리더 = 팀 불화 이벤트 확률 × leaderDiscord, 문제아 = 인터뷰 실언 확률 × troubleSlip, 스타 플레이어 = 빅클럽 루머 × starRumour */
    tags: { leaderDiscord: 0.5, troubleSlip: 1.5, starRumour: 2 },
    /** 플레이 태그: 라커룸 리더 = 주장 lockerSeasons 시즌째 끝 또는 시즌 끝 팀 관계 lockerTeam 이상 / 언론의 총아 = 인터뷰 좋은 결과 darlingGood 번 */
    natural: { lockerSeasons: 2, lockerTeam: 90, darlingGood: 5 },
  },
  /**
   * 시즌 목표와 카드 해금 (18.9, 부록 C.65). 시즌 시작 목표 3개 = 감독 · 구단 · 개인, 쉬움/보통/어려움을 시드로 하나씩 나눈다.
   * 목표 값 = 기대값(지난 시즌 기록 + 포지션·팀 수준 사전값) × 난이도 배수. 달성하면 XP + 카드 3택 1(쉬움 일반 · 보통 희귀 · 어려움 희귀/에픽).
   * 3단계 임시 경로(시즌 종료 희귀·에픽 3택 1)는 이 보상으로 바뀐다 (F.0 5번)
   */
  goals: {
    /** 달성 XP (게임 난이도 xp 배수 · 고령 XP 감쇠를 곱한다). 위상에는 더하지 않는다 */
    xp: { easy: 25, normal: 50, hard: 80 },
    /** 카드 선택권 희귀도 가중 (후보마다): 쉬움 일반, 보통 희귀, 어려움 희귀 50% · 에픽 50% */
    pick: { easy: { common: 1 }, normal: { rare: 1 }, hard: { rare: 0.5, epic: 0.5 } },
    /** 셈 목표(골·도움·클린시트·MOM) 배수, 출전 경기 배수, 평균 평점 더하기, 팀 순위 더하기(+ = 낮은 순위도 됨) */
    mult: { easy: 0.8, normal: 1.1, hard: 1.4 },
    appsMul: { easy: 0.75, normal: 0.9, hard: 1.05 },
    ratingAdd: { easy: -0.15, normal: 0.1, hard: 0.3 },
    posAdd: { easy: 3, normal: 0, hard: -2 },
    /** 어려움 개인 목표가 리그 득점/도움 순위가 되는 위상 티어(탑클래스 이상)와 순위 */
    rankFromTier: 2, rankTarget: 3,
    /** 다른 팀 선수 기록이 이만큼 있어야 순위 목표·시상 선택권을 판정 (빠른 진행 = 내 기록뿐) */
    leagueStatsMin: 50,
    /** 게임 난이도: 셈 목표 배수, 팀 순위 더하기 */
    difficulty: { easy: { mult: 0.9, pos: 1 }, normal: { mult: 1, pos: 0 }, hard: { mult: 1.1, pos: -1 } },
    /** 사전 기대값 (경기당, 포지션군): [골, 도움, MOM]. 팀 레이팅 대비 OVR 1당 × (1 + ovrK), 0.5~1.8배 */
    rates: {
      GK: [0, 0, 0.06], CB: [0.04, 0.02, 0.07], FB: [0.03, 0.08, 0.07], CDM: [0.04, 0.06, 0.07],
      CM: [0.1, 0.12, 0.1], CAM: [0.25, 0.22, 0.14], WING: [0.32, 0.18, 0.14], ST: [0.5, 0.1, 0.17],
    } as Record<string, readonly [number, number, number]>,
    ovrK: 0.04,
    /** 지난 시즌 기록을 섞는 무게: 사전값 priorApps 경기만큼 + 지난 시즌 출전 */
    priorApps: 10,
    /** 평균 평점 사전값 = ratingBase + (OVR − 팀 레이팅) × ratingK (ratingMin~ratingMax), 평점 목표 자격 출전 ratingMinApps */
    ratingBase: 6.7, ratingK: 0.03, ratingMin: 6.3, ratingMax: 7.4, ratingMinApps: 10,
    /** 클린시트 = 60분 이상 뛴 경기 무실점. 경기당 = csBase + csTop × (팀 수 − 예상 순위)/(팀 수 − 1) */
    csBase: 0.06, csTop: 0.26, csMinutes: 60,
    /** 감독 목표: 선발 확률 이 값 미만이면 출전 경기 수, 이상이면 평균 평점 또는 MOM */
    appsBelow: 0.6,
    /** 신뢰도 (C.62): [달성, 실패] 감독 목표 · 구단 목표 · 개인 목표 */
    trust: { manager: [2, -2], club: [1, -1], personal: [0, 0] } as Record<string, readonly [number, number]>,
    /** 중간 점검 인박스 라운드 */
    midRound: 19,
    /** TP (5.4, C.68b): 달성 TP 쉬움 1 · 보통 2 · 어려움 3. 카드 해금 = TP 로 3택 1 (일반 특성 rare TP 3, 상위 특성 epic TP 5 + 위상 탑클래스, 5.5) */
    tp: { easy: 1, normal: 2, hard: 3 },
    tpUnlock: { rare: 3, epic: 5 },
    tpEpicTier: 2,
    /**
     * 구단 목표 "챔스 n강" (pending 109 ⑤): 챔스에 나가는 시즌이면 uclChance 로 리그 순위 대신 챔스 진출 단계 목표.
     * 단계: 1 = 16강 · 2 = 8강 · 3 = 4강 · 4 = 결승. 쉬움/보통/어려움 기본 단계 uclStage, 리그 레이팅 상위 uclStrongRank 안 팀은 +1
     */
    uclChance: 0.5, uclStage: { easy: 1, normal: 2, hard: 3 }, uclStrongRank: 2,
    /** 업적 카드 선택권 (18.9 큰 업적): 시즌 시상 수상 희귀 1장(시즌 최대 1), 리그 우승 에픽, 새 레전드 배지 전설(없으면 에픽). 챔스·발롱도르·월드컵은 5-6·6단계 훅 */
    awardPick: { award: 'rare', leagueTitle: 'epic', legendBadge: 'legendary', clWin: 'epic', ballonDor: 'legendary', worldCup: 'legendary' },
  },
  /** 월드 정보·NPC 시즌 통계 (18.5, 부록 C.64). 통계 자체는 엔진 기록(다른 경기도 22명 엔진), 여기는 순위·시상·위상·소식·세이브 상한 */
  world: {
    /** 평점 순위 자격: 출전 ≥ max(ratingMinApps, 지난 라운드 × ratingMinShare) */
    ratingMinApps: 3, ratingMinShare: 0.4,
    /** 시상: 최고 평점 출전 ≥ bestMinApps, 영플레이어(21세 이하 최고 평점) 출전 ≥ youngMinApps */
    bestMinApps: 15, youngMinApps: 10,
    /** 순위표 줄 수 (득점·도움·평점) */
    boardSize: 15,
    /**
     * NPC 위상 = OVR 근사(finance.npcRep) + 기록 + 수상.
     * 기록 = (평균 평점 − perfAvg) × perfPerRating + 38경기 환산 골+도움 × perfPerGa38 (−perfMin~+perfMax), 출전 perfMinApps 미만은 0.
     * 이번 시즌 비중 = 출전 / curFullApps (나머지는 지난 시즌 기록). 수상(득점왕·도움왕·최고 평점·영플레이어) 최근 honorSeasons 시즌 1개당 +honorRep (최대 honorMax)
     */
    standing: { perfAvg: 6.8, perfPerRating: 80, perfPerGa38: 2, perfMin: 60, perfMax: 100, perfMinApps: 5, curFullApps: 19, honorRep: 30, honorMax: 90, honorSeasons: 5 },
    /** 라이벌 (C.63 → C.64 위상 비교): 후보 = OVR 차 rivalOvrGap 이내, 거리 = |위상 차| / rivalRepScale + OVR 차 + 나이 차 × 0.5. 시즌 시작 때 위상 차 rivalMaxGap 또는 OVR 차 rivalOvrGap 넘으면 교체 */
    rivalRepScale: 25, rivalMaxGap: 220, rivalOvrGap: 8,
    /** 기록 소식 (인박스): 이 라운드를 마친 뒤 득점·도움 경쟁 기사 (빠른 진행으로 기록이 없으면 안 냄) */
    raceRounds: [10, 20, 30] as readonly number[],
    /** 세이브 상한: 최근 fullSeasons 시즌은 전체 기록, 그 앞 시즌은 선수 기록을 득점·도움·평점 상위 keepTop 명씩 + 내 팀 선수만, 다른 경기 득점 기록(g)은 지운다 */
    archive: { fullSeasons: 3, keepTop: 20 },
  },
  /**
   * 챔스/컵 (18.7, pending 108, 부록 C.67). 국내 컵(FA컵) = 단판 녹아웃 32팀(리그 20 + 하부 가상 12).
   * 단계 날짜 = 목표일([다음 해?, 월, 일])에 가장 가까운 토요일부터 찾아, 리그 경기와 minGap 일 이상 떨어진 첫 날 (토·일 → 그 주 화·수 → 앞뒤 주)
   */
  cups: {
    fa: {
      stages: [[1, 1, 5], [1, 1, 26], [1, 3, 16], [1, 4, 13]] as [number, number, number][],
      /** 결승 = 리그 최종 라운드 + finalAfter 일 (토요일) */
      finalAfter: 6,
    },
    /**
     * 챔스 (C.67b): 지난 시즌 리그 상위 4팀(첫 시즌 = 2017-18 실제 순위 firstSeason) + 외부 28팀. 조별 8조 × 4팀 6경기 →
     * 16강·8강·4강 홈·원정 2경기(합계 동률 = 승부차기 간이 판정, 원정 다득점·연장 없음) → 결승 단판(리그 최종 라운드 + finalAfter 일, 토).
     * 날짜 = [다음 해?, 월, 일] 이 든 주의 화·수 (팀마다 리그·컵 경기와 minGap 일 이상 되는 요일)
     */
    ucl: {
      firstSeason: ['mci', 'mun', 'tot', 'liv'] as readonly string[],
      groupWeeks: [[0, 9, 18], [0, 10, 2], [0, 10, 23], [0, 11, 6], [0, 11, 27], [0, 12, 11]] as [number, number, number][],
      /** 16강·8강·4강 [1차전, 2차전] 주 */
      koWeeks: [[[1, 2, 12], [1, 3, 5]], [[1, 4, 9], [1, 4, 16]], [[1, 4, 30], [1, 5, 7]]] as [number, number, number][][],
      finalAfter: 13,
    },
    /**
     * 컵·챔스 경기 XP 배율 (리그 경기 XP × matchXpScale × 이 값). 경기 수가 늘어 성장 가드(레전더리 35세 월드클래스 비율 ·
     * 36−30 CB/CDM/CM 하락)가 흔들려서 낮춤 (C.67: 1.0 = 13/15, 0.5 = 14/15 → 0.35 + 컵 업적 XP 는 위상에 넣지 않음)
     */
    matchXpMul: 0.35,
    /** 컵·챔스 경기 평점을 최근 폼(recentRatings)에 넣는지, 감독 신뢰도에 반영하는지 */
    cupForm: true,
    cupTrust: true,
    /** 업적 XP (5.3): 챔스 우승/준우승/4강/8강, 국내 컵 우승, 트레블(리그 + 국내 컵 + 챔스) */
    xp: { uclWin: 400, uclFinal: 250, uclSemi: 150, uclQuarter: 80, faWin: 150, treble: 500 },
    /** 팀마다 경기 사이 최소 간격 (일, 3 = 이틀 쉼). 자리가 없으면 minGapLoose */
    minGap: 3, minGapLoose: 2,
    /** 승부차기 간이 판정: 홈(또는 첫 팀) 승률 = 0.5 + 레이팅 차 × ratingK, [min, max] */
    pens: { ratingK: 0.01, min: 0.3, max: 0.7 },
    /** 내 팀 없는 경기 득점자 가중치 (포지션군), 도움 확률·가중치 */
    scorerWeight: { GK: 0, CB: 0.6, FB: 0.5, CDM: 0.6, CM: 1.4, CAM: 2.6, WING: 3, ST: 5 },
    assistChance: 0.72,
    /** 득점자 후보 = 로스터 OVR 상위 n 명 (주전 + 자주 뛰는 교체) */
    squadTop: 14,
    assistWeight: { GK: 0.05, CB: 0.4, FB: 1.6, CDM: 1, CM: 2.4, CAM: 3.6, WING: 3.4, ST: 1.8 },
  },
  // ── 개인 재정 (19번, 5-7 a, C.68a) ──
  /**
   * 내 선수 돈. 금액 단위는 만 원 정수(기존 주급 wageFor 와 같음), 표시는 한국식(만 원·억 원). 19.11 수치표 초안 그대로.
   * 주 정산 = 일요일이 끝날 때 주급 + 출전·골 보너스 − 생활비 − 스태프 급여. 비시즌 주급은 다음 시즌 시작 때 (52 − 정산한 주) 몫을 한 번에
   */
  money: {
    /** 새 게임 잔고 (만 원) */
    startCash: 0,
    /** 계약금 = 연봉 × signingShare × 계약 연수(최대 signingYearsMax). 임대는 없음 */
    signingShare: 0.1, signingYearsMax: 5,
    /** 출전수당 = 주급 × appearance (경기당), 골 보너스 = 주급 × goal (골당), 우승 보너스 = 연봉 × title (리그·FA컵·챔스 우승마다) */
    bonus: { appearance: 0.05, goal: 0.2, title: 0.1 },
    /** 스폰서 (연, 시즌 끝): 위상 티어별 연봉 비율, 상한 30억 원 */
    sponsor: { normal: 0, special: 0, topClass: 0.05, worldClass: 0.15, legendary: 0.3 } satisfies Record<Tier, number>,
    sponsorMax: 300000,
    /** 기본 생활비 = 연봉의 12% (주마다 주급 × living) */
    living: 0.12,
    /** 에이전트 수수료 = (계약금 + 첫해 연봉) × agent (계약 때). 고급 에이전트(8%)는 b 이후 */
    agent: 0.05,
    /** 재정 내역 줄 상한 (세이브 크기, 주 정산은 한 줄), 지난 시즌 요약 상한 */
    ledgerMax: 24, historyMax: 25,
  },

  // ── 스태프 (19.2~19.5, D.13 재설계, C.68a) ──
  staff: {
    /** 슬롯 (위상 티어별, 코치·의료 공용) */
    slots: { normal: 2, special: 3, topClass: 4, worldClass: 5, legendary: 5 } satisfies Record<Tier, number>,
    /** 연 급여 = 고용 때 내 연봉 × salary (티어별), 500만 원 단위 반올림, 최소 500만 원 */
    salary: { normal: 0.03, special: 0.05, topClass: 0.07, worldClass: 0.1, legendary: 0.14 } satisfies Record<Tier, number>,
    salaryUnit: 500,
    /** 코치 모집 비용 = 주급 × scoutCost (500만 원 단위, 최소 500만 원). 후보는 scoutDays 일 뒤 2~3명, 도착 뒤 keepDays 일 동안 고를 수 있다 */
    scoutCost: 0.5, scoutDays: 7, keepDays: 14, candidates: [2, 3] as [number, number],
    /** 후보 티어 가중치 (높을수록 흔치 않다) */
    tierWeight: { normal: 45, special: 28, topClass: 15, worldClass: 8, legendary: 4 } satisfies Record<Tier, number>,
    /** 후보 중 코치 비율 (나머지는 의료: 팀 닥터·물리치료사·영양사 같은 비율) */
    coachShare: 0.7,
    /** 계약 기간 (시즌) */
    years: [1, 3] as [number, number],
    /**
     * 코치 (D.13 재설계, pending 110): 전문 능력치를 기술 훈련할 때 그날 게이지·훈련 XP × (1 + 배율).
     * 범위 = 전문 능력치 수(같은 묶음 안), 한계 = 그 값 이하인 능력치에만. 같은 능력치에 겹치면 가산, 상한 maxBoost.
     * 시즌당 +2 상한은 두지 않는다: 기술 훈련 게이지에 이미 묶음당 시즌 +2 · 전체 +6 상한이 있다(25.3)
     */
    coach: {
      boost: { normal: 0.1, special: 0.15, topClass: 0.2, worldClass: 0.25, legendary: 0.3 } satisfies Record<Tier, number>,
      range: { normal: 1, special: 2, topClass: 2, worldClass: 3, legendary: 3 } satisfies Record<Tier, number>,
      limit: { normal: 75, special: 80, topClass: 85, worldClass: 90, legendary: 94 } satisfies Record<Tier, number>,
      maxBoost: 0.4,
      /**
       * 그날 훈련 XP 에 붙는 몫 (배율 × xpShare). 게이지에는 배율 그대로. 0 = 게이지만 (C.68a: XP 에도 붙이면 코치 풀 투자 balance 13/15 —
       * 레전더리 위상 비율 가드 2개, 게이지만이면 14/15)
       */
      xpShare: 0,
      /** 후보 전문 묶음: 이 확률로 내 포지션 OVR 비중 상위 3묶음 중에서, 나머지는 아무 묶음 */
      fitShare: 0.5,
    },
    /** 의료 (19.5): 팀 닥터 = 부상 확률 −, 물리치료사 = 부상 기간 −, 영양사 = 피로 회복 + (같은 종류는 가장 높은 것 하나) */
    medical: {
      doctor: { normal: 0.05, special: 0.08, topClass: 0.11, worldClass: 0.14, legendary: 0.18 } satisfies Record<Tier, number>,
      physio: { normal: 0.08, special: 0.12, topClass: 0.16, worldClass: 0.2, legendary: 0.25 } satisfies Record<Tier, number>,
      nutrition: { normal: 0.03, special: 0.05, topClass: 0.07, worldClass: 0.09, legendary: 0.12 } satisfies Record<Tier, number>,
    },
  },

  // ── 재정 b (19.6~19.9 · 19.11, C.68b): 카드 상점·카드팩·생활·자선·투자·엔딩 자산 점수·고급 에이전트. 금액은 만 원 ──
  wealth: {
    /**
     * 카드 상점 (19.6): 매주(월요일부터) 카드 size 장, 희귀도 가중 weights. 일반 = 주급 × commonPrice (500만 원 단위, 최소 500만 원),
     * 희귀 이상은 절대 가격 price + 위상 티어 조건 tierReq (티어 순번: 0 일반 · 1 스페셜 · 2 탑클래스 · 3 월드클래스)
     */
    shop: {
      size: [3, 4] as [number, number],
      weights: { common: 55, rare: 30, epic: 11, legendary: 4 },
      commonPrice: 0.5,
      price: { rare: 30000, epic: 100000, legendary: 250000 },
      tierReq: { common: 0, rare: 1, epic: 2, legendary: 3 },
    },
    /** 일반 카드팩 (19.6): 주급 × price (500만 원 단위, 최소 500만 원), 주당 perWeek 팩, 한 팩 cards 장 (장마다 rareChance 로 희귀) */
    pack: { price: 1, perWeek: 2, cards: 3, rareChance: 0.1 },
    /**
     * 생활 (19.7): 집·차는 절대 가격. 집 0 = 구단 숙소(무료). 월세는 연 rent 를 주마다, 나머지는 구매가 price + 유지비(연 houseUpkeep).
     * 이사하면 살던 집은 resale 비율로 판다. 효과는 작게: 집 = 피로 회복 + recovery, 차 = 주마다 멘탈 피로 − mental
     */
    houses: [
      { id: 'dorm', ko: '구단 숙소', price: 0, rent: 0, recovery: 0 },
      { id: 'rent', ko: '월세 아파트', price: 0, rent: 5000, recovery: 0.01 },
      { id: 'apt', ko: '아파트', price: 100000, rent: 0, recovery: 0.02 },
      { id: 'villa', ko: '고급 주택', price: 300000, rent: 0, recovery: 0.03 },
      { id: 'mansion', ko: '저택', price: 800000, rent: 0, recovery: 0.04 },
      { id: 'castle', ko: '성', price: 2000000, rent: 0, recovery: 0.05 },
    ],
    houseUpkeep: 0.05, houseResale: 0.7,
    cars: [
      { id: 'none', ko: '차 없음', price: 0, mental: 0 },
      { id: 'compact', ko: '중형차', price: 10000, mental: 0.3 },
      { id: 'suv', ko: '고급 SUV', price: 30000, mental: 0.6 },
      { id: 'sports', ko: '스포츠카', price: 80000, mental: 1 },
      { id: 'super', ko: '슈퍼카', price: 250000, mental: 1.5 },
    ],
    carUpkeep: 0.1, carResale: 0.5,
    /** 사치 리스크 (19.7): 집 houseFrom 단계 이상 · 차 carFrom 단계 이상을 사면 chance 로 days 일 뒤 언론 논란(인박스 선택형) */
    luxury: { houseFrom: 4, carFrom: 3, chance: 0.5, days: 3 },
    /** 자선 (19.8): perRep 마다 위상 +1, 시즌 상한 seasonCap, 누적 badge 이상이면 "자선가". 기부 단위 units */
    charity: { perRep: 10000, seasonCap: 30, badge: 1000000, units: [10000, 50000, 100000] },
    /**
     * 투자 (19.9): 예금 연 deposit, 부동산 연 estate ± estateSwing (시즌 끝 정산, 수익은 잔고로). 넣기 단위 units.
     * 이벤트형 투자: 시즌 offerWeek 주째 즈음 잔고 minCash 이상이면 offerChance 로 제안 (인박스). 금액 = 잔고 × share (1억 단위, 1억~max),
     * 시즌 끝 정산 = 금액 × 배수 (outcomes [배수, 가중]) — 손실은 투자금 안 (파산 없음)
     */
    invest: {
      deposit: 0.03, estate: 0.06, estateSwing: 0.08, units: [10000, 100000],
      offerWeek: [8, 24] as [number, number], offerChance: 0.6, minCash: 30000, share: 0.15, max: 300000,
      outcomes: [[0, 22], [0.5, 22], [1.2, 30], [2, 19], [3, 7]] as [number, number][],
    },
    /** 엔딩 자산 점수 = clamp(k × log10(순자산(억 원) + 1), 0, 100). 순자산 = 잔고 + 투자 + 집 매각가 */
    assetScoreK: 33,
    /** 에이전트 (19.11): 일반 수수료 money.agent(5%), 고급 fee(8%) — 새 계약 주급 × (1 + wage) */
    agentPremium: { fee: 0.08, wage: 0.05 },
    /** 이벤트 돈 효과 (20.2): 이벤트 효과 { money: n } = 주급 × n (최소 500만 원) */
    eventMinUnit: 500,
  },
} as const;

export type Balance = typeof BALANCE;
