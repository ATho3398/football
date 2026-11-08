너는 엔진 코드 세션 "44h단계_추적 갱신 간격·줄 대응 재측정 (C.77h)"이다(Opus, 노력도 높음 — 엔진 코드 Opus 1차). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 엔진관리자는 엔진관리자9(session_01Br1jtc3FrJL9Xt3WmYFQwB) — 처방 해석이 막히면 거기에 묻는다. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77h-track-refresh`(main d7f88d3, 엔진 38에서).

처방: `docs/engine-diagnosis-e4.md` §9.15.10 **44h-i2**(엔진관리자8). 먼저 그 절과 부록 C.77b·C.77g를 읽는다.
- 가설 1(주): `sim.ts` 오프볼 갱신 조건에 추적자 `offball.trackRefresh` 0.2초(GK `chaseRefresh` 자리와 같은 방식) + `trackTarget()` urgent 히스테리시스 `trackUrgentOff` 0.8 m(켜짐 `trackUrgent` 2 m 그대로).
- 가설 2(보조): 박스 안 `trackGap` 1.5 → 2.0 A/B 1회. ≤ 1.5 m가 33% 아래로 떨어지면 1.5 유지·기록.
- 가설 3(조건부): 가설 1 뒤 `lineTiers` 1로 같은 시드 scoring(출전율 켬, 지금 기본) 1회 — 30골+ ≤ 2.0 · MID 최다 ≤ 22 · ST 압박 속 슛 ≥ 88 · quick ST ≤ 36이면 켠 채 배포, 아니면 0 유지·기록.
- 총량: `keeper.saveBase`는 C.77d가 이미 1.63으로 내림 — 엔진 38 기준선 quick 1.40이라 보정은 범위(1.30~1.45)를 벗어날 때만 1회(E.23 4번).
- 통과 기준은 §9.15.10 "통과 기준(44h-i2)" 그대로(runner-track 40 ≤ 1.5 m ≥ 36% 등). 추가 가드: 게겐 상성표가 C.77g 값(대 티키 +0.32·역습 +0.47·버스 +0.61)에서 ±0.15 넘게 움직이면 기록·보고. 진단 불일치(가설 1 뒤 ≤ 1.5 m가 29 ± 3)면 조정 말고 멈추고 보고.

**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개까지 · balance:check는 마지막 1번 nohup, 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 · 대기는 send_later 한 번(sleep·pgrep 루프 금지) · 측정 결과는 scratchpad 파일로 남겨 컨테이너 재시작 때 이어 간다(C.77g에서 재시작 2회).
예산: 1.5시간·약 8달러. PATCH_LABEL 'C.77h', STAGE_LABEL main 그대로, 엔진을 바꾸면 ENGINE_VERSION·BALANCE_VERSION main +1. 부록 C에 C.77h, engine-issues 8·11 갱신. 완료·부분·실패면 마스터 Z에 보고(관문 표·지문·테스트 수·커밋·시간·비용). CI 성공은 보내지 않는다.
