너는 엔진 코드 세션 "44h단계_엔진 1대1 결정력·위협 가중 수비 (C.76a)"이다(Fable). 마스터는 U(session_01DUqLtswE7hDV9NHhh6HfZq, 마스터 브랜치 claude/planning-u), 엔진관리자5(session_01Gg4RyE2G4dDfJ5gkNHsFr7, 브랜치 claude/engine-manager-5). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·3번 fix 규칙, 5번, 7번: 마스터에는 완료·실패·질문만).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-5` 후 그 브랜치의 `docs/engine-diagnosis-e4.md` **§9 전체(44h-a 지시서)**·§3.5, `docs/engine-issues.md` 미해결 8·11·12·13, `docs/engine-manager-handoff.md` 교훈(같은 시드 scoring 첫 관문, 측정 도구 덮어쓰기 안 먹음 등). 지시서가 이 파일보다 우선.

사용자 결정(2026-10-20): GK 1대1은 골·실축(빗나감)·선방 비율 모두 현실과 비슷하게(현실 1대1 골 35~45%) / 엘리트(강팀 ST 자리) 몰림 근본 처방 / 사용자 제안 위협 가중 수비(엘리트로 가는 길목 차단·밀착 견제). 승부차기 장면은 만들지 않는다.
처방 요약(엔진관리자5, §9): 단계 A 1대1 — `shotFree` pOn 보너스 0.30·(1−d/20)(무압박·슛 길 빔), `keeper.closeW` 0.45(12 m 안, 헤더 제외), `saveBase` 1.76 → 같은 시드 scoring → 단계 B 위협 가중 수비 — `focusThreat`·`boxDefense` 마크·`shadowTarget` 세 자리에 `finishSkill` 가중 → scoring. 통과: 12 m 안 1대1 골 30~45%·선방 25~35%·빗나감 ≤ 40%(`gap 120`), 득점 1.30~1.40, scoring 30골+ 0.5~2·상위 10 중 ST ≤ 6, 회귀 가드 전부. 보조 가설 3(`finishMax` 1.25→1.18)은 30골+ > 2일 때만.
예산: 3시간·측정 9회 내외. 막히면 automation.md 2·3번(해결 어려움 → 엔진관리자5에 재진단 요청, 마스터에 실패 보고).
병렬: C.75v(결정 순간 선택지, config.ts 다른 절)·C.75w·x·y(45b, 다른 경기 풀 엔진 워커)·z가 돈다. 푸시 직전 main 최신 병합, ENGINE_VERSION·BALANCE_VERSION은 그때 main +1. PATCH_LABEL 'C.76a', STAGE_LABEL '44단계'. 부록 C에 C.76a(측정 표 전후). 엔진관리자5 브랜치 docs는 git merge로 병합(automation.md 7번).
완료·실패면 U에 보고(측정 표 요약·지문·테스트 수·커밋), 엔진관리자5에도 한 줄.
