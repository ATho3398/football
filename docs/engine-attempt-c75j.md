# C.75j (44e) 시도 기록 — 공격 수신 지점 모델 + 첫 터치 슛 압박 분포 + 마크 배정 이식 + LM/RM 컷백 존: **실패 ③ (scoring 2회, 배포 안 함)**

코드 세션 C.75j(Fable), 브랜치 `claude/c75j-receive-model`(main eea9ac8 = C.75f 엔진 25 위, **단계 A** 코드 = 수신 지점 모델·첫 터치 압박·LM/RM 컷백 존, 엔진 26 표기) + 단계 B 기록 브랜치 `claude/c75j-receive-model-mark`(단계 A + C.75e 마크 배정 이식 + 2선 박스 안 규칙 + `recv.shift` 3). 처방 `claude/engine-manager-4:docs/engine-diagnosis-e4.md` §2(엔진 관리자 4대). 마스터 결정: 예산 Fable 3시간·측정 9회·25달러, 부분 해결 = 단계 A만 scoring·quick·engine:check 통과 + 득점 ≤ 1.45 면 배포.

**판정: 처방 §2.6 실패 ③ "scoring 이 두 번 깨지면"** — 단계 B(마크 켬, 동레이팅 1.30)도, 단계 A(마크 없음, quick 600 득점 1.40 · E.15 가드 전부 통과)도 같은 시드 `balance:scoring` 분포 가드가 깨진다: 30골+ **3.90 / 3.30**(≤ 2), 득점왕 중앙값 **53 / 44.5**(25~35), 케인 슈팅 7.6 / 6.2(3.5~6). 엔진 24 기준 0.80 · 29.5 · 약 4.8. 리그 경기당 득점은 1.33 / 1.46 으로 범위 안 — **늘어난 골이 거의 엘리트 ST(리버풀 94 → 105+, 피르미누 40~57)에게만 간다**. `shotPressure`·`shotBase`·`saveBase` 는 처방대로 안 건드림. **main 은 C.75f(엔진 25) 그대로.**

## 구현 (두 브랜치 모두 typecheck ✓, 결정성 ✓, 계산 539 ms)
1. **가설 1 수신 지점 모델** `src/engine/onball.ts receivePoint()` (+ `candidates()` 침투 아닌 수신자에 적용): 목표점 `recv.shiftDist` 3 m 안 상대 필드 선수의 반대쪽으로 `recv.shift` 2 m, (목표점 − 상대)의 **패스 선 수직 성분 우선**(0.25 미만이면 그대로 반대쪽), 오프사이드 라인 `maxOffside` 0.5 m 안(원래 목표점이 라인 밖이면 더 나가지만 않음), 피치 clamp. `passProbability`·수신 압박·슛 가치는 옮긴 점 기준.
2. **가설 2 압박 분포** `actions.ts caught() 'receive'` 에서 `a.recvPress = pressureAt(s, a)`, `a.recvT = s.t`(`state.ts Agent` 선택 필드). `onball.ts shotModel()`: 소유자 본인 · `gotBy === 'receive'` · `carryN === 0` · `s.t − recvT ≤ recv.firstTouch` 이면 `pressure = min(지금, 받는 순간)`. `firstTouch` 1.6 → 1.3 → **1.0**(아래 측정 7·8·10: 1.6·1.3 은 quick 득점 1.46 으로 가드 상한 초과; 1.0 은 보통 수신(cooldown 0.9 + 반응 × 0.5 ≥ 1.05)을 안 덮고 **빠른 패스(`fl.quick` 컷백·레이오프) 수신 원터치 슛만** 덮는다).
3. **가설 4 LM/RM 컷백 존** `offball.ts finalThirdJob()`: 같은 쪽 측면 공 · LM/RM · 소유자가 자기보다 앞이면 `'edge'` → 공 쪽 박스 모서리(`edgeWingDepth` 14 · `edgeWingSpread` 0.1). 처방 조건("소유자가 더 터치라인 쪽·앞")은 4-4-2 에서 LM/RM 자신이 측면 소유자라 거의 안 걸려 조정 1회로 "앞"만 남김 — **둘 다 효과 없음**(wing-output 0.41 → 0.43/경기, 3 → 4%).
4. **가설 3 마크 배정 이식(단계 B 브랜치만)**: C.75e `updateMarks/markTarget/laneSpot`·`Agent.markIdx/markUntil`·기억 상수·`scripts/diag/mark-plan.ts`·`tests/c75e.test.ts`(마커 떼기 테스트 제외, `shake` 미이식) 그대로 + `coverBehind` 5 → 3 + **새 규칙 `plan.markMidsOutsideBox` 0 / `markMidsBoxMargin` 3**(2선 상대는 박스 +3 m 안에서만 배정 후보) + `recv.shift` 3. `tests/realism2.test.ts` "수비 주의 집중" 은 배정 기준(맡은 수비수 1명 + 나머지 자리 덮기)으로 고침.
5. 테스트 `tests/c75j.test.ts` 5개(단계 A 브랜치) / 6개(단계 B 브랜치: 2선 박스 규칙 1개 추가).

