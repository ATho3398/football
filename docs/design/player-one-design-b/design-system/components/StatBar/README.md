# StatBar

능력치 한 줄. 이름, 막대, 값. 포인트 찍기 화면에서는 비용과 +/− 버튼이 붙는다.

- 소비자가 넣는 것: `label`, `value`, `max`(기본 99), `add`(이번에 찍을 양), `editable`, `cost`(+1 비용, 2 이상이면 `warning`), `ovrDelta`(+1당 OVR 변화), `maxed`(한 번에 +3 또는 최대값 도달 시 잠금), `highlight`(포지션 핵심 능력치), `onPlus`/`onMinus`.
- 막대 색은 값 구간을 따른다: 40 미만 `rating-1`, 55 미만 `rating-2`, 65 미만 `rating-3`, 75 미만 `rating-4`, 그 이상 `rating-5`. 값은 오른쪽 정렬 tabular 숫자.
- 능력치 25개는 7개 묶음(볼 다루기, 마무리, 패스·시야, 수비, 스피드·민첩, 피지컬, 멘탈)으로 접어서 보여 준다.
