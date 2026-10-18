# 카드 그림 61장 적용 명세 (2026-10-19, UI_3)

- 받은 것: `PLAYER_ONE_card_art.zip`(사용자 2026-10-19 03:12 KST) = `images/card-<그림세션 id>.png` 61장(정사각 1:1, 약 560~1000px; 프리킥 스페셜·무회전 프리킥·페널티 스페셜·파넨카 4장만 예전 4:3) + `cards.json`(이름·위치값).
- 레포: `docs/design/incoming/card-art/set61/<파일>.webp` 61장(webp q88, 합계 2.0 MB) + **`card-art.json`**(카드별 `cardId`·`file`·`name`·`artSquare`·`size`·`full`·`mini`). 그림 세션 id(curl·nolook…)는 게임 id와 달라 **카드 이름으로 1:1 대조**(61장 모두 일치, 못 맞춘 것 0). 시그니처 파일 이름 = 역할 id(`sig-` 뺌, `artFile()` 규칙).
- 그림 세션 `cards.json`의 희귀도·종류는 **임시값**(README에 명시) — 61장 중 28장이 게임 희귀도와 다르지만 게임은 희귀도를 그림 찾기에 쓰지 않으므로 무시. 게임 `src/config/cards.ts` 희귀도가 기준.

## 코드 세션이 할 일 (작은 패치)
1. **파일**: `docs/design/incoming/card-art/set61/*.webp` → `public/cards/art/`(BATCH 03 17장은 이 판의 새 그림으로 **덮어씀** — 같은 카드, 정사각 원본). `CARD_ART_FILES`를 `card-art.json`의 `file` 61개로.
2. **기본 위치표**: `card-art.json`의 `full`(정식·덱 = `artPos`)·`mini`(덱 슬롯·경기 중 패 = `artPosMini`)를 카드별 기본 위치로. 사용자 위치(설정 → 카드 이미지)가 있으면 그것이 우선(지금 사용자 위치는 하나 → `full`·`mini` 둘 다에 적용하거나 사용자 편집 시트에 정식/간략 두 칸 — 추천: 지금은 하나로 둘 다).
3. **GameCard**(`src/ui/components/gameCard.ts`): 디자인 B 묶음 GameCard(`bundle.js` CardScene, README 26~28줄)대로 — `artSquare`(1:1 원본: 가로 280에 맞추고 세로는 칸 밖으로 넘침, `y`로 고름), `artPosMini`(mini·hand에서 사용, 없으면 `artPos`), `flip`(좌우 반전), `rotate`(−45~45도, 시계 +), 옮겨서 드러난 가장자리 거울 채움. 위치 단위: x = 오른쪽 %, y = 위로 %(그림 칸 기준), zoom 1~4.
4. **확인 캡처**: 감아차기(기본)·프리킥 크로스(flip)·롱패스 전환(간략 rotate −16)·파넨카(4:3, artSquare false)·리셋(x0 y0)의 정식 + 덱 슬롯 + 경기 중 패. 덱 화면 전체 1장(그림 61장 + 그림 없는 15장 섞임).
5. **그림 없는 카드 15장**(시그니처 11 + 오프사이드 트랩 지휘·지시 이행·독단·감독의 신뢰)은 기본 장면 그대로. 그림 세션 프롬프트 `card-art-remaining-prompt.txt`.
