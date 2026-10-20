# 엔진 관리자 인수인계 (엔진 관리자 → 다음 엔진 관리자 세션)

이 문서는 엔진 관리자 세션을 새로 열 때 읽는 안내서다. 엔진 설계 자체는 `docs/game-design.md` 부록 E, 밸런스 원칙은 E.15/E.15.1, 미해결 문제는 `docs/engine-issues.md`가 기준이고, 여기에는 **역할·지금까지 알게 된 엔진 사실·측정 도구 요령·내 의견**만 적는다.

작성: 1대 엔진 관리자 `session_01Tc3v1PUjUeQb6grHociYfh`(Fable), 2026-10-16 19:27 KST, `main` 286aaeb 기준. 컨텍스트 약 71만으로 교체 기준(50만)을 넘어 기획 세션 I 요청으로 작성.

## 1. 역할과 규칙 (`docs/automation.md` 요약)

- **코드 수정 금지.** `src/`, `src/config/balance.ts`, 엔진 상수(`src/engine/config.ts`)를 건드리지 않는다. 진단 스크립트는 `scripts/diag/`에 추가·수정해도 되고 커밋해도 된다. `PATCH_LABEL`은 바꾸지 않는다. PR은 만들지 않는다.
- **하는 일**: 코드/fix 세션이 "해결 어려움"을 보내오면 원인 분석 → `docs/engine-diagnosis-<패치>.md` 작성 → 기획 세션에 `send_message`. fix 세션이 "진단 불일치(⑤)"로 되돌리면 그 문제에 한해 1회 재진단(같은 문서에 §재진단 절 추가). 다음 엔진 패치가 시작될 때 `engine-issues.md` 미해결 목록을 같이 본다.
- **처방 양식(반드시)**: ① 통과 기준(목표 지표·범위·지킬 가드) ② 우선순위 가설 최대 3개, 가설마다 손댈 파일·함수·상수 ③ 재현 명령과 현재 측정값 ④ 모델 의견(Opus 고속 = 파일·함수·상수 단위로 좁을 때 / Fable = 여러 모듈이 얽혔거나 Opus가 같은 문제로 2회 실패). 예산(시간·측정 횟수)도 적으면 fix 세션이 편하다.
- **설계 금지**: 결과 할당·고무줄 보정(E.15.1). 목표 수치는 재는 것이지 끌고 가는 것이 아니다. 허용: 공통 상수, 역할 파라미터, 팀 전술.
- **보고**: 한국어, 쉬운 말. 모든 답변과 세션 간 메시지 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST, `TZ=Asia/Seoul date`). 보고서 끝에도 붙인다.
- **커밋**: 보고서와 `scripts/diag/`만. 작업 브랜치(1대: `claude/engine-polish-diag`)에 커밋·푸시한 뒤 `main`에도 푸시(문서·진단 스크립트는 사용자 허가로 `main` 직접 푸시 가능). `main`이 앞서 있으면 `git fetch origin main && git rebase origin/main` 뒤 푸시. 커밋 메시지 끝에 `Co-Authored-By`·`Claude-Session` 줄.
- **비용**: 전체 측정(`balance:engine:check`, `balance:scoring`, `balance:sweep --tactics`)은 진단 1건당 최대 2회. 긴 실행은 백그라운드로 돌리고 출력을 스크래치패드 파일에 받는다. PNG는 읽지 않는다. 컨텍스트 50만을 넘으면 보고서를 커밋하고 기획 세션에 교체를 알린다.
- **세션 이름 규칙**: 새 세션을 열면 이전 세션 제목 앞에 `draft_`가 붙는다(기획 세션이 한다).

