// 오프라인 PWA (C.77r): 빌드 뒤 dist 파일 목록으로 서비스 워커(sw.js)를 만든다. 외부 라이브러리 없음.
// 캐시 이름 = 'po-' + 버전(빌드 커밋 + 파일 내용 해시). 새 버전은 설치만 해 두고(대기), 화면이 "다시 열기"를 누르면 넘어간다.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const SW_FILE = 'sw.js';
export const CACHE_PREFIX = 'po-';

/** dist 안 파일 (상대 경로, '/' 구분, 정렬). sw.js 자신과 소스맵은 뺀다 */
export function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else out.push(relative(dir, p).split(sep).join('/'));
    }
  };
  walk(dir);
  return out.filter((f) => f !== SW_FILE && !f.endsWith('.map')).sort();
}

/**
 * 미리 캐시할 파일인지 (C.77u 리그별 지연 로딩): 리그 데이터 페이스팩(facepack/clubs/<리그>/, facepack/players/<리그>/)은
 * 미리 받지 않고, 그 리그 화면이 처음 요청할 때 fetch 가 캐시에 넣는다. PL·A등급·레전드(폴더 바로 아래)는 미리 캐시
 */
export function precached(file: string): boolean {
  return !/^facepack\/(clubs|players)\/[^/]+\//.test(file);
}

/** 버전: 커밋 + 파일 이름·내용 해시 앞 8자리 (같은 커밋이라도 내용이 바뀌면 새 캐시) */
export function buildVersion(dir: string, files: string[], commit: string): string {
  const h = createHash('sha1');
  for (const f of files) h.update(f).update('\0').update(readFileSync(join(dir, f)));
  return `${commit}-${h.digest('hex').slice(0, 8)}`;
}

/**
 * 서비스 워커 소스. 경로는 모두 sw.js 위치(= base './') 기준 상대 경로라 GitHub Pages 하위 경로(/football/)에서도 동작한다.
 * - install: 전부 미리 캐시, 리그 페이스팩만 빼고(precached, C.77u) (skipWaiting 안 함 — 화면이 고른다)
 * - activate: 'po-' 로 시작하는 옛 캐시 지우기
 * - fetch: 같은 출처 GET 은 캐시 먼저(쿼리 무시), 없으면 네트워크 → 캐시에 넣기. 페이지 이동은 index.html
 * - message 'skip-waiting': 대기 중인 새 버전으로 넘어간다
 */
export function swSource(files: string[], version: string): string {
  const list = ['./', ...files.filter(precached).map((f) => `./${f}`)];
  return `// 자동 생성 (src/pwa/swBuild.ts, C.77r) — 고치지 말 것
const VERSION = ${JSON.stringify(version)};
const CACHE = ${JSON.stringify(CACHE_PREFIX)} + VERSION;
const FILES = ${JSON.stringify(list)};

self.addEventListener('install', (ev) => {
  ev.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 한 번에 다 받으면 큰 묶음 하나가 실패해도 전부 실패하므로 나눠 받는다 (실패하면 설치 실패 → 다음에 다시)
    for (let i = 0; i < FILES.length; i += 24) {
      await c.addAll(FILES.slice(i, i + 24).map((u) => new Request(u, { cache: 'reload' })));
    }
  })());
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith(${JSON.stringify(CACHE_PREFIX)}) && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  if (ev.data === 'skip-waiting') self.skipWaiting();
  else if (ev.data === 'version' && ev.source) ev.source.postMessage({ version: VERSION });
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  ev.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (req.mode === 'navigate') {
      const page = (await c.match(req, { ignoreSearch: true })) || (await c.match('./index.html')) || (await c.match('./'));
      if (page) return page;
    }
    const hit = await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') c.put(req, res.clone());
      return res;
    } catch (e) {
      if (req.mode === 'navigate') {
        const page = await c.match('./index.html');
        if (page) return page;
      }
      throw e;
    }
  })());
});
`;
}
