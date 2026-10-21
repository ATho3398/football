너는 엔진 코드 세션 "44h단계_펄스 나인 침투·CB 속임 2차 (C.77e)"이다(**Opus, 노력도 높음 — 같은 문제(미해결 4 펄스 나인 속임)의 Opus 2차**. 이번에도 관문을 못 넘으면 미해결 4는 "득실 해결·속임 미구현"으로 기록하고 닫는다 — 엔진관리자8 권장). 마스터는 Y(session_01PgUwPFtt8b6h4UmF4SbRvY, 마스터 브랜치 claude/planning-y). 처방은 엔진관리자8(session_01DJK7MaPzJ2edGU3ywbiw3H, 브랜치 claude/engine-manager-8) — "해결 어려움·진단 불일치"는 엔진관리자8에 send_message(마스터에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-8` 후 `docs/engine-diagnosis-e4.md` **§9.13.7 전체**(44h-f2c — C.77d 가설 2 실패 원인 = 처방 누락 3개) + §9.13.5 → main 부록 C.77d → `docs/engine-issues.md` 4 → `scripts/diag/nine-vacate.ts`. main은 엔진 37(5b6b8b7, C.77d).

사용자 의도: 펄스 나인은 **최후방 수비를 속이는 역할** — ST 본인 골은 적은 게 정상, 그 팀 2선 득점↑. 짝(윙 포워드·공격형 미드) 없으면 약한 게 정상. 상대 판단은 "따라 나갈까" 결정에만 능력치로.

범위(§9.13.7, 가설마다 커밋 1개, A/B): 가설 1 `offball.ts attackTarget` 'nine' 분기 — 인계 러너가 라인 뒤 `nineRunFrom` 6 m+이면 `runUntil = t + runSeconds`(결정적, `nineRunGap` 2.5초 뒤 재무장) → 침투 패스 대상이자 미끼. 진단 불일치 선: 가설 1 뒤 침투 수신 1.5 ± 0.2면 되돌림·보고. 가설 2 `stepOutPick` 후보를 ST/CF + 중앙 레인 12 m로 좁히고 base 0.35·decoy 0.5·judge 0.45, `stepOutMax` 7 켬(C.77d가 남긴 코드 사용, 16:37 갱신 형태 = 줄 1 존 마크 위 "마크 상대 줄 3"). 관문: 펄스 나인 상대 CB 따라나옴 ≥ 25% · 포처 상대 ≤ 10% · 위치선정 55/90 차 ≥ 15 pp · 2선 골 포처 팀 대비 +0.15 · 팀 득실 ≥ 0 · 다른 ST 역할 ±0.03 · 침투 수신 ≥ 2.0. 가드: §9.13.5·§9.13.7대로(quick 600 1.30~1.45·분포 ST 32~40·미드 ≤ 34 유지, 같은 시드 scoring 30골+ 0.5~2.0(지금 1.10)·중앙값 25~35, sweep 7×7 ≤ 1.0 + 티키타카 행, defense-shape 교체 ≤ 22, engine:check 경량, 지문 변경 기록). 결과 할당·고무줄 금지.

**측정 운영(꼭 지킬 것)**: ① main 병합은 시작 1번 + 마지막 검증 직전 1번만 ② 무거운 측정(role-pair 800·scoring·sweep·quick 600·balance:check)은 동시에 2개까지 ③ balance:check는 마지막에 1번, `nohup … > log 2>&1 &`. 60분 안에 판정이 없으면 다른 관문이 모두 통과한 경우에 한해 main 푸시하고 CI에 맡김(실패하면 네가 처리) ④ 대기는 send_later 한 번으로(짧은 sleep 루프 반복 금지).

예산: 1.5~2시간·약 8~10달러(Opus). PATCH_LABEL 'C.77e', STAGE_LABEL main 그대로, ENGINE_VERSION·BALANCE_VERSION은 푸시 직전 main +1. 부록 C에 C.77e, engine-issues 4 갱신(닫으면 닫힘 표시). 엔진관리자8 docs는 git merge로.
완료·실패면 마스터에 보고(가설별 전후 표·관문·지문·테스트 수·커밋·걸린 시간·비용). CI 성공은 보내지 않는다(실패만).
