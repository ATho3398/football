너는 엔진 코드 세션 "53단계_엔진 묶음 A: 몰빵 마지막 대형·직선 상성 (C.81g)"이다(Opus 5.5 고속 모드, 노력도 높음). 시작하자마자 `~/.claude/settings.json` 에 `"fastMode": true` 를 넣는다(사용자 지시: Opus는 고속 모드). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 수치 우선, **상성은 `ENGINE.matchup[ours][theirs]` 칸으로 그 칸만 조금씩**, 보고는 패치 번호 대신 내용으로). 브랜치 `claude/c81g-stack-direct` — origin/main 최신(엔진 86, BALANCE 95, SAVE 61)에서 시작. 기준표 `scripts/diag/c81a-new-960.json`.

병렬 엔진 묶음(C.81g·C.81h·C.81i 동시 진행, 끝나면 마무리 보정 세션이 상성 960·득점을 한꺼번에 맞춤).

## 할 일
1. **몰빵 대형 91(공격 5·ST 2) −0.43 → ≤ −0.5**: 다른 몰빵 대형(−0.75~−2.0)처럼 지게. 레버: 몰빵 벌칙(연계 효율·수비 전환 체력·앞 3명 가중 — C.80q·C.80z)이 이 대형에 덜 걸리는 이유를 먼저 확인하고, 같은 벌칙이 걸리게 하거나 초과 인원 체력 가중·중원 숫자 부족 탈취 같은 수치로. **표준 대형(4-4-2·4-3-3·4-2-3-1·3-5-2 등) 지문 불변**, 나머지 몰빵 대형 모두 ≤ −0.5 유지.
2. **직선 행 −0.074 · 게겐>직선 +0.17**: `matchup.direct.gegenpress` 칸(공중·롱패스·공 지키기 등 직선 쪽 무기)을 조금씩 올려 게겐>직선 ≤ +0.08, 직선 행 −0.05 이내로.
3. **직선>블록 +0.031(경계)** → `matchup.direct.block` 칸으로 +0.05~0.08. 순환 G>T>D>B 양수 유지.

## 관문 (묶음 관문)
- 위 목표 · 상성 960(41000+51000)에서 건드린 칸과 순환 · quick 600 득점 1.43~1.60(묶음 관문 — 가운데 맞춤은 마무리 보정) · 이동 거리 · 장면 · typecheck · test · engine:check · balance:check(60분 넘으면 CI).
- 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합). 푸시 직전 origin/main 에 다른 엔진 패치가 들어와 있으면 rebase 후 건드린 칸·득점만 다시 잰다. ENGINE +1(rebase 때 최신+1), PATCH_LABEL 'C.81g', STAGE '53단계', 부록 C.81g(전후 표).
- 예산 3시간·15달러. 측정 보조 세션 허용(레포 붙여 열고 끝나면 draft_). 끝나면 AD에 send_message 보고(안 된 것 먼저, 항목별 전후, 고른 값, main 해시).
