// 경기 엔진 상수 (부록 E). 모든 값은 초기값이며 `npm run balance:engine`(E.15 통계 목표)으로 보정한다.
// 기획서 초기값과 다르게 정한 값은 부록 C.9 이후에 기록한다.

export const ENGINE_VERSION = 56;

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
    /**
     * C.77x 이동 제어기 앞먹임 (공통 규칙 로드맵 2단계): 움직이는 목표(추적·마크·압박 대상)를 따라갈 때 원하는 속도 = 목표 속도(tvx, tvy) × feed + 거리 보정 속도,
     * 합을 최고 속도로 자른다. 목표 점도 tv × feed 로 움직인다. 0 = 꺼짐(옛 "점으로 가는" 제어기)
     */
    /** 지금 0(꺼짐): 켜면(1) 같은 시드 scoring 30골+ 0·리그 1.24 (부록 C.77x). 기준 장면은 켠 값(tests/scenes/harness.ts MOTION_ON)으로 돈다 */
    feed: 1,
    /** 인지 지연 (초): 목표 속도가 따라가는 사람의 실제 속도를 따라잡는 시간 상수 */
    feedLag: 0.25,
    /** 따라갈 때 거리 보정 속도 하한 = feedGain × 목표까지 거리 (m/s, 정지 감속 √(2·가속·거리)·최고 속도 안) */
    feedGain: 2,
    /**
     * C.77x 뒤돌기 (turnModel 1 = 켬, 0 = 옛 동작: 반대 방향이면 속도 × turnKeep 즉시): 빠르게(faceSpeed 넘게) 달리면 몸 방향 = 속도 방향.
     * 반대로 가려면 reverseBrake × 가속 × turnKeep 로 감속하고, 느려지면 몸을 돌린다(180° = pivotBase − pivotSlope × 민첩/100 초, 90° 안으로 돌 때까지 가속 없음)
     */
    /** 지금 0(꺼짐, 켠 값 1 — 부록 C.77x) */
    turnModel: 1,
    faceSpeed: 1.5,
    pivotBase: 2.2,
    pivotSlope: 2.2,
    reverseBrake: 2,
    /** C.77x 판단용 도착 시간: 1 = arrivalTime(이동과 같은 운동 규칙), 0 = 옛 거리 / 최고 속도 (침투 경합은 + raceTurn) */
    /** 지금 0(꺼짐, 켠 값 1): 켜면 engine:check 평점 CAM 6.77 ✗ (부록 C.77x) */
    arrivalModel: 1,
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
    /** 피로 시작 스태미나 (C.76s 44h-c2: 60 → 70, 75분+ 선발 대부분이 걸리도록). 아래 tiredRatio = 1 − 스태미나/staminaLowFrom */
    staminaLowFrom: 70,
    /** C.76s 가설 2: 지친 선수의 경합(duelEdge) −tiredDuel × tiredRatio (드리블·태클·버티기·수신·공중볼 공통) */
    tiredDuel: 0.4,
    /** C.76s 가설 1: 압박 전술 스태미나 소모 배수 = pressDrainBase + pressDrainPer × pressing (옛 0.95 + 0.15p: 균형 1.03 / 높음 1.07 → 0.6 + 0.75p: 낮음 0.83 / 균형 1.01 / 높음 1.20 — 처방 0.85 + 0.35p 는 끝 스태미나 54 로 부족) */
    pressDrainBase: 0.6,
    pressDrainPer: 0.75,
    /** C.77a 가설 1(44h-h): 역압박 가담 중(counterPressers, 역압박 창 안) 스태미나 소모 배수 — 3명이 4초 전력 질주하는 비용, 모든 팀 공통 */
    counterDrain: 1.5,
    /** 지친 정도에 따른 조깅·러닝 강도 감소 (스태미나 0 일 때 비율) */
    fatigueIntensity: 0.35,
    /** 지친 선수의 최대 속도 비율 (스태미나 0 일 때, staminaLowFrom 에서 1) */
    tiredMaxFloor: 0.85,
    /** 스태미나 0 일 때 역압박 가담·긴급 복귀 판단 확률 배율 (staminaLowFrom 에서 1) */
    tiredFloor: 0.3,
    halftimeRecover: 10,
    /**
     * 2단 체력 (C.78w, 사용자 제안 "피파식"): 순간 체력 burst 0~100 + 경기 체력(stamina).
     * ① 순간 체력: 스프린트(속도 > 최대 속도 × sprintRatio) 중 초당 100 / 지속 초 씩 준다 — 지속 초 = secBase + secSlope × ((가속 + 체력) / 2 − 70) / 100 (secMin~secMax).
     *    lowFrom 아래에서 최고 속도가 maxSpeed × runCap(스프린트 판정 아래 = 러닝 상한) 쪽으로 내려가고, 0 에 닿으면 outUntil 까지 다시 찰 때까지 질주 불가(러닝 상한).
     *    스프린트가 아니면 초당 100 / refillSec × (걷기 이하 walkMul · 조깅 이하 jogMul · 그 위 runMul) 씩 다시 찬다.
     * ② 경기 체력이 순간 체력 상한(capFloor ~ 100)·재충전 속도(refillFloor ~ 1)를 경기 체력 비례로, 가속(accelFloor ~ 1)을 staminaLowFrom 아래에서 깎는다(최고 속도는 tiredMaxFloor).
     * ③ 판단(자기 순간 체력만): burstReady = (순간 체력 − judgeLo) / (judgeHi − judgeLo) (0~1) — 둘째 압박자는 순간 체력 pressMin 이상만,
     *    역압박 가담 × burstReady, 긴급 복귀 × (recoverFloor + (1 − recoverFloor) × burstReady), 침투 질주 확률 × (runFloor + (1 − runFloor) × burstReady).
     * on 0 = 끔(옛 1단 체력)
     */
    burst: {
      on: 1,
      secBase: 12.5,
      secSlope: 10,
      secMin: 10,
      secMax: 15,
      lowFrom: 10,
      outUntil: 25,
      runCap: 0.78,
      refillSec: 45,
      walkMul: 1.5,
      jogMul: 1,
      runMul: 0.3,
      capFloor: 0.5,
      refillFloor: 0.5,
      accelFloor: 0.85,
      judgeLo: 20,
      judgeHi: 55,
      pressMin: 35,
      recoverFloor: 0.5,
      runFloor: 0.4,
    },
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
    /** 슈팅 속도 (능력치와 무관, E.20 7번: 마무리 능력은 마무리 배수 한 곳에서). C.78n: 25 시험(quick 600 2.13 → 1.85)은 장면 ④ 빠른 컷백 선방 0.34·⑬·㉘ 슛 선택을 깨서 되돌림.
     *  C.78p: 29 → 27 — 판단 보정(decide.bias.shoot)과 짝(슛 선택은 보정이 지킴). 25 는 12 m 밖 선방 86% · 1대1 골 < 0.25(availRef 0.2 위) */
    shotSpeed: 27,
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
  // ── 수신·첫 터치 공통 규칙 (C.78b, 공통 규칙 로드맵 5단계 2차) ──
  // **켬(사용자 2026-10-23 09:00 "움직임이 더 중요", 밸런스는 마지막 단계; 끈 값 0 · 0 · 0 = 옛 동작)**: 켜면 quick 600 득점 1.42 → 1.91 ✗(하나씩 quick 300: 정지 시간 1.85 · 원터치 1.67 · 달리며 받기 1.41),
  // 슈팅 22.4 → 27.9/경기·1대1 3.3 → 7.0%·xG 보정은 ±15% 안(새 찬스는 실제로 좋은 찬스) — 총량 맞추기는 로드맵 마지막 단계 (부록 C.78b)
  receive: {
    /**
     * 정지 시간 차등 (0 = 옛 동작 receiveTime + 반응 × 0.5 ≈ 1.1초 고정). 1 이면 패스 수신의 정지 시간 =
     * clamp(base − touchSkill × (볼 컨트롤 − 70)/100 + ballSpeed × max(0, 공 속도 − 12)/10 + press × 압박(3 m 안 가까울수록) + back × 등지고 받음 − run × 달리며 받음 + 반응 × reactMul, min, max).
     * 앞을 보고 압박 없이 받는 좋은 첫 터치는 짧고, 등지고 빠른 공을 압박 속에서 받으면 길다
     */
    timeModel: 1,
    base: 0.5,
    touchSkill: 0.6,
    ballSpeed: 0.08,
    press: 0.3,
    pressDist: 3,
    back: 0.25,
    run: 0.1,
    reactMul: 0.3,
    min: 0.3,
    max: 1.1,
    /** 방향 전환 첫 터치 (timeModel 1): 수신 때 pressDist 안 상대가 있으면 정지 시간 동안 그 반대쪽(앞쪽으로 기움)으로 turnAway m 받아 놓는다. 달리며 받으면 진행 방향으로 계속 몬다 */
    turnAway: 1.5,
    /** 돌아서기 (C.78e ②): 등지고 받았어도 원터치가 아니고 이 거리(m) 안에 상대가 없으면 정지 시간 동안 돌아선다 (앞을 보고 다음 결정). 0 = 끔 */
    turnFree: 4,
    /** 침투 패스를 받을 선수의 달리기 목표 = 도착점 + 패스 방향 runOn m (0 = 옛 동작: 도착점에서 멈춤, 받을 때 속도 2.3 m/s) */
    runOn: 3,
    /** runOn 일 때 침투 패스 도착점에서 달리는(3 m/s+) 받을 선수가 이 거리(m) 안이면 굴려 보내지 않고 바로 받는다 */
    runSnap: 2.5,
    /**
     * 미리 정하기 (0 = 끔): 땅볼 패스가 날아오는 동안 받는 선수가 다음 행동을 미리 고른다(받는 순간 인지된 상황, 판단력·시야는 choose 그대로).
     * 원터치 행동(패스·침투·컷백·레이오프·슛)을 고르면 다음 틱에 바로 실행하고, 그 실행 성공은 원터치 배수 otMul 로 판정(같은 패스 판정 식·같은 shotModel):
     * otMul = clamp(1 − otBase − otSpeed × max(0, 공 속도 − 12)/10 − otPress × 압박 + otSkill × (볼 컨트롤 − 70)/100, otMin, 1).
     * 원터치가 아니면(유지·몰기·돌파) 공을 멈추고 timeModel 정지 시간 뒤 다시 정한다. 컨트롤 쪽 후보는 정지 시간 동안 다가오는 압박만큼 ctrlCost 를 뺀다
     */
    oneTouch: 1,
    otBase: 0.06,
    otSpeed: 0.05,
    otPress: 0.12,
    otSkill: 0.25,
    otMin: 0.6,
    ctrlCost: 0.25,
    ctrlClose: 4,
  },

  /**
   * 전환 순간 (C.78g): 역습이 통하는 원리 = 뺏긴 팀이 흐트러져 있다. 성공률·속도 버프 없이 판단 시각과 판단 가치만 바꾼다. 0 이면 각 동작 꺼짐(옛 동작).
   */
  transition: {
    /**
     * 뺏긴 팀 혼란: 오픈 플레이로 공을 잃은 순간 잃은 팀 필드 선수의 다음 오프더볼 판단을 lossMax − (lossMax − lossMin) × q 초 늦춘다
     * (q = clamp(((판단력×100 + 수비 위치선정)/2 − lossRef0)/(lossRef1 − lossRef0), 0, 1)). 그동안은 잃기 전 목표(공격 자리)로 계속 움직인다 — 다시 보는 시간.
     * 앞에서 압박하던 선수의 몸 돌리기는 이동 규칙(C.77x 뒤돌기) 그대로
     */
    lossDelay: 1,
    lossMin: 0.3,
    lossMax: 0.5,
    lossRef0: 40,
    lossRef1: 90,
    /**
     * 뺏은 선수의 첫 판단 (오픈 플레이 탈취 — 가로채기·태클·루즈볼, GK·내 선수 제외): 1 이면 탈취 순간 미리 정하기(C.78b receive.oneTouch 와 같은 식) —
     * 바로 하는 행동(원터치 패스·침투·컷백·레이오프·슛)을 고르면 정지 없이 실행, 다루기를 고르면 수신 정지 시간 뒤 다시 정한다 (0 = 옛 동작: 늘 정지 시간)
     */
    winPre: 1,
    /**
     * 뺏은 팀 즉시 전진: 최전방(C.78a 출구)·출구 침투·역습 지원 선수는 그 순간 바로 다시 판단하고(오프더볼 갱신 대기 없음),
     * 앞을 보고 있던(몸 방향 · 공격 방향 ≥ startFace) 선수는 공격 방향 startRun × 최고 속도로 이미 달리며 출발한다 (0 = 끔)
     */
    startRun: 0.6,
    startFace: 0.3,
    /**
     * 뒤 공간 가치 (판단 효용만, 성공 확률 무변경): spaceFwd(정규화) 이상 앞으로 가는 패스·침투 패스의 받는 자리 가치를, 받는 곳보다 골 쪽에 있는 상대 필드 선수가
     * spaceBack 명보다 적으면 받은 뒤 빈 곳으로 몰고 갈 거리 spaceRun × (1 − 골 쪽 인원/spaceBack) m (상대 골 spaceStop 정규화 앞까지) 앞의 위치 가치로 본다 (0 = 끔)
     */
    space: 1,
    spaceFwd: 0.12,
    spaceBack: 5,
    spaceRun: 30,
    spaceStop: 0.85,
    /**
     * 역습 상황 보너스 (사용자 2026-10-24 00:3x "역습 상황에 보상 점수를 좀 더"): 오픈 플레이 탈취 뒤 counterTime 초 동안
     * k = (공보다 우리 쪽에 남은 상대 필드 선수 몫) × (1 − 상대 오프사이드 라인 정규화 높이) 일 때, 앞으로 가는 패스·침투·몰기·돌파 후보 효용에
     * min(counterCap, counterBonus × k × 전진(정규화) × 판단 성공 확률) 을 더한다. 실패할 롱볼은 성공 확률만큼만 받는다 (0 = 끔)
     */
    counterBonus: 0.5,
    counterTime: 4,
    counterCap: 0.03,
    /** 몰고 가기에도 같은 뒤 공간 가치 (앞으로 몰 때만, 빈 곳으로 더 몰 거리 = spaceCarry × spaceRun 식, 0 = 끔) */
    spaceCarry: 0,
  },

  // ── 팀 전술 층 (E.5) ──
  formation: {
    /** 줄별 x 시프트: [GK, 수비, 중원, 공격] */
    defendShift: [0, -0.06, -0.08, -0.1] as [number, number, number, number],
    attackShift: [0, 0.14, 0.25, 0.1] as [number, number, number, number],
    blockX: 0.45,
    /** C.76s 44h-c2: 압박 전술일수록 블록이 공을 더 따라 움직인다 — 수비 시 blockX·blockY × (1 + pressFollow × (pressing − 0.55)) (압박 높음 = 더 뛰고 더 닳는다) */
    pressFollow: 3.0,
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
    /** C.76k: 0.2 → 0.3 (단계당 약 3 → 4.7 m: 매우 낮음 20 m · 낮음 23.6 · 보통 29.4 · 높음 34) — 약팀이 실제로 내려앉게 */
    lineRange: 0.3,
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
    /** 선택 폭 성향 비례 (C.77k, 44h-f3c): style ≤ styleDirectAt 면 중원도 넓게(빠르게 앞으로), ≥ styleMixedAt 면 gapFloor·tempFloor 까지 좁힌다 */
    styleDirectAt: 0.2,
    styleMixedAt: 0.5,
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
    /** 압박받는 소유자의 지원 간격 (C.78g): 소유자에게 가장 가까운 상대가 supportPressDist m 안이면 supportMin × (1 − supportPress × (1 − 거리/supportPressDist)) (0 = 끔) */
    supportPress: 0.5,
    supportPressDist: 6,
    /** 침투 확률(오프더볼 갱신마다) = run × 공격 위치선정/100 × runChance */
    runChance: 0.035,
    /** 침투 확률에 곱하는 속도 보정 = 1 + runPace × (속도 − 70)/100 (빠를수록 뒷공간을 더 노린다) */
    runPace: 2.5,
    runSeconds: 3,
    /**
     * 수신 움직임 (C.77y, 공통 규칙 로드맵 3단계 B2). 0 이면 각 동작 꺼짐(옛 동작).
     * ⒜ 받으러 나오기: 같은 편 소유자가 checkPassMax m 안이고 내 checkMark m 안에 상대가 있으면 마커 반대쪽 옆으로 checkDist m (공 쪽으로 checkToBall 몫)
     */
    /** 지금 0(꺼짐, 켠 값 4 · giveGoChance 0.6 · swapShare 0.6 · abortLane 0.35): 켜면 quick 득점 1.49 ✗ (부록 C.77y) */
    checkDist: 4,
    checkMark: 2,
    checkPassMax: 35,
    checkToBall: 0.3,
    /** ⒝ 주고 달리기(2:1): 상대 진영에서 성공 패스를 한 선수(줄 2·3, run ≥ giveGoRun)가 받은 지 giveGoT 초 안에 giveGoChance × 공격 위치선정/100 확률로 받은 선수 마커의 뒤(공격 방향 giveGoDepth m, 패서 쪽 giveGoLane m)로 침투 */
    giveGoChance: 0.6,
    giveGoT: 1.0,
    giveGoRun: 0.3,
    giveGoDepth: 8,
    giveGoLane: 4,
    /** ⒞ 자리 교환: 같은 줄 동료가 자기 자리에서 swapDrop m+ 내려와 있으면 그 자리에 가장 가까운 같은 줄 동료(swapRange m 안) 1명이 그 자리 쪽으로 swapShare 만큼 (팀에 한 번에 1명) */
    swapShare: 0.6,
    swapDrop: 8,
    swapRange: 22,
    /** ⒟ 침투 취소: 침투 중 소유자 → 나 패스 길 위험이 abortLane 이상이거나 오프사이드 라인보다 abortOffside m+ 앞이면 침투를 멈추고 라인 abortBack m 안쪽으로 되돌아 나온다 (0 = 끔) */
    abortLane: 0.35,
    abortOffside: 1.5,
    abortBack: 1.5,
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
    /** C.77x: 위치 오차(errX/Y)를 새로 뽑는 최소 간격 (초). 오프더볼 갱신마다 새로 뽑으면 목표가 초당 4~5회 수 m 씩 뛴다 (§9.15.12). 0 = 옛 동작(갱신마다) */
    /** 지금 0(꺼짐, 켠 값 0.5): 켜면 quick 600 득점 1.46 ✗ (부록 C.77x) */
    errHold: 0.5,
    /** 압박: 공에 가까운 수비 1~2명. 압박 거리 = pressDistBase + pressing × pressDistRange */
    pressers: 2,
    /** 둘째 압박자가 공으로 가는 거리 = pressDist × secondPressDist. 압박 높음(pressLevel 2)이면 역할 압박 성향과 무관하게 둘째도 공으로 (C.76s 44h-c2 가설 1, plan.sit 의 pressers 2 를 실제 2명으로) */
    secondPressDist: 0.6,
    /** 공이 자기 골에서 이 거리 안이면 첫 압박자는 거리와 무관하게 압박한다 (m). 둘째는 C.75c 부터 커버 (plan) */
    dangerPress: 30,
    /**
     * 비행 중 수신자 압박 (C.76k 단계 B, §9.10 가설 1): 상대 패스가 떠 있고 착지점이 우리 골 closeDownZone m 안이면
     * 우리 필드 선수 중 착지점 도착 시간이 가장 짧은 1명(위협 1위 마커·GK·면제 역할 제외)이 착지점에서 우리 골 쪽 closeDownGap m 로 바로 나간다.
     * 비행이 끝나면 기존 압박 분기(rank 0)가 이어받는다 — 상태 변수·난수 없음. 자유로운 슛의 95% 가 "받고 2초 안"(§9.10a)
     */
    closeDownZone: 25,
    closeDownGap: 1.5,
    /**
     * 깊은 블록 전용 (C.76p 44h-c, §9.11.1 가설 1 — 밀집을 패스가 뚫지 못하게): 성향 block/bus 인 팀만. 상대 땅볼 패스(outcome receive)의 착지점이
     * 우리 골 closeDownZone 안이면 수신자 압박 담당·위협 1위 마커·GK·면제를 뺀 필드 선수 중, 남은 패스 선 위 가장 가까운 점(선에서 deepCutReach m 안)에
     * 공보다 먼저 닿는 선수가 있으면 도착이 가장 빠른 1명이 그 점으로 간다(cutter). 공이 그 선수 deepCutRadius m 안을 지나면 한 비행에 1회
     * deepCutP × (1 + deepCutSkill × (가로채기 − 60)/100) 로 가로챈다(실패하면 그 비행은 그대로). 패스 순간의 laneRisk 판정(onball.ts)과 별개 — 패스 뒤에 선에 들어간 선수만
     */
    deepCutReach: 4,
    deepCutRadius: 1.0,
    deepCutP: 0.6,
    deepCutSkill: 0.5,
    /**
     * 깊은 블록 받는 순간 밀착 (C.76p 가설 2): block/bus 팀의 수신자 압박은 위협 1위 마커를 빼지 않고(마커가 가장 빠르면 마커가 나간다) 간격 deepCloseDownGap m,
     * 수신자가 ST/CF 면 도착 둘째도 착지점에서 우리 골 쪽 deepCloseDownSecond m 로 간다. 둘째 ST(위협 2위 ST/CF)가 박스 + deepSecondStZone m 안이면 남은 수비수 중 가장 가까운 1명이 골 쪽 stMark 로 마크
     */
    deepCloseDownGap: 1.0,
    deepCloseDownSecond: 3,
    deepSecondStZone: 4,
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
    /**
     * 위협 가중 수비 (C.76a, 미해결 8·11 — 사용자 제안): 마커 수는 늘리지 않고 이미 있는 주의를 마무리 좋은 선수 쪽으로 옮긴다.
     * 능력 계수 = clamp((finishSkill(슈팅) − focusAbilityCenter) / focusAbilityRange, −0.5, 1) (85 짜리 ST 0.75, 생성 75 팀 ST 약 0.25).
     * focusThreat 위협도 += focusAbilityW × 계수 (85 짜리 +0.22 = 골에서 11 m 더 먼 자리에서도 위협 1위; C.76w 가설 3 의 0.5 는 효과 없어 되돌림)
     * C.78q: 0.3 → 0 — 마무리 능력이 오르면 집중 1위가 ST 로 옮겨 ST 슛 −16%·골 −2~−8%(미해결 1 반응 뒤집힘). 엘리트 몫은 focusTight·focusDoubleMin 이 맡는다
     */
    focusAbilityW: 0,
    focusAbilityCenter: 70,
    focusAbilityRange: 20,
    /** 위협 1위의 마크 거리 = stMark × focusMark × (1 − focusTight × 계수) (85 짜리 ≈ 0.9 m, 약한 마무리는 조금 느슨; C.76w 가설 3 의 0.45 는 같은 시드 scoring 30골+ 3.3 → 4.1 로 효과 없어 되돌림) */
    focusTight: 0.3,
    /** 계수 ≥ focusDoubleMin 이면 둘째 수비(더블팀) 조건의 박스를 focusDoubleExtra m 넓히고, 박스 안 2선 마크(boxManMax)보다 더블팀이 먼저다 (C.76w 엘리트 가드) */
    focusDoubleMin: 0.5,
    focusDoubleExtra: 5,
    /**
     * 박스 안 2선 마크 (C.76w 가설 1, 미해결 8·11 — 수비 자원을 ST 한 명에서 박스 안 2선으로 재배정, 공격 코드 무수정): 박스 + boxManSlack m 안에
     * 마커 없는 다른 상대(줄 ≥ 2 전부 — CAM·CM 침투자 포함)가 있으면 둘째 수비는 위협 1위 더블팀 대신(엘리트 focusDoubleMin 이상은 더블팀 유지) 그중 줄 2 먼저·위협도 순 1위를,
     * boxManMax 명까지 1명씩 골 쪽 stMark 로 마크한다. 없을 때만 지금처럼 더블팀. 줄 2 존 마크도 마커 있는 focus 는 뺀다.
     * **지금은 0(끔, 부록 C.76w)**: 2 는 quick 600 득점 비율 ST 30 → 35~36 이지만 미드 35 → 38~39·윙 20 → 14~15 로 2선 몫이 오히려 늘고(마크가 2선 득점을 못 막음),
     * 같은 시드 scoring 30골+ 1.6 → 3.3~4.1·득점왕 중앙값 31 → 37~38 로 분포 가드 ✗ — 미해결 8·11 유지. 0 이면 (a)(b)(c) 모두 엔진 32 와 같다
     */
    boxManMax: 0,
    boxManSlack: 3,
    /**
     * 2선 침투자 "좁은 추적" (C.77b 44h-i, 8대 §9.15, 미해결 8·11 — 사용자 결정 "전면 마크 아님: 박스로 뛰는 2선을 CDM 또는 가장 가까운 CM 이 따라붙는다").
     * 대상 = 상대 줄 2(CDM/CM/CAM) 중 소유자 아님 · 우리 골 trackZone m 안(유지는 +3 m 히스테리시스) 또는 이동 목표가 골 trackTargetZone m 안이고 자신은 목표보다 3 m 이상 멀리(들어오는 중).
     * 위협 순으로 팀당 trackMax 명. 추적자 = 우리 줄 2 CDM(홀딩 CM) → CM(LM/RM·CAM·줄 1 제외), 압박 rank 0·둘째 압박자·역압박·커버·수신자 압박·면제·이미 추적 중은 뺀다.
     * 침투자 쪽(같은 측면) CDM 이 trackCdmMax m 안이면 그 CDM, 아니면 가장 가까운 후보가 trackPickMax m 안일 때만(멀리서 끌려오지 않게 — 전면 마크와 갈리는 지점).
     * 배정은 trackHold 초 유지 뒤에도 침투자가 대상 조건을 만족하는 동안 유지, 존 +3 m 밖 trackRelease 초·소유 바뀜·리스타트·침투자가 소유자·추적자가 압박 담당이 되면 해제.
     * 자리 = 침투자와 우리 골을 잇는 선에서 골 쪽 trackGap m(박스 밖 trackGapOut), 공이 측면이면 stBallSide 만큼 공 쪽, 선읽기 trackLead 초 × 수비 포지셔닝/100 × 침투자 속도, 오차 markSigma × (100 − (마킹+포지셔닝)/2).
     * 거리 > trackUrgent m 면 urgent. lineX + midGap 상한·스크린·coverShiftY 를 적용하지 않는다(추적자는 박스까지 들어간다). 수비 줄(boxDefense)·공격 코드 무수정. trackMax 0 = 끔(엔진 33 과 같다)
     */
    trackZone: 22,
    /**
     * 가설 2 ① (§9.15.4, 시간) 측정 뒤 끔 (C.77b): 24(목표가 24 m 안으로 잡히는 순간부터; 공격 'edge' 22 가 들어오므로 CDM 포지션 공격수는 ⓑ 에서 뺀다 trackTargetNoCdm 1) + trackLead 0.8 + trackRunUrgent 1 + trackHandoff 1 은
     * runner-track 40 받는 순간 ≤ 1.5 m 28 → 28% · ≤ 3 m 70 → 70%(추적자 자신의 거리 5.8 → 4.5 m 만), gap 120 CAM 골 0.33/0.35 → 0.35/0.33 — 가설 1 뒤 ≤ 3 m 가 65% 위라 처방 조건 미충족·효과 없음 → 20 / 0.5 / 0 / 0
     */
    trackTargetZone: 20,
    trackTargetNoCdm: 0,
    /**
     * 8대 §9.15.6 ② 는 1 로 시작을 권했지만, 측정(C.77b)은 1 은 줄 대응(lineTiers 1)과 함께만 재어 30골+ 2.40 ✗ 였고 2(줄 대응 없음)가 같은 시드 scoring 통과(30골+ 1.80 · MID 최다 19.6 · 상위 10 CAM 0.8) → 2
     * 줄 대응 (a0, 사용자 원칙 "상대 1선은 최후방이, 2·3선은 수미·중미가"): 존 마크 후보를 줄로 짝짓기(우리 줄 1 ↔ 상대 줄 3, 줄 2 ↔ 줄 2, focus 쏠림은 줄 1 만). **0 = 끔**:
     * 켜면 CAM 골은 그대로(gap 120 0.33/0.35 → 0.33/0.32)이고 줄 2 가 ST 에서 빠져 ST 골 0.34/0.31 → 0.38/0.36·quick ST 31 → 34, 같은 시드 scoring 30골+ 1.80 → 2.40 ✗ (C.76w 의 "ST 풀림" 통로)
     */
    trackMax: 2,
    /**
     * CB 따라나옴 (C.77d 가설 2, §9.13.5 사용자 13:22 "상대 수비 판단은 따라 나갈까 결정에만"): 상대 공격 줄이 실제 라인(오프사이드 라인)보다 stepOutMin~stepOutReach m 앞(줄 사이)에 있고
     * 공이 우리 골 stepOutBall m 범위면 그에게 가장 가까운 CB 가 p = clamp(stepOutBase + stepOutDecoy × 미끼 − stepOutJudge × 판단, stepOutP) 로 따라 나간다
     * (미끼 = 다른 상대가 CB decoyZone m 안에서 우리 골 쪽으로 decoySpeed m/s 이상, 판단 = (수비 위치선정 − 50) / 40). 결정은 stepOutHold 초 유지, 나가면 전술 라인 앞 최대 stepOutMax m. stepOutMax 0 = 끔.
     * C.77d 조정 1: 처방의 2~7 m(전술 라인 기준)은 포처(라인 앞 2.7 m)가 펄스 나인보다 더 자주 걸려(판단 구간 32 대 14%) 실제 라인 기준 4~12 m 로
     */
    /**
     * C.77d 조정 2: 처방 p(base 0.35·판단 0.45)는 위치선정 77 안팎 CB 에서 미끼 없을 때 0.05 라 판단 구간 따라감 3% → base 0.75·판단 0.6 (판단 구간 CB 2 m+ 앞 6 → 22%, 위치선정 55 대 90 = 33 대 19%).
     * C.77d 때 꺼 둔 이유: 켜면 `role-pair 800 ST` 짝 조건 두 시드 펄스 나인 대비 −0.04/−0.09(가설 1 만 −0.02)·2선 골 포처 팀 대비 +0.06/+0.03(가설 1 만 +0.12)이고
     * 모든 팀 CB 에 걸려 다른 ST 역할 득실이 ±0.06~0.08 흔들림 — 나간 CB 의 빈자리를 2선이 제때 못 쓴다. → C.78e 에서 켬(7): 중원 먼저 판단(stepOutMidLead)·실제 라인 기준 한계·받는 공격수도 판단 + 빈자리 침투(gapRun)와 함께
     */
    stepOutMin: 4,
    stepOutReach: 12,
    stepOutMax: 7,
    /**
     * CB 따라나옴 판단 (C.78e ②, 펄스 나인 연결): 우리 중원 줄 누가 CB 보다 stepOutMidLead 초 이상 먼저 닿으면 p × (1 − 판단 × stepOutMidCut)(중원이 압박, CB 는 라인),
     * 아니면 p + 판단 × stepOutAlone. stepOutMidLead 0 = 끔(C.77d 판단 그대로)
     */
    stepOutMidLead: 0.3,
    stepOutMidCut: 0.8,
    stepOutAlone: 0.4,
    /** CB 빈자리 침투 (C.78e ②): 따라 나간 CB 가 나머지 수비 줄보다 gapOpen m 앞이면 그 채널로 gapReach 초 안에 가장 먼저 닿는 2선·측면 1명이 침투. gapRun 0 = 끔 */
    gapRun: 1,
    gapOpen: 3,
    gapReach: 4,
    stepOutBall: [25, 52] as [number, number],
    stepOutBase: 0.75,
    stepOutDecoy: 0.35,
    stepOutJudge: 0.6,
    stepOutP: [0.05, 0.9] as [number, number],
    stepOutHold: 1.5,
    decoyZone: 12,
    decoySpeed: 1,
    lineTiers: 0,
    trackCdmMax: 9,
    trackPickMax: 12,
    trackHold: 0.7,
    trackRelease: 0.5,
    trackGap: 1.5,
    trackGapOut: 2.0,
    trackLead: 0.5,
    trackUrgent: 2,
    /** 가설 2 ①: 침투자가 urgent(뛰는 중)이면 추적자도 항상 urgent (1). 측정 뒤 0 */
    trackRunUrgent: 0,
    /** 가설 2 ② 비행 중 인계 (1): 추적 중인 침투자에게 패스가 떠 있으면 수신자 압박 담당(closeDownPick)은 도착 시간과 무관하게 그 추적자. 측정 뒤 0 */
    trackHandoff: 0,
    /** 커버 섀도 대상 가치 × (1 + focusShadowW × 계수): 패스 길 차단이 엘리트 쪽으로 */
    focusShadowW: 0.5,
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
    counterBase: 4,
    counterPerPress: 2,
    counterRadius: 14,
    counterJoin: 0.4,
    counterJoinPress: 0.4,
    counterJoinWork: 0.2,
    /** 패스 길 압박 위치: 소유자에서 가까운 동료까지의 비율 */
    counterLane: 0.35,
    /**
     * 전환 수비 (C.78a, 공통 규칙 로드맵 5단계). 모두 0 = 끔(C.77z 와 같은 동작). 켜는 값은 tests/scenes/harness.ts TRANSITION_ON.
     * ① pressBreak 1: 역압박이 뚫리면(상대 소유자가 가담자 모두보다 pressBreakGap m 이상 우리 골 쪽, 또는 그렇게 착지할 상대 패스가 떠 있음) 그 순간 역압박을 끝내고
     *    가담자는 긴급 복귀로 다시 판단한다(복귀 시간은 이동·뒤돌기 규칙 그대로 — 자리를 비운 비용). 창(counterUntil)이 남았다고 계속 쫓지 않는다.
     * ② lineHold > 0 (G1): 역압박이 살아 있는 동안 수비 라인을 잃는 순간의 높이(상한 lineHold, 정규화 x)로 유지한다. 뚫리거나 창이 끝나면 지금처럼 내려온다.
     * ③ restMark 1: 잃은 뒤 restWindow 초 동안 역압박에 안 간 수비 줄·공 뒤 중원이 공보다 앞(우리 골 쪽)의 위협 상대를 위협 순으로 한 명에 한 명 맡는다 —
     *    마크 자리(1초 뒤 상대 자리의 골 쪽 1.5 m)에 그 상대보다 restSlack 초 안에 닿는 수비만, 아무도 못 닿으면 가장 빨리 닿는 수비가 골 쪽 restCoverGap m 커버 자리로.
     * ④ trackReach 1: 2선 추적 배정(trackPlan)도 닿을 수 있는 후보만(침투자 목표점 도착이 침투자 + trackReachSlack 초 안), 못 닿으면 다음 후보·없으면 배정 안 함(존이 맡음).
     * ⑤ exitRun 1 (G2): 열린 경기에서 공을 빼앗은 팀은 최전방(출구)을 남기고 공보다 앞 공격·측면 선수 중 빈 곳(가장 가까운 상대 거리 × (0.5 + 침투 성향)) 순 exitRunners 명만 1회 침투(runUntil).
     */
    pressBreak: 1,
    pressBreakGap: 2,
    lineHold: 0.55,
    restMark: 1,
    restWindow: 4,
    restSlack: 0.4,
    restCoverGap: 6,
    restMax: 4,
    trackReach: 1,
    trackReachSlack: 0.5,
    exitRun: 1,
    exitRunners: 1,
    /** 출구 침투자의 달리는 길 y = 중앙 + (자기 길 − 중앙) × exitLane (골 쪽 안쪽 대각선) */
    exitLane: 0.4,
    /**
     * 깊은 블록 밀집 (C.78d ①, 버스·블록·역습 성향): compact 1 이면 상대가 공을 가진 채 공이 우리 골 compactFrom m 안일 때
     * 수비·중원 줄의 y = 중앙 + (슬롯 y − 중앙) × 성향 폭(TENDENCY.compactW) + (공 y − 중앙) × compactFollow — 공 쪽으로 좁게 쏠린 블록(먼 쪽 측면은 비운다).
     * 버스·블록은 중원 줄 x 를 수비 라인 + 성향 간격(busGap·blockGap)에 고정(위로도 아래로도) — 박스 앞 존을 막는 두 줄. 0 = 끔
     */
    compact: 1,
    /**
     * 슛 레인 막기 (C.78h): 공을 가진 상대가 우리 골 laneRange m 안이면 공에 가장 가까운 수비(압박자, 소유자보다 골 쪽에 있을 때만 — 뒤에서 쫓으면 옛 압박)는 공으로 바로 가지 않고 슈터가 찰 만한 구석 쪽 슛 길 위
     * 슈터 앞 clamp(골까지 × laneGapPer, laneGapMin, laneGapMax) m 에 선다(박스 안이면 defense.boxPressGap, 옛 박스 압박 거리). 찰 만한 쪽 = 그 구석으로 차는 발의 약발 배율 + 몸 방향(그 구석 방향과의 cos × laneFace)
     * + GK 반대편 laneGk, 같으면 주발 쪽(오른발 = 공격 방향 왼쪽). 판단력이 낮으면 반대쪽으로 읽는다(확률 laneMiss × (1 − (수비 위치 선정 + 가로채기)/200), 판단 주기마다 새로).
     * 둘째(공에 둘째로 가까운 수비)는 남는 쪽 길 위 압박자 + laneCoverGap m(박스 안은 옛 커버 거리 plan.coverBehind) — 그 자리까지 laneCoverReach m 안일 때만(아니면 옛 커버 자리). 나머지는 그대로. 0 = 끔
     */
    laneBlock: 1,
    laneRange: 25,
    laneGapPer: 0.07,
    laneGapMin: 1.2,
    laneGapMax: 2.5,
    laneCoverReach: 8,
    laneCoverGap: 2,
    laneMiss: 0.6,
    laneFace: 0.1,
    laneGk: 0.05,
    compactFrom: 50,
    compactFollow: 0.4,
    /** 밀집 중 중원 줄 마크 비중 (평소 0.65 — 존 자리와 마크 자리 사이) */
    compactMark: 0.25,
    /** 밀집 중 박스 안 미마크 상대 마크 인원 (버스·블록, C.76w boxManMax 를 깊은 블록에만 — 평소 0) */
    deepBoxMan: 3,
    /** 줄 사이 수신 (C.78d ①): 소유자가 수비 라인 ~ 중원 줄 + holdSlack m 사이면 중원 줄은 압박·커버 2명 말고 밀집 자리를 지킨다 */
    holdSlack: 3,
    /**
     * 탈취 뒤 역습 지원 (C.78d ②): supportRun 1 이면 버스·블록·역습 팀이 자기 절반에서 열린 경기로 뺏을 때, 출구 침투(exitRun) 다음으로
     * 공에 가장 가까운 2선(중원·측면, 공 앞뒤 무관·소유자·최전방 제외) TENDENCY.supportRunners 명이 측면 길(중앙 ± supportLane)로 1회 침투(runUntil).
     * 같은 창(TENDENCY.counterWinTime) 동안 버스·블록도 역습과 같은 전진·침투 패스 배수(counterWinMul) — 첫 패스는 전진 출구. 0 = 끔
     */
    supportRun: 1,
    supportLane: 0.28,
    supportSeconds: 5,
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
    /** 2선 늦은 침투 (E.22 B): 공이 측면이면 침투 미드는 골에서 lateRunDepth m (박스 안, 페널티 지점).
     * C.76x(44h-g) 측정: 17(박스 꼭대기)·15 는 CAM 골 → ST 로 옮기지만(MID 최다 27.2 → 20.9) 같은 시드 scoring 30골+ 1.70 → 2.60 / 2.10(관문 ≤ 2.0 ✗) — 11 유지 */
    lateRunDepth: 11,
    /** 세트피스 (E.22 B): 코너·측면 프리킥 때 박스에 들어가는 CB 최대 수 */
    setPieceCB: 2,
    /** 세트피스 수비 대인 마크 인원 (E.22 B, 나머지는 지역 수비) */
    setPieceMark: 3,
    /** 공이 최종 3분의 1 중앙일 때 침투 미드가 들어가는 박스 채널 (골에서 m, 중앙에서 y 비율; C.76x 측정 19·17 ✗, lateRunDepth 와 같은 이유로 13 유지) */
    boxRunDepth: 13,
    /** 윙어: 반대쪽 측면 공이면 먼 포스트 (골에서 m, 중앙에서 y 비율), 중앙 공이면 하프스페이스 */
    backPostDepth: 8,
    backPostSpread: 0.1,
    halfSpaceDepth: 17,
    halfSpaceSpread: 0.18,
    boxRunSpread: 0.12,
    edgeZone: 22,
    /**
     * 측면 미드 도착 (C.78e ①): 중원 줄 LM/RM 이 공이 상대 진영 wideFromX(정규화)를 넘으면 역할 자리로 — 반대쪽 측면 공 = 먼 포스트, 같은 쪽 = 오버랩(소유자 앞 overlapAhead m, 터치라인 wideTouch)
     * 또는 언더랩(소유자 앞 underlapAhead m 이상·하프스페이스; 풀백이 공을 가졌거나 소유자보다 wideFbAhead m 뒤까지 바깥으로 올라와 있거나 소유자가 터치라인 wideTouch 밖이면),
     * 중앙 공 = 넓은 역할은 깊이 잡은 측면·안쪽 역할은 하프스페이스. 도착 예상이 wideLate 초보다 늦으면 전력. wideArrive 0 = 끔
     */
    wideArrive: 1,
    wideFromX: 0.45,
    /** 넓게 머무는 자리의 깊이: 오프사이드 라인 wideDepth m 뒤 (윙어처럼 마지막 줄을 잡는다) */
    wideDepth: 2,
    wideLate: 1,
    overlapAhead: 8,
    underlapAhead: 6,
    wideFbAhead: 5,
    wideTouch: 0.42,
    /**
     * 풀백 오버래핑 (C.78i ②): 우리 팀이 공을 갖고 공이 fbOverlapFromX(정규화) 이상일 때, 풀백(LB/RB/LWB/RWB, 줄 사이 역할 제외)은
     * 자기 앞 측면 길(자기 x + fbOverlapAhead m, 터치라인 wideTouch)의 fbOverlapFree m 안에 상대가 없으면, 판단마다
     * fbOverlapChance × 측면 배수 × 침투 성향(run / 0.5) × 성향 배수(fbOverlapTend) × 체력(스태미나 fbOverlapTired 아래면 비례로 줄어듦) 확률로
     * (측면 배수: 그 측면 상대 윙어가 면제 역할이 아니고 fbTrackDist m 안이면 따라 내려오므로 fbOverlapTracked, 높이 남은 크랙형·빈 측면은 1)
     * fbOverlapSeconds 초 동안 공 앞 fbOverlapAhead m 측면 길(오프사이드 라인 안쪽)로 전진한다. 한 팀에 한 번에 한 쪽만.
     * 남은 수비(같은 줄 다른 수비 + CDM, 공보다 우리 골 쪽)가 우리 골 쪽에 남은 상대 공격 인원 + fbOverlapRest 보다 적으면 나가지 않는다(높이 남은 윙어가 풀백을 묶음).
     * 수비 쪽: 면제 아닌 측면 선수는 자기 측면으로 오버래핑하는 상대 풀백(fbTrackDist × 1.5 m 안)을 골 쪽 fbTrackGoal m 에서 따라 내려온다. 0 = 끔
     */
    fbOverlap: 1,
    fbOverlapFromX: 0.4,
    fbOverlapTracked: 0.3,
    fbTrackDist: 22,
    fbTrackGoal: 1.5,
    fbOverlapAhead: 10,
    fbOverlapFree: 9,
    fbOverlapChance: 0.25,
    fbOverlapSeconds: 5,
    fbOverlapTired: 60,
    fbOverlapRest: 1,
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
    betweenK: 0.3,
    /** ② 펄스 나인이 있는 팀의 2선 침투 빈도 가산 (비운 중앙으로 뛰어든다) */
    nineVacate: 0.6,
    /**
     * 펄스 나인 짝 (C.77d 가설 0, §9.13.5 사용자 13:18): AI 팀이 펄스 나인을 쓰는데 run ≥ nineMateRun 인 CM/CAM 이 없으면 마지막 자동 CM 을 박스투박스로.
     * 펄스 나인은 내려와 CB 를 끌어내는 체계라 그 공간에 들어갈 공격형 미드가 있어야 한다 (내 팀은 사용자 선택이라 안 건드림)
     */
    nineMateRun: 0.5,
    /**
     * 펄스 나인 인계 (C.77d 가설 1, §9.13.5): 팀의 유일한 ST/CF 가 줄 사이 역할(between)이고 오프사이드 라인보다 nineDeepGap m 이상 뒤에 내려와 있으면
     * 최종 3분의 1 의 2선 러너(컷백 러너와 같은 선정)는 컷백 존 대신 9번 자리(라인 0.5 m 앞, 중앙)로 들어간다. 0 이하 = 끔
     */
    nineDeepGap: 4,
    /** ② 빌드업(공이 이 x 이하, 정규화) 때 하프백은 CB 사이로, 인버티드 풀백은 미드 줄 하프스페이스로, 리베로는 수비-미드 사이로 */
    buildupX: 0.55,
    invertY: 0.2,
    /** ③ 공 요구: 동료가 이 선수에게 주는 패스 효용 배수, 소유자 쪽으로 다가가는 비율 (지원 간격 최소까지) */
    demandPass: 1.1,
    demandApproach: 0.35,
    /** ④ 수비 의무 면제: 수비 때 이 x(정규화) 뒤로 오지 않는다 (중원 줄, 공격 줄), 압박은 공에 가장 가깝고 이 거리 비율 안일 때만 */
    exemptMidX: 0.42,
    /**
     * C.78e ③ 시험(되돌림): 0.62 로 올리면 크랙형 대비 +0.05 → +0.12 — 높이 남은 윙어가 상대 풀백을 묶어 비용이 아니라 이득.
     * C.78i ①: 윙어 평소 수비 깊이(약 0.61) 위 0.62 — 면제가 실제로 작동하고, 비용은 상대 풀백 오버래핑(offball.fbOverlap)으로 낸다
     */
    exemptAttX: 0.62,
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
    /** C.76s 가설 2: 지친 선수의 판단 온도 τ × (1 + tiredTemp × tiredRatio) — 효용 1위 밖을 더 고른다 */
    tiredTemp: 0.6,
    /**
     * 판단 후보 (E.22 C): 효용 1위에서 plausibleGap(골 단위, 효용 스케일 전) 안의 후보와, 실제로 나오는 실수(유지로 공 끌기,
     * 안전한 백패스, 무리한 슛)만 고를 수 있다. 엉뚱한 선택(먼 옆 패스 등)은 후보에서 뺀다
     */
    plausibleGap: 0.015,
    /**
     * 가치 비례 gap·온도 (C.77i, 44h-f3b, 미해결 2): vScale = 공 위치 가치 / 골 scaleRefDist m 중앙 가치. gap × clamp(vScale, gapFloor, 1),
     * τ × clamp(vScale, tempFloor, 1). 중원은 효용 스케일이 0.01~0.02 라 절대 gap 0.015 가 그럴듯한 후보를 거의 균등 추첨했다.
     * C.77i 실패(미배포): 처방 0.3 은 모든 전술 롱패스 5~10% 로 과함, 0.9 가 측정 중 가장 나았지만 직선형 하한 ✗ (부록 C.77i)
     */
    scaleRefDist: 25,
    /** 바닥은 팀 빌드업 성향 비례 (C.77k, 44h-f3c): k = clamp((style − tactics.styleDirectAt)/(styleMixedAt − styleDirectAt), 0, 1), 바닥 = 1 − (1 − floor) × k */
    gapFloor: 0.8,
    tempFloor: 0.4,
    /** 무리한 슛 (C.29, 진단 12 B0 ①): 슛은 효용 1위에서 mistakeShotGap × plausibleGap 안일 때만 실수 후보로 남는다. 유지·백패스 실수는 그대로 */
    mistakeShotGap: 2,
    /**
     * 백패스 가치 (C.77y, 공통 규칙 로드맵 3단계 B1): 1 = 짧은 백패스를 isMistake 실수 풀에서 빼고 백패스 후보 효용에 가치 항을 더한다, 0 = 옛 동작
     * (30 m 미만 뒤로 2 m+ 패스는 효용과 무관하게 항상 실수 후보). 가치 항 = 압박 탈출 + 보존 × 보존 가중 + 반대편 전환 × 보존 가중 − 기회 비용 × 비용 가중 (골 단위, 효용에 그대로 더함)
     */
    /** 지금 0(꺼짐, 켠 값 1): 켜면 quick 득점 1.42 → 1.93 · engine:check 득점 2.02 ✗ (부록 C.77y) */
    backModel: 1,
    /**
     * 착지점 몫 (C.78c ②, 공통 규칙): 1 = 롱패스(30 m+) 실패분·걷어내기의 판단이 실행과 같은 규칙 — 착지 시각에 양 팀 필드 선수 가장 빠른 도착(arrivalTime,
     * 착지 전 도착은 착지 시각으로) 차로 우리 팀이 먼저 닿을 몫 = 1 / (1 + exp(−(상대 − 우리) / landScale)). 0 = 옛 동작(실패 = 착지점 상실, 걷어내기 p 0.45 고정).
     * 상대 라인이 높아 착지점이 비면 몫이 크고(압박을 건너뛰는 롱볼), 깊은 블록 쪽으로 차면 작다 — 성향 상수가 아니라 상대 배치에 반응
     */
    landShare: 1,
    landScale: 0.6,
    /** 되찾은 세컨드볼의 가치 몫: 착지점 루즈볼은 경합 중이라(다음 결정 전 다시 빼앗길 수 있음) 그 자리 가치의 일부만 (롱패스 실패분에만).
     *  판단 전용 항(candidates() 패스 효용만, 실행 무관). C.78q: 0.4 → 0.1 — 짧게 지키는 점유 가치가 가치표에 안 보여 롱이 21% 로 많던 것을 판단 보정(롱 15%, 롱 성공 46~49% 유지) */
    landKeep: 0.1,
    /** 압박 탈출 = backEscape × 압박(pressureAt + 2.5 m 안 둘째 상대부터 backEscapeExtra 씩, 상한 1) × (1 − 받는 선수 수신 압박) */
    backEscape: 0.012,
    backEscapeExtra: 0.25,
    /** 공 보존 = backKeep × 받는 선수 여유(가장 가까운 상대 거리 / backKeepRoom, 상한 1) */
    backKeep: 0.004,
    backKeepRoom: 10,
    /** 반대편 전환 = backSwitch × (1 − 길 위험) — 받는 선수에서 공 반대 측면(공과 y 차 ≥ backSwitchDy m)의 동료에게 가는 패스 길 위험이 가장 낮은 것, 그 동료 backSwitchFree m 안 상대 없음 */
    backSwitch: 0.004,
    backSwitchDy: 20,
    backSwitchFree: 5,
    /** 기회 비용 = backCost × 앞으로 backFwd m+ 가는 패스·침투 후보의 최대 (성공 확률 × 받는 자리 가치) */
    backCost: 0.5,
    backFwd: 8,
    /** 상황 위험 (보존 가중 = 1 + 합, 비용 가중 = 1 + 합): 리드 · 버스·블록·티키 → 보존 ↑ / 게겐·직선 · 지거나 비기는 backLateMin 분 뒤 → 비용 ↑ */
    backLeadKeep: 0.5,
    backTendKeep: 0.5,
    backTendCost: 0.5,
    backLateCost: 0.5,
    backLateMin: 60,
    /** 인지 오차: 백패스 가치 항 추정 잡음 σ = backNoise × (1 − 판단 품질) (판단력 낮은 선수의 실수는 이 잡음과 비슷한 후보 사이 softmax 로만) */
    backNoise: 0.01,
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
    /** 각도 만들기 (C.78h): 슛 거리에서 슛 길이 막혔으면(pBlock > 0) 옆으로 laneCarry m(앞으로 laneCarryFwd m) 치는 몰기 후보 둘 — 그 자리 슛 가치(수비는 따라옴)가 지금 슛 가치보다 클 때만, 도착점 가치 = 그 슛 가치. 0 = 끔 */
    laneCarry: 3,
    laneCarryFwd: 1,
    /**
     * 각도 만들기 판단의 GK 이동 시간(초, shotModel lead). 0: GK 는 이미 골 앞에 서 있다 — lead 로 리치를 늘리는 C.77t 식은 패스가 가는 동안 GK 가 옮기는 몫이라
     * 옆 3 m 몰기에 0.35 초만 넣어도 골 확률이 0.19 → 0.06 으로 떨어져 각도 만들기가 사라진다. 수비는 따라온다고 본다(압박·밀집·1대1 조건은 지금 자리)
     */
    laneCarryTime: 0,
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
     * 공 쥐고 서 있기의 가치 감소 (C.78k, 경기 정지 미해결 8): 유지 후보의 "지금 자리 가치" 몫 × exp(−공 잡은 뒤 시간 / holdStale 초).
     * 서 있는 동안 상대는 자리를 잡고 우리 움직임은 식는다 — 앞이 비면 몰고 나가기·안전 패스가 이긴다. 0 이면 끔.
     * 시간 끌기(리드 중이고 holdWasteMin 분 이후)에는 holdWasteMul 배 천천히 준다 (몇 초 더 쥐는 것이 이득, 무한히는 아님)
     */
    holdStale: 3,
    holdWasteMin: 80,
    holdWasteMul: 3,
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

  // ── 판단 보정 (C.78p, 사용자 2026-10-27 02:2x "특정 상황에서 그 행동을 할 때 주는 보상을 임의로 늘려 선택을 더 하게") ──
  decide: {
    /**
     * 행동 선호 보정: 판단(choose) 효용에만 더하는 보너스 = 행동별 기본값(골 단위 효용) × 상황 함수(0~1, 판단에 보이는 특징만).
     * 실행 확률·결과(성공 판정·xG·선방)에는 들어가지 않는다 — 실행 레버를 내려 그 행동을 덜 고르게 된 만큼만 되살린다(결과 할당 아님).
     * 상황 함수: shoot = 열린 찬스(거리 × 슛 레인 × 각도 × 압박), 나머지 = 1(아직 안 씀). 0 = 끔
     */
    bias: {
      /** C.78p: 0.14 — 실행 레버(슛 속도 27 · availRef 0.2 · shotBase 0.62)로 판단 xG 가 내려가 장면 ⑬(침투 수신 → 슛 0.2)·㉘(열린 쪽 슛 0) 이 깨진 만큼 되살림 */
      shoot: 0.14,
      pass: 0,
      through: 0,
      cutback: 0,
      layoff: 0,
      holdup: 0,
      carry: 0,
      dribble: 0,
      cross: 0,
      clear: 0,
      hold: 0,
      /** 슛 열린 찬스 — 거리: shootNear m 안 1, shootFar m 에서 0 (선형) */
      shootNear: 13,
      shootFar: 18,
      /** 슛 레인: 1 − 블록 확률 / shootLaneRef (0 아래 0) — 막힌 레인은 보정 없음 */
      shootLaneRef: 0.45,
      /** 압박: 1 − shootPress × 압박(0~1) */
      shootPress: 0.3,
    },
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
    /** C.76k (§9.10 가설 2 ②): 쫓기며 쏘면 구석을 못 노린다 — 구석 × (1 − cornerPressure × 압박). 판단용 leagueSaveProb 의 구석 0.5 도 같은 식 (E.15.1 판단 = 실제). 능력 무관 (E.20 7번) */
    cornerPressure: 0.35,
    /**
     * 마무리 배수 (E.20 7번): 골 확률 = 기회의 질(xG: 위치, 각도, 압박, 슈팅 종류, 상대 GK) × clamp(1 + finishPerPoint × (마무리 능력치 − 70), finishMin, finishMax).
     * 결정력 계열 능력치는 이 한 곳에만 들어간다. 유효 슈팅 확률에 곱하므로 골 확률도 같은 배수로 바뀐다
     */
    finishPerPoint: 0.014,
    finishMin: 0.8,
    /** C.76a 가설 3 (1.25 → 1.18) 은 같은 시드 scoring 30골+ 2.80 → 2.70 으로 효과 없어 되돌림 (몰림은 배수 상한이 아니라 강팀 ST 자리의 1대1 수) */
    finishMax: 1.25,
    /** 배수를 곱한 유효 슈팅 확률 상한 */
    shotCap: 0.9,
    /** C.31: 패스 곡선 뒤 유효 슈팅 약 4.2 로 0.71 → 0.665 (선방 saveBase 와 묶음, pending 24 ②). C.78p: 0.665 → 0.62 — 판단 보정과 짝(0.58·0.60 은 장면 ④ 1대1 골 < 0.25) */
    shotBase: 0.62,
    shotPerM: 0.015,
    shotPressure: 0.15,
    /**
     * 1대1 보너스 (C.76a, 미해결 12): 헤더가 아니고 슛 길 콘 안 수비 0·pressureDist 안 상대 필드 선수 0(GK 제외) 이면
     * pOn(마무리 배수 뒤) += shotFree × max(0, 1 − 거리/shotFreeRef) × 각도. "수비가 없다"는 상황 보너스라 능력과 무관하게 더한다
     * (0.38: 8 m +0.23, 12 m +0.15, 20 m+ 0; 0.30 은 12 m 안 빗나감 50 으로 부족, 배수 안에 넣으면 scoring 30골+ 2.7·리그 1.52). 판단식·실제가 같은 함수라 E.15.1 안
     * C.76a 때는 0(꺼짐): 0.19~0.38 모두 같은 시드 scoring 30골+ 1.5 → 2.6~2.8 · 득점왕 중앙값 36~39 · 리버풀 100 → 108~110 으로
     * 분포 관문(≤ 2) 실패 — 그때는 강팀 자유로운 슛 격차(리버풀 3.24 : 중위 0.67)가 원인. C.76k 수신자 압박(1.82 : 0.44)·C.76p 깊은 블록 밀집 뒤
     * **0.30 으로 켬(C.76p 단계 C, §9.11.2)**: 같은 시드 scoring 30골+ ≤ 2.0·중앙값 25~35·리그 1.3~1.5 통과 조건으로. 총량은 keeper.saveBase 1.60 → 1.62
     */
    shotFree: 0.30,
    shotFreeRef: 20,
    shotMin: 0.05,
    shotMax: 0.85,
    longShotFrom: 20,
    /** 골문이 보이는 각도가 이 값(rad) 미만이면 유효 슈팅 확률을 비례해서 줄인다 */
    shotAngleRef: 0.3,
    /** 슈팅 콘(공-골대 사이) 안 수비수 1명당 블록 확률, 최대 */
    blockPer: 0.15,
    blockMax: 0.4,
    /** 밀집 블록 (C.78d ①): 슈터 denseR m 안 골 쪽 상대 필드 선수가 둘째부터 한 명마다 블록 확률 +blockDense (몸 던지기, 상한 blockMax). 판단·실행 같은 shotModel. 0 = 끔 */
    blockDense: 0.05,
    denseR: 4,
    /** 밀집 공중볼 (C.78d ①): 크로스 착지점 aerialCrowdR m 안 수비 수 − 공격 수가 양수면 한 명마다 공격 쪽 경합 로짓 −aerialCrowd. 0 = 끔 */
    aerialCrowd: 0.35,
    aerialCrowdR: 4,
    /**
     * C.76p 가설 3 (사용자 확정 2026-10-21 00:09 KST, §9.11.1 '밀집 블록 현실화' — 박스에 사람이 많으면 슛이 몸에 맞는다) 는 **되돌림(1.2 유지)**:
     * 2.0(+saveBase −0.02) 은 같은 시드 scoring 30골+ 0.20(하한 0.5)·리버풀 최대 119 로 분포 관문 ✗, 1회 조정 1.6(+saveBase −0.02) 은 scoring 통과(30골+ 1.00) 지만
     * C.76q(PK) 병합 뒤 engine:check 평점 ST 6.74(가드 ≤ 6.7) ✗ 이고 득점 1.28 이라 saveBase 를 더 올릴 수 없었다(두 가드 동시 불가, automation 3번 ④). 부록 C.76p 추가 절
     */
    coneWidth: 1.2,
    /**
     * 슛 레인 (C.78h): 슈터가 두 구석 쪽 슛 길(기대 구석)마다 콘 블록·약발을 따로 보고, 두 쪽이 다르면 기대 골((1 − 블록) × 약발 × (1 − 선방))이 큰 쪽으로 찬다
     * (같으면 옛 규칙: GK 반대편, 가운데면 무작위). 판단(shotModel)과 실행(shoot)이 같은 쪽·같은 블록. 0 = 끔(골 가운데 선 콘·가운데 약발, 옛 동작)
     */
    laneSide: 1,
    /** 밀집 블록 레인 (C.78h, laneSide 1 일 때): blockDense 를 세는 수비 = 슈터 denseR m 안 · 그 쪽 슛 길 denseLaneW m 안(골 쪽 대신). 0 = 골 쪽 전부(C.78d) */
    denseLaneW: 2,
    /** C.76s 가설 2: 지친 선수의 패스 성공 확률 −tiredPass × tiredRatio */
    tiredPass: 0.06,
    /** 블록된 공이 라인 밖(코너)으로 나갈 확률 */
    /** C.76w 가설 2 (코너 수 현실화, 미해결 11 세트피스 몫): 블록 → 코너 0.7 → 0.45, 선방 쳐내기 → 코너 parryCorner 0.5 → 0.35, 헤더 걷어내기 → 코너 clearCorner 0.5 → 0.35 (코너 8.4/경기 → 약 6, 현실 각 0.3~0.4) */
    blockCorner: 0.45,

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
    clearCorner: 0.35,

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
    /**
     * C.75h 판단 미끄러짐 (pending 133 03:29 ①, B안): 내 선수의 엔진 결정(자동·맡기기·정지 안 한 순간 공통)에서
     * p = clamp(max × (ref − 판단)/ref, 0, max) 확률로 고른 후보보다 효용이 한 단계 낮은 후보를 고른다 (판단 = judgementOf, 0~1).
     * NPC 는 그대로 (E.15 무영향), 직접 모드에서 직접 고른 선택지는 미끄러지지 않는다. 결정적 난수 (같은 시드 같은 결과)
     */
    delegateSlip: { ref: 0.7, max: 0.25 },
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
    /**
     * C.75v 선택지 라벨 = 성공 확률 구간 (사용자 확정 2026-10-20 15:58): p ≥ safe → 안전, p ≥ balanced → 균형, 그 밖 → 도박.
     * 같은 라벨이 여러 줄이어도 된다. 판정 없는 선택지(p = null)는 지금 규칙대로 (소유 = 안전, 1대1 따라붙기·패스길 막기 = 고정)
     */
    labelBands: { safe: 0.5, balanced: 0.25 },
    /**
     * C.75v 확실한 선택지 다시 넣기: 남은 선택지가 모두 이 확률 미만이고 maxP 를 넘어 뺀 선택지가 있으면,
     * 그중 기대 평점 최대(delegateEv 를 만든 것) 1개를 "안전"으로 맨 위에 넣는다 ("확실하게 지킬까 vs 모험")
     */
    sureBackBelow: 0.3,
    /**
     * C.75v 소유 결정 선택지 최대 수 (안전·균형·도박 3칸 + 몰고 가다 슛 + 확실한 선택지 + 더 고를 거리 포함).
     * 더 고를 거리는 행동 종류·받는 사람이 다른 것을 먼저, 기대 평점(봇 optionValue)이 맡기기(엔진 효용 1위 후보) − extraEvGap 이상인 것만 (0.05 는 거의 다 들어와 0.03)
     */
    maxOptions: 5,
    extraEvGap: 0.03,
    /** C.75v 더 고를 거리는 같은 행동 종류(패스·몰고 가기 등)가 이미 이 줄 수만큼 있으면 넣지 않는다 */
    extraTypeCap: 2,
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
    /** 위험 감수 실패 (C.77s, pending 145 A2): 전진(8 m+)·침투 패스·크로스·돌파를 고른 뒤 상대 진영(마지막 1/3 앞)에서 잃으면 lost × 이 비율 */
    riskLostFactor: 0.5,
    /**
     * 소극적 백패스 (C.77s, pending 145 A1): 압박 없이(pressureAt 0) 같은 후보 풀에 앞으로 passiveFwd m+ 가는 패스(p ≥ passiveOpenP)가 있는데
     * passiveBack m+ 뒤로(또는 자기 진영으로 넘겨) 준 패스. 경기당 passiveFree 회(공격 성향 passiveFreeAttack)를 넘긴 것부터 passive × 가중, 경기 최대 passiveMax(행동 델타 단위).
     * 가중: 게겐·직선 성향 또는 압박 passiveHighPress 이상 × passiveAttackMul, passiveLateMin 분 뒤 지거나 비기면 × passiveLateMul, 같은 소유 passiveRepeatFrom 번째부터 × passiveRepeatMul.
     * 예외: 2골+ 리드 · passiveLeadMin 분 뒤 1골 리드 · 버스·블록 · 역습의 자기 진영 백패스 소유당 1회 · 재개 뒤 passiveRestartT 초 안. 평점에만 쓴다(선택은 그대로)
     */
    passive: -0.05,
    passiveFree: 2,
    passiveFreeAttack: 1,
    passiveMax: -0.4,
    passiveOpenP: 0.65,
    passiveBack: 5,
    passiveFwd: 8,
    passiveHighPress: 0.7,
    passiveAttackMul: 1.5,
    passiveLateMul: 1.5,
    passiveLateMin: 60,
    passiveRepeatMul: 2,
    passiveRepeatFrom: 3,
    passiveLeadMin: 80,
    passiveRestartT: 2,
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
     * center 는 포지션군의 평균 델타 합 (C.26: 엔진 9 평점 표본 600경기 선발 45분 이상으로 재측정, scripts/diag/rating-parts.ts. C.28: 엔진 11 로 다시 쟀다. C.29: 엔진 12 로 다시 쟀다. C.31: 엔진 14 패스 곡선 뒤 다시 쟀다. C.76z: 엔진 34 `rating-parts 600` ST 델타 합 평균 1.856(경량 가드 ST 6.74 > 6.7)이라 가드 밖 ST 만 1.68 → 1.86, §9.12.7 규칙),
     * C.76s: 엔진 32(지친 선수의 패스·판단 흐트러짐)로 패스 중심 포지션의 델타 합이 내려가 600경기로 다시 쟀다(최종 설정 측정: GK 0.98, CB 0.99, FB 0.83, CDM 1.35, CM 1.60, CAM 1.30, WING 1.02, ST 1.75). 가드(6.3~6.7)를 벗어났던 **CAM 만 1.51 → 1.26** 반영(CAM 6.53) — 8군을 모두 6.5 로 맞추면 평점 σ 가 0.70 아래(가드 0.7~0.9)로 내려가서 나머지(6.34~6.57, 가드 안)는 다음 재측정 때.
     * scale 은 전체 σ 약 0.75. ST 는 경기당 0.58골이라 평균을 6.5 에 두면 무득점 경기가 6.0 아래로 내려가서 +0.14 (평균 약 6.65)
     */
    // C.77b 44h-i: 2선 추적 뒤 rating-parts 600(엔진 34 기준) ST 평균 델타 1.871 — 병렬 C.76z 가 같은 재측정으로 1.86 을 먼저 씀, 그 값 유지(차이 0.01 = 평점 0.009)
    // C.77k 44h-f3c: 엔진 39 engine:check ST 풀타임 무득점 5.90(가드 5.9 경계 ✗, ST 평균 6.49) — ST 만 1.86 → 1.83(평점 +0.027)
    // C.78r(엔진 54, 로드맵 마지막 단계): 8군 전부 다시 잼 — `rating-parts 720 … 20000`(engine:check 표본 13000~ 과 다른 시드) + `scripts/diag/c78r-rating-fit.ts`(칸 가중 평균이 6.5, ST 6.65 가 되게).
    // 엔진 54 델타 합 분해(패스 · 슛 · 골도움 · 수비 · 상실 · GK · 결과): CDM 2.22 · 0.26 · 0.14 · 0.63 · −0.46 · −0.13 · −0.06 = 2.59 — 평점이 높던 원인은 득점이 아니라 패스 몫(GK 패스 1.42 · ST 패스 1.45). σ 0.79 · ST 무득점 6.06
    center: { GK: 1.58, CB: 0.85, FB: 0.61, CDM: 2.58, CM: 2.17, CAM: 2.04, WING: 1.06, ST: 2.41 } as Record<string, number>,
    scale: 0.9,
    mean: 6.5,
  },

  // ── 골키퍼 (E.9) ──
  keeper: {
    /** pSave = clamp(saveBase − saveDelta × δ + saveSkill × (선방 − saveCenter)/100, 0.05, 0.95). C.29: 슛 선택(mistakeShotGap) 뒤 1.77 → 1.75. C.31: 1.75 → 1.70 (선방률 약 68, 유효 슈팅 득점 전환 약 32%). C.76a: closeW·shotFree 를 켜면 1.74~1.78 로 되돌린다(0.01 = 득점 −0.067); 둘 다 꺼서 1.70 유지. C.76k: 수신자 압박 뒤 1.60. C.76p: shotFree 0.30 켜며 1.62(closeW 는 0 유지) C.76q: PK 빈도(박스 파울 0.04 → 0.08) 쌍 보정으로 +0.02 → 1.64 (C.76p 가설 3 coneWidth 는 되돌려 보정 없음)  C.76s: 지친 선수의 패스·경합·판단 흐트러짐(가설 2)으로 quick 600 득점 1.34 → 1.24 라 총량 보정 −0.02 → 1.62(E.23 4번). C.76z: 압박 없는 롱 백패스를 실수 후보에서 빼니(onball isMistake) 공격이 덜 끊겨 quick 600 득점 1.27 → 1.49 라 총량 보정 +0.02 → 1.64(E.23 4번). C.77d: C.77b 병합 뒤 quick 600 1.28(1.30 아래, C.77b 가 "다음 패치가 1.63 으로" 기록)이라 총량 보정 −0.01 → 1.63(E.23 4번). C.77t: GK 도달 항(reach·cover)으로 모양을 바꾼 뒤 총량 되돌리기 +0.03 → 1.66(quick 600 1.68 → 1.33 · 1.66 → 1.42 · 1.65 → 1.55, 같은 시드 scoring 1.68 → 30골+ 0.10 · 1.66 → 0.30 · 1.65 → 0.50 — 둘을 같이 맞추는 값이 없어 quick 쪽 1.66, 부록 C.77t; 마스터 승인, 이번만 0.01 단위 규칙 밖). */
    saveBase: 1.66,
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
    /**
     * 근거리 항 (C.76a, 미해결 12): 헤더가 아닌 슛은 δ += closeW × max(0, 1 − 거리/closeRef) — closeRef m 안 가까운 슛(1대1)만 GK 가 막기 어렵고 그 밖은 불변.
     * closeRef 12 는 1대1 슛이 대개 9~12 m 에서 나와 실효가 거의 없었다(12 m 안 선방 41%) → 15 (10.5 m 에서 δ +0.135).
     * **지금은 0(꺼짐, 부록 C.76a)**: 0.45 는 shotFree 없이도(saveBase 1.75) 같은 시드 scoring 30골+ 2.70 · 중앙값 38.5 · 리버풀 최대 127 — GK 쪽도 분포 중립이 아니었다
     */
    closeW: 0,
    closeRef: 15,
    /**
     * GK 도달 항 (C.77t, 44h-k · 진단 §9.17): 슛 순간 GK 위치에서 슛 선(공 → 노린 골라인 점)까지의 수직 거리 e, 공이 GK 에 닿는 시간 tb = |GK − 공| / 슛 속도,
     * 도달 반경 reach = reachBase + diveSpeed × tb × 선방/80, cover = clamp(1 − (e − reach)/reachSpan, 0, 1) → 선방 확률 × cover.
     * GK 가 슛 선 위에 있으면 1(이전과 같음), 쏠려 있으면 0 에 가깝다(빈 골). 판단용 xG(shotModel)도 같은 식(실제 GK 위치 · 리그 GK 선방 · GK 반대편 구석)
     */
    /** C.77t: 처방 1.6 은 12 m 밖 선방률 65% 라 §9.17.3 (i) 대로 2.0 */
    reachBase: 2.0,
    /** C.78j: 4 → 6 (GK 깊이 수정과 함께 12 m 밖 선방 61.7 → 67.6%, 장면 ④ 빠른 컷백 0.18 ≤ 0.2) */
    diveSpeed: 6,
    reachSpan: 1.5,
    /** GK 반응 시간 (초): tb 에서 뺀다 (0 아래는 0) */
    reactTime: 0,
    /**
     * GK 대응 시간 모델 (C.77z, 로드맵 4단계 — keeper.coverOf): 1 이면 tBall = 공이 GK 대응 지점(슛 선 위 GK 수선의 발)까지 가는 시간,
     * 반응 시간 reactBase − reactSkill × (선방 − saveCenter)/100 동안은 GK 의 지금 속도(슛 선 쪽 성분, ±driftMax)로, 그 뒤 다이빙 · 헤더도 같은 식(headerCoverMin 예외 없음, 반응 + headerReact) ·
     * 판단 xG 에 약발 배율 · 빈 골(가운데로 차도 GK 가 못 닿음)이면 유효 슈팅 확률이 openOn 쪽으로. 0 이면 C.77t 식 그대로(꺼짐).
     * **지금 0(부록 C.77z)**: 켜면 quick 600 득점 1.41 · 같은 시드 scoring 은 통과하지만 engine:check ST 무득점 평점 5.80(가드 5.9~) · 12 m 밖 선방률 66.4%(가드 68~76) — 마지막 단계에서 켠다
     */
    timeModel: 1,
    /** 대응 시간 모델의 기본 닿는 범위 (m, 반응 전 몸·팔로 닿는 거리). 1.4 · 반응 0.15 · 시간 기준 0.6 도 장면 ④ 는 통과하지만 유효 슈팅 득점 전환이 49% 로 GK 가 너무 약해(quick 600 1.99) 2.0 · 0.1 · 0.4 (부록 C.77z) */
    timeReach: 2.0,
    /** 판단용 기대 선방: 실행 구석 분포(난수 × cornerRange)를 이 개수 점의 평균으로 (timeModel 1) */
    cornerQuad: 4,
    /** 대응 시간 모델 δ 시간 항의 기준 (초): 반응 뒤 남은 시간이 이만큼이면 거리 항 0 (GK 깊이 3 m · 반응 0.1 에서 약 17 m 슛) */
    availRef: 0.2, // C.78n: 0.3 시험(슛 속도 25 위 1.85 → 1.77)은 장면 ④·⑬·㉘ 을 더 깨서 되돌림. C.78p: 0.4 → 0.2(근거리에서 GK 가 덜 쫓김) — 판단 보정과 짝, 0.15 는 1대1 골 0.23
    /** 밀집 슛 (C.77z): 3 m 안 상대 필드 선수 둘째부터 한 명마다 유효 슈팅 확률 −shotCrowd (판단·실행 같은 pOn) */
    shotCrowd: 0.08,
    reactBase: 0.1,
    reactSkill: 0.4,
    driftMax: 6,
    headerReact: 0,
    /** 빈 골 유효 슈팅 (C.77z): 가운데(구석 0) 슛 선을 GK 가 덮는 정도 c0 이면 유효 슈팅 확률 += (openOn × 각도 − 유효) × (1 − c0) */
    openOn: 0.95,
    /** 빈 골 보정 거리 감쇠 (C.78n, 엔진관리자10 가설 3): openOn × clamp(1 − (d − openFrom)/openSpan, openFloor, 1) — 먼 거리 "빈 골" 슛은 빗나갈 수 있다. openSpan 0 = 꺼짐 */
    openFrom: 11,
    openSpan: 14,
    openFloor: 0.55,
    /** 헤더 공 속도 (C.77z): headerSpeed × clamp(1 + headerCrossW × (크로스 속도 / ball.airSpeed − 1), 0.8, 1.2) — 능력치 무관 (E.20 7번) */
    headerCrossW: 0.5,
    /**
     * 패스 비행 중 GK 자리 (C.77z): 1 이면 상대가 받을 패스·크로스의 도착점이 골에서 setDist m 안일 때 GK 는 그 점 기준 슛 각도 자리
     * (골 가운데 → 도착점 선 위, 깊이 classicMin, 골대 ±1 m 안)로 서둘러 옮긴다 — 패스를 찬 뒤 GK 반응 시간(reactOf)에 다시 본다. 0 이면 지금 공 위치 기준 걸어서(옛 동작)
     */
    flightSet: 1,
    /** 판단용 (C.77t): 동료에게 패스해 그가 쏠 슛의 가치를 볼 때, 패스 비행 + receiveLead 초 동안 GK 가 setSpeed m/s 로 자리를 옮긴다고 본다 (지금 GK 위치 그대로 보면 패스가 과대평가된다) */
    setSpeed: 4,
    receiveLead: 0.3,
    /** 헤더의 cover 하한 (크로스 순간 GK 가 아직 옮기는 중이라 헤더만 따로 받친다) */
    /** C.77t: 하한 0.5 도 헤더 실제 골률 28 → 50% 라 1(헤더는 도달 항 밖, 이전과 같음) */
    headerCoverMin: 1,
    /** GK 가 골 가운데에서 이만큼(m) 넘게 비켜 있으면 슈터는 반대편 구석을 노린다 (실제·판단 같은 규칙). 그 안이면 좌우 무작위 */
    farSideMin: 0.25,
    /** 캐치 확률 = catchBase + catchSkill × 핸들링/100 (나머지 쳐내기) */
    catchBase: 0.3,
    catchSkill: 0.5,
    /** 쳐낸 공이 코너가 될 확률 */
    /** C.76w 가설 2: 0.5 → 0.35 (쳐낸 공이 코너 대신 리바운드로 남는다) */
    parryCorner: 0.35,
    /** 크로스/롱볼 처리: 박스 안이고 GK 와 claimRange 안이면 L((출전 범위 − 60)/12 + claimBias) */
    claimRange: 6,
    claimBias: -3,
    /** 공을 잡은 뒤 배급까지 (초) */
    holdTime: 4,
    classicMin: 3,
    classicMax: 6,
    sweeperMin: 8,
    sweeperMax: 14,
    /** 공 y 를 따라가는 비율 (arcSet 0 경로만) */
    lateral: 0.25,
    /** 기본 자리 기하 (C.78m): 1 이면 기준점(상대 소유자, 없으면 공) → 골 가운데 선 위 깊이 d 인 점(flightSet·setDepth 와 같은 기하). 0 이면 옛 사각 격자(깊이 x · 옆 y × lateral) — 측면 각에서 슛 선을 평균 3.2 m 벗어남 */
    arcSet: 1,
    /** 각 좁히기 (E.20): 상대가 공을 가지고 박스 안 골에서 rushDist m 안이면 GK 는 공과 골 사이 rushGap m 앞까지 나온다 */
    rushDist: 12,
    rushGap: 1.5,
    /** 자세 잡기 (C.77t): 상대 소유자가 골에서 setDist m 안이면 GK 자리 이동을 서두른다(긴급). 0 이면 끔 */
    setDist: 30,
    /**
     * 슛 거리 깊이 (C.78j): 1 이면 상대 소유자가 setDist m 안(rushDist 각 좁히기 밖)이고 골 앞 슛 각도(옆 거리 ≤ setCentral × 골 쪽 거리, 0.84 ≈ 40°)이고 골 쪽에 우리 필드 수비가 있을 때(단독 돌파는 옛 자리 — 스위퍼가 맞으러 나옴, 장면 ⑬)
     * GK 깊이 ≤ setDepth m (스위퍼 최소 sweeperMin 8 m 대신). 측면·바이라인 쪽은 옛 자리(마스터 AA 2026-10-26: 컷백은 가로질러야 하는 상황으로 남김).
     * 0 이면 옛 깊이 — 12 m 밖 슛 순간 스위퍼가 골라인 8 m 앞(슛 선 밖)에 서 있는 경우가 12 m 밖 실점의 절반(부록 C.78j)
     */
    setLine: 1,
    setCentral: 0.84,
    /** 슛 거리 깊이를 쓰는 소유자 최소 거리 (m): 그 안(각 좁히기 경계 rushDist 근처)은 옛 자리 — 장면 ④ 1대1(12 m) 기하 유지 */
    setFrom: 13,
    /** 골 쪽 수비 판정: 소유자보다 골에 setBehind m 넘게 가까운 필드 수비가 있어야 슛 거리 깊이 (나란히 뛰는 추격 수비는 단독 돌파로 본다) */
    setBehind: 2,
    setDepth: 3,
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
    /** 수비수가 자기 박스 안에서는 파울을 조심한다 (파울 확률 배율). E.22 B: 0.004 → 0.06 (PK 팀당 경기당 약 0.13, 세트피스 골 비중). C.29: 0.04 (파울 상수를 올려도 PK 유지). C.76q: 0.04 → 0.08 (PK 0.136/경기 → 현실 0.25~0.3, 미해결 13) */
    boxFoulFactor: 0.08,
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