### 지금 상태 (4대 → 5대 인수인계, 2026-10-20 14:10 KST)
- **(5대, 2026-10-20 17:00 KST) 마스터 U `session_01DUqLtswE7hDV9NHhh6HfZq`(`claude/planning-u`, 14:48 교체). main **bb5cf4a = C.75l · 엔진 27**(44f-a: 속도 −15%, 미해결 1 해결, 4 부분; 지문 57b1f387e7610a51). 엔진 27 기준선 quick 600 득점 1.36 · 유효 4.1 · 전환 33.6 · 선방 66.4 · Δ+8 1.85 · 롱패스 19.3 · scoring 30골+ 1.50 · 중앙값 31.5 · 리그 1.39 · 케인 27골/5.3슛.** `polish-b gap 40` 에 **1대1 슛 행** 추가(6e189f4): 1.18~1.20/경기 골 8.5 · 선방 27.5 · 빗나감 64(12 m 안 표본이 작아 비율은 `gap 120` 이상으로).
- **44f-b 는 열지 않는다**(`engine-diagnosis-e4.md` §3.5): §3.3 세 상수를 5대가 먼저 재 봤는데 모두 ✗ — `saveBase` 1.72 → 선방 68.5 ✓ 득점 1.23 ✗(0.01 = −0.067골, 판단식 공유로 슛을 덜 고름), `supportMin/Max` 10/22·8/18 ≈ 0, `longPerM` 0.07 득점 −0.5, 압박 비용 이동 거리 −1.5 그대로. 미해결 2·3·6 에 수치 기록.
- **44h-a 지시서 = §9**(사용자 결정 16:31 ② GK 1대1 현실화 처방 필수 · ③ 엘리트 몰림 근본 원인 분해, 제안 16:37 위협 가중 수비). **분해 결과(같은 시드 scoring)**: A `finishPerPoint` 0 → 30골+ 1.50 → **0.30**·중앙값 27.5·리그 −0.05 (실행 배수 몫 ≈ 80%) · B 수신자 슛 항 리그 평균 → **1.50 그대로**(4대 ⓐ 기각, 공격 판단식 손댈 이유 없음) · 남는 몫 = 강팀 ST 자리의 슈팅 수(U 관찰). 처방: 가설 1 1대1(`shotFree` 0.30·(1 − d/20) 콘 안 수비 0·3 m 안 상대 0 보너스 + `keeper.closeW` 0.45/12 헤더 제외 + `saveBase` 1.76) · 가설 2 위협 가중 수비(`focusThreat`·마크 거리·커버 섀도에 `finishSkill` 가중, 미해결 8 과 종류가 다름: 마커 수 안 늘림) · 가설 3 보조 `finishMax` 1.25 → 1.18. 모델 권장 Fable 3시간·측정 9회(단계 A Opus 가능). 새 미해결 **12**(GK 1대1)·**13**(PK 빈도 0.136·지정 키커 없음·승부차기 장면 안 만듦).
- **(5대 20:4x KST) C.76a(44h-a) 결과 재진단 = §9.10**: 위협 가중 수비만 배포(엔진 28 b2133a1, 분포 그대로), 1대1 현실화는 6조합 전부 30골+ 2.6~2.8 로 실패(코드만 상수 0). 분해(polish-b 1대1 분해 행): 자유로운 슛의 주인은 윙어·2선(컷백·레이오프), 리버풀 3.24 : 동레이팅 1.15 : 중위 0.67, 침투 패스·뒷공간은 원인 아님. 구조 처방 44h-b = 비행 중 수신자 압박(`defendTarget` 압박 분기 앞 한 블록) → 자유로운 슛 격차를 현실로 → 그 뒤 `shotFree` 0.30 + 구석×(1 − 0.35×압박) + saveBase, `closeW` 0 유지. Fable 3시간·9회. 마스터 **V `session_01Lzq7rz3Q4FvKuV1aT6Xkhk`(`claude/planning-v`, 19:15 교체)**.
- **(5대 → 6대 인수인계, 2026-10-20 20:5x KST, V 지시 20:28 "재진단 마무리 뒤 멈춤")** 5대 `session_01Gg4RyE2G4dDfJ5gkNHsFr7` 대화 35만 토큰으로 교체. 6대는 `claude/engine-manager-6` 을 main 에서 따고 `git merge origin/claude/engine-manager-5`. **다음 할 일 = 44h-b**(`engine-diagnosis-e4.md` §9.10 + §9.10a 사용자 지시 검증): 가설 1 비행 중 수신자 압박(구조) → 가설 2 자유로운 슛 현실화 상수(`shotFree` 0.30 켜기 + 구석×(1 − 0.35×압박) + `saveBase`), `closeW` 0 유지. 코드 세션이 "해결 어려움·진단 불일치"를 보내오면 §9.10 에 §재진단 추가. **미해결 목록 상태(엔진 28)**: 1 해결(C.75l) · 2·3·6 44f-b 사전 측정으로 상수 처방 기각(§3.5, 판단·구조 블록 44h-c 로) · 4 부분(펄스 나인 −0.19·메짤라 +0.13, 역할 표 2차) · 5 (8 과 같은 축) · 7 해결(C.75h) · 8·10·11 위협 가중 수비(엔진 28) 들어갔고 분포 그대로 → 44h-b 가설 1 이 "받는 순간 자유"를 수비 쪽에서 줄이는 처방 · 9 LM/RM 슈팅(미착수, "슈팅 적은 LM/RM 이 그때 어디 있나" 분해부터) · **12 GK 1대1**(코드 들어감·상수 0, 44h-b 가설 2 로 켬) · **13 PK 빈도 0.136/경기(현실 0.25~0.3)·지정 PK 키커 없음**(44h-b 에 넣지 않음 — 박스 안 파울 확률 `referee.ts`·`actions.ts defendDuels` 공통 상수 1개 + 지정 키커 `core.ts:193`(팀 설정 또는 마무리·침착 최고) 는 44h-c 또는 뒤; **승부차기 장면은 만들지 않는다**(사용자 16:31 ①) — PK 를 늘리면 득점 +0.03~0.05 라 `saveBase` 쌍으로). 측정 도구: `polish-b` 1대1 행·분해 행(포지션·경로·거리·공 얻은 뒤 시간)·수비 시 실제 수비 라인 행(점수 상황별) — 모두 `gap 120`/`liv 120 liv A`/`tac 120 block` 으로(gap 40 은 표본 부족).
- **5대 측정 요령**: 상수·한 줄 임시 편집은 작업 트리에서 하고 측정 뒤 `git checkout -- src/…`(커밋 금지, 종료 훅이 "uncommitted" 라 해도 그대로 둔다). `balance:*` 워커 번들은 공유라 본 트리에서 한 번에 하나만(`until grep -q '^exit' 파일; do sleep 5; done` 로 체인). `polish-b`·`pass-dist` 는 in-process 라 스크래치 worktree(`git worktree add <S>/wt-e27 bb5cf4a` + `ln -s node_modules`)에서 병렬 가능. 세션 시작 때 `rate_limit_info` `allowed_warning`(5시간, 16:30 풀림).
- **5대 `session_01Gg4RyE2G4dDfJ5gkNHsFr7`(Fable, 제목 `엔진관리자5`) 기준선 재측정(2026-10-20 14:10 KST, main 9dd8a59 엔진 26, 브랜치 `claude/engine-manager-5` = main + engine-manager-4)**: `same-seed 30` 지문 **63b657ed4fe5aaac**(부록 C C.75h 기록과 동일) · quick 600(SWEEP_D 200) 득점 **1.35** · 점유 50.0 · 유효 4.1 · 전환 33.2 · 선방 **66.8** · 인터셉트 15.1 · 판단 태클 15.3 · 드리블 45.4 · Δ+8 **1.85** / Δ−8 0.99 · 롱패스 19.3% · 득점 비율 ST 29 / 윙 24 / 미드 35 / 수비 12 · 경기 560 ms(워커). 4대 기준선과 전부 같다(내 선수 없는 측정은 C.75h 영향 없음 확인). **미해결 7 해소 확인**: `tests/c75h.test.ts` "맡기기 = 자동"(덱 있는 경기, `stop: all`, 평점·골·팀 스탯 동일) 들어 있고 통과(11.9초). 세션 시작 때 `rate_limit_info` `allowed_warning`(5시간 한도, 풀림 16:30 KST).
- **4대** `session_01HQqZPY5MdCnWXnbCJWgvBr`(Fable, 제목 `엔진관리자4`, 대화 약 41만 토큰으로 교체 요청). 작업 브랜치 **`claude/engine-manager-4`**(main 에서 따고 engine-manager-3 병합; 5대는 `claude/engine-manager-5` 를 main 에서 따고 `git merge origin/claude/engine-manager-4`). 마스터 **T** `session_01KEPYWMJvsVNyeS7vpS8kSs`(`claude/planning-t`). main 푸시 안 함. `npm ci` 는 컨테이너마다 새로.
- **main 9dd8a59 = C.75h(44g-a1 카드·맡기기 B안) · 엔진 26 · 44단계.** 엔진 결과 기준선(엔진 24~26 동일 경기 결과로 가정, C.75h 는 내 선수 결정만): 동레이팅 득점 1.35 · 유효 4.0 · 선방 66.8 · 인터셉트 15.1 · Δ+8 1.85 · scoring 리그 1.38 · 30골+ 0.80 · 득점왕 중앙값 29.5 · engine:check σ 0.71 · CDM/CM/CAM 6.50/6.50/6.40 · `tactic-pair 300 75:75 balanced` 1.26~1.30 · `defense-shape` B 47 / C 32 / F 41% · 박스 3명+ 4% · 교체 20.6. 5대는 첫 측정 전에 `same-seed 30` 지문과 `balance:quick 600` 1회로 기준선을 다시 적는 것이 안전하다(C.75h 가 내 선수 경로를 바꿨으므로 내 선수 없는 측정은 그대로여야 한다).
- **E-4 처방 문서 = `docs/engine-diagnosis-e4.md`**(44c-c §6 → 실패 재진단 §6.6 · 44e §2 → 실패 재진단 §2.8 · 44f §3 · 44g §4·§5 · 마스터 질문 §7). 마스터가 §7 1~8 모두 채택.
- **진행 중 코드 세션**: **C.75l 44f-a**(Opus, `session_01QZ5ZDUYieygE9hrzXVGtHg`, `claude/c75l-speed-roles`, 14:05 시작 — §3.1 결과 불변 속도 커밋 1(지문 동일, ENGINE_VERSION 안 올림) + §3.2 미해결 1 재측정 800쌍·4 역할표 `role-pair 800`, §2.8 ② 기준 엔진 26 위) · **C.75i 44g-a2**(Opus, 지시 카드 신뢰·판단 스탯 생활 영향·패스 받는 빈도 재분류) · **C.75k 44g-b**(Opus, 하프타임 전술·몰고 가다 슛·레전더리 35세 가드 시드 96·≤ 0.30). 끝난 것: C.75f(44d 부분 해결, 엔진 25)·C.75g(44c-c 실패 ③)·C.75h(44g-a1 배포)·C.75j(44e 실패 ③). **대기: 44f-b**(C.75l 뒤, §3.3: `saveBase` 1.70 → 1.74 1회 — 조건 득점 ≥ 1.30 충족, 같은 시드 scoring 첫 관문 · `supportMin/Max` 12/25 → 10/22 · 압박 비용 `pressDistRange` 14 → 16 + 소모 0.9+0.3p).
- **미해결 1~11**(`engine-issues.md`): 1 ST 반응(44f-a 재측정) · 2 롱패스(44f-b) · 3 전술 상한(44f-b 압박 비용, 블록 행은 8 과 같은 축) · 4 역할 득실(44f-a) · 5 몰빵(8 과 같은 축) · 6 선방률(44f-b saveBase) · 7 맡기기 ≠ 자동(C.75h 가 자동 카드 금지로 해소했는지 **5대가 확인** — `tests/c75a` 식 "덱 있는 경기 맡기기 = 자동" 테스트가 들어갔는지) · **8 마크 배정 ↔ 득점**(C.75d·e·j 세 번 실패 — "마크 + 공격 보정"은 총량은 맞춰도 분포가 깨진다; 코드 최신본 `claude/c75j-receive-model-mark`) · 9 LM/RM 슈팅(가설 1·3 모두 무효, 다음은 "슈팅 적은 LM/RM 이 그때 어디 있나" 분해부터) · 10 전환 B·F 미마크(8 에 흡수) · **11 득점 분포 축**(공격 보정은 `finishMult` 비례 항 — 슛 `pOn`·패스 가치의 수신자 슛 항 `onball.ts:452~455` — 으로 엘리트 ST 몰림; `saveBase`·첫 터치 압박 판정은 중립). **8·9·10·11 처방은 44h 판단 구조 블록(pending 43)**: ⓐ 수신자 슛 항을 리그 평균 마무리로만(`judgeSelf` 그 항만 0) → scoring 1회로 ST 몫 ↓ 확인 ⓑ 수비수 반응 지연 모델(비행 중 마커가 `markLead` 만큼 늦는 창; 목표점 이동으로는 자유가 안 생김 — 3 m 안 42 → 40%) ⓒ 그 위에 마크 배정 + 2선 박스 안 규칙 + 상황 즉시 진입(`claude/c75g-transition` 의 `defense-shape` ⑧⑨ 줄·`updateSituations` 한 줄).
- **4대 교훈(처방 때 꼭)**: ① 공격 쪽을 건드리는 패치는 **단계 A 직후 같은 시드 scoring 이 첫 관문**(E.15 가드 전부 통과해도 30골+ 가 4배 될 수 있다 — C.75j) ② 통로를 찾았어도 "그 통로를 어떤 식으로 열면 분포가 어떻게 되나"를 **상수 두 개 분해(scoring 2회)**로 먼저 잰다 — 두 측정이 Fable 한 세션보다 싸다 ③ 상황별 지표는 "누가 미마크인지" 분해부터(C.75g: 절반이 공보다 뒤 2선) ④ "재야 함"이라 적은 기준은 처방 전에 먼저 잰다(C 지연은 이미 95%) ⑤ 측정 도구 덮어쓰기(`경로=값`)는 `balance:scoring` 에 안 먹는다(워커 번들) — 작업 트리의 `config.ts` 상수를 직접 바꿔 돌린다(코드 커밋 없음).
- 다음 할 일(5대): C.75l·C.75i·C.75k 보고가 오면 확인(C.75l 은 지문 동일 + 2코어 시즌 ≤ 135초 + 800쌍 결과·역할표 변경 폭) → 44f-b 지시서는 §3.3 그대로(필요하면 §3.3 에 "지금 값" 줄 추가) → 44h 처방은 11 ⓐ 분해 측정부터.

