// C.76m 미리 계산 전후 날짜 넘김 대기 (브라우저 워커). 바쁜 날 아침 세이브를 불러와
//  A) 미리 계산 끔(__noPrecompute) → 바로 [하루 진행]  B) 홈에서 미리 계산이 그날 경기를 다 계산할 때까지 기다린 뒤 [하루 진행]
// 실행: npm run build && npx vite preview --port 4173 & 그다음 SAVE=<fcsave.gz> node scripts/c76m-speed.mjs [playwright 모듈 경로]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());

async function run(pre) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const has = async (s) => (await page.locator(s).count()) > 0;
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload(); await page.waitForTimeout(400);
  await page.evaluate((off) => { globalThis.__noPrecompute = off; }, !pre);
  await page.locator('[data-act="go"][data-to="saves"]').first().click(); await page.waitForTimeout(300);
  await page.setInputFiles('#import-file', process.env.SAVE);
  await page.waitForTimeout(2000);
  for (const s of ['[data-act="tips-off"]', '[data-act="intro-ok"]', '[data-act="tip-close"]']) if (await has(`${s}:visible`)) await page.locator(`${s}:visible`).first().click().catch(() => null);
  let waited = 0;
  if (pre) {
    const t = Date.now();
    // 홈에 머무는 동안: 보관한 것이 다 끝날 때까지 (최대 3분)
    await page.waitForFunction(() => { const p = globalThis.__pool?.()?.planned; return p && p.total > 0 && p.ready >= p.total; }, null, { timeout: 180000, polling: 500 }).catch(() => null);
    waited = Date.now() - t;
  }
  const planned = await page.evaluate(() => globalThis.__pool?.()?.planned);
  const t0 = Date.now();
  await page.locator('[data-act="day-one"]:visible').first().click();
  await page.waitForFunction(() => (globalThis.__progress ?? []).length >= 1, null, { timeout: 300000, polling: 100 });
  const wall = Date.now() - t0;
  const log = await page.evaluate(() => globalThis.__progress);
  const pool = await page.evaluate(() => globalThis.__pool?.());
  await page.context().close();
  return { pre, waitedMs: waited, planned, dayMs: log[0].ms, matches: log[0].matches, wallMs: wall, hits: pool?.hits, misses: pool?.misses };
}
const cores = 0;
const a = await run(false);
const b = await run(true);
console.log(JSON.stringify({ save: process.env.SAVE.split('/').pop(), a, b }));
await browser.close();
