import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildVersion, listFiles, SW_FILE, swSource } from './src/pwa/swBuild';

// 버전 표시 (21.5.1): 빌드 시점의 git 짧은 커밋 해시와 빌드 날짜(UTC). git 이 없으면 dev
function gitCommit(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || 'dev';
  } catch {
    return 'dev';
  }
}

// 오프라인 PWA (C.77r): 빌드가 끝나면 dist 전체 목록으로 sw.js 를 만든다
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'po-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    closeBundle() {
      const files = listFiles(outDir);
      writeFileSync(resolve(outDir, SW_FILE), swSource(files, buildVersion(outDir, files, gitCommit())));
    },
  };
}

// 상대 경로로 빌드해 GitHub Pages(/football/) 등 어느 경로에 올려도 동작하게 한다
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(gitCommit()),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString().slice(0, 10)),
  },
  // 경기 엔진 테스트는 한 경기에 약 0.5초가 걸린다
  test: { testTimeout: 60_000 },
} as Parameters<typeof defineConfig>[0]);