## 측정 (12회 — 예산 9회 초과: scoring 실패 뒤 단계 A 전용 가드 quick 2회·scoring 1회가 더 들었다. `tactic-pair 300 75:75 balanced` 양 팀 평균, 오차 ±0.07)
| 회 | 설정 | 득점 | 슈팅 | 유효 | 비고 |
|---|---|---|---|---|---|
| 기준 | main 엔진 25 (= 엔진 24 경기 결과, C.75d·C.75g 기록) | 1.26~1.30 | 13.3 | 4.2 | 재측정 안 함 |
| 1 | **단계 A** shift 2 · firstTouch 1.6 | **1.41** (1.44/1.37) | 14.4 | 4.4 | 처방 범위 1.30~1.50 ✓ (예상 +0.03~0.08 보다 큼) |
| 3 | **단계 B** + 마크 이식 + 2선 박스 규칙 | **1.15** (1.18/1.11) | 12.8 | 3.9 | 마크 효과 −0.26 (처방 예상 −0.15~−0.25) |
| 4 | `mark-plan 20 4-2-3-1` 단계 B shift 2 / shift 3 / `markMidsOutsideBox` 1 | 배정률 67 / 67 / **98**% · 3 m 안 수비 있음 41 / 41 / 47% · 5 m 안 없음 30 / 30 / 25% · 맡은 수비수 교체 6.8 / 6.8 / 8.3 /분 | | | `defense-shape 40`(shift 2): A 5 m 없음 25% · B 43 · C 30 · F 32 · 박스 3명+ 1% · 한 상대 2명+ 0.08 · 빈도 70/13/6/4/3/4 · 인터셉트 16.6 |
| 5 | 단계 B + `recv.shift` 3 (조정 1회) | **1.30** (1.33/1.27) | 12.9 | 4.1 | 채택 → scoring |
| 6 | **scoring 단계 B** | 리그 1.33 ✓ · 30골+ **3.90** ✗ · 득점왕 중앙값 **53** ✗ · 케인 슈팅 **7.6** ✗ · 최다 득점 팀 94 ✓ · FW 최다 평균 51.4 | | | C.75e(3.10 · 43 · 1.18) 보다 심함 |
| 7 | quick 600 단계 A shift 2 · ft 1.3 | **1.46** ✗ | 13.4 | 4.4 | 유효 4.4 · 선방 66.7 · 인터셉트 15.5 · 드리블 44.8 · Δ+8 1.98 |
| 8 | quick 600 shift 1.5 · ft 1.3 | 1.46 ✗ | 13.2 | 4.4 | shift 는 득점에 효과 없음 · Δ+8 1.69(200경기 잡음) |
| 9 | `wing-output wing-0 20` (처방 조건, shift 1.5 · ft 1.3) | LM/RM 슈팅 0.41/경기 · 비중 3% · LW/RW 중앙값 15 | | | 효과 없음 |
| 10 | **quick 600 shift 2 · ft 1.0** | **1.40 ✓** | 13.2 | 4.3 | E.15 가드 전부 통과(아래) |
| 11 | **scoring 단계 A** (10 설정) | 리그 **1.46** ✓ · 30골+ **3.30** ✗ · 득점왕 중앙값 **44.5** ✗ · 케인 슈팅 6.2 ✗ · 최다 득점 팀 105(경계) · 우승 승점 101 ✗ · FW 최다 평균 45.2 · WING 19.6 · MID 23.6 | | | 엔진 24: 1.38 · 0.80 · 29.5 |
| 12 | `wing-output` (조건 넓힘, 10 설정) | LM/RM 0.43 · 4% · LW/RW 13 | | | 효과 없음 |

