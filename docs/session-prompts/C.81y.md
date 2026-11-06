너는 코드 세션 "53단계_대표팀 경기 내 자리 고르기 (C.81y)"이다(Opus 5.5). 마스터 AE `session_01YVaigGKpnpQtRAv8gToCJ6`, 마스터 브랜치 claude/planning-ae. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 수치 우선, 보고는 패치 번호 대신 내용으로). 관문 통과하면 승인 없이 main 푸시(planning 브랜치 docs 병합, 푸시 직전 rebase), PATCH_LABEL C.81y, STAGE 53단계, 부록 C.81y. 백그라운드 측정은 nohup·파일 로그. 끝나면 마스터에 send_message 보고(안 된 것 먼저, 전후 표, main 해시), CI 성공까지 확인. 브랜치 `claude/c81y-intl-slot` — origin/main 최신에서. 참고 부록 C.81l·C.81v(C.81v3).
## 문제
대표팀 경기에서 엔진 어댑터가 내 자리를 "같은 포지션군에서 OVR 가장 낮은 선발 자리"(adapter mySlot)로 골라, LW 손흥민이 한국 4-4-2 의 RM 칸에 들어간다. 준비 화면 그림(national.natPreviewLineup)은 엔진과 같은 계산이라 그대로 따라간다.
## 할 일
1. mySlot 규칙: 대표팀 경기에서 **내 주 포지션과 같은 칸 → 없으면 가장 가까운 칸(같은 쪽 측면 우선: LW→LM/LW, RW→RM/RW; 중앙은 가까운 줄)** 을 고르고, 그 칸의 원래 선수는 나 대신 빠지게(OVR 낮은 쪽 밀어내기 규칙은 칸이 정해진 다음에만). 클럽 경기 동작은 바꾸지 않는다(클럽은 전술 슬롯 그대로) — 클럽 경기 지문 동일 확인.
2. 준비 화면 그림이 같은 함수를 쓰므로 자동으로 맞는지 확인, 캡처 docs/captures/c81y/(360·390·1280).
3. 테스트: 포지션 10종(LW·RW·LM·RM·ST·CAM·CM·CDM·LB·RB·CB) × 대표팀 대형 몇 개에서 고른 칸이 기대와 같은지, 나 1칸, 11명 유지.
엔진 판정·수치 무수정(자리 고르기만). 대표팀 경기 결과는 바뀔 수 있음(ENGINE 번호 올림). 세이브 형식 바뀌면 이전 + 예시 세이브 테스트(CLAUDE.md).
## 관문
typecheck · test · build · balance:engine:check(경량) · 클럽 경기 결정성 지문 동일. 예산 2시간·10달러.
