# PlayerCard

선수 카드. 홈의 선수 카드, 선수 상세 머리, 새 게임 미리 보기, 순위/검색 행에 쓴다.

- 소비자가 넣는 것: `player` 객체 `{ name, age, position, ovr, tier, tierScore, level, xp, xpMax, team, avatar?, crest? }`, `variant`(`full`|`compact`).
- 2px 테두리와 포지션 칩 색이 위상 티어를 따른다(`tier-*`). 발광 없음.
- OVR은 `num-ovr` 크기의 display 숫자, 포지션은 티어색. 너비 240~358px에서 쓴다.
