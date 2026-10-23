// 기준 장면 목표 (C.77w): enabled = false 면 지금 값 기록과 기본 불변식만 검사한다. 로드맵 2~4단계 패치가 해당 장면을 켜고 check 를 채운다.
// current = C.77w 측정값 (엔진 40, 지문 11ab14dbb9cf9706). 패치가 동작을 바꾸면 이 표를 같이 고친다.
// C.77x(엔진 41): ① 간격 2.24 m 일정 ② 되돌아서기 1.2초·지나침 2.6 m ③ 느린 CB +1.14초 / 같은 속도 +0.61초 ⑥ 도착 시간 오차 최대 0.07초
// C.77z: ④ 실제 패스 비행·박스 비움·기대 구석으로 다시 짬 — 끈 모델 느린 횡패스 선방 0.29 · 빠른 컷백 0 · 가운데/비킴 0.67/0.02 · 빈 골 0.67 · 1대1 0.22 · 밀집 0.10 → 켬(KEEPER_ON) 0.61 · 0.13 · 0.56/0.10 · 0.95 · 0.34 · 0.08
// C.78b: ⑫ 원터치 리턴 0.67 · 그 리턴 마커 뒤 0.69 ⑬ 침투 수신 뒤 슛 0.6 · 2.4초 · 4.2 m/s ⑭ 정지 1.10 대 0.68초 · 안전 0.9 · 압박 탈출 1.0 (x·y·z·78a 켬)
// C.78g: ㉔ 첫 행동 0.26 대 0.92 s · 뺏긴 팀 10 m 안 1.0 대 2.4명 ㉕ 4초 전진 2.7 대 3.9 m · 상대 진영 0.66 대 0.68
// C.78d: ⑱ 버스 허용 슛 0.38 대 균형 0.63 · xG 0.04 대 0.07 ⑲ 지원 버스 1·역습 2, 3초 전진 13.7/14.3 m (끔 8.5/8.1) ⑳ 압박 1.05명·둘 이상 5%(밀집 끔 1.40·35%)
// C.77y: ⑤ 열림 백패스 6.3 → 0% · 막힘 40.7 → 47.5%(이유 보존) ⑦ 패서 침투 4 → 48.5% · 리턴 침투 패스 성공 0.10 → 0.76(켬)/0.57(끔) ⑧ 패스 성공 0.57 → 0.97 (끈 장면 0.57), 옆으로 3.9 m

import type { SceneId } from './scenes';

export interface SceneTarget {
  /** 무엇을 보는가 / 어느 로드맵 단계가 켜는가 */
  goal: string;
  enabled: boolean;
  /** 켜졌을 때 통과 조건 (값 → 통과 여부) */
  check?: (v: Record<string, number>) => boolean;
  /** C.77y: 이동 제어기(C.77x MOTION_ON) 켠 상태와 끈 상태 둘 다에서 통과해야 한다 (3단계가 2단계 위에서 작동하는지) */
  both?: boolean;
  /** C.78a: x·y·z 전부 켬 / 전부 끔 둘 다(전환 상수 TRANSITION_ON 은 켬) */
  xyz?: boolean;
  /** C.78b: x·y·z·78a 전부 켬 / 전부 끔 둘 다(수신 상수 TOUCH_ON 은 켬) */
  touch?: boolean;
}

