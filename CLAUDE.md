# 작업 규칙

- 사용자에게 하는 보고와 답변은 모두 한국어로 한다.
- 패치할 때마다 배포까지 한다: 작업 브랜치에 커밋·푸시한 뒤 main 에도 푸시한다. main 에 푸시하면 GitHub Actions(`.github/workflows/pages.yml`)가 타입체크·테스트·빌드 후 https://atho3398.github.io/football/ 로 배포한다.
- 푸시 전에 `npm run typecheck`, `npm test` 를 통과시킨다. 밸런스 수치를 바꿨으면 `npm run balance` 결과도 보고한다.

# 프로젝트 안내

- 기획서: `docs/game-design.md` (부록 A 설정 분리 원칙, 부록 B 1단계 명세, 부록 C 1단계 결과, 부록 D 2단계 명세)
- 밸런스 수치는 모두 `src/config/balance.ts` 에 둔다. 수치를 바꾸면 `BALANCE_VERSION` 을 올린다. 세이브 구조를 바꾸면 `src/game.ts` 의 `SAVE_FORMAT_VERSION` 을 올린다.
