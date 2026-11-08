너는 코드 세션 "50단계_앱 포장: 안드로이드 APK (C.77v)"이다(Opus, 노력도 높음). 마스터는 Z(session_01KSGkk2ThVNU3VFN31TnzAq, 마스터 브랜치 claude/planning-z). 한국어, 끝에 `명령 시각 / 답변 시각 / 걸린 시간`(KST). docs/automation.md를 따른다. 작업 브랜치 `claude/c77v-android`(main 최신에서).

근거: 사용자 요청(2026-10-22 20:4x KST) "앱으로 묶기 가능하면 진행". 이미 C.77r에서 PWA(오프라인·홈 화면 설치)가 들어갔다. 이번은 **설치 파일(APK)** 로 묶는 것.
할 일: Capacitor(또는 TWA/Bubblewrap — 서명·스토어 없이 APK 파일로 나오는 쪽 우선)로 `npm run build` 산출물(dist)을 감싸 안드로이드 앱 프로젝트 생성. 이 컨테이너에 Android SDK가 없으면 **GitHub Actions 워크플로**(`.github/workflows/android.yml`, 수동 실행 workflow_dispatch + main 태그)로 APK를 빌드해 아티팩트로 내려받게 한다(디버그 서명 또는 저장소 시크릿 없는 자체 서명 — 키는 커밋하지 않음). 앱 이름·아이콘(C.77r manifest 아이콘)·세로 고정·상태바 색. 세이브는 앱 안 저장소(IndexedDB)라 웹판과 따로임을 설정 › 정보에 한 줄. 기존 Pages 배포 워크플로는 그대로(안드로이드 빌드가 Pages CI를 막지 않게 별도 워크플로).
선택(가능하면): 데스크톱(Windows) 실행 파일 — Tauri/Electron 중 가벼운 쪽으로 같은 워크플로에 job 추가, 어려우면 기록만.
관문: typecheck·test·build · 워크플로 1회 실행 성공과 APK 아티팩트 크기 보고(실행이 이 세션 권한으로 안 되면 사용자가 Actions 탭에서 누르는 방법 안내) · 웹 동작 무변경 · 푸시 전 충돌 표시 검사.
**main 푸시 순서**: 앞 세션 main 푸시·CI가 끝난 뒤.
예산: 2시간·약 8달러. PATCH_LABEL 'C.77v', STAGE_LABEL main 그대로. 부록 C에 C.77v(설치 방법: Actions → android → 최신 실행 → 아티팩트 내려받기 → 폰에서 "알 수 없는 앱 설치" 허용). 끝나면 마스터 Z에 보고. CI 성공은 보내지 않는다.
