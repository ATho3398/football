// 경기 엔진 상수 (부록 E). 모든 값은 초기값이며 `npm run balance:engine`(E.15 통계 목표)으로 보정한다.
// 기획서 초기값과 다르게 정한 값은 부록 C.9 이후에 기록한다.

export const ENGINE_VERSION = 6;

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
    maxSpeedBase: 6.6,
    maxSpeedSlope: 2.5,
    accelBase: 3.5,
    accelSlope: 2.2,
    turnKeepBase: 0.6,
    turnKeepSlope: 0.4,
    walk: 1.5,
    jog: 3.1,
    run: 5.5,
    /** 목표까지 거리별 이동 강도: 이 거리 이하면 멈춤 / 걷기 / 조깅 / 러닝, 넘으면 스프린트(긴급할 때만) */
    arriveDist: 0.3,
    walkDist: 4.5,
    jogDist: 9,
    runDist: 20,
    /** 긴급하지 않은 먼 이동(runDist 넘게)의 속도 = max(run, 최대 속도 × farPace). 대형 이동은 스프린트가 아니다 (E.20 5번) */
    farPace: 0.9,
    /** 스프린트 판정 속도 비율 (스프린트 횟수 기록) */
    sprintRatio: 0.85,
    radius: 0.5,
    /** 스태미나 소모 = (속도/최대 속도)² × drain × (drainAttrBase − drainAttrSlope × 체력/100) / 초 */
    staminaDrain: 0.016,
    drainAttrBase: 2.2,
    drainAttrSlope: 1.65,
    staminaRecover: 0.0005,
    staminaLowFrom: 60,
    /** 지친 정도에 따른 조깅·러닝 강도 감소 (스태미나 0 일 때 비율) */
    fatigueIntensity: 0.35,
    /** 지친 선수의 최대 속도 비율 (스태미나 0 일 때, staminaLowFrom 에서 1) */
    tiredMaxFloor: 0.85,
    /** 스태미나 0 일 때 역압박 가담·긴급 복귀 판단 확률 배율 (staminaLowFrom 에서 1) */
    tiredFloor: 0.3,
    halftimeRecover: 10,
  },

  // ── 공 (E.4) ──
  ball: {
    groundDecel: 1.2,
    /** 공중볼이 땅에 떨어진 뒤 남는 수평 속도 비율 */
    airBounce: 0.3,
    passSpeedBase: 8,
    passSpeedPerM: 0.55,
    passSpeedMin: 10,
    passSpeedMax: 26,
    /** 공중볼(크로스, 롱볼) 평균 속도 */
    airSpeed: 18,
    /** 슈팅 속도 (능력치와 무관, E.20 7번: 마무리 능력은 마무리 배수 한 곳에서) */
    shotSpeed: 29,
    controlDist: 0.9,
    controlMaxSpeed: 12,
    controlBase: 0.8,
    controlSlope: 0.2,
    controlSpeedPenalty: 0.05,
    /** 소유 직후 공을 다루는 시간(초) */
    receiveTime: 0.9,
    /** 루즈볼을 따라가는 팀별 인원 */
    chasers: 2,
  },

  // ── 팀 전술 층 (E.5) ──
  formation: {
    /** 줄별 x 시프트: [GK, 수비, 중원, 공격] */
    defendShift: [0, -0.06, -0.08, -0.1] as [number, number, number, number],
    attackShift: [0, 0.14, 0.25, 0.1] as [number, number, number, number],
    blockX: 0.45,
    /** 대형이 공을 따라가는 시간 상수 (초) */
    ballSmoothing: 1.5,
    blockY: 0.2,
    /** 수비 시 가로 폭 배율과 공 쪽 쏠림 (블록 압축) */
    defendWidth: 0.65,
    defendBlockY: 0.35,
    /** 측면 폭: 공 반대쪽 측면 선수는 이만큼 중앙으로 좁힌다 */
    narrowFar: 0.05,
    /** 역할 dy(측면 선호) 반영 배율 (정규화 y) */
    roleDyScale: 0.3,
    pressingBase: 0.5,
    pressingPerRating: 0.02,
    pressingMin: 0.3,
    pressingMax: 0.8,
    lineHeightBase: 0.5,
    lineHeightSpread: 0.1,
    /** 수비 라인 x(정규화) = lineBase + (lineHeight − 0.5) × lineRange, 공보다 lineBehindBall m 뒤까지만 */
    lineBase: 0.28,
    lineRange: 0.2,
    lineBehindBall: 4,
    /** 수비 라인 최소 깊이 (정규화) */
    lineMin: 0.11,
    /** 수비 시 중원/공격 줄은 수비 라인에서 이 간격 안으로 (블록 간격) */
    midGap: 0.13,
    attGap: 0.46,
    /** 압박 전술: 수비 시 중원·공격 줄 x 를 pressBlock × (pressing − 0.55) 만큼 올린다 (E.19 ③, 정규화) */
    pressBlock: 0.2,
    /** 빌드업 전술: 지원 간격 배수 = 1 + styleSupport × (0.5 − style) (짧게일수록 가깝게, E.19 ③) */
    styleSupport: 0.5,
    /** 팀 phase: 소유 후 이 시간이 지나면 공격 대형 (초) */
    attackPhaseDelay: 2.5,
  },

  // ── 팀 전술 성향 (E.18 A5, E.19) ──
  tactics: {
    /** 데이터가 없는 팀의 style = clamp(0.5 + stylePerRating × (레이팅 − 리그 평균), styleMin, styleMax) */
    stylePerRating: 0.04,
    styleMin: 0.2,
    styleMax: 0.8,
    /** 리그 평균 레이팅 (주어지지 않을 때, 2018-19 프리미어리그 초기 레이팅 평균 부근) */
    leagueAvg: 75,
    /** 유지·짧은 패스·백패스 효용 × (possBase + possSlope × style), 롱볼·클리어링·최전방 직행 × (directBase − possSlope × style) */
    possBase: 0.85,
    possSlope: 0.3,
    directBase: 1.15,
    /** 롱볼 기준 거리 (m), 최전방 직행: ST/CF 에게 이 거리 이상 전진하는 패스 */
    longBall: 30,
    directForward: 15,
    /** 약팀 대응 (E.20 9번): 상대가 이만큼 이상 강하면, 성향 전환 확률 */
    underdogGap: 5,
    underdogSwitch: 0.5,
    /** 큰 차이 (C.17 결정 4): 상대가 이만큼 이상 강하면 수비 블록/역습 확정, 라인·압박 두 단계 아래 */
    underdogBigGap: 12,
    /** 경기 상황 (E.20 10번): 2골 / 3골 이상 앞선 팀의 위험한 선택(침투 패스, 드리블 돌파, 먼 슛) 효용 배수와 유지 템포 배수 */
    leadRisk2: 0.85,
    leadRisk3: 0.75,
    leadTempo2: 1.15,
    leadTempo3: 1.3,
    /** 먼 슛 기준 (m) */
    farShot: 20,
  },

  // ── 오프더볼 (E.6) ──
  offball: {
    /** 공 소유자와 유지할 간격 (m) */
    supportMin: 12,
    supportMax: 25,
    /** 침투 확률(오프더볼 갱신마다) = run × 공격 위치선정/100 × runChance */
    runChance: 0.035,
    /** 침투 확률에 곱하는 속도 보정 = 1 + runPace × (속도 − 70)/100 (빠를수록 뒷공간을 더 노린다) */
    runPace: 2.5,
    runSeconds: 3,
    /** 침투 중 라인 오차 배율 (오프사이드 빈도) */
    runLineError: 3,
    /** 오프사이드 라인 오차 σ = (100 − 공격 위치선정) × offsideSigma (m) */
    offsideSigma: 0.03,
    markGoalSide: 2,
    /** 마크 위치 방향 = 골 방향 × (1 − markBallSide) + 공 방향 × markBallSide (패스 경로를 막는 쪽) */
    markBallSide: 0.45,
    /** 오프더볼 목표에 더하는 위치 조정 σ (m). 선수가 서 있지 않고 계속 자리를 고친다 */
    jitter: 0.1,
    markSigma: 0.04,
    /** 압박: 공에 가까운 수비 1~2명. 압박 거리 = pressDistBase + pressing × pressDistRange */
    pressers: 2,
    /** 공이 자기 골에서 이 거리 안이면 가까운 2명은 항상 압박 (m) */
    dangerPress: 30,
    /**
     * 박스 앞 수비 블록 (E.20 3번): 공이 자기 골 boxZone m 안이면 수비 라인은 공보다 lineBehindBall m 골 쪽까지 물러나고,
     * 공에 가장 가까운 2명이 압박, CB 1명은 가장 위협적인 ST 에게 stMark m 마크(골과 ST 를 잇는 선상),
     * 나머지 수비수는 박스 안 공간(니어·파 포스트, 페널티 지점)을 덮는다
     */
    boxZone: 25,
    stMark: 1.5,
    /** 수비 주의 집중 (E.20 8번, C.16 결정 1): 대상의 마크 거리 배수, 위협도 거리 기준 (m), 박스 안 가산 (위치로만 고른다) */
    focusMark: 0.75,
    focusRange: 50,
    focusBox: 0.2,
    /** ST 마크는 공이 자기 골 stMarkZone m 안이면 한다 (박스 앞 블록보다 넓게: ST 가 내려와 받는 자리부터) */
    stMarkZone: 25,
    /** 덮는 자리: 니어 / 파 포스트 (골라인에서 m, 골대 중앙에서 y m), 페널티 지점 (m) */
    coverPostDepth: 5,
    coverPostY: 3.5,
    coverSpot: 11,
    /**
     * 커버 섀도 (E.22 A): 첫 압박 선수는 공과 자기 골 사이가 아니라, 가장 위험한 전진 패스 대상(상대 위치 가치가 가장 큰 공 앞쪽 선수)을
     * 등 뒤로 가리는 각도로 선다. 방향 = 골 방향 × (1 − shadowW) + 그 선수 방향 × shadowW, 공에서 shadowGap m
     */
    shadowW: 0.6,
    shadowGap: 1.2,
    /** CDM 스크린 (E.22 A): 수비 시 CDM 1명은 공과 상대 최전방을 잇는 선에서 공 쪽 screenFrac 지점 (수비 라인 앞 screenGap m 보다 앞) */
    screenFrac: 0.5,
    screenGap: 5,
    /** 볼 쪽 마크 (E.22 A): 공이 측면(|y − 0.5| ≥ wideBall)이면 ST 를 맡은 CB 의 위치 방향 = 골 × (1 − stBallSide) + 공 × stBallSide */
    wideBall: 0.2,
    stBallSide: 0.35,
    /** 돌파 후 커버 (E.22 A): 제쳐진 수비수의 가장 가까운 동료가 coverTime 초 동안 돌파한 선수의 골 쪽 coverAhead m 로 */
    coverTime: 2,
    coverAhead: 2.5,
    /** 공격 줄 선수의 압박 거리 배율 */
    attackerPress: 0.4,
    /** 공격 줄 압박 거리 배율 = attackerPress + attackerPressPer × (pressing − 0.55) (압박 전술, E.19 ③) */
    attackerPressPer: 1.2,
    pressDistBase: 8,
    pressDistRange: 14,
    /**
     * 역압박 (E.18 A3): 공을 잃은 순간부터 (counterBase + counterPerPress × pressing)초, 공에서 counterRadius m 안 최대
     * counterMax 명. 가담 확률 = counterJoin + counterJoinPress × 역할 press + counterJoinWork × 노력/100
     */
    counterBase: 3,
    counterPerPress: 2,
    counterRadius: 10,
    counterMax: 3,
    counterJoin: 0.4,
    counterJoinPress: 0.4,
    counterJoinWork: 0.2,
    /** 패스 길 압박 위치: 소유자에서 가까운 동료까지의 비율 */
    counterLane: 0.35,
    /** 복귀: 목표가 자기 골 쪽으로 recoverRun m 이상이면 러닝 이상, recoverSprint m 이상이면 최대 속도 (긴급 복귀 판단 확률 recoverJudge + recoverWork × 노력/100) */
    recoverRun: 10,
    recoverSprint: 25,
    recoverJudge: 0.6,
    recoverWork: 0.4,
    /** 내려와서 받기: drop × 이 거리만큼 공 쪽으로 (m) */
    dropDist: 8,
    /** 2선 늦은 침투 (E.18 A2): 공이 상대 최종 3분의 1 측면이면 침투 성향 미드 1명은 컷백 존, 1명은 박스 경계 바깥 (E.22 B: 시작 0.75 → 크로스 가능 구역 0.68) */
    lateRunFromX: 0.68,
    lateRunWide: 0.2,
    lateRunRun: 0.4,
    /** 컷백 존 (골에서 m, 페널티 아크 부근), 세컨드 볼 위치 (골에서 m) */
    cutbackZone: 15,
    /** 2선 늦은 침투 (E.22 B): 공이 측면이면 침투 미드는 골에서 lateRunDepth m (박스 안) */
    lateRunDepth: 11,
    /** 세트피스 (E.22 B): 코너·측면 프리킥 때 박스에 들어가는 CB 최대 수 */
    setPieceCB: 2,
    /** 공이 최종 3분의 1 중앙일 때 침투 미드가 들어가는 박스 채널 (골에서 m, 중앙에서 y 비율) */
    boxRunDepth: 13,
    /** 윙어: 반대쪽 측면 공이면 먼 포스트 (골에서 m, 중앙에서 y 비율), 중앙 공이면 하프스페이스 */
    backPostDepth: 8,
    backPostSpread: 0.1,
    halfSpaceDepth: 17,
    halfSpaceSpread: 0.18,
    boxRunSpread: 0.12,
    edgeZone: 22,
    /** ST 2명: 니어/파 포스트 (골에서 m, 중앙에서 y 간격 m) */
    postDepth: 6,
    postSpread: 4,
  },

  // ── 온더볼 의사결정 (E.7) ──
  onball: {
    /**
     * 위치 가치 맵 (E.18 A1, 단위 "골 = 1"): 그 위치에서 우리 팀이 공을 가졌을 때 이번 공격이 골로 끝날 확률.
     * value = farC × exp(−d / farK) + nearB × exp(−d / nearK), d = 상대 골 중앙까지 거리 (m).
     * 앵커: 자기 진영 0.01~0.014, 중앙선 약 0.018, 30 m 약 0.031, 25 m 약 0.04, 18 m 약 0.06, 11 m 약 0.11, 골라인 측면 약 0.04.
     * (C.16 결정 3) 먼 쪽 성분을 평평하게 했다 (farK 47.8 → 80, farC 0.045 → 0.035): 30 m 가치는 그대로, 자기 진영·중원의 전진 보상 약 27% 감소
     */
    valueFarC: 0.035,
    valueFarK: 80,
    valueNearB: 0.357,
    valueNearK: 7.6,
    tempBase: 0.06,
    tempSlope: 0.18,
    /** 유지 시 빼앗길 확률: 3 m 안 수비수마다 holdLose × (1 − 거리/3) (독립 합성) */
    holdLose: 0.5,
    /** 드리블(공 몰고 전진) 거리 (m) */
    carryDist: 6,
    /** 패스 후보 최대 거리 (m) */
    passMaxDist: 50,
    /** 리시버 앞쪽 리드 (초 × 리시버 속도) */
    leadTime: 0.6,
    /**
     * 침투 패스 목표 (E.20 4번): 오프사이드 라인 뒤 공간으로. 깊이 = clamp(throughShare × (라인 뒤 공간 − throughStop), throughMin, throughMax) m.
     * 라인이 높을수록 뒷공간이 넓어 달리기 경쟁 거리가 길어진다 (빠른 공격수 유리, 느린 CB 불리)
     */
    throughShare: 0.5,
    throughStop: 8,
    throughMin: 3,
    throughMax: 20,
    /** 컷백 (E.18 A2): 소유자 x ≥ cutbackFromX, 측면 |y − 0.5| ≥ cutbackWide. 대상은 골에서 cutbackMin~cutbackMax m */
    cutbackFromX: 0.88,
    cutbackWide: 0.12,
    cutbackMin: 9,
    cutbackMax: 18,
    /** 포스트플레이: 몸 방향과 공격 방향 각도가 이 값 이상이면 등지고 받음 (도). 레이오프 거리 (m), 버티기 상대 거리 (m) */
    backAngle: 100,
    layoffDist: 8,
    holdupRange: 2.5,
    holdupScale: 16,
    holdupTime: 1.0,
    /** 공을 몰고 갈 때 최대 속도 배율 */
    carrySpeed: 0.8,
    /** 선택 직후 다음 결정까지 최소 간격 (초) */
    minHold: 0.3,
    /** 몰고 가기/돌파 후 다음 결정까지 (초), 유지 시 반응 시간에 더하는 시간 */
    carryTime: 1.0,
    /** 몰고 가기 성공 = 0.98 − 압박 × carryPressure */
    carryPressure: 0.5,
    /**
     * 몰고 가기 실패 (C.17 결정 3): 수비수가 몰고 가는 동안 좁히는 거리 = carryClose(초) × 최대 속도.
     * 공을 지키는 능력(드리블·볼 컨트롤) 10 마다 실패 × exp(−carrySkill)
     */
    carryClose: 0.3,
    carrySkill: 0.3,
    holdTime: 1.0,
    /**
     * 효용 스케일: softmax 전에 곱한다 (C.16 결정 3: 상한을 풀고 4·5·6·8·12 를 측정했다. 1 올릴 때마다 롱패스 비율 −1.7%p, 득점 +0.3골이라 4 유지) (τ 는 이 스케일 기준). 골 단위에서 τ 0.06 선수가 효용 차 0.01골이면 약 60:40,
     * 0.03골이면 약 77:23 (E.18 A1)
     */
    utilityScale: 4,
    /**
     * 판단용 성공 확률 (E.20 1번): P판단 = judgeSelf × P(본인) + (1 − judgeSelf) × P(같은 상황의 리그 평균 선수, 능력치 judgeAvgAttr).
     * 실제 판정은 본인 100%. 능력치가 높은 선수가 자기 능력을 과신해 더 어려운 선택을 하는 선택 효과를 절반으로 줄인다
     */
    judgeSelf: 0.5,
    judgeAvgAttr: 70,
    /** 자기 진영 상실 비용 배수 (C.16 결정 3): 자기 골 라인에서 잃으면 상실 비용 × (1 + lossOwnHalf), 하프라인에서 × 1 */
    lossOwnHalf: 1,
    /** 전환 위험 (E.20 2번): 상실 비용 C = −(상대 기준 위치 가치 + T), T = transitionRisk × (상실 지점보다 상대 골 쪽 우리 필드 선수 수 ÷ 10) */
    transitionRisk: 0.02,
    /** 패스 수신 지원도 (E.20 2번): 받는 자리 가치 × (supportBase + (1 − supportBase) × min(1, 받는 선수 supportDist m 안 동료 수 ÷ supportNeed)) */
    supportBase: 0.7,
    supportDist: 15,
    supportNeed: 2,
    /** 판단 민감도 점검용 배수 (E.15): 위치 가치 맵 전체 / 슛 효용. 기본 1, 측정할 때만 1.05 */
    valueScale: 1,
    shotScale: 1,
  },

  // ── 확률 모델 (E.8) ──
  prob: {
    /** 능력치 체감 S자 곡선 (E.20 11번, sim.ts curveAttr): 꺾이는 점과 그 위 구간 배율 */
    curveKnee1: 80,
    curveKnee2: 90,
    curveMid: 0.7,
    curveTop: 0.4,
    /** 능력치 식의 중심 (리그 평균 선수, E.20): 계수(기울기)를 바꿔도 평균 선수의 확률은 그대로 */
    skillCenter: 70,
    passBase: 1.35,
    passPerM: 0.0055,
    /**
     * 패스 능력치 (E.20 5번): 실패 확률 × exp(−passSkill × (능력치 − skillCenter) / 10). 더하는 식은 쉬운 패스가 상한에 붙어
     * 능력치가 성공률을 바꾸지 못했다. 곱하는 식은 쉬운 패스·어려운 패스 모두에서 능력치가 실패를 같은 비율로 줄인다 (평균 선수는 그대로)
     */
    passSkill: 0.4,
    passMin: 0.1,
    /** 능력치 반영 전 상한 / 반영 후 상한 */
    passMax: 0.97,
    passCap: 0.99,
    /** 침투 패스 달리기 경쟁: 도착 시간 차 1초당 성공 확률 가감, 차의 상한 (초) */
    raceGain: 0.35,
    raceCap: 1.5,
    /** 수비수는 돌아서 뛰어야 한다: 달리기 경쟁에서 수비수 도착 시간에 더하는 시간 (초) */
    raceTurn: 0.3,
    /** 이 거리(m)를 넘는 패스는 공중볼 (착지점 경합) */
    airPass: 30,
    shortPassMax: 25,
    /** 패스 능력치: skillBlendFrom m 까지 숏패스, skillBlendTo m 부터 롱패스, 그 사이는 거리 비례로 섞는다 (E.20 5번) */
    skillBlendFrom: 25,
    skillBlendTo: 45,
    /** 25 m 너머 m당 감쇠 (롱패스 정확도, E3.5 B) */
    longPerM: 0.04,
    laneWidth: 1.8,
    laneBase: 0.25,
    laneIntercept: 0.15,
    /** 레인 위험 × (1 + laneVision × (60 − 시야)/100) */
    laneVision: 1.0,
    pressurePenalty: 0.4,
    /** 받는 선수 압박(마크) 패널티: 성공 확률에서 빼는 값과 위치 가치에서 빼는 값 */
    receiverPressure: 0.3,
    /** 받는 선수 압박 거리 기준 (m) */
    receiverPressureDist: 5,
    pressureDist: 3,
    /** 패스 실패 시 인터셉트로 끝나는 비중 (나머지는 루즈볼/아웃) */
    interceptShare: 0.4,
    /** 루즈볼이 된 실패 패스의 착지 오차 σ (m) */
    looseError: 6,

    // 드리블 1대1 (E.8): L((공격 점수 − 수비 점수)/dribbleScale + dribbleBias + 공간 보정)
    dribbleScale: 22,
    dribbleBias: -0.2,
    /** 앞쪽 이 거리 안에 수비수가 있으면 몰고 가기가 드리블 돌파가 된다 (m) */
    dribbleRange: 3,
    /** 공간 보정: 두 번째 수비수가 가까우면 감점 */
    spaceSecondPenalty: 0.4,
    /** 돌파 성공 후 수비수가 다시 태클할 수 없는 시간 (초, E.22 A: 1.2 → 0.6) */
    beatenTime: 0.6,
    /** 태클에 진 공격수의 공이 수비수 소유가 될 확률 (나머지 루즈볼) */
    tackleKeep: 0.7,
    /** 수비수 태클 시도: 1.5 m 안에서 틱마다 tackleRate × (0.5 + 역할 압박) × (0.5 + 노력/200) × pressing 보정 */
    tackleRange: 1.5,
    tackleRate: 0.0008,
    tackleCooldown: 1.0,

    // 슈팅 (E.8)
    shotMaxDist: 30,
    /** 유효 슈팅이 가는 구석 = 난수 × cornerRange (능력치와 무관) */
    cornerRange: 1.05,
    /**
     * 마무리 배수 (E.20 7번): 골 확률 = 기회의 질(xG: 위치, 각도, 압박, 슈팅 종류, 상대 GK) × clamp(1 + finishPerPoint × (마무리 능력치 − 70), finishMin, finishMax).
     * 결정력 계열 능력치는 이 한 곳에만 들어간다. 유효 슈팅 확률에 곱하므로 골 확률도 같은 배수로 바뀐다
     */
    finishPerPoint: 0.012,
    finishMin: 0.8,
    finishMax: 1.25,
    /** 배수를 곱한 유효 슈팅 확률 상한 */
    shotCap: 0.9,
    shotBase: 0.66,
    shotPerM: 0.015,
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
    blockCorner: 0.7,

    // 헤더 슈팅
    headerBase: 0.58,
    headerPerM: 0.025,
    headerSpeed: 22,

    // 크로스
    crossMinX: 0.68,
    /** 크로스 정확도 = crossBase + crossSkill × (크로스 − skillCenter)/100 − 압박 */
    crossBase: 0.87,
    crossSkill: 1.2,
    /** 크로스가 가까운 수비수에 맞고 코너가 될 확률 */
    crossBlockCorner: 0.3,
    crossWide: 0.25,
    /** 크로스 착지 오차 σ = (100 − 크로스) × crossError (m) */
    crossError: 0.03,
    /** 착지점에서 이 거리 안 선수가 경합 */
    aerialRadius: 2,
    /** 롱패스 착지점에서 받는 선수와 이 거리 안 수비수가 있으면 경합 */
    longContest: 2.8,
    aerialScale: 16,
    /**
     * 크로스 경합에서 공격수 보정 (로지스틱 입력). E.22 B: 크로스 대상과 가장 가까운 수비수가 실제로 착지점으로 뛰어들어 경합이 생기면서
     * 0.9 → −1.0 (수비가 공을 마주 보고 먼저 닿는다. 크로스 성공률 25~30%, 코너 약 30개당 1골에 맞춘 묶음 B 보정)
     */
    aerialAttackBonus: -1.0,
    /** 공격수가 이긴 공중볼을 박스 안 이 거리 안이면 헤더 슈팅 */
    headerMaxDist: 14,
    /** 수비 걷어내기 거리 (m) */
    clearDist: [15, 30] as [number, number],
    clearCorner: 0.5,

    // 클리어링 (수비 3분의 1, 압박이 심할 때)
    clearMaxX: 0.25,
    clearPressure: 0.5,
    clearLength: [35, 55] as [number, number],
  },

  // ── 경기 (E.8, E.10) ──
  match: {
    /**
     * 홈 이점 (E.18 A7, 능력치 가산 대신 세 갈래): ① 판단 품질 + homeJudgement ② 듀얼(드리블, 태클, 공중볼, 버티기) 로짓 + homeDuel
     * ③ 원정 팀 행위의 파울 판정 확률 × awayFoul, 카드 확률 × awayCard. 빠른 경기는 기존 +1.5 레이팅
     */
    homeJudgement: 0.03,
    homeDuel: 0.06,
    awayFoul: 1.08,
    awayCard: 1.15,
    /** 폼 보정(±0.3) → 성공 확률 ±3%p */
    formToProb: 0.1,
    /** 경기 시작 스태미나 = 100 − 피로 × staminaPerFatigue */
    staminaPerFatigue: 0.6,
    /** 이 이동 거리(m)를 뛰면 피로가 BALANCE.fatigue.perMatch90 만큼 오른다 */
    fatigueRefDistance: 10300,
  },
  // ── 세트피스, 교체 (E.10) ──
  setPiece: {
    /** 직접 프리킥 가능 거리 (m), 벽 블록 확률 */
    directMax: 25,
    wallBlock: 0.25,
    /** 직접 프리킥 조건이어도 슛을 고르는 확률 (나머지 크로스/패스) */
    directChance: 0.3,
    /** 직접 프리킥 유효 슈팅 확률 배율 (벽 너머로 차야 한다) */
    directAccuracy: 0.6,
    /** PK 성공 = clamp(penaltyBase + penaltySkill × (키커 − 75)/100 − penaltyKeeper × (선방 − 70)/100) */
    penaltyBase: 0.78,
    penaltySkill: 0.4,
    penaltyKeeper: 0.3,
    /** PK 실패 중 GK 선방 비중 (나머지 빗나감) */
    penaltySaveShare: 0.7,
    /** 코너에서 짧은 패스 비중 */
    shortCorner: 0.12,
  },
  subs: {
    max: 3,
    /** 교체 판단: fromMin~toMin 분 사이 checkEvery 초마다, 스태미나가 threshold 미만인 선수 */
    fromMin: 58,
    toMin: 85,
    checkEvery: 60,
    threshold: 70,
    /** 75분 이후에는 스태미나와 무관하게 이 확률로 교체 (판단마다) */
    lateChance: 0.25,
  },
  /** 재개 대기 시간 (E.18 A4, 초, 시드로 범위 안 추첨). 시계는 계속 가고 선수들은 세트피스 위치로 걸어간다 */
  restart: {
    throwIn: [8, 12] as [number, number],
    goalKick: [15, 25] as [number, number],
    corner: [25, 35] as [number, number],
    freeKick: [20, 35] as [number, number],
    /** 직접 프리킥 거리(setPiece.directMax 안, 골대 중앙 15 m 안) */
    directFreeKick: [40, 60] as [number, number],
    offside: [15, 25] as [number, number],
    /** 골 후 킥오프 */
    kickoff: [45, 75] as [number, number],
    card: [10, 20] as [number, number],
    sub: [20, 40] as [number, number],
    penalty: [60, 90] as [number, number],
    /** 터치라인 아웃 (E.18 A4): 클리어링 방향 산포 σ (도), 태클로 튄 공 속도 (m/s), 측면 경합 바깥쪽 편향 (m/s) */
    clearSpreadDeg: 35,
    tackleBounce: [6, 12] as [number, number],
    wideBias: 3,
  },

  // ── 평점 (E.12) ──
  rating: {
    base: 6.0,
    pass: 0.02,
    forwardPass: 0.05,
    keyPass: 0.15,
    onTarget: 0.1,
    goal: 0.8,
    assist: 0.5,
    dribble: 0.1,
    tackle: 0.1,
    interception: 0.08,
    aerial: 0.05,
    lost: -0.04,
    dangerLost: -0.1,
    foul: -0.05,
    offside: -0.05,
    yellow: -0.2,
    red: -0.8,
    /** 실점 1골당 수비/중원(과 GK) */
    conceded: -0.1,
    /** 수비수(GK 포함) 클린시트, 60분 이상 출전 */
    cleanSheet: 0.25,
    cleanSheetMinMinutes: 60,
    /** GK 세이브 1회 (기획서에 없음, GK 평점이 패스만으로 정해지지 않게) */
    save: 0.12,
    win: 0.2,
    draw: 0,
    loss: -0.2,
    min: 3,
    max: 10,
    /**
     * 포지션별 정규화 (E.12): 평점 = 6.5 + scale × (행동 델타 합 + 결과 − center[포지션군]).
     * center 는 포지션군의 평균 델타 합 (balance:engine 으로 보정), scale 은 전체 σ 약 0.7
     */
    center: { GK: 1.06, CB: 1.33, FB: 1.11, CDM: 2.37, CM: 2.5, CAM: 1.95, WING: 1.62, ST: 2.56 } as Record<string, number>,
    scale: 0.7,
    mean: 6.5,
  },

  // ── 골키퍼 (E.9) ──
  keeper: {
    /** pSave = clamp(saveBase − saveDelta × δ + saveSkill × (선방 − saveCenter)/100, 0.05, 0.95) */
    saveBase: 1.8,
    saveCenter: 75,
    /** 판단용 xG 의 리그 평균 GK (E.18 A1): 선방 / 핸들링 (동레이팅 75 팀 선발 GK 평균) */
    leagueShotStopping: 76,
    leagueHandling: 75,
    /** 쳐낸 공(리바운드)을 공격 팀이 다시 잡을 확률 (판단용 리바운드 기대값) */
    reboundOwn: 0.4,
    saveDelta: 1.1,
    saveSkill: 0.45,
    /** δ = speedW × 속도/30 + cornerW × 구석 + distW × (1 − 거리 계수), 거리 계수 = 거리/distRef */
    speedW: 0.45,
    cornerW: 0.35,
    distW: 0.55,
    distRef: 30,
    /** 캐치 확률 = catchBase + catchSkill × 핸들링/100 (나머지 쳐내기) */
    catchBase: 0.3,
    catchSkill: 0.5,
    /** 쳐낸 공이 코너가 될 확률 */
    parryCorner: 0.5,
    /** 크로스/롱볼 처리: 박스 안이고 GK 와 claimRange 안이면 L((출전 범위 − 60)/12 + claimBias) */
    claimRange: 6,
    claimBias: -3,
    /** 공을 잡은 뒤 배급까지 (초) */
    holdTime: 4,
    classicMin: 3,
    classicMax: 6,
    sweeperMin: 8,
    sweeperMax: 14,
    /** 공 y 를 따라가는 비율 */
    lateral: 0.25,
    /** 각 좁히기 (E.20): 상대가 공을 가지고 박스 안 골에서 rushDist m 안이면 GK 는 공과 골 사이 rushGap m 앞까지 나온다 */
    rushDist: 12,
    rushGap: 1.5,
  },

  // ── 심판, 수적 열세 (E.10) ──
  referee: {
    /** 태클 실패(돌파 허용 포함) 시 파울 확률 */
    tackleFoul: 0.2,
    /** 공중볼 경합 파울 확률 */
    aerialFoul: 0.05,
    /** 압박 몸싸움 파울: 소유자 1 m 안 수비수마다 틱당 확률 */
    contactFoulRate: 0.005,
    contactDist: 1.0,
    /** 수비수가 자기 박스 안에서는 파울을 조심한다 (파울 확률 배율). E.22 B: 0.004 → 0.06 (PK 팀당 경기당 약 0.13, 세트피스 골 비중) */
    boxFoulFactor: 0.06,
    /** 경고를 받은 선수의 파울 확률 배율, 두 번째 경고를 실제로 줄 확률 */
    bookedCare: 0.5,
    secondYellow: 0.5,
    /** 파울 중 옐로 / 직접 레드 비율 */
    yellowShare: 0.14,
    redShare: 0.004,
    /** 어드밴티지: 심판 성향, 보류 시간(초), 공격 3분의 1 구역 완화 배수 */
    advantageBias: 0.14,
    advantageWindow: 4,
    advantageFinalThird: 1.5,
    /** 오프사이드 판단 오차 σ = perceptionBase + (100 − 시야) × perceptionSlope (m) */
    perceptionBase: 0.3,
    perceptionSlope: 0.05,
    /** 패서가 오프사이드 위험을 효용에 반영하는 정도 (1 = 완전 반영) */
    offsideAwareness: 0.3,
    /** 수적 열세 (E.18 A6): 스태미나 소모 배율, 공격수를 내릴 중원 x, 수비형 미드 x, 역압박 최대 인원 */
    shortDrain: 1.15,
    dropToMidX: 0.45,
    holdMidX: 0.33,
    shortCounterMax: 2,
    /** 수적 우세 프리맨: 상대 freeMark m 안에 없으면 프리맨, 소유자에게서 freeMin~freeMax m, 가장 가까운 상대에게서 freeSpace m 이상 */
    freeMark: 5,
    freeMin: 12,
    freeMax: 20,
    freeSpace: 6,
    shortLine: 0.15,
    shortPress: 0.15,
    shortAttackShift: 0.6,
    shortSafe: 1.15,
    extraLine: 0.05,
    extraPress: 0.05,
  },
} as const;

export type EngineConfig = typeof ENGINE;
