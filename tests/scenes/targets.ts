// 기준 장면 목표 (C.77w): enabled = false 면 지금 값 기록과 기본 불변식만 검사한다. 로드맵 2~4단계 패치가 해당 장면을 켜고 check 를 채운다.
// current = C.77w 측정값 (엔진 40, 지문 11ab14dbb9cf9706). 패치가 동작을 바꾸면 이 표를 같이 고친다.
// C.77x(엔진 41): ① 간격 2.24 m 일정 ② 되돌아서기 1.2초·지나침 2.6 m ③ 느린 CB +1.14초 / 같은 속도 +0.61초 ⑥ 도착 시간 오차 최대 0.07초

import type { SceneId } from './scenes';

export interface SceneTarget {
  /** 무엇을 보는가 / 어느 로드맵 단계가 켜는가 */
  goal: string;
  enabled: boolean;
  /** 켜졌을 때 통과 조건 (값 → 통과 여부) */
  check?: (v: Record<string, number>) => boolean;
  /** C.77y: 이동 제어기(C.77x MOTION_ON) 켠 상태와 끈 상태 둘 다에서 통과해야 한다 (3단계가 2단계 위에서 작동하는지) */
  both?: boolean;
}

export const TARGETS: Record<SceneId, SceneTarget> = {
  // C.77x 켬: 4초 동안 추적 간격 ≤ 2.5 m
  chase: { goal: '① 추적 간격 일정 (2단계 이동·도착 시간)', enabled: true, check: (v) => v.gapMax! <= 2.5 },
  // C.77x 켬: 공격수가 되돌아 뛸 때 수비 되돌아서기 ≤ 1.2초 · 지나침 ≤ 3 m
  stop: { goal: '② 급정지 반응 시간·지나친 거리 (2단계)', enabled: true, check: (v) => v.reactTime! <= 1.2 + 1e-6 && v.maxPast! <= 3 },
  // C.77x 켬: 느린 CB(60) 도착 차가 같은 속도(80) 대비 +0.4초 이상
  highLine: { goal: '③ 뒤도는 느린 CB 불리 (2단계, 5단계 높은 라인 비용)', enabled: true, check: (v) => v.slowArriveGap! - v.evenArriveGap! >= 0.4 },
  keeper: { goal: '④ GK 이동 시간 대 선방, 느린 횡패스 대 빠른 컷백 (4단계)', enabled: false },
  // C.77y 켬: 열림 백패스 ≤ 3% · 실수(gap 밖) 0 · 이유는 압박 탈출/보존뿐 / 막힘은 백패스·옆 패스가 남음
  backpass: {
    goal: '⑤ 막힘/열림에 따라 백패스 비율·이유가 다름 (3단계)', enabled: true, both: true,
    check: (v) => v.openBack! <= 0.03 && v.openMistake === 0 && Math.abs(v.openEscape! + v.openKeep! - v.openBack!) < 1e-9
      && v.blockedMistake === 0 && v.blockedBack! + v.blockedSide! >= 0.2,
  },
  // C.77y: 패서 침투 ≥ 30% · 목표가 마커 뒤 · 1초 뒤 리턴(침투) 패스 후보
  giveGo: { goal: '⑦ 2:1 — 패스 직후 패서가 마커 뒤로 달리고 리턴 패스 후보가 생김 (3단계)', enabled: true, both: true, check: (v) => v.runRate! >= 0.3 && v.targetBehind! > 0 && v.returnThrough === 1 },
  // C.77y: 마커 2 m 안 → 1.5초 동안 옆으로 3~5 m 움직이고 소유자 → 받는 선수 패스 성공 확률 +0.03 이상 (마커와 거리는 기록 — 마커도 쫓는다)
  check: { goal: '⑧ 받으러 나오기 — 마커가 붙으면 수신 각도를 만든다 (3단계)', enabled: true, both: true, check: (v) => v.moved! >= 2.5 && v.moved! <= 6 && v.pEnd! >= v.p0! + 0.03 },
  arrival: { goal: '⑥ 판단용 도착 시간 = 실제 이동 (2단계, 오차 ≤ 0.2초)', enabled: true, check: (v) => v.maxErr! <= 0.2 },
};
