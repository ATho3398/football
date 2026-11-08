# Panel (17차 K4)

카드 3종.

- `kind="info"` 정보 카드 — 제목(`title`, `eyebrow`) + 오른쪽 짧은 글(`right`) + 본문.
- `kind="task"` 할 일 카드 — 왼쪽 라임 4px 막대, 행동 버튼을 children에.
- `kind="alert"` 알림 카드 — 테두리 1px + 종류 아이콘 판(`icon`) + 닫기(`onClose`).
- `foldable` + `folded` + `summary` = 접은 한 줄(홈 탭 안 카드).

패널 제목은 패널 안에 둬요. 화면을 섹션으로 나눌 때만 SectionTitle.
