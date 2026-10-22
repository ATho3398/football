// C.77r 오프라인 PWA 확인 (헤드리스 Chromium): GitHub Pages 처럼 하위 경로(/football/)에 dist 를 올리고
// ① 한 번 열기(서비스 워커 설치·미리 캐시) → ② 네트워크 끔 → 새로고침 → 타이틀 · 새 게임 · 경기 1번(결과 화면)까지
// ③ 네트워크 켬 → 새 버전(sw.js 버전 바꿈) → "새 버전 — 다시 열기" 띠 → 누르면 새로고침 · 옛 캐시 정리
// 실행: npm run build && node scripts/c77r-offline.mjs [playwright 모듈 경로] [저장 폴더]
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c77r-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const root = mkdtempSync(join(tmpdir(), 'c77r-site-'));
cpSync(new URL('../dist/', import.meta.url).pathname, join(root, 'football'), { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.jpg': 'image/jpeg' };
let hits = 0;
const offHits = [];
const server = createServer((req, res) => {
  hits++;
  // 네트워크 끔 동안 서버도 없는 것처럼 (브라우저 자체의 sw.js 갱신 확인만 여기 닿는다)
  if (globalThis.__off) {
    offHits.push(req.url);
    res.destroy();
    return;
  }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = readFileSync(join(root, normalize(p)));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const URL_ = `http://localhost:${server.address().port}/football/`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark', hasTouch: true, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="tips-off"]:visible')) await page.locator('[data-act="tips-off"]:visible').first().click();
    else if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
// 다시 그리기(innerHTML)로 단추가 바뀌면 한 번 더 누른다
const act = async (a, extra = '') => {
  for (let k = 0; ; k++) {
    await dismiss();
    try {
      await page.locator(`[data-act="${a}"]${extra}:visible`).first().click({ timeout: 8_000 });
      break;
    } catch (e) {
      if (k >= 2) throw e;
    }
  }
  await page.waitForTimeout(250);
};
const report = { url: URL_, errors, steps: {} };
const step = (k, v) => { report.steps[k] = v; console.log(k, JSON.stringify(v)); };

// ① 온라인으로 한 번 열기
await page.goto(URL_);
const sw = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready;
  for (let k = 0; k < 100 && !navigator.serviceWorker.controller; k++) await new Promise((r) => setTimeout(r, 100));
  const keys = await caches.keys();
  const c = await caches.open(keys[0]);
  return { scope: reg.scope, controlled: !!navigator.serviceWorker.controller, caches: keys, cached: (await c.keys()).length };
});
step('1_online_sw', sw);
const files = readFileSync(join(root, 'football', 'sw.js'), 'utf8').match(/const FILES = (\[.*\]);/)[1];
step('1_precache_list', { files: JSON.parse(files).length });

// ② 네트워크 끔 → 새로고침
await ctx.setOffline(true);
globalThis.__off = true;
await page.reload();
await page.waitForSelector('[data-act="go"][data-to="new"]', { timeout: 15_000 });
await page.screenshot({ path: `${OUT}/폰_오프라인_타이틀.png` });
step('2_offline_title', { ok: true, offline: !(await page.evaluate(() => navigator.onLine)) });
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]:visible'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c77r-offline');
await act('start');
await page.waitForTimeout(800);
await dismiss();
await page.screenshot({ path: `${OUT}/폰_오프라인_새게임_홈.png` });
step('2_offline_newgame', { home: await has('main.screen-home') });
for (let k = 0; k < 8 && !(await has('[data-act="play"]:visible')); k++) {
  if (await has('[data-act="day-continue"]:visible')) { await act('day-continue'); await page.waitForTimeout(1500); }
}
for (let k = 0; k < 120 && (await has('[data-act="sim-stop"]:visible')); k++) await page.waitForTimeout(500);
if (await has('[data-act="ctl-mode"][data-v="auto"]:visible')) await act('ctl-mode', '[data-v="auto"]');
await act('play');
for (let k = 0; k < 240 && !(await has('main.screen-match')); k++) {
  if (await has('[data-act="prep-start"]:visible')) await act('prep-start');
  if (await has('[data-act="rp-skip"]:visible')) await act('rp-skip');
  await page.waitForTimeout(500);
}
await page.waitForSelector('main.screen-match', { timeout: 180_000 });
await page.waitForTimeout(800);
await dismiss();
await page.screenshot({ path: `${OUT}/폰_오프라인_경기결과.png` });
step('2_offline_match', { result: await has('main.screen-match'), offlineRequestsToServer: offHits, faces: await page.evaluate(() => document.querySelectorAll('img').length) });

// ③ 새 버전: 온라인으로 돌아와 sw.js 버전을 바꾼다 → 설치(대기) → 띠 → [다시 열기]
globalThis.__off = false;
await ctx.setOffline(false);
const swPath = join(root, 'football', 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-next"'));
await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
await page.waitForSelector('.sw-update', { timeout: 30_000 });
await page.screenshot({ path: `${OUT}/폰_새버전_띠.png` });
step('3_update_banner', { text: await page.locator('.sw-update').innerText() });
const nav = page.waitForEvent('framenavigated', { timeout: 15_000 });
await page.locator('[data-act="sw-reload"]').click();
await nav;
await page.waitForSelector('[data-act="go"]', { timeout: 15_000 });
await page.waitForTimeout(800);
step('3_after_reload', await page.evaluate(async () => ({ caches: await caches.keys(), banner: !!document.querySelector('.sw-update'), cont: !!document.querySelector('[data-act="continue"], [data-act="go"][data-to="home"]') })));
writeFileSync(`${OUT}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
server.close();
console.log('errors', errors.length ? errors : 'none');