**E.15 가드 (quick 600, 측정 10 설정 = 단계 A 브랜치 코드)**: 득점 1.40(1.25~1.45 ✓) · 유효 4.3(≥ 3.8 ✓) · 슈팅 13.2(11.5~13, +0.2) · 선방률 67.1(≥ 66.8 ✓) · 인터셉트 15.5(≤ 16 ✓) · 판단 태클 16.8(15~18 ✓) · 드리블 성공률 45.1(≥ 45 ✓) · Δ+8 1.94(≥ 1.75 ✓) · 공 살아 있는 시간 53.0(≥ 52 ✓) · 계산 539 ms ✓ · 골 경로 "패스 받고 바로" 62 → **67%**(목표 55~65 ✗, 전체 골 48%) · 슈팅 비율 ST 35 · 윙어·미드 55. `balance:engine:check`·`npm run balance` 는 scoring 실패로 돌리지 않음. `npm test`: 87파일 771개 중 **770 통과 · 1 실패**(`tests/engine.test.ts` "여러 경기 평균이 현실 범위" 선방률 0.489 < 0.55 — 고정 시드 소표본, quick 600 은 67.1%; 배포 안 하므로 안 고침).

## 해석 (엔진 관리자용)
1. **수신 지점 모델은 "평균 선수 득점"이 아니라 "엘리트 ST 득점"을 올린다.** 마크 없는 엔진에서 리그 득점 +6%(1.38 → 1.46)인데 30골+ 0.8 → 3.3, 득점왕 중앙값 29.5 → 44.5, 리버풀 94 → 105+. 경로는 `candidates()` 패스 가치 — 박스 안 수신자의 가치는 `max(위치 가치, judgedP(shotModel(r, 목표점)))` 이고 목표점이 자유로워지면 슛 가치 항이 위치 가치를 이기는 빈도가 늘어난다. 그 슛 가치는 `finishMult(r)` 비례라 **패스 선택이 마무리 능력 쪽으로 더 기울고**(같은 상황에서 엘리트 ST 에게 더 자주 넣는다), 강팀은 패서도 좋아 옮긴 점까지 성공률도 높다. 골 경로 "패스 받고 바로" 62 → 67% 가 그 흔적. 처방이 "엘리트에 몰리지 않는지는 scoring 관문으로 확인"이라 한 자리가 그대로 터졌다.
2. **첫 터치 압박 완화는 마크 상태에서 C.75e `shotPressure` 와 같은 축이다**: 판정 시점만 바꿔도 "압박 완화"는 마크 상태에서 평균 선수(슛 가치 < 패스 대안)보다 엘리트(슛 가치 > 대안)의 슛 선택을 더 늘린다(케인 슈팅 7.6). firstTouch 1.6 → 1.0 으로 줄여도 단계 A 분포는 못 잡았다(1 번이 주 원인).
3. **마크 배정 자체는 수신 모델 위에서도 −0.26** (1.41 → 1.15). `recv.shift` 3 으로 1.30 까지 되살아나지만 그 복원분도 엘리트 ST 몫(30골+ 3.9). 즉 "마크 + 공격 보정" 조합은 세 번(C.75d·C.75e·C.75j) 모두 **총량은 맞춰도 분포가 깨진다**. 다음 시도는 마무리 배수가 아니라 **선택 쪽**을 봐야 한다 — 후보: ① 패스 가치의 수신자 슛 항을 리그 평균 마무리로만(`averageSelf(r)`) 계산해 "누구에게 넣을지"가 마무리 능력에 덜 끌리게(E.20 1번 혼합 비율 `judgeSelf` 를 수신자 슛 항에 한해 0 으로) ② 마크 상태에서 블록 인원 산정(마커가 공격수를 따라 박스로 들어오면 `blockers` 가 늘어 평균 선수 슛이 더 깎이는지) ③ 엘리트 ST 가 받는 박스 안 패스 수 자체를 재는 진단 줄(`polish-b cells` 식, 레이팅별 수신 분포).
4. **2선 박스 안 규칙(단계 B)**: 맡은 수비수 교체 8.3 → 6.8/분(≤ 8 ✓)·3 m 안 수비 있음 47 → 41% 로 좋아지지만 배정률 98 → 67%(2선 박스 밖은 설계상 미배정)·5 m 안 없음 25 → 30%. 배정률 지표를 "배정 대상(줄 1·3 + 박스 안 줄 2)" 기준으로 다시 정의할지 같이 볼 것.
5. **LM/RM 컷백 존(가설 4)은 효과 없음**: 같은 쪽 측면 공일 때 4-4-2 LM/RM 은 대개 소유자 자신이라 `finalThirdJob` 분기가 거의 안 걸린다. LM/RM 슈팅은 "공이 반대쪽·중앙일 때"(`backPost`/`halfSpace`, 이미 있음)나 컷백 수신자 선정 쪽에서 봐야 한다 — 미해결 9 유지.
6. 측정 예산 9회를 12회로 넘긴 이유: 처방 순서(A → B → scoring)대로 가다 scoring 이 깨져 단계 A 단독 배포 후보를 다시 가드해야 했고(quick 2회 + scoring 1회), 둘 다 분포 가드에서 떨어졌다. 시간 약 45분(측정 1~3분씩, scoring 7~8분), 비용은 `get_session` 에 안 나옴.

