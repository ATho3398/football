너는 코드 정리 세션 "53단계_코드 정리 (C.79j)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79j-simplify` — origin/main 최신에서 시작, main 푸시 전 origin/main merge.

근거: 사용자 요청(2026-10-29 22:0x KST) "code-simplifier 에이전트로 전체 코드 분석하고 정리해줘". 엔진·게임 시스템 대기열이 비어 있어 지금 연다(UI 50단계는 사용자 디자인 대기).

## 할 일
`code-simplifier:code-simplifier` 서브에이전트(Agent 도구)로 `src/` 전체(192개 파일, 약 5.5만 줄)를 분석·정리한다. **동작은 한 비트도 바꾸지 않는다.**
- 나눔(파일 안 겹치게, 서브에이전트 동시 최대 3개): ① `src/engine/` ② `src/ui/`(views·components·packAnim·goalSplash·pitch 포함) ③ `src/` 바로 아래 게임 시스템 파일(game.ts·transfer.ts·awards.ts·cups.ts 등)과 `src/pwa/`. 큰 영역은 묶음을 더 쪼개도 된다.
- 허용: 죽은 코드·안 쓰는 import/함수/export 삭제, 같은 파일 안 중복 합치기, 읽기 어려운 분기·중첩 펴기, 이름이 틀린 지역 변수 고치기, 낡은 주석 정리(주석 밀도는 주변 코드 수준 유지).
- 금지: `src/config/balance.ts`·`src/engine/config.ts`의 **수치**·데이터 파일(`src/data/`) 내용 · 세이브 구조(직렬화 필드 이름·순서) · 난수 호출 순서·횟수(시드 결과가 바뀜) · 부동소수 연산 순서 바꾸기(`a*b*c`→`a*(b*c)` 같은 것도 결과가 달라질 수 있음) · 화면 문구·CSS 값 · 테스트 단언 변경 · 여러 파일에 걸친 공개 API 이름 바꾸기 · 새 기능. 애매하면 손대지 않는다.
- 서브에이전트 지시에 위 허용·금지 목록을 그대로 넣고, 결과 diff는 네가 직접 읽고 금지 항목에 걸리면 되돌린다.

## 관문(동작 불변 증명)
1. 시작할 때 origin/main에서 기준값을 잰다: `npx vite-node scripts/c74a-fingerprint.ts` · `npx vite-node scripts/diag/same-seed.ts -- 60` 지문 · `npm run balance` 출력 전체 저장 · `npm run balance:engine:check` 결과 저장.
2. 영역 하나 끝날 때마다: typecheck · test · 위 지문 2개가 **기준과 완전히 같아야** 커밋. 다르면 그 영역 변경을 쪼개서 원인 커밋을 찾아 되돌린다.
3. 마지막에 `npm run balance` 출력이 기준과 같은지 diff(같으면 BALANCE_VERSION·SAVE_FORMAT_VERSION 그대로) · engine:check 같음 · build 통과 · Playwright로 주요 화면(타이틀·홈·경기 준비·경기·재정·선수) 캡처를 정리 전후 비교(픽셀 같거나 차이 0에 가까움 — 차이 나면 원인 확인).
4. balance:check 로컬 60분 넘으면 다른 관문 통과 시 CI에 맡긴다.

## 배포·보고
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). PATCH_LABEL 'C.79j', STAGE_LABEL '53단계' 그대로(새 단계 아님). 부록 C.79j에 영역별 줄 수 변화(삭제/추가)·대표 정리 예·되돌린 것 기록.
- 예산 **4시간·20달러**. 30분마다 중간 푸시(작업 브랜치).
- 끝나면 마스터 AD에 보고(안 된 것·되돌린 것 먼저, 영역별 줄 수 변화, 지문 일치 여부, main 커밋).
