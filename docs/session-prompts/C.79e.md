너는 엔진 코드 세션 "44h단계_상대 공격 줄 인원 맞춤 내려앉기 (C.79e)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY) — 곧 AD로 바뀌면 AD가 알린다. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79e-linematch` — origin/main 최신(6fa03da, ENGINE 58)에서 시작, origin/claude/engine-manager-16(230d6cb) merge. main 푸시 전 origin/main merge.

근거: `docs/engine-diagnosis-c79e.md` §1(엔진관리자16) + pending 147(사용자: 몰빵 상대면 전술 무관 내려앉기). 처방 **A2**: `offball.lineMatch` = 1, `lineMatchMin` = 2 — 상대 공격 줄(우리 수비 줄 평균 x + 8 m 안쪽·골 쪽 상대, 소유자 제외) 인원이 압박 아닌 줄 1보다 2명 이상 많으면 그 차만큼 바쁘지 않은 줄 2(가장 깊은 순)가 수비 줄로 내려와 줄 1처럼 행동(boxDefense 마크·덮기·라인 동기화·존 마크). 코드 = 그 브랜치 offball.ts lineMatchPlan + defendTarget asDef(스위치 그대로, 기본값만 1·2). 문턱 1·boxMatch는 ✗ 확인됨 — 쓰지 않는다. carryShot·carryGk(뒷공간 처벌 후속)는 **이번 범위 밖**.
관문: custom-sweep DETAIL=35,base **400경기 득실 ≤ +0.3**(탐침 +0.47 → +0.08) · quick 600 득점 1.46 ± 0.05 · 이동 거리(시드 11~30 평균 ≤ 14.1 km, 한 선수 < 15) · 장면 전부 · 결정성·2초 · 상성 유지 칸(480 측정기 블록·게겐 몇 칸 확인).
테스트 시드 의존 실패 5개(c75v sureBack 시드·c76w 비교 비율·c78o CB 1대1 횟수·highlights 장면 시각 2개)는 **단언은 그대로 두고 시드만 재선정**, 근거 부록에.
가드: Δ±8 · 득점 분포 · 평점 · engine:check · balance:check(배포 차단, 60분 넘으면 다른 관문 통과 시 CI에) · 순간이동 0.
측정 운영: main 병합 시작 1번 + 마지막 1번 · 워커 풀 동시 2개 · 긴 측정 턴 안 10분 덩어리 · 대기 send_later 한 번 · scratchpad · 푸시 전 충돌 표시 검사.
main 푸시: 관문 통과하면 마스터 승인 없이 바로(origin/claude/planning-ac(또는 planning-ad) docs 병합, 푸시 직전 main CI 확인). 미달이면 되돌리고 보고.
예산 **2.5시간·12달러**. PATCH_LABEL 'C.79e', STAGE_LABEL 그대로, ENGINE_VERSION +1. 부록 C.79e, engine-issues 미해결 5 갱신. 끝나면 마스터에 send_message로 보고(안 된 것 먼저). CI 성공은 보내지 않는다.
