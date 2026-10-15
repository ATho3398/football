# Pitch

경기장(코트). 22명의 위치, 공, 방향 화살표, 오프사이드 라인을 그린다. 우리 팀은 오른쪽으로 공격한다.

- 소비자가 넣는 것:
  - `players` `[{ x, y, team: 'home'|'away', num?, me?, label?, flag?, dim? }]`: x·y는 0~100 비율(x는 우리 골 0 → 상대 골 100, y는 위 0 → 아래 100). 퇴장 선수는 배열에서 빼면 마커가 사라진다.
  - `ball` `[x, y]`.
  - `arrows` `[{ from:[x,y], to:[x,y], kind: 'pass'|'through'|'cross'|'dribble'|'shot', tone?: 'safe'|'balanced'|'gamble', curve?:[dx,dy], ghost? }]`: 패스·침투·크로스는 점선, 드리블은 지그재그, 슛은 굵은 흰 선. 결정 순간에는 선택한 선택지 화살표만 진하게, 나머지는 `ghost`로 옅게.
  - `offsideX`(0~100): 노란 점선 오프사이드 라인. `marks` `[{ x, y, text, tone }]`: 코트 위 짧은 라벨("코너킥", "GOAL").
- 색: 우리 팀 `team-home`(라임 채움 + 검은 번호), 상대 `team-away`(어두운 채움 + 주황 테두리), 내 선수는 흰 테두리 + `mine` 고리 + 이름표. 코트 바탕 `pitch`는 두 테마 모두 어둡다.
- 너비 100%, 비율 105:68(390 화면에서 358×232).
