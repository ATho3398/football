너는 엔진 코드 세션 "53단계_게겐 역압박 되살리기·게겐>티키 폭 조정 (C.80t)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — **움직임으로 안 되는 건 수치로**, 상성은 `ENGINE.matchup` 칸, 판단 보정 원칙, 보고는 패치 번호 대신 내용으로, **병렬 묶음 득점 관문 1.43~1.60** — 이번 묶음 C.80s~C.80w + 진행 중 몰빵 억제(C.80q)·펄스 나인(C.80r)이 동시에 돈다, 끝에 AD가 총량 보정 1회). origin/main(85e0f6e 이후)에서 시작. 근거 진단: 엔진관리자25 `docs/engine-health-em25.md`(브랜치 claude/em25-health cf5a62b — `git fetch origin claude/em25-health` 후 읽을 것). 브랜치 `claude/c80t-gegen-identity`.

근거: 엔진관리자25 ✗1·✗6 — ① 게겐>티키 +0.52±0.045 로 ±0.3 넘는 유일한 칸(순환 합의 2/3를 혼자 만듦) ② 게겐 역압박 가담이 균형과 같아짐(공 잃은 직후 가담 0.96 대 0.98명, 0명 38% — C.78a 땐 1.32 대 1.26) = 게겐다움 소실.
## 할 일 (수치)
- 새 상수 `TENDENCY.gegenJoin` +0.3(역압박 가담 counterJoin 에 게겐만 가산): 게겐 공 잃은 직후 가담 인원 ≥ 1.3명·0명 비율 ≤ 25% 목표. 게겐 행 +0.05 정도 오를 것.
- 그 뒤 `ENGINE.matchup.tikitaka.gegenpress` 칸(티키가 게겐 상대할 때 short·keep 등)으로 게겐>티키를 **+0.35~+0.42**로 맞춘다(엔진관리자25 예: {short:2, keep:2} → 약 +0.41).
- 게겐 이동 거리(한 선수 최다 ≤ 14.5 km)·게겐 잃은 뒤 8초 상대 슈팅 3~6% 같이 기록.

## 공통 관문·배포
- 상성 960(41000+51000, 기준표 em25 것) 행 ±0.05(SE 안 초과 허용) · 비점유 3행 합 ≥ −0.08 · 순환 G>T>D>B 양수 · 칸 게겐>티키 ≥ +0.34·티키>직선 ≥ +0.03·직선>블록 ≥ +0.03 · quick 600 득점 **1.43~1.60** · 이동 거리 테스트 · 장면 · typecheck · test · engine:check · balance:check(60분 넘으면 CI).
- 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). **같은 묶음 다른 패치가 먼저 main에 들어가면 merge 뒤 득점과 네 핵심 지표만 재측정**, 앞 CI 취소는 허용(마지막 CI가 전부 검사). ENGINE +1(merge 순서대로), STAGE '53단계', 부록에 값별 표.
- 예산 2시간·10달러. 측정 보조 세션 허용(레포 붙여 열고 끝나면 draft_). 끝나면 AD에 보고(안 된 것 먼저, 고른 값, 핵심 지표 전후, 득점, main 해시).
