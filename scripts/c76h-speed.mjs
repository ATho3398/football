// 45b(b) 브라우저 워커 측정: 세이브를 불러와 [계속]으로 며칠 진행하고 window.__progress(날짜·ms·경기 수)를 모은다. 다른 경기 계산 = 전체 엔진(기본)
// 실행: npm run build && npx vite preview --port 4173 & 그다음 SAVE=<fcsave.gz> DAYS=14 node scripts/c76h-speed.mjs [playwright 모듈 경로]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const has = async (s) => (await page.locator(s).count()) > 0;
await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload(); await page.waitForTimeout(400);
await page.locator('[data-act="go"][data-to="saves"]').first().click(); await page.waitForTimeout(300);
await page.setInputFiles('#import-file', process.env.SAVE);
await page.waitForTimeout(2500);
for (const s of ['[data-act="tips-off"]', '[data-act="intro-ok"]', '[data-act="tip-close"]']) if (await has(`${s}:visible`)) await page.locator(`${s}:visible`).first().click().catch(() => null);
const cores = await page.evaluate(() => navigator.hardwareConcurrency);
const days = Number(process.env.DAYS ?? 14);
const t0 = Date.now();
for (let k = 0; k < 60; k++) {
  const n = await page.evaluate(() => (globalThis.__progress ?? []).length);
  if (n >= days) break;
  // 경기 날이면 [계속]이 그날 다른 경기만 계산하고 멈춘다 → 내 경기는 자동(빠른 진행 없음)으로 넘기지 않고 하루 진행만 센다
  const btn = page.locator('[data-act="continue"]:visible, [data-act="day-continue"]:visible').first();
  if (!(await btn.count())) break;
  await btn.click();
  await page.waitForFunction(() => !document.querySelector('.po-toast, [class*="toast"]') || true, null, { timeout: 5000 }).catch(() => null);
  await page.waitForTimeout(500);
  for (let w = 0; w < 600 && (await page.evaluate(() => !!document.querySelector('[data-act="sim-stop"]'))); w++) await page.waitForTimeout(500);
  if (await has('[data-act="prep-start"]:visible')) break;
}
const log = await page.evaluate(() => globalThis.__progress ?? []);
const pool = await page.evaluate(() => globalThis.__pool?.());
const busy = log.filter((x) => x.matches > 0);
const ms = busy.reduce((t, x) => t + x.ms, 0), m = busy.reduce((t, x) => t + x.matches, 0);
console.log(JSON.stringify({ cores, days: log.length, matchDays: busy.length, matches: m, msTotal: ms, msPerMatch: m ? Math.round(ms / m) : null, maxDay: busy.reduce((a, x) => (x.matches > a.matches ? x : a), { matches: 0 }), wall: Date.now() - t0, pool }, null, 1));
await browser.close();
