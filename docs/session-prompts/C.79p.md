너는 게임 시스템 코드 세션 "53단계_리그별 지역 기후 (C.79p)"이다(Opus 5.5, 노력도 높음). 마스터는 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위 3줄). 작업 브랜치 `claude/c79p-climate` — origin/main 최신에서 시작, main 푸시 전 origin/main merge(같이 도는 C.79m은 src/engine, C.79o는 league/cups/match — 너는 weather.ts·balance.ts 기후 표만).

근거: 외부 피드백 R3(사용자 2026-10-30 03:1x KST "추천하는 대로 ㄱㄱ"). 마스터 확인(main 80f6277): `src/weather.ts:33-44 TEAM_REGION`은 잉글랜드·웨일스 구단만, 나머지 전부 `'europe'` → `climate()`(weather.ts:47-55)가 **잉글랜드 월별 표**(balance.ts:1990-2000) × 지역 배율(europe [1,1,1.2,1]). 그래서 라리가·세리에·사우디·K/J리그·MLS·브라질도 잉글랜드 달력(예: 브라질 1월 눈 가중 10·더위 0). C.75m부터 타리그는 날씨 env로 전체 엔진, 챔스 원정·타리그 시작 커리어 내 경기에도 걸림. 날씨는 (시드, 날짜, 홈)에서 결정적이고 저장 안 함(weather.ts:2).

## 할 일
- 리그(또는 나라)별 **월별 기후 표**: 게임에 있는 모든 리그·챔스 원정 나라 — 대표 도시(리그 구단 분포 가중 또는 수도/대표 도시 1~2곳)의 **실제 기후 평년값**(월 평균 기온·강수일·눈일 등 — 출처: 각 나라 기상청/WMO 평년값 또는 위키 기후 표, 지시문 작성자의 기억값 쓰지 말 것. 출처를 부록에 적는다)을 지금 날씨 종류(맑음·비·눈·더위·바람 등 balance.ts의 종류) 가중으로 환산. 남반구(브라질 등)는 계절이 반대. 잉글랜드 지역 배율(TEAM_REGION)은 그대로.
- 구단 → 리그/나라 지역 매핑(TEAM_REGION 확장 또는 리그 id로). 같은 나라 안 지역 차이(예: 스페인 북부/남부)는 크면 2지역까지, 아니면 나라 하나.
- 기획서 game-design.md ~5112 "추천: 그대로, 챔스 단계에서 나라별로" 문장 갱신.

## 관문·배포
- 리그별 시즌 날씨 분포 표(월별 눈·비·더위 비율) 전후 · 잉글랜드 리그는 **완전히 같음**(같은 시드 지문 c74a 불변 — 다르면 원인 확인) · tests/c74a.test.ts 기후 테스트 갱신 · `npm run balance` 회귀 가드 · typecheck · test · build · balance:check(로컬 60분 넘으면 CI).
- 관문 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인). BALANCE_VERSION +1(다른 세션과 겹치면 merge 때 다음 번호), ENGINE·SAVE 그대로, PATCH_LABEL 'C.79p', STAGE '53단계'. 부록 C.79p(출처 포함).
- 예산 **2시간·10달러**. 끝나면 AD에 보고(안 된 것 먼저).
