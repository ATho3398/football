# CardHand

경기 화면 하단의 패. 간략 카드(`hand`) 4~6장을 살짝 부채꼴로 겹쳐 놓고, 선택한 카드는 위로 올라오며 라임 테두리가 굵어진다.

- 소비자가 넣는 것: `cards`(card 배열, `id` 필수, `disabled` 가능), `selectedId`, `onSelect(id)`.
- 카드를 탭하면 `full` 크기 카드 상세를 바텀시트로 연다.
