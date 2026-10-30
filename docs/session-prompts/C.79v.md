너는 엔진 코드 세션 "53단계_내려앉기 유지·복귀 조깅 2 (C.79v)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79v-linematch-keep2` — **origin/claude/c79t-linematch-keep(1a4e4b3)에서 시작**, origin/main(지금 66b80c9 = C.79s, ENGINE 61) merge, main 푸시 전 다시 merge(같이 도는 C.79q는 offball laneGuess, C.79u는 onball — 겹치면 merge 뒤 재측정).

근거: C.79t(Keep 0.3 + 복귀 조깅 4 s)는 이동 거리·몰빵 +0.25·행·순환·balance:check 19/19 통과, **게겐>티키 +0.18→+0.03** 하나로 미배포(부록 C.79t·브랜치 기록). 엔진관리자20 §7(docs/engine-diagnosis-c79u.md, origin/claude/engine-manager-20): **게겐 성향 팀만 Keep·조깅 제외(`offball.lineMatchKeepSkip` 비트 1)** → 게겐>티키 640 평균 +0.17(main +0.18, 두 시드 다). 역압박 창 조건은 효과 0. 패치 `scripts/diag/c79u-c79t-keepskip.patch`(C.79t 위, 기본 0) → **기본 1로 켬**, ENGINE_VERSION +1(merge 순서대로 다음 번호).

## 관문(엔진관리자20 판정 규칙)
- 상성: 시드 41000·51000 두 벌(각 480) → `node scripts/diag/c79u-merge.cjs` 960 대 main 960(`scripts/diag/c79u-main-960-matrix.json`, 단 main이 C.79s로 바뀌었으니 C.79s의 960 결과가 있으면 그걸, 없으면 그대로) — 행 ±0.05(SE 안 초과 허용)·순환 G>T>D>B 양수·**게겐>티키 SE 2배(0.09) 넘게 줄지 않음**.
- 이동 거리 시드 11~30 평균 ≤ 14.1·한 선수 < 15 · 몰빵 35 대 4-4-2 800 ≤ +0.3 · base 쌍 2.3±0.15 · 득점 1.48±0.05 · 장면 전부 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check.

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). PATCH_LABEL 'C.79v', STAGE '53단계'. 부록 C.79v(C.79t 기록 이어서), engine-issues 미해결 5 갱신.
- 예산 **2시간·9달러**. 끝나면 AD에 보고(안 된 것 먼저).
