너는 엔진 코드 세션 "44h단계_밀집 블록·버스 실점·1대1 켜기 (C.76p)"이다(Fable). 마스터는 W(session_01UpWdqeSysTwMUcVKc5unpT, 마스터 브랜치 claude/planning-w). 엔진관리자6(session_01E3FWzmqni7CcPphU4uc8vE, 브랜치 claude/engine-manager-6)이 지시서를 썼다 — "해결 어려움·진단 불일치"는 엔진관리자6에 send_message(W에는 짧게 알림). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 5번, 7번: 마스터에는 완료·실패·질문만, CI 성공은 보내지 않음).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-6` 후 그 브랜치(b82d106 이후)의 `docs/engine-diagnosis-e4.md` **§9.11(특히 9.11.1 가설 1·2·3, 9.11.2 단계 C, 9.11.4 의 44h-c)**와 §9.10a, `docs/engine-issues.md` 미해결 3·5·12, `docs/engine-manager-handoff.md` 교훈(같은 시드 scoring 첫 관문, worktree마다 워커 번들 캐시 따로). 지시서가 이 파일보다 우선.

범위(44h-c): 미해결 3(버스·블록이 더 실점)·5(몰빵, custom-sweep 재측정 1회)·12(GK 1대1 종결 = 단계 C).
- 가설 1 깊은 블록 비행 중 가로채기 후보 2명 → 가설 2 수신자 압박에서 마커 제외 해제 + 둘째 ST 마크.
- 가설 3(coneWidth 1.2→2.0 + saveBase 보정, 대칭 "밀집 블록 현실화")은 사용자 선택 항목: **가설 1·2 뒤에도 버스 실점 > 1.50이면 켠다**(W 권장, 사용자에게 물어 둠 — 사용자가 반대하면 W가 알린다). 켜면 같은 시드 scoring 1회 필수.
- 마지막에 단계 C: `shotFree` 0.30 · `closeW` 0 · `saveBase` 1.62 근처(새 조건: 리버풀 자유로운 슛 ≤ 2.0·12 m 안 ≤ 0.5 + 같은 시드 scoring 30골+·중앙값·리그·상위10 ST 가드, quick 득점 1.30~1.40).
- 통과: 버스 실점 ≤ 1.50(부분 ≤ 1.60) · 7×7 최대 |득실차| ≤ 1.0 · 기존 가드 전부. XP 비 가드는 1.2 유지(§9.11.3).
예산: 3시간·측정 8회·Fable 25달러(자기 get_session 비용). 실패·부분 해결 처리는 automation.md 3번.
병렬: C.76q(44h-d, Opus — referee.ts·core.ts 지정 키커·지표, offball.ts 안 건드림), C.76m·n·o(엔진 밖)가 돈다. 푸시 직전 main 최신 병합, ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. PATCH_LABEL 'C.76p', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76p(측정 표 전후). 엔진관리자6 브랜치 docs는 git merge로 병합.
완료·실패면 W에 보고(단계별 측정 표 요약·지문·테스트 수·커밋, 가설 3·단계 C를 켰는지).