### 이전 상태 (3대 갱신, 2026-10-20 08:50 KST · 12:20 KST 교체 요청)
- **3대 교체 요청(12:20 KST)**: 3대 대화 크기 48만 토큰(교체 기준 40만, automation 7번) → 마스터 T 에 4대 개설 요청. 4대가 처음 할 일: §8 순서로 읽고, **E-4 묶음 처방**(미해결 1~8 + 하프타임 전술 + 판단 스탯·지시 카드 신뢰 + 레전더리 35세 900+ 가드 + 패스 받는 빈도 가중)을 T 요청대로 쓴다. 3대 작업 브랜치 `claude/engine-manager-3`(ff1378d 이후)은 4대가 그대로 이어 쓰거나 `claude/engine-manager-4` 를 main 에서 새로 따고 `git merge origin/claude/engine-manager-3` 로 가져온다(둘 다 가능, docs 병합은 merge 로만). 스크래치패드 작업 트리(`wt-c75d`)는 컨테이너와 함께 사라진다 — 재현은 §4 3대 절의 `git worktree add` 로.
- 엔진 관리자 **3대** `session_017LRoCE5KxG6odpy1NX6DiN`(Fable, 제목 `엔진관리자3`, 태그 `role:engine-manager`). **마스터 세션 T** `session_01KEPYWMJvsVNyeS7vpS8kSs`(브랜치 `claude/planning-t`, 2026-10-20 10:50 KST 교체; 그 전 I → … → R → S `session_01Pi4aAWoFd5yBP3mZfCURwD`). 보고·처방은 T 로. T 예고: C.75e·C.75f 결과 뒤 **E-4 묶음 처방** 요청. 2대 `session_01ULNad1tAcSQzVKsFKN355d`(58만 토큰)는 **깨우지 않는다**(automation 7번). 교체 기준은 대화 **40만 토큰**(50만이 아니다, automation 7번 개정).
- **엔진 동결 해제** — pending 129 **44단계 엔진 다듬기 블록** 진행 중: 44a C.75a(결정 순간, 엔진 22 → 23)·44b C.75b(Web Worker 속도, 엔진 무수정) 완료. **다음 44c E-2 수비 조직**(Opus 코드 세션이 구현) → 44d E-3 평점·윙 산출 → 44e~ E-4 미해결 1~7 + 하프타임 전술 + 판단 스탯·지시 카드 신뢰 + 레전더리 35세 900+ 가드 + 패스 받는 빈도 가중. **E-2부터는 회귀 가드가 아니라 E.15 표 개선으로 판정**(pending 129).
- **44c-a 진행 중**: 코드 세션 **C.75c** `session_01TdKoUkFdRsBhsdri5dtChU`(Opus, 브랜치 `claude/c75c-defense-a`, 2026-10-20 08:52 KST 시작). 마스터 S가 v2 질문 ①~④ 권장안을 모두 승인(a/b/c 나눔, `coverBehind` 3 m, 루즈볼 둘째 커버 양 팀 대칭, CB 1대1 정지 감소 수용). 해결 어려움·진단 불일치는 그 세션이 3대에게 send_message로 보낸다. E.15 전체 표(엔진 23): 64/104 · 스탯 반응 12/15(v2 §3.1).
- **44c-b C.75d 실패 ④(10:14 KST, Opus `session_01LeJxB7wiAd18fXSorLSdHL`, 브랜치 `claude/c75d-defense-b` a3be2e1)**: 마크 배정은 수비 지표를 맞췄지만 득점 1.35 → 0.90~0.97. 3대 재진단 **`docs/engine-diagnosis-c75d.md`**: 통로는 패스 모델이 아니라 **`shotModel` 슛 압박 항**(`prob.shotPressure`=0 → 0.90 → 1.22, 블로커까지 0 → 1.29; 수비·패스 쪽 완화 10가지는 모두 0.88~1.11). 처방 = 공격 오프볼 마커 떼기(`findSpace` 재사용) + 공에서 먼 상대 느슨한 마크 + 필요시 `shotPressure` 공용 계수 1회, 통과 기준을 "5 m 안 없음 ≤ 20%"에서 **배정률 ≥ 80%**로 교체. 마스터 S 결정: **Fable fix 1회**, 실패면 미해결.
- **44d E-3 평점·윙 산출** 처방 **`docs/engine-diagnosis-e3-wing.md`**(Opus, 수비 파일과 안 겹침 → Fable fix 와 병렬 가능): NPC 윙어 0 G+A 0%이지만 **약팀 LM/RM 은 슈팅 0.41/경기·팀 슈팅 4%**(LW/RW 15%) — `defaultRole()` LM/RM 규칙 + `classicWinger` run/cross + 공격 포지션 무기여 경기 −0.3(기획 ③). 측정 도구 `scripts/diag/wing-output.ts`(새).
- **(12:15 KST) C.75e Fable fix 실패 ④**(`claude/c75e-defense-fix` 1e4eb88, `docs/engine-attempt-c75e.md`): 득점 1.29 는 맞췄지만 같은 시드 scoring(30골+ 3.10·중앙값 43·리그 1.18)·평점 가드(σ 0.68, 중원 6.2x)·Δ+8 1.59 실패. 44c-b → **미해결 8번**(`engine-issues.md`), 재진단 2 는 `engine-diagnosis-c75d.md` §3.1(틀린 것: 마커 떼기 창이 패스 비행보다 짧음, 공용 계수 `shotPressure` 는 엘리트 ST 에 몰려 분포 가드 깸). 다음 시도는 E-4 에서 "공격 수신 지점 모델 + 압박 분포" 먼저. 마스터 T 가 44c-c 진행 여부·E-4 묶음 처방을 요청할 예정.
- (10:47 KST) 마스터 S 가 두 처방의 권장안을 모두 승인하고 시작: **44c-b Fable fix C.75e** `session_017T9WF4hLi61PnoeaLCaYMv`, **44d Opus C.75f** `session_01ChTjmw46HWdDpbXUwW5RuP`(병렬). 실패 기록이 오면 3대가 다시 본다.
- 44c 지시서: **`docs/engine-diagnosis-defense-v2.md`**(3대, 엔진 23 기준 갱신, Opus 두 세션 44c-a "공으로 가는 사람은 1명, 둘째는 커버" → 44c-b "마크 배정·기억 + 라인 좁히기·진입로 차단" → 44c-c 전환 상황 B·C·D·F). 2대 원본 `engine-diagnosis-defense.md`의 §1 코드 흐름·§2 설계·§3 스탯 표는 그대로 유효.
- **커밋 규칙(3대)**: 보고서·`scripts/diag/`만, 작업 브랜치 `claude/engine-manager-3`에 푸시, **main 푸시 안 함**(코드 세션이 배포 때 `git merge origin/claude/engine-manager-3`로 docs를 가져간다 — `git checkout <브랜치> -- docs/` 금지, automation 7번).
- 버전(main 422ef05, C.75b): `PATCH_LABEL` C.75b, `STAGE_LABEL` 44단계, `ENGINE_VERSION` 23, `BALANCE_VERSION` 54, `SAVE_FORMAT_VERSION` 45. 정확한 값은 `src/version.ts`·`src/engine/config.ts`·`src/game.ts`.
- 사용량: 3대 세션 시작 때 `get_session`의 `rate_limit_info.status`가 `allowed_warning`(7일 한도 임박, 풀림 1793008800 = 2026-10-26 03:00 KST)이었다. 큰 측정은 미루고 마스터에 알린다.

