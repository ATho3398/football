// C.80x 새 버전 알림·한 번에 업데이트: 가짜 서비스 워커 registration 으로 흐름 확인
import { describe, expect, it } from 'vitest';
import { createUpdater, isNewer, parseRemote, UPDATED_FROM_KEY, versionName, type RegLike, type RemoteVersion, type SWLike, type UpdaterDeps } from '../src/pwa/update';
import { swSource } from '../src/pwa/swBuild';

type Fn = () => void;
class FakeSW implements SWLike {
  state = 'installing';
  msgs: unknown[] = [];
  private fns: Fn[] = [];
  postMessage(m: unknown): void { this.msgs.push(m); }
  addEventListener(_t: 'statechange', fn: Fn): void { this.fns.push(fn); }
  set(s: string): void { this.state = s; this.fns.forEach((f) => f()); }
}
class FakeReg implements RegLike {
  waiting: SWLike | null = null;
  installing: SWLike | null = null;
  updates = 0;
  unregistered = false;
  private fns: Fn[] = [];
  onUpdate: (() => void) | null = null;
  update(): Promise<unknown> { this.updates++; this.onUpdate?.(); return Promise.resolve(); }
  unregister(): Promise<boolean> { this.unregistered = true; return Promise.resolve(true); }
  addEventListener(_t: 'updatefound', fn: Fn): void { this.fns.push(fn); }
  /** 새 워커 설치 시작 → 설치 끝 */
  install(): FakeSW {
    const w = new FakeSW();
    this.installing = w;
    this.fns.forEach((f) => f());
    w.set('installed');
    this.installing = null;
    this.waiting = w;
    return w;
  }
}
class FakeContainer {
  controller: unknown = {};
  private fns: Fn[] = [];
  constructor(public reg: FakeReg) {}
  register(): Promise<RegLike> { return Promise.resolve(this.reg); }
  addEventListener(_t: 'controllerchange', fn: Fn): void { this.fns.push(fn); }
  fire(): void { this.fns.forEach((f) => f()); }
}

const NEW: RemoteVersion = { patch: 'C.80z', stage: '54단계', engine: 80, balance: 1, save: 60, commit: 'bbbbbbb', date: '2026-11-04' };
const OLD = { commit: 'aaaaaaa', patch: 'C.80x', stage: '53단계' };

function setup(o: { sw?: FakeContainer | null; remote?: RemoteVersion | null } = {}) {
  const mem = new Map<string, string>();
  const log = { reloads: [] as (string | null)[], changes: 0, cleared: 0, saved: 0 };
  let remote = o.remote === undefined ? null : o.remote;
  const d: UpdaterDeps = {
    current: OLD,
    sw: o.sw === undefined ? null : o.sw,
    fetchVersion: () => Promise.resolve(remote),
    reload: (b) => log.reloads.push(b),
    clearCaches: () => { log.cleared++; return Promise.resolve(); },
    storage: { get: (k) => mem.get(k) ?? null, set: (k, v) => void mem.set(k, v), remove: (k) => void mem.delete(k) },
    onChange: () => { log.changes++; },
    sleep: () => new Promise<void>(() => undefined), // 기다리는 대체 경로는 시험에서 멈춰 둔다
  };
  return { d, mem, log, setRemote: (r: RemoteVersion | null) => { remote = r; } };
}

describe('C.80x 새 버전 판정', () => {
  it('커밋이 다르면 새 버전, 같거나 개발 빌드면 아님', () => {
    expect(isNewer(NEW, 'aaaaaaa')).toBe(true);
    expect(isNewer(NEW, 'bbbbbbb')).toBe(false);
    expect(isNewer(NEW, 'dev')).toBe(false);
    expect(isNewer(null, 'aaaaaaa')).toBe(false);
    expect(parseRemote({ x: 1 })).toBeNull();
    expect(parseRemote(NEW)).toEqual(NEW);
    expect(versionName(NEW)).toBe('C.80z · 54단계');
    expect(versionName(null)).toBe('새 버전');
  });
});

