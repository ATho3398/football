# UI 세션 인수인계 (`docs/automation.md` 6번)

- **지금 UI 세션: UI_2** `session_01PbsMWMDDH2vCaTxbDg8f5F` (브랜치 `claude/ui-2`, `get_session` 확인, 연 세션 = **마스터 M** `session_01BTacbWbkVFVE6HVKwxLx3v`). 2026-10-18 00:30 KST UI_1 → UI_2 인수.
- **UI_1 종료**(2026-10-18 00:30 KST, 5차 디자인 적용 명세 뒤, ui-1 마지막 71dc770). 이전: UI_1 `session_01D3WSqiWMZA3itvZV4ppYvC` (브랜치 `claude/ui-1`) — 5차 디자인 적용 명세(`5-apply.md`, cc77c6e)까지 하고 끝.
- **지금 마스터: N** `session_013dNEvc6CvpGFw1SkMRXsUh` (브랜치 `claude/planning-n`, 2026-10-18 01:16 KST M → N 교체, N은 M이 연 세션). 알림·보고는 N으로(send_message). 카톡·ntfy 알림은 마스터 몫.
  - 이전 마스터 M `session_01BTacbWbkVFVE6HVKwxLx3v` (`claude/planning-m`, UI_2를 연 세션).
- 5차: 디자인 도착(player-one-design 123장, 컴포넌트 45종) → `5-apply.md` → M이 U5-a~g 패치로 적용. **5차 끝.**
- 카드 그림: BATCH 03(17장) → `card-art-batch03-apply.md` → 34d C.48에서 적용. BATCH 01·02·남은 시그니처 15장이 이 세션에 오면 같은 방식(칸 자르기·이름 띠 제거·webp → `docs/design/incoming/card-art/<batch>/<카드 id>.webp`)으로 넣고 명세 표에 합친 뒤 M에 커밋 해시 알림(34d가 끝났으면 별도 소형 적용 명세).
- 푸시: UI_2는 **`claude/ui-2`에만**(main 금지).
- 현재 차례: **5 → 디자인 받음, 다음 보고는 6차**
- 5차 보고 뒤 쌓인 디자인 없는 새 화면·패널: **5개** (+ 작은 변형 14) (큰 것이 있는 단계: 2개 — C.45·C.47, 작은 것만: C.46)
- 다음 보고 조건: 6개 이상, 또는 그런 단계 3개 이상, 또는 사용자 화면 불만 → 6차(새로 쌓인 것만)

## 디자인 안 온 보고

| 차례 | 날짜 | 문서 | 캡처 | 기준 빌드 | 상태 |
|---|---|---|---|---|---|
| 5 | 2026-10-17 | `docs/ui-requests/5.md` | `docs/ui-requests/5/phone/`(70), `5/pc/`(69) | main c064b8d, C.44a | **디자인 도착 2026-10-18 00:24**(57~123 전부, `docs/design/player-one-design/` 덮어씀) → 적용 명세 `docs/ui-requests/5-apply.md` → 마스터 M |

| 카드 그림 | 2026-10-17 22:40 | `docs/ui-requests/card-art-batch03-apply.md` | `docs/design/incoming/card-art/batch03/`(17장) | — | BATCH 03(13~16 + 엘라스티코) 받음 → 적용 명세 → 마스터 M. 남은 시그니처 15장·BATCH 01·02 대기 |

(1~4차는 디자인이 왔다: `docs/design-change-request*.md` → 디자인 묶음 `docs/design/player-one-design/`, 56장)

## 쌓기 기록 (5차 보고 뒤)

