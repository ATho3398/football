# 기본 얼굴 이미지 (부록 C.43)

가상 선수(와 사진이 없는 실제 선수)에게 외모군에 맞춰 입히는 얼굴입니다. 비어 있으면 지금 아바타를 씁니다.

1. 이미지 파일(정사각형 권장, 256px 정도, PNG/WebP/JPG)을 이 폴더에 넣습니다. 예: `asian-1.png`
2. `manifest.json`의 `faces`에 한 줄씩 적습니다.

```json
{
  "version": 1,
  "faces": [
    { "file": "asian-1.png", "appearance": "eastAsian" },
    { "file": "white-1.png", "appearance": "white" },
    { "file": "irish-1.png", "appearance": "irish" },
    { "file": "black-1.png", "appearance": "black" },
    { "file": "latin-1.png", "appearance": "latinMideast" }
  ]
}
```

외모군: `eastAsian`(동양계) · `white`(백인) · `irish`(아일랜드계) · `black`(흑인) · `latinMideast`(라틴·중동계).
같은 외모군에 여러 장이 있으면 선수 id 시드로 한 장을 골라 늘 같은 얼굴이 됩니다.
외모군 이름을 바꾸거나 늘리려면 `src/appearance.ts`의 `APPEARANCES`와 `src/config/balance.ts`의 `appearance` 분포표도 같이 고칩니다.
