# 팩 개봉 연출 바꾸기 (C.76o)

카드팩·카드 선택권을 열 때 나오는 연출은 지금 **코드로 그린 모션 그래픽**이에요. 직접 만든 영상이나 PNG 연속 이미지로 바꿀 수 있어요. 결과(어떤 카드가 나오는지)는 바뀌지 않고, 연출은 정해진 결과를 보여 주기만 해요.

## 0. 표지 한 장 넣기 (가장 쉬움, 추천)

팩 그림만 내 이미지로 바꾸고 흔들림·포일 반사광·찢어짐·빛·카드 공개는 그대로 써요. **설정을 바꿀 필요 없이 파일만 넣으면 돼요.**

- **지금 들어 있는 표지**: `public/anim/pack/cover.webp`(사용자 완성 패키지 800×1310, 투명 배경, 로고·비닐 광·봉합선이 그림에 있음). 바꿀 그림도 이렇게 만들면 그대로 쓰여요. 그림 비율·찢는 선이 다르면 `src/ui/packAnim/config.ts` 의 `PACK_COVER`(aspect 가로/세로, tear 찢는 선, glare 반사광 세기)를 맞춰요. 투명 배경이 아닌 전면 그림이면 `cut: true`(팩 모양으로 자르기), 글자가 없으면 `labels: true`(게임 이름·팩 이름을 게임이 얹기).
- **형식**: WebP 또는 PNG(webp를 먼저 찾아요), **투명 배경** 권장(전면 그림도 됨), 세로 비율 약 0.6(권장 800×1310 또는 800×1200, 300KB 이하). 팩 모양(둥근 모서리·톱니 등)은 그림에 직접 그려요. 반사광은 그림이 있는 곳(불투명한 곳)에만 겹쳐요.
- **찢는 선**: 지금 위에서 **약 7%**(위 톱니 봉합선 바로 아래, 1310 높이면 92px 근처)가 지그재그로 찢겨 위 띠가 날아가요. 이 줄 근처에는 로고·글자처럼 중요한 그림을 두지 마세요. 위치는 `PACK_COVER.tear` 값(0.07)으로 바꿔요.
- **넣을 곳·이름**: `public/anim/pack/cover.webp`(또는 `cover.png`) — 모든 팩에 쓰여요. 바꾸려면 같은 이름으로 덮어써요.
- **종류별 표지**(있으면 먼저 씀, 없으면 `cover`, 확장자는 .webp/.png):
  - `cover-normal.webp` — 일반 카드팩
  - `cover-achievement.webp` — 업적·시즌 목표 선택권(에픽·전설)
  - `cover-pick.webp` — 그 밖의 카드 선택권(레벨·시즌 보상)
  - 선택권은 종류별 표지가 있을 때만 팩으로 나오고, 없으면 지금처럼 빛 구슬로 시작해요.
- 이미지가 없거나 못 읽으면 지금의 코드로 그린 팩(PLAYER ONE · P1)이 나와요.

아래 1~3은 연출 전체를 영상·연속 이미지로 바꾸는 방법이에요(우선순위 낮음).

## 1. 파일 만들기

연출 4개를 **희귀도별로** 만들어요. 팩에서 나온 가장 높은 희귀도의 파일이 재생돼요.

| 희귀도 | 영상 파일 이름 | PNG 시퀀스 폴더 |
|---|---|---|
| 일반 | `pack-common.webm` | `pack-common/` |
| 희귀 | `pack-rare.webm` | `pack-rare/` |
| 에픽 | `pack-epic.webm` | `pack-epic/` |
| 전설 | `pack-legendary.webm` | `pack-legendary/` |

- **영상**: webm(VP9) 권장, mp4(H.264)도 돼요. 2~5초, 세로 1080×1920 또는 정사각 1080×1080, 파일 하나 3MB 이하 권장. 영상은 화면 가운데에 비율을 지켜 맞춰져요(남는 곳은 게임 배경).
- **투명 배경 권장**: webm(VP9 + 알파) 또는 투명 PNG면 게임 배경 위에 자연스럽게 얹혀요. mp4는 투명이 안 되니 배경을 어둡게(#0b0d11 근처) 만들어 주세요.
- **PNG 시퀀스**: `0001.png`, `0002.png` … 1부터 네 자리 번호. 30fps 기준 60~120장, 장당 크기는 720×1280 이하 권장(모두 미리 읽어서 재생해요).
- 소리: 영상에 소리를 넣어도 되지만 기본은 음소거로 재생돼요(아래 `sound: true`).
- Lottie(json)는 파일을 주면 그때 재생기를 붙여요.

## 2. 넣는 곳

레포의 `public/anim/pack/` 폴더에 넣어요. 예: `public/anim/pack/pack-legendary.webm`, `public/anim/pack/pack-epic/0001.png`.

## 3. 한 줄 바꾸기

`src/ui/packAnim/config.ts` 의 `PACK_ANIM` 한 줄만 바꿔요.

```ts
export const PACK_ANIM: PackAnimConfig = { kind: 'motion' };                     // 지금(코드 연출)
export const PACK_ANIM: PackAnimConfig = { kind: 'video', ext: 'webm' };         // 영상 (mp4면 ext: 'mp4', 소리 켜기 sound: true)
export const PACK_ANIM: PackAnimConfig = { kind: 'sequence', frames: 90, fps: 30 }; // PNG 시퀀스 (장 수 · 초당 장 수)
```

- 영상·시퀀스가 끝나면 **카드 뒤집기·결과 목록은 그대로 코드 연출**이 이어서 해요. 영상에 카드 공개까지 들어 있으면 `reveal: false` 를 붙여요(그러면 영상 뒤 바로 결과 목록).
- 파일을 못 읽으면(이름 틀림 등) 자동으로 코드 연출로 돌아가요.
- 확인: 게임 설정 → 꾸미기 → **연출 미리보기**(일반·희귀·에픽·전설·선택권) 단추로 바로 볼 수 있어요. [건너뛰기]는 언제나 돼요.

## 4. 설정

설정 → 꾸미기 → **팩 개봉 연출: 전체 / 짧게 / 끔**(이 기기에 저장). 기기에서 '움직임 줄이기'를 켜면 전체도 짧게 보여요. 끔이면 예전처럼 알림 한 줄만 떠요.

## 개발자 메모

- 모듈: `src/ui/packAnim/` — `types.ts`(인터페이스 `PackAnimation { play(opts: { pack, cards, bestRarity }): Promise<void>; skip(): void }`), `motion.ts`(기본), `media.ts`(영상·시퀀스 어댑터), `particles.ts`(Canvas 2D 입자, 폰 상한 160개), `model.ts`(규칙·파일 이름), `sound.ts`(효과음 훅 `setPackSfx`, 지금은 소리 없음), `index.ts`(`playPackReveal`: 덮개·건너뛰기·결과 목록).
- 다른 구현을 붙이려면 `PackAnimation` 을 구현하고 `index.ts` 의 `createPackAnimation` 에 한 갈래 더하면 돼요.
