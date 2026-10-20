# E-4 묶음 처방 (엔진 관리자 4대) — 44c-c 지시서 + 44e·44f·44g 나눔

> 대상: `main` 4aed8b8(C.75c, **엔진 24**) → (13:02 KST 갱신) C.75f 부분 해결 배포 **main eea9ac8 엔진 25**(평점 무기여 −0.3만, LM/RM 슈팅은 **미해결 9** → §2.5a 로 44e 에 흡수). 미배포 브랜치: `claude/c75d-defense-b`(마크 배정 1차), `claude/c75e-defense-fix`(마크 배정 2차 + 떼기 + 느슨 마크, **마크 코드의 최신본**, `scripts/diag/mark-plan.ts` 포함).
> 범위: `docs/engine-issues.md` 미해결 1~8 + pending 129 끝 E-4 항목(맡기기 판단 스탯 연동 · 자동 경기 결정 순간 카드 금지 · 카드 강화 · 리셋 카드 즉발 · 하프타임 전술 변경 · 판단 스탯 생활 영향 · 지시 카드 신뢰 연동 · 패스 받는 빈도 가중 재검토 · 레전더리 35세 900+ 가드 경계 · 몰고 가다 슛 · 결과 불변 엔진 속도 패치).
> 양식: automation.md 3번(통과 기준 · 가설 ≤ 3 · 재현 명령과 현재 값 · 모델 의견). 측정은 이 문서를 쓰면서 `defense-shape 40 4-2-3-1` 1회만 돌렸고(엔진 24 상황별 기준값), 나머지 현재 값은 C.75d·C.75e·defense-v2 기록을 그대로 쓴다(한도 임박, automation 7번).

## 한 줄 결론

E-4 는 **엔진을 고치는 두 패치(44e Fable → 44f Opus)**와 **엔진 결과를 바꾸지 않는 두 패치(44g-a 카드·결정 순간, 44g-b 하프타임·몰고 가다 슛·가드, 둘 다 Opus)**로 나눈다. 44g 두 개는 자동 경기 지문(`same-seed.ts`)이 그대로여야 하므로 **지금 바로, C.75f·44c-c 와 병렬**로 열 수 있다. 엔진 쪽은 44c-c(전환 상황, Opus) → 44e → 44f 순서로 하나씩. 44e 의 핵심은 C.75d·C.75e 가 가르쳐 준 것 하나다: 마크를 붙이면 득점이 빠지는 통로는 슛 압박 항인데, **받은 뒤 다음 결정까지 1.2~1.4초(`ball.receiveTime` 0.9 + 반응)가 걸려 마커가 그 사이 다시 붙는다**. 그래서 ① 패스 목표점을 마커 반대쪽으로 2 m 옮기고(수신 지점 모델) ② **첫 터치 슛은 받는 순간의 압박으로 판정**(압박 분포)하고 ③ 2선 늦은 침투자는 박스에 들어온 뒤에만 마크한다 — 이 셋을 **먼저 엔진 24(마크 없음)에 넣어 득점이 1.5 를 넘지 않는지 보고**, 그 위에 C.75e 의 마크 배정을 올린다. 득점 수준은 `shotPressure`·`shotBase`·`saveBase` 가 아니라 이 셋으로 되살리고, **같은 시드 `balance:scoring` 을 첫 관문**으로 둔다(C.29 fix·C.32 fix·C.75e 교훈).

사용자용 요약:
1. 수비가 사람을 맡으면 골이 3분의 1 빠지던 문제(미해결 8)는 "공격수가 받고 나서 1초 넘게 생각하는 동안 마커가 다시 붙는" 구조 때문이었다. 받자마자 쏘는 슛은 받는 순간의 압박으로 판정하고, 패스는 마커 반대쪽으로 보낸다(44e).
2. 자동 경기는 결정 순간 카드를 안 쓰고(패시브 장착만 자동), 직접 모드 카드는 세게, 리셋은 바로 효과, 맡기기는 판단 스탯이 낮으면 가끔 미끄러진다(44g-a). 이걸로 미해결 7(맡기기 ≠ 자동)도 정의상 사라진다.
3. 하프타임에 전술을 바꾸고, "몰고 가다 슛"을 넣고, 네 번 흔들린 레전더리 35세 가드는 표본을 두 배로 늘려 고친다(44g-b).
4. 속도(결과 그대로 10~20%)·ST 반응 재측정·역할 득실·GK 선방률·롱패스 비율은 44e 뒤 44f 에서 Opus 가 상수 단위로 본다.
5. 44c-c(전환 상황 B·C·D·F)는 §6 지시서대로 Opus 가 먼저 한다. 마크 배정 코드가 필요한 항목(F 박스 1:1, B 빈 쪽 마크)은 뺐다.

## 0. 파일 영역과 병렬 가능 여부

| 패치 | 모델 | 손대는 파일 | 자동 경기 지문 | 병렬 |
|---|---|---|---|---|
| **44c-c** 전환 상황 B·C·D·F | Opus(a 크기) | `offball.ts defendTarget()`·`config.ts offball.plan.sit`·`actions.ts duelOdds()` 1줄·`scripts/diag/defense-shape.ts` | 바뀜(수비 위치) | C.75f 와 `offball.ts` 겹침(finalThirdJob :707 ↔ defendTarget :733, 다른 함수) → 병합 쉬움. **44e 보다 먼저** |
| **44e** 수신 지점·압박 분포·마크 배정 | **Fable** | `onball.ts candidates()·shotModel()`·`actions.ts resolveFlight() receive`·`core.ts setOwner()`·`offball.ts`(C.75e `updateMarks/markTarget/laneSpot` 이식)·`state.ts Agent`·`config.ts` | 바뀜 | 44c-c 뒤. 44g 와 파일 안 겹침(`moments.ts`·`cards.ts` 안 만짐) |
| **44f-a** 결과 불변 속도 + 미해결 1·4 | Opus | `offball.ts`(팀 단위 캐시)·`setPieceTarget()`·`onball.ts candidates()` 상대 배열·`roles.ts ROLES` 표 | **커밋 1 은 지문 동일**, 커밋 2(역할표)만 바뀜 | 44e 뒤 |
| **44f-b** 미해결 6·2·3 나머지 | Opus | `config.ts keeper.saveBase`·`offball.supportMin/Max`·`physics` 압박 소모 | 바뀜 | 44f-a 뒤(saveBase 는 마지막) |
| **44g-a** 카드·결정 순간 | Opus | `moments.ts`·`engine/cards.ts`·`sim.ts applyChoice()`·`adapter.ts`·`config/cards.ts`·`config/balance.ts cards`·`game.ts`(신뢰도)·`life.ts`·`ui/views/moment.ts`·`ui/main.ts` | **동일**(내 선수 없는 경기; 내 선수 경기는 B안이면 바뀜, §4) | **지금, C.75f·44c-c 와 병렬** |
| **44g-b** 하프타임·몰고 가다 슛·가드 | Opus | `sim.ts step()` 하프타임 정지·`adapter.ts MyMatchRun`·`moments.ts`(carryShoot)·`ui/views/tactics.ts` 재사용·`scripts/balance.ts` | **동일**(직접 모드 전용) | **지금, 44g-a 와도 병렬**(`moments.ts` 겹침은 함수 단위) |