| 단계(부록 C) | 디자인 없는 새 화면·패널 | 개수 |
|---|---|---|
| C.45 (34단계 1차, main 5258ecf, 2026-10-17 20:52 KST 통보) | 큰 것: ① 새 게임 커스텀 생성 화면 전체(배분 포인트 띠·나이/키/몸무게 스테퍼·주발/약발/외모군/도트 머리 칩·국적·장단점·능력치 배분·시작 소속) ② 설정 → 경기 아이콘(선수 인물 14종 격자 / 구단·대표팀 유니폼 홈·원정 32종 격자) ③ 선수 화면 신체·양발·장단점 칸(등번호·키·몸무게·주발·약발, [약발 +1 · 50P], 장단점·유스·스토리 태그) ④ 홈 1군 테스트 띠. 작은 변형: 새 게임 랜덤 신체·장단점 줄, 선수 화면 경기 아이콘 카드, 이적 제안 "친정 · 유스 구단" 칩·자유계약 안내, 경기 화면 캐릭터(도트 + 등번호 띠). 캡처 `docs/design/c45-check/` | 4 (+작은 4) |
| C.45 2차 (main 37b1253, 2026-10-17 21:12 KST 통보) | 작은 변형 추가: ⑨ 월드 → 이적 소식 아래 "커리어 태그 소식". 바뀐 것(개수 변동 없음): ③ 선수 화면 칸 → "신체·양발·태그"(생성 태그 + 커리어 태그 한 줄, 해제형 표시), ① 커스텀 생성 "장단점" → "태그 · 장점/단점"([영구 nP]/[해제형 mP] 두 버튼) | +작은 1 |
| **C.45 합계** | | **4 (+작은 5), 단계 1** |
| C.46 (34b, main d5a0a6c, 2026-10-17 22:40 KST 통보) | 작은 변형 4: 월드 순위표 재정 등급 글자 + 범례 / 이적 제안 카드 등급 칩 + "내 몸값" 칩 / 선수 화면 계약과 이적 몸값 칸 / 이적 소식 줄 몸값·도착 팀 등급. 캡처 `docs/design/c46-check/` | 0 (+작은 4) |
| C.47 (34c, main 3155e46, 2026-10-18 01:15 KST 통보) | 큰 것: ⑤ 새 게임 실제 선수 목록의 "레전드" 묶음. 작은 변형 5: 새 게임 레전드 팩 스위치 / 선수 화면 태그 줄 대표 4·전체 보기 / 홈 태그 알림 한 줄 / 월드 레전드 목록 / 태그 소식 새 이름. 캡처 `docs/design/c47-check/` | 1 (+작은 5) |
| **5차 뒤 누계** | | **큰 것 5 (+작은 14), 큰 것 있는 단계 2** — 조건(큰 것 6+ 또는 단계 3+) 아직 아님 |

## 캡처 방법 (다음 UI 세션용)
- `npm ci && npm run build && npx vite preview --port 4173` 뒤 Playwright(`/opt/node-tools/node_modules/playwright`, 크로뮴 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`)로 실제 선수 손흥민 새 게임 → 시즌 끝까지. 5차 스크립트는 코드라 레포에 넣지 않았다(레포의 `scripts/c44-capture.mjs` 등 단계별 스크립트의 도우미 함수와 같은 방식: `go-tab`은 폰에서 숨은 독 칸이 있어 `document.querySelector(...).click()`으로 누른다, 전술은 3경기 뒤 열림).

## 푸시 규칙 (마스터 L 2026-10-17 19:38·19:49 KST, `automation.md` 0번)
- UI 세션은 **자기 브랜치(UI_1 `claude/ui-1`, UI_2 `claude/ui-2`)에만 푸시**하고 main에는 올리지 않는다(문서 푸시가 Pages 배포를 취소시킴, 808647d가 배포 #166을 취소). 코드 세션이 배포할 때 UI 브랜치의 docs/를 병합한다.

## 보고 전달 규칙 (마스터 M 2026-10-17 21:03 KST, `automation.md` 6번 2항, claude/planning-m facd572)
- 보고 답변 **본문에 Claude Design 프롬프트 전문을 코드 블록 하나로 그대로** 붙인다. 경로만 주는 것은 금지(사용자가 브랜치 파일을 열기 어렵다).
- SendUserFile로 `<N>_ClaudeDesign_프롬프트.txt`, 캡처 묶음 `<N>_캡처.zip`(필요하면 player-one-design zip)도 보낸다.
- 5차: 2026-10-17 21:04 KST 프롬프트 전문 재전달 + txt·zip 전송 완료.
