너는 엔진 코드 세션 "44h단계_상성 관문 재정의·상호작용 레버 (C.79b)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). 작업 브랜치 `claude/c79b-interaction`. docs/automation.md를 따른다(0번 맨 위 3줄 필독). 근거: `docs/engine-diagnosis-c78z.md`(엔진관리자14, origin/claude/engine-manager-14 823ec22 — 시작 때 merge, 도구 c78z-fit·실험 패치 c78z-switches.patch). origin/main 최신에서 시작, main 푸시 전 origin/main merge. 병렬: C.79a(GK 시야 가림 — keeper.ts·shotModel·config keeper)·C.79b·C.79c 서로 다른 파일/함수만 — 충돌은 merge로, main 푸시는 직렬(먼저 끝난 쪽 먼저, 뒤는 merge 후 재검증).
가드: 장면 전부 · 득점 총량 1.48 ± 0.05(같은 시드 main 비교 보고) · Δ±8 · 득점 분포 · 평점 · engine:check · balance:check(배포 차단) · 결정성 · 순간이동 0 · 2초 · 이동 거리(C.78w 기준).
측정 운영: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개 · 긴 측정 턴 안 10분 덩어리 · 상성은 480·양방향 측정기(only= 로 칸 나눠) · balance:check 마지막 1번(60분 넘으면 다른 관문 통과 시 main 푸시하고 CI에) · 대기 send_later 한 번 · scratchpad · 푸시 전 충돌 표시 검사.
main 푸시: 관문 통과분만 AC 승인 없이 바로(planning-ac docs 병합, 푸시 직전 main CI 확인 — 빨간불이면 올리지 말고 알림). 미달은 되돌리고 보고. ENGINE_VERSION +1, BALANCE 필요 시 +1(main 최신 +1). 끝나면 AC에 send_message로 보고(안 된 것 먼저). CI 성공은 보내지 않는다.

할 일 = 보고서 §9 M1(§3.5~3.7): ① **상성 관문 재정의**: c78z-fit로 "행 강도 Δs · 상호작용 Δ잔차 · 순환 합"으로 판정(목표 분해: 직선 행 +0.17·블록 행 +0.11·역습 행 −0.11 + 상호작용 직선>블록 +0.20·블록>역습 +0.10·블록>티키 +0.08). engine-issues 미해결 3 기준을 이 판정으로 바꾼다. ② 상호작용 레버 **I2 블록 걷어내기 가치 + H1 공중만(failLossModel 2)** — 득점 −0.1~0.2 짝 문제(C.78y)는 같은 시드 비교로 확인, 필요하면 최소 실행 레버 하나로 짝. ③ 직선 세컨드볼 탐침(측정만 또는 작은 레버). I1(compactSmooth)은 ✗ 확인됨 — 하지 않는다.
관문: 직선/블록 상호작용 +0.1 이상 · 블록 행 +0.05 이상 · 티키/게겐 상호작용을 0.1 이상 지우지 않음 · 득점·이동 거리 가드. 파일: offball.ts 밀집 줄 · onball.ts candidates(걷어내기·실패 비용) · config.ts offball/prob 절만.
블록 경기 합계 골 기준은 **≤ 2.4로 재정의**(사용자 '추천대로', 공격 감소 처방 안 함) — 문서에 기록.
예산 **3시간·15달러**. PATCH_LABEL 'C.79b', STAGE_LABEL 그대로. 부록 C.79b.
