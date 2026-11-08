너는 엔진 코드 세션 "44h단계_펄스 나인 미끼·2선 인계 (C.77d)"이다(**Opus, 노력도 높음 — 엔진 Opus 1차**, 사용자 규칙 2026-10-21 13:53: 같은 문제로 Opus 2회 실패하면 Fable로 넘김). 마스터는 Y(session_01PgUwPFtt8b6h4UmF4SbRvY, 마스터 브랜치 claude/planning-y). 처방은 엔진관리자8(session_01DJK7MaPzJ2edGU3ywbiw3H, 브랜치 claude/engine-manager-8) — "해결 어려움·진단 불일치"는 엔진관리자8에 send_message(마스터에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-8` 후 `docs/engine-diagnosis-e4.md` **§9.13.5 전체**(44h-f2b, 사용자 의도 13:08·짝 조건 13:18·판단 반영 13:22 갱신 포함)와 §9.13.4 → main 부록 C.76y·C.77b → `docs/engine-issues.md` 4·8·11 → `scripts/diag/nine-vacate.ts`.

사용자 의도(그대로 지킬 것): 펄스 나인은 **최후방 수비를 속이는 역할** — ST 본인 골은 일반 ST보다 적은 게 정상, 대신 **그 팀 2선 득점이 올라가야** 한다. 짝(윙 둘 다 윙 포워드·인사이드 포워드 + 공격형 CM/CAM)이 없으면 약한 게 정상(실축과 같음). 상대 수비 판단은 "따라 나갈까" 결정에만 능력치로 반영(판단 스탯 전체 페널티 아님).

범위(§9.13.5 순서대로, 가설마다 커밋 1개): 가설 0 `tactics.ts recommendedRole` 짝 규칙(AI 팀에 falseNine이 있고 run ≥ 0.5 CM/CAM이 없으면 마지막 CM boxToBox, 내 팀 무수정) → 가설 1 2선 러너 nine 인계(`offball.ts finalThirdJob`·`attackTarget`) → 가설 2 CB 따라나옴 결정(`defendTarget` 줄 1 존 마크 블록, p = clamp(stepOutBase + stepOutDecoy×미끼 − stepOutJudge×판단), 상수는 §9.13.5대로) → 가설 3 전환 출구(보조). 관문(짝 조건 role-pair 행): 2선 골 ≥ 1.08 · ST 개인 골 ≥ 0.25 허용 · CB 줄 앞 2 m+ ≥ 25% · 판단 상·하위 1/3 CB 차 ≥ 15 pp · 포처 팀 CB 따라나옴 ≤ 12% · 팀 득실 ≥ −0.10 · 짝 없는 펄스 나인은 기록만. 가드: §9.13.5대로(quick 600 득점 1.30~1.45 — 지금 1.28이라 saveBase 0.01 보정 1회 허용, 같은 시드 scoring 30골+ 0.5~2.0(지금 0.90)·득점왕 중앙값 25~35, sweep 7×7 ≤ 1.0 + 티키타카 행·게겐 대 티키타카, defense-shape 교체 ≤ 22, engine:check 경량 가드, 지문 변경 기록). 결과 할당·고무줄 금지.

**측정 운영(C.77b 6시간·46달러 교훈, 꼭 지킬 것)**: ① main 병합은 시작할 때 1번 + 마지막 검증 직전 1번만(중간 병합 금지). ② 무거운 측정(scoring·sweep·quick 600·role-pair 800·balance:check)은 **동시에 2개까지**(4코어). ③ balance:check는 마지막에 1번만, `nohup … > log 2>&1 &`로 세션 시간 제한과 분리. 60분 안에 판정이 안 나오면 다른 관문이 모두 통과한 경우에 한해 main 푸시하고 CI에 맡긴다(실패하면 네가 처리). ④ 대기는 send_later 한 번으로(짧은 sleep 루프 반복 금지).

예산: 3시간·약 15달러(Opus). PATCH_LABEL 'C.77d', STAGE_LABEL main 그대로, ENGINE_VERSION·BALANCE_VERSION은 푸시 직전 main +1. 부록 C에 C.77d, engine-issues 4 갱신, 역할 설명문에 펄스 나인 "윙 포워드·공격형 미드와 함께 쓰는 역할" 한 줄. 엔진관리자8 docs는 git merge로.
완료·실패면 마스터에 보고(가설별 전후 표·관문·지문·테스트 수·커밋·걸린 시간·비용). CI 성공은 보내지 않는다(실패만).