describe('C.80x 서비스 워커 흐름 (가짜 registration)', () => {
  it('켤 때 이미 대기 중인 워커 → 배너, [업데이트] = 저장 → SKIP_WAITING → controllerchange 때 한 번만 새로고침', async () => {
    const reg = new FakeReg();
    const sw = new FakeContainer(reg);
    const t = setup({ sw, remote: NEW });
    reg.waiting = new FakeSW();
    const u = createUpdater(t.d);
    await u.start();
    expect(u.state().available).toBe(true);
    expect(u.state().remote?.patch).toBe('C.80z');
    const order: string[] = [];
    await u.apply(async () => { order.push('save'); });
    const w = reg.waiting as FakeSW;
    expect(order).toEqual(['save']);
    expect(w.msgs).toEqual(['SKIP_WAITING']);
    expect(t.mem.get(UPDATED_FROM_KEY)).toBe('aaaaaaa');
    expect(t.log.reloads).toEqual([]);
    sw.fire();
    sw.fire(); // 두 번 와도 새로고침은 한 번
    expect(t.log.reloads).toEqual([null]);
  });

  it('updatefound → installed 를 감지한다. 처음 설치(컨트롤러 없음)는 새 버전이 아니다', async () => {
    const reg = new FakeReg();
    const sw = new FakeContainer(reg);
    sw.controller = null;
    const t = setup({ sw });
    const u = createUpdater(t.d);
    await u.start();
    reg.install();
    expect(u.state().available).toBe(false);
    sw.controller = {};
    reg.install();
    expect(u.state().available).toBe(true);
    expect(u.state().waiting).toBe(true);
  });

  it('주기·돌아올 때 확인 = reg.update(). [나중에]는 다음 확인 때 다시 뜬다', async () => {
    const reg = new FakeReg();
    const sw = new FakeContainer(reg);
    const t = setup({ sw });
    let visible: (() => void) | null = null;
    let tick: (() => void) | null = null;
    let every = 0;
    t.d.onVisible = (f) => { visible = f; };
    t.d.every = (ms, f) => { every = ms; tick = f; };
    const u = createUpdater(t.d);
    await u.start();
    expect(every).toBe(30 * 60 * 1000);
    expect(reg.updates).toBe(1); // 켤 때
    reg.onUpdate = () => { if (!reg.waiting) reg.install(); };
    visible!();
    await u.check();
    expect(reg.updates).toBeGreaterThanOrEqual(2);
    expect(u.state().available).toBe(true);
    u.later();
    expect(u.state().later).toBe(true);
    tick!();
    await u.check();
    expect(u.state().later).toBe(false);
  });

  it('다른 탭이 넘긴 controllerchange 로는 이 탭을 새로고침하지 않는다 (경기 중 보호)', async () => {
    const reg = new FakeReg();
    const sw = new FakeContainer(reg);
    const t = setup({ sw });
    reg.waiting = new FakeSW();
    await createUpdater(t.d).start();
    sw.fire();
    expect(t.log.reloads).toEqual([]);
  });

  it('서비스 워커가 페이지를 쥐고 있는데 대기 워커가 없으면 update 로 설치를 기다렸다가 넘긴다', async () => {
    const reg = new FakeReg();
    const sw = new FakeContainer(reg);
    const t = setup({ sw, remote: NEW });
    const u = createUpdater(t.d);
    await u.start();
    expect(u.state().available).toBe(true); // version.json 으로 감지
    expect(u.state().waiting).toBe(false);
    reg.onUpdate = () => reg.install();
    await u.apply(() => Promise.resolve());
    expect((reg.waiting as FakeSW).msgs).toEqual(['SKIP_WAITING']);
  });
});

describe('C.80x 서비스 워커 없음 (version.json)', () => {
  it('새 커밋이면 배너, [업데이트] = 저장 뒤 ?v=새커밋 새로고침. 같은 커밋이면 배너 없음', async () => {
    const t = setup({ remote: { ...NEW, commit: 'aaaaaaa' } });
    const u = createUpdater(t.d);
    await u.start();
    expect(u.state().available).toBe(false);
    t.setRemote(NEW);
    expect(await u.check()).toBe(true);
    let saved = false;
    await u.apply(async () => { saved = true; });
    expect(saved).toBe(true);
    expect(t.log.reloads).toEqual(['bbbbbbb']);
    await u.apply(async () => undefined); // 두 번 눌러도 한 번
    expect(t.log.reloads.length).toBe(1);
  });

  it('새로고침 뒤 첫 부팅: 커밋이 바뀌었으면 "업데이트됨 · 버전" 한 번, 안 바뀌었으면 다시 시도 안내', () => {
    const a = setup();
    a.mem.set(UPDATED_FROM_KEY, 'zzzzzzz');
    const u = createUpdater(a.d);
    expect(u.takeUpdatedNotice()).toEqual({ ok: true, text: '업데이트됨 · C.80x · 53단계' });
    expect(u.takeUpdatedNotice()).toBeNull();
    const b = setup();
    b.mem.set(UPDATED_FROM_KEY, 'aaaaaaa');
    expect(createUpdater(b.d).takeUpdatedNotice()?.ok).toBe(false);
  });
});

describe('C.80x 서비스 워커 소스', () => {
  it('SKIP_WAITING·옛 skip-waiting 둘 다 받고, version.json 은 캐시하지 않는다', () => {
    const src = swSource(['index.html', 'assets/a.js'], 'x-1');
    expect(src).toContain("ev.data === 'SKIP_WAITING'");
    expect(src).toContain("ev.data === 'skip-waiting'");
    expect(src).toContain('endsWith(\'/\' + "version.json")');
    expect(src).not.toContain('./version.json');
  });
});
