// C.77r: 세이브 형식 정책(형식이 다르면 이전하지 않고 안내·삭제)과 오프라인 PWA(서비스 워커 파일 목록)
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { newGame, playRound, SAVE_FORMAT_VERSION } from '../src/game';
import { compress } from '../src/saveStore';
import {
  deserialize, exportSave, importSave, initSaves, listSaves, loadGame, loadReplays, resetSaveCache, restore, sameFormat, SaveFormatError, saveGame, saveReplays, serialize,
} from '../src/save';
import { memoryBackend, setStoreBackend } from '../src/saveStore';
import { buildVersion, CACHE_PREFIX, listFiles, SW_FILE, swSource } from '../src/pwa/swBuild';
import { PATCH_LABEL } from '../src/version';

const game = (seed: string) => {
  const g = newGame({ mode: 'prospect', position: 'ST', seed, difficulty: 'normal' });
  playRound(g, { engine: 'quick' });
  return g;
};

describe('세이브 형식 정책 (C.77r)', () => {
  beforeEach(() => {
    setStoreBackend(memoryBackend());
    resetSaveCache();
  });

  it('같은 형식은 그대로 복원, 다른 형식(낮음·높음·없음)은 SaveFormatError', () => {
    const g = game('c77r-a');
    expect(serialize(deserialize(serialize(g)))).toBe(serialize(g));
    for (const v of [SAVE_FORMAT_VERSION - 1, 1, SAVE_FORMAT_VERSION + 1, undefined, '57']) {
      const raw = JSON.parse(serialize(g));
      raw.saveFormat = v;
      expect(sameFormat(raw)).toBe(false);
      expect(() => restore(raw)).toThrow(SaveFormatError);
      expect(() => restore(raw)).toThrow('이 세이브는 이전 버전 형식이라 이어 할 수 없습니다');
    }
    expect(sameFormat(JSON.parse(serialize(g)))).toBe(true);
  });

  it('다른 형식 슬롯을 불러오면 안내(SaveFormatError) 뒤 그 슬롯과 리플레이를 지운다, 다른 슬롯은 그대로', async () => {
    const g = game('c77r-b');
    expect(await saveGame('1', g)).toBe(true);
    expect(await saveGame('auto', g)).toBe(true);
    await saveReplays('auto', [{ season: 2018, round: 1, label: 'x', data: new Uint8Array([1]) }]);
    // 자동 저장 칸을 옛 형식으로 바꿔 쓴다
    const old = JSON.parse(serialize(g));
    old.saveFormat = SAVE_FORMAT_VERSION - 1;
    const json = JSON.stringify(old);
    const { data, enc } = await compress(json);
    const db = (await import('../src/saveStore')).storeBackend();
    const rec = await db.get<{ meta: unknown }>('slot:auto');
    await db.put('slot:auto', { meta: rec!.meta, data, enc, raw: json.length });
    await expect(loadGame('auto')).rejects.toThrow(SaveFormatError);
    expect(listSaves()[0]).toBeNull();
    expect(await db.get('slot:auto')).toBeUndefined();
    expect(await loadReplays('auto')).toEqual([]);
    expect(await loadGame('auto')).toBeNull();
    // 같은 형식 슬롯은 정상
    const back = await loadGame('1');
    expect(serialize(back!)).toBe(serialize(g));
    // 다시 열어도 슬롯 목록이 맞다
    resetSaveCache();
    await initSaves();
    expect(listSaves()[0]).toBeNull();
    expect(listSaves()[1]?.name).toBe(g.player.name);
  });

  it('파일 가져오기: 다른 형식은 같은 안내, 저장하지 않는다', async () => {
    const g = game('c77r-c');
    const old = JSON.parse(serialize(g));
    old.saveFormat = SAVE_FORMAT_VERSION - 3;
    const { data } = await compress(JSON.stringify({ kind: 'football-career-save', meta: {}, state: old }));
    await expect(importSave(data)).rejects.toThrow(SaveFormatError);
    await initSaves();
    expect(listSaves().every((m) => m === null)).toBe(true);
    // 같은 형식 파일은 정상
    expect(serialize(await importSave(await exportSave(g)))).toBe(serialize(g));
  });

  it('세이브 밖 데이터(명예의 전당 등 localStorage)는 건드리지 않고, 옛 localStorage 세이브(C.40 까지)만 지운다', async () => {
    const ls = new Map<string, string>([['football-career:1', '{"meta":{},"state":{"saveFormat":19}}'], ['football-career:legacy', '{"top":[]}']]);
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => ls.get(k) ?? null, setItem: (k: string, v: string) => void ls.set(k, v), removeItem: (k: string) => void ls.delete(k),
    };
    try {
      await initSaves();
      expect(ls.has('football-career:1')).toBe(false);
      expect(ls.get('football-career:legacy')).toBe('{"top":[]}');
      expect(listSaves()[1]).toBeNull();
    } finally {
      delete (globalThis as { localStorage?: unknown }).localStorage;
    }
  });

  it('같은 시드 지문 불변: 저장·복원 뒤 같은 날을 진행하면 결과가 같다', () => {
    const a = game('c77r-fp');
    const b = deserialize(serialize(a));
    playRound(a, { engine: 'quick' });
    playRound(b, { engine: 'quick' });
    expect(serialize(b)).toBe(serialize(a));
  });
});

