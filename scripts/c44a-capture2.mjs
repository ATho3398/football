// C.44a 추가 캡처: 직접 모드 결정 순간(화살표)·결과 재생, 경기 결과 평균 위치 지도 (폰 세로)
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = new URL('../docs/design/c44a-check/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = Number(process.env.W ?? 390), H = Number(process.env.H ?? 844), P = process.env.PREFIX ?? 'phone_';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await (await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 2 })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 5; k++) {
    if (await has('[data-act="tips-off"]')) await page.locator('[data-act="tips-off"]').first().click();
    else if (await has('[data-act="intro-ok"]')) await page.locator('[data-act="intro-ok"]').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]')) await page.locator('[data-act="tip-close"]').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const act = async (a, extra = '') => { await dismiss(); await page.locator(`[data-act="${a}"]${extra}`).first().click(); await page.waitForTimeout(250); };
await page.goto('http://localhost:4173/');
await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
await page.reload();
await page.waitForTimeout(500);
await act('go', '[data-to="new"]');
await act('form', '[data-k="mode"][data-v="real"]');
await act('form', '[data-k="realId"][data-v="son"]');
await page.fill('#f-seed', 'c44a-check');
await act('start');
await dismiss();
await act('go', '[data-to="settings"]');
await act('opt-quick', '[data-v="quick"]');
await act('go-tab', '[data-v="home"]');
for (let k = 0; k < 20 && !(await has('[data-act="play"]')); k++) { await act('day-continue'); await page.waitForTimeout(400); }
await act('play');
for (let k = 0; k < 40 && !(await has('#mo-canvas')); k++) await page.waitForTimeout(500);
await dismiss();
await page.waitForTimeout(4000);
await page.screenshot({ path: `${OUT}/${P}9a_결정순간-화살표.png` });
const opt = page.locator('[data-act="mo-pick"]').first();
if (await opt.count()) { await opt.click(); await page.waitForTimeout(600); await page.screenshot({ path: `${OUT}/${P}9b_결정순간-선택.png` }); }
console.log(JSON.stringify({ errors, moment: await has('#mo-canvas') }));
await browser.close();
