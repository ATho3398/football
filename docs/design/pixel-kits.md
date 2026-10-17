# 도트 선수 아이콘 자동 적용 명세 (경기 화면 "캐릭터" 보기)

2026-10-17 18:40 KST, 사용자 결정 → 기획 세션 L 작성. 반영은 **34단계 C.45**(pending 55·56). 원본 팩: `docs/design/incoming/kits_full_pack.zip`(2차, 사용자가 중동계 추가·조합 2개 삭제).

## 1. 팩 구성 (2차)
- 유니폼 32종: 단색 `solid/C01~C11`, 줄무늬 `stripe/S01~S21`. 파일 이름 `<유니폼 키>_<피부>_<머리>.png`(유니폼 키 예: `C01_solid_red`, `S01_juventus`).
- 사람 14종(피부 4 × 머리):
  | 피부(내부 키) | 머리 |
  |---|---|
  | `black` | `black`, `blonde`, `bald` (갈색 머리는 구분이 안 돼 삭제) |
  | `yellow` | `black`, `blonde`, `brown`, `bald` |
  | `white` | `black`, `blonde`, `brown`, `bald` |
  | `mideast` (2차 추가, 중간 피부톤) | `black`, `brown`, `bald` (금발은 어색해 삭제) |
- 32 × 14 = 448조합, 각각 128px와 `raw16/` 16px 원본. 레포에는 **`raw16`만** `public/faces/pixel/kits/`로 옮긴다(약 1.8 MB). 화면에는 16px를 정수 배(×2 = 32px, ×3 = 48px)로 `image-rendering: pixelated` 표시.
- 피부·머리 키는 내부용이다. 화면에 노출하지 않는다.

## 2. 매니페스트 (`public/faces/pixel/manifest.json` version 2)
```json
{
  "version": 2,
  "dir": "kits",
  "kits": {
    "C01": { "file": "C01_solid_red", "colors": ["#d0202a"] },
    "S01": { "file": "S01_juventus", "colors": ["#111111", "#ffffff"] }
  },
  "people": {
    "black": ["black", "blonde", "bald"],
    "yellow": ["black", "blonde", "brown", "bald"],
    "white": ["black", "blonde", "brown", "bald"],
    "mideast": ["black", "brown", "bald"]
  },
  "players": { "son": { "skin": "yellow", "hair": "black" } }
}
```
- `kits.colors`는 색 거리 계산용이다. 코드 세션이 16px 원본에서 몸통 픽셀 평균으로 뽑아 채운다(눈대중 금지).
- 이미지가 없거나 조합이 빠졌으면 지금처럼 **등번호**로 대체한다.
- 기존 C.43 version 1 형식(`players`: 파일 직접 지정)은 그대로 읽는다. 둘 다 있으면 직접 지정이 먼저다.

## 3. 선수 → 피부·머리
1. **실제 선수**: 5번 표(`data/players/pixelLook.ts`). 2018-19 시즌 모습 기준이고 웹 검색으로 확인했다.
2. **가상 선수(로스터 생성기·유망주)**: 외모군(`src/appearance.ts`)에서 피부를 고르고, 피부별 머리 분포에서 머리를 뽑는다. 난수는 `pixel:<선수 id>` 시드로 따로 쓴다. 기존 시드 흐름(경기 결정성)을 건드리지 않는다. 수치는 `BALANCE.pixelLook`에 둔다.
   | 외모군 | 피부 | 머리 분포(%) |
   |---|---|---|
   | 동양계 | yellow | black 85, brown 10, bald 3, blonde 2 |
   | 백인 | white | brown 45, blonde 25, black 22, bald 8 |
   | 아일랜드계 | white | brown 50, blonde 40(붉은 머리 대용), black 5, bald 5 |
   | 흑인 | black | black 88, bald 10, blonde 2 |
   | 라틴·중동계 | mideast 70 / white 30 | mideast: black 75, brown 18, bald 7 · white: black 50, brown 45, bald 5 |
3. **없는 조합 대체**(데이터 실수·이후 팩 변경 대비): black+brown → black+black, mideast+blonde → mideast+brown, 그 밖에는 같은 피부의 첫 머리.
4. **내 유망주**: C.45 커스텀 생성에서 고른 외모군을 저장하므로 피부도 그에 따른다. 머리는 생성 화면에서 고르게 한다(피부별 가능한 머리만, 기본값은 분포 추첨). `PlayerState`에 `pixelHair` 저장, `SAVE_FORMAT_VERSION`을 올린다.

