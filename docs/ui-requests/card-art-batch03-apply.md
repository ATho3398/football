# 카드 그림 BATCH 03 적용 명세 (2026-10-17, UI_1)

- 받은 파일: `PLAYER_ONE_BATCH03_13-16_final.zip`(사용자 2026-10-17 22:40 KST, PNG 5장, 각 1254×1254, 장마다 2×2 칸 + 아래 카드 이름 띠).
- 내용: 화면 디자인(5차 요청 57~123번)이 **아니라 카드 일러스트**다. 5차 화면 요청은 아직 디자인 대기.
- 레포에 넣은 것: 칸마다 잘라 이름 띠를 뺀 그림 17장 → `docs/design/incoming/card-art/batch03/<카드 id>.webp`(약 625×570, 칸 하나 40~50 KB, 합계 0.75 MB). 원본 zip은 레포에 넣지 않음(9 MB).
- 이름 띠 글자 = `src/signatureCards.ts`·`src/config/cards.ts`의 카드 이름과 정확히 같다(한 장씩 대조).

## 1. 그림 ↔ 카드

| 원본 장·칸 | 카드 이름 | 카드 id | 종류 | 파일 |
|---|---|---|---|---|
| 13 ① | 등지고 버티기 | `targetMan` | 시그니처(타겟맨) | `targetMan.webp` |
| 13 ② | 내려와서 연계 | `falseNine` | 시그니처(펄스 나인) | `falseNine.webp` |
| 13 ③ | 라인 깨기 | `advancedForward` | 시그니처(침투형 스트라이커) | `advancedForward.webp` |
| 13 ④ | 기다렸다 킬패스 | `classic10` | 시그니처(클래식 10번) | `classic10.webp` |
| 14 ① | 늦은 침투 | `shadowStriker` | 시그니처(섀도 스트라이커) | `shadowStriker.webp` |
| 14 ② | 자유 이동 원투 | `freeRole` | 시그니처(프리롤) | `freeRole.webp` |
| 14 ③ | 리바운드 반응 | `boxCrasher` | 시그니처(박스 침투형) | `boxCrasher.webp` |
| 14 ④ | 시간 멈추기 | `enganche` | 시그니처(엔간체) — 스톱워치 그림, 이 칸만 이름 띠가 커서 더 짧게 자름(625×531) | `enganche.webp` |
| 15 ① | 박스에서 박스로 | `boxToBox` | 시그니처(박스투박스) | `boxToBox.webp` |
| 15 ② | 대각선 전환 | `deepPlaymaker` | 시그니처(딥라잉 플레이메이커) | `deepPlaymaker.webp` |
| 15 ③ | 하프스페이스 침투 슛 | `mezzala` | 시그니처(메짤라) | `mezzala.webp` |
| 15 ④ | 라인 돌파 운반 | `carrier` | 시그니처(캐리어) | `carrier.webp` |
| 16 ① | 커버 슬라이드 | `holdingCM` | 시그니처(홀딩 CM) | `holdingCM.webp` |
| 16 ② | 라인 사이 차단 | `anchor` | 시그니처(앵커) | `anchor.webp` |
| 16 ③ | 뒤에서 낚아채기 | `ballWinner` | 시그니처(볼 위너) | `ballWinner.webp` |
| 16 ④ | 한 번에 전방으로 | `regista` | 시그니처(레지스타) | `regista.webp` |
| BATCH_03 ① | 엘라스티코 | `elastico` | 에픽 · 플레이 · 공격(`src/config/cards.ts`) | `elastico.webp` |
| BATCH_03 ②~④ | 빈칸 | — | 배경만(쓰지 않음) | — |

**아직 그림이 없는 시그니처 15장**(다음 묶음일 것): 바이라인 컷백 `classicWinger`, 접고 감아차기 `wingForward`, 연속 제치기 `crackWinger`, 빈 공간 원터치 `raumdeuter`, 측면 복귀 태클 `wideMid`, 원터치 마무리 `poacher`, 3백 빌드업 기점 `halfBack`, 오버래핑 크로스 `attackingFullback`, 측면 봉쇄 `defensiveFullback`, 중앙으로 좁히기 `invertedFullback`, 끝까지 오버래핑 `completeWingback`, 전진 차단 `stopper`, 전진 패스 꽂기 `ballPlayingCB`, 최후의 태클 `coverCB`, 라인 깨는 운반 `libero`. 일반 카드(플레이·패시브·세트피스 등)의 그림도 없음. 원본 이름이 "BATCH03 · 13-16"이라 BATCH 01·02(1~12장)가 따로 있을 수 있다 → 사용자에게 확인.

## 2. 바꿀 곳 (코드 세션이 할 일)