## 2. 엔진 구조 지도 (어디를 보면 되는가)

| 파일 | 역할 | 자주 본 함수·상수 |
|---|---|---|
| `src/engine/sim.ts` | 10 Hz 스텝 루프, 리스타트, 루즈볼 | `executeRestart`, `updateLooseBall`; 쿨다운은 스텝 안에서 먼저 줄어든다 |
| `src/engine/core.ts` | 소유·리스타트·킥오프 배치 | `setOwner`, `setRestart`, `kickoffPositions` |
| `src/engine/offball.ts` | 오프볼 이동 전부 | `updateOffball`, `keeperTarget`(:197, rushDist 12/rushGap 1.5), `keeperChase`(C.28), `boxDefense`(:710, focusThreat+second 두 명만), `focusThreat`, `defensiveLine`, 압박자 urgent(:595) |
| `src/engine/onball.ts` | 온볼 결정 | `candidates`, `choose`, `isMistake`, `shotModel`, `passProbability`, `passDistBase`, `passSkillApply`, `pressureAt`, `nearestOpponent`(:45, **GK 포함**), `leadRiskMul`, `makePass`(:697 루즈 분기) |
| `src/engine/actions.ts` | 실행·판정 | `shoot`, `shotArrives`, `resolveFlight`, `resolveAerial`, `keeperHands`, `receiveWin`(C.29 fix2 박스 안 경합) |
| `src/engine/keeper.ts` | GK | `saveProb`, `keeperZone`, `sweepRange` |
| `src/engine/physics.ts` | 이동·착지 | `moveAgent`, `landingVelocity`(C.28에서 상한) |
| `src/engine/config.ts` | `ENGINE` 상수 전부 | `prob.*`(passBase 1.36, passPerM 0.010, longPerM 0.055, shotBase 0.665, saveBase 1.70), `tendency.*`(gegenWinMul, gegenExtra), `blockLineMax` 16.5, `leadRisk2/3`, `leadTempo2/3`, `stMarkZoneBox` |
| `src/engine/tactics.ts` | 성향·세부 전술 | `TENDENCY`, `tacticsOf(tendency, levels)`, `aiAdjust`(±2골 라인·압박), `widthCrossMul`(±10%) |
| `src/engine/rating.ts` | 경기 평점 | `ratingFromParts`, center 표 |
| `src/config/balance.ts` | 엔진 밖 밸런스 | XP, 성장, 평판 — 엔진 관리자는 보지만 고치지 않는다 |

