너는 엔진 코드 세션 "44h단계_게겐 대가·압박 비용·밀집 블록 (C.76s)"이다(Fable). 마스터는 W(session_01UpWdqeSysTwMUcVKc5unpT, 마스터 브랜치 claude/planning-w). 지시서는 엔진관리자6(session_01E3FWzmqni7CcPphU4uc8vE, 브랜치 claude/engine-manager-6) — "해결 어려움·진단 불일치"는 엔진관리자6에 send_message(W에는 짧게 알림). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-6` 후 `docs/engine-diagnosis-e4.md` **§9.11.5(44h-c2 게겐 대가, pending 142)**와 §9.11.1 가설 3, main 부록 C.76p(엔진 30 기준선·측정 표), `docs/engine-issues.md` 미해결 3, `docs/planning-pending.md` 142(claude/planning-w), `docs/engine-manager-handoff.md` 교훈.

범위:
A. **가설 3 밀집 블록 현실화(사용자 확정 2026-10-21 00:09 "그거도 ㄱㄱ", C.76p가 조건 미충족으로 안 켬 → 여기서 켠다)**: `prob.coneWidth` 1.2 → 2.0 + `keeper.saveBase` 보정(엔진 30 값 1.62에서). 같은 시드 scoring 1회 필수, 가드 넘으면 1.6~2.0 사이 1회 조정.
B. **44h-c2 게겐 대가(§9.11.5)**: 가설 1 압박 높음 둘째 압박자 공으로·역압박 창(counterBase 4/counterRadius 14)·소모 배수 0.85+0.35p → 게겐 이동 ≥ 8.3 km·끝 스태미나 ≤ 50 / 가설 2 staminaLowFrom 70 + 공통 상수 tiredDuel·tiredTemp·tiredPass → 75분+ 게겐 득실 ≤ 0, 전체 우위 +0.15~0.30, sweep 게겐 평균 +0.74 → ≤ +0.45. 교체가 피로를 흡수하면 교체 수 기록, 필요시 threshold 70→60 1회. 엔진은 경기 안까지만(시즌 누적 부하·부상·노쇠는 시스템 패치로 따로, 엔진은 stats.sprints·distance가 실제로 늘게만).
결과 할당·고무줄 금지. 가드: engine:check(XP 비 ≤ 1.2)·balance:check·quick·같은 시드 scoring·7×7 ≤ 1.0 유지.
예산: 3시간·측정 9회·Fable 25달러. 실패·부분 해결은 automation.md 3번.
병렬: C.76q(44h-d PK, referee.ts·core.ts)·C.76n(47 시상)이 돈다. 푸시 직전 main 최신 병합, ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. PATCH_LABEL 'C.76s', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76s. 엔진관리자6 docs는 git merge로.
완료·실패면 W에 보고(A·B 단계별 측정 요약·지문·테스트 수·커밋).
