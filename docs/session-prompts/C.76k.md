너는 엔진 코드 세션 "44h단계_약팀 내려앉기·버스 세우기·1대1 (C.76k)"이다(Fable). 마스터는 V(session_01Lzq7rz3Q4FvKuV1aT6Xkhk, 마스터 브랜치 claude/planning-v). 엔진관리자5는 이 지시서를 끝으로 멈췄다(깨우지 않음). 막히면 V에 보고 → V가 엔진관리자6을 연다. 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 5번, 7번: 마스터에는 완료·실패·질문만, CI 성공은 보내지 않음).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-5` 후 그 브랜치(fdd7b1c 이후)의 `docs/engine-diagnosis-e4.md` **§9.10·§9.10a(44h-b 최종 지시서)**와 §9.1, `docs/engine-issues.md` 미해결 3·11·12·13, `docs/engine-manager-handoff.md` 교훈(같은 시드 scoring 첫 관문, 병렬 worktree 워커 번들 캐시 공유 금지 §5 등). 지시서가 이 파일보다 우선.

사용자 확정(2026-10-20 20:40·20:46 KST, pending 138): ① 약팀은 최대한 내려앉는다(두 줄 버스 세우기 허용) ② 지고 있을 때 라인·압박 올리기는 강팀이 약팀에게 질 때·레이팅 비등할 때만 ③ 새 전술 성향 '버스 세우기'(라인 '매우 낮음' 새 단계, 포메이션 추가 없음, 사용자 전술 화면 선택지에도) ④ 1대1 보정 상수는 ①~③ 뒤 강팀 자유로운 슛이 비등 경기 수준으로 내려왔을 때만 켠다.
처방 요약(§9.10a): 단계 A — `LEVELS.lineHeight` 4단('매우 낮음' 0.2)·`lineRange` 0.2→0.3·성향 'bus'(busLineMax 14·busGap 8·최전방 1명 잔류)·underdogPlan 큰 차이면 버스/블록/역습 + 바닥 라인 / aiAdjust 뒤질 때 올리기에 `oppRating − rating ≥ underdogGap` 예외 / 압박 속 슛 구석 ×(1 − 0.35×압박). 단계 B — 비행 중 수신자 압박(offball.ts:352·:773). 단계 C — 관문 통과 뒤에만 1대1 상수(shotFree 0.30, closeW 0, saveBase 복원). 통과 기준·가드는 지시서 그대로.
예산: 3.5시간·측정 10회·Fable 25달러(자기 get_session 비용). 실패 판정·부분 해결 처리는 automation.md 3번. 측정은 worktree마다 캐시 따로.
'버스 세우기' 이름: 화면 한글 '버스 세우기', id 'bus'. 전술 설명 한 줄(예 "라인을 박스 앞까지 내리고 두 줄로 버틴다").
병렬: C.76h(45b(b) 다른 리그 풀 엔진·새 게임, session_014hnh7JesgAD6TuzpSroeqZ — 엔진을 워커로 부름, src/engine 안 건드림)·C.76i·C.76j(U8 디자인)가 돈다. 푸시 직전 main 최신 병합, ENGINE_VERSION·BALANCE_VERSION(바꾸면)은 그때 main +1. 세이브에 전술 성향이 저장되면 'bus' 추가로 SAVE 영향 확인. PATCH_LABEL 'C.76k', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76k(측정 표 전후). 엔진관리자5 브랜치 docs는 git merge로 병합(automation.md 7번).
새 화면은 없을 것(전술 선택지 하나 추가) — 있으면 부록 C에 적는다.
완료·실패면 V에 보고(단계별 측정 표 요약·지문·테스트 수·커밋, 1대1 상수를 켰는지).
