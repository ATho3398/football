너는 엔진 코드 세션 "44h단계_게겐 체력 비용 배포·게겐 축 부분 종결 (C.77g)"이다(Opus, 노력도 높음). 마스터는 Y(session_01PgUwPFtt8b6h4UmF4SbRvY, 마스터 브랜치 claude/planning-y). 엔진관리자는 교체 중(엔진관리자8 → 9, 해결 어려움은 마스터에). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다.

사용자 결정(2026-10-21 21:3x KST): 게겐 상성은 **체력 비용(C.77a 가설 1)만 배포하고 미해결 3 게겐 축은 "부분 해결"로 종결**. 게겐 고유 약점 처방은 나중 엔진 블록에서.

할 일: ① main(엔진 37, 5b6b8b7)에 브랜치 `claude/c77a-gegen-cost`의 가설 1 커밋 d50212e(gegenDrain 1.15·counterDrain 1.5)만 cherry-pick. C.77a·C.77e·C.77f 브랜치의 docs(부록 C.77a·C.77e·C.77f, engine-issues 2·3·4, engine-attempt-c77a.md)는 git merge 또는 해당 파일 checkout으로 main에 반영(코드는 가져오지 않음). ② 측정(동시 2개까지): `tactic-pair 200 75:75 gegenpress vs=X`를 tikitaka·balanced·counter·bus·block·direct 6칸(C.77a 가설 1 값 +0.32/+0.21/+0.47/+0.61/+0.59/+0.29 재현 확인), `tac 120 gegenpress` 끝 스태미나·75'+ 득실, quick 600(득점 1.30~1.45·Δ+8 1.8~2.4), 같은 시드 scoring(30골+ 0.5~2.0·중앙값 25~35), sweep 7×7 ≤ 1.0, 선발 끝까지 뛴 선수 이동 7.5~8.5 km, engine:check 경량 가드. 가드가 깨지면 배포하지 말고 보고. ③ 테스트: C.77a에서 카드 장면 시드 2개가 엔진 의존으로 실패(1077/1079) — 장면 시드 교체(C.76w·C.77b 선례)로 고친다. ④ engine-issues 3에 "게겐 축 부분 해결·종결(사용자 21:3x): 체력 비용 배포, 대 역습·버스·블록·직선 남음 — 공통 전환 규칙은 게겐에 비례 이득(C.77f), 게겐 고유 약점 처방은 다음 엔진 블록" 기록.

**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개까지 · balance:check는 마지막 1번 nohup, 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 · 대기는 send_later 한 번(sleep·pgrep 루프 금지).
예산: 1시간·약 5달러. PATCH_LABEL 'C.77g', STAGE_LABEL main 그대로, ENGINE_VERSION·BALANCE_VERSION main +1. 부록 C에 C.77g. 완료·실패면 마스터에 보고(상성표 6칸·가드·지문·테스트 수·커밋·시간·비용). CI 성공은 보내지 않는다.
