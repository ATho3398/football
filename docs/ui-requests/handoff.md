# UI 세션 인수인계 (`docs/automation.md` 6번)

- 지금 UI 세션: **UI_1** `session_01D3WSqiWMZA3itvZV4ppYvC` (브랜치 `claude/ui-1`, 섹션 `플레이어 원_UI`, 연 세션 = 마스터 L `session_01EWtWvJrTgC8wWMeELQz664`)
- **지금 마스터: M** `session_01BTacbWbkVFVE6HVKwxLx3v` (브랜치 `claude/planning-m`, 2026-10-17 20:57 KST L → M 교체). 알림·보고는 M으로.
  - 참고: `docs/planning-pending.md` 58에는 UI_1 ID가 `session_01QuN9pxUgr2T4SN6FKmUmjd`로 적혀 있다. 실제 이 세션 ID는 위 값(`get_session` 확인).
- 현재 차례: **5** (5차 보고 2026-10-17 완료 → 다음 보고는 6차)
- 5차 보고 뒤 쌓인 디자인 없는 새 화면·패널: **4개** (+ 작은 변형 4) (그런 화면이 있는 단계: 1개 — C.45)
- 다음 보고 조건: 6개 이상, 또는 그런 단계 3개 이상, 또는 사용자 화면 불만 → 6차(새로 쌓인 것만)

## 디자인 안 온 보고

| 차례 | 날짜 | 문서 | 캡처 | 기준 빌드 | 상태 |
|---|---|---|---|---|---|
| 5 | 2026-10-17 | `docs/ui-requests/5.md` | `docs/ui-requests/5/phone/`(70), `5/pc/`(69) | main c064b8d, C.44a | 사용자에게 보고, 디자인 대기 |

(1~4차는 디자인이 왔다: `docs/design-change-request*.md` → 디자인 묶음 `docs/design/player-one-design/`, 56장)

## 쌓기 기록 (5차 보고 뒤)

| 단계(부록 C) | 디자인 없는 새 화면·패널 | 개수 |
|---|---|---|
| C.45 (34단계 1차, main 5258ecf, 2026-10-17 20:52 KST 통보) | 큰 것: ① 새 게임 커스텀 생성 화면 전체(배분 포인트 띠·나이/키/몸무게 스테퍼·주발/약발/외모군/도트 머리 칩·국적·장단점·능력치 배분·시작 소속) ② 설정 → 경기 아이콘(선수 인물 14종 격자 / 구단·대표팀 유니폼 홈·원정 32종 격자) ③ 선수 화면 신체·양발·장단점 칸(등번호·키·몸무게·주발·약발, [약발 +1 · 50P], 장단점·유스·스토리 태그) ④ 홈 1군 테스트 띠. 작은 변형: 새 게임 랜덤 신체·장단점 줄, 선수 화면 경기 아이콘 카드, 이적 제안 "친정 · 유스 구단" 칩·자유계약 안내, 경기 화면 캐릭터(도트 + 등번호 띠). 캡처 `docs/design/c45-check/` | 4 (+작은 4) |

## 캡처 방법 (다음 UI 세션용)
- `npm ci && npm run build && npx vite preview --port 4173` 뒤 Playwright(`/opt/node-tools/node_modules/playwright`, 크로뮴 `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`)로 실제 선수 손흥민 새 게임 → 시즌 끝까지. 5차 스크립트는 코드라 레포에 넣지 않았다(레포의 `scripts/c44-capture.mjs` 등 단계별 스크립트의 도우미 함수와 같은 방식: `go-tab`은 폰에서 숨은 독 칸이 있어 `document.querySelector(...).click()`으로 누른다, 전술은 3경기 뒤 열림).

## 푸시 규칙 (마스터 L 2026-10-17 19:38·19:49 KST, `automation.md` 0번)
- UI 세션은 **`claude/ui-1` 브랜치에만 푸시**하고 main에는 올리지 않는다(문서 푸시가 Pages 배포를 취소시킴, 808647d가 배포 #166을 취소). 코드 세션이 배포할 때 ui-1의 docs/를 병합한다.

## 보고 전달 규칙 (마스터 M 2026-10-17 21:03 KST, `automation.md` 6번 2항, claude/planning-m facd572)
- 보고 답변 **본문에 Claude Design 프롬프트 전문을 코드 블록 하나로 그대로** 붙인다. 경로만 주는 것은 금지(사용자가 브랜치 파일을 열기 어렵다).
- SendUserFile로 `<N>_ClaudeDesign_프롬프트.txt`, 캡처 묶음 `<N>_캡처.zip`(필요하면 player-one-design zip)도 보낸다.
- 5차: 2026-10-17 21:04 KST 프롬프트 전문 재전달 + txt·zip 전송 완료.
