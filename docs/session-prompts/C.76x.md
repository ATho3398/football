너는 엔진 코드 세션 "44h단계_득점 분포 목표 재정의·2선 침투 깊이 (C.76x)"이다(Fable, 노력도 높음). 마스터는 X(session_012GNg6RDeZPkuVx81rChZ91, 마스터 브랜치 claude/planning-x). 지시서는 엔진관리자7(session_018DRMCh4bNW71nsPnQCaAJ3, 브랜치 claude/engine-manager-7) — "해결 어려움·진단 불일치"는 엔진관리자7에 send_message(X에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-7` 후 `docs/engine-diagnosis-e4.md` **§9.13**(그리고 그 안에서 가리키는 §9.12 절) → main 부록 C.76w(엔진 33 기준선, 지문 6ab3059beba28723) → `docs/engine-issues.md` 해당 번호 → `docs/engine-manager-handoff.md` 교훈.

범위(44h-g = §9.13 (a), 미해결 11): 목표 재정의(X 결정, 사용자 확인 대기 — 권장안으로 진행) ST 32~40·미드 24~32 + 개인 가드 "MID 시즌 최다 득점자 ≤ 22(지금 27.2)·상위 10 중 CAM ≤ 1(지금 2)" + 상수 2개 `offball.lateRunDepth`/`boxRunDepth` 11/13 → 17/19. 관문 = 같은 시드 scoring 30골+ ≤ 2.0(넘으면 15/17 1회, 그래도면 목표 재정의 문서만 배포). E.22 B 크로스 순간 박스 안 인원(2.5)이 1명 이상 줄면 ✗. 미해결 8은 보류(박스 안 마크 축 끔 그대로).
예산: 1.5시간·측정 5회·Fable 15달러. PATCH_LABEL 'C.76x'. 부록 C에 C.76x, engine-issues 8·11·17.2 갱신.
결과 할당·고무줄 금지. 가드: engine:check(XP 비 ≤ 1.15)·balance:check·quick 600(득점·Δ+8·득점 비율)·같은 시드 scoring(30골+ ≤ 2.0)·sweep 7×7 ≤ 1.0. 결과가 기준선과 완전히 같으면 상수 경로 오류.
병렬: 엔진 세션 3개가 동시에 돈다 — C.76x(44h-g, offball 상수 lateRunDepth/boxRunDepth) · C.76y(44h-f2, roles.ts) · C.76z(44h-f3, onball.ts loss()·pref.long). 파일은 안 겹치지만 config.ts는 겹칠 수 있다. 푸시 직전 main 최신 병합, 다른 세션이 먼저 배포했으면 그 위에서 quick·engine:check 가드 재확인(늦게 끝나는 쪽 몫). ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. STAGE_LABEL은 main 값 그대로. 엔진관리자7 docs는 git merge로.
완료·실패면 X에 보고(측정 요약·전후 표·지문·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
