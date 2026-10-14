// 경기 엔진 상수 (부록 E). 모든 값은 초기값이며 `npm run balance:engine`(E.15 통계 목표)으로 보정한다.
// 기획서 초기값과 다르게 정한 값은 부록 C.9 이후에 기록한다.

export const ENGINE_VERSION = 1;

export const ENGINE = {
  // ── 좌표, 시간 (E.3) ──
  pitch: {
    length: 105,
    width: 68,
    goalWidth: 7.32,
    boxDepth: 16.5,
    boxWidth: 40.3,
    sixDepth: 5.5,
  },
  time: {
    dt: 0.1,
    halfSeconds: 2700,
    /** 추가시간(분): 전반 / 후반, 시드 */
    addedFirst: [1, 3] as [number, number],
    addedSecond: [1, 5] as [number, number],
    /** 반응 시간 = base − slope × 판단 품질 (초) */
    reactionBase: 0.8,
    reactionSlope: 0.5,
    /** 오프더볼 목표 재계산 간격 (초) */
    offballInterval: 0.5,
    /** 위치 프레임 샘플링 간격 (초) */
    frameInterval: 0.5,
  },

  // ── 선수 물리 (E.4) ──
  physics: {
    maxSpeedBase: 5.5,
    maxSpeedSlope: 4.0,
    accelBase: 2.5,
    accelSlope: 3.5,
    turnKeepBase: 0.6,
    turnKeepSlope: 0.4,
    walk: 1.5,
    jog: 3.8,
    run: 6.0,
    /** 목표까지 거리별 이동 강도: 이 거리 이하면 멈춤 / 걷기 / 조깅 / 러닝, 넘으면 스프린트(긴급할 때만) */
    arriveDist: 0.6,
    walkDist: 4,
    jogDist: 9,
    runDist: 20,
    /** 스프린트 판정 속도 비율 (스프린트 횟수 기록) */
    sprintRatio: 0.85,
    radius: 0.5,
    /** 스태미나 소모 = (속도/최대 속도)² × drain × (1.6 − 0.8 × 체력/100) / 초 */
    staminaDrain: 0.01,
    staminaRecover: 0.004,
    staminaLowFrom: 60,
    halftimeRecover: 10,
  },

  // ── 공 (E.4) ──
  ball: {
    groundDecel: 1.2,
    passSpeedBase: 8,
    passSpeedPerM: 0.55,
    passSpeedMin: 10,
    passSpeedMax: 26,
    /** 공중볼(크로스, 롱볼) 평균 속도 */
    airSpeed: 18,
    shotSpeedMin: 20,
    shotSpeedMax: 32,
    controlDist: 0.9,
    controlMaxSpeed: 12,
    controlBase: 0.8,
    controlSlope: 0.2,
    controlSpeedPenalty: 0.05,
    /** 소유 직후 공을 다루는 시간(초) */
    receiveTime: 0.5,
    /** 루즈볼을 따라가는 팀별 인원 */
    chasers: 2,
  },

  // ── 팀 전술 층 (E.5) ──
  formation: {
    /** 줄별 x 시프트: [GK, 수비, 중원, 공격] */
    defendShift: [0, -0.06, -0.08, -0.1] as [number, number, number, number],
    attackShift: [0, 0.08, 0.12, 0.1] as [number, number, number, number],
    blockX: 0.3,
    /** 대형이 공을 따라가는 시간 상수 (초) */
    ballSmoothing: 1.5,
    blockY: 0.2,
    /** 측면 폭: 공 반대쪽 측면 선수는 이만큼 중앙으로 좁힌다 */
    narrowFar: 0.05,
    pressingBase: 0.5,
    pressingPerRating: 0.02,
    pressingMin: 0.3,
    pressingMax: 0.8,
    lineHeightBase: 0.5,
    lineHeightSpread: 0.1,
    /** 수비 라인 x(정규화) = lineBase + (lineHeight − 0.5) × lineRange, 공보다 lineBehindBall m 뒤까지만 */
    lineBase: 0.2,
    lineRange: 0.2,
    lineBehindBall: 4,
    /** 팀 phase: 소유 후 이 시간이 지나면 공격 대형 (초) */
    attackPhaseDelay: 2.5,
  },

  // ── 오프더볼 (E.6) ──
  offball: {
    /** 공 소유자와 유지할 간격 (m) */
    supportMin: 12,
    supportMax: 25,
    /** 침투 확률(오프더볼 갱신마다) = run × 공격 위치선정/100 × runChance */
    runChance: 0.05,
    runSeconds: 4,
    /** 오프사이드 라인 오차 σ = (100 − 공격 위치선정) × offsideSigma (m) */
    offsideSigma: 0.03,
    markGoalSide: 2,
    markSigma: 0.04,
    /** 압박: 공에 가까운 수비 1~2명. 압박 거리 = pressDistBase + pressing × pressDistRange */
    pressers: 2,
    pressDistBase: 8,
    pressDistRange: 14,
    /** 복귀 달리기: 공보다 recoverBehind(정규화) 이상 앞에 있으면 확률 recoverBase + 노력/100 × workRateSpeed 로 급히 복귀 */
    recoverBehind: 0.1,
    recoverBase: 0.1,
    workRateSpeed: 0.2,
    /** 내려와서 받기: drop × 이 거리만큼 공 쪽으로 (m) */
    dropDist: 8,
  },

  // ── 온더볼 의사결정 (E.7) ──
  onball: {
    /** value(x, y) = a + b × x^exp × (1 − yk × |y − 0.5|) */
    valueA: 0.02,
    valueB: 0.3,
    valueExp: 3.2,
    valueYk: 0.8,
    tempBase: 0.06,
    tempSlope: 0.25,
    /** 소유 상실 비용 = −(lossBase + 상대 위치 가치 × lossOppScale) */
    lossBase: 0.05,
    lossOppScale: 1.0,
    /** 소유 유지 효용 (압박이 없을 때). 압박이 있으면 holdPressure × 압박만큼 감소 */
    holdValue: 0.02,
    holdPressure: 0.03,
    /** 드리블(공 몰고 전진) 거리 (m) */
    carryDist: 6,
    /** 패스 후보 최대 거리 (m) */
    passMaxDist: 50,
    /** 리시버 앞쪽 리드 (초 × 리시버 속도) */
    leadTime: 0.6,
    /** 공을 몰고 갈 때 최대 속도 배율 */
    carrySpeed: 0.8,
    /** 선택 직후 다음 결정까지 최소 간격 (초) */
    minHold: 0.3,
    /** 효용 스케일: softmax 전에 곱한다 (τ 는 이 스케일 기준) */
    utilityScale: 10,
  },

  // ── 확률 모델 (E.8) ──
  prob: {
    passBase: 1.0,
    passPerM: 0.0055,
    passSkill: 0.18,
    passMin: 0.1,
    passMax: 0.98,
    shortPassMax: 25,
    laneWidth: 1.8,
    laneBase: 0.25,
    laneIntercept: 0.35,
    pressurePenalty: 0.2,
    pressureDist: 3,
    /** 패스 실패 시 인터셉트로 끝나는 비중 (나머지는 루즈볼/아웃) */
    interceptShare: 0.6,
    /** 루즈볼이 된 실패 패스의 착지 오차 σ (m) */
    looseError: 6,
  },

  // ── 경기 (E.8, E.10) ──
  match: {
    /** 홈 팀 능력치 보정 (팀 레이팅 +1.5 상당) */
    homeAttrBonus: 1.5,
  },
  restart: {
    throwInDelay: 6,
    goalKickDelay: 10,
    cornerDelay: 14,
    freeKickDelay: 12,
    goalDelay: 45,
  },

  // ── 골키퍼 (E.9) ──
  keeper: {
    classicMin: 3,
    classicMax: 6,
    sweeperMin: 8,
    sweeperMax: 14,
    /** 공 y 를 따라가는 비율 */
    lateral: 0.25,
  },

  // ── 심판, 수적 열세 (E.10) ──
  referee: {
    shortLine: 0.15,
    shortPress: 0.15,
    shortAttackShift: 0.6,
    shortSafe: 1.15,
    extraLine: 0.05,
    extraPress: 0.05,
  },
} as const;

export type EngineConfig = typeof ENGINE;