병합 순서(main): 44g-a·44g-b 는 끝나는 대로(지문 동일 확인 뒤), 엔진 쪽은 44c-c → 44e → 44f-a → 44f-b. `ENGINE_VERSION` 은 결과가 바뀌는 패치마다 +1(44f-a 커밋 1 은 올리지 않음, C.75b 와 같이).

## 1. 패치 표 (한눈에)

| | 44c-c | 44e | 44f-a / 44f-b | 44g-a | 44g-b |
|---|---|---|---|---|---|
| 푸는 것 | 수비 상황 B·C·D·F 행동 | 미해결 **8**(마크 ↔ 득점)·**5**(몰빵)·**3** 블록 행·2(짧은 패스 일부)·**9**(LM/RM, §2.5a 1줄) | **1** ST 반응·**4** 역할·속도 / **6** 선방률·**2** 롱패스·**3** 압박 비용 | **7** 맡기기 + 자동 카드 금지·카드 강화·리셋 즉발·맡기기 판단 스탯·지시 카드 신뢰·판단 스탯 생활 영향·패스 받는 빈도 재분류 | 하프타임 전술·몰고 가다 슛·레전더리 35세 가드 |
| 모델·예산 | Opus 2시간·측정 6회 | **Fable 3시간·측정 8회·25달러**(마스터 결정, 기본 2시간·6회·20달러) | Opus 2시간·6회 ×2 | Opus 2시간(a/b 나눌 수 있음) | Opus 2시간 |
| **첫 측정** | `defense-shape 40 4-2-3-1` ⑥ 상황별 + `tactic-pair 300 75:75 balanced` | **단계 A**(마크 없이 수신 모델만) `tactic-pair 300` → ≤ 1.50 확인 → **단계 B**(마크 켬) `tactic-pair 300` ≥ 1.15 → **같은 시드 `balance:scoring`**(30골+ ≤ 2 · 리그 1.3~1.5 · 중앙값 25~35) | a: `same-seed 30` 지문 = main → `c75b-speed` / b: `polish-b gap 40` 판정 대 실제 선방 분리 | `npm run balance:cards -- 3 10` 봇 − 자동(카드 없음) 격차 · `same-seed 30` 지문 | 하프타임 "변경 없음" = 자동 결과 동일(`tests/c75a` 식) · `same-seed 30` |
| 가드 | §6 | §2 | §3 | §4 | §5 |

## 2. 44e (Fable): 공격 수신 지점 모델 + 압박 분포 + 마크 배정 — 미해결 8·5·3(블록)·2(일부)

### 2.1 왜 이 순서인가 (C.75d·C.75e 에서 확인된 것)
- 통로는 `shotModel()` 의 `prob.shotPressure` × `pressureAt`(3 m 안 가장 가까운 상대)이다(`engine-diagnosis-c75d.md` §1: 압박 항 0 → 0.90 → 1.22).
- 공격 쪽 "마커 떼기"(C.75e 가설 1)는 효과가 없었다(0.88): 마커가 `markLead` 0.5초 + 재배정 1초로 따라오고, **받은 선수는 `setOwner()` 에서 `cooldown = ball.receiveTime 0.9 + 반응 × 0.5` ≈ 1.2~1.4초 뒤에야 다음 결정을 한다**(`core.ts:63`, 컷백·레이오프 `quick` 만 반응 시간). 그 사이 마커는 다시 2 m 안이다. 받는 순간 자유로웠는지는 슛 판정에 **아무 영향이 없다** — 이것이 "압박 분포" 문제의 실체다.
- `shotPressure` 공용 계수는 마무리 배수 몫을 키워 엘리트 ST 에 몰린다(30골+ 0.5 → 3.1). **계수로 되살리지 않는다.**
- 마크 배정은 중원 평점(CDM/CM/CAM −0.25)·Δ+8(1.85 → 1.59)·인터셉트(15 → 17.3)도 깎았다. 가드에 넣는다.

### 2.2 통과 기준 (지금 = 엔진 24 / C.75e 브랜치 → 목표)
**E.15 표**(`SWEEP_N=600 SWEEP_D=200 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick`): 득점 **1.25~1.45**(엔진 24 1.35 / C.75e 1.29) · 유효 슈팅 **≥ 3.8**(4.0 / 4.2) · 슈팅 11.5~13 · 선방률 ≥ 66.8(내려가지 않음) · **인터셉트 ≤ 16.0**(15.1 / 17.3 ✗) · 판단 태클 15~18 · 드리블 성공률 ≥ 45 · **Δ+8 ≥ 1.75**(1.85 / 1.59 ✗) · 공이 살아 있는 시간 ≥ 52분.
**같은 시드 `balance:scoring`(첫 관문)**: 30골+ **≤ 2**(엔진 24 0.80 / C.75e 3.10 ✗) · 득점왕 중앙값 **25~35**(29.5 / 43 ✗) · 리그 경기당 득점 **1.3~1.5**(1.38 / 1.18 ✗).
**경량 가드 `balance:engine:check`**: 평점 σ **≥ 0.70**(0.71 / 0.68 ✗) · **CDM·CM·CAM 평균 6.3~6.7**(6.50·6.50·6.40 / 6.25·6.21·6.26 ✗) · Δ+8 가드(1.92 / 1.57) · ST 슈팅 반응 방향 · CB 태클·마킹 반응 유지 · 순간이동 0 · 결정성(같은 시드 2회 같은 지문) · 계산 2초(C.75e 605 ms).
**수비 조직**(`mark-plan 20 4-2-3-1 balanced balanced` + `defense-shape 40 4-2-3-1`): 배정률(골 35 m 안 공격수 중 맡은 수비수 있음) **≥ 80%**(C.75e 98%) · 맡은 수비수 교체 **≤ 8/분, 정의 바꿈 = 위험 순위 1~3 상대만 셈**(C.75e 7.2, 전체 기준 ≤ 6 은 기억 상수로 불가 — §3.1 재진단 3) · 35 m 안 한 상대 2.5 m 안 2명+ ≤ 3%(4%) · 박스 안 공 3 m 안 3명+ ≤ 3% / 2명+ ≤ 25%(2 / 18%) · 5 m 안 수비 없음 **≤ 25%**(24%) · 상황 빈도 ±5%p.
**부수 효과(기록, 미해결 5·3)**: `polish-b cells 40 35 base` 몰빵 대형 35번 박스 수신 **52.3 → ≤ 35**, 받는 순간 1.5 m 안 6% → ≥ 20% · `tactic-pair 200 70:78 block balanced` 약팀 블록 실점 ≤ 균형(1.60) · `pass-dist 40 76 76` 0~10 m 패스 비중 6.3% → 기록(수신 지점 모델이 짧은 패스를 늘리는지).

