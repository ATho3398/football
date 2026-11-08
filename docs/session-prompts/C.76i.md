너는 코드 세션 "U8단계_디자인 적용 U8-d 재정·인박스·면담 (C.76i)"이다. 마스터는 V(session_01Lzq7rz3Q4FvKuV1aT6Xkhk, 마스터 브랜치 claude/planning-v). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 6번 4항 U 적용 패치, 7번: 마스터에는 완료·실패·질문만, CI 성공은 보내지 않음).

먼저 읽기: CLAUDE.md → docs/automation.md 0·1·6·7번 → `git fetch origin claude/ui-4` 후 그 브랜치의 `docs/ui-requests/7-13-part2-apply.md` **전체**(0 공통 규칙·1 화면 대응표·2 나눠 넣기·3 확인 캡처 기준) → 디자인 묶음 `docs/design/player-one-design-b/`(HANDOFF.md, design-system README). 디자인 파일은 `git merge origin/claude/ui-4`로 가져온다(checkout 금지, merge만). 공통 컴포넌트(skin-b.css Banner·Toast·HeroPanel·Icon 등)는 C.76g(U8-b)가 main에 넣었으니 그것을 쓴다(부록 C.76g 참고).

할 일: 명세 2절 표의 **U8-d 재정·인박스·면담** 묶음만 적용. 화면 206·219·220 + 191·192·193·194 + 196·200·216, 그리고 C.76g가 못 한 197② 면담 결과 전용 칩. 모양은 디자인 우선, 데이터·동작은 지금 main 그대로(명세 0-2). 새 데이터가 필요한 칸은 지금 있는 데이터로 채우거나 빼고 부록 C에 적는다.
주의(디자인보다 코드 우선): 결정 순간 배치 C.75v, 머리말 이름 한 줄 C.75u(OVR·등번호 겹침 유지, 이름 두 줄 금지), 칩 한 줄 우선, 주발 발자국 C.75z, 대표팀 화면 C.76d(디자인 없음, 건드리지 않음).
버전: 엔진·밸런스·세이브 그대로(바꾸면 main +1). PATCH_LABEL 'C.76i', STAGE_LABEL은 main 값 그대로 둔다(병렬 단계라 되돌리지 않음). 확인 캡처 명세 3절 기준 docs/design/c76i-check/(5~10장, 폰 390×844·PC 1280×800, 페이지 오류 0·가로 넘침 0). typecheck·npm test·balance:check·build 통과, 푸시 직전 main 최신 병합 → main 푸시. 부록 C에 C.76i(적용 화면 번호·못 한 것).
병렬: C.76j(U8-e 시즌·월드·기록, session ID는 시작 메시지에) · C.76h(45b(b) 다른 리그 풀 엔진·새 게임 리그 선택→팀, session_014hnh7JesgAD6TuzpSroeqZ)가 돈다. 같은 파일(src/ui/main.ts·style.css) 충돌은 푸시 직전 병합으로 풀고, 큰 겹침이면 그 세션에 send_message.
완료면 V에 보고(적용 화면 번호·못 한 것·테스트 수·커밋·캡처).
