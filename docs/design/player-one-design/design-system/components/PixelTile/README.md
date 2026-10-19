# PixelTile

16px 도트 아이콘 타일. 설정 → 경기 아이콘의 **인물 14종**·**유니폼 32종** 격자와 선수 화면 "내 모습"에 써요.

- 그림: `sprite`(번들이 그리는 16×16 도트) 또는 `src`(16px PNG). `sprite` = `{ kind: 'person' | 'kit', skin, hair('none' = 민머리), hairStyle: 'short' | 'long' | 'curly', kit, kit2, pattern: 'solid' | 'stripe' | 'hoop' }`. 피부·머리·유니폼 색은 게임 데이터(구단 색)라 토큰이 아니에요.
- `scale` = 정수배 1~6(16·32·48·64·80·96px). 16의 정수배가 아닌 크기는 만들지 않아요. `image-rendering: pixelated`, SVG는 `shape-rendering: crispEdges`.
- 타일 = 도트 + 사방 6px 여백(`surface-2`, 모서리 12px) + 아래 이름 한 줄(14px 고정). **고름**(`selected`) = 2px 라임 테두리 + 오른쪽 위 ✓ 원, **기본**(`isDefault`) = 왼쪽 아래 "기본" 꼬리표. 둘 다 타일 크기를 바꾸지 않아 격자 줄이 어긋나지 않아요(캡처의 "자동 칸만 커짐" 해결).
- 격자: 인물 14종 = 48px(scale 3) 5열, 유니폼 32종 = 32px(scale 2) 8열 × 4줄. 이름표는 코드(`C01`·`S05`) 또는 짧은 이름.
