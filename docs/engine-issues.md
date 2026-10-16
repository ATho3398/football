# 엔진 문제 기록 (docs/automation.md 1번 4항, 2번)

## 미해결 목록
1. **C.28 GK 루즈볼 — 상대 코너 비율 미달, 경량 평점 가드 실패** (18단계, 2026-10-16, 브랜치 `claude/c28-gk-loose-ball`, main 미배포)

---

## C.28 GK 루즈볼 (18단계)

- **해결 어려움 기준**: automation.md 2번 ① — 패치당 조정 2회를 모두 쓰고도 미달.
- **브랜치**: `claude/c28-gk-loose-ball` (구현 커밋 448e509). 결과·조정 기록·전후 비교는 기획서 부록 C.28.
- **명세**: `docs/engine-diagnosis-12.md` A3, B1 ①, 5번 표 옛 "C.25" 줄.

### 통과한 기준
GK 처리 71.9%(≥70%), 추격 중 실점 0.02/경기(≤0.05), 스위퍼 상대 침투 수신 8.4 < 클래식 10.7, `balance:quick` 득점 1.35 → 1.26(±0.1), 골킥 15.8 → 14.2, 속도 반응 +13.0%(≥+4.0%), `balance:check` 15/15, 순간이동 0, 600경기 평점 표본(평균 6.52, σ 0.73, 포지션 6.49~6.60, ST 무득점 5.93).

### 미달 1: 닿을 수 있는 에피소드 중 상대 코너 6.2% (기준 5% 이하)
- 클래식 1.2%, 스위퍼 9.3% (GK 유형 고정 30경기씩).
- 진단 추적(`polish-a` 실패 에피소드): 대부분 **우리 팀 수비수·미드필더의 빗나간 패스**(받을 선수 GK 또는 CB). 루즈 비행 착지 뒤 속도가 `resolveFlight`(지금은 `physics.ts landingVelocity`)에서 "남은 속도 그대로, 최소 4 m/s"라 20~40 m/s로 굴러 GK 뒤 골라인을 넘는다. 스위퍼는 8~14 m 앞에 서 있어 더 자주. GK 반응 0으로 달려도 못 닿는다.
- 가설: 원인은 GK가 아니라 루즈 패스 물리(빗나간 패스의 착지 뒤 속도). `polish-a`의 "닿을 수 있음" 판정(반응 0.5초 + 7 m/s로 착지점까지)이 착지 뒤 계속 굴러가는 것을 보지 않아 분모가 넉넉하다.

### 미달 2: `balance:engine:check` 경량 평점 가드 6개 실패
- CB 6.73, CM 6.71, CAM 6.73, WING 7.03, ST 6.74 (가드 6.3~6.7), 시즌 XP 비 1.20 (가드 0.85~1.15).
- 경량 `rating` 표본은 120경기, 포지션군 칸당 8명(포지션당 24명) → 포지션 평균 표본 오차 약 ±0.16. 조정 1과 조정 2 사이 엔진은 GK 반응 한 줄만 바뀌었는데 평균이 6.51 → 6.71로 움직였다. 같은 시드를 포함한 600경기 표본(`rating-parts`)은 모두 기준 안.
- 가설: 가드 폭(±0.2)이 표본 오차보다 좁다. 시즌 XP 비도 6명 1시즌 표본이라 1.13 → 1.15 → 1.20을 오갔다.

### 재현 명령
```
git checkout claude/c28-gk-loose-ball
npx vite-node scripts/diag/polish-a.ts -- 60 78 76                 # 닿을 수 있는 에피소드 결과, 추격, 침투 (약 1.5분)
GKTYPE=sweeper npx vite-node scripts/diag/polish-a.ts -- 30 78 76  # 스위퍼 고정 (classic 도 같은 방식)
SWEEP_N=600 SWEEP_D=0 SWEEP_D15=0 SWEEP_LEAGUE=0 npm run balance:quick   # 득점·선방·골킥 (약 5분)
npm run balance:engine:check                                       # 경량 가드 (약 2.5분)
npx vite-node scripts/diag/rating-parts.ts -- 600 parts.json       # 600경기 평점 성분
```

명령 시각 2026-10-16 13:56:20 KST / 기록 시각 2026-10-16 13:58 KST