## 4. 팀 → 유니폼 (홈·원정·GK)
- 데이터: `data/kits.ts`에 `CLUB_KITS[구단 id] = { home, away }`, `NATION_KITS[국가] = { home, away }`. 대표팀 경기(5-6·6단계)가 생기면 바로 쓴다.
- 표에 없는 구단(가상 구단 등): `TEAM_COLORS` 주 색과 가장 가까운 단색이 홈, 홈과 가장 먼 단색이 원정이다.
- **경기마다 고르는 규칙**
  1. 홈 팀은 늘 홈 유니폼을 입는다.
  2. 원정 팀은 홈 유니폼을 입는다. 단, 두 홈 유니폼의 색 거리가 기준(`BALANCE.pixelLook.clashDistance`, 초안 RGB 거리 120)보다 가까우면 원정 유니폼을 입는다. 원정도 가까우면 홈 팀과 가장 먼 단색을 입는다.
  3. **GK**: 단색 `C07 초록 → C06 노랑 → C09 주황 → C10 보라 → C05 검정 → C04 하늘` 순서로 본다. 양 팀 필드 유니폼, 그리고 상대 GK와 모두 기준 이상 떨어진 첫 번째 것을 고른다. 홈 GK를 먼저 정한다.
  4. 같은 팀 선수가 비슷해 보이므로 캐릭터 보기에서도 아이콘 아래에 작은 등번호를 붙인다(pending 55의 5번).
- 경기 결과·리플레이에는 고른 유니폼만 저장한다. 엔진·시드에는 영향이 없다.

### 4.1 PL 2018-19 (20개)
팩 32종 중 실제 색에 가장 가까운 것을 골랐다(근사). 원정은 2018-19 원정 유니폼 색 기준이고, 팩에 없는 색(분홍·회색 등)은 가까운 색으로 바꿨다.
| 구단 | 홈 | 원정 |
|---|---|---|
| mci 맨시티 | C04 하늘 | C08 남색 |
| liv 리버풀 | C01 빨강 | C02 흰 |
| che 첼시 | C03 파랑 | C02 흰 |
| tot 토트넘 | C02 흰 | C08 남색 |
| mun 맨유 | C01 빨강 | C02 흰(실제 분홍) |
| ars 아스널 | C01 빨강 | C08 남색 |
| eve 에버턴 | C03 파랑 | C05 검정 |
| lei 레스터 | C03 파랑 | C05 검정 |
| whu 웨스트햄 | C11 클라렛 | C04 하늘 |
| wol 울브스 | C09 주황(금색 대용) | C05 검정 |
| cry 팰리스 | S10 팰리스 | C02 흰 |
| wat 왓퍼드 | C06 노랑 | C05 검정 |
| bou 본머스 | S04 밀란(적흑 줄) | C03 파랑 |
| new 뉴캐슬 | S01 유벤투스(흑백 줄) | C08 남색 |
| sou 사우샘프턴 | S05 아틀레티코(적백 줄) | C05 검정 |
| bur 번리 | C11 클라렛 | C04 하늘 |
| bha 브라이턴 | S06 포르투(청백 줄) | C06 노랑 |
| ful 풀럼 | C02 흰 | C05 검정 |
| car 카디프 | C03 파랑 | C05 검정 |
| hud 허더스필드 | S06 포르투(청백 줄) | C06 노랑 |

### 4.2 리그 밖 구단 (`data/outsideClubs.ts`)
| 구단 | 홈 | 원정 |
|---|---|---|
| x:bar 바르셀로나 | S02 | C06 |
| x:rma 레알 마드리드 | C02 | C08 |
| x:juv 유벤투스 | S01 | C08 |
| x:bay 바이에른 | C01 | C02 |
| x:psg PSG | S21 | C02 |
| x:atm 아틀레티코 | S05 | C08 |
| x:bvb 도르트문트 | C06 | C05 |
| x:nap 나폴리 | C04 | C02 |
| x:int 인테르 | S03 | C02 |
| x:rom 로마 | C11 | C02 |
| x:mil 밀란 | S04 | C02 |
| x:b04 레버쿠젠 | C01 | C05 |
| x:sev 세비야 | C02 | C01 |
| x:ol 리옹 | C02 | C08 |
| x:ajx 아약스 | S18 | C08 |
| x:fcp 포르투 | S06 | C05 |
| x:slb 벤피카 | C01 | C02 |
| x:vil 비야레알 | C06 | C08 |
| x:zen 제니트 | C04 | C02 |
| x:asm 모나코 | S19(적백 반반) | C05 |
| x:gal 갈라타사라이 | C01 | C02 |
| x:cel 셀틱 | S13 | C06 |
| x:psv PSV | S05 | C05 |
| x:avl 애스턴 빌라 | C11 | C04 |
| x:wba 웨스트브롬 | S08 | C06 |
| x:lee 리즈 | C02 | C08 |
| x:sto 스토크 | S05 | C05 |
| x:der 더비 | C02 | C05 |
| x:nor 노리치 | C06 | C05 |
| x:bri 브리스톨 시티 | C01 | C02 |
| x:not 노팅엄 포리스트 | C01 | C02 |
| x:mid 미들즈브러 | C01 | C05 |
| x:ipw 입스위치 | C03 | C01 |
| x:wig 위건 | S06 | C01 |

