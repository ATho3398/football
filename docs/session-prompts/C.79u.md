너는 엔진 코드 세션 "53단계_점유 가치 2 (C.79u)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 판단 보정 원칙, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79u-possession` — origin/main 최신에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79s keeper.ts·onball shotModel 한 줄, C.79q body/actions/onball 슛 발·offball laneGuess — 겹치면 merge 뒤 재측정).

근거: 사용자 지시(10/30 01:3x) "짧은 패스는 점유 가치 높이는 패치, 티키는 더 높게, 직선·블록은 낮게". C.79m(origin/claude/c79m-possession de28b80, 1~4차)이 상성에서 미달 → 엔진관리자20 진단 `docs/engine-diagnosis-c79u.md`(origin/claude/engine-manager-20):
- 기제: 점유 가치가 중간 ⅓ 상실을 줄여 직선·블록의 상대 진영 탈취·전환 6초 패스를 줄임(행 이전, 비점유 득실 −0.20) — 대부분 **탈취 직후 6초 창**에서(뺏은 팀이 전진 대신 짧게 지킴, 역습도 끌려감).
- **처방 B = K1**: C.79m 4차 식(패스 효용 += possess[성향] × 거리 가중 10 m 1→25 m 0 × 패서 자리 × 판단 p × (1−받는 순간 상실); 균형 0.008·티키·게겐·역습 4차 값·직선·블록 0, 지원 간격 12/25) + **`decide.possess.winOff` 6**(오픈 플레이 탈취 뒤 6초는 전 성향 점유 가치 0). 4칸 320 비점유 Δ −0.20 → −0.03.
- K1 그대로는 짧은 패스 성향 평균 15.9%(관문 16에 0.1 부족) → **시작 값 ×1.25(K1b): 균형 0.010 · 티키 0.022 · 게겐 0.010 · 역습 0.0125**(엔진관리자20이 ~09:05 K1b 결과를 AD에 보내면 마스터가 전달).
- C.79m 4차 코드를 가져와(cherry-pick 또는 그대로) winOff만 더하는 게 출발점.

## 관문(처방 A — 판정 규칙)
- 상성: 변형을 시드 41000·51000 두 벌(각 480) → `node scripts/diag/c79u-merge.cjs`(engine-manager-20 브랜치)로 합쳐 **960 대 `scripts/diag/c79u-main-960-matrix.json`**(같은 브랜치). ① 행 ±0.05(SE 안 초과 허용) + **비점유 3행(직선·블록·버스) 합 ≥ −0.08** ② 순환 G>T>D>B 양수 ③ 게겐>티키 SE 2배(0.09) 넘게 줄지 않음. 480 한 장의 칸·순환·RMS는 판정에 쓰지 않음.
- 짧은 패스: 성향 평균 0~10 m ≥ 16% · 티키 ≥ 20% · 직선·블록 늘지 않음(직선 롱 비율 유지) · 점유율 티키 > 균형 > 직선.
- 득점 1.48±0.05 · 이동 거리 · 장면 전부 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check. 공격 움직임 감소 아님(판단만).
- 상성 두 벌 = 약 180분(4코어) — 측정은 한 번에. 미달이면 조정 1회만, 그래도 미달이면 안 된 것 먼저 보고(미배포).

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). ENGINE_VERSION +1, PATCH_LABEL 'C.79u', STAGE '53단계'. 부록 C.79u, engine-issues 미해결 2 갱신.
- 예산 **4시간·18달러**. 끝나면 AD에 보고(안 된 것 먼저).
