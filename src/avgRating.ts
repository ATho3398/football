// 평균 평점 반올림 한 곳 (C.81o, 17차 검수 14번): 화면마다 toFixed(2)·Math.round(×100) 를 섞어 써서
// 같은 평균(예 6.775)이 한 화면은 6.77, 다른 화면은 6.78 로 보였다. 이제 모두 이 함수로 반올림한다(0.005 는 올림).

/** 평균 평점 (소수 둘째 자리 반올림). 경기가 없으면 null */
export function avgRating(sum: number, apps: number): number | null {
  if (!apps) return null;
  return roundRating(sum / apps);
}

/** 평점 값을 소수 둘째 자리로 반올림 (부동소수 오차로 6.775 가 6.77 로 내려가지 않게 작은 여유를 더한다) */
export function roundRating(v: number): number {
  return Math.round(v * 100 + 1e-6) / 100;
}

/** 화면 글자 "6.78" (경기가 없거나 값이 없으면 "-") */
export function ratingText(v: number | null | undefined): string {
  return v === null || v === undefined ? '-' : roundRating(v).toFixed(2);
}

/** 합·경기 수로 바로 "6.78" / "-" */
export function avgRatingText(sum: number, apps: number): string {
  return ratingText(avgRating(sum, apps));
}
