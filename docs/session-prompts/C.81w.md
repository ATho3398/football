너는 코드 세션 "53단계_다른 리그 득점 2: 포지션별 골 평균·골든부츠 (C.81w)"이다(Opus 5.5, 노력도 높음). 마스터 AE(곧 열림 — 그 전엔 AD session_01YVaigGhehXaRqBVTGBzTwo; 보고처 바뀌면 알림 옴), 마스터 브랜치 claude/planning-ae(없으면 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 수치 우선, 상성은 `ENGINE.matchup` 칸으로만, 보고는 패치 번호 대신 내용으로). 관문 통과하면 승인 없이 main 푸시(planning 브랜치 docs 병합, 푸시 직전 rebase), PATCH_LABEL 자기 번호, STAGE 53단계, 부록 자기 번호. 백그라운드 측정은 nohup·파일 로그(턴 끝나면 죽을 수 있음). 끝나면 마스터에 send_message 보고(안 된 것 먼저, 전후 표, main 해시), CI 성공까지 확인. 브랜치 `claude/c81w-other-league-scorers-2` — origin/main 최신에서(C.81q 챔스 자리 후속이 아직이면 그 브랜치 claude/c81q-other-league-scorers 가 main 에 들어간 뒤 rebase). 앞 단계 = 부록 C.81q · docs/c81q-measure.md.
## 할 일
1. 빅5 ST·CAM·CDM 시즌 골 평균이 엔진보다 10~25% 낮은 것(이력서 풀 밖·시즌 중 로스터 변화 몫 추정) → 원인 확인 후 리그×포지션 칸 ±10% 안 비율 46/90 → 70/90 이상.
2. 골든부츠 1위 내 리그 비율(내 리그만 0.08 vs 전부 엔진 0.25): 표본 늘려(시즌 30 이상) 진짜 차인지 확인, 차면 빠른 진행 득점왕 쏠림 보정.
3. 엔진 기준 저장본을 지금 엔진(91+)으로 다시 잰다.
## 관문
전후 표 · typecheck · test · balance 회귀 가드(BALANCE +1). 예산 3시간·15달러.
