너는 엔진 코드 세션 "44h단계_경기 계산 속도 (C.78f)"이다(Opus 5.5, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c78f-speed` — **`origin/claude/c78e-roles` 최신에서 시작**(C.78c 최적화·78d·78e 병합본, C.78e가 main 배포 중).

근거: 새 움직임을 켠 뒤 CI의 `tests/cards.test.ts` "경기 계산 2초 이하"가 두 번 넘었다(2114·2207 ms, 재실행으로 통과). CI 러너는 로컬보다 약 2배 느리다. C.78c 프로파일(포함 시간): `updateOffball` 41%(`defendTarget` 18.5 · `attackTarget` 9.8) · `moveAgent` 17%(`turnHead` 4.7) · `candidates` 14% · `preDecide` 6.4% · `arrivalTime` 1.9% · vitest import 접근자 7.8%. C.78e 보고는 한 스레드 경기당 0.78~0.80초. 목표: **CI에서 2초 테스트가 여유 있게 통과**(로컬 경기당 ≤ 0.65초, 2초 테스트 로컬 자동 ≤ 900 ms 목표).

규칙: **결과가 같은 최적화만** — 같은 시드 30경기 지문이 시작 전후 같아야 한다(바뀌면 그 변경은 되돌림). 난수 호출 순서·횟수 불변. 2000 ms 기준·테스트 실행 순서는 건드리지 않는다. 동작·밸런스 무변경이라 ENGINE_VERSION·BALANCE_VERSION 그대로.

할 일:
1. 프로파일 다시(지금 브랜치 기준, `node --cpu-prof` 등) — 상위 10개 함수 표.
2. 후보: `updateOffball` 안의 틱마다 반복되는 거리·각도 계산을 틱 단위 캐시(선수 쌍 거리 행렬 1회 계산 재사용), `defendTarget`·`attackTarget`의 후보 탐색에서 같은 값 재계산 제거, 객체 할당(배열·임시 객체)을 루프 밖으로, `Math.sqrt`/`atan2` 반복을 제곱 거리 비교로(결과 같을 때만), vitest import 접근자 비용이면 핫 경로의 설정 객체를 지역 상수로 끌어오기.
3. 각 변경마다 지문 확인 → 경기당 시간 기록. 효과 작은 것은 넣지 말 것(코드 복잡도 대비).

관문: 지문 불변 · typecheck·test 전부 · 로컬 경기당 시간 전후 표(6경기 평균) · 2초 테스트 로컬 3회.
**main 푸시 순서**: C.78e(d+e) 배포 CI 뒤. 마스터 "푸시 ㄱ" 전까지 작업 브랜치에만. 푸시 전 충돌 표시 검사.
예산: 2시간·**12달러 넘기지 말 것**. PATCH_LABEL 'C.78f', STAGE_LABEL 그대로. 세이브 이전 코드 금지. 부록 C.78f. 완료면 Z에 보고(프로파일 전후·변경 목록·지문·시간·커밋·비용). CI 성공은 보내지 않는다.
