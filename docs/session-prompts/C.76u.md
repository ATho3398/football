너는 엔진 코드 세션 "44h단계_LM/RM 슈팅 컷백 존 (C.76u)"이다(Fable, 노력도 높음). 마스터는 X(session_012GNg6RDeZPkuVx81rChZ91, 마스터 브랜치 claude/planning-x). "해결 어려움·진단 불일치"는 엔진관리자7(곧 열림, X가 ID 알림 — 그 전엔 X에)에게 send_message. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `docs/engine-issues.md` 미해결 9 → `docs/engine-diagnosis-e4.md` §9.11.4(9번 = 44h-d 잔여, offball 겹쳐 44h-c 뒤 순차) → main 부록 C.76s(엔진 32 기준선, 지문 300338da03b1bfb4) → `docs/engine-manager-handoff.md` 교훈.

범위(미해결 9 LM/RM 슈팅 비중 3~4% → 목표 ≥ 10%):
1. 먼저 분해: `npx vite-node scripts/diag/wing-output.ts -- wing-0 20`(엔진 32 기준선 다시 잼) — 슈팅 적은 LM/RM이 같은 쪽 측면 공일 때 어디 있는지(line 2 위치, `finalThirdJob` 자리 유지 비율).
2. 가설 3: `src/engine/offball.ts` `finalThirdJob`에 LM/RM 컷백 존 `'edge'`(박스 모서리·하프스페이스 끝 도착) — 역할 파라미터·공통 규칙으로만. 결과 할당·고무줄 금지.
3. 필요하면 1회 상수 조정(도착 확률·거리).
가드: engine:check(XP 비 ≤ 1.2)·balance:check·quick 600(득점·Δ+8 기록)·같은 시드 scoring(30골+ 지금 1.60 — 더 오르면 ✗)·sweep 7×7 ≤ 1.0·득점 비율(ST/윙/미드/수비) 기록. 측정 결과가 기준선과 완전히 같으면 상수 경로 오류.
예산: 2시간·측정 6회·Fable 15달러. 실패·부분 해결은 automation.md 3번.
병렬: C.76t(47b 시상, 엔진 무관)가 돈다. 44h-e(offball 겹침)는 이 세션 뒤에 연다. 푸시 직전 main 최신 병합, ENGINE_VERSION은 그때 main +1(밸런스 값 바꾸면 BALANCE_VERSION도). PATCH_LABEL 'C.76u', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76u, engine-issues 9번 갱신.
완료·실패면 X에 보고(분해 결과·LM/RM 비중 전후·가드 표·지문·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
