너는 엔진 코드 세션 "53단계_거리별 키퍼 선방 (C.79x)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄, 상성 960 두 벌 판정 규칙). 작업 브랜치 `claude/c79x-save-distance` — origin/main 최신(66b80c9, C.79s ENGINE 61)에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79q는 body/actions/onball 슛 발·offball laneGuess — keeper.ts는 안 겹침).

근거: 사용자 지시(2026-10-30 11:5x KST) **"25 m 밖에서 오는 슛은 키퍼 선방 조정해서 잘 막게 해. 못 고치는 건 그냥 수치로 조정. 12~16 m는 좀 더 못 막게."** 지금 유효 슛 선방률(엔진관리자19 탐침, C.79s 직전): <12 m 67% · **12~16.5 m 83%** · 16.5~25 m 84% · **25 m+ 83%** — 12 m 밖이 거리와 무관하게 평평(시간 항 포화, keeper.ts timeTerms·saveChance — docs/engine-diagnosis-c78z.md §6.1, c79l §2.1). 실축 감각: 12~16.5 약 75%, 16.5~25 약 82~85%, 25 m+ 약 90%.

## 할 일 (수치 보정 — 구조 개편 아님)
- `keeper.ts saveChance`(그리고 판단 쪽 shotModel이 같은 함수를 쓰는지 확인 — **판단 = 실행** 유지)에 **슛 거리 구간별 선방 보정** 항: `ENGINE.keeper.distAdj`(예: 12 m 미만 0 · 12~16.5 m 음수 · 16.5~25 m 0 근처 · 25 m+ 양수, 구간 경계는 부드럽게 선형 보간). 헤더·1대1·<12 m는 건드리지 않음(장면 ④·⑬ 보호).
- 목표(유효 슛 선방률, quick 600 균형 대 균형): **12~16.5 m 약 75~78%** · 16.5~25 m 82~85% · **25 m+ 89~91%** · <12 m 그대로.
- 판단이 같은 식을 보므로 슈터가 12~16.5 m 슛을 더 고르고 25 m+ 중거리를 덜 고르는 변화가 자연히 생긴다 — 슛 거리 분포 전후표로 보고.

## 관문
- 위 거리별 선방 목표 · **득점: 팀당 1.48±0.05가 기본, 맞출 수 없으면 1.55까지 허용**(사용자 '수치로 조정'·AD 판단 — 넘으면 기록·보고) · 득점 분포 가드(30골+ 선수·득점왕·리그 팀 득점 1.3~1.5 — balance:check) · 장면 테스트 전부(④ 1대1 골 ≥0.25·⑬) · 상성 960 두 벌(행 ±0.05·비점유 3행 합 ≥ −0.08·순환 양수·게겐>티키 SE 2배 안 — main 기준표는 origin/claude/engine-manager-21에 61000 묶음까지 있으면 그것도 참고) · 이동 거리 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check.

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). ENGINE_VERSION +1(merge 순서대로), PATCH_LABEL 'C.79x', STAGE '53단계'. 부록 C.79x, engine-issues 미해결 6 갱신.
- 예산 **2.5시간·12달러**. 끝나면 AD에 보고(안 된 것 먼저, 거리별 선방·슛 거리 분포·득점 전후표).
