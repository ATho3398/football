# ResultSplash

경합 상황 결과 연출. 성공은 라임 면에 도장이 찍히듯 등장하고, 실패는 빨간 테두리와 함께 화면이 짧게 흔들린다.

- 소비자가 넣는 것: `result`(`success`|`fail`), `title`, `detail`(고른 선택지와 확률), `rating`, `ratingDelta`.
- 1.5초 보여 준 뒤 피드로 돌아간다. `prefers-reduced-motion`이면 애니메이션 없이 정지 화면.