describe('오프라인 PWA: 서비스 워커 파일 목록 (C.77r)', () => {
  const fake = () => {
    const dir = mkdtempSync(join(tmpdir(), 'c77r-'));
    mkdirSync(join(dir, 'assets'));
    mkdirSync(join(dir, 'facepack', 'players'), { recursive: true });
    writeFileSync(join(dir, 'index.html'), '<html></html>');
    writeFileSync(join(dir, 'assets', 'index-abc.js'), 'x');
    writeFileSync(join(dir, 'assets', 'index-abc.js.map'), '{}');
    writeFileSync(join(dir, 'facepack', 'players', '한글 이름.png'), 'p');
    writeFileSync(join(dir, SW_FILE), 'old');
    return dir;
  };

  it('dist 전체(하위 폴더 포함)를 상대 경로로, sw.js·소스맵은 빼고 정렬', () => {
    expect(listFiles(fake())).toEqual(['assets/index-abc.js', 'facepack/players/한글 이름.png', 'index.html']);
  });

  it('버전 = 커밋 + 내용 해시, 내용이 바뀌면 바뀐다', () => {
    const dir = fake();
    const files = listFiles(dir);
    const v1 = buildVersion(dir, files, 'abc1234');
    expect(v1).toMatch(/^abc1234-[0-9a-f]{8}$/);
    expect(buildVersion(dir, files, 'abc1234')).toBe(v1);
    writeFileSync(join(dir, 'index.html'), '<html>2</html>');
    expect(buildVersion(dir, files, 'abc1234')).not.toBe(v1);
  });

  it('소스: base \'./\' 기준 상대 경로 · 버전별 캐시 · 옛 캐시 정리 · 자동 skipWaiting 없음', () => {
    const src = swSource(['index.html', 'assets/a.js'], 'v1-deadbeef');
    expect(src).toContain('"./","./index.html","./assets/a.js"');
    expect(src).toContain(`const CACHE = "${CACHE_PREFIX}" + VERSION`);
    expect(src).toContain('caches.delete(k)');
    // 설치 때 바로 넘어가지 않고, 화면의 메시지('skip-waiting')로만 넘어간다
    expect(src.match(/skipWaiting\(\)/g)).toHaveLength(1);
    expect(src).toContain("ev.data === 'skip-waiting'");
    expect(src).not.toMatch(/['"]\/(assets|index)/);
    // 문법 확인
    expect(() => new Function(src)).not.toThrow();
  });

  it('매니페스트: 설치 조건 (이름·아이콘 192/512·standalone·start_url 상대)', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'));
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    expect(m.scope).toBe('./');
    for (const size of ['192x192', '512x512']) expect(m.icons.some((i: { sizes: string }) => i.sizes === size)).toBe(true);
    expect(m.icons.some((i: { purpose: string }) => i.purpose === 'maskable')).toBe(true);
    for (const i of m.icons) expect(existsSync(join('public', i.src))).toBe(true);
    const html = readFileSync('index.html', 'utf8');
    expect(html).toContain('rel="manifest" href="./manifest.webmanifest"');
    expect(html).toContain('rel="apple-touch-icon"');
  });

  it('버전 표시', () => {
    expect(PATCH_LABEL).toMatch(/^C\.\d+[a-z]*$/);
  });
});
