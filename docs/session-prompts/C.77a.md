너는 엔진 코드 세션 "44h단계_게겐프레싱 상성·대가 (C.77a)"이다(**Opus, 노력도 높음 — 엔진 Opus 1차**, 같은 문제로 Opus 2회 실패하면 Fable로 넘김). 마스터는 Y(session_01PgUwPFtt8b6h4UmF4SbRvY, 마스터 브랜치 claude/planning-y). 처방은 엔진관리자8(session_01DJK7MaPzJ2edGU3ywbiw3H, 브랜치 claude/engine-manager-8) — "해결 어려움·진단 불일치"는 엔진관리자8에 send_message(마스터에는 짧게). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1·2·3번 fix 규칙, 7번).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/engine-manager-8` 후 `docs/engine-diagnosis-e4.md` **§9.14 전체**(44h-h, 가설 1 체력 비용·2 압박 저항·3 뒷공간 방향 전환 비용, 상성표 관문) + §9.13.6(C.76z 결과 — loss() 무수정, 게겐 대 버스·역습 "지금" 값 갱신) → main 부록 C.76s·C.76z·C.77b·C.77d → `docs/engine-issues.md` 2·3.

사용자 의도: 게겐은 종결하지 않고 **"티키타카엔 세지만 단점이 명확한 전술"**. 실축 상성(Y 정리, 사용자 확인 대기 중이지만 게겐 행은 §9.14와 같음): 게겐 > 티키타카 · 게겐 ≈ 균형 · **게겐 < 역습 · 롱볼(직선) · 버스** · 게겐 ≈ 블록. 대가 = 많이 뛰어 후반에 지침(75'+ 득실 ↓), 높은 라인 뒤 공간을 역습에 내줌, 내려앉는 팀은 압박을 풀어냄.

범위(§9.14 순서, 가설마다 커밋 1개): 가설 1 체력 비용(sim.ts) → 가설 3 뒷공간 방향 전환 비용(onball.ts candidates `raceTurnBack`, 역습 고유 상수 2개) → 가설 2 압박 저항(onball.ts passProbability 능력치 반응 `pressResist` + 라인 낮은 팀 `deepSafe`). 엔진 37(main 5b6b8b7, C.77d) 위에서 **시작할 때 상성표 기준선을 다시 잰다**(§9.14 "지금" 열은 엔진 33 값). 관문: §9.14 상성표(게겐 대 티키타카 +0.2~+0.5 유지 · 대 균형 ±0.15 · 대 역습 ≤ 0 · 대 버스·블록 ≤ +0.25 · 75'+ 게겐 득실 ≤ −0.10 · 역습 침투 수신 ≥ 25% · 게겐 상대 진영 탈취 대 버스·블록 ≤ 22) + 기록 행 **게겐 대 직선 ≤ +0.1**(실축 롱볼 > 게겐). 가드: §9.14 지킬 가드(quick 600 1.30~1.45 · Δ+8 1.8~2.4 · 같은 시드 scoring 30골+ 0.5~2.0(지금 1.10)·중앙값 25~35 · sweep 7×7 ≤ 1.0 · 선발 끝까지 뛴 선수 이동 7.5~8.5 km · tac bus 실점 ≤ 1.55 · engine:check 경량 가드 · 지문 변경 기록). 결과 할당·고무줄 금지(체력·능력치 반응·물리 비용·성향 고유 상수만).

**측정 운영(꼭 지킬 것)**: ① main 병합은 시작 1번 + 마지막 검증 직전 1번만 ② 무거운 측정(tactic-pair 200·scoring·sweep·quick 600·balance:check)은 동시에 2개까지 ③ balance:check는 마지막에 1번, `nohup … > log 2>&1 &`. 60분 안에 판정이 없으면 다른 관문이 모두 통과한 경우에 한해 main 푸시하고 CI에 맡김(실패하면 네가 처리) ④ 대기는 send_later 한 번으로(짧은 sleep 루프 반복 금지).

예산: 3시간·약 15달러(Opus). PATCH_LABEL 'C.77a', STAGE_LABEL main 그대로, ENGINE_VERSION·BALANCE_VERSION은 푸시 직전 main +1. 부록 C에 C.77a, engine-issues 2·3 갱신. 엔진관리자8 docs는 git merge로.
완료·실패면 마스터에 보고(가설별 상성표 전후·관문·지문·테스트 수·커밋·걸린 시간·비용). CI 성공은 보내지 않는다(실패만).
