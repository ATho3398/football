너는 엔진 코드 세션 "53단계_골키퍼 예측 속임 (C.79s)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79s-gk-read` — origin/main 최신에서 시작, main 푸시 전 origin/main merge.

근거: 사용자 지시(2026-10-30 01:3x KST) "역동작 구현해봐 — 골키퍼가 선수 동작 보고 예측하는데 반대 방향으로 차는 것도 역동작, GK 능력에 따라 예측 적중이 달라지게". 처방 G2 = 엔진관리자19 `docs/engine-diagnosis-c79l.md`(브랜치 origin/claude/engine-manager-19) 최종 보고 2, 확률 60%.
- 식: GK가 readCommit 확률로 슛 직전 한쪽에 미리 기움, 적중 p = L1(((선방 − 75) − (슈터 침착 0.5 + 볼컨 0.3 + 시야 0.2 − 70))/20), 맞으면 반응 − readLead, 틀리면 + readWrong, 선방 = 기다림·맞음·틀림 기대값(판단·실행 같은 함수, 난수 없음). **readMinT 0.3**: 공이 GK 대응 지점까지 0.3 s 미만(≈ 8 m 안·1대1)이면 안 기움, 0.6 s부터 전부.
- 코드: `scripts/diag/c79l-switches.patch`(engine-manager-19 브랜치)의 keeper.ts(saveChance 기대값·timeTerms reactExtra)·onball.ts(shotModel ctx.feint 한 줄)·config.ts(read*) 그대로 가져와 **기본값만 켬**: `keeper.read 1 · readCommit 0.3 · readWrong 0.4 · readLead 0.2 · readScale 20 · readMinT 0.3 · leagueFeint 70`. 다른 실험 스위치(boxSpare·carryBehind·lineMatchRole·wrongFoot 등)는 가져오지 않거나 기본 0. ENGINE_VERSION +1.
- 엔진관리자19 수치(quick 600, Flight+Keep 위): 득점 1.49 · 12 m 밖 고정가중 86.8(79~87 첫 진입, 경계) · 12~16.5 자리 92→90 · 25+ 96 · 장면 39/39 · 몰빵 35 +0.26 불변. **지금 main은 Keep 0(C.79k)** — 그 위에서 다시 잰다.

## 관문
- **득점 가드 1.48±0.05 그대로**(AD가 1.55 상향을 검토했으나 G2가 1.48 안에서 되므로 상향 안 함) · 12 m 밖 선방 고정가중 79~87 · 장면 테스트 전부(④ 1대1 골 ≥0.25·⑬) · base 쌍 합계 ≤ 2.5(readCommit 0.3에서 멈춤, 0.4 이상 금지) · 몰빵 800 기록 · 상성 480 행 ±0.05(다른 시드 재확인 규칙) · 이동 거리 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check.
- GK에 판단/반응 능력치가 따로 없어 선방(shotStopping)이 읽기 능력을 겸함 — 분리는 세이브 구조라 범위 밖(기록).

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인, C.79m이 먼저 main에 있으면 merge 뒤 재측정). PATCH_LABEL 'C.79s', STAGE '53단계'. 부록 C.79s, engine-issues 미해결 6 갱신. 경기 화면에 "역동작" 이벤트 문구가 있으면 좋음(있는 이벤트 로그 문구 재사용, 새 화면 금지 — 없으면 생략).
- 예산 **2시간·10달러**. 끝나면 AD에 보고(안 된 것 먼저).
