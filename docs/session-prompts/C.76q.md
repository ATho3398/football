너는 엔진 코드 세션 "44h단계_PK 빈도·지정 키커·선방률 지표 (C.76q)"이다(Opus). 마스터는 W(session_01UpWdqeSysTwMUcVKc5unpT, 마스터 브랜치 claude/planning-w). 지시서는 엔진관리자6(session_01E3FWzmqni7CcPphU4uc8vE, 브랜치 claude/engine-manager-6) — "해결 어려움·진단 불일치"는 엔진관리자6에 send_message(W에는 짧게 알림). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번: 마스터에는 완료·실패·질문만).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-6` 후 `docs/engine-diagnosis-e4.md` §9.11.4의 44h-d, `docs/engine-issues.md` 미해결 6·13, `docs/engine-manager-handoff.md` 교훈.

범위(44h-d): 미해결 13 PK 빈도 0.136/경기 → 현실 0.25~0.3(`referee.ts` 박스 안 파울 확률 공통 상수 1개) + 지정 PK 키커(`core.ts:193`, 마무리·침착 최고; 세이브 구조 안 건드림) + 승부차기 장면은 만들지 않음(사용자 결정). PK가 늘면 득점 +0.03~0.05 → `saveBase` 쌍 보정(단, C.76p가 saveBase를 단계 C에서 바꾸므로 병합 때 main 값 기준으로 다시 맞춘다). 미해결 6 선방률은 처방 없이 "12 m 밖 선방률" 지표 재정의만(balance 표·engine:check 출력). 미해결 9(LM/RM)는 offball.ts가 C.76p와 겹쳐서 이번에 안 한다.
통과: PK 0.22~0.32/경기 · quick 득점 1.30~1.45 · 같은 시드 scoring 가드 · balance 회귀 가드 전부.
예산: 2시간·측정 6회. 병렬: C.76p(44h-c, Fable, offball.ts·config.ts prob/keeper), C.76m·n·o. 푸시 직전 main 최신 병합, ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. PATCH_LABEL 'C.76q', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76q. 엔진관리자6 브랜치 docs는 git merge로 병합.
완료·실패면 W에 보고(측정 요약·지문·테스트 수·커밋).
