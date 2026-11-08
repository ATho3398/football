# RatingBadge

경기 평점. 항상 소수 첫째 자리, 5단계 색.

- 소비자가 넣는 것: `value`(숫자), `delta`(직전 대비 변화, 선택), `size`(`sm`|`md`|`lg`).
- 단계: 5.0 미만 `rating-1`, 5.0~5.9 `rating-2`, 6.0~6.9 `rating-3`, 7.0~7.9 `rating-4`, 8.0 이상 `rating-5`.
- `delta`는 ▲/▼ 기호와 `success`/`fail` 색을 함께 써서 색만으로 구분하지 않는다. 0이면 ±0.0 `neutral`.
- 경기 중 내 선수 상태 줄은 `sm`/`md`, 경기 후 결과는 `lg`.
