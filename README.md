# football

선수 시점 축구 커리어 게임 (1단계: 최소 플레이 루프). 기획은 `docs/game-design.md`.

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # dist/ 로 빌드, npm run preview 로 확인
npm run typecheck
npm test
npm run balance    # 잠재력 티어별 17~30세 OVR 추이 (밸런스 점검)
```

밸런스 수치는 모두 `src/config/balance.ts` 한 곳에 있다.
