너는 엔진 코드 세션 "44h단계_게겐 잔여 둘째 압박 거리 (C.76v)"이다(Fable, 노력도 높음). 마스터는 X(session_012GNg6RDeZPkuVx81rChZ91, 마스터 브랜치 claude/planning-x). 지시서는 엔진관리자7(session_018DRMCh4bNW71nsPnQCaAJ3, 브랜치 claude/engine-manager-7) — "해결 어려움·진단 불일치"는 엔진관리자7에 send_message. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-7` 후 `docs/engine-diagnosis-e4.md` §9.12(44h-c3 줄)·§9.11.5 → main 부록 C.76s(엔진 32 기준선) → `docs/engine-issues.md` 미해결 3.

범위(44h-c3, 미해결 3 게겐 축 잔여): `offball.secondPressDist` 0.6 → 1.0 상수 1개(config.ts만). 측정: `polish-b tac 120 gegen` 1회·sweep 7×7 1회·quick 600 1회 + 가드(engine:check·balance:check·같은 시드 scoring). 목표: sweep 게겐 평균 +0.50 → ≤ +0.45, 게겐 이동 8.19 → 8.3 km 쪽, 75분+ 득실 ≤ 0·7×7 ≤ 1.0·전체 우위 +0.15~0.30 유지. 안 되면 1회 조정(0.8 또는 1.2) 뒤 멈춤. 결과 할당·고무줄 금지.
예산: 1시간·측정 4회·Fable 10달러.
병렬: C.76t(47b 시상, 엔진 무관). 곧 44h-e(offball.ts·config.ts, Fable)가 열릴 수 있다 — config.ts 충돌은 푸시 직전 main 병합으로 푼다. ENGINE_VERSION은 그때 main +1. PATCH_LABEL 'C.76v', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76v, engine-issues 3 갱신. 엔진관리자7 docs는 git merge로.
완료·실패면 X에 보고(측정 요약·지문·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
