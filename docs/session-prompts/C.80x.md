너는 코드 세션 "53단계_새 버전 알림·한 번에 업데이트 (C.80x)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). CLAUDE.md·docs/automation.md를 따른다(보고는 패치 번호 대신 내용으로). origin/main 최신에서 시작. **엔진 코드(`src/engine`)는 건드리지 않는다** — 지금 엔진 묶음 5개(몰빵·커스텀 대형·게겐·골 분포·롱패스)가 병렬로 돌고 있다. 브랜치 `claude/c80x-update-prompt`.

근거: 사용자(11/04 03:4x KST) **"이제 새 앱 나오면 무조건 지난 앱은 최신 버전 나왔다고 띄우고 버튼만 누르면 업데이트되게 바꿔."** 지금 PWA: `src/pwa/register.ts`·`src/pwa/swBuild.ts`(서비스 워커), GitHub Pages 배포(https://atho3398.github.io/football/).

## 할 일
1. 새 배포 감지: 서비스 워커 `updatefound`/`waiting` + **주기 확인**(앱 켤 때·화면으로 돌아올 때(visibilitychange)·30분마다 `registration.update()`). 서비스 워커가 없는 환경(일반 브라우저 탭)도 배포된 `version.json`(빌드 때 PATCH_LABEL·STAGE_LABEL·ENGINE/BALANCE/SAVE 버전·빌드 시각 생성)을 받아 지금 버전과 비교하는 방식으로 같이 감지.
2. 알림: 화면 위(또는 독 위) 고정 배너 "새 버전이 나왔어요 · {새 PATCH/STAGE} — [업데이트]" (+ 작은 [나중에] — 다음 확인 때 다시 뜸). 경기 진행 중(실시간 경기 화면)이면 경기 끝날 때까지 배너만 띄우고 버튼은 결과 화면에서. 기존 컴포넌트(Banner/Toast B) 재사용.
3. [업데이트] 한 번: **세이브를 먼저 확정 저장** → 대기 중 서비스 워커에 `SKIP_WAITING` 메시지 → `controllerchange` 때 한 번만 새로고침(무한 새로고침 방지). 서비스 워커 없는 경우는 캐시 무효화 새로고침. 새로고침 뒤 "업데이트됨 · {버전}" 토스트 한 번.
4. 세이브 형식이 바뀐 버전으로 올라가면 세이브 이전(같이 진행 중인 C.80y)이 처리 — 이 세션은 이전 실패 시 안내 문구 자리만 맞춘다(C.80y와 대화로 조율, session id는 AD가 알림).
5. 설정 화면 맨 아래 "버전 {PATCH_LABEL} · {STAGE_LABEL} · [업데이트 확인]" 줄.
6. 테스트: 서비스 워커 업데이트 흐름 단위 테스트(가짜 registration) + Playwright로 실제 두 빌드(옛·새) 띄워 배너 → 버튼 → 새 버전 로드 확인(캡처 `docs/captures/c80x/`).

## 관문·배포
- typecheck · test · build · Playwright 업데이트 시나리오 ✓ · 엔진 지문 불변(엔진 무수정). 승인 없이 main 푸시(claude/planning-ad docs 병합, 직전 main CI 확인 — 진행 중이면 끝난 뒤). PATCH_LABEL 'C.80x', STAGE '53단계', 부록 C.80x.
- 예산 2시간·10달러. 끝나면 AD에 보고(안 된 것 먼저, 실제로 확인한 업데이트 흐름, main 해시).
