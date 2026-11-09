너는 엔진 코드 세션 "53단계_엔진 묶음 F3: 표준 대형 균형 (C.82i)"이다(Fable 5.1, 노력도 높음). 첫 단계: `~/.claude/settings.json` 과 레포 `.claude/settings.json` 에 `"fastMode": true`(이미 있으면 그대로). 브랜치 `claude/c82i-formation` — origin/main 최신(aa100e8 이후)에서. docs/automation.md를 따른다(0번 맨 위 — 수치 레버 먼저, 상성은 `ENGINE.matchup` 칸으로만, 보고는 패치 번호 대신 내용으로). 마스터 AF `session_01YVaigHq3Uo2LLh43wuodre`, 마스터 브랜치 claude/planning-af. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). **혼자 진행**(병렬 엔진 패치 없음) — 득점 총량도 이 세션이 끝에 1.48~1.52 로 맞춘다. 관문 통과하면 승인 없이 main 푸시(planning-af docs 를 `git merge` 로 병합, 푸시 직전 rebase 진행 중 아님 확인), ENGINE_VERSION 올림(105→106), PATCH_LABEL 'C.82i', STAGE_LABEL '53단계', 부록 C.82i. 백그라운드 측정은 nohup·파일 로그, 큰 출력은 tail/grep 만. 측정 보조 세션은 쓰지 않는다. 끝나면 AF에 send_message 보고(안 된 것 먼저, 전후 표, main 해시), CI 성공까지 확인(CI 성공은 따로 보내지 않음, 실패만). 공통 관문: typecheck · test · build · engine:check · 결정성. **주간 사용량 경고 상태** — 측정은 꼭 필요한 것만.

## 근거 (부록 C.82h "안 된 것")
1. **표준 대형 상호 최대 +0.51**(3-4-3·4-3-3 > 4-1-4-1, 관문 ≤ +0.35): 1대1 보정(`oneOnOne.drop`)이 ST 2명·윙 2명 대형에 더 자주 걸림. C.82h 의 `prob.stFinishShare`(ST 1명 1.2·2명 1.1)로 4-1-4-1 행이 −0.39→−0.34 만 움직임.
   후보(수치 레버 먼저, 효과 둔하면 크게): ① 1대1 drop 도 팀 ST·CF 수로 나누기(stFinishShare 와 같은 방식, 판단·실행 같은 값) ② stFinishShare 세게(1명 1.3·2명 1.0) ③ 4-1-4-1·4-2-3-1(ST 1명 대형) 몫 따로 — 대형 표 보정(automation 0번 "상성 칸 직접 보정 허용"과 같은 원칙으로 대형별 작은 계수)은 ①② 로 안 될 때만.
2. 같이: 장면 ④ 1대1 골 0.253(경계) · 티키>직선 +0.01(순환 양수 유지, 목표 ≥ +0.05) · 커스텀 2-4-1-3 +0.335(≤ +0.3).
기준표 `scripts/diag/c82h-960-final.json`, 측정 틀·스크립트는 `scripts/diag/c82h/`(stdmat-sum.cjs·gates.sh·final-chain.sh) 재사용, 지시문 틀 docs/session-prompts/C.82h.md.
quick 600 명령은 `SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick` (기본 balance:quick 은 레이팅 차 섞여 1.6 대로 나옴 — 혼동 금지).

## 관문
표준 대형 상호 최대 ≤ +0.35 · 4-3-1-2 행 평균 ≤ +0.2 · 커스텀 2-4-1-3 ≤ +0.3 · 전환 슛 비 ≥ 1.15 · 전환 xG 비 ≥ 1.10 · 상성 960(기준 c82h-960-final) 게겐>티키 +0.20~0.30·순환 양수·±0.3 칸 없음·행 Δ ±0.05·균형/역습>게겐 ≤ +0.15 · 정통 윙어·와이드 미드 ±0.1 · 득점 1.48~1.52 · ST 32~40% · 이동 거리 <14.1/<15.3 · 장면 가드(④ 1대1 골 포함) · 평점 가드. 예산 4시간·40달러. 하나라도 못 맞추면 맞춘 것까지 배포하고 "안 된 것"에 원인·다음 후보를 적는다.