### 2.3 가설 1 (주, 공격 — 수신 지점 모델): `src/engine/onball.ts candidates()` 패스 목표점
- 지금(:405) `tx = r.x + r.vx × leadTime(0.6)`, `ty` 같음 — **마커와 무관**. 침투(`running`)는 라인 뒤 깊이로 따로.
- 바꿈: 침투가 아닌 수신자 r 에 대해 `nearestOutfield(s, r, tx, ty)` 가 `recv.shiftDist`(3 m) 안이면 목표점을 그 상대의 **반대쪽으로 `recv.shift`(2 m)** 옮긴다. 방향 = (목표점 − 상대) 단위 벡터를 **패스 선에 수직인 성분 우선**(패스 거리를 안 늘림), 오프사이드 라인 안(`toNorm(tx)[0] ≤ line − 0.5/L`, 지금 `findSpace` 와 같은 처리), 피치 안 clamp. 역할 자리(near/far/backPost/cutback) 수신자도 같이(2 m 는 자리 의미를 안 깨뜬다).
- 받는 선수는 비행 중 이미 `fl.toX, fl.toY` 로 뛴다(`offball.ts:351`) — 목표점만 옮기면 "비행 중 수신자 이동"은 저절로 된다. `passProbability` 는 옮긴 점으로 계산(레인 위험·수신 압박 `rp` 가 그 점 기준이라 성공 확률이 조금 오르는 것이 정상 — 판정식 상수는 그대로).
- 상수: `ENGINE.onball.recv = { shiftDist: 3, shift: 2, maxOffside: 0.5 }`.
- 예상: 받는 순간 3 m 안 상대 비율(`mark-plan` 줄) 47~55% → **30~35%**. 마크 없는 엔진 24 에서는 득점 +0.03~0.08(존 수비 상대 2~3 m 를 벗어나는 효과만).

### 2.4 가설 2 (주, 압박 분포 — 첫 터치 슛은 받는 순간의 압박으로): `actions.ts resolveFlight() case 'receive'` + `onball.ts shotModel()`
- 바꿈 ①: 받는 순간(`resolveFlight` `case 'receive'`, :918) `a.recvPress = pressureAt(s, a)`, `a.recvT = s.t` 를 저장(`state.ts Agent` 필드 2개, `setOwner` 에서 `recvPress = 1`(= 압박 가정 없음 상태) 초기화는 하지 않고 `gotBy` 로 구분).
- 바꿈 ②: `shotModel(s, a, header, at)` 에서 `at` 이 없고(`a` 가 소유자 자신) `a.gotBy === 'receive' && a.carryN === 0 && s.t − a.recvT ≤ recv.firstTouch(1.6초)` 이면 `pressure = Math.min(pressureAt(now), a.recvPress)`. 즉 **받고 몰지 않고 바로 쏘는 슛은 받는 순간의 압박으로 판정**한다(실제 축구의 원터치·투터치 마무리). 몰고 가면(`carryN > 0`) 지금 그대로.
- `candidates()` 의 슛 효용은 `shotModel` 을 그대로 쓰므로 자유롭게 받은 슈터는 슛을 더 고른다(C.75d 에서 빠진 슈팅 수 12.5 → 9.9 가 돌아오는 자리). 수신 지점 모델(가설 1)과 곱해져 "자유롭게 받음 → 바로 쏨" 사슬이 된다.
- E.15.1: 판정 **시점**의 입력만 바꾸고 식·계수는 그대로. 모든 선수 공통(엘리트 ST 에 몰리지 않는지는 scoring 관문으로 확인 — 마무리 배수 몫이 바뀌지 않으므로 C.75e 가설 3 과 다르다).
- 상수: `recv.firstTouch` 1.6(= receiveTime 0.9 + 반응 상한 0.65, 한 번의 결정만 덮는다).
- 예상: 마크 켠 상태 득점 +0.15~0.25(압박 항이 "모든 슛"에서 "몰고 간 슛"으로 줄어든다), 엔진 24 에서 +0.05 안팎.

### 2.5 가설 3 (주, 수비 — 마크 배정 이식 + 2선 늦은 침투자 제외): `src/engine/offball.ts`
- `claude/c75e-defense-fix` 의 `updateMarks()`·`markTarget()`·`laneSpot()`·`Agent.markIdx/markUntil`·`plan.*` 상수(`reassignInterval` 1.0, `reassignFast` 0.7, `switchMargin` 4, `switchFast` 3, `markTightBall` 12, `markFarRamp` 6, `markFar` 3.5)·`tests/c75e.test.ts`·`scripts/diag/mark-plan.ts` 를 **그대로 가져온다**(`shakeSpot`·`shake.*` 는 가져오지 않음 — 효과 없음 확인). `coverBehind` 는 main 의 5 가 아니라 **3**(마스터 승인, `config.ts:291`).
- 새 규칙 하나: 배정 후보에서 **2선(line 2) 공격수는 박스(+3 m) 밖에 있으면 뺀다**(`plan.markMidsOutsideBox: false`). 늦게 박스로 들어오는 2선은 들어온 뒤 `reassignInterval` 1초 뒤에 배정된다 — 컷백·늦은 침투 수신 창. 실제 수비도 2선은 존으로 보고 들어오면 넘겨받는다.
- 테스트 충돌: `tests/realism2.test.ts` "수비 주의 집중 … 박스 안이면 1명이 더 붙는다"는 설계 변경이라 **배정 기준(맡은 수비수 1명 + 커버 1명)으로 고친다**(C.75e 기록). `highlights.test.ts` 장면 시드는 C.75c 때처럼 조정.
- 예상: 단계 A(마크 없음) 득점 위에서 마크를 켜면 −0.15~−0.25(C.75d 는 −0.40): 1.40~1.48 → **1.20~1.30**.

### 2.5a 가설 4 (보조, 1줄 — 미해결 9 LM/RM 슈팅 비중): `src/engine/offball.ts finalThirdJob()`
- C.75f(44d, main eea9ac8 엔진 25)가 못 한 것: 4-4-2 LM/RM 슈팅 비중 3~4%(목표 ≥ 10%). 역할 값(가설 1)은 효과가 없었고 원인은 **같은 쪽 측면 공일 때 `finalThirdJob` 이 윙어 자리 유지(`null`)**를 돌려 LM/RM 이 박스 밖에 머무는 것(`engine-diagnosis-e3-wing.md` 가설 3). 44e 와 같은 공격 오프볼 축이고 같은 파일이라 **44e 에 넣는다**(44f-b 아님): LM/RM(line 2)이고 소유자가 자기보다 터치라인 쪽·앞이면 `'edge'`(박스 모서리 컷백 존). LW/RW 그대로.
- 가설 3 의 "2선은 박스 안에서만 마크" 규칙과 맞물린다(LM/RM 이 edge 로 들어오면 박스 밖이라 마크 없음 → 컷백 수신 창). 따로 재야 하는 이유.
- 측정: `npx vite-node scripts/diag/wing-output.ts -- wing-0 20`(5분, 백그라운드, 단계 B 뒤 1회 — 예산 8회에 더해 **+1회**): LM/RM 슈팅 0.4 → ≥ 0.8/경기, 비중 4 → ≥ 10%, LW/RW 중앙값 12~16 유지. 득점 가드는 공통 측정으로 본다.

