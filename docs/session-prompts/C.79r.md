너는 엔진 코드 세션 "53단계_직선 롱볼 라인 뒤 (C.79r)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(0번 맨 위, 판단 보정 원칙, 상성 960 판정·칸 관문 보정, 측정 운영). 브랜치 `claude/c79r-direct-behind` — origin/main 최신에서, main 푸시 전 merge(여러 엔진 세션이 동시에 돎 — 겹치면 merge 뒤 재측정).

근거: 처방 D1 — 엔진관리자19 `docs/engine-diagnosis-c79l.md`(origin/claude/engine-manager-19) §3·§4: 직선 롱볼 80%가 자기 진영·중원(x 0.55) 착지, **상대 라인 9 m 앞으로 내려온 ST**에게 가는 30 m 패스(라인 뒤 3%, 앞 동료 0.3명) → 10초 안 슛 4%, 직선 선수빨 nofinish +0.14±0.14. 사용자 설계(pending 146): 직선 = 역습·반대 전환에 강함, 받는 쪽 퍼스트 터치·피지컬·공중 경합.
- 할 일: ① 직선 전환 롱볼 판단 보정(`decide.bias.directLong`)의 조건을 **라인 뒤 침투(through 공중 패스)** 에만 ② 직선 성향 ST 1명 **수비 라인에 붙박이**(내려오지 않고 라인 끝에서 뒷공간 노림, 오프사이드 규칙 그대로) ③ 받은 뒤 2선 지원(세컨드볼 자리) 필요하면.
- 관문: 직선 선수빨(c78s-fit profile=c79d comp=nofinish 800) ≥ +0.2 · 직선 행 ±0.05(960 두 벌, 다른 행 ±0.05·순환 양수·게겐>티키 칸 관문) · 직선 롱 비율 10~20% · 득점 1.48±0.05 · 이동 거리 · 장면 · typecheck · test · balance:check(60분 넘으면 CI) · engine:check(경량 360 보정이 main에 있으면 그것). 성공 확률 35% — 미달이면 안 된 것 먼저 보고.
- 통과하면 승인 없이 main 푸시. ENGINE +1(merge 순서대로), PATCH_LABEL 'C.79r', STAGE '53단계', 부록 C.79r. 예산 3시간·14달러.
