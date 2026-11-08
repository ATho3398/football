너는 엔진 코드 세션 "53단계_내려앉기 유지·복귀 조깅 (C.79t)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄, 엔진 세션 측정 운영 4줄). 작업 브랜치 `claude/c79t-linematch-keep` — origin/main 최신에서 시작, main 푸시 전 origin/main merge.

근거: 사용자 결정 "결함 먼저 고치고"(10/30 01:2x) — C.79k(main 1d1beb7)는 결함 ①(Flight)만 켜고 결함 ②(유지 끊김, lineMatchKeep 0.3)는 이동 거리 한 선수 15.03 km ✗로 꺼 둠 → 몰빵 800 +0.32 ✗. 처방 M2 = 엔진관리자19 `docs/engine-diagnosis-c79l.md` §6(origin/claude/engine-manager-19), 65%:
- Keep의 +0.2 km는 내려온 CM(박스투박스)이 **우리 공이 되면 공격 자리로 전력 복귀**하는 질주. → **복귀 조깅**: 내려와 있다가 우리 공이 되면 4 s 동안 공격 자리 복귀를 서두르지 않음(`offball.lineMatchJog` 3 · `lineMatchJogReturn` 4, updateOffball 공격 분기 2줄 + 내려온 시각 WeakMap — `scripts/diag/c79l-switches.patch` 그대로). Keep 0.3과 같이 켬. 8 s는 다시 15.02 ✗ — 4 s.
- 엔진관리자19 수치: 이동 거리 최다 평균 13.92 · 한 선수 14.45 ✓ · 몰빵 35 800 +0.25 ✓ · base 쌍 합계 2.30.
- 다른 실험 스위치는 가져오지 않음. ENGINE_VERSION +1.

## 관문
- 이동 거리 시드 11~30 평균 ≤ 14.1 km·한 선수 < 15 · 몰빵 35 대 4-4-2 800 ≤ +0.3 · base 쌍 합계 2.3±0.15 · **상성: C.79k에서 움직인 역습/직선(+0.26→+0.11)·티키/역습(+0.05→−0.09) 칸을 다른 시드 묶음 960으로 재확인**(엔진관리자18 규칙) + 행 ±0.05 · 득점 1.48±0.05 · 장면 39/39 · typecheck · test · balance:check(로컬 60분 넘으면 CI) · engine:check. 공격 움직임 감소 아님(수비 복귀 속도만).

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인, 다른 엔진 세션이 먼저 main에 있으면 merge 뒤 재측정). PATCH_LABEL 'C.79t', STAGE '53단계'. 부록 C.79t, engine-issues 미해결 5 갱신.
- 예산 **2시간·10달러**. 끝나면 AD에 보고(안 된 것 먼저).
