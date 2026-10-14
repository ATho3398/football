import { defineConfig } from 'vite';

// 상대 경로로 빌드해 GitHub Pages(/football/) 등 어느 경로에 올려도 동작하게 한다
export default defineConfig({
  base: './',
  // 경기 엔진 테스트는 한 경기에 약 0.5초가 걸린다
  test: { testTimeout: 60_000 },
} as Parameters<typeof defineConfig>[0]);