결정 재현 요령: RNG가 `rand(seed, tick, idx, purpose, k)` 해시라서 진단 스크립트에서 같은 틱에 `candidates()`/`choose()`를 다시 불러도 경기가 바뀌지 않는다(`polish-b` 결정 분석 재현율 99.9%). 결정 틱 조건은 엔진과 똑같이 `(o.cooldown > 0 ? o.cooldown - ENGINE.time.dt : o.cooldown) <= 0 && o.line !== 0`로 잡아야 한다(처음에 0으로 나오거나 두 번 세는 실수를 했다).

## 3. 지금까지 확인한 엔진 사실 (수치로 확인한 것만)

1. **무리한 슛은 언제나 고를 수 있는 "실수"다**(B0). `isMistake` 풀에 슛이 들어 있어 ST에게 슛이 몰리고, 약팀도 먼 슛을 쏜다. `mistakeShotGap`으로 조정(C.29).
2. **판정 선방 확률 = 실제 선방 확률.** 선방률과 득점이 안 맞는 건 판정 오차가 아니라 슛 수·거리 분포 문제다.
3. **패스 곡선**(C.31 `passDistBase`): 20~30 m 92% 성공. 실패 모델은 `fail × exp(−passSkill × Δ/10)`. C.31에서 "곡선이 실력 차를 증폭한다"고 예측했는데 **틀렸다**(Δ8 패스 성공 차 2.4 → 1.6%p). 롱패스 비율과 롱패스 성공률은 곡선만으로는 맞바뀐다(빗나간 롱볼 손실이 싸다).
4. **실력 차는 곱으로 쌓인다**(B2). 패스·드리블·수신·슛·선방 각 단계 배수가 곱해져 Δ15에서 득점이 터진다. 어느 한 단계만 깎으면 동레이팅도 같이 깎인다.
5. **슛 질은 밀집에 눈이 멀었다**(crowd-blind). `pressureAt`은 가장 가까운 상대 한 명만 본다. 그래서 수비 5 m 안 인원이 0/1/2+ 여도 xG 0.104/0.108/0.111로 평평. **그러나** 밀집 압박(C.29 fix 가설 1)은 **대칭**이라 강팀보다 동레이팅을 더 깎았다(실패 ④). 비대칭을 만드는 건 밀집이 아니라 **박스 도달 횟수**(리버풀 박스 수신 73 대 21, 드리블 25 대 13, 침투 수신 12 대 3.5).
6. **리드 상태 득점**: 리버풀 골의 50%가 +2 이상에서 나왔다(동레이팅 12%). C.29 fix2 `leadRiskMul`(전진 행동 0.75/0.6)·`leadTempo`·`aiAdjust`로 3.67 → 2.95. 아직 30골+ 1.3명, 득점왕 중앙값 32.
7. **GK 루즈볼**: "닿을 수 있음" 정의가 결과를 좌우한다. 착지점까지 반응 0.5초+7 m/s 기준은 분모가 넉넉해 코너 6.2%로 보였고, 공 경로 예측 기준(reach2)으로는 0.9%. 진짜 버그는 `makePass` 루즈 분기가 착지점을 σ 6 m 옮기면서 `fl.dur`를 다시 안 구해 착지 속도 40 m/s가 나오던 것(C.28에서 고침, 지금 ≤26 m/s).
8. **경량 가드 표본 노이즈**: 평점 칸당 8명 잘라내기(nCell)에서 포지션 평균 ±0.16, WING 6.85 같은 값은 표본 오차였다(600경기 가중 평균 6.51~6.60). 지금은 칸 가중 평균 + 360경기. ST 반응 400쌍은 유효 슈팅률 표준오차 약 ±1.5%p, 120쌍 득점 반응은 ±9%. **반응 가드가 1σ 안에서 흔들리면 엔진 탓으로 확정하지 말고 800쌍 또는 시드 2벌로 재측정하라.**
9. **시즌 XP 비**: C.26 별점 평점 유산(강팀 실제 선수 평점이 center보다 높다). 1.19 → 지금 1.06으로 가드 안. 다시 튀면 `rating.ts ratingFromParts`에서 +1.5 위 압축을 보라(`engine-diagnosis-c28.md` §2).
10. **전술(C.32)**: 높은 라인·압박은 이득만 있고 비용이 없다. (a) `nearestOpponent()`가 GK를 포함해 1대1로 뛰어나오는 GK가 "압박"으로 잡혀 쓰루 리시브 뒤 3초 내 슛이 10~17%뿐 (b) `blockLineMax` 16.5로 상대 ST가 박스 안 15.5 m에 서는데 `boxDefense()`는 2명만 마크 → 블록이 실점을 늘린다 (c) 압박자는 항상 urgent, 스태미나 배수 0.95+0.15p는 ±4% (d) `widthCrossMul` ±10%는 효과가 작다. 처방·통과 기준은 `engine-diagnosis-c32.md` §3.
11. **포지션 숙련도**(12단계 C): 어댑터에서 내 선수 능력치를 균일 차감하는 방식 권장(채택됨).

