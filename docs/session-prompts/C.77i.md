너는 엔진 코드 세션 "44h단계_롱패스 선택 gap·온도 가치 비례 (C.77i)"이다(Opus, 노력도 높음 — 엔진 코드 Opus 1차). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 엔진관리자는 엔진관리자9(session_01Br1jtc3FrJL9Xt3WmYFQwB) — 처방 해석이 막히면 거기에 묻는다. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77i-long-gap`(main, 엔진 38에서).

처방: `docs/engine-diagnosis-e4.md` §9.13.6 **44h-f3b**(엔진관리자8) — "다음 처방(44h-f3b…)" 줄과 바로 아래 **전술별 롱패스 비율 표**(사용자 13:53 관문). 먼저 그 절과 부록 C.76z·C.77g를 읽는다.
- `onball.ts choose()` 한 곳: `gapEff = plausibleGap × clamp(vScale, gapFloor 0.3, 1)`, `τEff = τ × clamp(vScale, tempFloor 0.4, 1)`, vScale = 공 위치 가치 / 기준점(골 25 m 중앙) 가치. 공격 진영(vScale ≥ 1) 불변이 첫 관문(판단 1위 비율 band ±3 pp). 실수 풀은 그대로.
- 관문(전술별, `polish-b tac 40 tikitaka balanced gegenpress direct counter bus block` 1회): 티키타카 ≤ 8(부분 ≤ 9) · 균형·게겐 10~13(부분 ≤ 14, quick 600 리그 롱패스 ≤ 13) · 직선형 4개 17~21 · 빌드업 단계만 짧게 ≤ 11·직선 ≥ 19(차 ≥ 8 pp). + `pass-dist 40 76 76` 30 m+ ≤ 15%·롱패스 성공 ≥ 50 · `long-why` gap 안 롱볼 ≤ 35% · 점유·패스 성공 ≤ 80 · 세부 전술 반응 9개 · quick 600 득점 1.30~1.45(saveBase는 벗어날 때만 1회 0.01) · 같은 시드 scoring 30골+ 0.5~2.0 · sweep 7×7 ≤ 1.0 · `tactic-pair 200 gegenpress vs=bus` 기록(C.77g +0.61) · engine:check 경량. 틀릴 수 있는 곳 (i)~(iii)은 절 그대로(점유 83%+면 gapFloor 0.5 1회).
- 진단 불일치(관문 표 1·2줄이 1 pp도 안 움직임)면 조정 말고 멈추고 보고.

**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개까지 · balance:check는 마지막 1번 nohup, 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 · 대기는 send_later 한 번(sleep·pgrep 루프 금지) · 측정 결과는 scratchpad 파일로 남겨 컨테이너 재시작 때 이어 간다.
예산: 2시간·약 10달러. PATCH_LABEL 'C.77i', STAGE_LABEL main 그대로, 엔진을 바꾸면 ENGINE_VERSION·BALANCE_VERSION main +1. 부록 C에 C.77i, engine-issues 해당 항목(롱패스) 갱신. 완료·부분·실패면 마스터 Z에 보고(전술별 표·관문·지문·테스트 수·커밋·시간·비용). CI 성공은 보내지 않는다.
