# 도트 얼굴 (경기 화면 "캐릭터" 보기, 부록 C.43)

경기 화면 [보기] → **캐릭터**를 고르면 피치 위 선수가 이 도트 얼굴로 보입니다. 이미지가 없는 선수는 **등번호**(기본 표시) 그대로입니다.

1. 이미지를 이 폴더에 넣습니다. 정사각형 권장(예: 32×32, 48×48), 배경 투명 PNG. 정사각형이 아니면 비율 그대로 아래쪽 맞춤, 남는 쪽은 투명.
   확대할 때 보간을 끄므로(`image-rendering: pixelated`와 같음) 작은 도트도 선명하게 커집니다.
2. `manifest.json`에 적습니다.

```json
{
  "version": 1,
  "players": { "son": "son.png", "kane": "kane.png" },
  "appearance": {
    "eastAsian": ["asian-1.png", "asian-2.png"],
    "white": ["white-1.png"],
    "irish": ["irish-1.png"],
    "black": ["black-1.png"],
    "latinMideast": ["latin-1.png"]
  }
}
```

- `players`: 특정 선수(선수 id: `data/players/stars.ts`의 id, 내 가상 유망주는 `me:<월드 시드>`)에게 직접 지정. 먼저 쓴다.
- `appearance`: 외모군별 목록. 선수 id 시드로 한 장을 골라 늘 같은 얼굴이 됩니다.
