너는 코드 세션 "53단계_다른 리그 추정 평점 리그별 실측 보정 (C.81m)"이다(Opus 5.5 고속 모드, 노력도 높음). 시작하자마자 `~/.claude/settings.json` 에 `"fastMode": true` 를 넣는다(사용자 지시: Opus는 고속 모드). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(보고는 패치 번호 대신 내용으로). 브랜치 `claude/c81m-other-league-ratings` — origin/main 최신(BALANCE 95, SAVE 61)에서 시작. 앞 단계 = 부록 C.81d(다른 리그 3단계: 기본 "내 리그만 엔진", 다른 리그 = 점수 확률 + 득점자 추첨, 추정 평점 일괄 −0.33 보정).

## 할 일
1. **실측**: 같은 시드로 "전부 엔진" vs "내 리그만 엔진"을 리그별(주요 5대 리그 + 나머지 묶음)·포지션별로 3시즌 이상 돌려 선수 시즌 평균 평점·골·도움 분포 차이를 표로.
2. 일괄 −0.33 대신 **포지션별(필요하면 리그 수준별) 보정값**으로 바꿔 평균과 상위 분포(상위 20명 평점)가 엔진과 ±0.05 안에 들게. 수치는 balance.ts, BALANCE_VERSION +1.
3. **발롱도르·리그 시상 쏠림 확인**: 10시즌, 내 리그를 바꿔 가며(EPL·라리가·세리에·분데스) 후보 상위 10명 리그 비율이 "전부 엔진" 기준과 비슷한지. 내 리그 쏠림·반대 쏠림 둘 다 없게.
- 세이브 형식 안 바뀌면 SAVE 그대로.

## 관문
- 위 표·기준 · typecheck · test · balance 보고. 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합). PATCH_LABEL 'C.81m', STAGE '53단계', 부록 C.81m(전후 표).
- 예산 3시간·15달러. 끝나면 AD에 send_message 보고(안 된 것 먼저, 전후, main 해시).
