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
    arriveDist: 0.3,
    walkDist: 2.5,
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
    attackShift: [0, 0.14, 0.12, 0.1] as [number, number, number, number],
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
    /** 수비 라인 최소 깊이 (정규화) */
    lineMin: 0.06,
    /** 수비 시 중원/공격 줄은 수비 라인에서 이 간격 안으로 (블록 간격) */
    midGap: 0.13,
    attGap: 0.46,
    /** 팀 phase: 소유 후 이 시간이 지나면 공격 대형 (초) */
    attackPhaseDelay: 2.5,
  },

  // ── 오프더볼 (E.6) ──
  offball: {
    /** 공 소유자와 유지할 간격 (m) */
    supportMin: 12,
    supportMax: 25,
    /** 침투 확률(오프더볼 갱신마다) = run × 공격 위치선정/100 × runChance */
    runChance: 0.035,
    runSeconds: 3,
    /** 오프사이드 라인 오차 σ = (100 − 공격 위치선정) × offsideSigma (m) */
    offsideSigma: 0.03,
    markGoalSide: 2,
    /** 오프더볼 목표에 더하는 위치 조정 σ (m). 선수가 서 있지 않고 계속 자리를 고친다 */
    jitter: 0.6,
    markSigma: 0.04,
    /** 압박: 공에 가까운 수비 1~2명. 압박 거리 = pressDistBase + pressing × pressDistRange */
    pressers: 2,
    /** 공이 자기 골에서 이 거리 안이면 가까운 2명은 항상 압박 (m) */
    dangerPress: 30,
    /** 공격 줄 선수의 압박 거리 배율 */
    attackerPress: 0.4,
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
    valueB: 0.22,
    valueExp: 3.2,
    valueYk: 0.8,
    tempBase: 0.06,
    tempSlope: 0.25,
    /** 소유 상실 비용 = −(lossBase + 상대 위치 가치 × lossOppScale) */
    lossBase: 0.05,
    lossOppScale: 1.0,
    /** 소유 유지 효용 (압박이 없을 때). 압박이 있으면 holdPressure × 압박만큼 감소 */
    holdValue: 0.054,
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
    /** 몰고 가기/돌파 후 다음 결정까지 (초), 유지 시 반응 시간에 더하는 시간 */
    carryTime: 1.0,
    /** 몰고 가기 성공 = 0.98 − 압박 × carryPressure */
    carryPressure: 0.5,
    holdTime: 1.0,
    /** 드리블 돌파 효용에서 빼는 값 (위험/체력 비용) */
    dribbleCost: 0.012,
    /** 효용 스케일: softmax 전에 곱한다 (τ 는 이 스케일 기준) */
    utilityScale: 10,
  },

  // ── 확률 모델 (E.8) ──
  prob: {
    passBase: 1.003,
    passPerM: 0.0055,
    passSkill: 0.8,
    passMin: 0.1,
    passMax: 0.98,
    shortPassMax: 25,
    laneWidth: 1.8,
    laneBase: 0.25,
    laneIntercept: 0.25,
    pressurePenalty: 0.2,
    pressureDist: 3,
    /** 패스 실패 시 인터셉트로 끝나는 비중 (나머지는 루즈볼/아웃) */
    interceptShare: 0.58,
    /** 루즈볼이 된 실패 패스의 착지 오차 σ (m) */
    looseError: 6,

    // 드리블 1대1 (E.8): L((공격 점수 − 수비 점수)/dribbleScale + dribbleBias + 공간 보정)
    dribbleScale: 16,
    dribbleBias: -0.1,
    /** 앞쪽 이 거리 안에 수비수가 있으면 몰고 가기가 드리블 돌파가 된다 (m) */
    dribbleRange: 4.5,
    /** 공간 보정: 두 번째 수비수가 가까우면 감점 */
    spaceSecondPenalty: 0.4,
    /** 돌파 성공 후 수비수가 다시 태클할 수 없는 시간 (초) */
    beatenTime: 1.2,
    /** 태클에 진 공격수의 공이 수비수 소유가 될 확률 (나머지 루즈볼) */
    tackleKeep: 0.7,
    /** 수비수 태클 시도: 1.5 m 안에서 틱마다 tackleRate × (0.5 + 역할 압박) × (0.5 + 노력/200) × pressing 보정 */
    tackleRange: 1.5,
    tackleRate: 0.00085,
    tackleCooldown: 1.0,

    // 슈팅 (E.8)
    shotMaxDist: 30,
    shotBase: 0.37,
    shotSkill: 0.35,
    shotPerM: 0.012,
    shotPressure: 0.15,
    shotMin: 0.05,
    shotMax: 0.85,
    longShotFrom: 20,
    /** 골문이 보이는 각도가 이 값(rad) 미만이면 유효 슈팅 확률을 비례해서 줄인다 */
    shotAngleRef: 0.3,
    /** 슈팅 콘(공-골대 사이) 안 수비수 1명당 블록 확률, 최대 */
    blockPer: 0.15,
    blockMax: 0.4,
    coneWidth: 1.2,
    /** 블록된 공이 라인 밖(코너)으로 나갈 확률 */
    blockCorner: 0.45,
    /** 슈팅 효용 = xG × shotValue (위치 가치와 같은 단위로) */
    shotValue: 0.585,

    // 헤더 슈팅
    headerBase: 0.3,
    headerSkill: 0.4,
    headerPerM: 0.025,
    headerSpeed: 15,

    // 크로스
    crossMinX: 0.68,
    /** 크로스 효용 = P × 헤더 가치 × crossValue + (1 − P) × 상실 비용 × crossLossScale */
    crossValue: 9.5,
    /** 크로스가 가까운 수비수에 맞고 코너가 될 확률 */
    crossBlockCorner: 0.2,
    crossLossScale: 0.3,
    crossWide: 0.25,
    /** 크로스 착지 오차 σ = (100 − 크로스) × crossError (m) */
    crossError: 0.05,
    /** 착지점에서 이 거리 안 선수가 경합 */
    aerialRadius: 2,
    /** 롱패스 착지점에서 받는 선수와 이 거리 안 수비수가 있으면 경합 */
    longContest: 1.8,
    aerialScale: 12,
    /** 공격수가 이긴 공중볼을 박스 안 이 거리 안이면 헤더 슈팅 */
    headerMaxDist: 14,
    /** 수비 걷어내기 거리 (m) */
    clearDist: [15, 30] as [number, number],
    clearCorner: 0.4,

    // 클리어링 (수비 3분의 1, 압박이 심할 때)
    clearMaxX: 0.25,
    clearPressure: 0.5,
    clearLength: [35, 55] as [number, number],
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
    /** pSave = clamp(saveBase − saveDelta × δ + saveSkill × (선방 − 60)/100, 0.05, 0.95) */
    saveBase: 1.39,
    /** 슛/크로스 판단에 쓰는 체감 세이브 기본값 (실제 세이브 상수와 분리해 보정을 독립시킨다) */
    perceivedSaveBase: 1.43,
    saveDelta: 1.1,
    saveSkill: 0.3,
    /** δ = speedW × 속도/30 + cornerW × 구석 + distW × (1 − 거리 계수), 거리 계수 = 거리/distRef */
    speedW: 0.45,
    cornerW: 0.35,
    distW: 0.2,
    distRef: 30,
    /** 캐치 확률 = catchBase + catchSkill × 핸들링/100 (나머지 쳐내기) */
    catchBase: 0.3,
    catchSkill: 0.5,
    /** 쳐낸 공이 코너가 될 확률 */
    parryCorner: 0.5,
    /** 크로스/롱볼 처리: 박스 안이고 GK 와 claimRange 안이면 L((출전 범위 − 60)/12 + claimBias) */
    claimRange: 6,
    claimBias: -1.6,
    /** 공을 잡은 뒤 배급까지 (초) */
    holdTime: 4,
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
