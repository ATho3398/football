너는 코드 세션 "U8단계_디자인 적용 U8-b 컴포넌트·홈 (C.76g)"이다. 마스터는 U(session_01DUqLtswE7hDV9NHhh6HfZq, 마스터 브랜치 claude/planning-u). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 6번 4항 U 적용 패치, 7번: 마스터에는 완료·실패·질문만).

먼저 읽기: CLAUDE.md → docs/automation.md 0·1·6·7번 → `git fetch origin claude/ui-4` 후 그 브랜치의 `docs/ui-requests/7-13-part2-apply.md` **전체**(0 공통 규칙·1 화면 대응표·2 나눠 넣기·3 확인 캡처 기준) → 디자인 묶음 `docs/design/player-one-design-b/`(HANDOFF.md, design-system README). 디자인 파일은 claude/ui-4 브랜치에 있으니 `git merge origin/claude/ui-4`로 docs만 가져온다(automation 7번: checkout 금지, merge만).

할 일: 명세 2절 표의 **U8-b 컴포넌트·홈** 묶음만 적용(다른 묶음은 다음 세션). 모양은 디자인 우선, 데이터·동작은 지금 main 그대로(명세 0-2). 공통 0-1(skin-b.css·skin.ts B 층 추가분)은 U8-b 몫이지만, U8-a가 먼저 필요하면 그 부분만 최소로 넣고 부록 C에 적어 U8-b가 이어받게 한다(둘이 병렬이니 같은 줄 충돌 주의 — 서로 send_message: U8-a = C.76f, U8-b = C.76g).
주의(최근 바뀐 것, 디자인보다 코드 우선): 결정 순간은 C.75v로 선택지 최대 5개·라벨 구간·폰에서 경기장 위 고정+선택지 패널만 스크롤(사용자 지시 — 이 배치 유지, 경기장 덮는 시트 금지), 홈·선수 머리말은 C.75u(이름 한 줄 소수점 맞춤, OVR·등번호 겹침은 디자인이라 유지), 주발 발자국 칸 C.75z, 커스텀 기본 단계 국적·인종 위 C.76e.
버전: 엔진·밸런스·세이브 그대로(바꾸면 main +1). PATCH_LABEL 'C.76g', STAGE_LABEL '44단계'. 확인 캡처 명세 3절 기준 docs/design/c76g-check/(5~10장, 폰 390×844·PC 1280×800). typecheck·npm test 통과, 푸시 직전 main 최신 병합 → main 푸시. 부록 C에 C.76g(적용한 화면 번호 목록·못 한 것).
병렬: 다른 U8 세션(C.76f/C.76g)·C.76a(엔진)·C.76c(45b 타리그·새 게임 팀 고르기)·C.76d(45c 대표팀)가 돈다.
완료면 U에 보고(적용 화면 번호·못 한 것·테스트 수·커밋·캡처).