### 틀렸던 예측 (같은 실수를 반복하지 않기 위해)
- C.29 가설 1(밀집 압박): 비대칭을 만들 거라 봤으나 대칭이었다. **"강팀만 깎는다"는 주장은 반드시 동레이팅 600경기와 함께 재라.**
- C.31 경고(패스 곡선이 실력 차 증폭): 일어나지 않았다.
- C.28 코너 6.2%: 엔진 문제가 아니라 측정 정의 문제였다. **측정 정의부터 의심하라.**

## 4. 미해결 목록과 내 의견 (`docs/engine-issues.md` 맨 위 기준)

1. **ST 슈팅 → 유효 슈팅률 반응** +0.90%p(하한 −0.54, 400쌍). 의견: 1σ 안이므로 **엔진을 손대기 전에 800쌍 또는 시드 2벌 재측정**. 그래도 미달이면 `shotModel`의 슈팅 스탯 기울기(결정력·침착성이 슛 정확도에 주는 폭)를 본다. `prob.passBase=1.35 prob.passPerM=0.0055 prob.longPerM=0.04 prob.longFarFrom=99` 인자로 옛 곡선과 비교할 수 있다.
2. **롱패스 비율 19%·짧은 패스 6%**: 오프볼 간격·빌드업 성향 문제라 E3.6/E3.7 범위. 상수(`longPerM`)만 올리면 롱패스 성공률이 떨어져 득점이 흔들린다.
3. **전술 매트릭스 |득실차| 1.06**: fix 진행 중(§1 지금 상태). fix 세션 보고가 오면 확인할 숫자: 쓰루 리시브 → 3초 내 슛 비율(10~17%에서 올라갔는가), 블록 상대 박스 수신·박스 안 수비 인원, 압박 높음 이동 거리(+3% 목표), 약팀 블록 실점(균형 1.60 이하), 리버풀 득점 ≤3. 가설 1이 득점을 올리면 `shotBase`/`saveBase`는 건드리지 말고 기획에 보고한다(E.15.1).
4. (해결 근처) 30골+ 시즌당 1.3명(기준 0.5~2, C.33 1.20). 다음 득점 관련 패치 때 `balance:scoring`을 다시 재면 된다.

### 2대가 더한 것 (미해결 3~7번과 수비 조직, `engine-diagnosis-c33.md`·`engine-diagnosis-defense.md`)
- **한 축**: 공격 산출은 공격 행동의 합(인원·침투·슛 선호)으로 선형으로 늘고, 수비 산출은 "가장 가까운 한 명"(`pressureAt`·수신 압박·`boxDefense` 마크 2명+자리 3곳)에서 포화된다. 그래서 몰빵 대형(미해결 5: 박스 수신 55 대 21)·면제 역할(미해결 4: 크랙형 윙어 ④ 면제는 대가 없음, CAM 면제는 −0.1~−0.2)·블록(미해결 3)이 모두 같은 원인이다. 처방: 박스 인원 맨마크(인원 조건, 중원 보충) + 수적 우위 프리맨을 최종 3분의 1 전체로 + 역할 파라미터 1회. 역할 편차는 **시드 2벌 800경기**로 판정(400경기 ±0.06은 잡음으로 2~3개가 넘는다): 구조적인 것은 크랙형 +0.13·섀도 +0.135·펄스 나인 −0.155·딥라잉 −0.13.
- **수비 조직**(사용자 "박스 들어오면 3명이 달라붙음"): 팀 계획이 없고 공으로 가는 조건 다섯 개(역압박 3명·돌파 후 커버·압박 순위 0/1·박스 안 압박 2명·2 m 안 1대1 판단)가 겹친다. 마크 배정·기억이 없어 가장 가까운 수비수가 상대 1명당 분당 21회 바뀐다. 설계: 상황 판정(G 루즈볼·H 역압박·B 역습 복귀·C 수적 열세·D 측면 트랩·F 크로스·E 박스 1대1·A 정돈, `defenseSituation()`) → 상황표가 압박 인원·협공 허용·라인을 정하는 `defensePlan()`. 지금 엔진으로 상황 빈도를 재면 A 68 / H 12 / C 8 / B 5 / F 4 / E 3%, "E 다른 위협 모두 마크됨"은 0.1%. 측정 도구 `scripts/diag/defense-shape.ts`(상황 ⑥ 포함).
- **미해결 6·7**(C.45): GK 선방률 66.2%(먼저 슛 질 상승 탓인지 분리), 직접 모드 맡기기 대 자동 결과 갈림(`defendDuels`·`forcedDuel` 난수 순서 의심). C.62 2초 경계는 기록만(냉시작 첫 경기 1.4~1.5초는 JIT).
- **틀렸던 것(3대)**: C.75d 처방에서 득점 하락 통로를 수신 압박으로 예상(실제는 슛 압박 항) · C.75e 처방에서 마커 떼기 +0.2 예상(실제 0, 마커가 0.5초 앞질러 재부착)과 `shotPressure` 공용 계수가 분포 중립일 것(실제 30골+ 0.5 → 3.1). **공용 계수로 득점 수준을 되돌리는 처방은 같은 시드 scoring 을 첫 측정으로 못 박아라**(C.29 fix·C.32 fix·C.75e 세 번째).
- **틀렸던 것(2대)**: 와이드 미드 −0.12·엔간체 −0.11은 시드 2벌에서 잡음이었다(−0.04·−0.085). 40경기 팀 지표만으로는 딥라잉 −0.13을 못 봤다 — **득실 판정은 800경기, 기전은 40경기**로 나눠 재라.

