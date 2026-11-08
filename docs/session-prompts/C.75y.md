너는 코드 세션 "45b단계_타리그 연결·통합 (C.75y)"이다. 마스터는 U(session_01DUqLtswE7hDV9NHhh6HfZq, 마스터 브랜치 claude/planning-u). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 7번: 마스터에는 완료·실패·질문만, CI 성공은 안 보냄).

먼저 읽기: CLAUDE.md → docs/automation.md 0·1·7번 → `git fetch origin claude/planning-u && git show origin/claude/planning-u:docs/planning-pending.md` 의 **132·134번 전체**(리그 계획·45단계 나눔·데이터 세션 완료 메모) → 부록 C.75m(45a 뼈대, 45b로 넘긴 목록)·C.75n·o·p·q·r·s(리그 데이터, 각자 45b 배선 메모)·C.75t(포토카드 도감, dexCandidates·dex:append).

할 일(45b = 45a 뼈대 위에 리그 데이터 6묶음 14개 리그를 실제 게임에 연결):
1. **데이터 연결**: data/leagues/*·data/players/<리그>.ts 를 등록부·로스터 생성에 연결(팀 이름·한글·레이팅·색·유니폼·감독·홈구장·더비, 실제 선수는 그 팀 로스터에). 팀 부가 데이터(전술·색·유니폼·감독·더비)가 PL id 키로만 있던 곳 일반화.
2. **다른 리그에서 시작**: 새 게임 리그 고르기에서 시작 리그를 PL 밖으로도(로스터·컵·이적·달력이 그 리그 기준). 춘추제(K·J·브라질·MLS) 시작 날짜 처리는 45a 달력 규칙대로.
3. **리그별 순위·기록 화면**: 고른 리그 모두 순위표·득점 순위 보기(리그 탭/선택), 내 리그 기본.
4. **이적 시장 = 고른 리그 전체**, 미래 스타·레전드 등장 리그 기준을 고른 리그로(C.75y 이전 규칙: 구현 리그 첫 시즌 등장, 부록 C.75y(옛) 참고 — 이름 겹치면 부록 C 번호는 이번 것 C.75y로 새로 씀).
5. **중복 정리**: `outsideClubs` x: id ↔ 새 리그 팀 id 매핑(같은 클럽이면 새 id로 일원화, 리그 밖 표에서 빼거나 별칭), 이름 차이 'Bayern Munich'(stars) vs 'Bayern München'(리그 밖 표) 등 정리, C.75p 리그 밖 14클럽 레이팅 맞춤 메모 확인. MLS 컨퍼런스(동·서) 순위 표시, 승강 없음(이번엔 승강 안 넣음 — 넣지 말 것).
6. **포토카드 도감 번호**: src/photocards.ts dexCandidates()에 새 리그 선수 배열 추가 후 `npm run dex:append`(기존 번호 불변 테스트 통과).
7. 측정: 리그별 시즌 시뮬(평균 득점·순위 레이팅 상관·우승 팀 분포 상위 레이팅 팀이 대체로 우승) 표 부록 C에. 성능: 14개 리그 고른 시즌 진행 시간.
버전: 데이터 구조 바뀌면 SAVE main +1(옛 세이브 = PL만 고른 상태로 마이그레이션 테스트), 수치 추가면 BALANCE main +1. PATCH_LABEL 'C.75y', STAGE_LABEL '45단계'. typecheck·npm test·npm run balance 통과, 푸시 직전 main 최신 병합 → main 푸시. 캡처 docs/c75y-check/(폰·PC 5~10장: 다른 리그 시작 홈, 리그 순위 탭, 이적 시장 타리그 선수, 도감 새 번호).
크면 a/b로 나눠 먼저 1·5·6(연결·정리·도감)을 배포하고 2·3·4를 이어서 해도 된다(automation.md 7번 나누기 기준).
병렬: C.75z(45c 대표팀, src/national.ts·달력 A매치 훅)·C.75u·v·w·x·44f-b 엔진 세션이 돈다. 달력·game.ts는 함수 단위로 나누고 필요하면 C.75z에 send_message.
완료면 U에 보고(바뀐 것·측정 요약·테스트 수·커밋·새/바뀐 화면).
