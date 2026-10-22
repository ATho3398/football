너는 코드 세션 "50단계_오프라인 PWA·세이브 형식 정책 (C.77r)"이다(Opus, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77r-pwa`(main 최신, C.77q 뒤에서).

근거: 사용자 요청(2026-10-22 10:3x KST) ① 오프라인 플레이 — 설치형 웹앱(PWA) ② "버전이 올라 세이브를 맞추려면 추가 패치가 필요하면, 현재 버전에서 플레이 불가 안내 띄우고 세이브 날려 버려(아직 실플레이 단계 아님)". CLAUDE.md·automation.md 0번에 "세이브 이전 없음" 규칙이 들어갔다.
지금 상태(Z 조사): 외부 서버·CDN 의존 없음, fetch는 public 안 얼굴 manifest만, 세이브 IndexedDB(`src/save.ts`, gzip, 슬롯 3 + 자동 + 파일 내보내기), public 약 8.8MB, PWA 없음, vite base './'(GitHub Pages /football/).

할 일:
1. **PWA**: `manifest.webmanifest`(이름·아이콘·standalone·theme), 서비스 워커(외부 라이브러리 없이 손으로 또는 vite 빌드 뒤 스크립트로 파일 목록 생성) — 빌드 산출물 전부 + public 전부 미리 캐시, 버전(빌드 커밋)별 캐시 이름, 새 버전이 있으면 "새 버전 — 다시 열기" 알림(자동 강제 새로고침 금지, 경기 중엔 미룸), 옛 캐시 정리. 경로는 base './' 기준으로 Pages 하위 경로에서 동작. iOS 안내(사파리 저장소 정리 가능 → 설정의 파일 내보내기 백업 권장 한 줄).
2. **세이브 형식 정책**: 불러오기·자동 저장 복원 때 `SAVE_FORMAT_VERSION`이 지금과 다르면 이전하지 말고 안내("이 세이브는 이전 버전 형식이라 이어 할 수 없습니다") 뒤 그 슬롯을 지움(파일 가져오기도 같은 안내, 저장 안 함). 기존 이전(migration) 함수 사슬은 제거하고 관련 테스트는 새 정책 테스트로 교체. 명예의 전당(legacy localStorage)처럼 세이브 밖 데이터는 형식이 같으면 유지.
관문: typecheck·test(형식 다른 세이브 → 안내·삭제, 같은 형식 정상 로드, 서비스 워커 파일 목록 생성) · build · 헤드리스 Chromium에서 오프라인 재접속 확인(한 번 열고 → 네트워크 끔 → 새로고침 → 타이틀·새 게임·경기 1번까지) · 같은 시드 지문 불변 · Lighthouse 비슷한 PWA 설치 가능 조건 점검 결과 부록.
**main 푸시 주의**: main CI가 돌고 있으면 끝난 뒤 푸시(취소 방지).
예산: 1.5시간·약 8달러. PATCH_LABEL 'C.77r', STAGE_LABEL main 그대로, SAVE_FORMAT_VERSION은 정책만 바뀌면 그대로(구조 바뀌면 +1). 부록 C에 C.77r. 끝나면 마스터 Z에 보고. CI 성공은 보내지 않는다.