### 3대가 더한 것 (수비 조직 재측정, `engine-diagnosis-defense-v2.md`)
- **엔진 18 → 23 사이 수비 오프볼 코드·상수는 무변경**(`git diff origin/claude/engine-diag-defense origin/main -- src/engine/offball.ts` 빈 출력; 바뀐 건 날씨·약발·상대 분석 실행 배율과 결정 순간). 2대 측정은 ±1~3%p로 재현된다(박스 2명+ 43%, 3명+ 10%, 5 m 안 없음 34%, 교체 20.6/분).
- **새 분해 ⑦(`defense-shape` 추가)**: 박스 안에서 공 3 m 안에 2명 이상일 때 그 수비수의 **79%는 E.23 "박스 안 압박 2명" 규칙**(`defendTarget` `ownBox && rank < 2`), 박스 밖 25 m 안에서는 **84%가 압박 rank 0·1**. 역압박 6%·돌파 후 커버 4%·GK 돌진 13%(표본). 셋째 사람은 `boxDefense` 둘째 마커(수비 줄)·중원 존 "근처 마크"(소유자를 빼지 않음)·GK. → 2대의 "조건 다섯 개가 겹친다"는 맞지만 기여는 한 규칙에 몰려 있어 **첫 패치를 Opus 크기로 좁힐 수 있다**.
- 동레이팅 600경기(엔진 23): 득점 1.32, 선방률 67.2(✗), 판단 태클 22.1, 드리블 성공률 43.2, 인터셉트 14.9, **Δ+8 1.65(✗ 1.8~2.4, C.31 1.86에서 내려옴 — E-2 범위 밖, 마스터에 기록)**. 몰빵 35번 박스 수신 52.3 대 18.2(2대 55 대 21 그대로).
- **득점 절벽 분해 요령(C.75d)**: 원인 후보 상수를 `tactic-pair 300 75:75 balanced 경로=값` 으로 하나씩 0 으로 끄며 득점을 비교하면 3분에 한 가설을 가른다(표본 오차 ±0.07). 작업 브랜치는 `git worktree add <스크래치>/wt-<이름> origin/<브랜치>` + `node_modules` 심링크로 꺼내 돌린다. 단 `scripts/engine/pool.ts` 워커 번들 출력(`node_modules/.cache/engine-harness/worker.mjs`)이 공유되므로 main 과 작업 트리의 `tactic-pair`·`balance:*` 를 **동시에 돌리지 않는다**. `pkill -f` 는 자기 셸 명령줄까지 맞춰 죽이므로(exit 144 두 번) PID 로 죽인다.
- **측정 도구 주의**: ① `scripts/diag/defense-shape.ts`는 2대 브랜치 `claude/engine-diag-defense`에만 있었고 main에 없었다 — 3대 브랜치에 ⑦을 더해 다시 넣었다. ② `polish-b.ts`는 C.45 뒤 가짜 리그 GK에 `body`가 없어 `saveProb`에서 죽었다 — `NEUTRAL_MODS`로 고쳤다(다른 진단 스크립트도 `Agent`를 손으로 만들면 같은 함정). ③ 컨테이너 클론은 shallow라 옛 커밋(03dd8bf 등)을 직접 볼 수 없다 — 엔진 18 기준은 `origin/claude/engine-diag-defense`(코드 무수정 브랜치)를 쓴다. ④ 세션 작업 프로세스가 재시작되면 백그라운드 측정이 죽는다(`balance:engine` 10분짜리가 한 번 끊김) — 긴 측정은 결과 파일에 `exit` 줄을 남기고, 재시작 뒤 `exit` 줄이 없으면 다시 돌린다.

## 5. 측정 도구 요령

모든 스크립트는 `npx vite-node <스크립트> -- <인자>`. `경로=값` 인자(예: `prob.passBase=1.35`)는 `ENGINE` 상수를 그 실행에서만 덮어쓴다(`polish-b`, `pass-dist`, `tactic-pair`).

| 명령 | 무엇을 재나 | 시간 |
|---|---|---|
| `polish-b.ts -- gap 40` | 생성 4-2-3-1 균형 Δ0/8/15, 측면별 득점·슈팅·xG·선방·거리 구간·결정 분석·골 경로·롱패스 출처·파울·침투·박스 수신 마크·점수 차별 골·거리·스태미나·패스 구간·판정 대 실제 선방 | 약 2분 |
| `polish-b.ts -- liv 40 liv A` | 실제 로스터 팀(기본 liv) 대 중위 10팀, 변형 A~F(A = 그대로) | 40경기 1.5분, 120경기 4분 |
| `polish-b.ts -- tac 40 [전술…]` | 생성 75 대 75, 4-4-2, 홈 전술 대 원정(`VS` 환경변수, 기본 balanced). 전술 표기 `성향@라인압박빌드업폭`(예 `balanced@2111`). 생략하면 7개 전술 | 7개 5분 |
| `polish-a.ts -- 60 78 76` | 순간이동 센서스(1.0 m/틱), 골→킥오프 대기, GK 루즈볼 에피소드(굴러옴/루즈 비행 착지, 공 경로 예측 기준 "닿을 수 있음"), 추격·침투, 착지 속도. `GKTYPE=sweeper|classic` | 약 1.5분 |
| `tactic-pair.ts -- 200 gegenpress balanced@2111 …` | 균형 상대 득실차. `70:78 block …`으로 약팀 | 200경기 4분 |
| `pass-dist.ts -- 40 76 76` | 거리 구간별 패스 시도·성공률 | 40초 |
| `rating-parts.ts -- 600 parts.json` | 평점 성분 큰 표본(경량 가드가 의심될 때) | 수 분 |
| `defense-shape.ts -- 40 4-2-3-1 [홈전술 원정전술]` | 수비 조직 ①~⑦(공 3 m 안 인원, 줄, 마크, 교체, 목표 분류, 상황 A~H 빈도, 분기 추정) | 약 1분 |
| `SWEEP_N=600 SWEEP_D=200 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick` | 동레이팅·Δ8 기준값(득점 1.35±0.1, 유효 4.2, 선방 68~71) | 2~3분 |
| `SWEEP_N=40 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 SWEEP_RESP=400 SWEEP_RESPKEYS=st_shoot npm run balance:quick` | 스탯 반응 400쌍(`SWEEP_RESPKEYS`로 키 선택). `SWEEP_N=0`이면 반응 행이 안 나온다 | 수 분 |
| `SWEEP_N=0 … SWEEP_TAC=200 npm run balance:quick` | 세부 전술 반응 9개 | 6분 |
| `npm run balance:engine:check` | 경량 가드 전체(평점 360경기, 시즌 12개) | 3~7분 |
| `npm run balance:scoring` | 10시즌 득점 분포(30골+, 득점왕 중앙값, 최다 팀, 리그 득점) | 7~11분 |
| `MATRIX=50 RECHECK=100 INTER=100 WEAK=200 npm run balance:sweep -- --tactics` | 6×6 성향 매트릭스 + 약팀 블록 + 상호작용 | 11분 |

