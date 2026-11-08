너는 엔진 코드 세션 "53단계_인버티드 윙어 약발 판정 (C.79q)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79q-weakfoot` — origin/main 최신에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79s가 keeper.ts·onball.ts shotModel 한 줄을 고침 — 겹치면 merge 뒤 재측정).

근거: 외부 피드백 R2(사용자 2026-10-30 03:1x "추천하는 대로 ㄱㄱ"). 마스터 확인(main 80f6277):
- `src/body.ts:113-127 weakFootMul`: 발을 **공 벡터의 공격 방향 기준 가로 부호만으로** 정함(`need = lat > 0 ? 'left' : 'right'`), |lat| 0.25~0.75 사이 감점(balance.ts:964-968), 약발 등급별 ×0.75~1.0(balance.ts:962). 오른쪽 윙에서 골로 가는 슛은 전부 왼쪽 방향 → "오른발 필요" → **왼발 인버티드 윙어가 거의 모든 각도 슛에 감점**, 오른발 정통 윙어는 감점 없음(실축과 반대: 인버티드는 안으로 파고들며 주발로 감아 참).
- 쓰는 곳: 슛 실행 actions.ts:472-476 · 판단 xG onball.ts:387-388·407-408·429 · 크로스·롱볼 actions.ts:678·722, onball.ts:1215.
- `laneGuess`(offball.ts:1229-1252, 사용 :1352·:1362): 수비가 슛 코너를 weakFootMul + 몸 방향 laneFace 0.1 + GK에서 먼 쪽 laneGk 0.05로 고르고, 동점이면 "주발 쪽(오른발 = 공격 방향 왼쪽)" — 오른쪽에서 왼발잡이는 두 코너 다 약발로 보고 동점 처리 → 니어로 읽어 파 포스트 감아 차기를 못 읽음.

## 할 일 (추천: **슛과 laneGuess만**, 크로스·롱볼은 그대로)
- 슛의 발 결정을 "공 진행 방향 가로 부호"가 아니라 **몸 방향·볼 위치(공이 어느 발 쪽에 있나)·이동 방향**으로: 몸 앞 공을 주발 쪽으로 옮겨 찰 시간이 있으면 주발(안으로 치고 들어와 감아 차기), 급할 때(압박·원터치·발리)만 공 위치에 따른 발. 인사이드 감아 차기(주발로 반대쪽 코너)도 주발 슛으로.
- 판단 xG도 같은 함수(판단 = 실행). laneGuess는 같은 발 판정 + 주발 감아 차기 코너(파 포스트)를 읽는 쪽으로, 판단력 따라 오독(laneMiss 그대로).
- 크로스·롱볼은 이번 범위 밖(weakFootMul 시그니처를 나누거나 슛 전용 함수로).

## 관문
- 측정 표: 역할별(인버티드 윙어·정통 윙어·인사이드 포워드·ST) 슛의 약발 비율·유효율·득점, 주발 왼발/오른발 × 측면 4칸 — 인버티드의 약발 비율이 정통보다 낮거나 비슷해져야.
- 득점 1.48±0.05 · 윙어 득점 비율·역할 득실(엔진 체크 가드) · 장면 테스트 전부 · 상성 = **41000+51000 960 평균 대 main 960**(main 51000 기준표 origin/claude/engine-manager-20 scripts/diag/c79u-main-s51-matrix.json), 행 ±0.05(SE 안 초과 허용)·순환·게겐>티키 SE 2배 넘게 줄지 않음 · 이동 거리 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check.

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). ENGINE_VERSION +1, PATCH_LABEL 'C.79q', STAGE '53단계'. 부록 C.79q.
- 예산 **2.5시간·12달러**. 끝나면 AD에 보고(안 된 것 먼저).
