너는 게임 시스템 코드 세션 "51단계_게겐프레싱 체력·선수 생명 비용 (C.78t)"이다(Opus 5.5, 노력도 높음). 마스터는 AC(session_01YVaigKWgUisM6WkGkEWkkY, 마스터 브랜치 claude/planning-ac). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c78t-gegen-cost` — origin/main 최신에서 시작, main 푸시 전 origin/main merge. 병렬: C.78r(엔진 가드·평점 계수·CI), C.78u(유망주 계약) — balance.ts는 서로 다른 절만 건드린다, 충돌 나면 merge로 푼다.

근거: docs/planning-pending.md 146(origin/claude/planning-ac에서 `git show`로 읽기) — 사용자 확정 "게겐 비용 둘 다":
1. **시즌 피로 누적**: 게겐프레싱(`tendency === 'gegenpress'`) 팀에서 뛴 경기마다 시즌 피로가 추가로 쌓여, 로테이션(벤치·휴식) 없이 계속 뛰면 리그 후반기 경기력이 눈에 띄게 떨어진다. 휴식·출전 안 한 주에는 회복. 지금 피로·회복 구조(src/game.ts·training.ts·match.ts의 fatigue)를 먼저 파악하고, 그 위에 "시즌 누적 피로"를 얹어라(경기 직전 컨디션 → 엔진 체력 시작값/실행 배율 같은 기존 통로로만, 엔진 판단 코드 수정 금지). NPC 팀이 뎁스 개념이 없으면 내 선수(와 내 팀 선발 판정)에만 적용하고 그렇다고 보고.
2. **선수 생명 단축**: 게겐 팀에서 오래 뛴 선수는 노화가 1~2년 빨리 온다 — 선수별 게겐 출전 누적(시즌 수 또는 분)을 기록해 `BALANCE.aging` 시작 나이를 당긴다(예: 게겐 3시즌 이상 −1년, 5시즌 이상 −2년, 수치는 너가 근거와 함께 정함). 내 선수 필수, NPC 선수는 세이브 크기·성능이 허락하면.
3. **화면 최소**: 전술 화면 게겐 선택 시 한 줄 경고("체력 소모 큼 · 오래 쓰면 선수 생명 단축"), 내 선수 상태에 시즌 누적 피로가 보이게(기존 피로 표시 옆 한 줄). 새 화면 금지(UI 단계 아님).

가드: `npm run balance` 회귀 가드(성장·재정 등) · 엔진 지문 불변(엔진 코드 무수정이면) · typecheck·test. 밸런스 수치는 전부 `src/config/balance.ts`, BALANCE_VERSION +1, 세이브 구조 바뀌면 SAVE_FORMAT_VERSION +1(**이전 코드 금지**, 옛 세이브는 안내 뒤 삭제). 측정: 게겐 내 선수 로테이션 없음/있음 시즌 후반 평점·컨디션 차, 게겐 5시즌 선수 은퇴 나이 차 — 표로 보고.
**main 푸시**: 마스터 AC "푸시 ㄱ" 뒤(origin/claude/planning-ac의 docs/ 병합). 예산 2시간·10달러. PATCH_LABEL 'C.78t', STAGE_LABEL '51단계'(17.2 표에 51단계 줄 추가 — 기획서 17.2와 부록 C.78t 작성). 준비 완료·실패면 AC에 send_message로 보고(전후표·가드·테스트·커밋·시간·비용). CI 성공은 보내지 않는다.
