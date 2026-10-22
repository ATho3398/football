// 기준 장면 목표 (C.77w): enabled = false 면 지금 값 기록과 기본 불변식만 검사한다. 로드맵 2~4단계 패치가 해당 장면을 켜고 check 를 채운다.
// current = C.77w 측정값 (엔진 40, 지문 11ab14dbb9cf9706). 패치가 동작을 바꾸면 이 표를 같이 고친다.

import type { SceneId } from './scenes';

export interface SceneTarget {
  /** 무엇을 보는가 / 어느 로드맵 단계가 켜는가 */
  goal: string;
  enabled: boolean;
  /** 켜졌을 때 통과 조건 (값 → 통과 여부) */
  check?: (v: Record<string, number>) => boolean;
}

export const TARGETS: Record<SceneId, SceneTarget> = {
  chase: { goal: '① 추적 간격 일정 (2단계 이동·도착 시간)', enabled: false },
  stop: { goal: '② 급정지 반응 시간·지나친 거리 (2단계)', enabled: false },
  highLine: { goal: '③ 뒤도는 느린 CB 불리 (2단계, 5단계 높은 라인 비용)', enabled: false },
  keeper: { goal: '④ GK 이동 시간 대 선방, 느린 횡패스 대 빠른 컷백 (4단계)', enabled: false },
  backpass: { goal: '⑤ 막힘/열림에 따라 백패스 비율·이유가 다름 (3단계)', enabled: false },
};
