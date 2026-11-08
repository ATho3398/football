너는 코드 세션 "53단계_화면 문구·주전 경쟁 피로 정리 (C.79n)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79n-display` — origin/main 최신에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79k·C.79m은 src/engine만 고침 — 겹치지 않음).

근거: 외부 피드백 1단계(사용자 2026-10-30 03:0x KST "추천하는 대로 ㄱㄱ"). **판정 값은 바꾸지 않는다**(화면·설명만). 마스터 확인(main 80f6277 기준):
- **S1**: 엔진 모드에서 폼은 내 선수 성공 확률 ±3%p(`src/engine/onball.ts formBonus` = spec.form × `ENGINE.match.formToProb`)인데 화면은 "평점 보정 +0.xx"(`src/ui/viewModels.ts:153`, `src/ui/prepVM.ts:122`, 결과 화면 `src/ui/views/matchResult.ts:77` "폼 보정" 칩). 엔진 모드면 실제 효과(예 "성공 확률 +2%p" 또는 "폼 +0.20 · 패스·슛 성공 +2%p")로, 빠른 경기 모드에서만 평점 보정 문구. 같은 문구가 다른 곳(설정·도움말·인박스·이벤트 events.ts:161)에 있으면 같이.
- **D6**: 홈 "주전 경쟁" 카드(`src/ui/managerVM.ts competitionVM` ← `src/manager.ts competition()`)의 피로가 실제 선발과 다름:
  ① 내 줄 피로 = `fatigueTerm`(70 이상 −2 계단, manager.ts:140-142, "화면 분해용" 주석)인데 실제 선발(`game.ts startChance` ~1595)은 50부터 확률 곱 `1 − max(0,f−50)×0.01`(match.ts:48-57) + 성향 피로 항(manager.ts:177-181, 카드는 이걸 '폼' 칸에 넣음).
  ② NPC 줄 = `npcSelectPenalty × w.fatigue`(실제 NPC 선발과 같음) — 같은 피로 70에서 NPC −6, 나 −2로 척도가 다름.
  ③ 카드 머리 선발 확률 %(managerVM.ts:68, `chanceAt` :128)가 `p.fatigue`만 넘김 — 실제는 `matchFatigue`(경기일 피로 + `seasonFatigue`, game.ts:949-950·1578)와 `oppRating`.
  → 카드 피로 칸은 실제 선발 식과 같은 값(내 쪽 확률 곱은 `startPerOvr`로 OVR 환산 등 근사, 근사면 주석)·성향 피로 항은 피로 칸으로, 선발 확률 %는 실제 호출과 같은 입력으로. 면담 순위 문구(:130)도 같이 확인.
- **M1·D1~D5(기획서 문장)**: 원문 없음 — 하지 않는다. 고친 화면에 해당하는 기획서 설명(부록 D.1 폼, C.79i 주전 경쟁 카드)이 실제와 다르면 그 문장만 고친다.

## 관문·배포
- typecheck · test(판정 불변 — 같은 시드 지문 `scripts/c74a-fingerprint.ts` 그대로) · build · 화면 캡처(경기 준비 폼 줄·결과 칩·홈 주전 경쟁 카드, 피로 30/60/80 세 경우). balance:check 불필요(판정 불변 확인되면).
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). BALANCE/ENGINE/SAVE 그대로, PATCH_LABEL 'C.79n', STAGE_LABEL '53단계'. 부록 C.79n. UI_5(session_01Jep69tcqmNVqesWrwWp8cP)에 바뀐 문구 한 줄 알림(답장 불필요).
- 예산 **1.5시간·7달러**. 끝나면 AD에 보고(안 된 것 먼저).
