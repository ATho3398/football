너는 코드 세션 "47단계_리그·시즌 중 개인상 (C.76t)"이다(Opus). 마스터는 W(session_01UpWdqeSysTwMUcVKc5unpT, 마스터 브랜치 claude/planning-w). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(7번: 마스터에는 완료·실패·질문만, CI 성공은 보내지 않음).

먼저 읽기: CLAUDE.md → docs/automation.md → `docs/awards-design.md`(claude/planning-w 최신 — **3절 47b 표, 4a 레전더리 조건(리그 올해의 선수 카운터 채우기), 5절 보상**) → main 부록 C.76n(47a 구조: BALANCE.awards.defs 12개, 이력서 → 투표단 4종, 발표·보상·기사·파워 랭킹·역대 수상자). 47b는 defs에 줄 추가가 기본.

범위(47b): 리그별 올해의 선수(PL은 PFA·FWA 둘, 다른 리그 공식 1개) · 리그 영플레이어 · 올해의 팀(리그별 PFA 11 + FIFPRO 월드 11, 4-3-3 포지션 슬롯 투표) · 이달의 선수(리그별, 매달, XP만) · 대륙컵 골든볼·골든부트·골든글러브·챔스 시즌 최우수 선수 · 시상식 화면(후보 → 3인 → 발표)과 홈 발롱도르 레이스 칩이 47a에 없으면 추가. 레전더리 '최고 개인상 합'에 리그 올해의 선수 연결(시즌당 최대 2회). 보상은 5절(리그 상 희귀 선택권, 이달의 선수 XP, 올해의 팀 배지).
측정: 10시즌 × 여러 커리어로 리그 올해의 선수가 리그 상위 팀 주력·득점왕과 대체로 일치, 올해의 팀 포지션 분포 정상, 레전더리 비율 balance 가드 통과(넘으면 4a 횟수 조정, `growth.legendary`).
가드: typecheck·npm test·balance:check(밸런스 바꾸면 BALANCE_VERSION +1, 세이브 구조 바꾸면 SAVE_FORMAT_VERSION +1 — 둘 다 푸시 직전 main +1). 엔진 무수정.
병렬: C.76q(44h-d PK)·C.76s(44h-c2 게겐, Fable) 엔진 세션이 돈다. 푸시 직전 main 최신 병합. PATCH_LABEL 'C.76t', STAGE_LABEL '47단계'. 부록 C에 C.76t. 디자인 없는 새 화면은 부록 C에 적는다.
완료·실패면 W에 보고(상 목록·측정 요약·테스트 수·커밋·새 화면).
