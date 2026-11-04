너는 UI 코드 세션 "53단계_미페 머리 잘림 — 머리말 위 여백 (C.81f)"이다(Opus 5.5, 노력도 높음). 마스터 AD(session_01YVaigGhehXaRqBVTGBzTwo, 브랜치 claude/planning-ad). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). CLAUDE.md·docs/automation.md를 따른다(보고는 내용으로). 브랜치 `claude/c81f-face-headroom` — origin/main 최신에서 시작. **엔진 코드는 건드리지 않는다.**

근거: 사용자(11/04 17:3x KST, 실기기 캡처 `docs/ui-requests/feedback-3/홈-미페-머리-잘림.jpg`) **"이거 미페 위에 잘리는 거 여전하네;; 미페 표시되는 면적 위에 여유 공간을 두고, 그 위로 상태창(도구 줄) 넣으면 되잖아. 고치라고."** 지금 홈 머리말(HeroPanel face, `src/ui/components/layout.ts faceHero`·`src/ui/design/bundle.css`·`skin-b.css`)에서 선수 사진(미페) 머리 윗부분이 위 도구 줄(뒤로·날짜·알림·저장… 아이콘 줄) 뒤에 가려져 이마 위가 잘린다.

## 할 일
1. 미페 머리말 구조를 **위에서부터: 도구 줄(상태창) → 여유 공간 → 미페 사진 영역** 순서로 쌓아, 도구 줄이 사진 위를 덮지 않게 한다. 사진 영역 위쪽에 머리카락 끝까지 다 보이는 여백(사진 비율 기준 머리 위 최소 6~8%)을 둔다. 사진을 위로 잘라내는 `object-position`/`background-position`·음수 margin·absolute 겹침이 원인이면 고친다.
2. 미페를 쓰는 다른 머리말도 같은 규칙: 홈 · 선수 · 경기 결과 · 포토카드 · 시즌 요약 등 HeroPanel face 사용처 전부 + 기본 사진·페이스팩 사진·사진 없음(꺾인 판) 경우.
3. 폰 390×844(노치/상태 표시줄 safe-area 포함)·작은 폰 360×780·PC 1280×800에서 확인.
4. 17차 재설계 디자인(K12 머리말)에도 같은 규칙이 들어가도록 `docs/ui-requests/17-full/`에 한 줄 메모(AD가 디자이너에게 전달).

## 관문·배포
- Playwright 캡처 전후(폰 390·360, PC) `docs/captures/c81f/` — 머리 윗부분이 도구 줄에 안 가리는지, 머리말 높이가 너무 커지지 않았는지(폰 첫 화면에서 다음 경기 카드가 보이는 정도 유지) · typecheck · test · build.
- 통과하면 승인 없이 main 푸시(claude/planning-ad docs 병합). PATCH_LABEL 'C.81f', STAGE '53단계', 부록 C.81f.
- 예산 1시간·5달러. 끝나면 AD에 보고(전후 캡처 경로, main 해시).
