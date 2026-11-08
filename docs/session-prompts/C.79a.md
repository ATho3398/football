너는 엔진 코드 세션 "44h단계_GK 시야 가림 (C.79a)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, 마스터 브랜치 claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄 필독). 작업 브랜치 `claude/c79a-screen` — origin/main 최신(54c4be8, ENGINE 56)에서 시작, 시작 때 origin/claude/engine-manager-14 merge(진단 도구·`scripts/diag/c78z-switches.patch`). main 푸시 전 origin/main merge.

근거: 엔진관리자14 중간 보고(미해결 6) — 다이빙·구석 상수는 1대1·25 m를 먼저 깨는 행 레버라 안 됨. **새 축 "GK 시야 가림(screen)"**: 슛 길 콘 안에 슈터보다 골 쪽(선 위치 ≥ screenFrom) 수비가 1명 이상이면 GK 반응 시간 + screenReact 초. **판단(shotModel)과 실행(saveChance) 같은 식.** 실험 패치 c78z-switches.patch의 screen 부분 그대로, `keeper.screenReact = 0.2`, `keeper.screenFrom = 0.4`(새 상수 2개, config.ts). 탐침(N=300): 12~16.5 세트 93.0→88.1% · 고정가중 12 m 밖 선방 ≈ 86.4%(목표 79~87 ✓) · 득점 1.53→1.56(+0.03).
같이 할 것(문서·가드만): **미해결 2 짧은 패스 기준 20% → 16%로 변경**(엔진관리자14: 레버 6개 다 켜도 16.5% 천장, 실축 정의 차) — engine-issues·가드 표기만, 엔진 불변. **pending 145 잔여 닫기**(게겐 압박 없는 백패스 20/경기·2:1 리턴 12% — 문제 아님) — engine-issues에 기록.
관문: engine:check 12 m 밖 선방(고정가중) 79~87 · quick 600 득점 1.48 ± 0.05 · 장면 전부(1대1·25 m 장면 포함) · 결정성 · 2초. 몰빵(미해결 5)·상성은 이 패치 효과를 **측정만 해서 보고**(몰빵 cust:35 200경기 상대 골, 상성 480 측정기 21쌍 중 블록·게겐 칸) — 관문 아님.
가드: Δ±8 · 득점 분포 · 평점 가드 · engine:check · balance:check(배포 차단) · 순간이동 0 · 이동 거리(C.78w 기준).
**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개 · 긴 측정 턴 안 10분 덩어리 · balance:check 마지막 1번(60분 넘으면 다른 관문 통과 시 main 푸시하고 CI에) · 대기 send_later 한 번 · scratchpad · 푸시 전 충돌 표시 검사.
**main 푸시**: 관문 통과하면 AC 승인 없이 바로(planning-ac docs 병합, 푸시 직전 main CI 확인 — 빨간불이면 올리지 말고 알림). 미달이면 되돌리고 보고.
예산 **2시간·10달러**. PATCH_LABEL 'C.79a', STAGE_LABEL 그대로, ENGINE_VERSION +1. 부록 C.79a, engine-issues 미해결 2·6·pending 145 갱신. 끝나면 AC에 send_message로 보고(안 된 것 먼저). CI 성공은 보내지 않는다.
