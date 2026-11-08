# Meter

가로 진행 바. 레벨 XP, 감독 신뢰도, 위상 진행도처럼 0→max로 채워지는 값.

- 소비자가 넣는 것: `value`, `max`(기본 100), `gain`(이번에 얻는 양, 빗금으로 표시), `label`, `showValue`, `tone`(`brand`|`xp`|`mine`|`warning`), `size`(`lg`).
- XP는 `xp` 톤(라임→시안). 경기 후 화면에서는 `gain`으로 획득량을 먼저 보여 주고 채운다.
