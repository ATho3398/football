# 진단 c79y — "티키는 게겐에 취약" 을 만들기 위한 측정·실험: 성향별 소유 중 팀 간격·패스 거리, 티키 압축, 게겐 수비 전반(공 쪽 이동 + 2명 압박 + 수신 후보 선제 마크)

작성: 엔진관리자23 (`session_01YVaigHUm5kU6tW138oYj2Y`, Fable), 2026-10-30, 브랜치 `claude/engine-manager-23`(origin/main 66b80c9 = C.79s, ENGINE 61 + 엔진관리자21 브랜치 병합). 마스터 AD.
main 엔진 코드 불변 — 실험은 모두 **기본 0 스위치**(`TENDENCY.tiki*`·`gegen*`, `src/engine/tactics.ts`, 켜지 않으면 호출되지 않음, 테스트·지문 그대로). 탐침 `scripts/engine/c79wProbe.ts`(간격·수비 모양·패스 거리 히스토그램 추가)·실행 `scripts/diag/c79y-gegen.ts`.

대상: `docs/session-prompts/엔진관리자23.md` — 사용자 질문 1("티키 선수끼리 너무 멀다·먼 패스도 다 성공해 게겐이 못 따라간다") · 2("게겐은 팀 전체가 공 쪽으로 몰려가고 2명이 압박하는 동안 나머지가 수신 후보를 미리 마크").

## 0. 한 줄 결론
(측정 뒤 채움)

## 1. 측정 — 성향별 소유 중 팀 간격·패스 거리 (`c79y-gegen.ts -- 160 seed=41000 only=…`, 쌍마다 160경기 × 2방향, 1초 표본)
(측정 뒤 채움)

## 2. 지금 엔진의 수비 배정과 사용자 설계 2 의 차이 (코드 기준, `src/engine/offball.ts defendTarget()` 순서)

지금 게겐 성향이 상대 빌드업 중에 하는 것(모든 성향 공통 규칙 + 게겐 고유는 굵게):
1. **역압박 창**(`core.ts turnover()` → `defendTarget` 맨 앞): 잃는 순간 공 14 m 안(`counterRadius`) 선수가 확률 0.4 + 0.4×역할 press + 0.2×노력/100 로 **최대 3명(`gegenMax`)** 가담, 창 4 + 2×0.8 + **1(`gegenExtra`) = 6.6초**. 1번은 소유자, 2·3번은 "소유자 → 가까운 동료 선분의 35%(`counterLane`)" 지점 — 수신자가 아니라 **패서 쪽**에 선다. 엔진관리자21: 가담은 상실의 37%, 대부분 1명.
2. **압박 1~2명**: 공 순위 0번 + (압박 단계 2 = 게겐의 pressing 0.8 ≥ 0.68 이라) 둘째도 공으로 — 단 둘째는 pressDist(8 + 14×0.8 = 19.2 m)의 0.6 = 11.5 m 안일 때만(`secondPressDist`). 첫 압박자는 가장 위험한 전진 패스 대상을 등 뒤로 가리는 각도(커버 섀도 `shadowW` 0.6).
3. **남은 수비 분담 `restMark`**(잃은 뒤 4초만): 압박·역압박에 안 간 수비 줄 + 공 뒤 중원이 **공보다 우리 골 쪽의 위협 상대**(threatValue = 골 가까움 순, 최대 4)를 골 쪽 1.5 m 에서 한 명에 한 명 마크(0.4초 안에 닿을 때만) — 기준이 "골에 가까운 상대" 이지 "소유자의 패스 후보" 가 아니다.
4. **블록 이동**(`formation.ts slotTarget`): 수비 시 x 는 공 쪽으로 blockX 0.45 × follow, y 는 blockY 0.2 → 0.35 × follow — follow = 1 + 3×(0.8 − 0.55) = **1.75**(압박 전술이면 더 따라감, C.76s). 가로 폭 0.65 배. 그 밖에 게겐 고유의 공 쪽 밀집은 없다(깊은 밀집 `compact` 는 블록·역습만).
5. **존 마크**: 자기 슬롯 14 m 안 가장 가까운 상대(focus = 위협 1위 우선)를 **골 쪽 2 m**(공 쪽 45% 섞음)에서, 중원 줄은 슬롯 65% + 마크 35%. 소유자는 제외. 즉 마크 자리는 "받지 못하게 공 쪽에서" 가 아니라 "받은 뒤 돌지 못하게 골 쪽에서".
6. 2선 침투 추적(`trackMax` 2)·CB 따라나옴·박스 수비(`boxDefense`)·CDM 스크린은 골 앞 규칙 — 빌드업 단계와 무관.

