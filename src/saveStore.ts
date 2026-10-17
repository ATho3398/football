// 세이브 저장소 (25.4, 부록 C.41): IndexedDB + gzip 압축. 브라우저에 IndexedDB 가 없으면(테스트·node) 메모리에 둔다.
// 키: `slot:<슬롯>` = { meta, data(gzip JSON), enc, size }, `replays:<슬롯>` = gzip JSON (내 최근 5경기 리플레이 프레임)

const DB_NAME = 'football-career';
const STORE = 'saves';

export interface StoreBackend {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

/** IndexedDB 백엔드 (한 번 열어 둔다) */
function idbBackend(idb: IDBFactory): StoreBackend {
  let dbp: Promise<IDBDatabase> | null = null;
  const db = () => (dbp ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = idb.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const run = <T>(mode: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest): Promise<T> => db().then((d) => new Promise<T>((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = f(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result as T);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
  return {
    get: (key) => run('readonly', (s) => s.get(key)),
    put: (key, value) => run<unknown>('readwrite', (s) => s.put(value, key)).then(() => undefined),
    del: (key) => run<unknown>('readwrite', (s) => s.delete(key)).then(() => undefined),
    keys: () => run<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((ks) => ks.map(String)),
  };
}

export function memoryBackend(): StoreBackend {
  const m = new Map<string, unknown>();
  return {
    get: async <T>(key: string) => m.get(key) as T | undefined,
    put: async (key, value) => { m.set(key, value); },
    del: async (key) => { m.delete(key); },
    keys: async () => [...m.keys()],
  };
}

let backend: StoreBackend | null = null;

export function storeBackend(): StoreBackend {
  if (backend) return backend;
  const idb = (globalThis as { indexedDB?: IDBFactory }).indexedDB;
  backend = idb ? idbBackend(idb) : memoryBackend();
  return backend;
}

/** 테스트용: 백엔드 바꾸기 */
export function setStoreBackend(b: StoreBackend | null): void {
  backend = b;
}

// ── 압축 (gzip, CompressionStream). 없으면 그대로 ──

export type Encoding = 'gzip' | 'json';

const hasStreams = (): boolean => typeof (globalThis as { CompressionStream?: unknown }).CompressionStream === 'function';

async function pipe(bytes: Uint8Array, stream: GenericTransformStream): Promise<Uint8Array> {
  const out = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(stream as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function compress(text: string): Promise<{ data: Uint8Array; enc: Encoding }> {
  const raw = new TextEncoder().encode(text);
  if (!hasStreams()) return { data: raw, enc: 'json' };
  return { data: await pipe(raw, new CompressionStream('gzip')), enc: 'gzip' };
}

/** gzip 이면 풀고(첫 두 바이트 1f 8b), 아니면 글자 그대로 */
export async function decompress(data: Uint8Array): Promise<string> {
  const gz = data.length > 2 && data[0] === 0x1f && data[1] === 0x8b;
  const bytes = gz ? await pipe(data, new DecompressionStream('gzip')) : data;
  return new TextDecoder().decode(bytes);
}