### 2.6 순서·측정·실패 판정
1. **단계 A** = 가설 1 + 2 만(마크 코드 없음, 엔진 24 위): `tactic-pair 300 75:75 balanced` [측정 1] — 득점 **1.30~1.50**, 슈팅 12.5~14. 1.50 을 넘으면 `recv.shift` 2 → 1.5 또는 `firstTouch` 1.6 → 1.2 로 1회 [측정 2]. 1.55 를 넘는 상태로 다음 단계로 가지 않는다(가드 상한 1.45 는 600경기 기준).
2. **단계 B** = + 가설 3(마크 켬): `tactic-pair 300` [측정 3] 득점 **≥ 1.15** · `mark-plan 20` + `defense-shape 40` [측정 4] 배정률 ≥ 80%, 5 m 안 없음 ≤ 25%, 3 m 안 수비 있음(받는 순간) ≤ 35%. 모자라면 조정 1회: `recv.shift` 2 → 3, `plan.markFar` 3.5 → 4.5, `markGoalSide` 2 → 2.5 중 하나 [측정 5].
3. **같은 시드 `balance:scoring`** [측정 6]: 30골+ ≤ 2 · 리그 1.3~1.5 · 중앙값 25~35. **여기서 깨지면 가설 2 의 `firstTouch` 를 먼저 줄인다**(압박 분포 쪽이 엘리트에 몰렸는지 ST 슈팅 반응 수치로 확인), `shotPressure`·`shotBase`·`saveBase` 는 손대지 않는다.
4. `balance:quick 600` [측정 7] E.15 행 전체 + `balance:engine:check` [측정 8] 평점 σ·CDM/CM/CAM·Δ+8. 시간이 남으면 `polish-b cells 40 35 base`(미해결 5)·`tactic-pair 200 70:78 block balanced`(미해결 3 블록 행)·`pass-dist 40 76 76`.
- **실패 판정**: ① 단계 A 에서 득점이 1.35 → 1.30~1.50 범위를 벗어나 1.55 초과(수신 모델이 과함) 또는 1.30 미만(진단 불일치 ⑤ — 받는 순간 압박이 통로가 아님) → 엔진 관리자에게 되돌림 ② 단계 B 조정 뒤에도 득점 < 1.15 → 마크 배정은 브랜치에 두고 **단계 A 만 배포 후보**(scoring·quick·engine:check 통과 시, "공격 수신 모델 부분 해결") ③ scoring 이 두 번 깨지면 ④ → 미해결 8 유지, 단계 A 만 배포 판단은 마스터.
- **부분 해결 기준**(권장): 득점 1.20~1.25 + 유효 ≥ 3.6 + 배정률 ≥ 80% + scoring·평점 가드 통과 → 배포, 나머지(Δ+8·인터셉트)는 미해결에 기록.

### 2.7 모델 의견
**Fable.** 공격 온볼(`candidates`·`shotModel`)·실행(`resolveFlight`)·수비 오프볼(마크 이식)·판정 시점 규칙이 한 번에 얽히고, 같은 축에서 Opus 1회(C.75d)·Fable 1회(C.75e) 실패했다. 다만 이번 처방은 코드 양이 작다(가설 1 약 15줄, 가설 2 약 10줄, 가설 3 은 이식). 예산은 측정 8회·3시간을 권장(단계 A/B 분리 때문).

## 3. 44f (Opus, 44e 뒤): 결과 불변 속도 + 미해결 1·4 (a) / 미해결 6·2·3 나머지 (b)

### 3.1 44f-a 커밋 1 — 결과 불변 엔진 속도 (pending 129, C.75b 질문 → "세트피스 자리 팀당 1회·refreshErrors·오프더볼 팀 단위, 10~20%")
- 원칙: **`same-seed.ts 30` 지문이 main 과 바이트까지 같아야 한다**(C.75b 69fa212e·f96341ae·브라우저 f5dfa96a 식으로 3개 지문). 난수 호출 순서·횟수·인자가 바뀌면 지문이 바뀌므로 `refreshErrors`(해시 난수 2회/갱신)는 **그대로 두고** 계산 재사용만 한다.
- 손댈 곳: ① `offball.ts` — 선수마다 갱신 때 다시 구하는 팀 단위 값(`offsideLine`·`defensiveLine`·`focusThreat`·`oppLineX/ownLineX`·`ballRank` 의 거리 정렬·`boxDefense` 의 상대 목록)을 **틱당 팀당 1번** 구해 `TeamState` 캐시(`tick` 스탬프)에 두고 읽는다. `updateSituations()` 가 이미 틱당 팀당 1번 돌므로 그 자리에 붙인다. ② `setPieceTarget()`(:1130) — 재개마다 선수마다 `mates` 를 정렬(공중볼 순)하는데 재개 1건당 팀당 1번으로(`s.restart` 에 캐시, `at`·`taker` 가 바뀌면 다시). ③ `onball.ts candidates()` — 수신자마다 `nearestOpponent`·`nearestOutfield` 를 전체 선수 순회로 구하므로 상대 필드 선수 배열을 함수 첫머리에서 한 번 만들어 넘긴다(결과 같음). ④ `pressureAt`·`laneRisk` 의 `s.agents` 순회도 같은 배열 재사용.
- 측정: `same-seed 30` 지문(main 과 동일) → `node scripts/c75b-speed.mjs`(2코어 시즌 146~150초 → **≤ 135초**, 경기 계산 488 ms → ≤ 430) → `tests/cards.test` 2초 → `npm run balance:engine:check`(지문 같으면 생략 가능, 1회만). `ENGINE_VERSION` 올리지 않음.

