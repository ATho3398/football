# PLAYER ONE — 디자인 핸드오프 · B (브로드캐스트)

6차 ui 완성본(A · 볼트)과 **같은 화면·같은 번호·같은 컴포넌트 props**로 다시 그린 B 테마 묶음이에요. A는 그대로 보존돼 있어서, B가 꼬이면 A 묶음(`player-one-design/`)으로 돌아가면 돼요.

- 이번 판은 **핵심 화면 20장 먼저**예요. 확인받은 뒤 나머지 139장을 같은 방식으로 이어서 만들어요.
- 기준: 모바일 390×844, 한국어, 다크. 번호·이름·데이터는 6차와 같아요(아래 표의 A 원본 파일 참고).

## A와 무엇이 다른가

- **배색은 같아요**: 그래파이트 + 라임(토큰 색 값 그대로).
- **모양**: 버튼·세그먼트 탭·뒤로·독 홈 키·진행 칸 = 꺾인 사각형(평행사변형). 모서리 토큰 2~6px, 둥근 알약 없음. 칩은 기울임.
- **글꼴**: 숫자 `font-display` = Barlow Condensed 이탤릭(중계 그래픽), 제목·큰 버튼·미페 이름 `font-head` = Black Han Sans, 본문 Pretendard.
- **머리말**: 어두운 바탕 + 오른쪽 라임 사선 면, 아래 2px 라임 줄. 큰 숫자는 라임.
- **미페 머리말**(홈·선수 화면): `HeroPanel face kit name unit` — 배경 투명 미페를 **색 처리 없이** 세우고 뒤에 라임 등번호, 아래 사선 검정 면. 샘플 미페는 손흥민 사진(이도윤 화면도 임시로 같은 사진).
- **독**: 위 2px 라임 줄, 홈 키 꺾인 사각형. 진행 칸 높이 44px, [계속]은 라임 단색 + 글자 17px → 굵은 화살표(그라데이션 없음). PC 40px · 14px.

## 구현 방법 (클로드 코드에게)

1. `design-system/components/bundle.css` 맨 끝 **"B 테마 · 브로드캐스트" 블록**과 `tokens.json`(글꼴 PO Display·PO Head, 모서리)이 A와의 차이 전부예요. 컴포넌트 구조·props는 A와 같아요.
2. `HeroPanel`에 `face`(투명 미페 URL) · `kit`(등번호) · `name` · `unit` props가 추가됐어요. `face`가 있으면 미페 머리말, 없으면 일반 B 머리말.
3. 테마 전환을 코드로 두려면: A/B 토큰 파일 두 벌 + B 블록 CSS를 `[data-skin="b"]` 아래로 묶는 방식을 추천해요(되돌리기 쉬움).
4. 화면 html의 안쪽 모서리 값(인라인 `border-radius`)은 B에서 6/4/3px로 줄였어요.

## 화면 (20장)

| # | 화면 | 캡처 | A 원본 |
|---|---|---|---|
| 66 | 설정-기본 | `screens/png/66_설정-기본.png` | `R5-Settings.dc.html` |
| 73 | 경기화면-세로-하이라이트 | `screens/png/73_경기화면-세로-하이라이트.png` | `R5-Match-V-Highlight.dc.html` |
| 77 | 결정순간-세로-기본 | `screens/png/77_결정순간-세로-기본.png` | `R5-Decide-V.dc.html` |
| 86 | 홈-시즌중 | `screens/png/86_홈-시즌중.png` | `R5-Home-Season.dc.html` |
| 91 | 훈련일정-기본 | `screens/png/91_훈련일정-기본.png` | `R5-Training.dc.html` |
| 93 | 선수-능력치 | `screens/png/93_선수-능력치.png` | `R5-Player-Attr.dc.html` |
| 101 | 월드-순위표 | `screens/png/101_월드-순위표.png` | `R5-World-Table.dc.html` |
| 116 | 덱편집-덱세트3 | `screens/png/116_덱편집-덱세트3.png` | `R5-Deck-Sets.dc.html` |
| 120 | PC-홈 2열 | `screens/png/120_PC-홈 2열.png` | `R5-PC-Home.dc.html` |
| 124 | 새게임-커스텀-기본 | `screens/png/124_새게임-커스텀-기본.png` | `R6-Custom-Basic.dc.html` |
| 131 | 새게임-실제선수-레전드 | `screens/png/131_새게임-실제선수-레전드.png` | `R6-NewGame-Legends.dc.html` |
| 132 | 홈-1군테스트 | `screens/png/132_홈-1군테스트.png` | `R6-Home-FirstTeamTest.dc.html` |
| 134 | 선수-신체·양발·태그 | `screens/png/134_선수-신체·양발·태그.png` | `R6-Player-BodyTags.dc.html` |
| 136 | 선수-계약과이적 | `screens/png/136_선수-계약과이적.png` | `R6-Player-Contract.dc.html` |
| 144 | 덱편집-그림섞임 | `screens/png/144_덱편집-그림섞임.png` | `R6-Deck-ArtMix.dc.html` |
| 145 | 이적제안-목록-v2 | `screens/png/145_이적제안-목록-v2.png` | `R6-Offers-v2.dc.html` |
| 154 | 독-홈가운데 | `screens/png/154_독-홈가운데.png` | `R6-Dock-HomeCenter.dc.html` |
| 155 | 경기결과-하이라이트버튼 | `screens/png/155_경기결과-하이라이트버튼.png` | `R6-Result-HighlightBtn.dc.html` |
| 156 | 경기준비 | `screens/png/156_경기준비.png` | `R6-PreMatch.dc.html` |
| 159 | 훈련-프리셋 | `screens/png/159_훈련-프리셋.png` | `R6-Training-Presets.dc.html` |

## 다음 단계

- 확인 후 나머지 139장(57~159 중 이번에 빠진 것 + 1~56)을 같은 규칙으로 만들어요.
- 결정 필요: 미페가 없는 선수(생성 선수·하부 리그 선수)의 머리말 — 일반 B 머리말로 둘지, 기본 실루엣 미페를 둘지.
