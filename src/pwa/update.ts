// 새 버전 알림·한 번에 업데이트 (C.80x, 사용자 2026-11-04 "새 앱 나오면 무조건 최신 버전 나왔다고 띄우고 버튼만 누르면 업데이트").
// 감지 두 갈래:
//  1) 서비스 워커: updatefound → installed(대기) / 이미 대기 중(reg.waiting). 확인 = 앱 켤 때·화면으로 돌아올 때·30분마다 reg.update()
//  2) version.json: 빌드 때 만든 배포 버전(커밋)을 받아 지금 빌드 커밋과 비교 — 서비스 워커가 없는 환경(일반 탭·개발 서버 밖 미리보기)도 감지
// 업데이트 = 세이브 확정 저장 → 대기 워커에 SKIP_WAITING → controllerchange 때 한 번만 새로고침.
// 대기 워커가 없으면(서비스 워커 없음·아직 설치 전) 캐시를 비운 새로고침(?v=커밋). 새로고침 뒤 "업데이트됨" 토스트 한 번.
// DOM·네트워크는 모두 deps 로 받아 단위 테스트에서 가짜로 바꾼다.

/** 배포된 version.json (vite.config.ts 가 빌드 때 만든다) */
export interface RemoteVersion {
  patch: string;
  stage: string;
  engine: number;
  balance: number;
  save: number;
  commit: string;
  date: string;
}

import { VERSION_FILE } from './cachePrefix';
export { VERSION_FILE };
/** 30분마다 확인 */
export const CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** 새로고침 전에 남기는 "어느 커밋에서 업데이트했나" (새로고침 뒤 토스트용) */
export const UPDATED_FROM_KEY = 'po-updated-from';
/** [업데이트]를 눌렀는데 대기 워커가 없을 때, reg.update() 로 설치를 기다리는 최대 시간 */
export const INSTALL_WAIT_MS = 15_000;

export interface SWLike {
  state?: string;
  postMessage(msg: unknown): void;
  addEventListener(type: 'statechange', fn: () => void): void;
}
export interface RegLike {
  waiting: SWLike | null;
  installing: SWLike | null;
  update(): Promise<unknown>;
  unregister?(): Promise<boolean>;
  addEventListener(type: 'updatefound', fn: () => void): void;
}
export interface SWContainerLike {
  controller: unknown;
  register(url: string): Promise<RegLike>;
  addEventListener(type: 'controllerchange', fn: () => void): void;
}

export interface UpdaterDeps {
  current: { commit: string; patch: string; stage: string };
  /** 서비스 워커 (없으면 null: version.json 만) */
  sw: SWContainerLike | null;
  /** version.json 받기 (캐시 안 씀). 실패하면 null */
  fetchVersion(): Promise<RemoteVersion | null>;
  /** 새로고침. bust 가 있으면 주소에 ?v=bust 를 붙여 브라우저 캐시를 피한다 */
  reload(bust: string | null): void;
  /** 이 사이트의 서비스 워커 캐시('po-')를 지운다 (대기 워커 없이 서비스 워커가 페이지를 쥐고 있을 때) */
  clearCaches?(): Promise<void>;
  storage: { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void };
  /** 상태가 바뀌면 화면을 다시 그린다 */
  onChange(): void;
  /** 앱으로 돌아올 때 / 주기 확인 연결 (테스트는 생략) */
  onVisible?(fn: () => void): void;
  every?(ms: number, fn: () => void): void;
  /** 대기 시간 (테스트는 바로) */
  sleep?(ms: number): Promise<void>;
}

export interface UpdateState {
  /** 새 버전이 있다 (배너를 띄운다) */
  available: boolean;
  /** 새 버전 정보 (version.json 을 못 받았으면 null → "새 버전") */
  remote: RemoteVersion | null;
  /** [나중에]: 다음 확인 때까지 배너를 숨긴다 */
  later: boolean;
  /** 업데이트 진행 중 (단추 잠금) */
  applying: boolean;
  /** 대기 중인 서비스 워커가 있다 */
  waiting: boolean;
}

export interface Updater {
  state(): UpdateState;
  /** 앱 켤 때 한 번: 서비스 워커 등록·주기 확인 연결 */
  start(): Promise<void>;
  /** 지금 확인 (설정 [업데이트 확인]·주기·돌아올 때). 새 버전이면 true */
  check(): Promise<boolean>;
  /** [나중에] */
  later(): void;
  /** [업데이트]: save() 로 세이브를 확정한 뒤 넘어간다 */
  apply(save: () => Promise<void>): Promise<void>;
  /** 새로고침 뒤 첫 부팅: 업데이트를 마쳤으면 "업데이트됨" 문구, 아니면 null (한 번만) */
  takeUpdatedNotice(): { ok: boolean; text: string } | null;
}

/** 배너·토스트에 쓰는 버전 이름: "C.80x · 53단계" (모르면 "새 버전") */
export function versionName(v: { patch: string; stage: string } | null): string {
  return v ? `${v.patch} · ${v.stage}` : '새 버전';
}

/** version.json 이 지금 빌드와 다른 배포인가 (커밋 비교. 개발 빌드는 비교하지 않는다) */
export function isNewer(remote: RemoteVersion | null, currentCommit: string): boolean {
  return !!remote && currentCommit !== 'dev' && typeof remote.commit === 'string' && remote.commit !== '' && remote.commit !== 'dev' && remote.commit !== currentCommit;
}