### 3.2 44f-a 커밋 2 — 미해결 1(ST 슈팅 반응)·4(역할 득실)
- **미해결 1**: 먼저 **재측정**(인수인계 §4 1번): `SWEEP_N=40 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 SWEEP_RESP=800 SWEEP_RESPKEYS=st_shoot npm run balance:quick` + 시드 2벌. 800쌍에서 득점 반응 하한이 0 을 넘으면 **고치지 않는다**(표본 노이즈로 종결). 여전히 ✗ 면 1회만: `prob.finishPerPoint` 0.012 → 0.014(`finishMult` 기울기, 공용 상수·E.15.1 ①) → **같은 시드 scoring 필수**(엘리트에 몰리는 계수다, 30골+ ≤ 2 깨지면 되돌림).
- **미해결 4**: `role-pair 800`(시드 2벌, 약 50분, 백그라운드) → 포지션군 평균 대비 |차| > 0.1(득점 외 목적 역할 5개는 0.15)인 것만 `engine-diagnosis-c33.md` §3 가설 3 값으로 1회: 펄스 나인 `betweenK` 0.5 → 0.3·`drop` 0.7 → 0.5, 크랙형 `demandApproach` 0.35 → 0.2, 섀도 `run` 0.8 → 0.65, 딥라잉 `run` 0.1 → 0.25. 44e 마크 배정이 들어가면 크랙형 ④ 면제의 대가가 생길 수 있어 **44e 뒤에 재야 한다**(기획 질문 4). 44d(C.75f)가 LM/RM 역할을 바꾸므로 그 뒤 값으로.
- 가드: 동레이팅 득점·scoring·경량 가드(`balance:engine:check`)·매트릭스 최대 |득실차| 0.82 에서 나빠지지 않음(`MATRIX=50 RECHECK=100 npm run balance:sweep -- --tactics`, 마지막 1회).

### 3.3 44f-b — 미해결 6(GK 선방률)·2(롱패스)·3 나머지(압박 비용)
- **미해결 6** 선방률 66.8~67.7(목표 68~72): 먼저 **분리** — `polish-b gap 40` "판정 대 실제 선방 확률"과 거리 구간별 유효률을 C.45 전(엔진 19, `origin/claude/engine-diag-defense` 는 엔진 18)과 비교. 유효 슈팅 수·거리 분포가 같고 선방률만 내려갔으면 `keeper.saveBase` 1.70 → **1.74**(E.23 4번 "득점은 마지막에 saveBase 로만", 1회) → 득점 −0.04 예상 → 44e 뒤 득점이 1.30 이상일 때만. 슛 거리가 가까워졋거나 유효률이 올랐으면(실행 배율 쪽) 상수는 두고 기록.
- **미해결 2** 롱패스 19.4%(목표 10~16)·0~10 m 비중 6.3%: 곡선(`longPerM`)은 성공률과 맞바뀌므로 **오프볼 간격**으로 1회: `offball.supportMin` 12 → 10, `supportMax` 25 → 22(짧은 선택지가 생기면 판단식이 고른다, 상수 2개). `pass-dist 40 76 76` 로 구간별 시도·성공률, `balance:quick` 득점·점유. 44e 수신 지점 모델 뒤 값으로(가설 1 이 짧은 패스를 늘릴 수 있음).
- **미해결 3 나머지**(라인·압박 단조 이득, 압박 비용 없음): 세부 전술 반응 "압박 높음 이동 거리 −1.9% → +3": `pressDistRange` 14 → 16(압박 높음에서 더 멀리 나감) + 스태미나 소모 `0.95 + 0.15p` → `0.9 + 0.3p`(`sim.ts:466`, 압박 높음의 대가) 1회, `SWEEP_TAC=200` 세부 전술 반응 9개로 확인. 뒷공간 처벌(라인 높음 + 느린 CB)은 E3.6 설계 범위 — 기록만, 44h 후보.
- 가드: 공통(득점 1.25~1.45·scoring·경량·매트릭스 ≤ 0.82·약팀 블록 실점 ≤ 균형).

### 3.4 모델 의견
Opus. 전부 파일·함수·상수 단위이고 측정 도구가 있다. 44f-a 커밋 1 은 지문 하나로 판정이 끝나 가장 안전하다.

## 4. 44g-a (Opus, 지금 병렬): 카드·결정 순간 — 자동 카드 금지·카드 강화·리셋 즉발·맡기기 판단 스탯·지시 카드 신뢰·판단 스탯 생활 영향·패스 받는 빈도 재분류 → 미해결 7

### 4.1 통과 기준
- **직접(봇) − 자동 평점 격차 +0.3~0.5**(`npm run balance:cards -- 3 10`, 시작 덱과 `--rich` 둘 다; 지금 시작 덱 +0.16 ± 0.12, 선수 기본 덱 봇 −0.16 — C.75a). 자동은 **새 규칙(결정 순간 카드 없음, 패시브 자동 장착)** 기준.
- **맡기기 = 자동**: `tests/c75a` "카드 없는 경기" 그대로 + **카드 덱 있는 경기도 전부 맡기기 = 자동**(새 테스트, 미해결 7 종결 — 63/97 갈림이 0/97). 1대1 장면 포함.
- 자동 경기 지문: 내 선수 없는 경기(`same-seed 30`) **동일**. 내 선수 경기는 §4.2 B안이면 바뀜(그 경우 `c74a-fingerprint.ts` 값 갱신·부록 C 에 적음).
- 리셋: 장면당 1회, 카드 1장 제한에 안 셈, 교체 뒤 선택지·카드 줄 재계산(새 플레이 카드면 4번째 선택지), 결정성(같은 시드 같은 리셋 → 같은 패).
- 지시 카드 3장 활성(`inactiveUntil` 제거), F.4 수치 그대로(독단 성공 평점 +0.8·XP ×1.3, 실패 신뢰 −5).
- 가드: `npm run balance` 19/19(생활 지표 판단 영향은 엔진 점검 호흡 0·관계 보통 고정이라 영향 없음), 2초 테스트, `balance:moments 3 10` 정지 수 E.11 범위.

