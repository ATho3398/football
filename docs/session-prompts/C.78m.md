너는 엔진 코드 세션 "44h단계_총량 2차: GK 자리 공–골 선 위로 (C.78m)"이다(Opus 5.5, 노력도 높음). 마스터는 AB(session_01YaqwVcjYk7ae1MBc1CLprB, 마스터 브랜치 claude/planning-ab). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c78m-keeper` — **origin/main 8f81ffb(C.78j, ENGINE 50)에서 시작하고 `origin/claude/engine-manager-10` 5639219를 merge**(진단 보고서 docs/engine-diagnosis-c78m.md·진단 스크립트 scripts/diag/c78m-chance.ts, 엔진 코드 무수정). main 푸시 전 origin/main merge.

근거: 엔진관리자10 재진단(docs/engine-diagnosis-c78m.md — **§3·§4·§5 가설 1·§9 먼저 읽기**). 득점 과다(quick 600 팀당 2.34, 목표 1.25~1.45)의 출처는 **수비 쪽 GK 자리 기하**: `offball.keeperTarget()`이 GK 옆 자리를 (공 y − 골 y)×lateral 사각 격자로 잡아 측면 각에서 공–골 선을 평균 3.2 m 벗어나고, 17 m 측면 보통 슛이 빈 골 보정(openOn)으로 슛당 20~27%(실축 3~5%). 공격 움직임은 원인이 아니므로 **움직임은 그대로 둔다.**

할 일 (가설 1 단독 — 가설 2·3은 이 패치에 넣지 않는다, C.78n 몫):
- `src/engine/offball.ts keeperTarget()` 기본 자리 두 줄을 "기준점 ref(상대 소유자 있으면 그 자리, 없으면 공) 방향으로 깊이 depth 만큼 나간 점"으로: `rd = dist(ref, 골)` · `tx = gx + (ref.x − gx)/rd × depth` · `ty = clamp(gy + (ref.y − gy)/rd × depth, 골대 ±1 m)`. flightSet·C.78j setDepth와 기하 통일. **깊이 규칙(sweeperMin/Max·classicMin/Max·setDepth 세 조건)·setCentral·urgent 규칙은 그대로.**
- 새 상수 `ENGINE.keeper.arcSet`(1 켬 / 0 옛 격자, A/B용), `lateral`은 0 경로에 남김.
- 먼저 **진단 재현**: 기준 코드에서 `npx vite-node scripts/diag/c78m-chance.ts -- 120`이 §3.1 "자세잡기 깊이 미적용" 슛 2.7 ± 0.3 · 슛당 골 20 ± 3%로 나오지 않으면 구현 전에 마스터에 보고(진단 불일치).
- 측정: c78m-chance 120(기대 발 슛 득점 1.85→약 1.54, 12 m 밖 선방 64.4→약 75%, 슛 수 불변) → `SWEEP_N=600 npm run balance:quick`(기대 득점 2.34→약 2.0).

**마스터 AB 승인(사전)**:
- **장면 ④ 기준값 갱신 승인** — ④는 keeperTarget()을 직접 써서 반드시 움직인다. 관문을 실축 순서·범위로 바꾼다: 느린 횡패스 선방 > 빠른 컷백 선방 · 빠른 컷백 ≤ 0.2 · 1대1 골 0.3~0.5 · 빈 골 ≥ 0.9 · 밀집 ≤ 0.1. 이 밖의 장면(①~㉙ 나머지)은 그대로 통과해야 한다 — 깨지면 원인 보고.
- **되돌릴 테스트 기준(통과하는 것만)**: engine.test 득점 상한 3.1 → 2.5, 선방률 하한 0.45 → 0.55(표본 144경기 유지 가능). 실측이 못 넘으면 되돌리지 말고 수치 보고(C.78n에서). 이동 거리 14.5 km는 그대로. **CI continue-on-error 복구는 이번에 하지 않는다**(총량이 아직 목표 밖 → C.78n 끝에).
- 금지: saveBase·shotBase·timeReach·diveSpeed로 총량 맞추기, 결과 할당·고무줄, 공격 움직임 약화.

가드: 장면 39개 · Δ±8 · 경기 계산 2초 · 결정성 · 이동 거리 14.5 km · 득점 분포(scoring 30골+ ≤ 2 · 득점왕 중앙값 25~35) · engine:check(보고만, 평점은 총량 따라감 — 계수 무변경).
**측정 운영**: ① main 병합은 시작 1번 + 마지막 검증 직전 1번만 ② 무거운 측정 동시 2개까지 ③ balance:check는 마지막 1번 `nohup … > log 2>&1 &`, 60분 안에 판정 없으면 다른 관문이 모두 통과한 경우 main 푸시하고 CI에 맡김(실패면 이 세션이 처리) ④ 대기는 send_later 한 번(sleep·pgrep 루프 금지). scratchpad 사용. 푸시 전 충돌 표시 검사.
**main 푸시**: 마스터 AB "푸시 ㄱ" 뒤(main 푸시 때 origin/claude/planning-ab의 docs/ 병합).
실패 처리: Opus 2회 관문 실패 → 엔진관리자(Opus) 재진단 → 사용자.
예산: **1.5시간·10달러 넘기지 말 것**. PATCH_LABEL 'C.78m', STAGE_LABEL 그대로, ENGINE_VERSION +1, BALANCE_VERSION 필요 시 +1. 세이브 이전 코드 금지. 부록 C.78m, engine-issues 로드맵·"C.78j 결과 · 재진단 의뢰" 아래 C.78m 결과 추가. 준비 완료·부분·실패면 마스터 AB에 보고(재현 확인·c78m-chance 전후표·quick 600·장면 ④ 전후값과 새 관문·가드 표·되돌린 기준·테스트·커밋·시간·비용). CI 성공은 보내지 않는다.
