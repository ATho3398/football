// 경기 엔진 상수 (부록 E). 모든 값은 초기값이며 `npm run balance:engine`(E.15 통계 목표)으로 보정한다.
// 기획서 초기값과 다르게 정한 값은 부록 C.9 이후에 기록한다.

export const ENGINE_VERSION = 25;

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
  // ── 경기 기록 정의 (C.30, E.12·D.22): 집계 기준만, 엔진 판정에는 쓰지 않는다 ──
  record: {
    /** 결정적 기회 창출: 이 판단용 xG 이상인 슈팅으로 이어진 마지막 패스. 판단용 xG 는 최대 약 0.25 라 0.3 이면 0이 된다 → 팀당 경기당 약 1.7개(실제 리그 평균 1.5~2)가 되는 0.12 (C.30) */
    bigChanceXg: 0.12,
    /** 위험 지역 걷어내기: 자기 골라인에서 이 거리(m) 안, 박스 폭 안 (박스 16.5 m + 박스 앞) */
    dangerDepth: 30,
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
    /** 땅볼 루즈 비행 착지 뒤 최소 속도 (m/s, C.31: 4 → 2 — 느린 빗나간 패스가 착지에서 다시 가속하지 않게) */
    landFloor: 2,
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
    /** 받기 (C.24): 받을 선수가 snapReceive m 안이면 바로 소유, 그 밖이면 reserveRoll m/s 로 굴려 보내고 reserveCatch m 안에서 잡는다.
     * 상대는 reserveSteal m 안에 먼저 닿을 때만 뺏는다. reserveTime 초가 지나면 보통 루즈볼 */
    snapReceive: 1.0,
    reserveRoll: [4, 6] as [number, number],
    reserveCatch: 1.0,
    reserveSteal: 0.9,
    reserveTime: 2.0,
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
    /** 경기 상황 (E.20 10번, C.29 fix2): 2골 / 3골 이상 앞선 팀의 전진 선택(전진 패스, 슛, 드리블·몰고 가기, 크로스) 효용 배수 — 안전 패스·유지는 역수 — 와 유지 템포 배수 (상한 1.6, pending 22) */
    leadRisk2: 0.75,
    leadRisk3: 0.6,
    leadTempo2: 1.3,
    leadTempo3: 1.6,
    /** 점수 차 전술 조정 (C.29 fix2): 이만큼 이상 앞서면 라인·압박 한 단계 아래, 뒤지면 한 단계 위 (시간 조건 없음) */
    leadAdjustGoals: 2,
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
    /** 공이 자기 골에서 이 거리 안이면 첫 압박자는 거리와 무관하게 압박한다 (m). 둘째는 C.75c 부터 커버 (plan) */
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
    /** 상대 ST/CF 가 우리 박스 안에 있으면 공이 자기 골 stMarkZoneBox m 안부터 마크한다 (C.29 fix2 가설 B: fix 브랜치 40 을 박스 안 ST 로 한정) */
    stMarkZoneBox: 40,
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
    /** 돌파 후 커버 (E.22 A): 제쳐진 수비수의 가장 가까운 동료가 coverTime 초 동안 돌파한 선수의 골 쪽 plan.coverBehind m 로 (C.75c) */
    coverTime: 2,
    /** 공격 줄 선수의 압박 거리 배율 */
    attackerPress: 0.4,
    /** 공격 줄 압박 거리 배율 = attackerPress + attackerPressPer × (pressing − 0.55) (압박 전술, E.19 ③) */
    attackerPressPer: 1.2,
    pressDistBase: 8,
    pressDistRange: 14,
    /**
     * 역압박 (E.18 A3): 공을 잃은 순간부터 (counterBase + counterPerPress × pressing)초, 공에서 counterRadius m 안 최대
     * plan.sit.H.pressers[압박 단계] 명 (C.75c, 게겐 gegenMax). 가담 확률 = counterJoin + counterJoinPress × 역할 press + counterJoinWork × 노력/100
     */
    counterBase: 3,
    counterPerPress: 2,
    counterRadius: 10,
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
    /** 세트피스 수비 대인 마크 인원 (E.22 B, 나머지는 지역 수비) */
    setPieceMark: 3,
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
    /**
     * 팀 수비 계획 (C.75c, E.23 개정 44c-a): 공으로 가는 사람은 1명, 둘째는 커버.
     * 상황 판정 A 정돈 / B 역습 복귀 / C 수적 열세 / D 측면 트랩 / E 박스 1대1 / F 크로스 / G 루즈볼 / H 역압박.
     * sit[상황].pressers = 공으로 가는 인원 [압박 낮음, 보통, 높음] (H 는 역압박 가담 상한, 게겐은 gegenMax).
     * 둘째 압박 대상이 아니면 공과 우리 골을 잇는 선에서 공 뒤 coverBehind m 에 선다 (박스 압박 둘째·위험지역 둘째·돌파 후 커버·루즈볼 둘째).
     * 상황은 sitHold 초 이어져야 바뀐다 (G·H·E 는 즉시). 압박 단계 = 실효 pressing 이 levelCut 경계 기준
     */
    plan: {
      coverBehind: 5,
      sitHold: 0.6,
      levelCut: [0.43, 0.68] as readonly number[],
      sit: {
        A: { pressers: [1, 1, 2], double: false },
        B: { pressers: [1, 1, 2], double: false },
        C: { pressers: [1, 1, 2], double: false },
        D: { pressers: [1, 1, 2], double: false },
        E: { pressers: [1, 1, 1], double: false },
        F: { pressers: [1, 1, 2], double: false },
        G: { pressers: [1, 1, 1], double: false },
        H: { pressers: [1, 2, 3], double: true },
      } as Record<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H', { pressers: readonly number[]; double: boolean }>,
    },
  },

  // ── 수비 1대1 판단 (E.23) ──
  defense: {
    /** 공 소유자에서 이 거리(m) 안이면 판단한다. 판단 간격 = duelInterval × (1.5 − 수비 판단 품질) 초 */
    duelRange: 2,
    duelInterval: 0.6,
    /** 뒤에서 하는 태클: 성공 확률 배수, 파울 확률 배수 */
    behindTackle: 0.6,
    behindFoul: 2.5,
    /** 돌파 허용 기본 비용 (골 단위, 앞으로 나간 자리 가치 상승분에 더한다), 박스 밖 파울 비용 */
    beatenBase: 0.01,
    foulCost: 0.02,
    /**
     * 따라붙기(지연)의 가치 (골 단위): 동료가 돌아오고 공격이 느려진다 (C.75c 상황별): 공이 우리 골 jockeyNearDist m 밖이면 jockeyFar(지연 우선),
     * 안이거나 박스 안이면 jockeyNear(붙어서 태클)
     */
    jockeyFar: 0.11,
    jockeyNear: 0.09,
    jockeyNearDist: 25,
    /** 패스길 막기: 가장 위험한 패스 대상 가치 상승분 × laneW − 돌파 허용 비용 × laneRisk */
    laneW: 0.3,
    laneRisk: 0.3,
    /** 박스 안 압박 (E.23, C.75c): 공이 수비 팀 박스 안이면 가장 가까운 1명이 boxPressGap m 까지 붙고 둘째는 커버 (offball.plan) */
    boxPressGap: 0.6,
    /** 수비 자세 (E.23): 1대1에서 바깥쪽으로 몬다. 중앙 쪽 돌파 로짓 − stanceInside, 바깥쪽 + stanceOutside */
    stanceInside: 0.3,
    stanceOutside: 0.1,
  },

  // ── 역할 공용 움직임 모듈 (E.6 D.13, E3.7): 위치와 판단 선호만 바꾼다 (E.1.1 층 3) ──
  roles: {
    /** ① 빈 공간 찾기: 역할 목표 주변 탐색 반경 (m), 이 거리 이상 떨어진 상대는 같은 여유로 본다, 앞쪽 가산 (m당) */
    spaceRadius: 8,
    spaceCap: 8,
    spaceForward: 0.15,
    /** ② 줄 사이: 상대 수비 줄과 미드 줄 사이로 옮기는 비율 (공격 줄·CAM) */
    betweenK: 0.5,
    /** ② 펄스 나인이 있는 팀의 2선 침투 빈도 가산 (비운 중앙으로 뛰어든다) */
    nineVacate: 0.6,
    /** ② 빌드업(공이 이 x 이하, 정규화) 때 하프백은 CB 사이로, 인버티드 풀백은 미드 줄 하프스페이스로, 리베로는 수비-미드 사이로 */
    buildupX: 0.55,
    invertY: 0.2,
    /** ③ 공 요구: 동료가 이 선수에게 주는 패스 효용 배수, 소유자 쪽으로 다가가는 비율 (지원 간격 최소까지) */
    demandPass: 1.1,
    demandApproach: 0.35,
    /** ④ 수비 의무 면제: 수비 때 이 x(정규화) 뒤로 오지 않는다 (중원 줄, 공격 줄), 압박은 공에 가장 가깝고 이 거리 비율 안일 때만 */
    exemptMidX: 0.42,
    exemptAttX: 0.5,
    exemptPress: 0.5,
    /** ④ 커버 재배분: 면제 선수 쪽(슬롯 y)으로 옮기는 비율 (가장 가까운 중원 동료 1명) */
    coverShift: 0.3,
    /** 중거리 슛 선호(pref.longShot)를 적용하는 골까지 거리 (m) */
    longShotDist: 18,
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
    /**
     * 판단 온도 (E.22 C): τ = tempBase × exp(tempSlope × (0.7 − 판단 품질)). 목표는 공격 진영에서 판단 70 선수가 효용 1위를 약 60%,
     * 85 는 약 70%, 55 는 약 45% (tempBase 0.03, tempSlope 3 이면 56 / 69 / 48). 그 값에서 동레이팅 득점 2.37, 슈팅 23.6 이라 (부록 C.18)
     * 기획 결정 전까지 이전 온도(0.06 + 0.18 × (1 − 판단))와 같은 값을 쓴다 (판단 70 → 최선 29%)
     */
    tempBase: 0.114,
    tempSlope: 1.42,
    /**
     * 판단 후보 (E.22 C): 효용 1위에서 plausibleGap(골 단위, 효용 스케일 전) 안의 후보와, 실제로 나오는 실수(유지로 공 끌기,
     * 안전한 백패스, 무리한 슛)만 고를 수 있다. 엉뚱한 선택(먼 옆 패스 등)은 후보에서 뺀다
     */
    plausibleGap: 0.015,
    /** 무리한 슛 (C.29, 진단 12 B0 ①): 슛은 효용 1위에서 mistakeShotGap × plausibleGap 안일 때만 실수 후보로 남는다. 유지·백패스 실수는 그대로 */
    mistakeShotGap: 2,
    /**
     * 시야 제한 (E.22 C): 몸 방향(움직이는 방향, 등지고 받았으면 자기 골 쪽, 서 있으면 공격 방향)에서 visionCone + visionConeSlope × (시야 − 50) 도
     * 밖이거나 옆으로 switchDist m 넘게 가는 패스(반대편 전환)는 scanBase + scanSlope × (시야 − 50)/50 확률로만 보인다.
     * 침투 패스는 throughSeeBase + throughSeeSlope × (시야 − 50)/50 확률로 보인다 (시야 좋은 선수가 더 자주 찾는다)
     */
    /** 슛 효용에 실패 시 상실 비용을 넣는다 (E.22 C, 1 = 넣음, 0 = 이전처럼 xG 만) */
    shotLoss: 1,
    visionCone: 100,
    visionConeSlope: 1,
    switchDist: 30,
    scanBase: 0.3,
    scanSlope: 0.4,
    throughSeeBase: 0.5,
    throughSeeSlope: 0.4,
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
    /**
     * 능력치 곡선 평탄화 (E.24, sim.ts curveAttr): 실효 = curveCenter + curveK × (능력치 − curveCenter), curveLow~curveHigh 구간.
     * curveHigh 이상은 기울기 curveK × curveTopRatio, curveLow 미만은 기울기 curveK. 리그 평균(70) 선수의 실효는 그대로
     */
    curveCenter: 70,
    curveK: 0.6,
    curveLow: 50,
    curveHigh: 90,
    curveTopRatio: 0.5,
    /** 능력치 식의 중심 (리그 평균 선수, E.20): 계수(기울기)를 바꿔도 평균 선수의 확률은 그대로 */
    skillCenter: 70,
    /** C.31: 1.35/0.0055 → 1.36/0.010 (25 m 까지 거리가 성공률에 실제로 들어가게, 진단 12 B4) */
    passBase: 1.36,
    passPerM: 0.010,
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
    longPerM: 0.055,
    /**
     * C.31: longFarFrom m 너머는 longFarPerM 으로 완만하게 (실제 40~50 m 성공률 40~50%: 긴 패스는 이미 공중볼이라 거리보다 경합이 정한다).
     * longFarFrom 을 크게 두면 예전 곡선과 같다
     */
    longFarFrom: 32,
    longFarPerM: 0.015,
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
    /**
     * 1대1 경합 확률의 끝 (E.24 4번, duel.ts duelTail): 드리블·버티기·공중볼 확률이 duelKnee 를 넘으면 duelMax 쪽으로 눕힌다
     * (p' = knee + (max − knee) × tanh((p − knee)/(max − knee)), 아래쪽도 대칭). duelTail 0 이면 끈다
     */
    duelTail: 0,
    duelKnee: 0.6,
    duelMax: 0.7,
    /** 앞쪽 이 거리 안에 수비수가 있으면 몰고 가기가 드리블 돌파가 된다 (m) */
    dribbleRange: 3,
    /** 공간 보정: 두 번째 수비수가 가까우면 감점 */
    spaceSecondPenalty: 0.4,
    /** 돌파 성공 후 수비수가 다시 태클할 수 없는 시간 (초, E.22 A: 1.2 → 0.6) */
    beatenTime: 0.6,
    /** 태클에 진 공격수의 공이 수비수 소유가 될 확률 (나머지 루즈볼) */
    tackleKeep: 0.7,
    // 수비수 태클 시도는 E.23 수비 1대1 판단 (ENGINE.defense, actions defendDuels). 틱마다 고정 확률(tackleRate 0.0008)은 없앴다

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
    /** C.31: 패스 곡선 뒤 유효 슈팅 약 4.2 로 0.71 → 0.665 (선방 saveBase 와 묶음, pending 24 ②) */
    shotBase: 0.665,
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
     * 박스 안 땅볼 패스 수신 경합 (C.29 fix2 가설 B, duel.ts receiveWin): 착지점이 상대 박스 안이고 contestDist m 안에 상대 필드 선수가 있으면
     * P(받음) = L1((볼 컨트롤 0.5 + 근력 0.3 + 민첩 0.2 − (마킹 0.5 + 태클 0.3 + 수비 포지셔닝 0.2)) / receiveScale + receiveBias). 판단(candidates)과 판정(resolveFlight)이 같은 식
     */
    contestDist: 2,
    receiveScale: 16,
    receiveBias: 0.5,
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
  // ── 내 선수 개입: 결정 순간 (E.11, E4) ──
  moments: {
    /** 중요도 s = stakeK × (후보 중 최대 위치 가치 증가분 + 최대 xG) × 경기 중요도 × 긴장도 */
    stakeK: 4.0,
    /** 큰 경기 / 75분 이후 점수 차 1 이하 */
    bigMatch: 1.3,
    tension: 1.3,
    tensionMinute: 75,
    /**
     * "중요한 순간만"(기본) 임계값. 포지션군마다 다르다. C.40: 최소 보장 없이 90% 필터 뒤 경기당 3~8회 안팎(포지션군 평균 약 5~6)이 되게
     * scripts/diag/moment-stakes.ts·balance-moments.ts 로 다시 쟀다 (C.34: ST 0.45, 윙·CAM 0.3, CM 0.18, CDM·FB 0.13, CB 0.2)
     */
    threshold: { ST: 0.45, WING: 0.45, CAM: 0.55, CM: 0.3, CDM: 0.2, FB: 0.15, CB: 0.45 } as Record<string, number>,
    /** 정지 빈도 3단계: 모든 결정 순간 / 중요한 순간만 / 결정적 순간만 (I.17 6번) */
    stopMul: { all: 0.7, important: 1.0, critical: 1.6 },
    /** 한 경기 정지 최대 (90분 기준, 출전 시간에 비례). C.40: 직접 모드 최소 정지 보장은 없앴다 (경기당 0회도 된다) */
    maxStops: 14,
    /**
     * 자동 모드 카드 기회(F.5)만 쓰는 임계값(C.34 값 그대로)과 최소 턴 따라잡기: 기대 턴보다 1 이상 뒤처지면 임계값 × autoCatchUpMul.
     * 직접 모드 정지에는 쓰지 않는다 (C.40, pending 39 5항: 자동 경로는 바꾸지 않는다)
     */
    autoThreshold: { ST: 0.45, WING: 0.3, CAM: 0.3, CM: 0.18, CDM: 0.13, FB: 0.13, CB: 0.2 } as Record<string, number>,
    autoMinStops: 4,
    autoCatchUpMul: 0.5,
    /**
     * 정지 조건 (C.40): 성공 확률이 maxP 를 넘는 선택지는 목록에서 뺀다 ("맡기기"가 할 일). 남은 판정 있는 선택지가 minOptions 개 이상이거나
     * 패에 지금 쓸 수 있는 카드(장면 플레이 카드·장면 확률 카드)가 있을 때만 멈춘다
     */
    maxP: 0.9,
    /** C.75a: 고를 거리(판정 있는 선택지 + 카드가 새로 연 선택지, 맡기기 제외)가 이 수 미만이면 멈추지 않는다 (카드만 있는 1개짜리 정지 없음) */
    minOptions: 2,
    /**
     * C.75a 도박 실패 완화 (pending 128 1항): 직접 모드에서 고른 소유 선택지가 실패해 공을 잃으면, 실패 감점 × clamp(floor + (1 − floor) × p / pRef, floor, 1).
     * 성공 확률이 낮을수록 덜 깎인다 (성공 보상은 그대로). 결정 뒤 첫 소유 변경(reliefWindow 초 안)의 내 공 상실에만 붙는다. 자동·맡기기는 그대로
     */
    failRelief: { floor: 0.3, pRef: 0.5 },
    reliefWindow: 6,
    /** C.75a 슛 자리 보장: 슛 후보 xG(골 확률)가 이 값 이상이면 선택지 3칸에 슛을 넣는다 (밀리면 효용이 가장 낮은 칸과 교체) */
    shotKeepXg: 0.06,
    /** C.75a 개인기 자리 보장: 앞을 막은 수비수 돌파 후보가 있으면 이 포지션군은 드리블 칸을 넣는다 (공격수 우선) */
    dribbleKeepGroups: ['ST', 'WING', 'CAM'] as string[],
    /**
     * C.75k 몰고 가다 슛 (직접 모드 2단 행동): 앞으로 몰고 가기 후보의 도착점 xG 가 shotKeepXg 이상이면 선택지에 넣는다.
     * 표시 확률 = 몰고 가기 성공 × 도착점 xG × carryShootDiscount (수비 위치가 지금 그대로라 낙관이라 할인). 의도는 carryShootWindow 초 동안 산다
     */
    carryShootDiscount: 0.8,
    carryShootWindow: 2,
    /** 카드 장면 정지 (C.40): 공중볼은 내 선수가 착지점 이 거리(m) 안이고 박스 안 착지일 때 */
    reactAerialRange: 9,
    /** 두 정지 사이 최소 간격 (초, 같은 공격에서 연달아 멈추지 않게) */
    gap: 4,
    /** 70분 이후 체력 보정: −(100 − 스태미나)/100 × staminaPenalty (E.11) */
    staminaMinute: 70,
    staminaPenalty: 0.04,
    /** 결과 판정: 정지 후 이 시간(초)이 지나거나 다음 정지가 오면 그때까지의 평점 변화로 */
    outcomeWindow: 6,
    /** 장면 분류: 전환 후 역습 초, 슛 후 리바운드 초, 슛 장면 최소 xG */
    counterTime: 5,
    reboundTime: 2.5,
    shotSceneXg: 0.04,
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
    // ── 골 뒤 세리머니·걸어서 복귀, 재개 키커 (C.24) ──
    /** 세리머니 길이 (초): 득점자는 가까운 코너 쪽으로 celebrateRun m, 가까운 동료 celebrateJoin 명이 반경 celebrateSpread m 안으로 */
    celebrate: [15, 20] as [number, number],
    celebrateRun: [8, 12] as [number, number],
    celebrateJoin: [3, 5] as [number, number],
    celebrateSpread: 1.5,
    /** 복귀 속도: 킥오프 returnMargin 초 전에 도착하는 속도, strollMin(느린 걸음) ~ 러닝 */
    strollMin: 1.0,
    returnMargin: 4,
    /** 키커가 공 takerReach m 안이어야 재개. 늦으면 최대 lateMax 초 미루며 repick 초마다 가장 가까운 선수로 다시 고른다 */
    takerReach: 1.0,
    lateMax: 10,
    repick: 1,
  },

  // ── 평점 (E.12) ──
  rating: {
    base: 6.0,
    pass: 0.02,
    forwardPass: 0.05,
    keyPass: 0.15,
    onTarget: 0.1,
    /** 골·도움은 scale 을 곱해 평점 약 +1.0 / +0.6 (C.26). 골이 된 슈팅은 유효 슈팅으로 따로 세지 않는다 */
    goal: 1.1,
    assist: 0.65,
    dribble: 0.1,
    tackle: 0.1,
    interception: 0.08,
    aerial: 0.05,
    lost: -0.04,
    dangerLost: -0.1,
    /** 상대 진영 마지막 1/3 에서의 공 상실은 lost × 이 비율 (C.26) */
    attackLostFactor: 0.5,
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
    /** 공격 포지션(ST·WING·CAM) 무기여 경기 (C.75f, E-3): 골·도움·키패스·유효슈팅·드리블 성공 모두 0, 45분 이상. scale 0.9 를 곱해 평점 약 −0.3 */
    noContrib: -0.33,
    noContribMinMinutes: 45,
    draw: 0,
    loss: -0.2,
    min: 3,
    max: 10,
    /**
     * 포지션별 정규화 (E.12): 평점 = 6.5 + scale × (행동 델타 합 + 결과 − center[포지션군]).
     * center 는 포지션군의 평균 델타 합 (C.26: 엔진 9 평점 표본 600경기 선발 45분 이상으로 재측정, scripts/diag/rating-parts.ts. C.28: 엔진 11 로 다시 쟀다. C.29: 엔진 12 로 다시 쟀다. C.31: 엔진 14 패스 곡선 뒤 다시 쟀다),
     * scale 은 전체 σ 약 0.75. ST 는 경기당 0.58골이라 평균을 6.5 에 두면 무득점 경기가 6.0 아래로 내려가서 +0.14 (평균 약 6.65)
     */
    center: { GK: 0.99, CB: 0.94, FB: 0.81, CDM: 1.5, CM: 1.78, CAM: 1.51, WING: 1.18, ST: 1.68 } as Record<string, number>,
    scale: 0.9,
    mean: 6.5,
  },

  // ── 골키퍼 (E.9) ──
  keeper: {
    /** pSave = clamp(saveBase − saveDelta × δ + saveSkill × (선방 − saveCenter)/100, 0.05, 0.95). C.29: 슛 선택(mistakeShotGap) 뒤 1.77 → 1.75. C.31: 1.75 → 1.70 (선방률 약 68, 유효 슈팅 득점 전환 약 32%) */
    saveBase: 1.70,
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
    /** 루즈볼 추격 (C.28): 공 경로(chaseHorizon 초)에서 GK 가 닿는 첫 점이 처리 구역(자기 박스, 스위퍼는 박스 밖 sweepRange m 까지) 안이고
     * GK 도착(반응 + 거리/최대 속도)이 가장 빠른 상대보다 chaseMargin 초 이상 빠르고 가장 빠른 동료보다 늦지 않으면 나간다. 이미 나갔으면 여유 chaseKeep */
    chaseHorizon: 4,
    chaseMargin: 0.3,
    chaseKeep: 0,
    /** 스위퍼 박스 밖 범위 (m): 출전 범위·가속 (0.7 : 0.3) 50~90 에 비례 */
    sweepRange: [5, 20] as [number, number],
    /** 박스 안 손 처리 (C.28): 반경 handRange m, 공 속도 handMaxSpeed m/s 이하. 확률 = 캐치 확률 + looseCatchBonus − handSpeedPenalty × 속도/10.
     * 같은 팀이 발로 일부러 준 공(패스·롱패스)은 손을 못 쓴다. 놓치면 공이 몸에 맞고 fumbleSpeed m/s 로 튀고 handBlock 초 동안 다시 손을 못 쓴다 */
    handRange: 1.5,
    handMaxSpeed: 30,
    looseCatchBonus: 0.35,
    handSpeedPenalty: 0.05,
    fumbleSpeed: [1.5, 3.5] as [number, number],
    handBlock: 0.6,
    /** 같은 팀 백패스는 발·몸으로 막는다 (C.28): 반경 footRange m, 보통 컨트롤 식이지만 공 속도 상한은 handMaxSpeed */
    footRange: 1.5,
    /** 루즈볼일 때 GK 오프더볼 갱신 간격 (초, C.28) */
    chaseRefresh: 0.2,
    /** 침투 패스 달리기 경쟁 (C.28): 목표점이 상대 GK 처리 구역 안이면 GK 도착 시간(+throughDelay 초)도 수비 쪽 후보 */
    throughDelay: 0.4,
  },

  // ── 심판, 수적 열세 (E.10) ──
  referee: {
    /** 태클 실패(돌파 허용 포함) 시 파울 확률. C.29 (진단 12 B4): 0.2 → 0.3 (실제 파울의 약 45%가 태클·도전) */
    tackleFoul: 0.3,
    /** 공중볼 경합 파울 확률 */
    aerialFoul: 0.05,
    /** 압박 몸싸움 파울: 소유자 1 m 안 수비수마다 틱당 확률. C.29: 0.005 → 0.0065 */
    contactFoulRate: 0.0065,
    contactDist: 1.0,
    /** 수비수가 자기 박스 안에서는 파울을 조심한다 (파울 확률 배율). E.22 B: 0.004 → 0.06 (PK 팀당 경기당 약 0.13, 세트피스 골 비중). C.29: 0.04 (파울 상수를 올려도 PK 유지) */
    boxFoulFactor: 0.04,
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