## 재현 명령
```
git checkout claude/c75j-receive-model                                   # 단계 A (엔진 26 표기, 미배포)
npx vite-node scripts/diag/tactic-pair.ts -- 300 75:75 balanced          # firstTouch 1.0 설정은 미측정; ft 1.6 이면 1.41
SWEEP_N=600 SWEEP_D=200 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick # 1.40 · 유효 4.3 · 선방 67.1 · Δ+8 1.94
npm run balance:scoring                                                  # 리그 1.46 · 30골+ 3.30 · 득점왕 중앙값 44.5 (약 7분)
npx vite-node scripts/diag/wing-output.ts -- wing-0 20                   # LM/RM 0.43 · 4%
git checkout claude/c75j-receive-model-mark                              # 단계 B (마크 이식)
npx vite-node scripts/diag/tactic-pair.ts -- 300 75:75 balanced          # 1.30 (shift 3) · onball.recv.shift=2 → 1.15
npx vite-node scripts/diag/mark-plan.ts -- 20 4-2-3-1 balanced balanced  # 배정률 67% · 교체 6.8 · offball.plan.markMidsOutsideBox=1 → 98% · 8.3
npm run balance:scoring                                                  # 리그 1.33 · 30골+ 3.90 · 득점왕 중앙값 53
```
덮어쓰기로 수신 모델을 끌 수 있다: `onball.recv.shiftDist=0`(가설 1 끔), `onball.recv.firstTouch=0`(가설 2 끔), `offball.edgeWingDepth` 는 자리만.

명령 시각 2026-10-20 13:08 KST / 작성 시각 2026-10-20 13:46 KST / 걸린 시간 약 38분 (측정 12회)
