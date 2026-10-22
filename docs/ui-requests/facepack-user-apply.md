# 적용 명세 — 사용자 미페 사진·구단 로고 (사용자 요청 2026-10-22, UI_5)

사용자가 사진·로고를 주고 이름을 알려 준다 → UI_5가 배경을 지워(rembg isnet-general-use) 정리해 이 폴더에 올린다 → 코드 세션이 레포 facepack에 넣어 배포한다. **앞으로 같은 방식으로 계속 온다**(사용자: "사진에 이름만 달아서 보내면"). 이 표에 줄을 더해 간다.

## 이번 묶음 (1차, 사용자 확인 "지금 딱 좋아")
| 파일 (`docs/design/incoming/facepack-user/`) | 대상 | 게임 id | 비고 |
|---|---|---|---|
| `players/marco-reus.webp` (846×748, 투명) | 마르코 로이스 | `marco-reus` (data/players/bundesliga.ts) | 지금 facepack 없음 → 새로 |
| `players/lewandowski.webp` (613×468, 투명) | 로베르트 레반도프스키 | `lewandowski` (data/players/stars.ts) | 지금 위키 사진(players/lewandowski.png) **바꿈**. 아래쪽에 원본 워터마크 "AFP BBNews"가 남아 있음 — 얼굴 칸(정사각)은 위쪽만 써서 안 보임, 머리말 전신은 아래 사선 면이 덮는지 확인 |
| `clubs/bvb.png` (250×251, 투명) | 보루시아 도르트문트 | `bundesliga:bvb` | 사용자: 팀 로고도 바꿈 |
| `clubs/bay.png` (320×320, 투명) | 바이에른 뮌헨 | `bundesliga:bay` (`x:bay` 리그 밖 표도 같은 로고) | 사용자: 팀 로고도 바꿈 |

## 넣는 법
- 선수: `public/facepack/players/<id>.webp`(원본 크기 그대로) + 매니페스트 `players.<id> = { file, cutout: true, source: "user" }` → 머리말은 투명 미페(디자인 380px, 아래 맞춤)로 나온다(`faces.ts` heroFaceOf). 작은 얼굴 칸(128 정사각)이 따로 필요하면 같은 그림에서 머리·어깨를 잘라 `players/<id>.png`(기존 규칙: 정사각, 얼굴 아래 맞춤, 짧은 쪽 투명).
- 구단: `public/facepack/clubs/<파일>.png` + 매니페스트 `clubs.<팀 id>`. 지금 facepack clubs는 PL 20개만 — 분데스리가 팀 id(`bundesliga:bvb`)를 키로 받게 되어 있는지 확인(파일 이름에는 `:` 대신 `bundesliga-bvb.png`처럼).
- 우선순위 그대로: 페이스온 > 레포 사진 > …. 엔진·밸런스·세이브 버전 그대로.

## 확인 캡처
- 폰·PC: 로이스·레반도프스키로 시작한 홈 머리말(투명 미페), 선수 화면 compact, 도르트문트·바이에른 순위표/경기 준비 엠블럼. 가로 넘침 0.