export const TARGETS: Record<SceneId, SceneTarget> = {
  // C.77x 켬: 4초 동안 추적 간격 ≤ 2.5 m
  chase: { goal: '① 추적 간격 일정 (2단계 이동·도착 시간)', enabled: true, check: (v) => v.gapMax! <= 2.5 },
  // C.77x 켬: 공격수가 되돌아 뛸 때 수비 되돌아서기 ≤ 1.2초 · 지나침 ≤ 3 m
  stop: { goal: '② 급정지 반응 시간·지나친 거리 (2단계)', enabled: true, check: (v) => v.reactTime! <= 1.2 + 1e-6 && v.maxPast! <= 3 },
  // C.77x 켬: 느린 CB(60) 도착 차가 같은 속도(80) 대비 +0.4초 이상
  highLine: { goal: '③ 뒤도는 느린 CB 불리 (2단계, 5단계 높은 라인 비용)', enabled: true, check: (v) => v.slowArriveGap! - v.evenArriveGap! >= 0.4 },
  // C.77z: 같은 슛 GK 가운데 대 비킴 선방 차 ≥ 0.25 · 느린 횡패스 뒤 GK 복귀 선방 ≥ 0.35 대 빠른 컷백 ≤ 0.2 · 빈 골문 ≥ 0.8 · 1대1 0.3~0.5 · 밀집(3명) ≤ 0.12
  keeper: {
    goal: '④ GK 대응 시간 — 가운데/비킴, 느린 횡패스/빠른 컷백, 빈 골문·1대1·밀집 (4단계)', enabled: true, both: true,
    check: (v) => v.centerSave! - v.asideSave! >= 0.25 && v.slowSave! >= 0.35 && v.fastSave! <= 0.2
      && v.emptyGoal! >= 0.8 && v.oneOnOneGoal! >= 0.3 && v.oneOnOneGoal! <= 0.5 && v.crowdGoal! <= 0.12,
  },
  // C.77y 켬: 열림 백패스 ≤ 3% · 실수(gap 밖) 0 · 이유는 압박 탈출/보존뿐 / 막힘은 백패스·옆 패스가 남음
  backpass: {
    goal: '⑤ 막힘/열림에 따라 백패스 비율·이유가 다름 (3단계)', enabled: true, both: true,
    check: (v) => v.openBack! <= 0.03 && v.openMistake === 0 && Math.abs(v.openEscape! + v.openKeep! - v.openBack!) < 1e-9
      && v.blockedMistake === 0 && v.blockedBack! + v.blockedSide! >= 0.2,
  },
  // C.77y: 패서 침투 ≥ 30% · 목표가 마커 뒤 · 1초 뒤 리턴(침투) 패스 후보
  giveGo: { goal: '⑦ 2:1 — 패스 직후 패서가 마커 뒤로 달리고 리턴 패스 후보가 생김 (3단계)', enabled: true, both: true, check: (v) => v.runRate! >= 0.3 && v.targetBehind! > 0 && v.returnThrough === 1 && v.returnP! >= 0.4 },
  // C.77y: 마커가 공 쪽 2 m 안 → 1.5초 동안 옆으로 2.5~6 m, CB → CM 패스 성공 확률이 받으러 나오기 끈 같은 장면보다 +0.03 이상 (마커도 반응 주기로 쫓는다)
  check: { goal: '⑧ 받으러 나오기 — 마커가 붙으면 수신 각도를 만든다 (3단계)', enabled: true, both: true, check: (v) => v.pEnd! >= v.pNoCheck! + 0.03 && v.moved! >= 2.5 && v.moved! <= 6 },
  arrival: { goal: '⑥ 판단용 도착 시간 = 실제 이동 (2단계, 오차 ≤ 0.2초)', enabled: true, check: (v) => v.maxErr! <= 0.2 },
  // C.78a: 3명 가담 뒤 뚫림 — 감지 ≤ 0.3초 · 돌아서기 ≤ 1.0초 · 둘이 공과 나란히 오기까지 1~7초(자리 비운 비용) · 1초 뒤 뒤 공간(오프사이드 라인 깊이)이 1명 가담보다 넓거나 같다
  pressBreak: {
    goal: '⑨ 역압박 3명 가담 뒤 뚫림 — 뒤 공간·복귀 시간 (5단계)', enabled: true, xyz: true,
    check: (v) => v.detect3! <= 0.3 && v.turn3! <= 1.0 && v.back3! >= 1.0 && v.back3! < 7 && v.space3! >= v.space1!,
  },
  // C.78a: 높은 라인 + 느린 CB — 침투 패스 판단 성공 확률이 빠른 CB 보다 ≥ 0.05 높고, 실제 달리기 ST 우위가 ≥ 0.2초 크다
  slowLine: {
    goal: '⑩ 높은 라인 + 느린 CB 대 빠른 ST 뒤공간 패스 (5단계)', enabled: true, xyz: true,
    check: (v) => v.hasThrough === 1 && v.pSlow! >= v.pFast! + 0.05 && v.marginSlow! >= v.marginFast! + 0.2,
  },
  // C.78a: 몰빵(수비 줄 2명)이 잃은 1초 뒤 상대 역습 기회(10 m+ 전진 패스 성공 × 가치 합)가 수비 줄 4명보다 1.15배 이상 · 자유로운 상대 공격수가 1명 넘게 더 많다
  allIn: {
    goal: '⑪ 몰빵 대형 잃은 직후 상대 역습 슛 기회 (5단계)', enabled: true, xyz: true,
    check: (v) => v.chanceAllIn! >= v.chanceFour! * 1.15 && v.freeAllIn! > v.freeFour! + 1,
  },
  // C.78b: 받는 순간(0.2초 안) 원터치 리턴 ≥ 10% · 그 원터치 리턴을 패서가 마커보다 골 쪽에서 받는 비율 ≥ 50% · 리턴 ≥ 40% (수신 끔: 원터치 0 · 리턴 1.2초 뒤)
  oneTwo: {
    goal: '⑫ 2:1 원터치 리턴 — 받는 순간 리턴, 패서가 마커 뒤에서 받음 (5단계 2차)', enabled: true, touch: true,
    check: (v) => v.oneTouch! >= 0.1 && v.otBehind! >= 0.5 && v.returnRate! >= 0.4,
  },
  // C.78b: 침투 수신 뒤 슛 ≥ 40% · 받은 뒤 슛까지 ≤ 2.6초 · 받을 때 속도 ≥ 3.5 m/s (수신 끔: 슛 10~20% · 2.7~3.3초 · 3.1 m/s)
  runIn: {
    goal: '⑬ 뒤 공간 침투 수신 → 슛까지 시간 (쫓아오는 CB 대비, 5단계 2차)', enabled: true, touch: true,
    check: (v) => v.shotRate! >= 0.4 && v.shotTime! <= 2.6 && v.recvSpeed! >= 3.5,
  },
  // C.78b: 등지고 압박 속 정지 시간이 앞 보고 자유보다 ≥ 0.3초 길다 · 첫 행동이 공 지키기·레이오프·백패스 ≥ 70% · 백패스면 이유 1위 압박 탈출 ≥ 50%
  backPress: {
    goal: '⑭ 등지고 압박 속 수신 — 정지 시간 길고 공 지키기·백패스 이유 압박 탈출 (5단계 2차)', enabled: true, touch: true,
    check: (v) => v.stopBack! >= v.stopFree! + 0.3 && v.safeRate! >= 0.7 && (v.backs === 0 || v.escapeShare! >= 0.5),
  },
  // C.78c ⑮⑰: 기록만 — 지금 방향이 거꾸로(깊은 블록 상대 6초 안 높은 탈취 0.15~0.20 대 티키 빌드업 0.0, 버스의 첫 처리 롱볼 0.11~0.16 대 티키 0.33). 엔진관리자 재진단 대상
  deepPress: { goal: '⑮ 깊은 블록 상대 게겐 압박 — 상대가 건너뛰어 높은 탈취 작음 (C.78c, 기록)', enabled: false },
  // C.78c ⑯: 착지점 몫 켬이 끔보다 롱볼(30 m+)을 더 고르고, ST 에게 가는 공은 라인 뒤 · ST 가 수비보다 먼저 닿음 · 착지점 몫 > 0.5
  longEscape: {
    goal: '⑯ 압박받은 CB 가 롱볼로 높은 라인 뒤로 건너뜀 — 판단이 착지 경합을 봄 (C.78c)', enabled: true,
    check: (v) => v.longOn! > v.longOff! && v.behind === 1 && v.tSt! < v.tDef! && v.q! > 0.5,
  },
  buildPress: { goal: '⑰ 티키 빌드업 상대 게겐 압박 — 높은 탈취 많음 (C.78c, 기록)', enabled: false },
  // C.78d ⑱ → C.78e(마스터 Z 결정, 120 시드): 슛 수(버스 < 균형)는 120 시드면 C.78e 규칙을 다 꺼도 0.60 대 0.44 로 성립하지 않아 출력만(미해결 3 재진단).
  // xG/슛 < 균형 · 박스 밖 > 균형 도 120 시드 두 묶음에서 차이 0.01~0.02 가 묶음 사이 흔들림(±0.05) 안이라 원인 규칙을 가를 수 없음 → 잡음 폭 가드:
  // 버스가 허용하는 슛의 xG/슛 ≤ 균형 + 0.05 · 박스 밖 비율 ≥ 균형 − 0.08 (뚜렷하게 더 좋은 찬스를 주면 실패)
  blockBuild: {
    goal: '⑱ 블록 대 지공 — 버스가 허용하는 슛이 균형 수비보다 뚜렷하게 좋은 찬스가 아니다 (C.78d, C.78e 120시드)', enabled: true,
    check: (v) => v.busXgShot! <= v.balXgShot! + 0.05 && v.busOut! >= v.balOut! - 0.08,
  },
  // C.78d ⑲: 지원 인원 버스 1 · 역습 2, 지원 대상(공에 가장 가까운 2선)의 3초 전진이 지원 끔보다 3 m 이상 크다
  blockCounter: {
    goal: '⑲ 블록 탈취 뒤 역습 — 지원 인원 버스 1·역습 2, 지원 대상이 앞으로 달림 (C.78d)', enabled: true,
    check: (v) => v.busSup === 1 && v.ctrSup === 2 && v.busRun3! >= v.busRun3Off! + 3 && v.ctrRun3! >= v.ctrRun3Off! + 3,
  },
  // C.78d ⑳: 수비 블록 줄 사이 수신 — 압박(이동 목표가 소유자 2 m 안) 1명 안팎·둘 이상 ≤ 15%(밀집 끔보다 적음) · 1초 뒤 가장 가까운 수비 ≤ 2.5 m · 중원 줄 구멍(가로 간격 최대) ≤ 10 m
  betweenLines: {
    goal: '⑳ 줄 사이 수신자에게 수비 1명 튀어나감·옆이 메움 (C.78d)', enabled: true,
    check: (v) => v.received! >= 0.8 && v.pressers! <= 1.2 && v.multi! <= 0.15 && v.multi! < v.multiOff! && v.near1! <= 2.5 && v.gapMax! <= 10,
  },
  // C.78e ㉑: 반대쪽 측면 크로스 — LM 이 박스 안 먼 포스트 채널에 같은 장면 LW 보다 1초 넘게 늦지 않게 · 도착 ≥ 80% · 도착 규칙 끔보다 빠르고 크로스 순간 먼 포스트에 더 가깝다
  wideArrive: {
    goal: '㉑ 반대쪽 측면 크로스 때 LM/RM 먼 포스트 도착 시각 (C.78e)', enabled: true,
    check: (v) => v.lmArr! >= 0.8 && v.lmT! <= v.lwT! + 1 && v.lmT! < v.lmOffT! && v.lmEnd! < v.lmOffEnd!,
  },
  // C.78e ㉒: CB 따라감 ≥ 40% · 2선 빈자리 채널 침투 ≥ 25%(끔보다 0.2 이상 많음) · 그 채널로 패스 ≥ 10%(끔보다 많음)
  nineFollow: {
    goal: '㉒ 펄스 나인 내려옴 → CB 따라감 → 2선 빈자리 침투 패스 (C.78e)', enabled: true,
    check: (v) => v.follow! >= 0.4 && v.run! >= 0.25 && v.run! >= v.runOff! + 0.2 && v.pass! >= 0.1 && v.pass! > v.passOff!,
  },
  // C.78e ㉓: CB 가 라인을 지키면 받은 0.3초 뒤 앞을 봄 ≥ 60%(돌아서기 끔 ≈ 0) · 첫 행동 전진이 돌아서기 끔보다 많음 · 상대 중원이 먼저 닿으면 CB 따라감이 0.2 이상 적고 판단 끔보다 적다
  nineHold: {
    goal: '㉓ 펄스 나인 내려옴 → CB 안 따라감 → 돌아서 전진 (C.78e)', enabled: true,
    check: (v) => v.faceHold! >= 0.6 && v.faceHold! > v.faceNoTurn! + 0.4 && v.fwdHold! > v.fwdNoTurn! && v.followNear! <= v.followFar! - 0.2 && v.followNear! < v.followNearOff!,
  },
  // C.78g ㉔: 뺏은 뒤 첫 행동이 전환 끔보다 0.4초 이상 빠르고 · 1초 뒤 공 10 m 안 뺏긴 팀 인원이 0.8명 이상 적다(다시 보는 시간) · 4초 전진(공을 가진 채)은 끔보다 1.5 m 넘게 줄지 않는다
  // (80 시드: 첫 행동 0.26 대 0.92 s · 10 m 안 1.0 대 2.4명 · 4초 전진 6.9 대 6.4 m — 4초 전진·첫 패스 방향은 이 배치에서 늘지 않음, 부록 C.78g)
  gegenBus: {
    goal: '㉔ 게겐 대 버스 — 버스가 자기 ⅓ 에서 뺏으면 첫 행동 빠름·뺏긴 팀 늦게 모임 (C.78g)', enabled: true,
    check: (v) => v.first! <= v.firstOff! - 0.4 && v.near1! <= v.near1Off! - 0.8 && v.adv! >= v.advOff! - 1.5,
  },
  // C.78g ㉕: 균형 대 균형(잃은 팀이 덜 올라와 있음) — 4초 전진 차 ≤ 3 m · 8초 안 상대 진영 비율 차 ≤ 0.1 (효과 작음)
  balancedSwing: {
    goal: '㉕ 균형 대 균형 — 잃은 팀이 덜 올라와 있으면 전환 순간 효과 작음 (C.78g)', enabled: true,
    check: (v) => Math.abs(v.adv! - v.advOff!) <= 3 && Math.abs(v.half! - v.halfOff!) <= 0.1,
  },
};
