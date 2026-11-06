너는 엔진 코드 세션 "53단계_엔진 구조 속도: 선수 실수 필드 Float64Array (C.81x)"이다(Fable 5.1, 노력도 높음). 마스터 AE(곧 열림 — 그 전엔 AD session_01YVaigGhehXaRqBVTGBzTwo; 보고처 바뀌면 알림 옴), 마스터 브랜치 claude/planning-ae(없으면 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 수치 우선, 상성은 `ENGINE.matchup` 칸으로만, 보고는 패치 번호 대신 내용으로). 관문 통과하면 승인 없이 main 푸시(planning 브랜치 docs 병합, 푸시 직전 rebase), PATCH_LABEL 자기 번호, STAGE 53단계, 부록 자기 번호. 백그라운드 측정은 nohup·파일 로그(턴 끝나면 죽을 수 있음). 끝나면 마스터에 send_message 보고(안 된 것 먼저, 전후 표, main 해시), CI 성공까지 확인. 브랜치 `claude/c81x-engine-soa` — origin/main 최신에서. 앞 단계 = 부록 C.81e·C.81j(결론: 남은 큰 덩어리 = 선수 이동·몸 돌리기, 더 줄이려면 선수 실수 필드를 Float64Array 로 옮기는 구조 변경).
## 할 일
- 선수 위치·속도·방향·체력 등 핫 루프 실수 필드를 구조체 배열(Float64Array, 선수 인덱스) 로 옮겨 경기 1회 계산을 결과 불변으로 줄인다. 목표: 브라우저 워커 429 ms → 320 ms 이하, Node −25% 이상.
- **지문 불변**(c81j-fp.ts 그대로): 같은 기반에서 전후 비트 동일. 병렬로 엔진 수치 세션 C.81t·C.81u 가 main 에 들어올 수 있음 → 그 패치들이 먼저 들어가면 rebase 후 같은 기반 전후 지문만 비교. 충돌이 크면 그 둘이 끝난 뒤 마지막에 합친다.
## 관문
지문 동일 · typecheck · test · engine:check · build · 전후 ms 표(Node·크롬 워커). ENGINE 번호 그대로. 예산 5시간·30달러.
