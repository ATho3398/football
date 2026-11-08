너는 코드 세션 "44h단계_소극적 백패스 감점·위험 감수·결정 카드 기대값 (C.77s)"이다(Opus, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 엔진관리자9(session_01Br1jtc3FrJL9Xt3WmYFQwB)가 처방자 — 진단 불일치·중단선이면 거기에 묻는다. 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77s-passive-pass`(main 최신에서).

근거: 사용자 요청 pending 145(planning-z `docs/planning-pending.md` 145 — 마스터 초안 조건·예외·가중·크기) + 엔진관리자9 처방 `docs/engine-diagnosis-e4.md` **§9.16 세션 A**(브랜치 `claude/engine-manager-9` e243243 — main에 없으면 `git fetch origin claude/engine-manager-9` 뒤 `git checkout origin/claude/engine-manager-9 -- docs/engine-diagnosis-e4.md scripts/diag/moment-ev.ts scripts/diag/moment-policy.ts scripts/diag/backpass.ts scripts/diag/give-go.ts`). 먼저 §9.16 전체를 읽는다.
범위(엔진 행동·지문 불변 — AI 선택 규칙은 건드리지 않음, 그건 세션 B로 10/26 뒤):
- A1 소극적 백패스 평점 감점(145 조건·예외·가중·크기 그대로, `choose()`에서 같은 후보 풀 전진 패스 최대 p ≥ 0.65 + 압박 0일 때 `rt.passive++` 측정) — 평점 계산에만 반영.
- A2 상대 진영 위험 감수 실패(전진·침투·크로스·돌파) 평점 `lost` × 0.5.
- A3 결정 순간 카드에 기대 평점(optionValue) 한 줄 + 백패스 선택지에 "소극적 −0.05" 표시(기존 카드 컴포넌트 안에서, 새 디자인 없이).
관문·중단선은 §9.16 그대로: `moment-policy` safe ≤ attack − 0.5 유지 · `rating-parts 600` center 재측정(§9.12.7, NPC CB·CDM도 조건 만족 많음) · `engine:check` 평점 8군 6.3~6.7·σ·XP · `same-seed 30` 지문 불변 · 테스트. 중단선: center 재측정 뒤 CB/CDM < 6.3 → `passiveFree` 3, 그래도면 내 선수 전용으로.
**측정 운영**: main 병합 시작 1번 + 마지막 1번 · 무거운 측정 동시 2개까지 · balance:check는 마지막 1번 nohup(평점 가드에 걸리므로 생략 금지), 60분 안에 판정 없으면 다른 관문 통과 시 main 푸시하고 CI에 맡김 · 대기는 send_later 한 번 · 측정 결과는 scratchpad 파일로.
**main 푸시 순서**: C.77q(6f787fb) CI → C.77r(PWA) 푸시·CI가 끝난 뒤에만 main 푸시(취소 방지). 그 전엔 작업 브랜치에만.
예산: 2시간·약 8달러. PATCH_LABEL 'C.77s', STAGE_LABEL main 그대로, BALANCE_VERSION +1(ENGINE_VERSION 그대로 — 지문 불변이면). 세이브 이전 코드 금지(CLAUDE.md). 부록 C에 C.77s, pending 145에 A 완료 표시. 끝나면 마스터 Z에 보고(관문 표·평점 8군·moment-policy·테스트 수·커밋·시간·비용). CI 성공은 보내지 않는다.
