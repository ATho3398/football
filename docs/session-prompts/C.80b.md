너는 게임 시스템 코드 세션 "53단계_빠른 경기 무승부율·중립 표시 (C.80b)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 브랜치 `claude/c80b-quick-draw` — origin/main 최신에서, main 푸시 전 merge.

근거: C.79o(빠른 경기 홈 이점 → 레이팅 +3.4) 남은 것: ① **빠른 경기 무승부 21.8%**(목표 27±2 밖 — 독립 포아송 구조, 옛 식부터) — 실축 PL 약 23~26%. ② '중립' 표시가 달력 칸 제목·지난 경기 기록엔 안 나옴.
- 할 일: ① `league.ts simulateScore`(빠른 경기)에 무승부 보정(예: 이변량 포아송 공분산 항 또는 Dixon-Coles 저득점 보정 ρ) — 팀 득점·홈 승률(44/22/34)·득점 분포는 유지하고 무승부만 24~27%로. 목표는 기획서 27±2를 실축 기준 24~27로 고쳐 적어도 됨(근거 기록). ② 결승·대표팀 대회 '중립'을 달력 칸·지난 경기 기록에도(문구만).
- 관문: 빠른 경기 20시즌 홈 승/무/패·팀 득점·0-0 비율 전후표 · `npm run balance` 회귀 가드 · typecheck · test · balance:check(60분 넘으면 CI) · engine:check(엔진 불변). 통과하면 승인 없이 main 푸시. BALANCE +1(merge 순서대로), PATCH_LABEL 'C.80b', STAGE '53단계', 부록 C.80b. 예산 1.5시간·7달러.
