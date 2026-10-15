# Icon

PLAYER ONE 전용 24px 라인 아이콘 세트(2px 선, 둥근 끝). 기존 아이콘 라이브러리를 쓰지 않고 번들에 내장했다.

- 소비자가 넣는 것: `name`(아래 목록), `size`(기본 20), `strokeWidth`, `filled`, `label`(의미 있는 아이콘일 때 스크린리더 이름).
- 색은 `currentColor`라 부모의 글자색을 따른다. 상태를 나타낼 때는 항상 단어와 함께 쓴다.
- 이벤트 피드: `ball`(골), `save`(세이브), `card`(경고/퇴장, 채움), `sub`(교체), `injury`(부상), `danger`(위기), `chance`(찬스), `clock`(하프타임).
- 카드 종류: `newchoice`(플레이), `setpiece`, `passive`, `combo`, `manage`, `signature`, `order`/`solo`(지시 이행/독단). 포지션군 태그: `pos-all`, `pos-att`, `pos-mid`, `defense`(수비). 폼: `double-down`, `arrow-down`, `arrow-flat`, `arrow-up`, `double-up`.
- 내비게이션: `home`, `match`, `player`, `career`, `world`, 상단 바 `bell`, `disk`.