요령:
- 긴 것은 `run_in_background`로 돌리고 출력을 스크래치패드 파일로 받은 뒤 `grep`으로 필요한 줄만 읽는다. 1대 세션 출력은 `/tmp/claude-0/-home-user-football/1d90617a-c058-5650-b0de-f696eb21025e/scratchpad/`(gap40*, liv40*, c28-*, c29-*, c32-tac.txt, parts600.json)에 있지만 컨테이너가 바뀌면 사라진다.
- 새 지표를 `polish-b`에 넣을 때 `Side` 인터페이스에 필드를 추가하고 `side()`·`report()`에 같이 넣는다. 교체 선수가 있으므로 선수별 상태는 `prev[a.idx]` 같은 배열 대신 `Map<Agent, …>`을 쓴다. 경기 끝 필터는 `a.leftAt === null`이 아니라 `a.onPitch`.
- fix 브랜치와 `main`을 비교할 때는 **같은 시드**로 돌린다(`same-seed.ts`). 표본 오차(§3 8번)를 먼저 적고 비교한다.
- 리버풀 수치는 변형 A(그대로)가 기준. 다른 변형(B~F)은 공격진 교체 실험용.

- **(C.76a 교훈) 여러 worktree 에서 워커 측정을 병렬로 돌릴 때**: `scripts/engine/pool.ts` 가 워커 번들을 `node_modules/.cache/engine-harness/worker.mjs` 에 쓴다. worktree 의 `node_modules` 를 symlink 로 공유하면 **마지막에 빌드한 설정이 다른 worktree 의 워커에도 들어가 결과가 섞인다**(C.76a E 측정: 다른 상수의 두 scoring 이 완전히 같은 수치). worktree 마다 `node_modules` 를 디렉터리로 만들고 안의 패키지만 symlink, `.cache` 는 따로 둔다(`npm run balance:quick`·`scoring`·`engine:check` 모두 해당, `polish-b`·`defense-shape`·`same-seed` 는 메인 스레드라 무관). 그리고 `pgrep -f`/`pkill -f` 패턴이 자기 셸 명령줄과 겹치면 자기 셸이 죽는다(패턴은 `[v]ite-node` 식으로).
- **(C.76a) 1대1 비율은 `gap 120` 으로도 ±6%p**(12 m 안 팀당 50~80 표본): 같은 설정 두 번이 골 27 ↔ 23, 빗나감 37 ↔ 50. `gap 240` 이상이거나 두 번을 합산해 읽는다.

## 6. 보고서 쓰는 법 (1대가 쓴 것 중 통한 것)

- 맨 위 "한 줄 결론"과 사용자용 요약 10줄 이내. 원인마다 `파일:줄 함수` 한 개와 수치 한 개.
- 가설은 **파일·함수·상수 단위로 좁게**, 가설마다 예상 측정 횟수와 모델(Opus 고속/Fable). 좁게 쓴 처방(C.28, C.32)은 Opus가 바로 구현했고, 구조 처방(C.29 가설 1)은 Fable도 실패했다.
- 통과 기준에는 "넓히는 안"을 같이 적는다(예: 0.3 → 0.5). 기획이 결정할 수 있게 질문마다 권장안 1개.
- 재진단 때는 "진단의 틀린 부분"을 먼저 쓴다(§3.1 식). fix 세션 질문에는 번호대로 답한다.
- 기획 세션에 보내는 메시지는 보고서 경로·커밋·가설 요약·질문 2개 이내·시각 꼬리. 코드/fix 세션에는 경로와 재현 명령만 짧게.

## 7. 문서 위치

- 진단 보고서: `docs/engine-diagnosis-12.md`(12단계 A/B/C 전체), `engine-diagnosis-C.28.md`(C.28 1차), `engine-diagnosis-c28.md`(C.28 2차, 브랜치 `claude/c28-gk-loose-ball`에서 작성 → main), `engine-diagnosis-c29.md`(측정·처방·재진단·C.31 주의), `engine-diagnosis-c32.md`(전술), `engine-diagnosis-c33.md`(역할 득실·커스텀 몰빵, 2대), `engine-diagnosis-defense.md`(수비 조직 상황 판정 설계, 2대), **`engine-diagnosis-defense-v2.md`(엔진 23 재측정 + Opus a/b 처방, 3대 — 44c 지시서)**. 2대 측정 모드: `polish-b.ts -- cells/role`, `role-pair.ts SEED=`, `defense-shape.ts`.
- 미해결·패치별 재현 명령: `docs/engine-issues.md`. 매트릭스 전체: `docs/engine-tactics.md`. 스윕 결과: `docs/engine-sweep.md`, `docs/engine-report.md`.
- 기획서 부록 C(패치 기록)·E(엔진)·E.15/E.15.1(원칙): `docs/game-design.md`. 기획 보류 목록: `docs/planning-pending.md`.

## 8. 다음 엔진 관리자 세션이 처음 할 일

1. `CLAUDE.md` → `docs/automation.md`(0번 마스터·main 푸시 규칙, 5번 동결) → 이 문서 → `docs/engine-issues.md` 미해결 목록 순으로 읽는다. 지금 마스터 세션(§1 지금 상태)에 세션 ID를 알리고 `automation.md` 1번 4항의 엔진 관리자 ID 갱신을 요청한다(마스터가 고친다). `npm ci`가 안 돼 있으면 먼저 한다(컨테이너마다 새로).
2. (4대 갱신) 지금 지시서는 **`engine-diagnosis-e4.md`**(§2.8·§6.6 재진단 포함)다. 44c 원안은 `engine-diagnosis-defense-v2.md`가 지시서다(Opus 44c-a → 44c-b → 44c-c). 코드 세션이 "해결 어려움"·"진단 불일치"를 보내오면 같은 문서에 §재진단을 더한다. 44c-a 결과가 오면 먼저 볼 것: `defense-shape` ⑦ 박스 압박 분기 79% → 얼마로, 박스 3명+ ≤ 3%, 득점 1.25~1.45. 44c-b는 같은 시드 `balance:scoring` 30골+ ≤ 2가 첫 관문. 44d E-3·44e~ E-4(미해결 1~7)는 `engine-diagnosis-c33.md` §3·`engine-issues.md` 처방.
3. 다음 엔진 패치 시작 요청이 오면 §4 1번(ST 반응 재측정 800쌍)을 그 패치 측정에 끼워 넣자고 제안한다.
4. 대화가 40만 토큰을 넘으면 이 문서의 §1 지금 상태·§4 절을 갱신하고 마스터에 교체를 요청한다.

명령 시각 2026-10-16 19:24 KST / 작성 시각 2026-10-16 19:27 KST · 2대 갱신 명령 시각 2026-10-19 20:02 KST / 작성 시각 2026-10-19 20:04 KST · 3대 갱신 명령 시각 2026-10-20 05:10 KST / 작성 시각 2026-10-20 08:50 KST · 3대 2차 갱신(C.75d·E-3) 10:47 KST · 3차(C.75e 실패·미해결 8) 12:22 KST
