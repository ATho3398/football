# 페이스팩 수집 스크립트

실제 선수 34명(`A_GRADE_PLAYERS`)의 사진과 2018-19 프리미어리그 20개 구단 로고를 위키백과에서 받아
128×128 정사각형 PNG(자르지 않고 짧은 쪽을 투명으로 채움, 얼굴 아래쪽·로고 가운데 맞춤)로 줄여 `public/facepack/` 에 저장한다.

## 실행

```sh
npm install            # node_modules 가 없을 때
npm run facepack                       # 선수+구단, 이미 있는 파일은 건너뜀
npm run facepack -- --only players     # 선수만 (clubs: 구단만)
npm run facepack -- --force            # 있는 파일도 다시 받기
```

- 필요: Node 18+(내장 fetch), ImageMagick `convert`/`identify`(WebP 지원).
- 원본은 저장소 밖 임시 폴더에 둔다. 위치는 `FACEPACK_RAW_DIR` 로 바꿀 수 있다(기본 OS 임시 폴더/facepack-raw).
- 위키백과 REST 요약 API(`/api/rest_v1/page/summary/<제목>`)만 쓴다. 요청 간격 1초 이상, 429/5xx 는 2·4·8·16초 물러나 재시도.
- 시작할 때 연결을 확인하고, 실패하면 출력물을 건드리지 않고 0 이 아닌 코드로 끝난다.

## 출력

- `public/facepack/players/<선수 id>.png`, `public/facepack/clubs/<팀 id>.png`
- `public/facepack/manifest.json`: 찾은 항목만, 파일 경로·이미지 출처·문서 주소·문서 제목
- `scripts/facepack/report.md`: 항목별 상태(찾음/못 찾음/의심)와 사유, 요약

## 문서 고르기

- 선수: 덮어쓰기 표(`PLAYER_OVERRIDES`) → `<이름>` → `<이름> (footballer)` → `<이름> (footballer, born <연도>)` 순.
  동음이의 문서는 건너뛰고, 설명/요약에 football·soccer 가 있어야 받는다. 출생연도가 안 보이거나 대체 후보로 찾으면 "의심".
- 구단: 덮어쓰기 표(`CLUB_OVERRIDES`) → `<이름> F.C.` → `<이름>` → `<이름> A.F.C.` 순, "football club" 언급이 있어야 받는다.
- 잘못 잡힌 문서는 덮어쓰기 표에 정확한 제목을 넣고 해당 파일을 지운 뒤 다시 돌린다.

이미지 저작권은 각 위키미디어 파일 문서(manifest 의 `source`)를 따른다. 구단 로고는 대부분 비자유 저작물이므로 개인 용도로만 쓴다.
- `--reconvert`: 받아 둔 원본(FACEPACK_RAW_DIR)에서 이미지만 다시 만든다 (네트워크 없음)
