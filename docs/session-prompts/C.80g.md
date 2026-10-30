너는 엔진 코드 세션 "53단계_땅볼 롱패스 수신 경합 (C.80g)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 표준 레버 직접 처방, 판단 보정 원칙, 상성 960·칸 관문 보정, 병렬 묶음 득점 1.43~1.60). 브랜치 `claude/c80g-contest-out` — origin/main 최신에서, **main 푸시는 AD가 차례를 알릴 때**(지금 순서 C.80d → C.79x → C.80e → C.80f → C.80g, 앞 푸시 뒤 merge·재확인).

근거: 사용자 질문(10/30 17:1x) "티키는 작고 기술 좋은 선수 전용인데 왜 롱패스도 잘 받나" — 엔진관리자24(`docs/engine-diagnosis-c80g.md`, origin/claude/engine-manager-24): 티키 20 m+ 패스의 78%가 20~30 m **땅볼**이고 **땅볼 수신식에 받는 선수 능력치·받는 순간 수비 거리가 없음**(수비 2.8 m 안 76% 대 8 m 밖 85%, 작은 기술형=크고 느린 선수). 처방:
- **②-1(권장, 70%) 박스 밖 땅볼 20 m+ 수신 경합**: `ENGINE.prob.contestOut` 1 · `contestOutFrom` 20 m · `contestOutDist` 3 m — 박스 안 `receiveWin`(볼컨 .5 + 근력 .3 + 민첩 .2 대 마킹 .5 + 태클 .3 + 수비 위치 .2, +0.5)을 20 m+ 땅볼 패스 착지 때 3 m 안 상대 필드 선수가 있으면 적용, 판단(`candidates`)도 같은 식. 코드는 engine-manager-24 브랜치 actions.ts resolveFlight·onball.ts candidates·config.ts 스위치(기본 0) 그대로 가져와 기본값만 켬. 기제: 수비 붙은 땅볼 받음 76→58%, 25 m 땅볼 CB 2 m 안 작은 기술형 63% 대 크고 느린 46%, 티키 대 게겐 −0.16→−0.40(C.80c 게겐 선제 마크와 맞물림).
- **②-2(보조, 55%) 공중 롱볼 경합 반경** `prob.airContestFar` 3 m·`airContestBias` 1.5 — 직선 행이 ±0.05 벗어나면 이것만 뺀다(C.80e 직선 공중 보너스와 겹침).
- ① 먼 후보 지역 커버는 기각(이미 덮여 있음).
- 엔진관리자24 최종 보고가 오면 마스터가 수치 전달.

## 관문
- 티키 20 m+ 받음률 ≤ 다른 성향 · 게겐>티키 커지는 방향(4묶음) · **티키 행: 설계 방향이라 −0.10까지 허용**(그보다 내려가면 contestOutDist 2.5 m로 1회 조정, 그래도면 기록·보고) · 다른 행 ±0.05(SE 허용) · 순환 G>T>D>B 양수 · 득점 1.43~1.60 · 이동 거리 · 장면 · typecheck · test · balance:check(60분 넘으면 CI) · engine:check.
- 통과하면 차례에 main 푸시. ENGINE +1(merge 순서대로), PATCH_LABEL 'C.80g', STAGE '53단계', 부록 C.80g. 예산 2.5시간·12달러. 끝나면 AD에 보고(안 된 것 먼저).
