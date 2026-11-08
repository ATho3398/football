너는 엔진 코드 세션 "44h단계_가드 재정의·평점·되돌리기 (C.78r)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, 마스터 브랜치 claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 "판단 보정 원칙"·"자동 진행·멈춤 조건" 필독). 작업 브랜치 `claude/c78r-guards` — **origin/main 최신(C.78q, ENGINE 54)에서 시작**. main 푸시 전 origin/main merge.

배경(사용자 2026-10-27 "추천대로"): 득점 총량은 **팀당 1.48로 마무리**(더 내리지 않는다, 지금 값을 새 기준으로). 먼저 읽기: 부록 C.78p·C.78q, docs/planning-handoff.md 8.62(현재 수치·완화 중 항목).

할 일 (순서대로):
1. **12 m 밖 선방 가드 재정의**: 지금 87%(목표 범위 밖)는 판단 보정(C.78p) 뒤 GK가 자리 잡은 중거리 슛을 더 많이 고르게 된 **선택 효과**가 섞인 값이다. 가드를 "선택 효과를 뺀" 정의로 바꾼다 — 예: 슛 상황(거리·각도·GK 위치·압박) 구간별 선방률 또는 같은 상황 묶음으로 보정한 선방률, 실축 기준과 비교 가능한 형태. 정의·근거·새 범위를 부록에 쓰고 `balance:check`/`engine:check` 가드 코드를 고친다. 실행 레버(선방 계산)는 건드리지 않는다. 새 정의로도 밖이면 원인만 보고(이번에 고치지 않음).
2. **평점 포지션 가드 6개 ✗**: 득점 총량이 확정됐으니 평점 계수를 분해해 맞춘다(포지션별 평균·σ 가드, `src/config/balance.ts` 평점 계수만, 엔진 동작 불변). BALANCE_VERSION +1.
3. **되돌리기(로드맵 마지막 단계)**: ① `tests/engine.test.ts` 이동 거리 상한 14.5 → 14 km(통과 못 하면 원인 시드·선수·규칙을 보고하고 14.5 유지 — 상한을 위해 움직임을 줄이지 않는다, 공격 움직임 줄이는 처방은 사용자 확인 필요) ② `.github/workflows/pages.yml` 의 `balance:check`·`balance:engine:check` `continue-on-error: true` 제거(배포 차단 복구) — 1·2가 통과해 로컬 balance:check·engine:check가 초록일 때만. 성장·재정 등 엔진 밖 가드도 같이 초록인지 확인, 빨간 게 남으면 그 항목 목록을 보고하고 차단 복구는 보류.

가드: 장면 전부 · 득점 총량 1.48 ± 0.05 · Δ±8 · 득점 분포 · engine:check · 결정성 · 순간이동 0 · 경기 계산 2초.
**측정 운영**: ① main 병합은 시작 1번 + 마지막 검증 직전 1번 ② 무거운 측정 동시 2개 ③ balance:check는 마지막 1번 nohup, 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 ④ 대기는 send_later 한 번. scratchpad. 푸시 전 충돌 표시 검사.
**main 푸시**: 마스터 AC "푸시 ㄱ" 뒤(origin/claude/planning-ac의 docs/ 병합). 1·2·3 중 통과한 것만 넣고 나머지는 되돌려 보고.
범위 밖: 전술 상성(다음 패치), 미해결 3·4·5, 짧은 패스 비중, UI.
예산: **3시간·15달러 넘기지 말 것**. PATCH_LABEL 'C.78r', STAGE_LABEL 그대로, ENGINE_VERSION 그대로(엔진 동작 불변이면), BALANCE_VERSION +1. 세이브 이전 코드 금지. 부록 C.78r, engine-issues 로드맵 마지막 단계 갱신. 준비 완료·부분·실패면 AC에 send_message로 보고(항목별 전후표·가드 표·장면·테스트·커밋·시간·비용). CI 성공은 보내지 않는다.
