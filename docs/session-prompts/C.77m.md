너는 코드 세션 "142단계_NPC 피로·피로 수치 상향 (C.77m)"이다(Opus, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 엔진 경로(측정·경기 시뮬)에 닿으면 엔진관리자9(session_01Br1jtc3FrJL9Xt3WmYFQwB)에 물을 수 있다. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77m-npc-fatigue`(main 최신에서).

근거: `docs/planning-pending.md` **142**(사용자 요청 — 게겐 대가·피로 수치 상향, 10/21 10:50 "훈련 피로 늘리고 경기당 피로도 늘리고"), 부록 C.77c(NPC absentP 0.08 임시·진단: perMatch90 22 < weeklyRecovery 25라 주 1경기 리그에선 피로가 0으로 돌아와 penaltyFrom 50에 못 닿음), 기획서 7.1 피로. 먼저 이것들과 `src/config/balance.ts` fatigue·injury, `adapter.ts` 경기 뒤 피로, `setup.ts npcTeamSetup`, `manager.ts` NPC 상태를 읽는다.

**이번 패치 = 142a(1차)**: ① 피로 수치 상향 — 경기당 피로↑·훈련날 회복↓. 목표: 리그만 뛰어도 주전이 몇 주 연속이면 penaltyFrom 50을 넘어 쉬어야 하고, 주 2경기면 빨리 쌓인다(수치는 balance.ts, BALANCE_VERSION +1). ② NPC 피로 상태 — 내 선수와 같은 규칙(경기 뒤 이동 거리 비례 피로·주간 회복)을 NPC 선수에도, 선발은 피로 페널티로 로테이션(`pickLineup`), 측정·본편 NPC 경로 같은 함수. ③ 피로 부상 — 기존 `injury.fatigue*`를 NPC에도. ④ C.77c absentP는 ②③이 출전율을 대신하면 끈다(측정으로 판단: 상위 10 ST 선발 33~36경기·30골+ 0.5~2.0 유지). 세이브 구조가 바뀌면 SAVE_FORMAT_VERSION +1과 이전 세이브 이전(migration), 미리 계산 캐시 무효화 확인(C.77c ④).
**뒤로 미룸(142b, 다음 패치)**: 컵·유럽 일정(주 2경기), 전술별 시즌 누적 부하 → 부상 확률·노쇠 시작 나이. 단 ①의 수치는 주 2경기 일정이 들어올 것을 전제로 정하고, 지금 일정 구조(컵·유럽이 있는지)를 조사해 부록에 적는다.
관문: `npm run balance:training` 결과 보고 · 같은 시드 scoring(켬) 30골+ 0.5~2.0·득점왕 중앙값 25~35·상위 10 ST 선발 수 · 내 선수 시즌 결장 주 수(기준선 대비) · quick 600 득점 1.30~1.45(엔진 무변경이면 불변이어야) · 테스트 추가(NPC 피로 누적·로테이션·세이브 이전) · typecheck·test·build.

**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개까지 · balance:check는 마지막 1번 nohup, 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 · 대기는 send_later 한 번(sleep·pgrep 루프 금지) · 측정 결과는 scratchpad 파일로 남겨 컨테이너 재시작 때 이어 간다.
예산: 3시간·약 15달러. PATCH_LABEL 'C.77m', STAGE_LABEL은 기획서 17.2 표에서 142가 속한 단계 번호(없으면 main 그대로, 부록에 적음). 부록 C에 C.77m, planning-pending 142에 진행 표시. 완료·부분·실패면 마스터 Z에 보고(수치 전후 표·관문·테스트 수·커밋·시간·비용). CI 성공은 보내지 않는다.
