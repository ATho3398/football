너는 코드 세션 "45d4단계_리그 데이터 K리그1·J리그1 (C.75q)"다(45단계 리그 데이터, 데이터 파일만). 마스터는 T(session_01KEPYWMJvsVNyeS7vpS8kSs, 마스터 브랜치 claude/planning-t). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 7번: T에는 완료·실패·질문만, CI 성공은 안 보냄).

먼저 읽기: CLAUDE.md → docs/automation.md → `git fetch origin claude/planning-t && git show origin/claude/planning-t:docs/planning-pending.md` 의 132·134번 → docs/game-design.md 13번 → 기존 형식 참고: src/league.ts(PL 2018 팀·레이팅 척도: 맨시티 85 ~ 허더즈필드 67), data/players/stars.ts(실제 선수 Row 형식·능력치 25개 척도), data/players/legends.ts, data/outsideClubs.ts(이미 있는 리그 밖 클럽 이름·레이팅 — 같은 클럽은 이름·레이팅을 맞추고 다르면 근거와 함께 기록), data/teamColors.ts·data/managers.ts·data/derbies.ts.

할 일: 리그 K리그1(kleague1, Korea Republic, tier 1)·J1리그(jleague1, Japan, tier 1) 의 데이터 파일을 만든다(게임에 연결하지 않는다 — 연결은 45a·45b).
1. `data/leagues/<leagueId>.ts`: 아래 공통 형식(`data/leagues/types.ts`가 main에 없으면 정확히 이 내용으로 만든다 — 45a C.75m과 다른 데이터 세션도 같은 내용으로 만들므로 병합 때 같은 파일), `export const LEAGUE: LeagueData`. 시즌 2018(spring-autumn, 2018 시즌) 실제 참가 팀 전부, 실제 영문 이름·한글 이름(한국 언론 표기), 레이팅(PL 척도에 맞춘 상대 전력: 리그 간 수준 차이 반영 — 예 바르셀로나·레알 ≈ 맨시티급, 2부 리그 상위 ≈ PL 하위 −3~5), 도시·팀 색·감독(그 시즌 개막 감독)·홈구장·주요 더비. 팀 id = `<leagueId>:<3글자>`(예 laliga:rma).
2. `data/players/<leagueId>.ts`: 그 시즌 유명 실제 선수, stars.ts의 Row 형식 그대로(필드 선수만; GK 형식이 레포에 있으면 GK도), club = 팀 영문 이름, league = 리그 영문 이름. 인원: 리그당 15~25명(국가대표·외국인 스타 위주). 이미 data/players(stars·messi·legends·future 등)에 있는 선수는 넣지 않는다(이름으로 확인, 겹치면 목록만 기록). 능력치는 stars.ts·legends.ts 척도에 맞춰 보수적으로(그 시즌 기준 나이·실력), potentialTier·reputation도 같은 척도. id는 영문 소문자-하이픈, 다른 리그 세션과 겹치지 않게 접두 없이 이름 기반(동명이인은 뒤에 숫자).
3. 검증: `npm run typecheck`, `npm test`(데이터 파일 형식·id 중복·능력치 25개·팀 수 = 실제 참가 팀 수를 확인하는 테스트 `tests/leagues-<leagueId>.test.ts` 추가), 팀 레이팅 분포 요약.
4. 배포: 데이터만이라 게임 결과 불변 — 그래도 CLAUDE.md대로 main 푸시(푸시 직전 main 최신 병합, data/leagues/types.ts·version.ts 충돌은 병합으로 해결). 버전 상수(BALANCE·ENGINE·SAVE)는 올리지 않는다. PATCH_LABEL 'C.75q', STAGE_LABEL '45단계'. 부록 C에 C.75q 소절(리그·팀 수·선수 수·레이팅 범위·출처 메모).

공통 형식(`data/leagues/types.ts`):
```ts
export interface LeagueTeamData { id: string; name: string; nameKo: string; rating: number; city?: string; colors?: { primary: string; secondary: string }; manager?: string; managerKo?: string; stadium?: string; stadiumKo?: string; }
export interface LeagueData { id: string; name: string; nameKo: string; country: string; tier: 1 | 2; season: string; calendar: 'autumn-spring' | 'spring-autumn'; teams: LeagueTeamData[]; derbies?: [string, string, string?][]; }
```

병렬: 45a C.75m(league.ts·달력·새 게임 리그 고르기, data/leagues/index.ts·pl.ts)과 다른 데이터 세션 5개, C.75k·C.75l(엔진), C.75t(포토카드)가 동시에 돈다. 너는 data/leagues/<네 리그>.ts·data/players/<네 리그>.ts·tests/leagues-<네 리그>.test.ts만 만든다(다른 파일 수정 금지, version.ts·부록 C 제외). 완료면 main 푸시 후 T에 한 번 보고(리그·팀 수·선수 수·커밋).
