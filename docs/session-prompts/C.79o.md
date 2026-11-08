너는 게임 시스템 코드 세션 "53단계_빠른 경기 홈 이점·결승 중립 (C.79o)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79o-home` — origin/main 최신에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79k·C.79m은 src/engine 판단 코드 — 너는 엔진 입력의 neutral 플래그만 씀).

근거: 외부 피드백 R1(사용자 2026-10-30 03:1x KST "추천하는 대로 ㄱㄱ"). 마스터 확인(main 80f6277):
- 빠른 경기 `league.ts:227-229` λ = 1.35·exp(Δ·0.05) + (home ? `homeBonus` 0.25 : 0) — **골 덧셈**(약팀 홈일수록 비율상 더 큼, Δ=0에서 λ +18.5% ≈ +3.4 레이팅). 기획서는 "+1.5 레이팅"(game-design.md D.10 4 ~9781, ~9103, ~8858, engine/config.ts:1205 주석) — 코드와 문서가 다름. `match.ts:76 positionCenter`도 homeBonus/2.
- 결승: FA(cups.ts:335 quickTie)·UCL(cups.ts:579 uclQuick, 결승 :564)의 NPC 결승이 `tie.h`(추첨 순서)를 홈으로, 내 결승은 엔진에 `home: tie.h === me`(cups.ts:706, game.ts:1932) neutral 없음 — 이동 일정은 이미 결승을 중립으로 침(game.ts:1214, balance.ts:552 neutralFinal).

## 할 일 (추천안 = 안 B)
1. 빠른 경기 홈 이점을 **레이팅 이동**으로: Δ_eff = Δ ± `homeRating`(홈 +, 원정 −로 나누든 홈만 +든 일관되게), **크기는 지금 홈 승/무/패 수준을 유지**하도록 맞춤(Δ=0 현재 λ 비율 ≈ +3.4 레이팅 근처 — 측정으로 결정, 목표 홈 승/무/패 45/27/28 ±2). positionCenter도 같은 정의로. 기획서의 "+1.5 레이팅" 문장을 실제 값으로 고침.
2. **결승 중립**: FA·UCL 결승(그리고 중립이어야 하는 다른 단판: 커뮤니티 실드 등 있으면) — 빠른 경기는 홈 항 없음, 내 결승 엔진 경기는 `neutral: true`(types.ts:77, 지금 캘리브레이션용으로만 씀). 대표팀 토너먼트 내 경기도 엔진 홈 이점이 붙는지 확인하고 붙으면 중립으로(national.ts 빠른 경로는 이미 neutralScore).
3. 화면에 홈/원정 표시가 결승에서 "중립"으로 나오게(문구만, 새 화면 금지).

## 관문·배포
- `npm run balance` 회귀 가드(리그 팀 득점 1.3~1.5·득점 분포·재정·성장) · 빠른 경기 홈 승/무/패 전후표 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check(엔진 코드 불변이라 지문 같아야 — neutral 경로만 다름).
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). BALANCE_VERSION +1, ENGINE·SAVE 그대로, PATCH_LABEL 'C.79o', STAGE '53단계'. 부록 C.79o.
- 예산 **2시간·10달러**. 끝나면 AD에 보고(안 된 것 먼저).
