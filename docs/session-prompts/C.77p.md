너는 코드 세션 "50단계_골 스플래시 (C.77p)"이다(Opus, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77p-goal-splash`(main 최신에서).

근거(사용자 요청 2026-10-22 09:35 KST, UI_5 경유): `git fetch origin claude/ui-5` 뒤 b1539d0의 `docs/ui-requests/goal-splash-apply.md`(명세)와 그림 `docs/design/incoming/goal-splash/goal.webp`·`goal-887.webp`(투명 GOAL! 1774×887)를 가져온다(그림은 `public/` 아래 알맞은 자리로, 문서는 main docs에 그대로).
할 일: 명세 그대로 — 우리 팀 골에만, 왼쪽에서 날아와 가운데 펄스 후 오른쪽으로 빠짐(약 1.6초), 탭으로 닫기, prefers-reduced-motion이면 페이드, 설정 "골 연출 켬/끔"(기본 켬, 저장). 장면 재생·실시간·하이라이트 클립(C.77o) 모두에서 같은 동작, 자동 일시정지(골)와 겹칠 때 순서는 명세대로(없으면 스플래시 먼저 → 닫히면 정지 포즈). 엔진·밸런스 무수정.
관문: typecheck·test(스플래시 트리거·우리 팀만·설정 끔·reduced-motion 테스트) · build · 같은 시드 지문 불변 · 실게임 캡처 폰·PC(골 순간) · 세이브 구조 바뀌면(설정 필드) SAVE_FORMAT +1·이전.
**main 푸시 주의**: 지금 main d6cd668(C.77n fix) CI가 도는 중이다. 그 실행이 끝나기 전에는 main에 푸시하지 말 것(CI 취소 방지) — 작업 브랜치에만 푸시하고, `actions_list`로 d6cd668 실행이 completed인지 확인한 뒤 main 병합·푸시. 실패로 끝났으면 C.77n이 고친 뒤까지 기다리고 Z에 알린다.
예산: 1시간·약 5달러. PATCH_LABEL 'C.77p', STAGE_LABEL main 그대로, balance:check는 엔진·밸런스 무변경이라 생략 가능(이유 부록). 부록 C에 C.77p. 끝나면 마스터 Z에 보고(구현·캡처·테스트 수·커밋·시간). CI 성공은 보내지 않는다.
