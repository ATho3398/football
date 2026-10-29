너는 엔진 코드 세션 "53단계_몰빵 대응 결함 수정 (C.79k)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79k-linematch-fix` — origin/main 최신에서 시작, main 푸시 전 origin/main merge.

근거: 사용자 결정(2026-10-30 01:2x KST) "결함을 먼저 고치고서 다른 방향으로 몰빵 억제 효과를 만들자." 결함은 `docs/engine-diagnosis-c79h.md` §1·§4.2(엔진관리자18): `src/engine/offball.ts lineMatchPlan()`
① 공이 떠 있을 때 owner가 없어 **패서가 공격 줄로 세어짐**(발동 60~65%가 패스 비행 중) — 스위치 `lineMatchFlight` 1
② 수비 팀 누구도 오프볼 판단을 안 한 틱(17%)엔 계획이 안 만들어져 **유지가 끊김**(54%가 1초 미만 깜빡임) — 스위치 `lineMatchKeep` 0.3 s
두 스위치는 이미 코드에 있다(engine-manager-18 실험 스위치가 main에 들어왔는지 먼저 확인, 없으면 c79h 문서대로 구현). `src/engine/config.ts` 기본값을 켜고 ENGINE_VERSION +1.

## 관문
- **몰빵(대형 35 대 균형 4-4-2) 800경기는 기록만** — 사용자 지시대로 결함 수정이 먼저다. 예상 +0.30~0.34(C.79e 효과가 결함 위에 있었음). 관문 ≤ +0.3을 넘어도 **배포**하고, 다른 방향 억제는 엔진관리자19가 따로 맡는다(그 세션에 숫자 전달은 마스터가).
- 지켜야 할 것: 발동 횟수·평균 길이·1초 미만 깜빡임 비율 전후표(결함이 실제로 고쳐졌는지) · 상성 480·양방향 기준표(docs 부록 C.78y)에서 행 강도·순환이 C.79e 수준보다 나빠지지 않음(SE 2배 밖 칸 변화는 다른 시드 묶음 960으로 재확인 뒤에만 판정 — 엔진관리자18 측정 규칙) · 동레이팅 득점 1.48±0.05 · 이동 거리 시드 11~30 평균 ≤ 14.1 km(한 선수 < 15) · 장면 테스트 전부 · typecheck · test · balance:check(로컬 60분 넘으면 다른 관문 통과 시 CI) · engine:check.
- 공격 움직임을 줄이는 변경이 아니다(발동이 줄어 수비가 덜 내려앉음).

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). PATCH_LABEL 'C.79k', STAGE_LABEL '53단계'. 부록 C.79k, docs/engine-issues.md 미해결 5 줄 갱신.
- 예산 **2시간·10달러**. 끝나면 AD에 보고(안 된 것 먼저, 몰빵 800 수치·발동 전후표·상성 변화).
