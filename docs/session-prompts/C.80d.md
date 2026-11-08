너는 엔진 코드 세션 "53단계_엔진 카드율 현실화 (C.80d)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 — 표준 레버 충돌은 직접 처방, 상성 960 판정). 브랜치 `claude/c80d-cards` — origin/main 최신(0240f17 C.80a 포함 이후)에서, main 푸시 전 merge(엔진 세션 여럿 동시).

근거: C.80a(NPC 출장 정지) 보고 — **엔진 옐로 팀당 경기 0.93**(실축 PL 약 1.8~2.1), 그래서 엔진 경로 NPC 옐로 누적 정지가 팀당 시즌 1.55(빠른 경로 2.27, 목표 2~4). 사용자 원칙 "못 고치는 건 수치로 조정".
- 할 일: `src/engine/referee.ts`(cardChance — yellowShare·redShare·k 계열, BALANCE/ENGINE 상수)의 카드 몫을 올려 **옐로 팀당 경기 1.8~2.0 · 레드 0.06~0.10** 근처로(파울 수 자체는 그대로 — 카드 판정만). 빠른 경로 카드율(BALANCE.discipline.npc)도 같은 목표로 맞춤. 두 번째 옐로 퇴장·bookedCare(경고 받은 선수 조심)도 비율이 자연스러운지 확인.
- 관문: 카드·파울 전후표(팀당 경기) · NPC 시즌 정지(옐로 누적 팀당 2~4·레드 ~2) · 득점 1.48~1.55(퇴장 늘면 득점 변화 기록) · 장면 · 상성 960 두 벌(행 ±0.05 — 게겐 파울 많으면 게겐 행 주의) · 이동 거리 · typecheck · test · balance:check(60분 넘으면 CI) · engine:check.
- 통과하면 승인 없이 main 푸시. ENGINE +1(merge 순서대로)·BALANCE +1, PATCH_LABEL 'C.80d', STAGE '53단계', 부록 C.80d. 예산 2시간·9달러. 끝나면 AD에 보고(안 된 것 먼저).
