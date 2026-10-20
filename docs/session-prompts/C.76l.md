너는 코드 세션 "U8단계_디자인 적용 U8-c 도감·리그 고르기·커스텀 (C.76l)"이다. 마스터는 V(session_01Lzq7rz3Q4FvKuV1aT6Xkhk, 마스터 브랜치 claude/planning-v). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 6번 4항 U 적용 패치, 7번: 마스터에는 완료·실패·질문만, CI 성공은 보내지 않음).

먼저 읽기: CLAUDE.md → docs/automation.md 0·1·6·7번 → `git fetch origin claude/ui-4` 후 그 브랜치의 `docs/ui-requests/7-13-part2-apply.md` **전체**(0 공통 규칙·1 화면 대응표·2 나눠 넣기·3 확인 캡처 기준) → 디자인 묶음 `docs/design/player-one-design-b/`(HANDOFF.md, design-system README). 디자인 파일은 `git merge origin/claude/ui-4`로 가져온다(checkout 금지, merge만). 공통 컴포넌트는 C.76g(U8-b)가 main에 넣은 것을 쓴다. 부록 C.76c·C.76h(새 게임 흐름)·C.75t(도감)·C.76e(커스텀 국적·인종)를 먼저 읽는다.

할 일: 명세 2절 표의 **U8-c** 묶음 — 238 도감 · 239 리그 고르기 · 229 커스텀 · 233~235. 모양은 디자인 우선, 데이터·동작은 지금 main 그대로(명세 0-2).
**239는 구조가 바뀌었다(사용자 17:45 지시, C.76h 배포)**: 새 게임 = 리그 선택 → 그 리그 팀 고르기, '내 리그' 단계·[내 리그로] 없음, "시작 팀" 리그 탭(국기+이름 14개) + 팀 목록(못 고르는 팀 흐리게+이유), 다른 리그 묶음 고르기는 옵션. 디자인 239의 모양(카드·탭·색)을 이 새 흐름에 맞춰 입힌다. 디자인에 있는 '내 리그' 표시는 "고른 팀 리그(맨 앞·해제 불가)"로 바꿔 읽는다.
주의(디자인보다 코드 우선): 머리말 이름 한 줄 C.75u(이름 두 줄 금지, OVR·등번호 겹침 유지), 칩 한 줄 우선, 커스텀 기본 단계 국적·인종 위 C.76e, 대표팀 화면 C.76d(건드리지 않음).
버전: 엔진·밸런스·세이브 그대로(바꾸면 main +1). PATCH_LABEL 'C.76l', STAGE_LABEL은 main 값 그대로. 확인 캡처 명세 3절 기준 docs/design/c76l-check/(5~10장, 폰 390×844·PC 1280×800, 페이지 오류 0·가로 넘침 0). typecheck·npm test·balance:check·build 통과, 푸시 직전 main 최신 병합 → main 푸시. 부록 C에 C.76l(적용 화면 번호·못 한 것).
병렬: C.76i(U8-d 재정·인박스·면담, session_0197oRFAwntnvtuGZh3Hsgc6)·C.76j(U8-e 시즌·월드·기록, session_01WHCbo6psGoyXo4PKTSrUAC)·C.76k(엔진, Fable)가 돈다. 같은 파일(src/ui/main.ts·style.css) 충돌은 푸시 직전 병합으로 풀고, 큰 겹침이면 그 세션에 send_message.
완료면 V에 보고(적용 화면 번호·못 한 것·테스트 수·커밋·캡처).