### 4.3 대표팀 (2018 월드컵 무렵, `BALANCE.appearance.byNationality` 국가)
| 국가 | 홈 | 원정 |
|---|---|---|
| England | C02 | C01 |
| Scotland | C08 | C02 |
| Republic of Ireland | C07 | C02 |
| Northern Ireland | C07 | C02 |
| Wales | C01 | C05 |
| France | C08 | C02 |
| Spain | C01 | C02 |
| Portugal | C11 | C02 |
| Germany | C02 | C07 |
| Netherlands | C09 | C08 |
| Belgium | C01 | C06 |
| Brazil | C06 | C03 |
| Argentina | S07(하늘·흰 줄) | C05 |
| Uruguay | C04 | C02 |
| Senegal | C02 | C07 |
| Nigeria | C07 | C02 |
| Egypt | C01 | C02 |
| Gabon | C06 | C07 |
| Denmark | C01 | C02 |
| Norway | C01 | C02 |
| Korea Republic | C01 | C02 |
| Japan | C08 | C02 |
| China | C01 | C02 |
표에 없는 국가는 4번 "표에 없는 구단" 규칙을 따르고, 국기 주 색이 없으면 C02 흰/C05 검정을 쓴다.

## 5. 실제 선수 피부·머리 (2018-19 모습, `data/players/pixelLook.ts`)
| 선수 | 피부 | 머리 | 메모 |
|---|---|---|---|
| messi | white | brown | |
| salah | mideast | black | 곱슬 |
| van-dijk | black | black | |
| mane | black | black | |
| firmino | mideast | black | |
| alexander-arnold | mideast | black | 혼혈, 중간 톤 |
| de-bruyne | white | blonde | 붉은 머리 대용 |
| aguero | mideast | black | |
| sterling | black | black | |
| sane | black | black | |
| foden | white | brown | |
| hazard | white | brown | |
| kante | black | black | |
| kane | white | brown | |
| son | yellow | black | |
| eriksen | white | blonde | |
| pogba | black | black | 2018 월드컵 무렵은 염색 없음 |
| rashford | black | black | |
| aubameyang | black | black | 2018 염색 기록 없음 |
| ronaldo | white | black | |
| neymar | white | blonde | 2018 월드컵 백금발, mideast+금발 조합이 없어 white |
| mbappe | black | bald | 짧게 민 머리 |
| griezmann | white | brown | 2018은 짙은 짧은 머리(금발은 그 뒤) |
| modric | white | brown | |
| ramos | mideast | brown | |
| kroos | white | blonde | |
| lewandowski | white | black | |
| suarez | mideast | black | |
| busquets | white | black | |
| sancho | black | black | |
| vinicius | black | black | |
| dybala | white | black | |
| kimmich | white | brown | |
| havertz | white | blonde | |
- 실제 선수가 이 표에 없으면 가상 선수 규칙(3번 2항)을 쓴다. 실제 선수를 늘릴 때는 이 표도 같이 채운다.

## 6. 확인 (C.45 회귀 가드)
- 단위 테스트: 448조합 매니페스트 로드, 없는 조합 대체, 리버풀–맨유처럼 같은 색끼리 붙을 때 원정 선택, GK가 양 팀·상대 GK와 겹치지 않음, 같은 선수 id는 늘 같은 피부·머리.
- 엔진 결정성: 캐릭터 보기를 켜고 끈 경기 결과가 같아야 한다.
- 확인 캡처: 리버풀(홈)–맨유, 첼시–에버턴, 토트넘–풀럼, 뉴캐슬–사우샘프턴 경기 화면 캐릭터 보기를 `docs/design/c45-check/`에 저장한다.
