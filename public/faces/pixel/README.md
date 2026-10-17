# 도트 선수 아이콘 (경기 화면 "캐릭터" 보기, 부록 C.43 → C.45)

경기 화면 [보기] → **캐릭터**를 고르면 피치 위 선수가 도트(16px) 상반신 아이콘으로 보이고, 아래에 작은 등번호가 붙습니다.
이미지가 없거나 조합이 빠진 선수는 **등번호 원**(기본 표시) 그대로입니다. 명세: `docs/design/pixel-kits.md`.

## 레이어 (version 2)

- `person/<피부>_<머리>.png` 14장: 인물(얼굴·머리·팔) 레이어. 피부 `black`/`yellow`/`white`/`mideast`, 머리 `black`/`blonde`/`brown`/`bald` (팩에 있는 조합만).
- `kit/<유니폼 키>.png` 32장: 유니폼(몸통) 레이어. 단색 `C01~C11`, 줄무늬 `S01~S21`.
- 화면은 **인물 위에 유니폼**을 겹쳐 16px의 정수 배(×2·×3)로 보간 없이 그립니다. 두 레이어는 픽셀이 겹치지 않아 어느 순서로 겹쳐도 원본과 같습니다.
- 선수에는 인물만, 구단·대표팀에는 유니폼만 정합니다(`data/players/pixelLook.ts`, `data/kits.ts`, 가상 선수는 외모군 분포). 경기마다 홈·원정·GK 유니폼을 골라 입힙니다(`src/pixel.ts`).
- 사용자는 설정 → **경기 아이콘**에서 모든 선수의 인물과 구단·대표팀 홈·원정 유니폼을 바꿀 수 있습니다(세이브 `pixelOverrides`).

### 다시 만들기

원본 팩(`docs/design/incoming/kits_full_pack.zip`, `raw16/` 16px 448장)에서 레이어를 다시 나눕니다:

```
npx vite-node scripts/splitPixelPack.ts
```

- 같은 유니폼 14장에서 값이 같은 픽셀 → 유니폼 레이어, 같은 인물 32장에서 값이 같은 픽셀 → 인물 레이어(448장 모두 같은 배경은 인물 쪽).
- 다시 겹쳐 448장이 원본과 픽셀 단위로 같지 않으면 아무것도 쓰지 않고 실패합니다(`tests/pixel.test.ts`도 같은 확인).
- `manifest.json`과 `data/pixelPack.ts`(로직·테스트용 같은 표)를 같이 씁니다. 손으로 고치지 마세요.
- 새 유니폼 = `kit/` 1장 + 매니페스트 `kits` 1줄, 새 머리 = `person/` 피부별 1장 + `people` 1칸.

## manifest.json

```json
{
  "version": 2,
  "order": "kit-over-person",
  "kits": { "C01": { "file": "kit/C01_solid_red.png", "colors": ["#c8102e"], "mean": "#c8102e" } },
  "personDir": "person",
  "people": { "black": ["black", "blonde", "bald"], "yellow": ["black", "blonde", "brown", "bald"] },
  "players": { "son": { "skin": "yellow", "hair": "black" }, "someone": "someone.png" }
}
```

- `kits.colors`: 몸통 색(많은 순), `mean`: 몸통 픽셀 평균색. 원정·GK 충돌은 평균색 RGB 거리(`BALANCE.pixelLook.clashDistance`)로 잽니다.
- `players`: 선수 id(`data/players/stars.ts`의 id, 내 가상 유망주는 `me:<월드 시드>`) → `{skin, hair}`(실제 선수 표보다 먼저) 또는 **파일 직접 지정**(version 1 형식, 레이어보다 먼저. 단 설정에서 직접 고른 인물이 가장 먼저).
- version 1 형식(`players`: 파일, `appearance`: 외모군 → 파일 목록)도 그대로 읽습니다.