### 4.2 항목별 처방 (파일·함수)
1. **자동 경기 결정 순간 카드 금지**(기획서 16.3·F.5 개정): `moments.ts autoCardDecide()`(:813)·`autoCardDuel()`(:739)·`autoOccasion()`·`setPieceMoment()` 자동 분기(:886)·`aerialMoment` 자동 카드를 **`BALANCE.cards.autoMoments: false`** 뒤로 보내 끈다(코드는 남기고 플래그 — 측정 비교용). 자동 경기에서 남기는 것: **패시브는 킥오프 때 덱에서 자동 장착**(`passiveSlots` 2, 패 앞 순서, `initMoments`/`cards.ts` 초기화에 `equipPassivesAuto`), 지시 카드(§4.2 5)·시그니처는 플레이 카드라 **자동에서 안 씀**(기획 질문 1). 경기 결과 "쓴 카드 (자동)" 표기는 패시브만.
2. **카드 강화**: `config/cards.ts` 확률 카드 `probDelta` R(5)/R(8)/R(10) → **×1.5**(R(8)/R(12)/R(15)) 1회, `BALANCE.cards.bonusCap` 0.15 → **0.20**. 격차가 +0.5 를 넘으면 ×1.25 로 1회 되돌림(조정 2회). 플레이 카드 변형 값은 그대로(선택지 자체가 이득).
3. **리셋 카드 즉발**(pending 133, 03:57): 결정 순간 패널 [리셋] → 확인 시트 → `moments.ts redrawNow(s)`: `playCard(s, a, hand, scene, false)` 의 `redraw` 분기만 실행(장면 진행 없음) → **`refreshPending(s)`**: `pending` 의 `cards`(`handView`)·`options`(플레이 카드 4번째 선택지 `onballVariants`/`duelVariants`/`spVariants`)·`delegateEv` 를 지금 상태로 다시 계산해 바꿔 넣는다(`m.cands` 는 그대로 — 엔진 후보는 안 변함). `ms.resetUsed` 로 장면당 1회. 카드 1장 제한(`mc` 1장)에 세지 않음. `ui/views/moment.ts`·`main.ts liveShow` 재렌더. 자동 해당 없음.
4. **맡기기 판단 스탯 연동**(pending 133, 03:29 ①): 두 안 — **A안** 직접 모드 맡기기만: `sim.ts applyChoice()` onball `else decide(s, o)` 자리에서 `delegateChoose(s, o)` — 보이는 후보 중 효용 1위 대신 **`p_slip = clamp(slip.max × (slip.ref − judge) / slip.ref, 0, slip.max)`** 확률(결정적 난수 `rand(seed, tick, idx, Purpose.Decide, 9)`)로 2위를 고른다(judge = `judgementOf(a)`, `onball.ts:199`). 자동 경로 무수정, **맡기기 ≠ 자동이 됨**(c75a 테스트는 판단 상위 선수 또는 `slip.max=0` 덮어쓰기로 유지). **B안(권장)** 내 선수의 엔진 결정(자동·맡기기 공통, `decide()` 에서 `a.spec.isMe` 일 때만) 에 같은 미끄러짐: 맡기기 = 자동 유지, 자동 평점이 판단 낮은 선수에게 내려가 **직접 − 자동 격차가 자연히 커진다**(사용자 목표와 같은 방향), NPC·E.15 무영향, `same-seed`(내 선수 없음) 지문 동일. 상수 `ENGINE.moments.delegateSlip = { ref: 0.7, max: 0.25 }`(judge 0.7 이상 0, 0.45 → 약 9%). pending 43 곡선(로그)은 44h 판단 구조 때 통일.
5. **지시 카드 신뢰 연동**(F.4·D.11 6번, 기획서 6614 "내가 정한 역할대로"): 온볼 결정 순간에서 ① **지시 이행**(`dirFollow`) = 엔진 효용 1위 후보를 그대로 고르는 선택지에 붙는 보조 카드(`role: 'boost'` 0, 효과 = `DecisionRecord.directive = 'follow'`) → 경기 뒤 `game.ts` 감독 신뢰 **+1/장**(C.62 변화표에 추가, 경기당 상한 +3) ② **독단**(`dirSolo`) = 4번째 선택지: 보이는 후보 중 `value`(개인 가치: 슛·돌파)가 가장 큰 후보(효용 1위가 아닐 때만 열림) — 성공 → 그 경기 평점 **+0.8**(`rating.ts` 보정 아닌 `MatchResult.rating` 사후 가산, E.15.1 밖의 "카드 보상"으로 부록 F 명시)·XP ×1.3, 실패 → 신뢰 −5 ③ **감독의 신뢰**(`dirTrust`) = 신뢰 ≥ 70 일 때만 `usable`, 효과 = 고른 선택지 +5%p(`boost`). 엔진 판정식 무수정(선택지 구성·사후 보상만). 자동에서는 안 씀(1번).
6. **판단 스탯 생활 영향**(pending 43 ⑦·474): `adapter.ts` 내 선수 `attrs` 를 만들 때 `vision`·`composure`·`decisions` 에 `lifeJudgePenalty(state)` = `BALANCE.life.judge.per × max(0, 40 − lifeVar('mental'))` + 같은 식으로 `adapt`(외국인만) — 상한 **−5**(0~99 척도, 화면 1~20 으로는 −1 칸). 입력만 바꾸므로 엔진 무수정, 엔진 점검(`balance:*`)은 내 선수 생활 지표가 없어 무영향. 홈 힌트 문장에 "집중이 흐트러져요" 추가.
7. **패스 받는 빈도 가중 재분류**(C.74c, `onball.ts choose()` `toMeMul` ×0.9~1.1): 코드는 **그대로 두고** E.15.1 에 "층 3 선호(역할 `pref` 와 같은 자리): 동료가 나에게 주는 후보의 선택 가중, ±10% 상한, 엔진 점검은 호흡 0·관계 보통(=1)" 로 분류를 적는다. 효용·확률은 안 건드리므로 결과 할당이 아니다. 대안(오프볼 '공 요구' 모듈로 옮기기)은 비용 대비 이득이 없다.

### 4.3 측정 순서
① `npm run balance:cards -- 3 10` main 기준(새 규칙 전) → ② 1·2 번 뒤 다시(격차 +0.3~0.5 확인, 조정 ≤ 2회) → ③ 새 테스트 "덱 있는 경기 전부 맡기기 = 자동" → ④ `same-seed 30` 지문 → ⑤ `npm run balance` · `balance:moments 3 10`. 예산 Opus 2시간, 측정 6회. 크면 44g-a1(1·2·3·4)/a2(5·6·7)로 나눈다.

## 5. 44g-b (Opus, 지금 병렬): 하프타임 전술 변경 · 몰고 가다 슛 · 레전더리 35세 가드

