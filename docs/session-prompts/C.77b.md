너는 엔진 코드 세션 "44h단계_줄 대응·2선 침투 추적 (C.77b)"이다(Fable, 노력도 높음). 마스터는 Y(곧 열림 — 그 전엔 X session_012GNg6RDeZPkuVx81rChZ91, 마스터 브랜치 claude/planning-x → Y가 열리면 claude/planning-y; Y가 ID를 알린다). 지시서는 엔진관리자8(session_01DJK7MaPzJ2edGU3ywbiw3H, 브랜치 claude/engine-manager-8) — "해결 어려움·진단 불일치"는 엔진관리자8에 send_message(마스터에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-8` 후 `docs/engine-diagnosis-e4.md` **§9.15 전체**(44h-i 처방, 관문, §9.15.6 C.76x 결과별 조정 — C.76x는 침투 깊이 상수를 **껐다**: 11/13 그대로) → main 부록 C.76x·C.76w → `docs/engine-issues.md` 8·11 → `scripts/diag/runner-track.ts`.

범위(44h-i = §9.15, 사용자 결정 "전면 마크 아님 — 2선 침투 시 CDM/가까운 CM이 따라붙음, 줄 대응 구조"): 가설 1 `defendTarget` 줄 2 추적 배정(대상 존 22 m 안 줄 2, trackMax 2, 추적자 CDM 9 m → CM 12 m, 줄 1 제외, 기억 0.7초, 해제 조건, midGap·스크린 미적용) → **첫 20분 runner-track 배정률 ≥ 30%가 진단 일치 기준** → 가설 2·3은 조건부. 관문: 같은 시드 scoring 30골+ ≤ 2.0 · gap 120 CAM 골 < ST 골(두 팀) · runner-track 받는 순간 ≤ 1.5 m 20 → ≥ 40% · quick 미드 ≤ 31·ST 유지. MID 최다 ≤ 22·상위 10 CAM ≤ 1은 사용자 결정으로 **기록만**(관문 아님). 총량은 saveBase 0.01 1회만, 30골+ > 2.0이 남으면 중단·보고. 결과 할당·고무줄 금지.
가드: engine:check(XP ≤ 1.15)·balance:check·quick 600·sweep 7×7 ≤ 1.0. 결과가 기준선과 완전히 같으면 상수 경로 오류.
예산: 2.5시간·Fable 20달러. 
병렬: C.76y(roles.ts 역할 득실)·C.76z(onball.ts 롱패스)가 돈다 — offball.ts는 너만. config.ts 충돌은 푸시 직전 main 병합으로. ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. PATCH_LABEL 'C.77b', STAGE_LABEL main 그대로. 부록 C에 C.77b, engine-issues 8·11. 엔진관리자8 docs는 git merge로.
완료·실패면 마스터에 보고(가설별 측정 요약·전후 표·지문·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
