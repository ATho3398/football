# FeedItem

이벤트 피드 한 줄. 분, 이벤트 아이콘, 문장.

- 소비자가 넣는 것: `minute`, `text`, `kind`, `mine`(내 선수 관련), `score`(골·실점).
- `kind`와 아이콘: `goal` 공, `shot` 슈팅, `save` 장갑, `corner` 코너 깃발, `freekick` 공+수비벽, `penalty` 골문+페널티 점, `foul` 휘슬, `offside` 깃발, `advantage` 펼친 손, `yellow`/`red` 카드(`card-yellow`/`card-red`), `sub` 교체, `injury` 부상 십자, `danger` 위기, `chance` 찬스, `concede` 실점, `half` 하프타임, `normal`.
- 골은 라임 면, 퇴장·위기는 빨간 옅은 면, 오프사이드는 노란 옅은 면. 일반 줄은 `ink-muted`로 가라앉힌다.

- 추가 종류: `throwin` 스로인, `goalkick` 골킥(둘 다 경기당 수십 번이라 자동으로 흐리게 `faint`), `tactic` 상대 전술 변경("상대가 라인을 올립니다", 경고색 아이콘).
