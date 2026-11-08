너는 fix 세션 "fix_카드 2초 테스트·엔진 속도 (C.76r)"이다(Opus). 마스터는 W(session_01UpWdqeSysTwMUcVKc5unpT, 마스터 브랜치 claude/planning-w). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다.

문제: main CI가 `tests/cards.test.ts` "경기 계산 2초 이하 (카드 자동·봇, 경기 한 번 단위)"에서 연속 실패 — run 254(52c5adb, C.76k 엔진 29 병합) 2,123ms, run 258(cf34536) 2,409ms(직접 `d` 쪽). 로컬 단독은 통과. 그 전(run 251, 엔진 28)은 통과. 배포가 막혀 C.76m·o가 안 올라감 → **급함**.
할 일: ① 엔진 28(b2133a1 근처) 대 엔진 29(52c5adb) 경기 1회 시간을 같은 기계에서 비교해 C.76k(비행 중 수신자 압박·버스 등)가 느려지게 했는지 확인 ② 느려졌으면 결과 불변(지문 same-seed 동일)으로 속도 복구가 우선(핫 루프 계산 캐시 등, ENGINE_VERSION 안 올림) ③ 엔진 자체가 그대로인데 CI 러너가 느린 것(테스트 119파일 병렬로 CPU 경쟁)이면, 2초 기준(부록 F 요구)은 유지하고 측정 방식을 고친다 — 예: 워밍업 뒤 3회 중 최솟값/중앙값, 또는 그 테스트만 단독 실행 순서. 기준을 느슨하게 올리지는 않는다(필요하면 W에 질문).
가드: typecheck·npm test 전부·지문 동일(엔진 결과를 바꿨으면 balance:check). PATCH_LABEL 'C.76r', STAGE_LABEL은 main 값 그대로. 부록 C에 C.76r 한 줄. 푸시 직전 main 최신 병합, main 푸시 뒤 CI 성공까지 확인하고 W에 보고(원인·조치·전후 시간).
병렬: C.76n(47 시상), C.76p(44h-c 엔진, offball.ts), C.76q(44h-d 엔진, referee.ts)가 돈다 — src/engine 결과 바꾸는 수정은 피한다.
