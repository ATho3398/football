import { defineConfig } from 'vite';

// 상대 경로로 빌드해 GitHub Pages(/football/) 등 어느 경로에 올려도 동작하게 한다
export default defineConfig({
  base: './',
});
