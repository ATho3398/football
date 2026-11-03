// C.80y 캡처: 옛(v59) 세이브가 든 브라우저에서 새 빌드 열기 → 이전 → 이어 하기, 그리고 이전 실패 안내.
// 실행: OLD=<옛 빌드 dist> NEW=<새 빌드 dist> node scripts/c80y-capture.mjs [저장 폴더]
// 같은 주소(포트)에서 옛 빌드 → 새 빌드 순으로 띄워 같은 IndexedDB 를 쓴다 (서비스 워커는 막는다)
import { mkdirSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PW ?? 'playwright');

const OUT = process.argv[2] ?? new URL('../docs/captures/c80y/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const FIX = new URL('../tests/fixtures/saves/v59.json', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
let root = process.env.OLD;
const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = readFileSync(join(root, p));
    res.writeHead(200, { 'content-type': types[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(4188);
const URL0 = 'http://localhost:4188/';
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'c80y-')), { viewport: { width: 390, height: 844 }, colorScheme: 'dark', deviceScaleFactor: 2, serviceWorkers: 'block' });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const report = { errors, steps: [] };
const shot = async (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const text = async (sel) => (await page.locator(sel).first().textContent({ timeout: 4000 }).catch(() => ''))?.trim();

/** 슬롯에 세이브 JSON 을 직접 써 넣기 (gzip, saveStore 와 같은 모양) */
async function putSave(slot, json) {
  await page.evaluate(async ([slot, json]) => {
    const raw = new TextEncoder().encode(json);
    const data = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
    const s = JSON.parse(json);
    const meta = { slot, savedAt: new Date().toISOString(), name: s.player.name, season: s.league.season, round: s.league.round, age: s.player.age, startPatch: s.startPatch, date: s.calendar.date, size: data.length };
    await new Promise((ok, bad) => {
      const req = indexedDB.open('football-career', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('saves');
      req.onsuccess = () => {
        const tx = req.result.transaction('saves', 'readwrite');
        tx.objectStore('saves').put({ meta, data, enc: 'gzip', raw: json.length }, `slot:${slot}`);
        tx.oncomplete = () => { req.result.close(); ok(); };
        tx.onerror = () => bad(tx.error);
      };
      req.onerror = () => bad(req.error);
    });
  }, [slot, json]);
}
const idbKeys = () => page.evaluate(() => new Promise((ok) => {
  const req = indexedDB.open('football-career', 1);
  req.onsuccess = () => { const r = req.result.transaction('saves').objectStore('saves').getAllKeys(); r.onsuccess = () => { req.result.close(); ok(r.result.map(String)); }; };
}));

// 1. 옛 빌드(C.80q, 형식 59): 세이브를 넣고 이어 하기 되는지
const fixture = readFileSync(FIX, 'utf8').trim();
await page.goto(URL0);
await page.waitForSelector('[data-act="go"]');
await putSave('auto', fixture);
{ const b = JSON.parse(fixture); b.league.schedule = 3; await putSave('1', JSON.stringify(b)); } // 이전 검증에서 걸리게 (league.schedule)
await page.reload();
await page.waitForSelector('[data-act="continue"]');
await shot('01-old-build-title');
report.steps.push({ step: 'old title', version: await text('.version, [class*="version"]') });
await page.click('[data-act="continue"]');
await page.waitForTimeout(1500);
await shot('02-old-build-continue');
report.steps.push({ step: 'old continue', toast: await text('.po-toast') });

// 2. 새 빌드(C.80y, 형식 60)로 바꿔 같은 브라우저에서 열기 → 이어하기 → 이전
root = process.env.NEW;
await page.goto(URL0);
await page.waitForSelector('[data-act="continue"]');
await shot('03-new-build-title');
await page.click('[data-act="continue"]');
await page.waitForSelector('.po-toast', { timeout: 8000 });
await page.waitForTimeout(300);
await shot('04-new-build-migrated-toast');
report.steps.push({ step: 'new continue', toast: await text('.po-toast'), keys: await idbKeys() });

// 3. 한 주 진행처럼: 다음 날 넘기기 버튼이 있으면 몇 번 누르고 저장 슬롯 확인
for (let i = 0; i < 3; i++) {
  const b = page.locator('[data-act="end-day"], [data-act="next-day"]').first();
  if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(600); }
}
await shot('05-new-build-after-days');

// 4. 다시 열기: 이번에는 이전 없이 (토스트 없음)
await page.goto(URL0);
await page.waitForSelector('[data-act="continue"]');
await page.click('[data-act="continue"]');
await page.waitForTimeout(1500);
report.steps.push({ step: 'reopen', toast: await text('.po-toast') });

// 5. 이전 실패: 슬롯 1 (player 빠진 형식 59) → 안내 창
await page.goto(URL0);
await page.waitForSelector('[data-act="go"]');
await page.click('[data-act="go"][data-to="saves"]').catch(async () => { await page.evaluate(() => location.hash = '#saves'); });
await page.waitForTimeout(800);
await shot('06-saves');
const load1 = page.locator('[data-act="load"][data-slot="1"]');
report.steps.push({ step: 'saves', load1: await load1.count() });
if (await load1.count()) {
  await load1.click();
  await page.waitForTimeout(1200);
  await shot('07-migration-failed-modal');
  report.steps.push({ step: 'fail modal', modal: await text('.po-modal') });
  const dl = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await page.click('[data-act="mig-backup"]').catch(() => {});
  const d = await dl;
  report.steps.push({ step: 'backup download', file: d?.suggestedFilename() ?? null });
  await page.waitForTimeout(500);
  await shot('08-backup-downloaded');
  report.steps.push({ step: 'after fail keys', keys: await idbKeys() });
}
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await ctx.close();
server.close();