1. **하프타임 전술 변경**(E.19 미룬 것, pending 191 25단계): `sim.ts step()` 에서 전반이 끝나 `event(s, 'halftime')`(:515) 을 낸 직후, `s.input.mode === 'live' && control.mode === 'direct'` 이면 `moments.pending = { type: 'halftime', … }` 로 멈춘다(`pauseOrDecide` 가 정책 없으면 true). `adapter.ts MyMatchRun.advance()` 가 그 순간을 돌려주고, `ui` 는 전술 화면(`views/tactics.ts` 의 성향 + 라인·압박·빌드업·폭 + 전술 세트 3개 선택)을 시트로 재사용. 확정 → `applyHalftimeTactics(s, team, tactics)` = `T.setup.tactics = T.tactics = engineTactics(...)`(`aiAdjust` 는 live 내 팀을 이미 건너뛴다 `tactics.ts:193`). **역할·포메이션 변경은 넣지 않음**(E.19 범위, 다음 단계). "변경 없음/맡기기" 는 난수를 안 쓰고 그대로 이어간다 → **자동 결과와 동일**(`tests/c75a` 식 테스트 추가). 자동 모드는 멈추지 않음. 결정 기록에 "하프타임 전술 변경" 한 줄, 하이라이트 띠 `view === 'halftime'` 재사용.
2. **몰고 가다 슛**(C.75a 설계안 4, 기획서 :5307): 직접 모드 전용 2단 행동. `moments.ts` 온볼 선택지에 `carryShoot`(앞으로 몰고 가기 후보가 있고 도착점 `shotModel(at=도착점).xg ≥ shotKeepXg` 일 때) — 표시 확률 = 몰고 가기 성공 × 도착점 xG × **할인 0.8**(수비 위치가 지금 그대로라 낙관). 확정 시 `a.intent = { type: 'shoot', until: s.t + 2 }` 를 남기고 몰고 가기를 실행; `sim.ts decide()` 에서 `intent` 가 살아 있고 슛 후보가 있으면 **강제 선택**(`s.forcedCand` — `forcedDuel` 과 같은 패턴), 소유 상실·패스로 만료. 봇 `optionValue` 에 체인 평가, 카드 판정 `watch` 는 2단 모두. 자동·맡기기 무수정(지문 동일). 측정: `balance:moments 3 10` 정지 수·선택 비율, `balance:cards` 격차(+0.05 안팎 예상).
3. **레전더리 35세 900+ 가드 경계**(C.67·C.68·C.73a·C.74b 네 번): 기준선 12/48 = 0.250 이 경계에 정확히 걸려 시드 하나(legendary-26)로 뒤집힌다. 처방(권장): `scripts/balance.ts` 그 행만 **레전더리 최적 시드 48 → 96**(`LEGEND_SEEDS`), 기준 **≤ 0.30**(p 0.25·n 96 의 1σ 0.044), 값은 "n/96 = 0.xxx" 로 기록, 30세까지 900+ 0.1~0.2 는 그대로. 넓히는 안: 가드 → 측정 줄(판정 안 함). 실행 시간 +약 1분(레전더리 최적 48회 추가) — `npm run balance` 시간을 보고한다. `BALANCE_VERSION` 안 올림(수치 아님).

예산 Opus 2시간, 측정 4회(지문·c75a 식 테스트·moments·balance). 1 과 2 는 `moments.ts` 를 같이 만지지만 함수가 다르다.

## 6. 44c-c 지시서 (Opus, a 크기 — 전환 상황 B·C·D·F 행동)

> `engine-diagnosis-defense-v2.md` §2.3 을 채운 것. 2대 §2.1·§4 상황별 표가 명세. **마크 배정 코드가 필요한 항목은 뺀다**(F 박스 1:1 배정, B 빈 쪽 침투자 마크 — 44e 로). 상황 판정 `rawSituation()`(:45)·`updateSituations()`·`plan.sit` 표는 C.75c 가 만들었고 빈도는 2대·3대 측정과 같다(아래 기준값).

### 6.1 통과 기준 (`defense-shape 40 4-2-3-1` ⑥, **엔진 24 지금 값 → 목표**, 2026-10-20 12:38 측정)
| 상황 (빈도) | 지표 | 지금 | 목표 |
|---|---|---|---|
| **B 역습 복귀** (5%) | 골 35 m 안 공격수 5 m 안 수비 없음 | **47%** | **≤ 35%**(필수) · 공 3 m 안 2명+ 6% 는 기록(추격 협공 허용) |
| **C 수적 열세** (7%) | 이 상황 1대1 판단 중 **지연(따라붙기) 비율** — `defense-shape` 에 줄 추가(상황별 `tackles`/`duels`) | 재야 함 | **≥ 70%**(필수) · 3명+ 0% 유지 · 5 m 안 없음 32% → ≤ 30%(권장) |
| **D 측면 트랩** (0%, 표본 36) | 빈도 | 0.05% | 판정 조건을 pending 41 질문 7 권장으로 바꾼 뒤 **기록만**(≥ 0.5% 예상) · 공 3 m 안 2명+ 는 허용 |
| **F 크로스** (4%) | 크로스 순간 박스 안 공격수 5 m 안 수비 없음 | **41%** | **≤ 30%**(필수) · 한 상대 2명+ 0.49 → ≤ 0.3 |
| 전체 | 상황 빈도 A 68 / H 12 / C 7 / B 5 / F 4 / E 4 | | ±5%p(D 만 늘어도 됨) |
| 유지 | 박스 안 3명+ 4% · 2명+ 19% · 교체 20.6 · 간격 14.5 · 태클 15.7 · 인터셉트 14.3 | | 3명+ ≤ 5% · 나머지 나빠지지 않음 |
**가드**: `tactic-pair 300 75:75 balanced` 득점 1.30 ± 0.1(슈팅 13.3·유효 4.2) · `SWEEP_N=600 … balance:quick` 득점 1.25~1.45 · 선방 ≥ 66.8 · Δ+8 ≥ 1.75 · 판단 태클 15~18 · 인터셉트 ≤ 16 · 드리블 성공률 ≥ 45 · `balance:engine:check` · `tests/c75c.test.ts` · 결정성 · 마지막에 **같은 시드 `balance:scoring` 1회**(30골+ ≤ 2, 리그 1.3~1.5 — 전환 상황 합계 16% 라 영향은 작아야 한다; 깨지면 B 라인 내림을 먼저 되돌린다).

### 6.2 가설 1 (주): B 역습 복귀 — `offball.ts defendTarget()` 상황 B 분기 + `defensiveLine()`
- 압박 rank 0 = **지연**(공과 골 사이, `jockey` 가치는 `defense.jockeyFar` 그대로), **추격자 1명** = 공보다 뒤(자기 골에서 먼 쪽)에서 공에 가장 가까운 수비수 → 공으로 최대 속도(`urgent`), 1대1 자격은 `behindTackle`(0.6)·`behindFoul`(2.5) 그대로(뒤에서 하는 태클 그대로 비싸다). 나머지 수비 줄은 `defensiveLine()` 에 **`sit.B.lineDrop` 4 m** 를 더해 내려 서고(`returnPace` 로 복귀), 중원은 공 쪽 `screenSpot` 대신 **골 쪽 복귀**(지금 `recoverRun/Sprint` 규칙 유지). 빈 쪽 침투자 마크는 넣지 않는다.
- 상수: `plan.sit.B = { pressers: [1,1,1], double: false, chase: true, lineDrop: 4 }`.
- 예상: B 5 m 안 없음 47 → 30~35%(수비 줄이 4 m 내려 침투자와 간격이 줄고 복귀가 빨라짐), 상대 역습 슈팅 ↓. 측정 1회(`defense-shape` + `tactic-pair 300`).

### 6.3 가설 2 (주): C 수적 열세 — 지연 우선 + 둘째는 가장 위험한 상대 골 쪽
- rank 0: 따라붙기 가치 × **`sit.C.jockeyMul` 1.5**(`actions.ts duelOdds()` 의 jockey U 에 상황 배수 1줄 — 태클 U 가 지연 U 를 못 넘게) + 커버 섀도 `shadowW` 0.6 → **0.8**(C 에서만, 가장 위험한 패스 대상 쪽으로 더 기운다). rank 1: 커버 자리 대신 **`focusThreat()`(골에 가장 가까운 위협)의 골 쪽 2 m**(배정·기억 없음, 매 갱신 다시 고름). 나머지: `coverSpots` 골문 자리.
- 상수: `plan.sit.C = { pressers: [1,1,1], double: false, jockeyMul: 1.5, shadowW: 0.8, secondToThreat: true }`.
- 예상: C 지연 비율 ≥ 70%, 태클 시도 15.7 → 15 안팎, 드리블 성공률 ±1. 측정 1회(`defense-shape` 새 줄 + `balance:quick 600` 판단 태클·드리블).

