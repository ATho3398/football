import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildVersion, listFiles, SW_FILE, swSource, VERSION_FILE } from './src/pwa/swBuild';
import { PATCH_LABEL, STAGE_LABEL } from './src/version';
import { ENGINE_VERSION } from './src/engine/config';
import { BALANCE_VERSION } from './src/config/balance';
import { SAVE_FORMAT_VERSION } from './src/game';

// 버전 표시 (21.5.1): 빌드 시점의 git 짧은 커밋 해시와 빌드 날짜(UTC). git 이 없으면 dev
// PO_BUILD_COMMIT (C.80x): 업데이트 시나리오 시험에서 같은 커밋으로 옛·새 두 빌드를 만들 때 덮어쓴다
function gitCommit(): string {
  if (process.env.PO_BUILD_COMMIT) return process.env.PO_BUILD_COMMIT;
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
      // 새 배포 확인 파일 (C.80x): 앱이 지금 빌드 커밋과 비교한다 (서비스 워커는 캐시하지 않는다)
      const ver = {
        patch: PATCH_LABEL, stage: STAGE_LABEL, engine: ENGINE_VERSION, balance: BALANCE_VERSION, save: SAVE_FORMAT_VERSION,
        commit: gitCommit(), date: BUILD_DATE,
      };
      writeFileSync(resolve(outDir, VERSION_FILE), `${JSON.stringify(ver)}\n`);
      const files = listFiles(outDir);
      writeFileSync(resolve(outDir, SW_FILE), swSource(files, buildVersion(outDir, files, gitCommit())));
    },
  };
}

const BUILD_DATE = new Date().toISOString().slice(0, 10);

// 상대 경로로 빌드해 GitHub Pages(/football/) 등 어느 경로에 올려도 동작하게 한다
export default defineConfig({
  base: './',
  plugins: [serviceWorker()],
  define: {
    __BUILD_COMMIT__: JSON.stringify(gitCommit()),
    __BUILD_DATE__: JSON.stringify(BUILD_DATE),
  },
  // 경기 엔진 테스트는 한 경기에 약 0.5초가 걸린다
  test: { testTimeout: 60_000 },
} as Parameters<typeof defineConfig>[0]);
