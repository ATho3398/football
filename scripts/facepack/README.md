# 페이스팩 수집 스크립트

실제 선수(A등급·레전드·미래 스타 + 리그 데이터 실명 선수·GK)의 사진과 등록된 모든 리그 구단 로고를 위키백과에서 받아
256×256 정사각형 PNG 로 줄여(C.77u 사용자 승인, 옛 파일은 128) `public/facepack/` 에 저장한다. 로고는 자르지 않고 짧은 쪽을 투명으로 채워 가운데 맞춤,
선수 사진은 배경을 지우고(`cutout.py`, rembg) 얼굴·상반신 중심으로 자른다(C.77u).

## 실행

```sh
npm install            # node_modules 가 없을 때
npm run facepack                       # 선수+구단, 이미 있는 파일은 건너뜀
npm run facepack -- --only players     # 선수만 (clubs: 구단만)
npm run facepack -- --force            # 있는 파일도 다시 받기 (옛 128px 를 256px·큰 누끼로 바꿀 때)
npm run facepack -- --league laliga,seriea   # 그 리그만 (pl = PL 구단 + A등급·레전드·미래 스타)
npm run facepack -- --cutout           # 배경이 남은 선수 사진만 배경 제거 (네트워크 없음)
npm run facepack -- --license          # 라이선스 메타데이터가 빈 항목 채우기
```

배경 제거 준비(한 번): `python3 -m venv .venv && .venv/bin/pip install "rembg[cpu]"` 뒤 `FACEPACK_PYTHON=.venv/bin/python` 을 붙여 실행.
모델은 `FACEPACK_CUTOUT_MODEL`(기본 `isnet-general-use`, `~/.u2net/` 에 없으면 rembg 가 github 에서 받는다). rembg 가 없으면 선수 사진은 배경 그대로 두고 경고한다.
네트워크: en.wikipedia.org, upload.wikimedia.org(이미지) 접속이 필요하다.

- 필요: Node 18+(내장 fetch), ImageMagick `convert`/`identify`(WebP 지원).
- 원본은 저장소 밖 임시 폴더에 둔다. 위치는 `FACEPACK_RAW_DIR` 로 바꿀 수 있다(기본 OS 임시 폴더/facepack-raw).
- 위키백과 REST 요약 API(`/api/rest_v1/page/summary/<제목>`)만 쓴다. 요청 간격 1초 이상, 429/5xx 는 2·4·8·16초 물러나 재시도.
- 시작할 때 연결을 확인하고, 실패하면 출력물을 건드리지 않고 0 이 아닌 코드로 끝난다.

## 출력

- `public/facepack/players/<선수 id>.png`, `public/facepack/clubs/<팀 id>.png` (PL·A등급·레전드 — 앱 설치 때 미리 캐시)
- 리그 데이터: `public/facepack/clubs/<리그>/<코드>.png`(팀 id `리그:코드`), `public/facepack/players/<리그>/<선수 id>.png` — 미리 캐시하지 않고 처음 볼 때 캐시(지연 로딩, `src/pwa/swBuild.ts` `precached`)
- `public/facepack/manifest.json`: 찾은 항목만, 파일 경로·이미지 출처·문서 주소·문서 제목, `league`, `nobg`(배경 지움), `license`·`artist`·`filePage`(위키미디어 파일 메타데이터). 설정 › 저장과 안내 › 사진·로고 출처 목록이 이것을 보여 준다
- `scripts/facepack/report.md`: 항목별 상태(찾음/못 찾음/의심)와 사유, 요약

## 문서 고르기

- 선수: 덮어쓰기 표(`PLAYER_OVERRIDES`) → `<이름>` → `<이름> (footballer)` → `<이름> (footballer, born <연도>)` 순.
  동음이의 문서는 건너뛰고, 설명/요약에 football·soccer 가 있어야 받는다. 출생연도가 안 보이거나 대체 후보로 찾으면 "의심".
- 구단: 덮어쓰기 표(`CLUB_OVERRIDES`, 리그 데이터 구단은 `overrides.ts`) → `<이름> F.C.` → `<이름>` → `<이름> FC` → `<이름> A.F.C.` 순, football/soccer/club 언급이 있어야 받는다.
- 잘못 잡힌 문서는 덮어쓰기 표에 정확한 제목을 넣고 해당 파일을 지운 뒤 다시 돌린다.

이미지 저작권은 각 위키미디어 파일 문서(manifest 의 `source`)를 따른다. 구단 로고는 대부분 비자유 저작물이므로 개인 용도로만 쓴다.
- `--reconvert`: 받아 둔 원본(FACEPACK_RAW_DIR)에서 이미지만 다시 만든다 (네트워크 없음, 선수는 배경 제거까지)
