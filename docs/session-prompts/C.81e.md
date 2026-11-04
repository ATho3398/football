너는 엔진 코드 세션 "53단계_엔진 계산 속도 — 결과 불변 최적화 (C.81e)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(보고는 내용으로). 브랜치 `claude/c81e-engine-perf` — origin/main 최신(974d317 이후)에서 시작.

근거: 자동 경기 대기 줄이기(부록 C.81c) 프로파일이 평평(moveAgent 7.6%·GC 6.8%·defendTarget 5.1%…) — 경기 1회 약 0.9 s(PC 워커). "비트 동일 지키며 20%+ 줄이려면 엔진 할당 줄이기 작업 필요". 내 리그·전부 엔진 설정에서 다른 경기 계산 시간이 이것에 비례.

## 할 일 (결과 한 비트도 안 바뀌게)
- 틱 루프의 객체·배열 할당 줄이기(벡터 임시 객체 → 재사용 버퍼/스칼라, 후보 목록 재사용 풀), 같은 틱 안 반복 계산 캐시(거리·각도·압박 값), GC 압박 줄이기. 상위 20개 함수 순서로.
- **금지**: 난수 호출 순서·횟수 변경, 부동소수 연산 순서 변경(`a*b*c`↔`a*(b*c)` 포함), 동작·수치 변경.
- 목표: 경기 1회 계산 **−30% 이상**(PC 워커·Node 둘 다), GC 비중 절반.

## 관문·배포
- 엔진 지문(`scripts/c74a-fingerprint.ts`·`scripts/diag/same-seed.ts -- 60`·C.81c 게임 진행 지문) **전후 완전히 같음** · typecheck · test · engine:check · build · 전후 시간 표(경기 100회 평균, 냉/온).
- 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합). C.81d(다른 리그 계산 기본값)와 파일이 겹칠 수 있음 — 뒤쪽이 merge 뒤 지문 재확인. PATCH_LABEL 'C.81e', STAGE '53단계', 부록 C.81e.
- 예산 3시간·15달러. 끝나면 AD에 보고(안 된 것 먼저, 함수별 전후, 경기 1회 시간 전후, main 해시).
