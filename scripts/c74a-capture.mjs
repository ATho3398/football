// C.74a 확인 캡처: 다음 경기 카드 예보(공개 전 → 공개 · 비 · 심판) → 결과 화면 "빗속 경기" 한 줄 → 하이라이트 비·눈·강풍 입자.
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c74a-capture.mjs [playwright 모듈 경로] [저장 폴더]. 환경: W H PREFIX SKIN(a|b)
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/design/c74a-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
const wide = () => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
const shot = async (name, sel) => {
  await page.waitForTimeout(400);
  if (sel && (await has(sel))) { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.waitForTimeout(150); }
  await page.screenshot({ path: `${OUT}/${P}${name}.png` });
  console.log('saved', name, 'wide', await wide());
};
async function dismiss() {
  for (let k = 0; k < 4; k++) {
    if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const click = async (sel) => { await dismiss(); await page.locator(`${sel}:visible`).first().click(); await page.waitForTimeout(250); };

await page.goto(process.env.URL ?? 'http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
if (process.env.SKIN === 'a') await page.evaluate(() => localStorage.setItem('po-skin', 'a'));
await page.reload();
await click('[data-act="go"][data-to="new"]');
// 첫 경기가 비인 시드 (토트넘 홈 · 손흥민)
await page.fill('#f-seed', 'c74a-2'); await page.locator('#f-seed').dispatchEvent('change');
await click('[data-act="form"][data-k="mode"][data-v="real"]');
await page.waitForTimeout(300);
if (!(await has('[data-act="form"][data-k="realId"][data-v="son"]'))) { await page.fill('#f-rq', '손흥민'); await page.locator('#f-rq').dispatchEvent('change'); await page.waitForTimeout(600); }
await page.locator('[data-act="form"][data-k="realId"][data-v="son"]').first().click();
await click('[data-act="start"]'); await page.waitForTimeout(900);
await page.evaluate(() => document.querySelector('[data-act="tips-off"]')?.click()); await page.waitForTimeout(300);
await dismiss();
console.log('env closed', await has('.hm-env.is-closed'));
await shot('1_홈_예보_공개전', '.hm-env');
for (let k = 0; k < 8 && (await has('.hm-env.is-closed')); k++) { await click('[data-act="day-one"]'); await page.waitForTimeout(700); await dismiss(); }
console.log('env open', await has('.hm-env:not(.is-closed)'), await page.evaluate(() => document.querySelector('.hm-env')?.textContent?.replace(/\s+/g, ' ').trim()));
await shot('2_홈_예보_비_심판', '.hm-env');
for (let k = 0; k < 8 && !(await has('[data-act="play"]')); k++) { if (await has('[data-act="day-continue"]')) { await click('[data-act="day-continue"]'); await page.waitForTimeout(1500); await dismiss(); } }
if (await has('[data-act="ctl-mode"][data-v="auto"]')) await click('[data-act="ctl-mode"][data-v="auto"]');
await click('[data-act="play"]');
await page.waitForSelector('main.screen-prep', { timeout: 60_000 }).catch(() => {}); await dismiss();
if (await has('[data-act="prep-start"]')) await click('[data-act="prep-start"]');
await page.waitForSelector('.mr-env-line', { timeout: 90_000 }).catch(() => {});
await page.waitForTimeout(800); await dismiss();
console.log('result line', await page.evaluate(() => document.querySelector('.mr-env-line')?.textContent?.trim()));
await page.evaluate(() => window.scrollTo(0, 0));
await shot('3_결과_빗속경기');
if (await has('[data-act="hl-rewatch"]')) {
  await click('[data-act="hl-rewatch"]');
  await page.waitForTimeout(800);
  for (let k = 0; k < 3; k++) { const b = page.locator('button:has-text("알겠어요")'); if (await b.count()) { await b.first().click(); await page.waitForTimeout(300); } }
  await page.evaluate(() => document.querySelector('#rp-canvas, canvas')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2000);
  await shot('4_하이라이트_비');
  await page.evaluate(() => globalThis.__pitchWeather('snow')); await page.waitForTimeout(1500);
  await shot('5_하이라이트_눈_한파');
  await page.evaluate(() => globalThis.__pitchWeather('wind')); await page.waitForTimeout(1500);
  await shot('6_하이라이트_강풍');
  // 30fps 부담: 1초 동안 그려진 프레임 수 (requestAnimationFrame)
  const fps = await page.evaluate(() => new Promise((r) => { globalThis.__pitchWeather('rain'); let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  console.log('raf fps (rain)', fps);
}
console.log('errors', JSON.stringify(errors));
await browser.close();