/** version.json 모양 검사 (깨진 파일은 무시) */
export function parseRemote(x: unknown): RemoteVersion | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.commit !== 'string' || typeof o.patch !== 'string' || typeof o.stage !== 'string') return null;
  return {
    patch: o.patch, stage: o.stage, commit: o.commit,
    engine: Number(o.engine) || 0, balance: Number(o.balance) || 0, save: Number(o.save) || 0,
    date: typeof o.date === 'string' ? o.date : '',
  };
}

export function createUpdater(d: UpdaterDeps): Updater {
  const st: UpdateState = { available: false, remote: null, later: false, applying: false, waiting: false };
  let reg: RegLike | null = null;
  let waiting: SWLike | null = null;
  let reloading = false;
  let checking: Promise<boolean> | null = null;
  const sleep = d.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  const reloadOnce = (bust: string | null): void => {
    if (reloading) return;
    reloading = true;
    d.reload(bust);
  };

  /** 새 버전 발견: 배너를 (다시) 띄운다 — [나중에]는 다음 확인 때 풀린다 */
  const found = (): void => {
    st.available = true;
    st.later = false;
    d.onChange();
  };

  const setWaiting = (w: SWLike | null): void => {
    // 처음 설치(이전 컨트롤러 없음)는 새 버전이 아니다
    if (!w || !d.sw?.controller) return;
    waiting = w;
    st.waiting = true;
    // 이름은 version.json 에서 (서비스 워커 확인과 따로)
    if (!st.remote) void d.fetchVersion().then((r) => { if (r && isNewer(r, d.current.commit)) { st.remote = r; d.onChange(); } }, () => undefined);
    found();
  };

  const watchReg = (r: RegLike): void => {
    reg = r;
    setWaiting(r.waiting);
    r.addEventListener('updatefound', () => {
      const w = r.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed') setWaiting(w);
      });
    });
  };

  const check = (): Promise<boolean> => {
    if (checking) return checking;
    checking = (async () => {
      try {
        if (reg) await reg.update().catch(() => undefined);
        const r = await d.fetchVersion().catch(() => null);
        if (r && isNewer(r, d.current.commit)) {
          st.remote = r;
          found();
        } else if (waiting) found();
        return st.available;
      } finally {
        checking = null;
      }
    })();
    return checking;
  };

  return {
    state: () => ({ ...st }),
    async start() {
      if (d.sw) {
        d.sw.addEventListener('controllerchange', () => {
          // 이 탭에서 [업데이트]를 눌렀을 때만 새로고침 (다른 탭이 넘긴 것으로 경기 중 화면이 날아가지 않게)
          if (st.applying) reloadOnce(null);
        });
        try {
          watchReg(await d.sw.register('./sw.js'));
        } catch {
          // 등록 실패 (사설 모드 등): version.json 으로만
        }
      }
      d.onVisible?.(() => void check());
      d.every?.(CHECK_INTERVAL_MS, () => void check());
      await check();
    },
    check,
    later() {
      st.later = true;
      d.onChange();
    },
    async apply(save) {
      if (st.applying) return;
      st.applying = true;
      d.onChange();
      // 1) 세이브 확정 (실패해도 업데이트는 막지 않는다 — 직전 자동 저장이 남아 있다)
      try {
        await save();
      } catch {
        /* 무시 */
      }
      d.storage.set(UPDATED_FROM_KEY, d.current.commit);
      // 2) 서비스 워커는 있는데 대기 워커가 아직 없으면 설치를 잠깐 기다린다
      if (!waiting && reg && d.sw?.controller) {
        await reg.update().catch(() => undefined);
        for (let t = 0; t < INSTALL_WAIT_MS && !waiting; t += 250) {
          if (reg.waiting) setWaiting(reg.waiting);
          else await sleep(250);
        }
      }
      if (waiting) {
        // 3) 대기 워커로 넘긴다 → controllerchange 에서 한 번 새로고침
        const w = waiting;
        const fallback = (async () => {
          await sleep(INSTALL_WAIT_MS);
          // controllerchange 가 안 오면(워커가 이미 죽음 등) 캐시를 비우고 새로고침
          if (!reloading) {
            await d.clearCaches?.().catch(() => undefined);
            reloadOnce(st.remote?.commit ?? String(Date.now()));
          }
        })();
        w.postMessage('SKIP_WAITING');
        void fallback;
        return;
      }
      // 4) 서비스 워커 없음(또는 설치 실패): 서비스 워커 캐시를 비우고 주소를 바꿔 새로고침
      if (d.sw?.controller) {
        await d.clearCaches?.().catch(() => undefined);
        await reg?.unregister?.().catch(() => false);
      }
      reloadOnce(st.remote?.commit ?? String(Date.now()));
    },
    takeUpdatedNotice() {
      const from = d.storage.get(UPDATED_FROM_KEY);
      if (from === null) return null;
      d.storage.remove(UPDATED_FROM_KEY);
      const name = versionName(d.current);
      if (from !== d.current.commit || d.current.commit === 'dev') return { ok: true, text: `업데이트됨 · ${name}` };
      return { ok: false, text: '업데이트를 아직 못 받았어요 · 잠시 뒤 다시 눌러 주세요' };
    },
  };
}
