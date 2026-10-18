// C.68b 확인 캡처: 재정 화면 세 탭(돈·스태프 · 카드 상점 · 생활·투자)과 카드 사기 · 카드팩 · 집 바꾸기 뒤를 찍는다.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c68-capture.mjs <playwright 경로> <저장 폴더> <save.json>. 환경: W H PREFIX
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c68b-check/', import.meta.url).pathname;
const save = readFileSync(process.argv[4], 'utf8');
const W = Number(process.env.W ?? 844);
const H = Number(process.env.H ?? 340);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => { errors.push(e.message); console.error('pageerror', e.stack); });
const has = async (sel) => (await page.locator(sel).count()) > 0;
const report = { W, H, errors, screens: {} };
const shot = async (name) => {
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  report.screens[name] = await page.evaluate(() => ({ wide: document.documentElement.scrollWidth - innerWidth }));
  console.log('saved', name, JSON.stringify(report.screens[name]));
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const click = async (sel) => { await page.evaluate((s) => document.querySelector(s)?.click(), sel); await page.waitForTimeout(400); await dismiss(); };
await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate((s1) => {
  localStorage.clear();
  localStorage.setItem('football-career:1', s1);
  localStorage.setItem('po-tips-off', '1');
  return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); });
}, save);
await page.reload();
await page.waitForTimeout(600);
if (!(await has('[data-act="load"][data-slot="1"]'))) await click('[data-act="go"][data-to="saves"]');
await page.waitForSelector('[data-act="load"][data-slot="1"]', { state: 'attached', timeout: 10_000 });
await click('[data-act="load"][data-slot="1"]');
await page.waitForTimeout(1000);
await dismiss();
await click('[data-act="go-tab"][data-v="home"]');
await click('[data-act="go"][data-to="finance"]');
await shot('재정-돈');
await click('[data-act="fn-tab"][data-v="shop"]');
await page.evaluate(() => window.scrollTo(0, 0)); await shot('재정-상점');
await click('[data-act="fn-buy"]:not([disabled])');
await click('[data-act="fn-pack"]:not([disabled])');
await page.evaluate(() => window.scrollTo(0, 99999)); await shot('재정-상점-산뒤');
await click('[data-act="fn-tab"][data-v="life"]');
await page.evaluate(() => window.scrollTo(0, 0)); await shot('재정-생활-위');
await click('[data-act="fn-life"][data-v="house:3"]:not([disabled])');
await page.evaluate(() => window.scrollTo(0, 99999)); await shot('재정-생활-아래');
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
console.log('errors', errors.length);
await browser.close();
