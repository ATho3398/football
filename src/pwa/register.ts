/// <reference types="vite/client" />
// 오프라인 PWA (C.77r) + 새 버전 알림·한 번에 업데이트 (C.80x): 실제 브라우저 연결부. 흐름은 update.ts
import { BUILD_COMMIT, PATCH_LABEL, STAGE_LABEL } from '../version';
import { CACHE_PREFIX } from './cachePrefix';
import { createUpdater, parseRemote, VERSION_FILE, type SWContainerLike, type Updater, type UpdateState } from './update';

let updater: Updater | null = null;

/** 안드로이드 앱(APK, C.77v) 안에서 도는가: Capacitor 가 배포 사이트 페이지에도 window.Capacitor 를 넣는다 */
export function isNativeApp(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

const NO_UPDATE: UpdateState = { available: false, remote: null, later: false, applying: false, waiting: false };

/** 새 버전 상태 (배너·설정 화면) */
export function updateState(): UpdateState {
  return updater?.state() ?? NO_UPDATE;
}

function safeStorage(): { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void } {
  return {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 못 함 */ } },
    remove: (k) => { try { localStorage.removeItem(k); } catch { /* 무시 */ } },
  };
}

/**
 * 앱 켤 때 한 번. 배포 빌드에서만 서비스 워커를 쓰고, version.json 확인은 배포 빌드(커밋이 있는 빌드)에서 늘 한다.
 * 안드로이드 앱(C.77v)도 배포 사이트를 열므로 웹과 똑같다
 */
export function registerServiceWorker(onChange: () => void): void {
  if (!import.meta.env.PROD || BUILD_COMMIT === 'dev') return;
  const nav = globalThis.navigator?.serviceWorker as unknown as SWContainerLike | undefined;
  updater = createUpdater({
    current: { commit: BUILD_COMMIT, patch: PATCH_LABEL, stage: STAGE_LABEL },
    sw: nav ?? null,
    async fetchVersion() {
      try {
        const r = await fetch(`./${VERSION_FILE}?t=${Date.now()}`, { cache: 'no-store' });
        return r.ok ? parseRemote(await r.json()) : null;
      } catch {
        return null;
      }
    },
    reload(bust) {
      if (!bust) {
        location.reload();
        return;
      }
      const u = new URL(location.href);
      u.searchParams.set('v', bust);
      // 주소 그대로(?v 없이) 다시 열 때도 새 판이 오게, 브라우저 HTTP 캐시의 첫 화면을 먼저 새로 받아 둔다
      const base = new URL('./', location.href).toString();
      void Promise.all([fetch(base, { cache: 'reload' }), fetch(`${base}index.html`, { cache: 'reload' })])
        .catch(() => undefined)
        .finally(() => location.replace(u.toString()));
    },
    async clearCaches() {
      if (typeof caches === 'undefined') return;
      for (const k of await caches.keys()) if (k.startsWith(CACHE_PREFIX)) await caches.delete(k);
    },
    storage: safeStorage(),
    onChange,
    onVisible(fn) {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') fn();
      });
    },
    every(ms, fn) {
      setInterval(fn, ms);
    },
  });
  void updater.start();
}

/** 새로고침 뒤 첫 부팅의 "업데이트됨" 문구 (한 번만). 업데이트를 누르지 않았으면 null */
export function takeUpdatedNotice(): { ok: boolean; text: string } | null {
  if (updater) return updater.takeUpdatedNotice();
  return null;
}

/** 설정 [업데이트 확인]: 새 버전이 있으면 true (배포 빌드가 아니면 false) */
export function checkForUpdate(): Promise<boolean> {
  return updater ? updater.check() : Promise.resolve(false);
}

export function laterUpdate(): void {
  updater?.later();
}

/** [업데이트]: save 로 세이브를 확정한 뒤 새 버전으로 */
export function applyUpdate(save: () => Promise<void>): Promise<void> {
  return updater ? updater.apply(save) : Promise.resolve();
}

/** iPhone·iPad (사파리 계열): 오래 안 쓰면 저장소를 지울 수 있어 백업 안내를 보인다 */
export function isIOS(): boolean {
  const n = globalThis.navigator;
  if (!n) return false;
  return /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
}
