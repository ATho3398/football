/// <reference types="vite/client" />
// 오프라인 PWA (C.77r): 서비스 워커 등록과 새 버전 알림. 새 버전은 자동으로 바꾸지 않는다 —
// 설치(대기)만 되면 onUpdate 로 알리고, 사용자가 [다시 열기]를 누를 때 applyUpdate 로 넘어간 뒤 새로고침한다
let waiting: ServiceWorker | null = null;
let reloading = false;

/** 새 버전이 설치되어 기다리는 중인가 */
export function updateReady(): boolean {
  return !!waiting;
}

export function registerServiceWorker(onUpdate: () => void): void {
  const sw = globalThis.navigator?.serviceWorker;
  if (!sw || !import.meta.env.PROD) return;
  const found = (w: ServiceWorker | null): void => {
    // 처음 설치(이전 컨트롤러 없음)는 새 버전이 아니다
    if (!w || !sw.controller) return;
    waiting = w;
    onUpdate();
  };
  sw.addEventListener('controllerchange', () => {
    if (!reloading) return;
    location.reload();
  });
  void sw.register('./sw.js').then((reg) => {
    found(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed') found(w);
      });
    });
    // 앱으로 돌아올 때마다 새 버전 확인 (오프라인이면 조용히 실패)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update().catch(() => undefined);
    });
  }, () => undefined);
}

/** 기다리는 새 버전으로 넘어가 새로고침 */
export function applyUpdate(): void {
  if (!waiting) return;
  reloading = true;
  waiting.postMessage('skip-waiting');
}

/** iPhone·iPad (사파리 계열): 오래 안 쓰면 저장소를 지울 수 있어 백업 안내를 보인다 */
export function isIOS(): boolean {
  const n = globalThis.navigator;
  if (!n) return false;
  return /iPad|iPhone|iPod/.test(n.userAgent) || (n.platform === 'MacIntel' && n.maxTouchPoints > 1);
}
