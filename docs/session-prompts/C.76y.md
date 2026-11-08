너는 엔진 코드 세션 "44h단계_역할 득실 편차 (C.76y)"이다(Fable, 노력도 높음). 마스터는 X(session_012GNg6RDeZPkuVx81rChZ91, 마스터 브랜치 claude/planning-x). 지시서는 엔진관리자7(session_018DRMCh4bNW71nsPnQCaAJ3, 브랜치 claude/engine-manager-7) — "해결 어려움·진단 불일치"는 엔진관리자7에 send_message(X에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-7` 후 `docs/engine-diagnosis-e4.md` **§9.13**(그리고 그 안에서 가리키는 §9.12 절) → main 부록 C.76w(엔진 33 기준선, 지문 6ab3059beba28723) → `docs/engine-issues.md` 해당 번호 → `docs/engine-manager-handoff.md` 교훈.

범위(44h-f2 = §9.13 (c), 미해결 4): 역할 득실 편차(펄스 나인 −0.19·메짤라 +0.13 등 ±0.1 넘는 역할) — `role-pair 800` 시드 2벌로 먼저 재측정(엔진 33) → 남은 것만 `roles.ts` 역할 파라미터 1회 조정 → 재측정. 같은 포지션군 평균 대비 |득실| ≤ 0.1 목표, 표준오차 넘는 것만 손댐.
예산: 2시간·측정 6회·Fable 15달러. PATCH_LABEL 'C.76y'. 부록 C에 C.76y, engine-issues 4·17.2 갱신.
결과 할당·고무줄 금지. 가드: engine:check(XP 비 ≤ 1.15)·balance:check·quick 600(득점·Δ+8·득점 비율)·같은 시드 scoring(30골+ ≤ 2.0)·sweep 7×7 ≤ 1.0. 결과가 기준선과 완전히 같으면 상수 경로 오류.
병렬: 엔진 세션 3개가 동시에 돈다 — C.76x(44h-g, offball 상수 lateRunDepth/boxRunDepth) · C.76y(44h-f2, roles.ts) · C.76z(44h-f3, onball.ts loss()·pref.long). 파일은 안 겹치지만 config.ts는 겹칠 수 있다. 푸시 직전 main 최신 병합, 다른 세션이 먼저 배포했으면 그 위에서 quick·engine:check 가드 재확인(늦게 끝나는 쪽 몫). ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. STAGE_LABEL은 main 값 그대로. 엔진관리자7 docs는 git merge로.
완료·실패면 X에 보고(측정 요약·전후 표·지문·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
