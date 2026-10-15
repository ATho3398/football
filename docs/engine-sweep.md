# 상수 스윕 결과 (`npm run balance:sweep`)

- 실행: 2026-10-15 07:30 (UTC) · ENGINE_VERSION 2 · 1조합 · 36초
- 축: `rating.win` = 0.15 / `rating.loss` = -0.15 / `rating.cleanSheet` = 0.2 / `rating.conceded` = -0.08 / `rating.pass` = 0.012 / `rating.forwardPass` = 0.035
- 조합당 표본: 동레이팅 SWEEP_N(기본 60) + Δ+8 SWEEP_D(40) + 스탯 반응 각 SWEEP_RESP(40)경기 (작은 표본, 고른 값은 전체 점검으로 다시 확인). 스탯 반응 칸: 변화 (단측 95% 한계) 통과

| rating.win | rating.loss | rating.cleanSheet | rating.conceded | rating.pass | rating.forwardPass | 평점 | 평점σ | rGK | rCB | rFB | rCDM | rCM | rCAM | rWING | rST | ST 득점% | CM 패스%p | CB 태클%p |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 0.15 | -0.15 | 0.2 | -0.08 | 0.012 | 0.035 | 6.29 | 0.61 | 6.3 | 6.4 | 6.3 | 6.3 | 6.2 | 6.4 | 6.3 | 6.1 | - | - | - |