1. **그림 파일 위치**: `public/cards/art/<카드 id>.webp`로 옮긴다(`docs/design/incoming/card-art/batch03/`에서 복사). 런타임 경로는 상대 경로 `cards/art/<id>.webp`(`src/ui/faces.ts`의 `faces/base/`와 같은 방식, Pages 하위 경로 `/football/`에서도 동작).
2. **카드 데이터**: `GameCardData`(`src/ui/components/gameCard.ts`)에 `art?: string` 추가. 카드 정의 → 화면 데이터로 바꾸는 곳(덱·패·획득·카드 상세 VM, `src/ui/viewModels.ts` 등)에서 그림 표에 id가 있으면 `art` URL을 넣는다. 그림 표는 `src/config/cards.ts` 근처에 `CARD_ART: Record<string, true>`(또는 매니페스트 `public/cards/art/manifest.json`)로 두고, 없으면 지금 기본 그림 그대로.
3. **GameCard 렌더**(디자인 `CardArt/README.md` 규칙):
   - `full`(카드 상세 280×392)·`deck`(0.6배)·`hand`(경기 중 패): 그림 영역의 지금 SVG 기본 장면 자리에 `<img class="po-gc__art" src=art alt="" loading="lazy">`, `object-fit: cover`, **가운데 위쪽 기준**(`object-position: 50% 30%`). 디자인 규칙 "핵심은 위쪽 절반, 아래는 망점으로 사라짐"을 지키기 위해 기존 아래쪽 페이드(망점/그라데이션 덮개)는 그대로 그림 위에 얹는다.
   - `mini`(덱 슬롯): 지금 `viewBox="20 90 240 300"` 잘라 보기와 같은 비율로 `object-fit: cover; object-position: 50% 35%`.
   - 그림이 가로로 조금 넓은 정사각형(약 1.1:1)이라 세로 카드(280×320)에서는 좌우가 잘린다. 주인공(9번 선수)과 공이 대부분 가운데에 있어 cover로 충분 — 확인 캡처에서 잘림 확인.
   - 시그니처 회색(역할 불일치) 상태: 그림에도 지금 회색 처리(`filter: grayscale(1)`·불투명도)가 똑같이 걸리는지.
4. **로딩**: 카드 그림은 장당 약 45 KB → 덱 화면 최대 14장 + 가진 카드 목록이면 첫 진입 때 0.5~1 MB. `loading="lazy"`, `decoding="async"`. 실패(404)하면 기본 그림으로(`onerror` 대신 렌더 전에 표로 판정하므로 404는 배포 누락 때만).
5. **세이브·밸런스**: 바뀌지 않음(SAVE_FORMAT_VERSION·BALANCE_VERSION 그대로, 그림은 표시만).

## 3. 데이터 연결 확인

- 시그니처 카드 id는 `sig-<역할 id>`(`src/signatureCards.ts` 22행). 그림 파일 이름은 역할 id라서 표는 `role`(또는 `sig-` 뗀 값)으로 찾는다.
- 엘라스티코는 일반 카드 표(`cards.ts` `id: 'elastico'`).
- 같은 그림을 카드 상세·덱·패·획득 3택 1·카드 결과 띠(카드 이름 옆 작은 그림이 있으면)에서 모두 쓴다.

## 4. 확인 캡처 기준 (`docs/design/<패치>-check/`, 폰 390×844 · PC 1280×800)

1. 카드 상세(full): 시그니처 1장(예 `targetMan` 등지고 버티기)과 `elastico` — 그림 위쪽이 보이고 아래 효과 글이 읽힘.
2. 덱 편집: 그림 있는 카드와 없는 카드가 섞인 덱 그리드(mini) — 기본 그림과 나란히 어색하지 않은지.
3. 결정 순간 패(hand): 그림 카드가 손패에 있을 때.
4. 카드 획득 3택 1(deck): 시즌 종료 희귀 보상에 시그니처가 나올 때(하네스로 강제 가능).
5. 시그니처 역할 불일치 회색 상태 1장.
6. 페이지 오류 0, 깨진 요청(404) 0.

## 5. 남은 질문 (사용자)

1. BATCH 01·02(카드 1~12장)가 따로 있나요? 있으면 이 세션에 주세요 — 같은 방식으로 자릅니다.
2. 빈칸 3개(BATCH_03 ②~④)는 다음 카드 자리로 남겨 둔 것인지(지금은 쓰지 않음).
3. 그림이 정사각형이라 세로 카드에서 좌우가 잘립니다. 추천: 그대로 cover(주인공이 가운데). 세로 원본이 따로 있으면 그걸 쓰는 게 더 좋음.

작성: UI_1 `session_01D3WSqiWMZA3itvZV4ppYvC` · 명령 시각 2026-10-17 22:40 KST / 작성 시각 2026-10-17 22:47 KST
