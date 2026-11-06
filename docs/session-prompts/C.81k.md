너는 코드 세션 "53단계_배포 확인 시간 줄이기·배포 도구 버전 (C.81k)"이다(Opus 5.5 고속 모드, 노력도 높음). 시작하자마자 `~/.claude/settings.json` 에 `"fastMode": true` 를 넣는다(사용자 지시: Opus는 고속 모드). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(보고는 패치 번호 대신 내용으로). 브랜치 `claude/c81k-ci-speed` — origin/main 최신에서 시작.

## 배경
main 푸시마다 `.github/workflows/pages.yml` 이 typecheck → test → build → balance:check(약 50~63분) → engine:check → Pages 배포를 해서 한 번에 70분 걸린다. 고친 게 사용자에게 늦게 간다. 또 GitHub 경고: Node 20 액션 지원 종료(checkout·setup-node·configure-pages·upload-artifact·deploy-pages가 Node 24로 강제 실행 중), ubuntu-latest → Ubuntu 26 전환.

## 할 일
1. **balance:check 를 여러 조각으로 나눠 동시에**(matrix job, 예 6~8 조각): 조각별 시드·항목 나누기 → 마지막 job 이 결과 합쳐 기존과 **똑같은 판정**(같은 기준·같은 시드 범위). 합친 판정이 기존 한 번에 돈 결과와 같은지 한 번 대조해서 부록에 남긴다. engine:check 도 오래 걸리면 같이 나눈다. 목표: 푸시 → 배포 25분 이하.
2. 배포를 막지 않는 무거운 검사와 막는 검사 구분 유지(지금 막는 것은 계속 막는다 — 기준 완화 금지).
3. 액션 버전을 Node 24 지원 최신 메이저로 올리고, runner 는 `ubuntu-24.04` 로 고정(또는 26에서 돌려 보고 통과하면 26). `android` 워크플로도 같은 경고 정리.
4. `concurrency` 는 `cancel-in-progress: false` 유지.
- 엔진·밸런스·세이브 코드는 건드리지 않는다.

## 관문
- 브랜치에서 워크플로 한 번 돌려(workflow_dispatch 또는 브랜치 push 트리거 임시) 전체 통과와 시간 확인 → main 푸시 후 실제 run 시간 보고. PATCH_LABEL 'C.81k', STAGE '53단계', 부록 C.81k(전후 시간).
- 예산 2시간·10달러. 끝나면 AD에 send_message 보고(안 된 것 먼저, 전후 분, main 해시, run 번호).
