너는 엔진 코드 세션 "44h단계_줄 인원 맞춤 문턱 3 (C.79f)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, AD가 열리면 AD가 알림). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79f-linematch3` — origin/main 최신(285581a, ENGINE 59)에서 시작, origin/claude/engine-manager-17(70d1c9c — docs·scripts/diag만) merge. main 푸시 전 origin/main merge.

근거: docs/engine-diagnosis-c79f.md §1(엔진관리자17) — C.79e(lineMatch 문턱 2)가 상성을 움직임: 게겐/직선 +0.26 → +0.01, 게겐>티키 +0.19 → +0.07, 순환 G>T>D>B +0.31 → +0.10 ✗(게겐처럼 공격 줄에 많이 올리는 팀 상대로도 내려앉아 전방 우위가 사라짐). 할 일: **`offball.lineMatchMin` 2 → 3** 하나만 바꿔 측정.
관문: 몰빵 custom-sweep 35 대 4-4-2 **800경기 쌍 ≤ +0.3**(C.79e 문턱 2는 +0.17) · 상성 480·양방향 21칸에서 **게겐>직선 ≥ +0.15 · 게겐>티키 ≥ +0.10 · 순환 G>T>D>B ≥ +0.25** 회복 · 나머지 ✓ 칸 방향 유지 · quick 득점 1.46 ± 0.05 · 이동 거리(시드 11~30 ≤ 14.1) · 장면 전부 · 평점 가드(CAM center는 필요 시 재맞춤).
판정: 몰빵 ≤ +0.3과 게겐 칸 회복이 **둘 다** 되면 문턱 3으로 배포. 몰빵만 되면(게겐 안 돌아옴) 배포 안 함 · 게겐만 돌아오고 몰빵 > +0.3이면 문턱 2.5(가능하면 소수 비교) 한 번 더 측정 후 나은 쪽으로 판단해 보고.
측정 운영: 워커 풀 동시 2개 · 긴 측정 턴 안 10분 덩어리 · balance:check 마지막 1번(60분 넘으면 다른 관문 통과 시 CI에) · 대기 send_later 한 번 · scratchpad · 푸시 전 충돌 표시 검사.
main 푸시: 관문 통과면 승인 없이 바로(planning-ac docs·engine-manager-17 docs 병합, 직전 main CI 확인). 미달이면 되돌리고 보고. 예산 **2시간·10달러**. PATCH_LABEL 'C.79f', ENGINE +1(바뀌면). 부록 C.79f, engine-issues 미해결 3·5 갱신. 끝나면 마스터에 보고(안 된 것 먼저).