### 6.4 가설 3 (보조): D 측면 트랩 판정 + F 크로스 막기·컷백 존
- **D**: `rawSituation()` 조건 `!mateNear(8 m)` → **가장 가까운 상대 동료 ≥ 10 m**(pending 41 질문 7 권장; 지금 0.05%). 행동: rank 0 압박, rank 1 **`trapInside`** = 공 ↔ 중앙(피치 폭 중심) 선 위 공에서 3 m(안쪽 패스길 차단). 3 m 안 2명+ 는 D 에서 허용(협공 상황).
- **F**: rank 0 은 공으로 붙지 않고 **`crossBlock` 1.5 m** — 공과 골 중심을 잇는 선에서 공 쪽 1.5 m(크로스 각 막기, 이미 `pressDist` 안이면 그대로 압박). 박스 안은 `boxDefense()` 그대로(마커 1 + 둘째 + `coverSpots`), **컷백 존** = 압박·마크 안 하는 중원(line 2) 중 페널티 지점 쪽에 가장 가까운 1명을 `cutbackMin~Max` 구간 공 쪽 끝(`onball.cutbackMin/Max` 상수 재사용)에 세운다.
- 상수: `plan.sit.D = { pressers: [1,1,2], double: true, trapInside: 0.5 }`, `plan.sit.F = { pressers: [1,1,1], crossBlock: 1.5, cutbackZone: true }`, `defense.trapMateDist` 10.
- 예상: F 박스 안 5 m 안 없음 41 → ≤ 30%(컷백 존 1명이 2선 늦은 침투자 쪽에 선다), 크로스 성공률 24 → 22~24. 측정 1회(`defense-shape` F 행 + `box-at-cross.ts` 가 있으면 같이).

### 6.5 순서·예산·모델
가설 1 → 2 → 3, 측정 6회(상황별 `defense-shape` 3회 + `tactic-pair 300` 1회 + `quick 600` 1회 + scoring 1회), Opus 2시간. 실패 판정은 automation 3번 그대로; B 라인 내림이 득점 분포를 깨면(가능성 낮음) `lineDrop` 4 → 2 로 1회. **Opus**(함수 1곳 `defendTarget` 분기 4개 + 상수표 + 측정 줄 1개, 2대·3대가 좁혀 둔 범위).

## 7. 마스터 세션에 (권장안 1개씩)
1. 44e 예산 — 권장 **Fable 3시간·측정 8회·25달러**(단계 A/B 분리 때문). 기본(2시간·6회·20달러)이면 단계 A 의 조정 1회와 마지막 `engine:check` 를 뺀다.
2. 44e 부분 해결 — 권장 **단계 A 만(마크 없이 수신 모델) 배포 허용**: scoring·quick·engine:check 통과 + 득점 ≤ 1.45 면 배포하고 마크 배정은 브랜치에(미해결 8 유지). 수신 모델 자체가 미해결 5·2 에 도움이 된다.
3. 자동 경기 카드 — 권장 **패시브만 킥오프 자동 장착, 시그니처·지시·확률·플레이·세트피스 카드는 자동에서 안 씀**(사용자 "경기 전 지시 카드·시그니처 등 경기 밖 효과 유지"를 "장면 선택이 없는 효과 = 패시브"로 읽음). 다르게 읽으면 시그니처도 F.5 규칙 유지.
4. 맡기기 판단 스탯 — 권장 **B안**(내 선수 엔진 결정 공통 미끄러짐, 맡기기 = 자동 유지, 격차가 자연히 커짐). A안이면 "맡기기 ≠ 자동"을 기획서 16.3 에 적어야 한다.
5. 레전더리 35세 가드 — 권장 **시드 96 + 기준 ≤ 0.30**. 넓히는 안: 측정 줄로 내림.
6. 44g-a 크기 — 권장 **a1(자동 금지·강화·리셋·맡기기) / a2(지시 카드·생활 영향·재분류 문서)** 로 나눠 연다(둘 다 Opus, 병렬 가능 — a2 는 `game.ts`·`life.ts` 쪽).
7. 44f-b 의 `saveBase` 1회 — 권장 **허용**(E.23 4번), 단 44e 뒤 득점 ≥ 1.30 일 때만.

## 8. 재현 명령과 현재 값 (`main` 4aed8b8, 엔진 24)
```
npx vite-node scripts/diag/defense-shape.ts -- 40 4-2-3-1          # ⑥ B 5 m 없음 47% · C 32% · F 41% · D 0.05% · 빈도 68/12/7/5/4/4 · 박스 3명+ 4% · 교체 20.6 · 태클 15.7 (1분, 12:38 측정)
npx vite-node scripts/diag/tactic-pair.ts -- 300 75:75 balanced    # 1.30 · 슈팅 13.3 · 유효 4.2 · 박스 터치 4.3 (3분, C.75d 기록)
SWEEP_N=600 SWEEP_D=200 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick   # 1.35 · 유효 4.0 · 선방 66.8 · 인터셉트 15.1 · 판단 태클 15.3 · 드리블 45.4 · Δ+8 1.85 (C.75e 기록)
npm run balance:scoring                                            # 리그 1.38 · 30골+ 0.80 · 득점왕 중앙값 29.5 (10분, C.75e 기록)
npm run balance:engine:check                                       # 평점 σ 0.71 · CDM 6.50 · CM 6.50 · CAM 6.40 · Δ+8 1.92 (C.75e 기록)
npx vite-node scripts/diag/same-seed.ts -- 30                      # 지문 (44f-a 커밋 1·44g 전후 동일해야 함)
npm run balance:cards -- 3 10                                      # 직접(봇) − 자동 격차 (44g-a 첫 측정; C.75a 시작 덱 +0.16)
git worktree add <스크래치>/wt-c75e origin/claude/c75e-defense-fix   # 마크 코드 최신본 · npx vite-node scripts/diag/mark-plan.ts -- 20 4-2-3-1 balanced balanced (배정률 98%, 3 m 안 47%, 교체 7.2)
```
주의: `tactic-pair`·`balance:*` 워커 번들(`node_modules/.cache/engine-harness/worker.mjs`)은 공유라 main 과 작업 트리에서 **동시에 돌리지 않는다**. 긴 측정은 백그라운드 + 결과 파일에 `exit` 줄.

명령 시각 2026-10-20 12:17 KST / 작성 시각 2026-10-20 12:50 KST / 걸린 시간 약 33분(문서 읽기 25분, 측정 1회 1분, 작성 7분)
