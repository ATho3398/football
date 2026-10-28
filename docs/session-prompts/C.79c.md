너는 엔진 코드 세션 "44h단계_직선 수신 능력치 (C.79c)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). 작업 브랜치 `claude/c79c-aerial`. docs/automation.md를 따른다(0번 맨 위 3줄 필독). 근거: `docs/engine-diagnosis-c78z.md`(엔진관리자14, origin/claude/engine-manager-14 823ec22 — 시작 때 merge, 도구 c78z-fit·실험 패치 c78z-switches.patch). origin/main 최신에서 시작, main 푸시 전 origin/main merge. 병렬: C.79a(GK 시야 가림 — keeper.ts·shotModel·config keeper)·C.79b·C.79c 서로 다른 파일/함수만 — 충돌은 merge로, main 푸시는 직렬(먼저 끝난 쪽 먼저, 뒤는 merge 후 재검증).
가드: 장면 전부 · 득점 총량 1.48 ± 0.05(같은 시드 main 비교 보고) · Δ±8 · 득점 분포 · 평점 · engine:check · balance:check(배포 차단) · 결정성 · 순간이동 0 · 2초 · 이동 거리(C.78w 기준).
측정 운영: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개 · 긴 측정 턴 안 10분 덩어리 · 상성은 480·양방향 측정기(only= 로 칸 나눠) · balance:check 마지막 1번(60분 넘으면 다른 관문 통과 시 main 푸시하고 CI에) · 대기 send_later 한 번 · scratchpad · 푸시 전 충돌 표시 검사.
main 푸시: 관문 통과분만 AC 승인 없이 바로(planning-ac docs 병합, 푸시 직전 main CI 확인 — 빨간불이면 올리지 말고 알림). 미달은 되돌리고 보고. ENGINE_VERSION +1, BALANCE 필요 시 +1(main 최신 +1). 끝나면 AC에 send_message로 보고(안 된 것 먼저). CI 성공은 보내지 않는다.

할 일 = 보고서 §9 R1(§3.5): 롱볼 착지 경합(actions.ts resolveAerial · onball.ts landingShare)에 **받는 선수의 퍼스트 터치·근력·점프**를 넣는다(판단의 landingShare와 실행 resolveAerial 같은 식, 결과 할당 금지). 사용자 정의(pending 146): 직선은 받는 쪽 퍼스트 터치·피지컬·공중 경합이 좋아야 하는 선수빨 전술.
관문: `c78s-fit 200 direct` 선수빨(맞음−안맞음) ≥ +0.2 · 상성 480 측정기에서 직선 행 Δs ≥ +0.05 · 티키>직선 방향 유지 · 득점 가드. 파일: actions.ts resolveAerial · onball.ts landingShare · config.ts 해당 절만.
예산 **2시간·10달러**. PATCH_LABEL 'C.79c', STAGE_LABEL 그대로. 부록 C.79c.
