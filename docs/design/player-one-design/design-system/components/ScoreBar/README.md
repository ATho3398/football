# ScoreBar

경기 화면 상단 스코어/분 바와 속도 컨트롤.

- 소비자가 넣는 것: `home`, `away`, `homeScore`, `awayScore`, `minute`, `speed`, `paused`, `status`(결정 순간·골·오프사이드 등 정지 사유, 라임 칩), `homeRed`/`awayRed`(퇴장 수), `homePlayers`/`awayPlayers`(기본 11−퇴장), `onSpeed`, `onPause`, `onSkip`.
- 퇴장이 나오면 그 팀 이름 옆에 레드카드 아이콘 + "10명" 칩이 붙는다.
- 경기는 계속 흐르고, 내 선수가 공을 잡는 결정 순간에만 자동으로 멈춘다(`paused` + `status: '결정 순간'`).

- `homeTactic`/`awayTactic`(`{ tactic, formation }`)을 주면 아래에 양 팀 성향 칩(`TacticChip` `xs`)과 포메이션 줄이 붙는다.

- `mode`(`manual`|`auto`)를 주면 시간 칩 옆에 직접/자동 토글이 붙는다(경기 중 언제든 전환).
- `ff`: 재개 대기 구간 자동 빨리 감기 중 표시(시간 칩이 회색 + ▶▶ "빨리 감기").
