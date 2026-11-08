너는 엔진 코드 세션 "53단계_역할 평점 2: 다른 대형·전력 차·수비 기록 칸 (C.81u)"이다(Opus 5.5, 노력도 높음). 마스터 AE(곧 열림 — 그 전엔 AD session_01YVaigGhehXaRqBVTGBzTwo; 보고처 바뀌면 알림 옴), 마스터 브랜치 claude/planning-ae(없으면 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 수치 우선, 상성은 `ENGINE.matchup` 칸으로만, 보고는 패치 번호 대신 내용으로). 관문 통과하면 승인 없이 main 푸시(planning 브랜치 docs 병합, 푸시 직전 rebase), PATCH_LABEL 자기 번호, STAGE 53단계, 부록 자기 번호. 백그라운드 측정은 nohup·파일 로그(턴 끝나면 죽을 수 있음). 끝나면 마스터에 send_message 보고(안 된 것 먼저, 전후 표, main 해시), CI 성공까지 확인. 브랜치 `claude/c81u-role-rating-2` — origin/main 최신에서. 앞 단계 = 부록 C.81r · docs/engine-roles.md C.81r 절 · scripts/diag/c81r-*.ts.
## 할 일
1. **경기 기록 칸 추가**(행동 무변경, 세기만): 라인 유지(오프사이드 유도·라인 간격 유지 시간), 압박 성공(압박 뒤 N초 안 탈취). 평점에 소폭 가중.
2. **다른 대형·전력 차·전술에서 역할 평점 차** 측정(4-4-2·3-5-2·4-2-3-1 · 전력 ±5 · 게겐/블록/직선) → 최대 |차| ≤ 0.15 되게 roleCenter 보정 방식 일반화(대형·전술 무관하게 맞는 쪽으로).
3. **와이드 미드필더 역할**: 800경기·3시드로 다시 재고 ±0.08 밖이면 그 역할 수치로.
## 관문
지문(경기 결과·골 시각 동일, 평점만 다름 — 1번 기록 칸 추가도 결과 불변) · engine:check 포지션 평점 가드 · typecheck · test · balance:check(CI). ENGINE +1. 예산 3시간·15달러.
