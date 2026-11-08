// 경기 분 표기 한 곳 (C.81o): 득점 목록·점수판·피드·클립이 같은 함수로 "45+2'"·"90+3'"을 만든다.
// 엔진 시계 t(초)는 전반 0~45분+추가시간, 후반은 45분(2700초)에서 다시 시작해 90분+추가시간까지 간다.

/** [분, 추가시간 분] — 전반 추가시간은 [45, n], 후반 추가시간은 [90, n], 정규 시간은 [분, 0] */
export function matchMinute(t: number, half: 1 | 2): [number, number] {
  const m = Math.floor(t / 60) + 1;
  const cap = half === 1 ? 45 : 90;
  return m > cap ? [cap, m - cap] : [m, 0];
}

/** "23" · "45+2" · "90+3" (따옴표는 부르는 쪽이 붙인다) */
export function minuteText(min: number, plus = 0): string {
  return plus > 0 ? `${min}+${plus}` : `${min}`;
}
