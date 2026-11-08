너는 코드 세션 "45단계_홈 머리말 긴 이름 잘림 수정 (C.75u)"이다. 마스터는 U(session_01DUqLtswE7hDV9NHhh6HfZq, 마스터 브랜치 claude/planning-u). 모든 답변·보고는 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다(1번 배포 규칙, 7번: 마스터에는 완료·실패·질문만, CI 성공은 안 보냄).

먼저 읽기: CLAUDE.md → docs/automation.md 0·1·7번.

문제(사용자 제보 2026-10-20 15:45, 폰): 홈 얼굴 머리말 이름 "율리안 린트너"가 46px 그대로 "율리안 린트…"로 말줄임. 사용자 결정: **두 줄 나누기 안 됨**(레반도/프스키처럼 갈라지면 안 됨) → 한 줄 유지, 글씨만 줄여서 맞춘다.
원인(마스터 서브에이전트 재현 완료): `src/ui/main.ts` `fitHeroNames()`가 정수 반올림되는 `scrollWidth > clientWidth + 0.5`로 넘침을 본다. 46px 글자 폭 243.39px vs 칸 244px(폰에 따라 243.x) → 1px 미만 넘침을 못 잡는데 브라우저는 말줄임을 한다. 폰트 늦게 오는 건 원인 아님.

할 일:
1. 아래 수정 적용(Range로 소수점 폭 비교 + 폰트 loadingdone 때 다시 맞춤). 시험 결과 원래 칸·좁힌 칸 모두 45px로 줄고 잘림 없음.
2. 같은 정수 비교 패턴이 다른 이름 맞춤에도 있으면(grep `scrollWidth`) 같이 고친다. 한 줄 유지가 원칙, 최소 24px에서도 넘칠 때만 말줄임.
3. `heroNameSize` 첫 추정(layout.ts HERO_NAME.width 244)에 1~2px 여유를 둘지 판단(첫 그림부터 거의 안 넘치게).
4. 단위 테스트가 가능하면 추가(jsdom이면 Range 폭이 0 — 무리면 Playwright 확인 캡처로 대신), 확인 캡처 docs/c75u-check/(폰 390×844 긴 이름 2~3개: "율리안 린트너", 긴 단일 성 예 "로베르트 레반도프스키", 레전드 긴 이름 1개 / PC 1장).
5. 엔진·밸런스·세이브 버전 그대로. PATCH_LABEL 'C.75u', STAGE_LABEL '45단계'. 부록 C에 C.75u 소절. typecheck·npm test 통과, 푸시 직전 main 최신 병합 후 작업 브랜치 → main 푸시.
병렬: C.75l(44f-a 엔진)·C.75m(45a, main.ts·새 게임 UI 건드릴 수 있음)·C.75t(46a 도감)이 돈다. main.ts는 fitHeroNames 함수만 고쳐 충돌을 줄인다.
완료면 U에 보고(바뀐 것·테스트 수·커밋·캡처).

시험한 수정(origin/main 기준):
```diff
diff --git a/src/ui/main.ts b/src/ui/main.ts
index ba356b6..364ecef 100644
--- a/src/ui/main.ts
+++ b/src/ui/main.ts
@@ -621,14 +621,19 @@ function fitHeroNames(): void {
   for (const el of app.querySelectorAll<HTMLElement>('.po-hero__name[data-fit]')) {
     let size = Number(el.dataset.fit) || HERO_NAME.full;
     const apply = () => { el.style.fontSize = `${size}px`; el.style.lineHeight = `${Math.round(size * 1.08)}px`; };
+    // scrollWidth·clientWidth는 정수로 반올림돼 1px 미만 넘침(말줄임은 됨)을 못 잡는다 → 글자 실폭(Range)을 소수점까지 잰다
+    const range = document.createRange();
+    range.selectNodeContents(el);
+    const over = () => range.getBoundingClientRect().width > el.getBoundingClientRect().width - 1;
     apply();
-    while (size > HERO_NAME.min && el.scrollWidth > el.clientWidth + 0.5) {
+    while (size > HERO_NAME.min && over()) {
       size--;
       apply();
     }
   }
 }
 void document.fonts?.ready.then(fitHeroNames);
+document.fonts?.addEventListener?.('loadingdone', () => fitHeroNames());
 // PC 2열 (C.61): 1024px 경계를 넘으면 배치가 바뀌는 화면이 있어 다시 그린다. 가로 폰(C.66)도 같은 2열이라 돌릴 때 다시 그린다
 globalThis.matchMedia?.(WIDE_QUERY).addEventListener?.('change', () => render());
 globalThis.matchMedia?.(LANDPHONE_QUERY).addEventListener?.('change', () => render());
```
