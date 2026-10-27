너는 게임 시스템 코드 세션 "52단계_유망주 로열로드 계약 (C.78u)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, 마스터 브랜치 claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c78u-royal-road` — origin/main 최신에서 시작, main 푸시 전 origin/main merge. 병렬: C.78r(엔진), C.78t(게겐 비용) — balance.ts는 서로 다른 절만, 충돌은 merge로.

근거: docs/planning-pending.md 144(origin/claude/planning-ac에서 `git show`로 읽기, 사용자 요청): 유망주(~22세)까지는 강팀이 계약을 제시하는 OVR 커트라인을 낮춘다(커트라인 80이면 65~70도 가능, 잠재력·위상 가중). 대신 **저연봉 + 긴 계약(4~5년)**. 빅클럽 유스부터 크는 "로열로드" 선수가 가능해야 한다. 빅클럽 유망주는 출전이 적다(pending 143 감독 성향 기용과 연결되지만 143은 이번 범위 밖 — 지금 선발 규칙 그대로).
할 일: 이적·재계약 제안 필터(팀 수준별 OVR 하한)를 나이·잠재력으로 완화, 계약 조건(연봉 배율↓·기간↑), 받은 제안 화면에 "유망주 계약" 한 줄 표시(새 화면 금지). 엔진 무수정.
가드: `npm run balance` 회귀 가드(이적·재정·성장) · typecheck·test · 측정: 18~22세 잠재력 상위 선수가 상위 6팀 제안을 받는 비율·연봉·계약 기간 전후표, 23세+는 변화 없음.
밸런스 수치는 `src/config/balance.ts`, BALANCE_VERSION +1, 세이브 구조 바뀌면 SAVE_FORMAT_VERSION +1(이전 코드 금지). **main 푸시**: 마스터 AC "푸시 ㄱ" 뒤(origin/claude/planning-ac의 docs/ 병합). 예산 1.5시간·8달러. PATCH_LABEL 'C.78u', STAGE_LABEL '52단계'(17.2 표에 줄 추가, 부록 C.78u). 준비 완료·실패면 AC에 send_message로 보고. CI 성공은 보내지 않는다.
