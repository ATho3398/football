// C.75u 확인 캡처 (홈 머리말 긴 이름): 새 게임 이름 칸에 긴 이름을 넣고 홈 얼굴 머리말을 찍는다. 세로 폰 390×844 기본 · PC 1280×800 (W H PREFIX NAMES).
// 실행: npm run build && npx vite preview --port 4173 & 그다음 node scripts/c75u-capture.mjs [playwright 모듈 경로] [저장 폴더]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.argv[2] ?? 'playwright');
const OUT = process.argv[3] ?? new URL('../docs/c75u-check/', import.meta.url).pathname;
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const P = process.env.PREFIX ?? '';
const NAMES = (process.env.NAMES ?? '율리안 린트너,로베르트 레반도프스키,바스티안 슈바인슈타이거').split(',');
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: 'dark', deviceScaleFactor: 1, hasTouch: W < 1024 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const has = async (sel) => (await page.locator(sel).count()) > 0;
async function dismiss() {
  for (let k = 0; k < 6; k++) {
    if (await has('[data-act="intro-ok"]:visible')) await page.locator('[data-act="intro-ok"]:visible').first().click();
    else if (await has('.fm-card [data-act="fm-close"]')) await page.locator('.fm-card [data-act="fm-close"]').click();
    else if (await has('[data-act="tip-close"]:visible')) await page.locator('[data-act="tip-close"]:visible').first().click();
    else break;
    await page.waitForTimeout(150);
  }
}
const report = { W, H, errors, names: {} };
for (const name of NAMES) {
  await page.goto(process.env.URL ?? 'http://localhost:4173/');
  await page.evaluate(() => { localStorage.clear(); return new Promise((r) => { const q = indexedDB.deleteDatabase('football-career'); q.onsuccess = q.onerror = q.onblocked = () => r(null); }); });
  await page.reload();
  await page.locator('[data-act="go"][data-to="new"]:visible').first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-act="ng-random"]:visible').first().click();
  await page.waitForTimeout(300);
  await page.fill('#f-name', name);
  await page.locator('#f-name').dispatchEvent('change');
  await page.waitForTimeout(200);
  await dismiss();
  await page.locator('[data-act="start"]:visible').first().click();
  await page.waitForTimeout(800);
  await page.locator('[data-act="tips-off"]:visible').first().click({ timeout: 1500 }).catch(() => null);
  await dismiss();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  const m = await page.evaluate(() => {
    const el = document.querySelector('.po-hero__name[data-fit]');
    if (!el) return null;
    const r = document.createRange(); r.selectNodeContents(el);
    return { text: el.textContent, font: el.style.fontSize, textW: +r.getBoundingClientRect().width.toFixed(2), boxW: +el.getBoundingClientRect().width.toFixed(2), lines: Math.round(el.getBoundingClientRect().height / parseFloat(el.style.lineHeight)) };
  });
  m.cut = m.textW > m.boxW;
  report.names[name] = m;
  const box = await page.locator('.po-hero').first().boundingBox();
  await page.screenshot({ path: `${OUT}/${P}홈-${name.replace(/ /g, '')}.png`, clip: box && W < 1024 ? { x: 0, y: 0, width: W, height: Math.min(H, box.y + box.height + 24) } : undefined });
  console.log(name, JSON.stringify(m));
}
writeFileSync(`${OUT}/${P}report.json`, JSON.stringify(report, null, 2));
await browser.close();
