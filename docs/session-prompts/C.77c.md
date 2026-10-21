너는 엔진 코드 세션 "44h단계_NPC 출전율·결장 (C.77c)"이다(Fable, 노력도 높음). 마스터는 Y(session_01PgUwPFtt8b6h4UmF4SbRvY, 마스터 브랜치 claude/planning-y). 지시 근거는 엔진관리자8(session_01DJK7MaPzJ2edGU3ywbiw3H, 브랜치 claude/engine-manager-8) `docs/engine-diagnosis-e4.md` §9.15.9 권장 A — "해결 어려움·진단 불일치"는 엔진관리자8에 send_message(마스터에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-8` 후 §9.15.9 → main 부록 C.76x → `scripts/engine/job.ts`(runLeagueMatchJob)·`scripts/engine/suite.ts`(league 세트)·`src/engine/npcMatch.ts`·`src/engine/setup.ts`(teamSetupFromRoster exclude)·`src/roster.ts` pickLineup·`src/engine/subs.ts`·`src/manager.ts:176`(NPC fatigue 0).

배경(사용자 2026-10-21 10:3x KST "피로 수치가 있는데 왜 ST가 리그 풀타임을 뛰나, 원인도 찾아와" + A 승인): Y 1차 확인 — 피로(balance.ts `fatigue`, 7.1)는 **내 선수에게만** 쌓이고 NPC에는 상태가 없다(manager.ts NPC fatigue 0 고정). npcMatch·runLeagueMatchJob 모두 `teamSetupFromRoster(..., exclude=undefined)` → pickLineup이 매 경기 같은 최강 11명. 부상·출장정지·로테이션도 NPC엔 없음. balance:scoring 리그 경기는 서로 독립 job(병렬)이라 경기 사이 상태가 원래 없다. 경기 중 교체(subs: 58~85분 스태미나 < 70, 75분 뒤 25%)만 있음.

할 일:
1. **진단 먼저(짧게)**: 위 원인을 코드로 확인하고, 기준선 10시즌에서 ST 상위 득점자 선발 수·평균 출전 분(교체 아웃 포함)을 기록. 본편 게임 AI 리그(npcMatch 경로·quick 엔진 경로 둘 다)도 같은 구조인지 확인.
2. **A 구현**: NPC 출전율 `absentP` 0.08(부상 0.04 + 로테이션 0.04, balance.ts에 두고 BALANCE_VERSION +1) — (worldSeed, 라운드/경기 시드, 선수 id)로 결정적 추첨, 결장 선수는 exclude로 빠지고 벤치(pickLineup)가 대신. **측정 경로(runLeagueMatchJob)와 본편 NPC 경로(npcMatch, quick 경로)에 같은 함수**를 쓴다(측정만 바꾸면 안 됨). 내 선수·내 팀 출전 규칙은 건드리지 않는다. 결과 할당 금지.
3. 관문: 같은 시드 balance:scoring 30골+ ≤ 2.0(기대 1.3~1.7), 득점왕 중앙값 25~35, 경기당 팀 득점 1.3~1.5 유지, engine:check·balance:check·quick 통과. 기록: ST 선발 수 전/후, MID 최다↔같은 팀 ST 짝.
4. NPC 누적 피로(경기 사이 피로 쌓임·회복·선발 페널티를 NPC에도)는 **이번 범위 아님** — pending 142(전술별 누적 부하 → 부상·노쇠, NPC 포함)에서 한다. 부록 C에 "NPC 피로 미구현 → absentP가 임시 대체, 142에서 교체"라고 적는다.

예산: 1.5시간·Fable 12달러. 병렬: C.77b(offball.ts 줄 대응)·C.76y(roles.ts)·C.76z(onball.ts) — 너는 job.ts·suite.ts·npcMatch.ts·setup.ts·balance.ts만. config.ts·balance.ts 충돌은 푸시 직전 main 병합으로, ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. 세이브 구조를 바꾸면 SAVE_FORMAT_VERSION +1(가능하면 바꾸지 않게 시드 결정적으로). PATCH_LABEL 'C.77c', STAGE_LABEL main 그대로. 부록 C에 C.77c.
C.77b가 같은 시드 scoring에 "출전율 켠 값"을 쓰므로 함수가 생기면 C.77b(session_01Ce8hyzqJcdLPbfs21s28cP)에 브랜치·커밋을 한 줄 알린다. 완료·실패면 마스터에 보고(원인 확인 결과·전후 표·테스트 수·커밋). CI 성공은 보내지 않는다(실패만).