사용자 설계 2 와 다른 점(그래서 이번 스위치가 바꾸는 것):
- ① **팀 전체 공 쪽 이동**: 지금은 blockX/blockY × 1.75 가 전부(성향 무관 압박 수치의 함수). → `gegenFollow` k: 게겐 수비 시 공 쪽 쏠림 ×(1 + k).
- ② **2명 압박**: 이미 있다(둘째는 11.5 m 안). → `gegenSecondDist` k 로 둘째 가담 거리를 pressDist × k 로(1.0 = 19 m).
- ③ **나머지는 수신 후보 선제 마크**: 지금은 없다 — 역압박 2·3번은 패서 쪽 35% 지점, restMark 는 4초·골 쪽 위협 기준, 존 마크는 골 쪽 2 m. → `gegenMarkN` n: 상대 소유 내내(공이 우리 골 `gegenMarkFrom` 30 m 밖일 때) 압박(순위 0·1)·역압박·커버·면제가 아닌 선수가 **소유자에게 가까운 순 n 명**의 패스 후보를 **공 쪽 1.5 m**(`gegenMarkGap`, 수신자 압박 패널티 5 m·패스길 폭 1.8 m 안)에서 마크. 닿을 수 없으면(도착 > `gegenMarkSlack` 1.5초) 그 후보는 비운다. `restMark` 는 이 마크를 받은 선수를 뺀다. `gegenMarkWindow` w > 0 이면 잃은 뒤 w 초 안에서만(엔진관리자21 가설 2 의 대용).
- 티키 쪽(사용자 1): `tikiSupportMul`(지원 간격 10~18 m ×k) · `tikiWidthMul`(소유 중 슬롯 가로 폭 ×k) · `tikiDepthMul`(슬롯 x 를 공 x 쪽으로, 줄 간격 ×k). 롱패스 실행식은 그대로.
- 엔진관리자21 가설 1: `gegenCompact`(게겐 소유 중 지원 간격 ×k).

## 3. 탐침 — 스위치별 기제 (게겐 대 티키 160 × 2 방향, 시드 41000)
(측정 뒤 채움)

## 4. 칸 판정 (960 규칙: 시드 41000·51000 두 벌 ≥ 1920경기, 기준 +0.11 ± 0.03)
(측정 뒤 채움)

## 5. 처방 (코드 세션용 양식)
(측정 뒤 채움)

## 6. 재현 명령
- 측정 1: `npx vite-node scripts/diag/c79y-gegen.ts -- 160 seed=41000 only=gegenpress/tikitaka,gegenpress/balanced,gegenpress/direct,gegenpress/counter,gegenpress/block,tikitaka/balanced,tikitaka/direct` (WORKERS=2 약 12분)
- 스위치 탐침: `npx vite-node scripts/diag/c79y-gegen.ts -- 160 seed=41000 tendency.gegenMarkN=4 …` (덮어쓰기 경로는 `tendency.<이름>`, c79w 와 같다)
- 칸: `npx vite-node scripts/diag/c78s-matrix.ts -- 960 only=tikitaka/gegenpress seed=41000 tendency.…=… out=….json`
