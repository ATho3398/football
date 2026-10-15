# ChoiceButton

결정 순간의 선택지. 항상 안전 / 균형 / 도박 3유형이 한 장씩 나온다.

- 소비자가 넣는 것: `kind`(`safe` 방패 아이콘·시안 | `balanced` 저울 아이콘·라임 | `gamble` 주사위 아이콘·주황), `name`, `chance`(%), `chanceDelta`(카드 적용 시 %p), `success`·`fail` `{ text, rating }`, `offside`(`low`|`mid`|`high`, 침투 패스 등 오프사이드가 걸릴 수 있는 선택지), `risk`, `selected`, `disabled`, `onClick`.
- 유형은 아이콘 + 단어 + 색으로 구분해 색만으로 구분하지 않는다(`choice-safe`, `choice-balanced`, `choice-gamble`). 같은 색으로 코트 위 화살표를 그린다.
- 오프사이드 위험은 깃발 아이콘 + 낮음/중간/높음 + 3칸 막대(초록·노랑·빨강)로 표시한다.
- 선택하면 라임 면이 되고, 코트(`Pitch`)에 그 선택지의 화살표가 진하게 미리 보인다.
- `compact`: 성공/실패를 한 줄로 줄인 형태. 경합 패널에 코트·카드 목록과 함께 넣을 때 쓴다.

- 확률 변화: `chanceDelta` + `deltaSource`(예: '카드') → 옛 확률 취소선, 새 확률, "▲+8 카드". 오르면 `success`(초록), 내리면 `fail`(빨강).
- `kind="play"`: 플레이 카드로 추가된 4번째 선택지. `card`(카드 이름 칩)와 `rarity`(테두리 색 = 카드 희귀도 색), 아이콘은 '새 선택지'(`newchoice`).
