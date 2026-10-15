# BottomSheet

바텀시트. 경합 상황 선택 패널, 카드 상세, 필터 같은 아래에서 올라오는 패널.

- 소비자가 넣는 것: `title`, `eyebrow`(작은 머리글, 예: "85' · 슈팅 찬스"), `subtitle`, children(본문), `footer`(확정 버튼 등), `open`, `onClose`, `inline`(오버레이 없이 그 자리에 렌더).
- 위 모서리 `radius-xl`, 바탕 `surface-2`, 뒤 막 `scrim`. 최대 높이 88vh, 본문만 스크롤.
- 경합 상황 패널은 바깥을 탭해도 닫히지 않는다(선택 필수).
