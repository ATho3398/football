너는 코드 세션 "53단계_엔진 계산 속도 2 — 결과 불변 (C.81j)"이다(Opus 5.5 고속 모드, 노력도 높음). 시작하자마자 `~/.claude/settings.json` 에 `"fastMode": true` 를 넣는다(사용자 지시: Opus는 고속 모드). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(보고는 패치 번호 대신 내용으로). 브랜치 `claude/c81j-engine-perf-2` — origin/main 최신에서 시작. 앞 단계 = 부록 C.81e(객체 모양 고정·목록 캐시, 브라우저 워커 765→483 ms, Node −28%, 주의: onPitch·line 바꾸는 코드는 s.onVer++).

## 할 일
- 경기 1회 계산 시간을 결과 불변으로 더 줄인다. 목표: Node 기준 C.81e 대비 −25% 이상, 브라우저 워커 483 ms → 380 ms 이하. 먼저 프로파일(--cpu-prof)로 상위 핫스팟 10개 표 → 큰 것부터. 후보: 거리 계산 제곱근 생략·공간 격자(근처 선수 찾기)·판단 후보 생성 중복 제거·문자열 키 Map → 숫자 인덱스·클로저 할당 줄이기.
- **지문 불변**: 같은 기반 커밋에서 내 변경 전후 경기 지문(상성 960 일부 + 장면 + 재생 데이터 해시)이 완전히 같아야 한다.
- 병렬로 엔진 수치 세션(C.81g·h·i)이 main에 들어올 수 있다 → 푸시 직전 rebase 하고, **rebase 된 기반에서 내 변경 전/후 지문을 다시 비교**한다(main 의 옛 지문과 비교하지 않는다).

## 관문
- 지문 동일 · typecheck · test · engine:check · build. 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합). ENGINE 번호는 그대로(결과 불변), PATCH_LABEL 'C.81j', STAGE '53단계', 부록 C.81j(전후 시간 표, 폰·PC 실측 가능하면 Playwright 워커 측정 포함).
- 예산 3시간·15달러. 끝나면 AD에 send_message 보고(안 된 것 먼저, 전후 ms, main 해시).
